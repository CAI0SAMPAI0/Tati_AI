import { Suspense } from 'react';
import { LoginForm } from '@/components/login-form';

function LoginFallback() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-bg p-6">
      <p className="text-sm text-muted">Carregando...</p>
    </main>
  );
}

export default function HubLoginPage() {
  return (
    <Suspense fallback={<LoginFallback />}>
      <LoginForm />
    </Suspense>
  );
}
