'use client';

import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import type { AccessControl } from '@/lib/api/types';
import { useAuth } from './useAuth';

import { useMemo } from 'react';

export function usePermissions() {
  const { token } = useAuth();

  const { data, error, isLoading } = useQuery({
    queryKey: ['access-control', token],
    queryFn: () => apiGet<AccessControl>(ENDPOINTS.ACCESS_CONTROL),
    enabled: Boolean(token),
    staleTime: 30_000,
  });

  return useMemo(() => ({
    access: data ?? null,
    isLoading,
    error,
    hasFullAccess: data?.full_access ?? false,
    isFreeMode: data?.free_mode ?? false,
    canAccessActivities: data?.free_mode || data?.can_access_activities || false,
    canAccessDashboard: data?.can_access_dashboard ?? false,
    freeMessagesRemaining: data?.free_messages_remaining ?? null,
  }), [data, isLoading, error]);
}
