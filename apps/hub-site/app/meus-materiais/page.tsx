import { prefetchHubMyMaterials } from '@/lib/api/page-prefetches';
import { PrefetchHydration } from '@/lib/api/ssr-prefetch';
import MyMaterialsClientPage from './meus-materiais-client-page';

export default async function Page() {
  const state = await prefetchHubMyMaterials();

  return (
    <PrefetchHydration state={state}>
      <MyMaterialsClientPage />
    </PrefetchHydration>
  );
}
