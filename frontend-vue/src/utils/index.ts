import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs));
}

function parseDisplayDate(value?: string | null): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === '—' || trimmed === 'None') return null;

  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  if (/^(\d{1,2})\/(\d{1,2})\/(\d{4})/.test(trimmed)) {
    const d = new Date(trimmed);
    if (!Number.isNaN(d.getTime())) return d;
  }

  const normalized = trimmed
    .replace(' ', 'T')
    .replace(/([+-]\d{2})(\d{2})$/, '$1:$2');
  const date = new Date(normalized.includes('Z') || /[+-]\d{2}:?\d{2}$/.test(normalized) ? normalized : `${normalized}Z`);
  if (!Number.isNaN(date.getTime())) return date;

  const fallbackDate = new Date(trimmed);
  return Number.isNaN(fallbackDate.getTime()) ? null : fallbackDate;
}

export function formatTime(isoString?: string | null): string {
  if (!isoString || isoString === '—' || isoString === 'None') return '—';
  const date = parseDisplayDate(isoString);
  if (!date) return isoString;
  return date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(isoString?: string | null): string {
  if (!isoString || isoString === '—' || isoString === 'None') return '—';
  const parsedDate = parseDisplayDate(isoString);
  if (!parsedDate) return isoString;
  return parsedDate.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function isUserActiveNow(isoString?: string | null, referenceTime: number = Date.now()): boolean {
  if (!isoString || isoString === '—' || isoString === '-' || isoString === 'None' || isoString === '') {
    return false;
  }
  const date = parseDisplayDate(isoString);
  if (!date) return false;
  const diffMs = referenceTime - date.getTime();
  return diffMs >= -300000 && diffMs <= 5 * 60 * 1000;
}

export function formatLastActive(isoString?: string | null, referenceTime: number = Date.now()): string {
  if (!isoString || isoString === '—' || isoString === '-' || isoString === 'None' || isoString === '') {
    return '—';
  }
  if (isUserActiveNow(isoString, referenceTime)) {
    return 'Using now';
  }
  const date = parseDisplayDate(isoString);
  if (!date) return isoString;
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatDate(isoString?: string | null): string {
  if (!isoString) return '—';
  const parsedDate = parseDisplayDate(isoString);
  if (!parsedDate) return '—';
  return parsedDate.toLocaleDateString('en-US', {
    month: '2-digit',
    day: '2-digit',
    year: 'numeric',
  });
}

const STAFF_ROLES = new Set([
  'professor',
  'professora',
  'programador',
  'programmer',
  'teacher',
  'tatiana',
  'tati',
  'tatys_english_class',
  'admin',
]);

export function isStaff(user: { role?: string; username?: string } | null | undefined): boolean {
  if (!user) return false;
  const role = (user.role || '').toLowerCase();
  const username = (user.username || '').toLowerCase();
  return STAFF_ROLES.has(role) || STAFF_ROLES.has(username);
}

export function canAccessExams(user: { role?: string; username?: string } | null | undefined): boolean {
  if (!user) return false;
  return isStaff(user);
}

export function canAccessDashboard(
  user: { role?: string; username?: string } | null | undefined,
  access: { can_access_dashboard?: boolean } | null = null,
): boolean {
  if (user?.username === 'caio.sampaio') return false;
  if (access && Object.prototype.hasOwnProperty.call(access, 'can_access_dashboard')) {
    return Boolean(access.can_access_dashboard);
  }
  return isStaff(user);
}

export interface AttachedDocMeta {
  id: string;
  filename: string;
  format: string;
  url: string;
  preview_url?: string;
  size?: string;
  title?: string;
  pdf_b64?: string;
}

export function parseAIResponse(content: string): {
  reply: string;
  correction?: string | null;
  drill?: string | null;
  report?: string | null;
  document?: AttachedDocMeta | null;
} {
  if (!content || typeof content !== 'string') return { reply: content || '', document: null };

  let raw = content.trim();
  let extractedDoc: AttachedDocMeta | null = null;

  const docMatch = raw.match(/\[ATTACHED_DOCUMENT:([\s\S]*?)\]/);
  if (docMatch) {
    try {
      extractedDoc = JSON.parse(docMatch[1]);
    } catch {
      // ignore
    }
  }
  raw = raw.replace(/\[ATTACHED_DOCUMENT:[\s\S]*?\]/g, '').trim();

  if (raw.startsWith('```')) {
    raw = raw.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
  }

  const jsonMatch = raw.match(/\{[\s\S]*"reply"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[0]);
      if (data && typeof data === 'object' && 'reply' in data) {
        return {
          reply: data.reply || '',
          correction: data.correction || null,
          drill: data.drill || null,
          report: data.report || null,
          document: extractedDoc,
        };
      }
    } catch {
      // fallback
    }
  }

  return {
    reply: raw,
    correction: null,
    drill: null,
    report: null,
    document: extractedDoc,
  };
}

