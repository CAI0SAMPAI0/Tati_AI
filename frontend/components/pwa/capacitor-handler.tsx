'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export function CapacitorHandler() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let appPlugin: any = null;

    const initCapacitor = async () => {
      try {
        const { App } = await import('@capacitor/app');
        appPlugin = App;
        
        const listener = await App.addListener('backButton', ({ canGoBack }) => {
          // Se estivermos em uma página raiz ou não houver histórico, sai do app
          const isRootPage = ['/dashboard', '/login', '/'].includes(pathname);
          
          if (isRootPage || !canGoBack) {
            App.exitApp();
          } else {
            // Usa o router do Next.js para garantir que o estado da SPA seja atualizado
            router.back();
          }
        });

        return listener;
      } catch (e) {
        // Not running in Capacitor
      }
    };

    const promise = initCapacitor();

    return () => {
      promise.then(listener => {
        if (listener) listener.remove();
      });
    };
  }, [router, pathname]);

  return null;
}
