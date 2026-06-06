import { Suspense } from 'react';
import { prefetchRoute } from '@/lib/api/page-prefetches';
import { PrefetchHydration } from '@/lib/api/ssr-prefetch';
import { Spinner } from '@/components/ui/spinner';
import DashboardClientPage from './dashboard-client-page';

export default async function Page() {
  const state = await prefetchRoute('dashboard');
  return (
    <Suspense fallback={<div className="flex min-h-[50vh] items-center justify-center"><Spinner size="lg" /></div>}>
      <PrefetchHydration state={state}>
        <DashboardClientPage />
      </PrefetchHydration>
    </Suspense>
  );
}
