export const AUTH_TOKEN_COOKIE = 'auth_token';

const COOKIE_MAX_AGE_SECONDS = 7 * 24 * 60 * 60;

export function setAuthTokenCookie(token: string): void {
  if (typeof document === 'undefined') return;
  const encoded = encodeURIComponent(token);
  document.cookie = `${AUTH_TOKEN_COOKIE}=${encoded}; path=/; max-age=${COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
}

export function clearAuthTokenCookie(): void {
  if (typeof document === 'undefined') return;
  document.cookie = `${AUTH_TOKEN_COOKIE}=; path=/; max-age=0; SameSite=Lax`;
}

export function syncAuthTokenCookieFromStorage(): void {
  if (typeof window === 'undefined') return;
  const token = localStorage.getItem('token');
  if (token) {
    setAuthTokenCookie(token);
  } else {
    clearAuthTokenCookie();
  }
}
