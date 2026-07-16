'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';

export function CapacitorHandler() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    let appPlugin: any = null;
    let backListener: any = null;
    let urlListener: any = null;

    const initCapacitor = async () => {
      try {
        const { App } = await import('@capacitor/app');
        appPlugin = App;

        // Back button handler
        backListener = await App.addListener('backButton', ({ canGoBack }) => {
          const isRootPage = ['/dashboard', '/login', '/'].includes(pathname);

          if (isRootPage || !canGoBack) {
            App.exitApp();
          } else {
            router.back();
          }
        });

        // Deep link handler (com.tati.ai://...)
        urlListener = await App.addListener('appUrlOpen', (event: { url: string }) => {
          const url = event.url;

          // Handle auth callback: com.tati.ai://auth?jwt=xxx
          if (url.includes('auth?jwt=') || url.includes('auth&jwt=')) {
            try {
              const parsed = new URL(url);
              const jwt = parsed.searchParams.get('jwt');
              if (jwt) {
                localStorage.setItem('token', jwt);
                router.push('/chat');
              }
            } catch {
              const match = url.match(/jwt=([^&]+)/);
              if (match) {
                localStorage.setItem('token', decodeURIComponent(match[1]));
                router.push('/chat');
              }
            }
            return;
          }

          // Handle reset password: com.tati.ai://reset-password?token=xxx
          if (url.includes('reset-password')) {
            try {
              const parsed = new URL(url);
              const token = parsed.searchParams.get('token');
              if (token) {
                router.push(`/reset-password?token=${token}`);
              }
            } catch {
              const match = url.match(/token=([^&]+)/);
              if (match) {
                router.push(`/reset-password?token=${match[1]}`);
              }
            }
          }
        });

        return { backListener, urlListener };
      } catch (e) {
        // Not running in Capacitor
      }
    };

    const promise = initCapacitor();

    return () => {
      promise.then(listeners => {
        listeners?.backListener?.remove();
        listeners?.urlListener?.remove();
      });
    };
  }, [router, pathname]);

  return null;
}
