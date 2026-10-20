import { ref, onMounted } from 'vue';
import { apiGet } from '../api/client';
import { ENDPOINTS } from '../api/endpoints';

export function useStreakAndTrophies() {
  const currentStreak = ref(0);
  const isStreakActive = ref(false);
  const trophiesEarned = ref(0);
  const totalTrophies = ref(12);

  async function fetchStats() {
    try {
      const streakRes = await apiGet<{ current_streak?: number; is_active?: boolean }>(ENDPOINTS.STREAK);
      if (streakRes) {
        currentStreak.value = streakRes.current_streak || 0;
        isStreakActive.value = Boolean(streakRes.is_active);
      }
    } catch {}

    try {
      const achRes = await apiGet<{ earned_count?: number; total_count?: number }>('/activities/achievements/my');
      if (achRes) {
        trophiesEarned.value = achRes.earned_count || 0;
        totalTrophies.value = achRes.total_count || 12;
      }
    } catch {}
  }

  onMounted(() => {
    fetchStats();
  });

  return {
    currentStreak,
    isStreakActive,
    trophiesEarned,
    totalTrophies,
    refresh: fetchStats,
  };
}
