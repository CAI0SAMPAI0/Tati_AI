import { prefetchRoute } from '@/lib/api/page-prefetches';
import { PrefetchHydration } from '@/lib/api/ssr-prefetch';
import ProgressClientPage from './progress-client-page';

export default async function Page() {
  const state = await prefetchRoute('progress');
  return (
    <PrefetchHydration state={state}>
      <ProgressClientPage />
    </PrefetchHydration>
  );
}
