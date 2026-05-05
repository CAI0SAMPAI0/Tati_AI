'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/spinner';

export function PublicGuard({ children }: { children: React.ReactNode }) {
  const { token, isLoaded } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && token) {
      router.replace('/chat');
    }
  }, [isLoaded, token, router]);

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (token) return null;

  return <>{children}</>;
}
