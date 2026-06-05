/**
 * hub-core — cópia local para build na Vercel.
 * Substitui o pacote de workspace @tati/hub-core que não é acessível
 * quando a Vercel faz build apenas da pasta `frontend`.
 *
 * Para manter sincronizado, edite este arquivo sempre que
 * packages/hub-core/src/ for alterado.
 */

// ─── types ────────────────────────────────────────────────────────────────────

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  role: string;
  level: CEFRLevel | string;
  plan_type: string | null;
  avatar_url?: string | null;
  cpf?: string | null;
  cpf_cnpj?: string | null;
  xp?: number;
  streak?: number;
  nickname?: string;
  occupation?: string;
  focus?: string;
}

export interface AuthLoginResponse {
  access_token: string;
  user: User;
}

export interface RegisterPayload {
  name: string;
  email: string;
  username: string;
  password: string;
  level: CEFRLevel | string;
  is_hub_only?: boolean;
}

export interface RegisterResponse {
  ok: boolean;
  message: string;
}

export interface ApiResult<T> {
  ok: boolean;
  status: number;
  data: T;
}

export interface PremiumCatalogItem {
  id: string;
  title: string;
  description?: string | null;
  price: number;
  type: string;
  content_source?: string | null;
  thumbnail_url?: string | null;
  preview_url?: string | null;
  emoji?: string | null;
  category?: string | null;
  is_featured?: boolean | null;
  processing_status?: string | null;
  is_active?: boolean;
  has_access: boolean;
}

export interface SecureViewerAccess {
  type: 'secure_images' | 'direct';
  pages?: string[];
  total_pages?: number;
  is_secure_viewer?: boolean;
  title?: string | null;
  url?: string;
  external_links?: {
    uri: string;
    page: number;
    left: number;
    top: number;
    width: number;
    height: number;
  }[];
}

export interface PremiumCheckoutResponse {
  paymentId: string;
  invoiceUrl: string;
  pixQrCode?: string | null;
  pixCopyPaste?: string | null;
  value: number;
  title: string;
}

export interface GuestCheckoutResponse extends PremiumCheckoutResponse {
  username: string;
}

export interface GuestCheckoutPayload {
  content_id: string;
  billingType: string;
  name: string;
  email: string;
  cpf: string;
}

export interface AuthenticatedCheckoutPayload {
  content_id: string;
  billingType: string;
  cpf?: string;
}

export interface HubPaymentStatusResponse {
  paymentId: string;
  status: string;
  billingType?: string | null;
  invoiceUrl?: string | null;
  pixQrCode?: string | null;
  pixCopyPaste?: string | null;
  raw?: Record<string, unknown> | null;
}

export interface HubOrderItem {
  content_id: string;
  title: string;
  price: number;
}

export interface HubOrder {
  id: string;
  status: string;
  total_amount: number;
  payment_method?: string | null;
  created_at?: string | null;
  items: HubOrderItem[];
}

export interface StoredSession {
  token: string;
  user: User;
  refreshToken?: string | null;
}

// ─── levels ───────────────────────────────────────────────────────────────────

export const CEFR_LEVELS: CEFRLevel[] = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

export const LEVEL_OPTIONS: { value: CEFRLevel; label: string }[] = [
  { value: 'A1', label: 'A1 – Beginner' },
  { value: 'A2', label: 'A2 – Pre-Intermediate' },
  { value: 'B1', label: 'B1 – Intermediate' },
  { value: 'B2', label: 'B2 – Upper-Intermediate' },
  { value: 'C1', label: 'C1 – Advanced' },
  { value: 'C2', label: 'C2 – Mastery / Proficiency' },
];

export const LEVEL_FILTER_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: 'All Levels' },
  ...LEVEL_OPTIONS,
];

export const CEFR_LABEL_MAP: Record<CEFRLevel, string> = {
  A1: 'A1 – Beginner',
  A2: 'A2 – Pre-Intermediate',
  B1: 'B1 – Intermediate',
  B2: 'B2 – Upper-Intermediate',
  C1: 'C1 – Advanced',
  C2: 'C2 – Mastery / Proficiency',
};

const LEVEL_ALIAS_MAP: Record<string, CEFRLevel> = {
  a1: 'A1', beginner: 'A1', iniciante: 'A1',
  a2: 'A2', 'pre-intermediate': 'A2', 'pre intermediate': 'A2',
  b1: 'B1', intermediate: 'B1', intermediario: 'B1',
  b2: 'B2', 'upper-intermediate': 'B2', 'upper intermediate': 'B2',
  c1: 'C1', advanced: 'C1', avancado: 'C1',
  'business english': 'C1', business: 'C1',
  c2: 'C2', mastery: 'C2', proficiency: 'C2',
};

export function normalizeLevel(raw: string | null | undefined): CEFRLevel {
  if (!raw) return 'A1';
  const lower = raw.trim().toLowerCase();
  const mapped = LEVEL_ALIAS_MAP[lower];
  if (mapped) return mapped;
  const upper = raw.trim().toUpperCase() as CEFRLevel;
  return CEFR_LEVELS.includes(upper) ? upper : 'A1';
}

export function levelLabel(raw: string | null | undefined): string {
  const code = normalizeLevel(raw);
  return CEFR_LABEL_MAP[code] ?? code;
}

// ─── endpoints ────────────────────────────────────────────────────────────────

export const HUB_ENDPOINTS = {
  AUTH_LOGIN: '/auth/login',
  AUTH_REGISTER: '/auth/register',
  AUTH_GOOGLE: '/auth/google',
  PROFILE: '/profile',
  HUB_PAYMENT_STATUS: (paymentId: string) => `/activities/hub/payment-status/${paymentId}`,
  HUB_PUBLIC: '/activities/hub/public',
  HUB_ACCESS: (contentId: string) => `/activities/hub/${contentId}/access`,
  HUB_CHECKOUT: '/activities/hub/checkout',
  HUB_CHECKOUT_GUEST: '/activities/hub/checkout/guest',
  HUB_DOWNLOAD: (contentId: string) => `/hub/${contentId}/download`,
  CATALOG_ORDERS: '/catalog/orders',
} as const;

// ─── session ──────────────────────────────────────────────────────────────────

const TOKEN_KEY = 'token';
const USER_KEY = 'user';
const REFRESH_TOKEN_KEY = 'refresh_token';

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
}

export function clearStoredSession(): void {
  if (typeof window === 'undefined') return;
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
  window.localStorage.removeItem(REFRESH_TOKEN_KEY);
}

export function getAccessToken(): string | null {
  return getStoredSession()?.token ?? null;
}

// ─── client ───────────────────────────────────────────────────────────────────

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
const DEFAULT_REMOTE_API_BASE = 'https://tatiai-production.up.railway.app';

export function resolveApiBase(): string {
  return (
    process.env.NEXT_PUBLIC_API_URL ??
    process.env.NEXT_PUBLIC_API_BASE_URL ??
    (process.env.NODE_ENV === 'development' ? DEFAULT_LOCAL_API_BASE : DEFAULT_REMOTE_API_BASE)
  );
}

function resolvePath(path: string): string {
  if (/^https?:\/\//i.test(path)) return path;
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
  if (response.ok) return data as T;
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
  return { ok: response.ok, status: response.status, data: data as T };
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

// ─── auth ─────────────────────────────────────────────────────────────────────

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

// ─── catalog ──────────────────────────────────────────────────────────────────

export async function fetchMyOrders(): Promise<HubOrder[]> {
  return apiGet<HubOrder[]>(HUB_ENDPOINTS.CATALOG_ORDERS);
}

export async function fetchSecureAccess(contentId: string): Promise<SecureViewerAccess> {
  return apiGet<SecureViewerAccess>(HUB_ENDPOINTS.HUB_ACCESS(contentId));
}