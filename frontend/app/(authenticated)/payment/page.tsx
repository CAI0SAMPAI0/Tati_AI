import { prefetchRoute } from '@/lib/api/page-prefetches';
import { PrefetchHydration } from '@/lib/api/ssr-prefetch';
import PaymentClientPage from './payment-client-page';

export default async function Page() {
  const state = await prefetchRoute('payment');
  return (
    <PrefetchHydration state={state}>
      <PaymentClientPage />
    </PrefetchHydration>
  );
}
