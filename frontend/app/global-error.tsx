'use client';

import * as Sentry from '@sentry/nextjs';
import { useEffect } from 'react';

export default function GlobalError({
    error,
}: {
    error: Error & { digest?: string };
}) {
    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    return (
        <html lang="en-US">
            <body>
                <main>
                    <h2>Something went wrong</h2>
                    <button type="button" onClick={() => window.location.reload()}>
                        Reload
                    </button>
                </main>
            </body>
        </html>
    );
}