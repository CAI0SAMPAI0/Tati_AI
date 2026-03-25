// js/settings.js
const token = localStorage.getItem('token');
if (!token) { window.location.href = '/'; }

// ── Apply theme on load ────────────────────────────────────────────
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

// ── Settings helpers ──────────────────────────────────────────────
function getSettings() {
  try { return JSON.parse(localStorage.getItem('tati_settings') || '{}'); } catch { return {}; }
}
function saveSetting(key, value) {
  const s = getSettings();
  s[key] = value;
  localStorage.setItem('tati_settings', JSON.stringify(s));
}

// ── Theme ─────────────────────────────────────────────────────────
function setTheme(theme) {
  document.documentElement.setAttribute('data-theme', theme);
  localStorage.setItem('theme', theme);
  document.getElementById('theme-dark').classList.toggle('active', theme === 'dark');
  document.getElementById('theme-light').classList.toggle('active', theme === 'light');
}

// ── Language ──────────────────────────────────────────────────────
function setLanguage(lang) {
  I18n.setLang(lang);
  // Highlight active button
  document.querySelectorAll('.lang-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === lang);
  });
}

// ── Init UI ───────────────────────────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  // Theme
  const theme = localStorage.getItem('theme') || 'dark';
  document.getElementById('theme-dark').classList.toggle('active', theme === 'dark');
  document.getElementById('theme-light').classList.toggle('active', theme === 'light');

  // Language buttons — highlight current
  const currentLang = I18n.getLang();
  document.querySelectorAll('.lang-option').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.lang === currentLang);
  });

  const s = getSettings();

  // Default speed
  const speed = document.getElementById('default-speed');
  if (speed && s.defaultSpeed) speed.value = s.defaultSpeed;

  // Word tooltip
  const wt = document.getElementById('word-tooltip-toggle');
  if (wt) wt.checked = s.wordTooltip !== false;

  // Enter to send
  const es = document.getElementById('enter-send');
  if (es) es.checked = s.enterSend !== false;
});

function saveAllSettings() {
  const s = {};

  // Default speed
  const speed = document.getElementById('default-speed');
  if (speed) s.defaultSpeed = speed.value;

  // Word tooltip
  const wt = document.getElementById('word-tooltip-toggle');
  if (wt) s.wordTooltip = wt.checked === true;

  // Enter to send
  const es = document.getElementById('enter-send');
  if (es) s.enterSend = es.checked === true;

  localStorage.setItem('tati_settings', JSON.stringify(s));

  // Feedback
  const btn = document.getElementById('btn-settings-save');
  if (btn) {
    const original = btn.textContent;
    btn.textContent = t('settings.saved');
    setTimeout(() => btn.textContent = original, 2000);
  }
}