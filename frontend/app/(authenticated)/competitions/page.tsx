import { prefetchRoute } from '@/lib/api/page-prefetches';
import { PrefetchHydration } from '@/lib/api/ssr-prefetch';
import CompetitionsClientPage from './competitions-client-page';

export default async function Page() {
  const state = await prefetchRoute('competitions');
  return (
    <PrefetchHydration state={state}>
      <CompetitionsClientPage />
    </PrefetchHydration>
  );
}
