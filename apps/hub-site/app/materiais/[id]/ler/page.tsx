import { prefetchHubSecureAccess } from '@/lib/api/page-prefetches';
import { PrefetchHydration } from '@/lib/api/ssr-prefetch';
import LerClientPage from './ler-client-page';

export default async function Page({ params }: { params: { id: string } }) {
  const state = await prefetchHubSecureAccess(params.id);

  return (
    <PrefetchHydration state={state}>
      <LerClientPage />
    </PrefetchHydration>
  );
}
