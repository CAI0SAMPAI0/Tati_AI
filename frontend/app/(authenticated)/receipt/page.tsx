import { prefetchRoute } from '@/lib/api/page-prefetches';
import { PrefetchHydration } from '@/lib/api/ssr-prefetch';
import ReceiptClientPage from './receipt-client-page';

export default async function Page() {
  const state = await prefetchRoute('receipt');
  return (
    <PrefetchHydration state={state}>
      <ReceiptClientPage />
    </PrefetchHydration>
  );
}
