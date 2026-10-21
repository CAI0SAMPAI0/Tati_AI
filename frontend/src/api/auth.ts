import { apiPost, apiPostForm } from './client';
import type { AuthLoginResponse, User } from './types';

export async function loginWithCredentials(
  identifier: string,
  password: string
): Promise<AuthLoginResponse> {
  const form = new URLSearchParams();
  form.append('username', identifier);
  form.append('password', password);
  return apiPostForm<AuthLoginResponse>('/auth/login', form);
}

export async function loginWithGoogle(
  credential: string
): Promise<AuthLoginResponse> {
  return apiPost<AuthLoginResponse>('/auth/google', { credential });
}

export async function registerUser(payload: {
  name: string;
  email: string;
  username: string;
  password: string;
  level: string;
  is_hub_only?: boolean;
  accepted_terms?: boolean;
  parental_consent?: boolean;
}): Promise<User> {
  return apiPost<User>('/auth/register', payload);
}

export async function requestPasswordReset(
  identifier: string
): Promise<{ message?: string; detail?: string; reset_token?: string }> {
  const base_url = typeof window !== 'undefined' ? window.location.origin : '';
  return apiPost('/auth/forgot-password', { identifier, base_url });
}

export async function resetPasswordWithToken(
  token: string,
  newPassword: string
): Promise<{ message?: string; detail?: string }> {
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
  try {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return null;
    const rawUser = localStorage.getItem(USER_KEY);
    let user: User;
    try {
      user = rawUser ? (JSON.parse(rawUser) as User) : ({ username: 'student' } as User);
    } catch {
      user = { username: 'student' } as User;
    }
    const refreshToken = localStorage.getItem(REFRESH_TOKEN_KEY);
    return { token, user, refreshToken };
  } catch {
    return null;
  }
}

export function saveStoredSession(session: StoredSession): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(TOKEN_KEY, session.token);
    localStorage.setItem(USER_KEY, JSON.stringify(session.user));
    if (session.refreshToken) {
      localStorage.setItem(REFRESH_TOKEN_KEY, session.refreshToken);
    }
    // set cookie for SSR / interoperability
    document.cookie = `auth_token=${session.token}; path=/; max-age=2592000; SameSite=Lax`;
  } catch {}
}

export function clearStoredSession(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(REFRESH_TOKEN_KEY);
    localStorage.removeItem('tati_last_route');
    document.cookie = 'auth_token=; path=/; max-age=0; SameSite=Lax';
  } catch {}
}

