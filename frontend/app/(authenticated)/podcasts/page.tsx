import { prefetchRoute } from '@/lib/api/page-prefetches';
import { PrefetchHydration } from '@/lib/api/ssr-prefetch';
import PodcastsClientPage from './podcasts-client-page';

export default async function Page() {
  const state = await prefetchRoute('podcasts');
  return (
    <PrefetchHydration state={state}>
      <PodcastsClientPage />
    </PrefetchHydration>
  );
}
