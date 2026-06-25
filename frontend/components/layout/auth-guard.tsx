'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Spinner } from '@/components/ui/spinner';
import dynamic from 'next/dynamic';

// Lazy: não bloqueia o render inicial das rotas autenticadas
const NotificationProvider = dynamic(
  () => import('@/providers/notification-provider').then(m => m.NotificationProvider),
  { ssr: false }
);
const ChatSocketProvider = dynamic(
  () => import('@/providers/chat-socket-provider').then(m => m.ChatSocketProvider),
  { ssr: false }
);

export function AuthGuard({ children }: { children: React.ReactNode }) {
  const { token, isLoaded, isBootstrappingProfile } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (isLoaded && !token) {
      router.replace('/login');
    }
  }, [isLoaded, token, router]);

  if (!isLoaded || isBootstrappingProfile) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Spinner size="lg" />
      </div>
    );
  }

  if (!token) return null;

  return (
    <NotificationProvider>
      <ChatSocketProvider>
        {children}
      </ChatSocketProvider>
    </NotificationProvider>
  );
}
