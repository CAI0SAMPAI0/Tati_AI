'use client';

import { useAuth as useAuthContext } from '@/providers/auth-provider';

export function useAuth() {
  return useAuthContext();
}
