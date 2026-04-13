if (!requireAuth()) throw new Error('Unauthenticated');

window.addEventListener('DOMContentLoaded', () => {
  const theme = localStorage.getItem('theme') || 'dark';
  document.getElementById('theme-dark')?.classList.toggle('active', theme === 'dark');
  document.getElementById('theme-light')?.classList.toggle('active', theme === 'light');

  const currentLang = I18n.getLang();
  document.querySelectorAll('.lang-option').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.lang === currentLang)
  );

  const s = getSettings();
  const speed = document.getElementById('default-speed');
  if (speed && s.defaultSpeed) speed.value = s.defaultSpeed;

  const wt = document.getElementById('word-tooltip-toggle');
  if (wt) wt.checked = s.wordTooltip !== false;

  const es = document.getElementById('enter-send');
  if (es) es.checked = s.enterSend !== false;
});

function setTheme(theme) {
  applyTheme(theme);
  document.getElementById('theme-dark')?.classList.toggle('active', theme === 'dark');
  document.getElementById('theme-light')?.classList.toggle('active', theme === 'light');
}

function setLanguage(lang) {
  I18n.setLang(lang);
  document.querySelectorAll('.lang-option').forEach(btn =>
    btn.classList.toggle('active', btn.dataset.lang === lang)
  );
}

function saveAllSettings() {
  const s = {};
  const speed = document.getElementById('default-speed');
  const wt    = document.getElementById('word-tooltip-toggle');
  const es    = document.getElementById('enter-send');

  if (speed) s.defaultSpeed = speed.value;
  if (wt)    s.wordTooltip  = wt.checked;
  if (es)    s.enterSend    = es.checked;

  localStorage.setItem('tati_settings', JSON.stringify(s));

  const btn = document.getElementById('btn-settings-save');
  if (btn) {
    const original = btn.textContent;
    btn.textContent = t('settings.saved');
    setTimeout(() => btn.textContent = original, 2000);
  }
}