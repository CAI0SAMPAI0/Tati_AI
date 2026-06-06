import { prefetchRoute } from '@/lib/api/page-prefetches';
import { PrefetchHydration } from '@/lib/api/ssr-prefetch';
import GoalsClientPage from './goals-client-page';

export default async function Page() {
  const state = await prefetchRoute('goals');
  return (
    <PrefetchHydration state={state}>
      <GoalsClientPage />
    </PrefetchHydration>
  );
}
