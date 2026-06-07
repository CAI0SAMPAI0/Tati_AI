import {
  QueryClient,
  dehydrate,
  type DehydratedState,
  type QueryKey,
} from '@tanstack/react-query';
import type { ReactNode } from 'react';

export const SSR_STALE_TIME = 5 * 60 * 1000;

export function createServerQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: SSR_STALE_TIME,
      },
    },
  });
}

export type PrefetchItem = {
  queryKey: QueryKey;
  endpoint?: string;
  queryFn?: () => Promise<unknown>;
};

export async function prefetchQueries(items: PrefetchItem[]): Promise<DehydratedState> {
  const queryClient = createServerQueryClient();

  await Promise.all(
    items.map(({ queryKey, endpoint, queryFn }) =>
      queryClient.prefetchQuery({
        queryKey,
        queryFn:
          queryFn ??
          (async () => {
            const { serverFetch } = await import('./server-fetch');
            const data = await serverFetch(endpoint!);
            if (data === null) {
              throw new Error(`SSR Prefetch failed for ${endpoint}`);
            }
            return data;
          }),
      }),
    ),
  );

  return dehydrate(queryClient);
}

import HydrationProvider from '@/providers/hydration-provider';

export function PrefetchHydration({
  state,
  children,
}: {
  state: DehydratedState;
  children: ReactNode;
}) {
  return <HydrationProvider state={state}>{children}</HydrationProvider>;
}
