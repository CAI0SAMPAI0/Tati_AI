import { AuthGuard } from '@/components/layout/auth-guard';
import { ActivityRouteTracker } from '@/components/layout/activity-route-tracker';
import NextDynamic from 'next/dynamic';

const TourLauncher = NextDynamic(
  () => import('@/components/onboarding/tour-launcher').then(m => m.TourLauncher as any),
  { ssr: false }
);

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      <ActivityRouteTracker />
      {children}
      <TourLauncher />
    </AuthGuard>
  );
}
