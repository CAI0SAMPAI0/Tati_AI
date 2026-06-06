import { prefetchRoute } from '@/lib/api/page-prefetches';
import { PrefetchHydration } from '@/lib/api/ssr-prefetch';
import ActivitiesClientPage from './activities-client-page';

export default async function Page() {
  const state = await prefetchRoute('activities');

  return (
    <PrefetchHydration state={state}>
      <ActivitiesClientPage />
    </PrefetchHydration>
  );
}