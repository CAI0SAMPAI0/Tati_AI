import { AuthGuard } from '@/components/layout/auth-guard';
import { TourLauncher } from '@/components/onboarding/tour-launcher';

export default function AuthenticatedLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGuard>
      {children}
      <TourLauncher />
    </AuthGuard>
  );
}
