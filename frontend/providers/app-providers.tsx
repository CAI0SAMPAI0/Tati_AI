'use client';

import { ThemeProvider } from './theme-provider';
import { AuthProvider } from './auth-provider';
import { QueryProvider } from './query-provider';
import { NotificationProvider } from './notification-provider';
import { Toaster } from 'react-hot-toast';
import dynamic from 'next/dynamic';

const RegisterServiceWorker = dynamic(
  () => import('@/components/pwa/register-sw').then(m => m.RegisterServiceWorker as any),
  { ssr: false }
);

const CapacitorHandler = dynamic(
  () => import('@/components/pwa/capacitor-handler').then(m => m.CapacitorHandler as any),
  { ssr: false }
);

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <AuthProvider>
          <NotificationProvider>
            {children}
            <Toaster
            position="top-right"
            toastOptions={{
              style: {
                background: 'var(--surface)',
                color: 'var(--text)',
                border: '1px solid var(--border)',
                borderRadius: 'var(--radius-md)',
                fontFamily: 'var(--font-body)',
                fontSize: '0.875rem',
              },
              success: { iconTheme: { primary: 'hsl(152 68% 42%)', secondary: 'white' } },
              error: { iconTheme: { primary: 'hsl(355 78% 60%)', secondary: 'white' } },
            }}
          />
            <RegisterServiceWorker />
            <CapacitorHandler />
          </NotificationProvider>
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}