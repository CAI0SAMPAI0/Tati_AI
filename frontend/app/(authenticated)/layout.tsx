import { AuthGuard } from '@/components/layout/auth-guard';
import { prefetchCommonQueries } from '@/lib/api/page-prefetches';
import { PrefetchHydration } from '@/lib/api/ssr-prefetch';
import dynamic from 'next/dynamic';

const TourLauncher = dynamic(
  () => import('@/components/onboarding/tour-launcher').then(m => m.TourLauncher as any),
  { ssr: false }
);

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  const state = await prefetchCommonQueries();

  return (
    <PrefetchHydration state={state}>
      <AuthGuard>
        {children}
        <TourLauncher />
      </AuthGuard>
    </PrefetchHydration>
  );
}
