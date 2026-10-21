<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  Flame,
  Snowflake,
  Trophy,
  Type,
  MessageSquare,
  CalendarDays,
  BookOpen,
  Mail,
  History,
  ArrowRight,
  ArrowUp,
} from 'lucide-vue-next';
import { apiGet, apiPost } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { useAuth } from '@/composables/useAuth';
import { useToast } from '@/composables/useToast';
import Button from '@/components/ui/Button.vue';
import ActivityBarChart from '@/components/charts/ActivityBarChart.vue';

interface XpData {
  total_xp?: number;
  xp?: number;
  current_streak?: number;
  longest_streak?: number;
  level_progress?: number;
  level?: string;
}

interface StreakData {
  current_streak: number;
  longest_streak: number;
  streak_freeze_count?: number;
  freeze_count?: number;
}

interface WeeklyReport {
  period: 'weekly';
  total_conversations: number;
  total_messages: number;
  study_days: number;
  unique_words_used: number;
  current_streak: number;
  messages_by_day: number[];
  days_of_week: string[];
}

interface MonthlyReport {
  period: 'monthly';
  total_conversations: number;
  total_messages: number;
  study_days: number;
  unique_words_used: number;
  current_streak: number;
  longest_streak: number;
  messages_by_week: number[];
}

type Period = 'weekly' | 'monthly';

const LEVEL_COLORS: Record<string, string> = {
  A1: 'from-green-500 to-emerald-400',
  A2: 'from-teal-500 to-green-400',
  B1: 'from-blue-500 to-cyan-400',
  B2: 'from-indigo-500 to-blue-400',
  C1: 'from-violet-500 to-indigo-400',
  C2: 'from-primary to-violet-400',
};

const router = useRouter();
const toast = useToast();
const { user, userLevel } = useAuth();

const period = ref<Period>('weekly');
const isSendingReport = ref(false);
const isLoading = ref(true);
const showScrollTop = ref(false);

const xpData = ref<XpData | null>(null);
const streakData = ref<StreakData | null>(null);
const weeklyReport = ref<WeeklyReport | null>(null);
const monthlyReport = ref<MonthlyReport | null>(null);
const levelRankings = ref<Record<string, any[]>>({});

const currentLevel = computed(() => {
  return (user.value?.level || userLevel.value || xpData.value?.level || 'A1').toUpperCase();
});

const levelGradient = computed(() => {
  return LEVEL_COLORS[currentLevel.value] || LEVEL_COLORS.A1;
});

const totalScore = computed(() => {
  return (xpData.value?.total_xp ?? xpData.value?.xp ?? 0).toLocaleString('en-US');
});

const activeReport = computed(() => {
  return period.value === 'weekly' ? weeklyReport.value : monthlyReport.value;
});

const stats = computed(() => {
  if (!activeReport.value) {
    return {
      total_messages: 0,
      total_conversations: 0,
      study_days: 0,
      unique_words_used: 0,
    };
  }
  return {
    total_messages: activeReport.value.total_messages ?? 0,
    total_conversations: activeReport.value.total_conversations ?? 0,
    study_days: activeReport.value.study_days ?? 0,
    unique_words_used: activeReport.value.unique_words_used ?? 0,
  };
});

const chartData = computed(() => {
  if (period.value === 'weekly') {
    if (weeklyReport.value && weeklyReport.value.messages_by_day) {
      const days = weeklyReport.value.days_of_week?.length
        ? weeklyReport.value.days_of_week
        : ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
      return weeklyReport.value.messages_by_day.map((val, i) => ({
        name: days[i] ?? `D${i + 1}`,
        messages: val,
      }));
    }
    return [
      { name: 'Mon', messages: 0 },
      { name: 'Tue', messages: 0 },
      { name: 'Wed', messages: 0 },
      { name: 'Thu', messages: 0 },
      { name: 'Fri', messages: 0 },
      { name: 'Sat', messages: 0 },
      { name: 'Sun', messages: 0 },
    ];
  }

  if (period.value === 'monthly') {
    if (monthlyReport.value && monthlyReport.value.messages_by_week) {
      return monthlyReport.value.messages_by_week.map((val, i) => ({
        name: `Wk ${i + 1}`,
        messages: val,
      }));
    }
    return [
      { name: 'Wk 1', messages: 0 },
      { name: 'Wk 2', messages: 0 },
      { name: 'Wk 3', messages: 0 },
      { name: 'Wk 4', messages: 0 },
    ];
  }

  return [];
});

const freezeCount = computed(() => {
  return streakData.value?.streak_freeze_count ?? streakData.value?.freeze_count ?? 0;
});

const currentLeagueRankings = computed(() => {
  return levelRankings.value?.[currentLevel.value] || [];
});

const myLeaguePosition = computed(() => {
  const list = currentLeagueRankings.value;
  if (!list.length) return null;
  const myUsername = user.value?.username?.toLowerCase();
  const idx = list.findIndex((r: any) => r.username?.toLowerCase() === myUsername);
  if (idx !== -1) {
    return { rank: idx + 1, total: list.length };
  }
  return null;
});

async function loadData() {
  isLoading.value = true;
  try {
    const [xpRes, strkRes, weekRes, monthRes, rankRes] = await Promise.all([
      apiGet<XpData>('/dashboard/stats/my').catch(() => null),
      apiGet<StreakData>(ENDPOINTS.STREAK).catch(() => null),
      apiGet<WeeklyReport>(`${ENDPOINTS.PROGRESS_WEEKLY}?lang=en-US`).catch(() => null),
      apiGet<MonthlyReport>(`${ENDPOINTS.PROGRESS_MONTHLY}?lang=en-US`).catch(() => null),
      apiGet<Record<string, any[]>>('/users/progress/ranking/by-level').catch(() => ({})),
    ]);

    xpData.value = xpRes;
    streakData.value = strkRes;
    weeklyReport.value = weekRes;
    monthlyReport.value = monthRes;
    levelRankings.value = rankRes || {};
  } catch (err) {
    console.error('Failed to load progress data:', err);
  } finally {
    isLoading.value = false;
  }
}

async function handleSendReportEmail() {
  isSendingReport.value = true;
  try {
    const res = await apiPost<{ success?: boolean; message?: string; email?: string }>(
      '/users/progress/report/send-email',
      {}
    ).catch(async () => {
      // Fallback endpoint if specific one is different
      return await apiPost<{ success?: boolean; message?: string; email?: string }>(
        ENDPOINTS.CHAT_DOWNLOAD_REPORT,
        { lang: 'en' }
      );
    });

    const targetEmail = (res as any)?.email || (res as any)?.data?.email || user.value?.email;
    toast.success(
      targetEmail
        ? `PDF Report sent to your email (${targetEmail})! 📬`
        : 'PDF Report sent to your email! 📬'
    );
  } catch (err: any) {
    console.error('Error sending report email:', err);
    toast.error(err?.message || 'Error sending report to email. Please try again.');
  } finally {
    isSendingReport.value = false;
  }
}

function handleScroll() {
  const scrollY = window.scrollY || document.documentElement.scrollTop;
  showScrollTop.value = scrollY > 200;
}

function scrollToTop() {
  window.scrollTo({ top: 0, behavior: 'smooth' });
  const mainEl = document.querySelector('main');
  if (mainEl) {
    mainEl.scrollTo({ top: 0, behavior: 'smooth' });
  }
}

onMounted(() => {
  loadData();
  window.addEventListener('scroll', handleScroll, { passive: true });
  const mainEl = document.querySelector('main');
  if (mainEl) {
    mainEl.addEventListener('scroll', () => {
      showScrollTop.value = mainEl.scrollTop > 200;
    }, { passive: true });
  }
});

onUnmounted(() => {
  window.removeEventListener('scroll', handleScroll);
});
</script>

<template>
  <div class="p-4 md:p-8 max-w-7xl w-full mx-auto space-y-8 animate-fade-in text-text">
    <!-- Top Header -->
    <header class="flex flex-col md:flex-row md:items-end justify-between gap-4">
      <div>
        <h1 class="text-2xl md:text-3xl font-display font-bold text-text mb-2">
          My Progress
        </h1>
        <p class="text-text-muted text-sm">
          Track your learning evolution
        </p>
      </div>

      <button
        type="button"
        @click="handleSendReportEmail"
        :disabled="isSendingReport"
        class="inline-flex items-center justify-center gap-2 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 rounded-2xl px-6 py-3.5 font-bold text-sm transition-all active:scale-[0.98] cursor-pointer disabled:opacity-50"
      >
        <span v-if="isSendingReport" class="animate-spin text-base">⏳</span>
        <Mail v-else :size="18" />
        <span>{{ isSendingReport ? 'Sending...' : 'Send PDF Report on Email' }}</span>
      </button>
    </header>

    <!-- Level, Score & History Card -->
    <div class="bg-surface border border-border rounded-3xl p-6 group hover:border-primary/30 transition-all">
      <div class="flex items-center justify-between flex-wrap gap-4">
        <!-- Level badge -->
        <div class="flex items-center gap-4">
          <div
            class="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black text-white bg-gradient-to-br shadow-sm shrink-0"
            :class="levelGradient"
          >
            🏆
          </div>
          <div>
            <p class="text-[0.65rem] font-bold text-text-subtle uppercase tracking-widest">
              Current Level
            </p>
            <p class="text-xl font-black text-text leading-tight">
              <span v-if="isLoading && !user?.level" class="inline-block w-12 h-5 bg-bg-secondary rounded animate-pulse" />
              <span v-else>{{ currentLevel }}</span>
            </p>
          </div>
        </div>

        <!-- Score & History link -->
        <div class="flex items-center gap-6 flex-wrap">
          <div>
            <p class="text-[0.65rem] font-bold text-text-subtle uppercase tracking-widest text-left sm:text-right">
              Score
            </p>
            <div class="flex items-baseline gap-1">
              <span v-if="isLoading" class="inline-block w-20 h-6 bg-bg-secondary rounded animate-pulse" />
              <template v-else>
                <span class="text-2xl font-black text-primary tabular-nums">
                  {{ totalScore }}
                </span>
                <span class="text-xs font-bold text-text-muted">
                  pts
                </span>
              </template>
            </div>
          </div>

          <router-link
            to="/history"
            class="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-bg-secondary hover:bg-primary/10 hover:text-primary text-text font-bold text-xs transition-all border border-border hover:border-primary/30 active:scale-[0.98]"
          >
            <History :size="16" />
            <span>Activity History</span>
            <ArrowRight :size="14" />
          </router-link>
        </div>
      </div>
    </div>

    <!-- Period Switcher Tabs -->
    <div class="flex gap-2">
      <button
        type="button"
        @click="period = 'weekly'"
        class="px-5 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer"
        :class="
          period === 'weekly'
            ? 'bg-primary text-white border-primary shadow-glow'
            : 'bg-surface border-border text-text-muted hover:border-primary/40 hover:text-text'
        "
      >
        Weekly
      </button>
      <button
        type="button"
        @click="period = 'monthly'"
        class="px-5 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer"
        :class="
          period === 'monthly'
            ? 'bg-primary text-white border-primary shadow-glow'
            : 'bg-surface border-border text-text-muted hover:border-primary/40 hover:text-text'
        "
      >
        Monthly
      </button>
    </div>

    <!-- 4 Stat Cards Grid -->
    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
      <template v-if="isLoading">
        <div
          v-for="i in 4"
          :key="i"
          class="animate-pulse bg-surface border border-border rounded-2xl p-5 flex items-center gap-4"
        >
          <div class="w-12 h-12 rounded-xl bg-bg-secondary shrink-0" />
          <div class="flex-1 space-y-2">
            <div class="h-2.5 bg-bg-secondary rounded w-1/2" />
            <div class="h-5 bg-bg-secondary rounded w-1/3" />
          </div>
        </div>
      </template>

      <template v-else>
        <!-- Messages -->
        <div class="bg-surface border border-border rounded-2xl p-5 flex items-center gap-4 transition-all hover:border-primary/30 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5">
          <div class="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-violet-500/10 text-violet-500">
            <MessageSquare :size="20" />
          </div>
          <div class="min-w-0">
            <p class="text-[0.65rem] font-bold text-text-muted uppercase tracking-wider mb-0.5 leading-none truncate">
              Messages
            </p>
            <p class="text-xl font-display font-bold text-text tabular-nums">
              {{ stats.total_messages.toLocaleString('en-US') }}
            </p>
          </div>
        </div>

        <!-- Conversations -->
        <div class="bg-surface border border-border rounded-2xl p-5 flex items-center gap-4 transition-all hover:border-primary/30 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5">
          <div class="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-blue-500/10 text-blue-500">
            <BookOpen :size="20" />
          </div>
          <div class="min-w-0">
            <p class="text-[0.65rem] font-bold text-text-muted uppercase tracking-wider mb-0.5 leading-none truncate">
              Conversations
            </p>
            <p class="text-xl font-display font-bold text-text tabular-nums">
              {{ stats.total_conversations.toLocaleString('en-US') }}
            </p>
          </div>
        </div>

        <!-- Study Days -->
        <div class="bg-surface border border-border rounded-2xl p-5 flex items-center gap-4 transition-all hover:border-primary/30 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5">
          <div class="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-emerald-500/10 text-emerald-500">
            <CalendarDays :size="20" />
          </div>
          <div class="min-w-0">
            <p class="text-[0.65rem] font-bold text-text-muted uppercase tracking-wider mb-0.5 leading-none truncate">
              Study Days
            </p>
            <p class="text-xl font-display font-bold text-text tabular-nums">
              {{ stats.study_days.toLocaleString('en-US') }}
            </p>
          </div>
        </div>

        <!-- Unique Words -->
        <div class="bg-surface border border-border rounded-2xl p-5 flex items-center gap-4 transition-all hover:border-primary/30 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5">
          <div class="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-amber-500/10 text-amber-500">
            <Type :size="20" />
          </div>
          <div class="min-w-0">
            <p class="text-[0.65rem] font-bold text-text-muted uppercase tracking-wider mb-0.5 leading-none truncate">
              Unique Words
            </p>
            <p class="text-xl font-display font-bold text-text tabular-nums">
              {{ stats.unique_words_used.toLocaleString('en-US') }}
            </p>
          </div>
        </div>
      </template>
    </div>

    <!-- 3-Column Section: Bar Chart | Study Streak | Study Club League -->
    <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <!-- 1. Bar Chart -->
      <div class="bg-surface border border-border rounded-3xl p-6 space-y-6 group hover:border-primary/30 transition-all lg:col-span-1 flex flex-col justify-between">
        <div>
          <div class="flex items-center gap-3 mb-6">
            <div class="w-1.5 h-6 bg-primary rounded-full" />
            <h3 class="text-sm font-bold text-text">
              {{ period === 'weekly' ? 'Weekly Activity' : 'Monthly Activity' }}
            </h3>
          </div>

          <div v-if="isLoading" class="h-[220px] flex items-center justify-center">
            <div class="w-full h-full bg-bg-secondary rounded-2xl animate-pulse" />
          </div>
          <div v-else-if="chartData.length > 0">
            <ActivityBarChart :data="chartData" :bar-size="period === 'monthly' ? 40 : 28" />
          </div>
          <div v-else class="h-[220px] flex items-center justify-center text-text-muted text-sm">
            No data available for this period.
          </div>
        </div>
      </div>

      <!-- 2. Study Streak Card -->
      <div class="bg-surface border border-border rounded-3xl p-6 flex flex-col justify-center gap-6 group hover:border-primary/30 transition-all">
        <div class="flex items-center gap-3">
          <div class="w-1.5 h-6 bg-orange-500 rounded-full" />
          <h3 class="text-sm font-bold text-text">Study Streak</h3>
        </div>

        <div class="flex flex-col items-center gap-2 py-4">
          <div class="relative">
            <div
              class="w-20 h-20 rounded-full flex items-center justify-center transition-all duration-300"
              :class="((streakData?.current_streak ?? xpData?.current_streak ?? 0) > 0) ? 'bg-orange-500/10 shadow-glow shadow-orange-500/20' : 'bg-muted/10'"
            >
              <img
                :src="((streakData?.current_streak ?? xpData?.current_streak ?? 0) > 0) ? '/images/streak-active.svg' : '/images/streak-inactive.svg'"
                alt="Streak"
                class="w-12 h-12 object-contain transition-transform hover:scale-110"
                :class="{ 'opacity-40 grayscale': ((streakData?.current_streak ?? xpData?.current_streak ?? 0) === 0) }"
              />
            </div>
          </div>

          <div v-if="isLoading" class="w-20 h-10 bg-bg-secondary rounded-xl animate-pulse" />
          <div v-else class="flex flex-col items-center">
            <div class="text-5xl font-black text-text leading-none tabular-nums">
              {{ streakData?.current_streak ?? xpData?.current_streak ?? 0 }}
            </div>
            <p class="text-xs font-bold text-text-subtle uppercase tracking-widest mt-1">
              consecutive days
            </p>

            <div
              v-if="freezeCount > 0"
              class="flex items-center gap-1.5 mt-3 text-xs font-bold text-cyan-500 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20"
              title="Streak Freeze Active"
            >
              <Snowflake :size="14" class="animate-pulse" />
              <span>{{ freezeCount }} Freeze Active</span>
            </div>
          </div>
        </div>

        <div class="border-t border-border pt-4 flex flex-col gap-3">
          <div class="flex items-center justify-between">
            <p class="text-[0.65rem] font-bold text-text-muted uppercase tracking-widest">
              Record
            </p>
            <div v-if="isLoading" class="w-16 h-4 bg-bg-secondary rounded animate-pulse" />
            <div v-else class="flex items-baseline gap-1">
              <span class="text-xl font-black text-primary tabular-nums">
                {{ streakData?.longest_streak ?? xpData?.longest_streak ?? 0 }}
              </span>
              <span class="text-xs font-bold text-text-muted">days</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 3. Study Club (Competition League) Card -->
      <div class="bg-surface border border-border rounded-3xl p-6 flex flex-col justify-between gap-4 group hover:border-primary/30 transition-all">
        <div class="flex items-center gap-3">
          <div class="w-1.5 h-6 bg-yellow-500 rounded-full" />
          <h3 class="text-sm font-bold text-text">Study Club (Competition League)</h3>
        </div>

        <div v-if="isLoading" class="flex-1 flex flex-col justify-center items-center py-4 space-y-3 w-full">
          <div class="h-8 bg-bg-secondary rounded-xl animate-pulse w-full" />
          <div class="h-8 bg-bg-secondary rounded-xl animate-pulse w-full" />
          <div class="h-8 bg-bg-secondary rounded-xl animate-pulse w-full" />
        </div>

        <div v-else class="flex-1 flex flex-col justify-between gap-4">
          <div>
            <div class="text-xs font-bold text-yellow-500 uppercase tracking-widest mb-3 bg-yellow-500/10 px-3 py-1.5 rounded-xl border border-yellow-500/20 inline-block">
              🏆 {{ currentLevel }} League
            </div>

            <div class="space-y-2">
              <div
                v-for="(r, i) in currentLeagueRankings.slice(0, 3)"
                :key="r.username || i"
                class="flex items-center justify-between text-xs p-2 rounded-xl border transition-all"
                :class="
                  r.username?.toLowerCase() === user?.username?.toLowerCase()
                    ? 'bg-primary/10 border-primary/20'
                    : 'bg-bg-secondary/40 border-transparent'
                "
              >
                <div class="flex items-center gap-2 min-w-0">
                  <span class="text-sm">
                    {{ ['🥇', '🥈', '🥉'][i] ?? `${i + 1}` }}
                  </span>
                  <span
                    class="font-bold truncate max-w-[120px]"
                    :class="
                      r.username?.toLowerCase() === user?.username?.toLowerCase()
                        ? 'text-primary'
                        : 'text-text'
                    "
                  >
                    {{ r.name || r.username }}
                    <span v-if="r.username?.toLowerCase() === user?.username?.toLowerCase()">(You)</span>
                  </span>
                </div>
                <span class="font-black text-text-muted shrink-0 tabular-nums">
                  {{ r.score ?? r.xp ?? 0 }} pts
                </span>
              </div>

              <p
                v-if="currentLeagueRankings.length === 0"
                class="text-xs italic text-text-muted text-center py-4"
              >
                No active students in this league yet.
              </p>
            </div>
          </div>

          <div class="border-t border-border pt-4">
            <div class="flex items-center justify-between mb-3 text-xs">
              <span class="font-bold text-text-subtle uppercase tracking-wider">Your Position:</span>
              <span v-if="myLeaguePosition" class="font-black text-primary">
                #{{ myLeaguePosition.rank }} of {{ myLeaguePosition.total }}
              </span>
              <span v-else class="text-text-muted italic">
                Not ranked
              </span>
            </div>

            <router-link to="/competitions" class="w-full block">
              <button
                type="button"
                class="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl text-xs font-bold border border-dashed border-yellow-500/40 hover:border-yellow-500 text-yellow-600 dark:text-yellow-400 hover:bg-yellow-500/5 transition-all cursor-pointer"
              >
                <Trophy :size="14" class="text-yellow-500" />
                <span>View Full Competitions</span>
              </button>
            </router-link>
          </div>
        </div>
      </div>
    </div>

    <!-- Floating Scroll-to-Top Button -->
    <button
      v-if="showScrollTop"
      type="button"
      @click="scrollToTop"
      aria-label="Voltar ao topo"
      class="fixed bottom-6 right-6 z-50 p-3.5 rounded-full bg-primary text-white shadow-xl hover:bg-primary-hover hover:scale-110 active:scale-95 transition-all duration-200 border border-primary/20 cursor-pointer"
    >
      <ArrowUp :size="20" class="stroke-[2.5]" />
    </button>
  </div>
</template>
