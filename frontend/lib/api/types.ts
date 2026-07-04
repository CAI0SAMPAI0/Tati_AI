import { CEFRLevel } from '../constants/levels';

export interface User {
  id: string;
  username: string;
  email: string;
  name: string;
  role: string;
  level: CEFRLevel;
  plan_type: string | null;
  avatar_url?: string | null;
  cpf?: string | null;
  cpf_cnpj?: string | null;
  xp?: number;
  streak?: number;
  nickname?: string;
  occupation?: string;
  focus?: string;
  /**
   * Optional nested profile information returned by the backend.
   * Currently used for `responsible_email` in the profile page.
   */
  profile?: {
    responsible_email?: string;
    whatsapp_number?: string;
    allow_whatsapp_notifications?: boolean;
    whatsapp_onboarded?: boolean;
  };
}

export interface AuthLoginResponse {
  access_token: string;
  user: User;
}

export interface Conversation {
  id: string;
  title: string;
  created_at: string;
  updated_at: string;
  message_count?: number;
}

export interface Message {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  created_at: string;
  audio_url?: string | null;
  audio_b64?: string | null;
  pdf_b64?: string | null;
  pdf_filename?: string | null;
}

export interface AccessControl {
  full_access: boolean;
  free_mode: boolean;
  can_access_activities: boolean;
  can_access_dashboard: boolean;
  free_messages_remaining: number | null;
  plan_type: string | null;
}

export interface UserProfile {
  id: string;
  username: string;
  email: string;
  name: string;
  role: string;
  level: CEFRLevel;
  plan_type: string | null;
  avatar_url?: string | null;
  bio?: string;
  xp?: number;
  streak?: number;
  total_messages?: number;
  nickname?: string;
  occupation?: string;
  focus?: string;
}

export interface Goal {
  id: string;
  user_id: string;
  text: string;
  completed: boolean;
  created_at: string;
}

export interface Notification {
  id: string;
  category: string;
  title: string;
  body: string;
  is_read: boolean;
  created_at: string;
  url?: string;
}

export interface PaymentStatus {
  status: 'active' | 'pending' | 'cancelled' | 'none';
  plan_type: string | null;
  expires_at?: string | null;
}

export interface ApiResponse<T = unknown> {
  ok: boolean;
  status: number;
  data: T;
}

export interface ApiError {
  detail: string;
}
