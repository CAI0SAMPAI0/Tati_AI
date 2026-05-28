// Junta classes Tailwind condicionalmente (sem dependência de clsx)
export function cn(...classes: (string | undefined | null | false)[]): string {
  return classes.filter(Boolean).join(' ');
}

// Formata tempo de ISO string considerando timezone
export function formatTime(isoString?: string | null): string {
  let date: Date;
  if (isoString) {
    const iso =
      isoString.includes('Z') || isoString.includes('+')
        ? isoString
        : isoString + 'Z';
    date = new Date(iso);
  } else {
    date = new Date();
  }
  return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
}

export function formatDateTime(isoString?: string | null): string {
  let date: Date;
  if (isoString) {
    const iso =
      isoString.includes('Z') || isoString.includes('+')
        ? isoString
        : isoString + 'Z';
    date = new Date(iso);
  } else {
    return '—';
  }
  return date.toLocaleString('en-US', { 
    month: '2-digit',
    day: '2-digit', 
    year: 'numeric',
    hour: '2-digit', 
    minute: '2-digit' 
  });
}

export function formatDate(isoString?: string | null): string {
  let date: Date;
  if (isoString) {
    const iso =
      isoString.includes('Z') || isoString.includes('+')
        ? isoString
        : isoString + 'Z';
    date = new Date(iso);
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

export function parseAIResponse(content: string): { reply: string; correction?: string | null; drill?: string | null; report?: string | null } {
  if (!content || typeof content !== 'string') return { reply: content || '' };
  
  if (!content.trim().startsWith('{')) {
    return { reply: content };
  }

  try {
    const data = JSON.parse(content);
    if (data && typeof data === 'object' && ('reply' in data)) {
      return {
        reply: data.reply || '',
        correction: data.correction,
        drill: data.drill,
        report: data.report
      };
    }
  } catch (e) {
    // If JSON is incomplete (streaming), extract "reply"
    const match = content.match(/"reply"\s*:\s*"([^]*)/);
    if (match) {
       let partial = match[1];
       if (partial.includes('", "correction":')) {
           partial = partial.split('", "correction":')[0];
       } else if (partial.includes('", "drill":')) {
           partial = partial.split('", "drill":')[0];
       } else {
           // Basic cleanup for end of stream
           partial = partial.replace(/(?<!\\)"\s*}?\s*$/, '');
           partial = partial.replace(/(?<!\\)",\s*$/, '');
       }
       return { reply: partial.replace(/\\"/g, '"').replace(/\\n/g, '\n') };
    }
  }

  return { reply: content };
}
