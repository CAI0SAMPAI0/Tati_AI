import { PublicGuard } from '@/components/layout/public-guard';

export default function PublicLayout({ children }: { children: React.ReactNode }) {
  return <PublicGuard>{children}</PublicGuard>;
}
