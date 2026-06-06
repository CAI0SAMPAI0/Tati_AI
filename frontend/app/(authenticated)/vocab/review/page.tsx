import { prefetchRoute } from '@/lib/api/page-prefetches';
import { PrefetchHydration } from '@/lib/api/ssr-prefetch';
import VocabReviewClientPage from './vocab-review-client-page';

export default async function Page() {
  const state = await prefetchRoute('vocab-review');
  return (
    <PrefetchHydration state={state}>
      <VocabReviewClientPage />
    </PrefetchHydration>
  );
}
