import { cookies } from 'next/headers';
import { AUTH_TOKEN_COOKIE } from './auth-cookie';

function resolveServerApiBase(): string {
  if (process.env.INTERNAL_API_URL) {
    return process.env.INTERNAL_API_URL;
  }
  return process.env.NEXT_PUBLIC_API_BASE_URL || '';
}

export async function getServerAuthToken(): Promise<string | null> {
  const cookieStore = cookies();
  return cookieStore.get(AUTH_TOKEN_COOKIE)?.value ?? null;
}

export async function serverFetch<T>(endpoint: string, auth = true): Promise<T | null> {
  try {
    const base = resolveServerApiBase();
    const path = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    const token = auth ? await getServerAuthToken() : null;

    const headers: Record<string, string> = {
      Accept: 'application/json',
      'Content-Type': 'application/json',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(`${base}${path}`, {
      headers,
      cache: 'no-store',
      signal: controller.signal,
    });
    
    clearTimeout(timeoutId);

    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (error) {
    console.error(`[serverFetch] Failed for [${endpoint}]:`, error);
    return null;
  }
}
