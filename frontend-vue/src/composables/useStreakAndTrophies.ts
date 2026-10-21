import { ref, onMounted, onUnmounted } from 'vue';
import { apiGet } from '../api/client';
import { ENDPOINTS } from '../api/endpoints';
import { useAuth } from './useAuth';

export function useStreakAndTrophies() {
  const { user } = useAuth();
  const currentStreak = ref(0);
  const isStreakActive = ref(false);
  const trophiesEarned = ref(0);
  const totalTrophies = ref(50);

  async function fetchStats() {
    try {
      const streakRes = await apiGet<any>(ENDPOINTS.STREAK);
      if (streakRes) {
        currentStreak.value =
          streakRes.current_streak ??
          (user.value as any)?.streak_count ??
          (user.value as any)?.streak ??
          0;
        isStreakActive.value = currentStreak.value > 0;
        if (typeof streakRes.trophies_earned === 'number') {
          trophiesEarned.value = streakRes.trophies_earned;
        }
        if (typeof streakRes.total_trophies === 'number') {
          totalTrophies.value = streakRes.total_trophies;
        }
      }
    } catch {
      if (user.value) {
        currentStreak.value =
          (user.value as any)?.streak_count ??
          (user.value as any)?.streak ??
          0;
        isStreakActive.value = currentStreak.value > 0;
      }
    }

    try {
      const achRes = await apiGet<any>('/activities/achievements/my');
      if (achRes) {
        if (typeof achRes.earned_count === 'number') {
          trophiesEarned.value = achRes.earned_count;
          totalTrophies.value = achRes.total_count || 50;
        } else if (Array.isArray(achRes)) {
          trophiesEarned.value = achRes.filter((a: any) => a.unlocked).length;
          totalTrophies.value = achRes.length || 50;
        }
      }
    } catch {}
  }

  function handleEventUpdate() {
    fetchStats();
  }

  onMounted(() => {
    fetchStats();
    if (typeof window !== 'undefined') {
      window.addEventListener('tati_streak_updated', handleEventUpdate);
      window.addEventListener('tati_chat_activity', handleEventUpdate);
      window.addEventListener('tati_activity_completed', handleEventUpdate);
      window.addEventListener('storage', handleEventUpdate);
    }
  });

  onUnmounted(() => {
    if (typeof window !== 'undefined') {
      window.removeEventListener('tati_streak_updated', handleEventUpdate);
      window.removeEventListener('tati_chat_activity', handleEventUpdate);
      window.removeEventListener('tati_activity_completed', handleEventUpdate);
      window.removeEventListener('storage', handleEventUpdate);
    }
  });

  return {
    currentStreak,
    isStreakActive,
    trophiesEarned,
    totalTrophies,
    refresh: fetchStats,
  };
}
