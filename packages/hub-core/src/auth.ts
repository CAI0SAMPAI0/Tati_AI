import { apiGet, apiPost } from './client';
import { HUB_ENDPOINTS } from './endpoints';
import type {
  AuthLoginResponse,
  RegisterPayload,
  RegisterResponse,
  User,
} from './types';

export async function loginWithCredentials(
  identifier: string,
  password: string,
): Promise<{ ok: boolean; status: number; data: AuthLoginResponse }> {
  const form = new URLSearchParams();
  form.append('username', identifier);
  form.append('password', password);
  return apiPost<AuthLoginResponse>(HUB_ENDPOINTS.AUTH_LOGIN, form, { auth: false });
}

export async function loginWithGoogle(
  credential: string,
  isHubOnly: boolean = false,
): Promise<{ ok: boolean; status: number; data: AuthLoginResponse }> {
  return apiPost<AuthLoginResponse>(
    HUB_ENDPOINTS.AUTH_GOOGLE,
    { credential, is_hub_only: isHubOnly },
    { auth: false },
  );
}

export async function registerUser(
  payload: RegisterPayload,
): Promise<{ ok: boolean; status: number; data: RegisterResponse }> {
  return apiPost<RegisterResponse>(HUB_ENDPOINTS.AUTH_REGISTER, payload, { auth: false });
}

export async function fetchProfile(): Promise<User> {
  return apiGet<User>(HUB_ENDPOINTS.PROFILE);
}
