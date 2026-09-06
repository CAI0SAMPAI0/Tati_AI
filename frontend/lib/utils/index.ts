// Junta classes Tailwind condicionalmente (sem dependência de clsx)
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

function parseDisplayDate(value: string): Date | null {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed || trimmed === '—' || trimmed === 'None') return null;

  // Formato puro YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
    const [year, month, day] = trimmed.split('-').map(Number);
    return new Date(year, month - 1, day);
  }

  // Formatos com barra DD/MM/YYYY ou MM/DD/YYYY
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

// Formata tempo de ISO string considerando timezone do navegador
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
    minute: '2-digit' 
  });
}

export function formatDate(isoString?: string | null): string {
  let date: Date;
  if (isoString) {
    if (/^\d{4}-\d{2}-\d{2}$/.test(isoString.trim())) {
      date = parseDisplayDate(isoString)!;
      return date.toLocaleDateString('en-US', {
        month: '2-digit',
        day: '2-digit',
        year: 'numeric',
      });
    }
    const parsedDate = parseDisplayDate(isoString);
    if (!parsedDate) return '—';
    date = parsedDate;
  } else {
    return '—';
  }
  return date.toLocaleDateString('en-US', { 
    month: '2-digit',
    day: '2-digit', 
    year: 'numeric'
  });
}

// Escapa HTML para uso em strings (equivalente ao escHtml legado)
export function escHtml(str: string): string {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Sleep helper
export function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

// Funções de permissão (equivalentes ao legado)
const STAFF_ROLES = new Set([
  'professor',
  'professora',
  'programador',
  'Tatiana',
  'Tati',
  'admin',
  'Admin',
  'Programador',
  'Professora',
]);

export function isStaff(user: { role?: string; username?: string } | null): boolean {
  if (!user) return false;
  const role = user.role ?? '';
  const username = user.username ?? '';
  return STAFF_ROLES.has(role) || STAFF_ROLES.has(username) || STAFF_ROLES.has(role.toLowerCase());
}

export function canAccessDashboard(
  user: { role?: string; username?: string } | null,
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
  format: 'pdf' | 'docx' | 'pptx' | 'doc' | 'ppt' | string;
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

  // Extrai anexo permanente de documento gerado [ATTACHED_DOCUMENT:{...}]
  const docMatch = raw.match(/\[ATTACHED_DOCUMENT:([\s\S]*?)\]/);
  if (docMatch) {
    try {
      extractedDoc = JSON.parse(docMatch[1]);
    } catch (e) {
      // Ignora erro de JSON e mantém texto
    }
  }
  // Garante a remoção global de todas as ocorrências de [ATTACHED_DOCUMENT:...] do texto exibido
  raw = raw.replace(/\[ATTACHED_DOCUMENT:[\s\S]*?\]/g, '').trim();

  // 1. Remove markdown code blocks if wrapped
  if (raw.startsWith('```')) {
    raw = raw.replace(/^```[\w]*\n?/, '').replace(/\n?```$/, '').trim();
  }

  // 2. Try parsing complete JSON object anywhere in raw
  const jsonMatch = raw.match(/\{[\s\S]*"reply"[\s\S]*\}/);
  if (jsonMatch) {
    try {
      const data = JSON.parse(jsonMatch[0]);
      if (data && typeof data === 'object' && ('reply' in data)) {
        const preText = raw.slice(0, raw.indexOf(jsonMatch[0])).trim();
        const postText = raw.slice(raw.indexOf(jsonMatch[0]) + jsonMatch[0].length).trim();
        
        let replyText = data.reply || '';
        if (preText) {
          if (preText.includes(replyText)) {
            replyText = preText;
          } else if (!replyText.includes(preText)) {
            replyText = `${preText}\n\n${replyText}`;
          }
        }
        if (postText) {
          replyText = `${replyText}\n\n${postText}`.trim();
        }

        return {
          reply: replyText,
          correction: data.correction || null,
          drill: data.drill || null,
          report: data.report || null,
          document: extractedDoc,
        };
      }
    } catch (e) {
      // Ignore JSON parse error, fall through to regex extraction
    }
  }

  // 3. Handle streaming or incomplete JSON with "reply" key
  const replyMatch = raw.match(/"reply"\s*:\s*"([^]*)/);
  if (replyMatch) {
    let partial = replyMatch[1];
    if (partial.includes('", "correction":')) {
      partial = partial.split('", "correction":')[0];
    } else if (partial.includes('", "drill":')) {
      partial = partial.split('", "drill":')[0];
    } else if (partial.includes('", "report":')) {
      partial = partial.split('", "report":')[0];
    } else {
      partial = partial.replace(/(?<!\\)"\s*}?\s*$/, '');
      partial = partial.replace(/(?<!\\)",\s*$/, '');
    }

    const cleanPartial = partial.replace(/\\"/g, '"').replace(/\\n/g, '\n');
    const preText = raw.split(/\{?\s*"reply"\s*:/)[0].replace(/^```[\w]*\n?/, '').trim();
    
    let finalReply = cleanPartial;
    if (preText && !preText.startsWith('{')) {
      if (preText.includes(cleanPartial)) {
        finalReply = preText;
      } else if (!cleanPartial.includes(preText)) {
        finalReply = `${preText}\n\n${cleanPartial}`;
      }
    }

    return { reply: finalReply, document: extractedDoc };
  }

  // 4. Fallback: If text contains raw JSON leak like { "reply": ... }, strip trailing JSON
  const cleaned = raw.replace(/\{?\s*"(reply|correction|drill|report)"\s*:[\s\S]*$/i, '').trim();
  return { reply: cleaned || raw, document: extractedDoc };
}
