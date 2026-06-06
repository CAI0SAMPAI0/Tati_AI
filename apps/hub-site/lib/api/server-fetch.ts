import { cookies } from 'next/headers';
import { AUTH_TOKEN_COOKIE } from '@tati/hub-core';
import { resolveApiBase } from '@tati/hub-core';

function resolveServerApiBase(): string {
  if (process.env.INTERNAL_API_URL) {
    return process.env.INTERNAL_API_URL;
  }
  return resolveApiBase();
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
      Connection: 'close',
    };

    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    const res = await fetch(`${base}${path}`, {
      headers,
      cache: 'no-store',
    });

    if (!res.ok) return null;
    return (await res.json()) as T;
  } catch (error) {
    console.error(`[hub-site serverFetch] Failed for [${endpoint}]:`, error);
    return null;
  }
}
