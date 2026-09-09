'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import Image from 'next/image';
import { RotateCcw, Home } from 'lucide-react';

export default function RootError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
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
        if (!lastReload || now - parseInt(lastReload, 10) > 10000) {
          sessionStorage.setItem('tati_chunk_reload', String(now));
          window.location.reload();
        }
      } catch {
        window.location.reload();
      }
    }
  }, [error]);

  return (
    <div className="min-h-screen bg-bg flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-surface border border-border rounded-3xl p-6 md:p-8 text-center shadow-xl flex flex-col items-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-5 shadow-sm overflow-hidden">
          <Image
            src="/images/tati_logo.jpg"
            alt="Teacher Tati"
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
            onClick={() => window.location.reload()}
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
