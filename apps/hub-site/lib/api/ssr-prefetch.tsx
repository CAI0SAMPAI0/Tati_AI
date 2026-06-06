import { HydrationBoundary, type DehydratedState } from '@tanstack/react-query';
import type { ReactNode } from 'react';

export function PrefetchHydration({
  state,
  children,
}: {
  state: DehydratedState;
  children: ReactNode;
}) {
  return <HydrationBoundary state={state}>{children}</HydrationBoundary>;
}
