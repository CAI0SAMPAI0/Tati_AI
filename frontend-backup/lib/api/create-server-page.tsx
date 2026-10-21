import { Suspense, type ComponentType, type ReactNode } from 'react';
import { prefetchRoute, type PrefetchContext } from './page-prefetches';
import { PrefetchHydration } from './ssr-prefetch';
import { Spinner } from '@/components/ui/spinner';

type ServerPageOptions = {
  route: string;
  ClientPage: ComponentType;
  suspense?: boolean;
  getContext?: (params: Record<string, string>) => PrefetchContext;
};

export function createServerPage({
  route,
  ClientPage,
  suspense = false,
  getContext,
}: ServerPageOptions) {
  async function ServerPage({ params }: { params?: Record<string, string> }) {
    const ctx = getContext && params ? getContext(params) : undefined;
    const state = await prefetchRoute(route, ctx);
    const content = (
      <PrefetchHydration state={state}>
        <ClientPage />
      </PrefetchHydration>
    );

    if (!suspense) return content;

    return (
      <Suspense
        fallback={
          <div className="flex min-h-[50vh] items-center justify-center">
            <Spinner size="lg" />
          </div>
        }
      >
        {content}
      </Suspense>
    );
  }

  return ServerPage;
}

export function loadingFallback(children: ReactNode) {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[50vh] items-center justify-center">
          <Spinner size="lg" />
        </div>
      }
    >
      {children}
    </Suspense>
  );
}
