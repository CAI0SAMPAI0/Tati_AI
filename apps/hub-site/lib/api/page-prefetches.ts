import type { DehydratedState, QueryKey } from '@tanstack/react-query';
import { HUB_ENDPOINTS } from '@tati/hub-core';
import { serverFetch } from './server-fetch';

type PrefetchItem = {
  queryKey: QueryKey;
  endpoint?: string;
  queryFn?: () => Promise<unknown>;
  auth?: boolean;
};

async function prefetchHubQueries(items: PrefetchItem[]): Promise<DehydratedState> {
  const { QueryClient, dehydrate } = await import('@tanstack/react-query');
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { staleTime: 5 * 60 * 1000 },
    },
  });

  await Promise.all(
    items.map(({ queryKey, endpoint, queryFn, auth = true }) =>
      queryClient.prefetchQuery({
        queryKey,
        queryFn:
          queryFn ??
          (async () => {
            const data = await serverFetch(endpoint!, auth);
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

/**
 * Prefetch do catálogo público — NÃO usa cookies, pode ser estático.
 */
export async function prefetchHubCatalog(): Promise<DehydratedState> {
  return prefetchHubQueries([
    {
      queryKey: ['hub-catalog'],
      endpoint: '/catalog',
      auth: false,
    },
  ]);
}

/**
 * Páginas autenticadas — retorna QueryClient vazio para evitar
 * `cookies()` durante static generation. Os dados são buscados
 * client-side via React Query.
 */
async function emptyDehydrate(): Promise<DehydratedState> {
  const { QueryClient, dehydrate } = await import('@tanstack/react-query');
  return dehydrate(new QueryClient());
}

export async function prefetchHubOrders(): Promise<DehydratedState> {
  return emptyDehydrate();
}

export async function prefetchHubMyMaterials(): Promise<DehydratedState> {
  return emptyDehydrate();
}

export async function prefetchHubSecureAccess(contentId: string): Promise<DehydratedState> {
  return emptyDehydrate();
}
