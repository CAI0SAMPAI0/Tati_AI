/**
 * hub-core — cópia local para build na Vercel.
 * Exporta APENAS o que não existe em frontend/lib/api/
 */

// ─── levels ───────────────────────────────────────────────────────────────────

export type CEFRLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

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

// ─── tipos extras do hub (não existem em frontend/lib/api/types.ts) ──────────

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