import type { DehydratedState } from '@tanstack/react-query';
import { ENDPOINTS } from './endpoints';
import { normalizeWeeklyPlanData } from './weekly-plan';
import { getServerAuthToken, serverFetch } from './server-fetch';
import { prefetchQueries, type PrefetchItem } from './ssr-prefetch';

export type PrefetchContext = {
  id?: string;
};

async function weeklyPlanPrefetch(): Promise<unknown> {
  const data = await serverFetch('/users/progress/weekly-plan');
  if (data === null) {
    throw new Error('SSR Prefetch failed for /users/progress/weekly-plan');
  }
  return normalizeWeeklyPlanData(data);
}

function withCommonQueries(items: PrefetchItem[], token: string | null): PrefetchItem[] {
  const common: PrefetchItem[] = [
    {
      queryKey: ['streak-data'],
      endpoint: ENDPOINTS.STREAK,
    },
  ];

  if (token) {
    common.push({
      queryKey: ['access-control', token],
      endpoint: ENDPOINTS.ACCESS_CONTROL,
    });
  }

  return [...common, ...items];
}

export const ROUTE_PREFETCHES: Record<string, (ctx?: PrefetchContext) => PrefetchItem[]> = {
  activities: () => [
    { queryKey: ['activities-modules'], endpoint: ENDPOINTS.ACTIVITIES_MODULES },
    { queryKey: ['avatar-frames'], endpoint: '/avatar/frames' },
  ],
  achievements: () => [
    { queryKey: ['my-stats'], endpoint: '/dashboard/stats/my' },
  ],
  chat: () => [
    { queryKey: ['avatar-frames'], endpoint: '/avatar/frames' },
  ],
  competitions: () => [
    { queryKey: ['competitions-global-ranking'], endpoint: '/users/progress/ranking/top15' },
  ],
  dashboard: () => [
    { queryKey: ['admin-dashboard-stats'], endpoint: '/dashboard/stats' },
    { queryKey: ['avatar-frames'], endpoint: '/avatar/frames' },
  ],
  goals: () => [
    { queryKey: ['goals'], endpoint: ENDPOINTS.GOALS },
  ],
  payment: () => [{ queryKey: ['plans'], endpoint: '/payments/plans' }],
  profile: () => [{ queryKey: ['subscription'], endpoint: '/users/permissions/subscription' }],
  progress: () => [
    { queryKey: ['my-stats'], endpoint: '/dashboard/stats/my' },
    { queryKey: ['avatar-frames'], endpoint: '/avatar/frames' },
  ],
  voice: () => [
    { queryKey: ['avatar-frames'], endpoint: '/avatar/frames' },
  ],
  'voice-only': () => [
    { queryKey: ['avatar-frames'], endpoint: '/avatar/frames' },
  ],
  shop: () => [
    { queryKey: ['my-stats'], endpoint: '/dashboard/stats/my' },
    { queryKey: ['streak-data'], endpoint: ENDPOINTS.STREAK },
  ],
  receipt: () => [{ queryKey: ['payments-status', 'receipt'], endpoint: ENDPOINTS.PAYMENTS_STATUS }],
  vocab: () => [
    { queryKey: ['due-vocab'], endpoint: '/users/vocabulary/due' },
    { queryKey: ['vocabulary'], endpoint: ENDPOINTS.VOCABULARY },
  ],
  'vocab-review': () => [{ queryKey: ['due-vocab'], endpoint: '/users/vocabulary/due' }],
  podcasts: () => [
    {
      queryKey: ['podcasts-recommendations'],
      endpoint: `${ENDPOINTS.ACTIVITIES_PODCASTS_RECOMMENDATIONS}?lang=en-US`,
    },
  ],
  'hub-catalog': () => [
    {
      queryKey: ['hub-catalog'],
      endpoint: '/catalog',
      queryFn: async () => {
        const data = await serverFetch('/catalog', false);
        if (data === null) {
          throw new Error('SSR Prefetch failed for /catalog');
        }
        return data;
      },
    },
  ],
  'hub-orders': () => [{ queryKey: ['hub-orders'], endpoint: '/catalog/orders' }],
  'hub-my-materials': () => [
    {
      queryKey: ['hub-my-materials'],
      queryFn: async () => {
        const list = await serverFetch<Array<{ has_access?: boolean }>>('/activities/hub');
        if (list === null) {
          throw new Error('SSR Prefetch failed for /activities/hub');
        }
        return list.filter((item) => item.has_access);
      },
    },
  ],
  quiz: (ctx) => [
    {
      queryKey: ['quiz', ctx?.id],
      endpoint: `/activities/quizzes/${ctx?.id}`,
    },
  ],
  flashcards: (ctx) => [
    {
      queryKey: ['deck', ctx?.id],
      endpoint: `/activities/modules/${ctx?.id}`,
    },
  ],
  podcast: (ctx) => [
    {
      queryKey: ['podcast', ctx?.id],
      endpoint: ENDPOINTS.ACTIVITIES_PODCAST_DETAIL(ctx?.id ?? ''),
    },
  ],
};

export async function prefetchRoute(
  route: string,
  ctx?: PrefetchContext,
): Promise<DehydratedState> {
  const items = ROUTE_PREFETCHES[route]?.(ctx) || [];
  if (items.length > 0) {
    return prefetchQueries(items);
  }

  const { createServerQueryClient } = await import('./ssr-prefetch');
  const { dehydrate } = await import('@tanstack/react-query');
  const queryClient = createServerQueryClient();
  return dehydrate(queryClient);
}

export async function prefetchCommonQueries(): Promise<DehydratedState> {
  const { createServerQueryClient } = await import('./ssr-prefetch');
  const { dehydrate } = await import('@tanstack/react-query');
  const queryClient = createServerQueryClient();
  return dehydrate(queryClient);
}
