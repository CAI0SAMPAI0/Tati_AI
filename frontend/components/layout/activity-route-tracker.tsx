'use client';

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

const ACTIVITY_ROUTE_PREFIXES = [
  '/activities',
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
    if (!pathname) return;

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
