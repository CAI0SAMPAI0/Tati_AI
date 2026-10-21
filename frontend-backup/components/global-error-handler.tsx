'use client';

import { useEffect } from 'react';
import * as Sentry from '@sentry/nextjs';
import { setupDomResilience } from '@/lib/dom-resilience';

function isBenignError(err: any): boolean {
  if (!err) return true;
  const message = String(err?.message || err?.value || err || '');
  const name = String(err?.name || '');

  // Erros causados por extensões/Google Tradutor modificando nós do React
  if (
    name === 'NotFoundError' ||
    err?.code === 8 ||
    message.includes('The object can not be found here') ||
    message.includes('The node to be removed is not a child of this node') ||
    message.includes("Failed to execute 'removeChild' on 'Node'") ||
    message.includes("Failed to execute 'insertBefore' on 'Node'")
  ) {
    return true;
  }

  // Erros minificados de 1 a 2 letras (ex: GSI / bibliotecas de terceiros)
  if (/^Error:\s*[A-Za-z]{1,2}$/.test(message) || message === 'La' || name === 'La') {
    return true;
  }

  // Erros de redimensionamento e abort de navegação
  if (
    message.includes('ResizeObserver loop') ||
    name === 'AbortError' ||
    message.includes('The operation was aborted')
  ) {
    return true;
  }

  return false;
}

export function GlobalErrorHandler() {
  useEffect(() => {
    // Garante que o patch de resiliência do DOM está ativo no cliente
    setupDomResilience();

    const handleError = (event: ErrorEvent) => {
      if (isBenignError(event.error) || isBenignError(event.message)) {
        return;
      }
      console.error('[GlobalError]', event.error);
      Sentry.captureException(event.error || new Error(event.message));
    };

    const handleUnhandledRejection = (event: PromiseRejectionEvent) => {
      if (isBenignError(event.reason)) {
        return;
      }
      console.error('[UnhandledRejection]', event.reason);
      Sentry.captureException(event.reason);
    };

    window.addEventListener('error', handleError);
    window.addEventListener('unhandledrejection', handleUnhandledRejection);

    return () => {
      window.removeEventListener('error', handleError);
      window.removeEventListener('unhandledrejection', handleUnhandledRejection);
    };
  }, []);

  return null;
}
