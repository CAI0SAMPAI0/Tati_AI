import { prefetchRoute } from '@/lib/api/page-prefetches';
import { PrefetchHydration } from '@/lib/api/ssr-prefetch';
import AchievementsClientPage from './achievements-client-page';

export default async function Page() {
  const state = await prefetchRoute('achievements');
  return (
    <PrefetchHydration state={state}>
      <AchievementsClientPage />
    </PrefetchHydration>
  );
}
