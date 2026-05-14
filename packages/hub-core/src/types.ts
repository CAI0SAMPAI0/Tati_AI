export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  role: string;
  level: string;
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
  level: string;
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
  emoji?: string | null;
  is_active?: boolean;
  has_access: boolean;
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
