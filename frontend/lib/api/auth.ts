import { apiPost, apiPostForm } from './client';
import { clearAuthTokenCookie, setAuthTokenCookie, syncAuthTokenCookieFromStorage } from './auth-cookie';
import type { AuthLoginResponse, User } from './types';

export async function loginWithCredentials(
  identifier: string,
  password: string,
): Promise<{ ok: boolean; status: number; data: AuthLoginResponse }> {
  const form = new URLSearchParams();
  form.append('username', identifier);
  form.append('password', password);
  return apiPostForm<AuthLoginResponse>('/auth/login', form);
}

export async function loginWithGoogle(
  credential: string,
): Promise<{ ok: boolean; status: number; data: AuthLoginResponse }> {
  return apiPost<AuthLoginResponse>('/auth/google', { credential });
}

export async function registerUser(payload: {
  name: string;
  email: string;
  username: string;
  password: string;
  level: string;
  is_hub_only?: boolean;
}): Promise<{ ok: boolean; status: number; data: User }> {
  return apiPost<User>('/auth/register', payload);
}

export async function requestPasswordReset(
  identifier: string,
): Promise<{ ok: boolean; status: number; data: { message?: string; detail?: string; dev_mode?: boolean; reset_token?: string } }> {
  const base_url = typeof window !== 'undefined' ? window.location.origin : '';
  const is_app = typeof window !== 'undefined' && !!(window as any).Capacitor?.isNativePlatform?.();
  return apiPost('/auth/forgot-password', { identifier, base_url, is_app });
}

export async function resetPasswordWithToken(
  token: string,
  newPassword: string,
): Promise<{ ok: boolean; status: number; data: { message?: string; detail?: string } }> {
  return apiPost('/auth/reset-password', { token, new_password: newPassword });
}

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
  const token = localStorage.getItem(TOKEN_KEY);
  const rawUser = localStorage.getItem(USER_KEY);
  if (!token || !rawUser) return null;
  try {
    const user = JSON.parse(rawUser) as User;
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    return { token, user, refreshToken };
  } catch {
    return null;
  }
}

export function saveStoredSession(session: StoredSession): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(TOKEN_KEY, session.token);
  localStorage.setItem(USER_KEY, JSON.stringify(session.user));
  if (session.refreshToken) {
    localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
  }
  setAuthTokenCookie(session.token);
}

export function clearStoredSession(): void {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(REFRESH_TOKEN_KEY);
  clearAuthTokenCookie();
}

export { syncAuthTokenCookieFromStorage };
