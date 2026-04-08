/* o api.js é para ter o cliente centralizado para todas as chamadas à API backendd e eliminei fetch() duplicado espalhado que fiz em outros arquivos JS.
 */

const IS_LOCAL  = location.hostname === 'localhost' || location.hostname === '127.0.0.1';
const API_BASE  = IS_LOCAL ? 'http://localhost:8000' : 'https://tatiai-production.up.railway.app';
const WS_BASE   = IS_LOCAL ? 'ws://localhost:8000'  : 'wss://tatiai-production.up.railway.app';

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
  const res = await fetch(url, { ...options, headers });

  if (res.status === 401) {
    authLogout();
    throw new Error('Sessão expirada');
  }
  return res;
}

/** Faz GET e retorna JSON. */
async function apiGet(path) {
  const res = await apiFetch(path);
  if (!res.ok) throw new Error(`GET ${path} → ${res.status}`);
  return res.json();
}

/** Faz POST com JSON body e retorna JSON. */
async function apiPost(path, body) {
  const res = await apiFetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

/** Faz PUT com JSON body e retorna JSON. */
async function apiPut(path, body) {
  const res = await apiFetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

/** Faz PATCH com JSON body e retorna JSON. */
async function apiPatch(path, body) {
  const res = await apiFetch(path, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

/** Faz DELETE e retorna { ok, status }. */
async function apiDelete(path) {
  const res = await apiFetch(path, { method: 'DELETE' });
  return { ok: res.ok, status: res.status };
}

/** Faz upload de FormData (multipart). */
async function apiUpload(path, formData) {
  const res = await apiFetch(path, { method: 'POST', body: formData });
  return { ok: res.ok, status: res.status, data: await res.json() };
}

// ── Auth ──────────────────────────────────────────────────────────────────────

function authLogout() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
  window.location.href = '/';
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
    window.location.href = '/';
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
  const icon  = btn.querySelector('i');
  if (!input) return;
  if (input.type === 'password') {
    input.type     = 'text';
    icon.className = 'fa-solid fa-eye-slash';
  } else {
    input.type     = 'password';
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

function nowTime() {
  return new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
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

const STAFF_ROLES = new Set(['professor', 'professora', 'programador', 'Tatiana', 'Tati', 'admin']);
function isStaff(user) { return user && STAFF_ROLES.has(user.role); }

/**
 * Wrapper sobre fetch com autenticação.
 * Não faz logout em 401 imediato — tenta 1x antes de deslogar,
 * para evitar logout por erro temporário de rede/cold start do Railway.
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
 
// ── KEEP-ALIVE: previne logout por inatividade ─────────────────────
(function startSessionKeepAlive() {
  const INTERVAL_MS = 8 * 60 * 1000; // 8 minutos
 
  async function ping() {
    if (!getToken()) return;
    try {
      await fetch(API_BASE + '/auth/login', {  // endpoint leve que sempre existe
        method: 'HEAD',
        headers: authHeaders(),
      }).catch(() => {}); // silencioso
    } catch (_) {}
  }
 
  setInterval(ping, INTERVAL_MS);
})();
 