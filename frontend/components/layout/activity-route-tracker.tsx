'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const ACTIVITY_ROUTE_PREFIXES = [
  '/activities',
  '/history',
  '/flashcards',
  '/listenings',
  '/voice',
  '/voice-only',
  '/pronunciation-reader',
  '/vocab',
];

function isActivityRoute(pathname: string): boolean {
  if (!pathname) return false;
  return ACTIVITY_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`) || pathname.startsWith(`${prefix}?`)
  );
}

export function ActivityRouteTracker() {
  const pathname = usePathname();

  useEffect(() => {
    // Strip _v param if present in the address bar
    if (typeof window !== 'undefined') {
      try {
        const url = new URL(window.location.href);
        if (url.searchParams.has('_v')) {
          url.searchParams.delete('_v');
          window.history.replaceState({}, '', url.pathname + (url.search ? url.search : ''));
        }
      } catch {}
    }

    if (!pathname) return;

    // Salvar última rota acessada para redirecionamento inteligente no login/landing
    if (
      pathname !== '/' &&
      !['/login', '/register', '/reset-password'].includes(pathname)
    ) {
      try {
        localStorage.setItem('tati_last_route', pathname);
        document.cookie = `tati_last_route=${encodeURIComponent(pathname)}; path=/; max-age=7776000; SameSite=Lax`;
      } catch {}
    }

    // If navigating to a non-activity system route, reset the activities filter in sessionStorage
    if (!isActivityRoute(pathname)) {
      try {
        sessionStorage.removeItem('tati_activities_filter_level');
        sessionStorage.removeItem('tati_activities_filter_status');
        sessionStorage.removeItem('tati_activities_filter_source');
      } catch {
        // Ignore storage errors
      }
    }
  }, [pathname]);

  return null;
}
