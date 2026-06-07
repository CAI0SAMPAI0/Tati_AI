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

const ROUTE_PREFETCHES: Record<string, (ctx?: PrefetchContext) => PrefetchItem[]> = {
  activities: () => [
    { queryKey: ['activities-modules'], endpoint: ENDPOINTS.ACTIVITIES_MODULES },
    { queryKey: ['activities-master-module'], endpoint: '/admin/modules/personalized' },
    { queryKey: ['activities-simulations'], endpoint: '/simulation/scenarios' },
    {
      queryKey: ['activities-podcasts'],
      endpoint: `${ENDPOINTS.ACTIVITIES_PODCASTS_RECOMMENDATIONS}?lang=en-US`,
    },
    { queryKey: ['activities-submissions'], endpoint: '/activities/submissions/my' },
    { queryKey: ['activities-flashcards'], endpoint: '/activities/flashcards/my' },
    { queryKey: ['activities-podcasts-progress'], endpoint: ENDPOINTS.ACTIVITIES_PODCASTS_PROGRESS },
    { queryKey: ['activities-simulations-progress'], endpoint: '/simulation/progress' },
    { queryKey: ['activities-user-errors'], endpoint: '/users/progress/errors/recent' },
    { queryKey: ['weekly-plan-v2'], queryFn: weeklyPlanPrefetch },
  ],
  achievements: () => [
    { queryKey: ['achievements-stats'], endpoint: '/dashboard/stats/my' },
    { queryKey: ['achievements-streak'], endpoint: ENDPOINTS.STREAK },
    { queryKey: ['achievements-medals'], endpoint: '/activities/achievements/my' },
  ],
  chat: () => [
    { queryKey: ['weekly-plan'], queryFn: weeklyPlanPrefetch },
    { queryKey: ['due-vocab'], endpoint: '/users/vocabulary/due' },
    { queryKey: ['payments-status'], endpoint: ENDPOINTS.PAYMENTS_STATUS },
    { queryKey: ['conversations'], endpoint: ENDPOINTS.CONVERSATIONS },
    { queryKey: ['avatar-frames'], endpoint: ENDPOINTS.AVATAR_FRAMES },
  ],
  competitions: () => [
    { queryKey: ['competitions-global-ranking'], endpoint: '/users/progress/ranking/top15' },
    { queryKey: ['competitions-level-rankings'], endpoint: '/users/progress/ranking/by-level' },
  ],
  dashboard: () => [
    { queryKey: ['admin-dashboard-stats'], endpoint: '/dashboard/stats' },
    { queryKey: ['admin-dashboard-students'], endpoint: '/dashboard/students' },
    { queryKey: ['admin-reports-overview'], endpoint: '/dashboard/reports/overview' },
    { queryKey: ['admin-students'], endpoint: '/dashboard/students' },
    { queryKey: ['admin-modules'], endpoint: ENDPOINTS.ADMIN_MODULE_ALL },
    { queryKey: ['admin-simulations'], endpoint: ENDPOINTS.ADMIN_SIMULATIONS },
    { queryKey: ['admin-flashcards'], endpoint: '/dashboard/flashcards' },
    { queryKey: ['admin-premium-contents'], endpoint: ENDPOINTS.ADMIN_PREMIUM },
    { queryKey: ['admin-submissions'], endpoint: '/dashboard/submissions/all' },
    { queryKey: ['weekly-goal'], endpoint: '/activities/weekly-goal' },
  ],
  goals: () => [
    { queryKey: ['goals'], endpoint: ENDPOINTS.GOALS },
    { queryKey: ['weekly-plan'], queryFn: weeklyPlanPrefetch },
    { queryKey: ['streak'], endpoint: ENDPOINTS.STREAK },
  ],
  payment: () => [{ queryKey: ['plans'], endpoint: '/payments/plans' }],
  profile: () => [{ queryKey: ['subscription'], endpoint: '/users/permissions/subscription' }],
  progress: () => [
    { queryKey: ['progress-xp'], endpoint: '/dashboard/stats/my' },
    { queryKey: ['progress-streak'], endpoint: ENDPOINTS.STREAK },
    { queryKey: ['progress-weekly'], endpoint: `${ENDPOINTS.PROGRESS_WEEKLY}?lang=en-US` },
    { queryKey: ['progress-monthly'], endpoint: `${ENDPOINTS.PROGRESS_MONTHLY}?lang=en-US` },
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
  'hub-catalog': () => [{ queryKey: ['hub-catalog'], endpoint: '/catalog', queryFn: () => serverFetch('/catalog', false) }],
  'hub-orders': () => [{ queryKey: ['hub-orders'], endpoint: '/catalog/orders' }],
  'hub-my-materials': () => [
    {
      queryKey: ['hub-my-materials'],
      queryFn: async () => {
        const list = await serverFetch<Array<{ has_access?: boolean }>>('/activities/hub');
        return (list ?? []).filter((item) => item.has_access);
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
  const { createServerQueryClient, prefetchQueries } = await import('./ssr-prefetch');
  const { dehydrate } = await import('@tanstack/react-query');
  
  const items = ROUTE_PREFETCHES[route]?.(ctx) || [];
  const token = await getServerAuthToken();
  const toPrefetch = withCommonQueries(items, token);
  
  if (toPrefetch.length > 0) {
    return prefetchQueries(toPrefetch);
  }
  
  const queryClient = createServerQueryClient();
  return dehydrate(queryClient);
}

export async function prefetchCommonQueries(): Promise<DehydratedState> {
  const { createServerQueryClient } = await import('./ssr-prefetch');
  const { dehydrate } = await import('@tanstack/react-query');
  const queryClient = createServerQueryClient();
  return dehydrate(queryClient);
}
