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
  const autoPlay = document.getElementById('auto-play')?.addEventListener('change', (e) => saveSetting('autoPlay', e.target.checked === true));
  if (autoPlay) autoPlay.checked = s.autoPlay === true;

  // Default speed
  const speed = document.getElementById('default-speed')
  if (speed && s.defaultSpeed) speed.value = s.defaultSpeed;

  // Word tooltip
  const wordTooltip = document.getElementById('word-tooltip-toggle')?.addEventListener('change', (e) => saveSetting('wordTooltip', e.target.checked === true));
  if (wordTooltip) wordTooltip.checked = s.wordTooltip !== false; // default ON

  // Enter to send
  const enterSend = document.getElementById('enter-send')?.addEventListener('change', (e) => saveSetting('enterSend', e.target.checked === true));
  if (enterSend) enterSend.checked = s.enterSend !== false; // default ON
});

function saveAllSettings() {
  const s = {};
  
  // Auto play como boolean
  const autoPlay = document.getElementById('auto-play');
  if (autoPlay) s.autoPlay = autoPlay.checked === true;
  
  // Default speed
  const speed = document.getElementById('default-speed');
  if (speed) s.defaultSpeed = speed.value;
  
  // Word tooltip como boolean
  const wordTooltip = document.getElementById('word-tooltip-toggle');
  if (wordTooltip) s.wordTooltip = wordTooltip.checked === true;
  
  // Enter to send como boolean
  const enterSend = document.getElementById('enter-send');
  if (enterSend) s.enterSend = enterSend.checked === true;
  
  // Salvar tudo
  localStorage.setItem('tati_settings', JSON.stringify(s));
  
  // Feedback visual
  const btn = document.getElementById('btn-settings-save');
  if (btn) {
    btn.textContent = '✅ Salvo!';
    setTimeout(() => btn.textContent = '💾 Salvar Alterações', 2000);
  }
}