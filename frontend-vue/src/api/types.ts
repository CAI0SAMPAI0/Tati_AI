import type { CEFRLevel } from '../constants/levels';

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
  preferred_accent?: string;
  accent?: string;
  phone?: string | null;
  is_hub_only?: boolean;
  profile?: {
    responsible_email?: string;
    whatsapp_number?: string;
    allow_whatsapp_notifications?: boolean;
    whatsapp_onboarded?: boolean;
    preferred_accent?: string;
    accent?: string;
    autoplay_chat_audio?: boolean;
    notification_preferences?: {
      streaks?: { email: boolean; push: boolean };
      challenges?: { email: boolean; push: boolean };
      cefr?: { email: boolean; push: boolean };
      [key: string]: any;
    };
    occupation?: string;
    focus?: string;
    [key: string]: any;
  };
}

export interface AuthLoginResponse {
  access_token: string;
  token_type?: string;
  refresh_token?: string;
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
  document_url?: string | null;
  document_filename?: string | null;
  document_format?: 'pdf' | 'docx' | 'pptx' | 'doc' | 'ppt' | string | null;
  document_size?: string | null;
  preview_url?: string | null;
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
}

// EXAM TYPES
export interface ExamStatus {
  can_start: boolean;
  status: 'available' | 'locked' | 'in_progress' | 'ready' | 'forbidden' | string;
  days_remaining: number;
  next_available_date?: string | null;
  last_exam_date?: string | null;
  active_exam_id?: string | null;
  current_level: string;
  last_exam_evolution?: {
    score: number;
    level: string;
    total_questions: number;
    completed_at?: string;
    summary?: string;
    can_do_statements?: string[];
    skills_breakdown?: Record<string, { label: string; correct: number; total: number; percentage: number }>;
    points_to_improve?: string[];
  };
}

export interface Question {
  id: string;
  type: string;
  question: string;
  points: number;
  options: string[];
  audio_url?: string | null;
  audio_text?: string | null;
  reading_text?: string | null;
  min_seconds?: number | null;
  max_seconds?: number | null;
  min_words?: number | null;
  max_words?: number | null;
}

export interface ExamActive {
  exam_id: string;
  level: string;
  total_questions: number;
  started_at: string;
  expires_at?: string;
  questions: Question[];
}

export interface ExamHistoryItem {
  id: string;
  level: string;
  score: number;
  completed_at: string;
  status: string;
  summary?: string;
}
