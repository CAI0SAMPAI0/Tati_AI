'use client';

import * as Sentry from '@sentry/nextjs';
import { Home, RotateCcw } from 'lucide-react';
import Image from 'next/image';
import { useEffect } from 'react';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const purgeAndReload = async () => {
    try {
      sessionStorage.removeItem('tati_chunk_reload');
      if (typeof window !== 'undefined') {
        if ('caches' in window) {
          const keys = await caches.keys();
          await Promise.all(keys.map((k) => caches.delete(k)));
        }
        if ('serviceWorker' in navigator) {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.map((r) => r.unregister()));
        }
      }
    } catch {}
    const url = new URL(window.location.href);
    url.searchParams.set('_v', Date.now().toString());
    window.location.href = url.toString();
  };

  useEffect(() => {
    Sentry.captureException(error);
    console.error('[RootError]', error);

    const message = error?.message || '';
    const name = error?.name || '';
    const isChunk =
      name === 'ChunkLoadError' ||
      message.includes('Loading chunk') ||
      message.includes('Failed to fetch dynamically imported module');

    if (isChunk) {
      try {
        const lastReload = sessionStorage.getItem('tati_chunk_reload');
        const now = Date.now();
        if (!lastReload || now - parseInt(lastReload, 10) > 8000) {
          sessionStorage.setItem('tati_chunk_reload', String(now));
          purgeAndReload();
        }
      } catch {
        purgeAndReload();
      }
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-surface border border-border rounded-3xl p-6 md:p-8 text-center shadow-xl flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-5 shadow-sm overflow-hidden">
          <Image
            src="/images/tati_logo.jpg"
            alt="Taty's Hub"
            width={52}
            height={52}
            className="rounded-xl object-cover"
            onError={(e) => {
              (e.target as HTMLElement).style.display = 'none';
            }}
          />
        </div>

        <h2 className="text-xl font-bold font-display text-text mb-2">
          Ops! Algo deu errado
        </h2>

        <p className="text-sm text-text-muted mb-6 leading-relaxed">
          Tivemos uma instabilidade momentânea. Clique no botão abaixo para tentar novamente.
        </p>

        <div className="w-full flex flex-col sm:flex-row gap-2.5">
          <button
            type="button"
            onClick={reset}
            className="flex-1 py-2.5 px-4 rounded-xl bg-primary text-white text-xs font-bold shadow-md shadow-primary/25 hover:bg-primary/90 active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw size={14} />
            <span>Tentar novamente</span>
          </button>

          <button
            type="button"
            onClick={purgeAndReload}
            className="flex-1 py-2.5 px-4 rounded-xl bg-surface border border-border text-text text-xs font-bold hover:bg-surface-hover active:scale-95 transition-all flex items-center justify-center gap-2 cursor-pointer"
          >
            <RotateCcw size={14} className="text-primary" />
            <span>Recarregar página</span>
          </button>
        </div>

        <div className="mt-5 pt-4 border-t border-border w-full flex items-center justify-center gap-4 text-xs text-text-muted">
          <a
            href="/"
            className="hover:text-primary transition-colors flex items-center gap-1 font-medium"
          >
            <Home size={13} />
            Página Inicial
          </a>
        </div>
      </div>
    </div>
  );
}
