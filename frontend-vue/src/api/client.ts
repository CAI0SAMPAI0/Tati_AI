export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T;
}

export class ApiClientError<T = unknown> extends Error {
  readonly status: number;
  readonly data: T | null;
  readonly path: string;

  constructor(message: string, status: number, path: string, data: T | null = null) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.path = path;
    this.data = data;
  }
}

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface RequestOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
  auth?: boolean;
  retry401?: boolean;
  _retried?: boolean;
}

export const API_BASE =
  import.meta.env.VITE_API_BASE_URL ||
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://127.0.0.1:8000'
    : '');

export const WS_BASE =
  import.meta.env.VITE_WS_BASE_URL ||
  (API_BASE
    ? API_BASE.replace(/^http/, 'ws')
    : typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'ws://127.0.0.1:8000'
    : typeof window !== 'undefined' && window.location?.host
    ? `${window.location.protocol === 'https:' ? 'wss:' : 'ws:'}//${window.location.host}`
    : '');

let onUnauthorized: (() => void) | null = null;

export function registerUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

function resolvePath(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
  const base = API_BASE.replace(/\/$/, '');
  const cleanPath = path.startsWith('/') ? path : `/${path}`;
  return `${base}${cleanPath}`;
}

async function request<T>(
  method: HttpMethod,
  path: string,
  body?: any,
  options: RequestOptions = {}
): Promise<T> {
  const url = resolvePath(path);
  const headers: Record<string, string> = {
    ...options.headers,
  };

  const token = typeof window !== 'undefined' ? localStorage.getItem('token') : null;
  if (options.auth !== false && token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  let finalBody = body;
  if (body !== undefined && !(body instanceof FormData) && !(body instanceof URLSearchParams)) {
    headers['Content-Type'] = 'application/json';
    finalBody = JSON.stringify(body);
  }

  const response = await fetch(url, {
    method,
    headers,
    body: finalBody,
    ...options,
  });

  if (response.status === 401 && options.auth !== false && !options._retried) {
    const refreshToken = typeof window !== 'undefined' ? localStorage.getItem('refresh_token') : null;
    if (refreshToken) {
      try {
        const refreshRes = await fetch(resolvePath('/auth/refresh'), {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh_token: refreshToken }),
        });
        if (refreshRes.ok) {
          const data = await refreshRes.json();
          if (data.access_token) {
            localStorage.setItem('token', data.access_token);
            return request<T>(method, path, body, { ...options, _retried: true });
          }
        }
      } catch {}
    }

    if (onUnauthorized) {
      onUnauthorized();
    }
  }

  let responseData: any = null;
  const contentType = response.headers.get('content-type') || '';
  if (contentType.includes('application/json')) {
    try {
      responseData = await response.json();
    } catch {
      responseData = null;
    }
  } else {
    try {
      responseData = await response.text();
    } catch {
      responseData = null;
    }
  }

  if (!response.ok) {
    const message = responseData?.detail || responseData?.message || `Request failed with status ${response.status}`;
    throw new ApiClientError(message, response.status, path, responseData);
  }

  return responseData as T;
}

export function apiGet<T>(path: string, options?: RequestOptions): Promise<T> {
  return request<T>('GET', path, undefined, options);
}

export function apiPost<T>(path: string, body?: any, options?: RequestOptions): Promise<T> {
  return request<T>('POST', path, body, options);
}

export function apiPut<T>(path: string, body?: any, options?: RequestOptions): Promise<T> {
  return request<T>('PUT', path, body, options);
}

export function apiPatch<T>(path: string, body?: any, options?: RequestOptions): Promise<T> {
  return request<T>('PATCH', path, body, options);
}

export function apiDelete<T>(path: string, options?: RequestOptions): Promise<T> {
  return request<T>('DELETE', path, undefined, options);
}

export function apiPostForm<T>(path: string, form: URLSearchParams | FormData, options?: RequestOptions): Promise<T> {
  return request<T>('POST', path, form, options);
}
