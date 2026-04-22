/* o api.js é para ter o cliente centralizado para todas as chamadas à API backendd e eliminei fetch() duplicado espalhado que fiz em outros arquivos JS.
 */

const IS_LOCAL = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const API_BASE = IS_LOCAL ? 'http://localhost:8000' : 'https://tatiai-production.up.railway.app';
const WS_BASE = IS_LOCAL ? 'ws://localhost:8000' : 'wss://tatiai-production.up.railway.app';

/** Retorna o token JWT salvo no localStorage, ou null. */
function getToken() {
  return localStorage.getItem('token');
}

/** Retorna os headers de autenticação padrão. */
function authHeaders(extra = {}) {
  return { 'Authorization': `Bearer ${getToken()}`, ...extra };
}

/**
 * Wrapper sobre fetch com autenticação.
 * @param {string} path    - Caminho da rota (ex: '/chat/conversations')
 * @param {object} options - Opções do fetch (method, body, headers, ...)
 */
async function apiFetch(path, options = {}) {
  const url = API_BASE + path;
  const headers = { ...authHeaders(), ...(options.headers || {}) };

  let res;
  try {
    res = await fetch(url, { ...options, headers });
  } catch (networkErr) {
    // Erro de rede (Railway dormindo, etc) — não desloga
    throw networkErr;
  }

  if (res.status === 401) {
    // Tenta 1x com delay antes de deslogar (Railway cold start pode causar 401 falso)
    await sleep(1200);
    const headers2 = { ...authHeaders(), ...(options.headers || {}) };
    const res2 = await fetch(url, { ...options, headers: headers2 }).catch(() => null);
    if (!res2 || res2.status === 401) {
      authLogout();
      throw new Error('Sessão expirada');
    }
    return res2;
  }
  return res;
}

/** Faz GET e retorna JSON. */
async function apiGet(path) {
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json();
}

const apiCache = {};
const CACHE_TTL = 30000; // 30 segundos de cache

/** Faz GET com cache e retorna JSON. */
async function apiGetCached(path) {
    const now = Date.now();
    if (apiCache[path] && (now - apiCache[path].timestamp < CACHE_TTL)) {
        return apiCache[path].data;
    }
    const data = await apiGet(path);
    apiCache[path] = { data, timestamp: now };
    return data;
}

/** Faz POST com JSON body e retorna JSON. */
async function apiPost(path, body) {
  const res = await apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data = {};
  try { data = await res.json(); } catch (e) { data = { detail: 'Erro no servidor (não JSON)' }; }
  return { ok: res.ok, status: res.status, data };
}

/** Faz PUT com JSON body e retorna JSON. */
async function apiPut(path, body) {
  const res = await apiFetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data = {};
  try { data = await res.json(); } catch (e) { data = { detail: 'Erro no servidor (não JSON)' }; }
  return { ok: res.ok, status: res.status, data };
}

/** Faz PATCH com JSON body e retorna JSON. */
async function apiPatch(path, body) {
  const res = await apiFetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  let data = {};
  try { data = await res.json(); } catch (e) { data = { detail: 'Erro no servidor (não JSON)' }; }
  return { ok: res.ok, status: res.status, data };
}

/** Faz DELETE e retorna { ok, status }. */
async function apiDelete(path) {
  const res = await apiFetch(path, { method: 'DELETE' });
  return { ok: res.ok, status: res.status };
}

/** Faz upload de FormData (multipart). */
async function apiUpload(path, formData) {
  const res = await apiFetch(path, { method: 'POST', body: formData });
  let data = {};
  try { data = await res.json(); } catch (e) { data = { detail: 'Erro no upload (não JSON)' }; }
  return { ok: res.ok, status: res.status, data };
}

// ── Auth ──────────────────────────────────────────────────────────────────────

function authLogout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/index.html';
}

function getUser() {
  try { return JSON.parse(localStorage.getItem('user') || 'null'); } catch { return null; }
}

function saveSession(token, user) {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

function requireAuth() {
  if (!getToken() || !getUser()) {
    window.location.href = '/index.html';
    return false;
  }
  return true;
}

// ── Settings ──────────────────────────────────────────────────────────────────

function getSettings() {
  try { return JSON.parse(localStorage.getItem('tati_settings') || '{}'); } catch { return {}; }
}

function saveSetting(key, value) {
  const s = getSettings();
  s[key] = value;
  localStorage.setItem('tati_settings', JSON.stringify(s));
}

// ── Theme ─────────────────────────────────────────────────────────────────────

function applyTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  applyTheme(current === 'dark' ? 'light' : 'dark');
  const icon = document.getElementById('theme-icon');
  if (icon) icon.textContent = current === 'dark' ? '🌙' : '☀️';
}

// Apply on load
(function () {
  const theme = localStorage.getItem('theme') || 'dark';
  document.documentElement.setAttribute('data-theme', theme);
})();

// ── Password visibility toggle ────────────────────────────────────────────────

function togglePw(inputId, btn) {
  const input = document.getElementById(inputId);
  const icon = btn.querySelector('i');
  if (!input) return;
  if (input.type === 'password') {
    input.type = 'text';
    icon.className = 'fa-solid fa-eye-slash';
  } else {
    input.type = 'password';
    icon.className = 'fa-solid fa-eye';
  }
}

// ── Misc helpers ──────────────────────────────────────────────────────────────

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nowTime(isoString = null) {
  let date;
  if (isoString) {
    // Se vier sem timezone (ex: "2026-04-19T14:32:00"), assume UTC
    const iso = isoString.includes('Z') || isoString.includes('+') ? isoString : isoString + 'Z';
    date = new Date(iso);
  } else {
    date = new Date();
  }
  const lang = (typeof I18n !== 'undefined' ? I18n.getLang() : null) || 'pt-BR';
  return date.toLocaleTimeString(lang, { hour: '2-digit', minute: '2-digit' });
}

function formatMarkdown(text) {
  return text
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.*?)\*/g, '<em>$1</em>')
    .replace(/`(.*?)`/g, '<code>$1</code>')
    .replace(/\n/g, '<br>');
}

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

const STAFF_ROLES = new Set(['professor', 'professora', 'programador', 'Tatiana', 'Tati', 'admin', 'caio.sampaio']);
function isStaff(user) { return user && STAFF_ROLES.has(user.role); }

// ── Access Control ────────────────────────────────────────────────────────────

async function applyAccessControl() {
  try {
    const access = await apiGet('/users/permissions/access');

    // ── Dashboard: SOMENTE para professores/staff ──────────────
    // is_admin não significa acesso ao dashboard - só teachers
    const user = getUser();
    const isStaffRole = isStaff(user);
    const dashBtn = document.getElementById('btn-dashboard');
    if (dashBtn) {
      dashBtn.style.display = isStaffRole ? '' : 'none';
    }

    // ── Período gratuito (antes de 01/05/2026) ────────────────
    if (access.free_mode) {
      document.querySelectorAll('.premium-only').forEach(el => el.style.display = '');
      document.querySelectorAll('.paywall-only').forEach(el => el.style.display = 'none');
      return;
    }

    // ── Acesso completo (premium / exempt) ────────────────────
    if (access.full_access) {
      document.querySelectorAll('.premium-only').forEach(el => el.style.display = '');
      document.querySelectorAll('.paywall-only').forEach(el => el.style.display = 'none');
    } else {
      // Sem plano ativo
      document.querySelectorAll('.premium-only').forEach(el => el.style.display = 'none');
    }

    // ── Atividades (plano full) ───────────────────────────────
    document.querySelectorAll('.activities-only').forEach(el => {
      el.style.display = access.can_access_activities ? '' : 'none';
    });

    // ── Contador de mensagens gratuitas ───────────────────────
    if (access.free_messages_remaining !== null && access.free_messages_remaining !== undefined) {
      _showFreeMessagesBadge(access.free_messages_remaining);
    }

  } catch (e) {
    console.error("Erro no controle de acesso:", e);
  }
}

function _showFreeMessagesBadge(remaining) {
  // Remove badge anterior
  document.getElementById('free-msg-badge')?.remove();

  if (remaining > 3) return; // Só mostra quando estiver acabando

  const badge = document.createElement('div');
  badge.id = 'free-msg-badge';
  badge.style.cssText = `
        position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%);
        background: var(--surface); border: 1px solid ${remaining === 0 ? 'var(--danger)' : 'hsla(45,100%,58%,0.4)'};
        border-radius: 12px; padding: 0.75rem 1.25rem; z-index: 999;
        display: flex; align-items: center; gap: 0.75rem;
        box-shadow: var(--shadow-lg); max-width: 340px; width: 90%;
    `;

  if (remaining === 0) {
    badge.innerHTML = `
            <span style="font-size:1.2rem;">🔒</span>
            <div style="flex:1;">
                <p style="margin:0;font-size:0.85rem;font-weight:700;color:var(--danger);">${t('paywall.limit_reached')}</p>
                <p style="margin:0.2rem 0 0;font-size:0.75rem;color:var(--text-muted);">${t('paywall.upgrade_desc')}</p>
            </div>
            <a href="payment.html" style="
                padding:0.4rem 0.75rem; background:var(--primary); color:white;
                border-radius:8px; font-size:0.8rem; font-weight:700;
                text-decoration:none; white-space:nowrap;
            ">${t('paywall.upgrade')}</a>`;
  } else {
    badge.innerHTML = `
            <span style="font-size:1.2rem;">💬</span>
            <p style="margin:0;font-size:0.82rem;color:var(--text);">
                ${t('paywall.messages_left', remaining)}
            </p>
            <button onclick="document.getElementById('free-msg-badge').remove()"
                style="background:none;border:none;color:var(--text-muted);cursor:pointer;font-size:1rem;padding:0;">✕</button>`;
  }

  document.body.appendChild(badge);
}

// ── Toast notifications (Toastify) ──────────────────────────────────
function showToast(msg, type = 'info') {
  const cfg = {
    duration: 3500,
    close: true,
    gravity: 'top',
    position: 'right',
    stopOnFocus: true,
  };
  switch (type) {
    case 'success':
      Toastify({ text: msg, style: { background: '#10b981' }, ...cfg }).showToast();
      break;
    case 'error':
      Toastify({ text: msg, style: { background: '#ef4444' }, ...cfg }).showToast();
      break;
    case 'warning':
      Toastify({ text: msg, style: { background: '#f59e0b' }, ...cfg }).showToast();
      break;
    default:
      Toastify({ text: msg, style: { background: '#6366f1' }, ...cfg }).showToast();
  }
}

// ── KEEP-ALIVE: previne logout por inatividade ─────────────────────
// Faz ping leve na API a cada 8 minutos para manter a sessão viva
(function startSessionKeepAlive() {
  const INTERVAL_MS = 8 * 60 * 1000; // 8 minutos

  async function ping() {
    if (!getToken()) return;
    try {
      await fetch(API_BASE + '/auth/login', {  // endpoint leve que sempre existe
        method: 'HEAD',
        headers: authHeaders(),
      }).catch(() => { }); // silencioso
    } catch (_) { }
  }

  setInterval(ping, INTERVAL_MS);
})();