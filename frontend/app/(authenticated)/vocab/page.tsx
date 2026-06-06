import { prefetchRoute } from '@/lib/api/page-prefetches';
import { PrefetchHydration } from '@/lib/api/ssr-prefetch';
import VocabClientPage from './vocab-client-page';

export default async function Page() {
  const state = await prefetchRoute('vocab');
  return (
    <PrefetchHydration state={state}>
      <VocabClientPage />
    </PrefetchHydration>
  );
}
