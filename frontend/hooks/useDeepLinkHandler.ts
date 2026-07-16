'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * Listens for deep links (com.tati.ai://...) from Android intent filter
 * and navigates to the appropriate page.
 */
export function useDeepLinkHandler() {
  const router = useRouter();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const isCapacitor = (window as any).Capacitor?.isNativePlatform?.();
    if (!isCapacitor) return;

    const App = (window as any).Capacitor?.Plugins?.App;
    if (!App?.addListener) return;

    const handler = App.addListener('appUrlOpen', (event: { url: string }) => {
      const url = event.url;

      // Handle com.tati.ai://reset-password?token=xxx
      if (url.includes('reset-password')) {
        try {
          const parsed = new URL(url);
          const token = parsed.searchParams.get('token');
          if (token) {
            router.push(`/reset-password?token=${token}`);
          }
        } catch {
          // Fallback: extract token with regex
          const match = url.match(/token=([^&]+)/);
          if (match) {
            router.push(`/reset-password?token=${match[1]}`);
          }
        }
      }
    });

    return () => handler?.remove?.();
  }, [router]);
}
