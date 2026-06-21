import { prefetchRoute } from '@/lib/api/page-prefetches';
import { PrefetchHydration } from '@/lib/api/ssr-prefetch';
import ShopClientPage from './shop-client-page';

export const metadata = {
  title: 'Shop - Tati AI',
  description: 'Gaste seu XP acumulado para comprar recompensas e itens de ajuda como o Streak Freeze.',
};

export default async function Page() {
  const state = await prefetchRoute('shop');
  return (
    <PrefetchHydration state={state}>
      <ShopClientPage />
    </PrefetchHydration>
  );
}
