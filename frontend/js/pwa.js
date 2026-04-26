(() => {
  if (!('serviceWorker' in navigator)) return;

  const INSTALL_BTN_ID = 'pwa-install-btn';
  let deferredPrompt = null;

  function isInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function getInstallLabel() {
    const lang = (typeof I18n !== 'undefined' && typeof I18n.getLang === 'function')
      ? I18n.getLang()
      : (localStorage.getItem('tati_lang') || 'pt-BR');
    return String(lang).startsWith('en') ? 'Install app' : 'Instalar app';
  }

  function getButton() {
    let btn = document.getElementById(INSTALL_BTN_ID);
    if (!btn) {
      btn = document.createElement('button');
      btn.id = INSTALL_BTN_ID;
      btn.type = 'button';
      btn.style.cssText = [
        'position:fixed',
        'right:16px',
        'bottom:16px',
        'z-index:1100',
        'display:none',
        'align-items:center',
        'gap:8px',
        'padding:10px 14px',
        'border:0',
        'border-radius:999px',
        'background:#3454d1',
        'color:#fff',
        'font-weight:700',
        'font-size:13px',
        'box-shadow:0 8px 24px rgba(0,0,0,.18)',
        'cursor:pointer',
      ].join(';');
      btn.innerHTML = '<i class="fa-solid fa-download"></i><span></span>';
      document.body.appendChild(btn);
    }
    const span = btn.querySelector('span');
    if (span) span.textContent = getInstallLabel();
    return btn;
  }

  function showInstallButton() {
    if (isInstalled() || !deferredPrompt) return;
    const btn = getButton();
    btn.style.display = 'inline-flex';
  }

  function hideInstallButton() {
    const btn = document.getElementById(INSTALL_BTN_ID);
    if (btn) btn.style.display = 'none';
  }

  async function registerServiceWorker() {
    try {
      const registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' });
      if (registration && typeof registration.update === 'function') {
        registration.update();
      }
    } catch (error) {
      console.error('Service worker registration failed:', error);
    }
  }

  window.addEventListener('load', registerServiceWorker);

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    showInstallButton();
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    hideInstallButton();
  });

  document.addEventListener('click', async (event) => {
    const btn = event.target.closest(`#${INSTALL_BTN_ID}`);
    if (!btn || !deferredPrompt) return;

    btn.disabled = true;
    try {
      await deferredPrompt.prompt();
      await deferredPrompt.userChoice;
    } finally {
      deferredPrompt = null;
      hideInstallButton();
      btn.disabled = false;
    }
  });
})();
