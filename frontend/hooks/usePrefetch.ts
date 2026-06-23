'use client';

import { useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { apiGet } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';

// Map of client-safe prefetches. We avoid importing from page-prefetches.ts
// here because that file imports server-side code (next/headers) which breaks
// the build when imported in a client component.
const CLIENT_PREFETCHES: Record<string, { queryKey: string[], endpoint: string }[]> = {
  dashboard: [
    { queryKey: ['admin-dashboard-stats'], endpoint: '/dashboard/stats' },
    { queryKey: ['admin-reports-overview'], endpoint: '/dashboard/reports/overview' },
    { queryKey: ['weekly-goal'], endpoint: '/activities/weekly-goal' },
  ],
  activities: [
    { queryKey: ['activities-modules'], endpoint: ENDPOINTS.ACTIVITIES_MODULES },
    { queryKey: ['activities-podcasts'], endpoint: `${ENDPOINTS.ACTIVITIES_PODCASTS_RECOMMENDATIONS}?lang=en-US` },
  ],
  chat: [
    { queryKey: ['due-vocab'], endpoint: '/users/vocabulary/due' },
    { queryKey: ['payments-status'], endpoint: ENDPOINTS.PAYMENTS_STATUS },
  ],
  progress: [
    { queryKey: ['my-stats'], endpoint: '/dashboard/stats/my' },
    { queryKey: ['progress-streak'], endpoint: ENDPOINTS.STREAK },
    { queryKey: ['progress-weekly'], endpoint: `${ENDPOINTS.PROGRESS_WEEKLY}?lang=en-US` },
    { queryKey: ['progress-monthly'], endpoint: `${ENDPOINTS.PROGRESS_MONTHLY}?lang=en-US` },
  ],
  settings: [
    { queryKey: ['subscription'], endpoint: '/users/permissions/subscription' }
  ],
  'hub-catalog': [
    { queryKey: ['hub-catalog'], endpoint: '/catalog' }
  ]
};

/**
 * Hook to prefetch route data on the client side.
 * Useful for 'onMouseEnter' events on navigation links.
 */
export function usePrefetch() {
  const queryClient = useQueryClient();

  const prefetch = useCallback(async (route: string) => {
    try {
      const items = CLIENT_PREFETCHES[route] || [];
      
      for (const item of items) {
        // Only prefetch if not already in cache or stale
        const queryState = queryClient.getQueryState(item.queryKey);
        if (queryState && queryState.status === 'success' && Date.now() - queryState.dataUpdatedAt < 30000) {
           continue;
        }

        if (item.endpoint) {
          queryClient.prefetchQuery({
            queryKey: item.queryKey,
            queryFn: () => apiGet(item.endpoint),
            staleTime: 60000,
          });
        }
      }
    } catch (err) {
      console.error(`[Prefetch] Error preloading ${route}:`, err);
    }
  }, [queryClient]);

  return { prefetch };
}
