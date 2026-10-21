import * as Sentry from '@sentry/nextjs';
import { setupDomResilience } from './lib/dom-resilience';

// Aplica proteções contra modificações externas no DOM (Google Tradutor, extensões, iOS WebKit)
setupDomResilience();

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
    dsn,
    enabled: Boolean(dsn),
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    ignoreErrors: [
        // DOMException 8: erros causados por tradutores automáticos (Google Translate / Safari / Chrome iOS)
        /The object can not be found here/i,
        /The node to be removed is not a child of this node/i,
        /Failed to execute 'removeChild' on 'Node'/i,
        /Failed to execute 'insertBefore' on 'Node'/i,
        /NotFoundError/i,
        // Erros minificados de 1 a 2 letras de bibliotecas externas de autenticação (como Google Identity Services / GSI)
        /^Error:\s*[A-Za-z]{1,2}$/,
        'Error: La',
        // Erros comuns e benignos de observadores e cancelamento
        /ResizeObserver loop/i,
        /Non-Error promise rejection/i,
        /AbortError/i,
    ],
    beforeSend(event) {
        // Filtra erros de tradução de DOM no nível de exceção
        if (event.exception?.values) {
            for (const exception of event.exception.values) {
                const msg = exception.value || '';
                const type = exception.type || '';

                if (
                    msg.includes('The object can not be found here') ||
                    msg.includes('The node to be removed is not a child of this node') ||
                    msg.includes("Failed to execute 'removeChild' on 'Node'") ||
                    msg.includes("Failed to execute 'insertBefore' on 'Node'") ||
                    type === 'NotFoundError'
                ) {
                    return null;
                }

                if (/^Error:\s*[A-Za-z]{1,2}$/.test(msg) || type === 'La' || msg === 'La') {
                    return null;
                }
            }
        }

        // Sanitização de tokens sensíveis nos logs
        if (event.request?.url) {
            event.request.url = event.request.url.replace(/([?&]token=)[^&]+/gi, '$1[redacted]');
        }
        if (event.request?.query_string) {
            event.request.query_string = String(event.request.query_string).replace(
                /(^|&)token=[^&]*/gi,
                '$1token=[redacted]',
            );
        }
        return event;
    },
});