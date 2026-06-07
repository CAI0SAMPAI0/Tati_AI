import { AuthGuard } from '@/components/layout/auth-guard';
import dynamic from 'next/dynamic';

const TourLauncher = dynamic(
  () => import('@/components/onboarding/tour-launcher').then(m => m.TourLauncher as any),
  { ssr: false }
);

export default async function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      {children}
      <TourLauncher />
    </AuthGuard>
  );
}
