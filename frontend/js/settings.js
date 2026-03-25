// js/settings.js
const token = localStorage.getItem('token');
if (!token) { window.location.href = '/'; }

// ── Apply theme on load (before render) ───────────────────────────
const savedTheme = localStorage.getItem('theme') || 'dark';
document.documentElement.setAttribute('data-theme', savedTheme);

// ── Settings helpers ──────────────────────────────────────────────
function getSettings() {
  try {
    return JSON.parse(localStorage.getItem('tati_settings') || '{}');
  } catch { return {}; }
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

// ── Init UI from saved settings ───────────────────────────────────
window.addEventListener('DOMContentLoaded', () => {
  // Theme buttons
  const theme = localStorage.getItem('theme') || 'dark';
  document.getElementById('theme-dark').classList.toggle('active', theme === 'dark');
  document.getElementById('theme-light').classList.toggle('active', theme === 'light');

  const s = getSettings();

  // Auto play
  const autoPlay = document.getElementById('auto-play');
  if (autoPlay) autoPlay.checked = s.autoPlay === true;

  // Default speed
  const speed = document.getElementById('default-speed');
  if (speed && s.defaultSpeed) speed.value = s.defaultSpeed;

  // Word tooltip
  const wordTooltip = document.getElementById('word-tooltip-toggle');
  if (wordTooltip) wordTooltip.checked = s.wordTooltip !== false; // default ON

  // Enter to send
  const enterSend = document.getElementById('enter-send');
  if (enterSend) enterSend.checked = s.enterSend !== false; // default ON
});