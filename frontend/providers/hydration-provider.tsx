'use client';

import { HydrationBoundary, type DehydratedState } from '@tanstack/react-query';
import type { ReactNode } from 'react';

export default function HydrationProvider({
  state,
  children,
}: {
  state: DehydratedState;
  children: ReactNode;
}) {
  return <HydrationBoundary state={state}>{children}</HydrationBoundary>;
}
