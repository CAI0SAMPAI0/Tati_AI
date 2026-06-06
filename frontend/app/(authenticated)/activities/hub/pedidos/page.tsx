import { prefetchRoute } from '@/lib/api/page-prefetches';
import { PrefetchHydration } from '@/lib/api/ssr-prefetch';
import PedidosClientPage from './pedidos-client-page';

export default async function Page() {
  const state = await prefetchRoute('hub-orders');
  return (
    <PrefetchHydration state={state}>
      <PedidosClientPage />
    </PrefetchHydration>
  );
}
