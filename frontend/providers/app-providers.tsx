'use client';

import { ThemeProvider } from './theme-provider';
import { AuthProvider } from './auth-provider';
import { QueryProvider } from './query-provider';
import { Toaster } from 'react-hot-toast';
import dynamic from 'next/dynamic';

import { AppUpdateDetector } from '@/components/app-update-detector';

const RegisterServiceWorker = dynamic(
  () => import('@/components/pwa/register-sw').then(m => m.RegisterServiceWorker as any),
  { ssr: false }
);

const GlobalErrorHandler = dynamic(
  () => import('@/components/global-error-handler').then(m => m.GlobalErrorHandler as any),
  { ssr: false }
);

export function AppProviders({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProvider>
      <QueryProvider>
        <AuthProvider>
          <AppUpdateDetector />
          {children}
          <Toaster
            position="top-right"
            containerStyle={{
              zIndex: 99999999,
            }}
            containerClassName="!z-[99999999]"
            toastOptions={{
              style: {
                zIndex: 99999999,
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
          <GlobalErrorHandler />
        </AuthProvider>
      </QueryProvider>
    </ThemeProvider>
  );
}