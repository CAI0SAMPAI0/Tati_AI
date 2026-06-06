import { clearAuthTokenCookie, setAuthTokenCookie } from './auth-cookie';
import type { User } from './types';

const TOKEN_KEY = 'token';
const USER_KEY = 'user';
const REFRESH_TOKEN_KEY = 'refresh_token';

export interface StoredSession {
  token: string;
  user: User;
  refreshToken?: string | null;
}

export function getStoredSession(): StoredSession | null {
  if (typeof window === 'undefined') return null;

  const token = window.localStorage.getItem(TOKEN_KEY);
  const rawUser = window.localStorage.getItem(USER_KEY);
  if (!token || !rawUser) return null;

  try {
    const user = JSON.parse(rawUser) as User;
    const refreshToken = window.localStorage.getItem(REFRESH_TOKEN_KEY);
    return { token, user, refreshToken };
  } catch {
    return null;
  }
}

export function saveStoredSession(session: StoredSession): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(TOKEN_KEY, session.token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  if (session.refreshToken) {
    window.localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
  }
  setAuthTokenCookie(session.token);
}

export function clearStoredSession(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
  clearAuthTokenCookie();
}

export function getAccessToken(): string | null {
  return getStoredSession()?.token ?? null;
}
