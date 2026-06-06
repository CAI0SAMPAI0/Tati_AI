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
            return serverFetch(endpoint!, auth);
          }),
      }),
    ),
  );

  return dehydrate(queryClient);
}

export async function prefetchHubCatalog(): Promise<DehydratedState> {
  const { QueryClient, dehydrate } = await import('@tanstack/react-query');
  const queryClient = new QueryClient();
  return dehydrate(queryClient);
}

export async function prefetchHubOrders(): Promise<DehydratedState> {
  const { QueryClient, dehydrate } = await import('@tanstack/react-query');
  const queryClient = new QueryClient();
  return dehydrate(queryClient);
}

export async function prefetchHubMyMaterials(): Promise<DehydratedState> {
  const { QueryClient, dehydrate } = await import('@tanstack/react-query');
  const queryClient = new QueryClient();
  return dehydrate(queryClient);
}

export async function prefetchHubSecureAccess(contentId: string): Promise<DehydratedState> {
  const { QueryClient, dehydrate } = await import('@tanstack/react-query');
  const queryClient = new QueryClient();
  return dehydrate(queryClient);
}
