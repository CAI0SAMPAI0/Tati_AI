import * as Sentry from '@sentry/nextjs';

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

Sentry.init({
    dsn,
    enabled: Boolean(dsn),
    environment: process.env.NEXT_PUBLIC_SENTRY_ENVIRONMENT || process.env.NODE_ENV,
    tracesSampleRate: 0.1,
    beforeSend(event) {
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