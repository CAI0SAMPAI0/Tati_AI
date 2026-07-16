'use client';

import { useEffect } from 'react';

export function RegisterServiceWorker() {
  useEffect(() => {
    // Never register service worker in Capacitor — causes reload loops and crashes
    const w = window as any;
    if (w.Capacitor?.isNativePlatform?.()) return;

    if (!('serviceWorker' in navigator)) return;
    if (
      process.env.NODE_ENV !== 'production' &&
      window.location.hostname !== 'localhost' &&
      window.location.hostname !== '127.0.0.1'
    ) {
      return;
    }

    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    navigator.serviceWorker.register('/sw.js').catch(() => {});
  }, []);

  return null;
}
