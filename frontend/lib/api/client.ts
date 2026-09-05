'use client';

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
type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

interface RequestOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
  auth?: boolean;
  retry401?: boolean;
  _retried?: boolean;
}

const REFRESH_PATH = process.env.NEXT_PUBLIC_AUTH_REFRESH_PATH;
export const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ||
  (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'http://127.0.0.1:8000'
    : '');

export const WS_BASE =
  process.env.NEXT_PUBLIC_WS_BASE_URL ||
  (API_BASE
    ? API_BASE.replace(/^http/, 'ws')
    : typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
    ? 'ws://127.0.0.1:8000'
    : '');

let onUnauthorized: (() => void) | null = null;

export function registerUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

function isAbsoluteUrl(value: string): boolean {
  return /^https?:\/\//i.test(value);
}

function resolvePath(path: string): string {
  if (isAbsoluteUrl(path)) return path;
  
  const isBypassRedirect = 
    API_BASE.includes('localhost') || 
    API_BASE.includes('127.0.0.1') || 
    API_BASE.includes('hf.space') ||
    (typeof window !== 'undefined' && 
      (window.location.hostname === 'localhost' || 
       window.location.hostname === '127.0.0.1' || 
       window.location.hostname.includes('hf.space')));

  // Materiais e Pagamentos usam NEXT_PUBLIC_RAILWAY_API_URL se especificado; caso contrário usam o effectiveBase
  if (
    (path.includes('/admin/premium') || 
     path.includes('/activities/premium') || 
     path.includes('/activities/hub') ||
     path.includes('/payments')) &&
    process.env.NEXT_PUBLIC_RAILWAY_API_URL
  ) {
    const railwayBase = process.env.NEXT_PUBLIC_RAILWAY_API_URL.replace(/\/$/, '');
    return `${railwayBase}${path.startsWith('/') ? path : `/${path}`}`;
  }

  // Se estiver rodando no servidor (SSR) dentro do Docker, usa o DNS interno
  if (typeof window === 'undefined' && process.env.INTERNAL_API_URL) {
    const base = process.env.INTERNAL_API_URL.replace(/\/$/, '');
    return `${base}${path.startsWith('/') ? path : `/${path}`}`;
  }

  const effectiveBase =
    API_BASE ||
    (typeof window !== 'undefined' && (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
      ? 'http://127.0.0.1:8000'
      : '');
  return `${effectiveBase.replace(/\/$/, '')}${path.startsWith('/') ? path : `/${path}`}`;
}

function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('token');
}

function getRefreshToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('refresh_token');
}

function getLang(): string {
  if (typeof window === 'undefined') return 'pt-BR';
  return localStorage.getItem('tati_lang') ?? navigator.language ?? 'pt-BR';
}

function buildHeaders(
  extra: Record<string, string> = {},
  auth = true,
  tokenOverride?: string | null,
): Record<string, string> {
  const token = tokenOverride ?? getToken();
  const timezone = typeof Intl !== 'undefined' ? Intl.DateTimeFormat().resolvedOptions().timeZone : 'America/Sao_Paulo';
  return {
    Accept: 'application/json',
    'Accept-Language': getLang(),
    'x-timezone': timezone,
    ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function parseResponseBody<T>(res: Response): Promise<T | null> {
  const text = await res.text().catch(() => '');
  if (!text) return null;
  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function tryRefreshToken(): Promise<boolean> {
  if (!REFRESH_PATH) return false;
  const refreshToken = getRefreshToken();
  if (!refreshToken) return false;

  const refreshUrl = resolvePath(REFRESH_PATH);
  try {
    const response = await fetch(refreshUrl, {
      method: 'POST',
      headers: buildHeaders({ 'Content-Type': 'application/json' }, false),
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!response.ok) return false;

    const payload = (await parseResponseBody<{ access_token?: string }>(response)) ?? {};
    if (!payload.access_token) return false;
    localStorage.setItem('token', payload.access_token);
    const { setAuthTokenCookie } = await import('./auth-cookie');
    setAuthTokenCookie(payload.access_token);
    return true;
  } catch {
    return false;
  }
}

async function request(path: string, options: RequestOptions = {}): Promise<Response> {
  const { headers, auth = true, retry401 = true, _retried = false, ...init } = options;
  const url = resolvePath(path);
  
  // GETs usam cache HTTP do browser (melhora performance em navegações repetidas).
  // Mutations (POST, PUT, PATCH, DELETE) forçam no-cache para garantir dados frescos.
  const method = (init.method ?? 'GET').toUpperCase();
  const defaultCache = method === 'GET' ? 'default' : 'no-store';

  try {
    const response = await fetch(url, {
      cache: defaultCache,
      ...init,
      headers: buildHeaders(headers, auth),
    });

    if (response.status !== 401 || !auth || !retry401 || _retried) {
      return response;
    }

    const refreshed = await tryRefreshToken();
    if (refreshed) {
      return request(path, { ...options, _retried: true });
    }

    await sleep(800);
    const retryResponse = await request(path, { ...options, retry401: false, _retried: true });
    if (retryResponse.status === 401) {
      onUnauthorized?.();
    }
    return retryResponse;
  } catch (err) {
    console.error(`[API Client] Fetch failure at: ${url}`, err);
    throw err;
  }
}

async function assertOk<T>(path: string, response: Response): Promise<T> {
  const data = await parseResponseBody<T | { detail?: string }>(response);
  if (response.ok) {
    return (data as T | null) as T;
  }
  const detail =
    data && typeof data === 'object' && 'detail' in data && typeof data.detail === 'string'
      ? data.detail
      : `Request failed: ${response.status}`;
  throw new ApiClientError(detail, response.status, path, data as unknown);
}

async function toApiResult<T>(path: string, response: Response): Promise<ApiResult<T>> {
  const data = (await parseResponseBody<T | { detail: string }>(response)) as T;
  return {
    ok: response.ok,
    status: response.status,
    data: (data ?? ({ detail: 'Empty response body' } as T)) as T,
  };
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  const response = await request(path, { method: 'GET' });
  return assertOk<T>(path, response);
}

export async function apiPost<T = unknown>(path: string, body: JsonValue | FormData | unknown): Promise<ApiResult<T>> {
  const isFormData = body instanceof FormData;
  const response = await request(path, {
    method: 'POST',
    headers: isFormData ? undefined : { 'Content-Type': 'application/json' },
    body: isFormData ? body : JSON.stringify(body ?? {}),
  });
  return toApiResult<T>(path, response);
}

export async function apiPut<T = unknown>(path: string, body: JsonValue | unknown): Promise<ApiResult<T>> {
  const response = await request(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  return toApiResult<T>(path, response);
}

export async function apiPatch<T = unknown>(path: string, body: JsonValue | unknown): Promise<ApiResult<T>> {
  const response = await request(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body ?? {}),
  });
  return toApiResult<T>(path, response);
}

export async function apiDelete(path: string): Promise<ApiResult<null>> {
  const response = await request(path, { method: 'DELETE' });
  return {
    ok: response.ok,
    status: response.status,
    data: null,
  };
}

export async function apiUpload<T = unknown>(
  path: string,
  formData: FormData,
  method: Exclude<HttpMethod, 'GET'> = 'POST',
): Promise<ApiResult<T>> {
  const response = await request(path, { method, body: formData, headers: {} });
  return toApiResult<T>(path, response);
}

export async function apiPostForm<T = unknown>(
  path: string,
  formData: URLSearchParams,
): Promise<ApiResult<T>> {
  const response = await request(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: formData.toString(),
  });
  return toApiResult<T>(path, response);
}

// Compatibilidade: manter assinatura usada no código atual.
export async function apiGetCached<T = unknown>(path: string): Promise<T> {
  return apiGet<T>(path);
}

export function invalidateCache(): void {
  // Mantido para compatibilidade com código legado durante migração para TanStack Query.
}

export function invalidateAllCache(): void {
  // Mantido para compatibilidade com código legado durante migração para TanStack Query.
}
