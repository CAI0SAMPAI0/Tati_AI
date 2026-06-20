'use client';

import { useEffect } from 'react';

export function RegisterServiceWorker() {
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return;
    if (
      process.env.NODE_ENV !== 'production' &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      return;
    }


    // Escuta mudanças de controle para recarregar a página automaticamente
    // Isso garante que o usuário obtenha a versão mais recente sem precisar fechar e reabrir o app
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker.register('/sw.js').catch(() => {
      // Falha silenciosa para não impactar o fluxo principal.
    });
  }, []);

  return null;
}

