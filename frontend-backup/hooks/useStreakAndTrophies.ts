'use client';

import { useEffect, useRef } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { useAuth } from '@/hooks/useAuth';
import toast from 'react-hot-toast';

export interface StreakAndTrophyData {
  current_streak: number;
  longest_streak?: number;
  trophies_earned: number;
  total_trophies?: number;
  has_studied_today?: boolean;
}

export function useStreakAndTrophies() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const prevTrophiesRef = useRef<number | null>(null);
  const prevStreakRef = useRef<number | null>(null);

  const { data, refetch, isLoading } = useQuery<StreakAndTrophyData>({
    queryKey: ['streak-data'],
    queryFn: () => apiGet<StreakAndTrophyData>(ENDPOINTS.STREAK),
    staleTime: 10_000,
    refetchInterval: 30_000,
    enabled: !!user,
  });

  const currentStreak = data?.current_streak ?? user?.streak ?? (user as any)?.streak_count ?? 0;
  const isStreakActive = currentStreak > 0;
  const trophiesEarned = data?.trophies_earned ?? 0;
  const totalTrophies = data?.total_trophies ?? 50;

  // Real-time synchronization via custom events across components and tabs
  useEffect(() => {
    const handleUpdate = (e?: Event) => {
      const detail = (e as CustomEvent)?.detail;
      if (detail && typeof detail.trophies_earned === 'number') {
        queryClient.setQueryData<StreakAndTrophyData>(['streak-data'], (old) => ({
          ...(old || ({} as StreakAndTrophyData)),
          ...detail,
        }));
      }
      queryClient.invalidateQueries({ queryKey: ['streak-data'] });
      queryClient.invalidateQueries({ queryKey: ['my-streak'] });
      queryClient.invalidateQueries({ queryKey: ['achievements-streak'] });
    };

    window.addEventListener('tati_streak_updated', handleUpdate);
    window.addEventListener('tati_chat_activity', handleUpdate);
    window.addEventListener('tati_activity_completed', handleUpdate);
    window.addEventListener('storage', handleUpdate);

    return () => {
      window.removeEventListener('tati_streak_updated', handleUpdate);
      window.removeEventListener('tati_chat_activity', handleUpdate);
      window.removeEventListener('tati_activity_completed', handleUpdate);
      window.removeEventListener('storage', handleUpdate);
    };
  }, [queryClient]);

  // Celebratory toast when winning a new trophy or advancing streak
  useEffect(() => {
    if (data) {
      if (prevTrophiesRef.current !== null && data.trophies_earned > prevTrophiesRef.current) {
        toast.success(`🏆 Congratulations! You've earned a new trophy! (${data.trophies_earned}/${data.total_trophies || 50})`, {
          duration: 5000,
          id: 'trophy-unlocked-toast',
        });
      }
      prevTrophiesRef.current = data.trophies_earned;

      if (prevStreakRef.current !== null && data.current_streak > prevStreakRef.current && data.current_streak > 1) {
        toast.success(`🔥 Streak on fire! ${data.current_streak} days in a row!`, {
          duration: 5000,
          id: 'streak-increased-toast',
        });
      }
      prevStreakRef.current = data.current_streak;
    }
  }, [data]);

  return {
    streakData: data,
    currentStreak,
    isStreakActive,
    trophiesEarned,
    totalTrophies,
    refetch,
    isLoading,
  };
}
