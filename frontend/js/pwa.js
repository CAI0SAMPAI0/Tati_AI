(() => {
  if (!('serviceWorker' in navigator)) return;

  const STORAGE_KEY_PWA = 'tati_pwa_toast_seen_v10';
  let deferredPrompt = null;

  function isInstalled() {
    return window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;
  }

  function getToastMessage() {
    const lang = (typeof I18n !== 'undefined' && typeof I18n.getLang === 'function')
      ? I18n.getLang()
      : (localStorage.getItem('tati_lang') || 'pt-BR');
    
    if (String(lang).startsWith('en')) {
      return '✨ Want to use Tati AI as an app? Click on your browser menu and select "Install" or "Add to Home Screen".';
    }
    return '✨ Deseja usar o Tati AI como aplicativo? Clique no menu do seu navegador e selecione "Instalar" ou "Adicionar à Tela de Início".';
  }

  function showInstallToast() {
    // Só mostra se não estiver instalado, se não viu ainda nesta atualização, e se estiver em uma página "logada"
    const isLogged = !!localStorage.getItem('token');
    if (isInstalled() || localStorage.getItem(STORAGE_KEY_PWA) || !isLogged) return;

    if (typeof Toastify === 'function') {
      Toastify({
        text: getToastMessage(),
        duration: 10000,
        close: true,
        gravity: "top", 
        position: "center",
        stopOnFocus: true,
        style: {
          background: "linear-gradient(135deg, #6C63FF 0%, #3f37c9 100%)",
          borderRadius: "12px",
          fontWeight: "600",
          boxShadow: "0 10px 30px rgba(0,0,0,0.25)",
          padding: "16px 24px",
          color: "#fff",
          fontSize: "14px",
          lineHeight: "1.5"
        },
        onClick: function(){} 
      }).showToast();

      localStorage.setItem(STORAGE_KEY_PWA, '1');
    }
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

  window.addEventListener('load', () => {
    registerServiceWorker();
    // Pequeno delay para não brigar com outros carregamentos
    setTimeout(showInstallToast, 3000);
  });

  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event;
    // Não mostra botão fixo, guarda o prompt se precisar chamar via algum botão específico no futuro
  });

  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    localStorage.setItem(STORAGE_KEY_PWA, '1');
  });
})();
