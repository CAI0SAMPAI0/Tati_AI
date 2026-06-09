import { prefetchRoute } from '@/lib/api/page-prefetches';
import { PrefetchHydration } from '@/lib/api/ssr-prefetch';
import HubClientPage from './hub-client-page';

export const dynamic = 'force-dynamic';


export default async function Page() {
  const state = await prefetchRoute('hub-catalog');
  return (
    <PrefetchHydration state={state}>
      <HubClientPage />
    </PrefetchHydration>
  );
}
