import type { ApiResult } from './types';
import { getAccessToken } from './session';

type JsonPrimitive = string | number | boolean | null;
type JsonValue = JsonPrimitive | JsonValue[] | { [key: string]: JsonValue };

interface RequestOptions extends Omit<RequestInit, 'headers'> {
  headers?: Record<string, string>;
  auth?: boolean;
}

export class ApiClientError<T = unknown> extends Error {
  readonly status: number;
  readonly path: string;
  readonly data: T | null;

  constructor(message: string, status: number, path: string, data: T | null = null) {
    super(message);
    this.name = 'ApiClientError';
    this.status = status;
    this.path = path;
    this.data = data;
  }
}

const DEFAULT_LOCAL_API_BASE = 'http://localhost:8001';

export function resolveApiBase(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    (process.env.NODE_ENV === 'development' ? DEFAULT_LOCAL_API_BASE : '')
  );
}

function resolvePath(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;

  // Materiais (Upload/Leitura/Processamento) e Pagamentos devem passar pelo Railway
  const isRailwayOperation = 
    path.includes('/admin/premium') || 
    path.includes('/activities/premium') || 
    path.includes('/activities/hub') ||
    path.includes('/payments');
    
  if (isRailwayOperation) {
    const railwayBase = 'https://tatiai-production.up.railway.app';
    return `${railwayBase}${path.startsWith('/') ? path : `/${path}`}`;
  }

  const base = resolveApiBase();
  return `${base}${path.startsWith('/') ? path : `/${path}`}`;
}

function buildHeaders(extra: Record<string, string> = {}, auth = true): Record<string, string> {
  const token = getAccessToken();
  return {
    Accept: 'application/json',
    ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
    ...extra,
  };
}

async function parseResponseBody<T>(response: Response): Promise<T | null> {
  const text = await response.text().catch(() => '');
  if (!text) return null;

  try {
    return JSON.parse(text) as T;
  } catch {
    return null;
  }
}

async function request(path: string, options: RequestOptions = {}): Promise<Response> {
  const { headers, auth = true, ...init } = options;
  return fetch(resolvePath(path), {
    cache: 'no-store',
    ...init,
    headers: buildHeaders(headers, auth),
  });
}

async function assertOk<T>(path: string, response: Response): Promise<T> {
  const data = await parseResponseBody<T | { detail?: string }>(response);
  if (response.ok) {
    return data as T;
  }

  const detail =
    data && typeof data === 'object' && 'detail' in data && typeof data.detail === 'string'
      ? data.detail
      : `Request failed: ${response.status}`;

  throw new ApiClientError(detail, response.status, path, data as unknown);
}

async function toApiResult<T>(path: string, response: Response): Promise<ApiResult<T>> {
  const data = await parseResponseBody<T | { detail?: string }>(response);
  if (!response.ok) {
    const detail =
      data && typeof data === 'object' && 'detail' in data && typeof data.detail === 'string'
        ? data.detail
        : `Request failed: ${response.status}`;

    throw new ApiClientError(detail, response.status, path, data as unknown);
  }

  return {
    ok: response.ok,
    status: response.status,
    data: data as T,
  };
}

export async function apiGet<T>(
  path: string,
  options?: Omit<RequestOptions, 'method'>,
): Promise<T> {
  const response = await request(path, { ...options, method: 'GET' });
  return assertOk<T>(path, response);
}

export async function apiPost<T>(
  path: string,
  body: JsonValue | FormData | URLSearchParams | unknown,
  options?: Omit<RequestOptions, 'method' | 'body'>,
): Promise<ApiResult<T>> {
  const isFormData = body instanceof FormData;
  const isSearchParams = body instanceof URLSearchParams;
  const headers = isFormData
    ? undefined
    : isSearchParams
      ? { 'Content-Type': 'application/x-www-form-urlencoded' }
      : { 'Content-Type': 'application/json' };

  const response = await request(path, {
    ...options,
    method: 'POST',
    headers,
    body: isFormData ? body : isSearchParams ? body.toString() : JSON.stringify(body ?? {}),
  });

  return toApiResult<T>(path, response);
}
