'use client';

import { useEffect, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Capacitor } from '@capacitor/core';

const ROOT_PAGES = ['/dashboard', '/login', '/chat', '/'];

export function CapacitorHandler() {
  const router = useRouter();
  const pathname = usePathname();
  const pathnameRef = useRef(pathname);

  // Keep ref in sync with current pathname
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let backListener: any = null;
    let urlListener: any = null;

    const initCapacitor = async () => {
      try {
        const { App } = await import('@capacitor/app');
        const { SplashScreen } = await import('@capacitor/splash-screen');

        // Hide splash screen as soon as the JS is ready
        // This helps prevent some "App not responding" errors during slow loads
        await SplashScreen.hide().catch(() => null);

        // Back button handler — uses ref to always have fresh pathname
        backListener = await App.addListener('backButton', ({ canGoBack }) => {
          const currentPath = pathnameRef.current;
          const isRootPage = ROOT_PAGES.some(p => currentPath === p || currentPath.startsWith(p + '/'));

          if (!canGoBack || isRootPage) {
            App.exitApp();
          } else {
            router.back();
          }
        });

        // Deep link handler
        urlListener = await App.addListener('appUrlOpen', (event: { url: string }) => {
          try {
            const url = event.url;

            // Auth callback: com.tati.ai://auth?jwt=xxx
            if (url.includes('auth?jwt=') || url.includes('auth&jwt=')) {
              const parsed = new URL(url);
              const jwt = parsed.searchParams.get('jwt');
              if (jwt) {
                localStorage.setItem('token', jwt);
                router.push('/chat');
              }
              return;
            }

            // Reset password: com.tati.ai://reset-password?token=xxx
            if (url.includes('reset-password')) {
              const parsed = new URL(url);
              const token = parsed.searchParams.get('token');
              if (token) {
                router.push(`/reset-password?token=${token}`);
              }
            }
          } catch (e) {
            console.error('[CapacitorHandler] Deep link error:', e);
          }
        });

        return { backListener, urlListener };
      } catch (e) {
        console.warn('[CapacitorHandler] Plugin error:', e);
      }
    };

    const promise = initCapacitor();

    return () => {
      promise.then(listeners => {
        listeners?.backListener?.remove();
        listeners?.urlListener?.remove();
      });
    };
  }, [router]);

  return null;
}
