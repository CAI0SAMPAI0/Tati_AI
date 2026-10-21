<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute } from 'vue-router';
import {
  Trophy,
  Zap,
  Sparkles,
  ArrowUp,
  Award,
  Crown,
  Medal,
  ChevronUp,
} from 'lucide-vue-next';
import { apiGet } from '@/api/client';
import { useAuth } from '@/composables/useAuth';
import { DEFAULT_AVATAR_URL } from '@/constants/user';
import { CEFR_LEVELS } from '@/constants/levels';

interface RankingEntry {
  username: string;
  name?: string;
  score: number;
  level?: string;
  avatar_url?: string;
}

const route = useRoute();
const { user } = useAuth();

const rankingMode = ref<'global' | 'level'>('global');
const selectedLevel = ref('A1');
const selectedCycle = ref<'current' | 'previous'>('current');
const isLoading = ref(true);

const globalRanking = ref<RankingEntry[]>([]);
const levelRankings = ref<Record<string, RankingEntry[]>>({});

const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = now.getMonth() + 1;

const prevDate = new Date(currentYear, currentMonth - 2, 1);
const prevYear = prevDate.getFullYear();
const prevMonth = prevDate.getMonth() + 1;

const MONTH_NAMES = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];

const currentMonthName = computed(() => MONTH_NAMES[currentMonth - 1] || 'Current Month');
const prevMonthName = computed(() => MONTH_NAMES[prevMonth - 1] || 'Previous Month');

const currentRanking = computed<RankingEntry[]>(() => {
  if (rankingMode.value === 'global') {
    return globalRanking.value;
  }
  return levelRankings.value[selectedLevel.value] || [];
});

const userRankIndex = computed(() => {
  if (!user.value) return -1;
  const uname = user.value.username;
  return currentRanking.value.findIndex((r) => r.username === uname);
});

async function loadRankings() {
  isLoading.value = true;
  const queryParams =
    selectedCycle.value === 'previous' ? `?year=${prevYear}&month=${prevMonth}` : '';

  try {
    const [globalRes, levelRes] = await Promise.allSettled([
      apiGet<RankingEntry[]>(`/users/progress/ranking/top15${queryParams}`),
      apiGet<Record<string, RankingEntry[]>>(`/users/progress/ranking/by-level${queryParams}`),
    ]);

    if (globalRes.status === 'fulfilled' && globalRes.value) {
      globalRanking.value = Array.isArray(globalRes.value)
        ? globalRes.value
        : (globalRes.value as any)?.data || [];
    }

    if (levelRes.status === 'fulfilled' && levelRes.value) {
      levelRankings.value = levelRes.value || {};
    }
  } catch (err) {
    console.error('Error loading rankings:', err);
  } finally {
    isLoading.value = false;
  }
}

function handleSelectCycle(cycle: 'current' | 'previous') {
  selectedCycle.value = cycle;
  loadRankings();
}

function getAvatar(url?: string | null): string {
  if (!url || url.includes('/avatar/avatar_tati')) {
    return DEFAULT_AVATAR_URL;
  }
  return url;
}

onMounted(() => {
  const cycleParam = route.query.cycle as string;
  if (cycleParam === 'previous' || cycleParam === 'prev') {
    selectedCycle.value = 'previous';
  }
  loadRankings();
});
</script>

<template>
  <div class="p-4 md:p-8 max-w-4xl w-full mx-auto space-y-8 animate-fade-in">
    <!-- Header -->
    <header class="flex flex-col md:flex-row md:items-center justify-between gap-6">
      <div>
        <h1 class="text-2xl md:text-3xl font-display font-extrabold text-text mb-2">
          Competitions & Leaderboard
        </h1>
        <p class="text-text-muted text-sm">
          See who the most engaged students are and climb the podium rankings!
        </p>
      </div>

      <!-- Mode Switcher -->
      <div class="flex bg-surface border border-border p-1 rounded-xl shadow-xs self-start md:self-auto">
        <button
          type="button"
          @click="rankingMode = 'global'"
          class="px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all"
          :class="rankingMode === 'global' ? 'bg-primary text-white shadow-glow' : 'text-text-muted hover:text-text'"
        >
          Global
        </button>
        <button
          type="button"
          @click="rankingMode = 'level'"
          class="px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all"
          :class="rankingMode === 'level' ? 'bg-primary text-white shadow-glow' : 'text-text-muted hover:text-text'"
        >
          By Level
        </button>
      </div>
    </header>

    <!-- Cycle Selector -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 bg-surface border border-border rounded-2xl shadow-xs">
      <div class="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          @click="handleSelectCycle('current')"
          class="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all"
          :class="
            selectedCycle === 'current'
              ? 'bg-primary text-white shadow-sm'
              : 'text-text-muted hover:text-text hover:bg-bg-secondary'
          "
        >
          <span
            class="w-2 h-2 rounded-full"
            :class="selectedCycle === 'current' ? 'bg-emerald-300 animate-pulse' : 'bg-text-subtle'"
          ></span>
          <span>Current Cycle ({{ currentMonthName }} {{ currentYear }})</span>
          <span
            class="text-[0.6rem] px-1.5 py-0.5 rounded font-black uppercase tracking-wider"
            :class="selectedCycle === 'current' ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'"
          >
            Live
          </span>
        </button>

        <button
          type="button"
          @click="handleSelectCycle('previous')"
          class="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all"
          :class="
            selectedCycle === 'previous'
              ? 'bg-amber-500 text-white shadow-sm'
              : 'text-text-muted hover:text-text hover:bg-bg-secondary'
          "
        >
          <span>🏆</span>
          <span>Previous Cycle ({{ prevMonthName }} {{ prevYear }})</span>
          <span
            class="text-[0.6rem] px-1.5 py-0.5 rounded font-black uppercase tracking-wider"
            :class="selectedCycle === 'previous' ? 'bg-white/20 text-white' : 'bg-amber-500/10 text-amber-600'"
          >
            Concluded
          </span>
        </button>
      </div>

      <div class="text-[0.7rem] text-text-muted px-2 font-medium">
        <span v-if="selectedCycle === 'current'">Live Ranking · Resets monthly</span>
        <span v-else>Concluded Cycle · Official Hall of Fame</span>
      </div>
    </div>

    <!-- Concluded Cycle Trophy Banner -->
    <div
      v-if="selectedCycle === 'previous'"
      class="bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/30 rounded-3xl p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-fade-in"
    >
      <div class="flex items-start md:items-center gap-4">
        <div class="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center text-2xl shrink-0 shadow-sm">
          🏆
        </div>
        <div>
          <div class="flex items-center gap-2 flex-wrap">
            <h2 class="text-base md:text-lg font-bold text-text">
              Final Official Results · {{ prevMonthName }} {{ prevYear }}
            </h2>
            <span class="px-2.5 py-0.5 rounded-full text-[0.65rem] font-black uppercase tracking-wider bg-amber-500/20 text-amber-600 border border-amber-500/30">
              Concluded
            </span>
          </div>
          <p class="text-xs md:text-sm text-text-muted mt-1 leading-relaxed">
            This competition has concluded. Below are the finalized scores and podium champions.
          </p>
        </div>
      </div>
      <button
        type="button"
        @click="handleSelectCycle('current')"
        class="px-4 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover transition-colors shadow-sm shrink-0"
      >
        View Current Live Cycle
      </button>
    </div>

    <!-- Level Filter Bar if rankingMode === 'level' -->
    <div v-if="rankingMode === 'level'" class="flex flex-wrap justify-center gap-2 animate-fade-in">
      <button
        v-for="cat in CEFR_LEVELS"
        :key="cat"
        type="button"
        @click="selectedLevel = cat"
        class="px-4 py-2 rounded-xl text-[0.68rem] font-black uppercase tracking-wider border transition-all"
        :class="
          selectedLevel === cat
            ? 'bg-primary/10 border-primary text-primary shadow-xs'
            : 'bg-surface border-border text-text-muted hover:border-primary/30'
        "
      >
        {{ cat }}
      </button>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="py-20 text-center">
      <div class="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3"></div>
      <p class="text-xs font-bold text-text-muted">Loading leaderboard...</p>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="currentRanking.length === 0"
      class="p-12 text-center bg-surface border border-border rounded-3xl"
    >
      <Trophy class="w-12 h-12 text-text-subtle mx-auto mb-3 opacity-60" />
      <h3 class="font-bold text-text text-base">No rankings recorded yet</h3>
      <p class="text-xs text-text-muted mt-1">
        Practice activities, complete quizzes, or speak in voice mode to be the first on the board!
      </p>
    </div>

    <!-- Content: Podium & Full Ranking Table -->
    <div v-else class="space-y-6">
      <!-- Top 3 Podium Box -->
      <div class="bg-surface border border-border rounded-3xl overflow-hidden shadow-xs">
        <div class="grid grid-cols-3 p-6 md:p-10 bg-gradient-to-b from-primary/10 to-transparent items-end border-b border-border">
          <!-- 2nd Place -->
          <div class="flex flex-col items-center gap-3">
            <div class="w-14 h-14 md:w-20 md:h-20 rounded-full border-4 border-slate-300 relative bg-bg-secondary overflow-hidden shadow-md">
              <img
                :src="getAvatar(currentRanking[1]?.avatar_url)"
                alt=""
                class="w-full h-full object-cover"
                @error="(e: any) => { e.currentTarget.src = DEFAULT_AVATAR_URL; }"
              />
              <div class="absolute -top-1 -right-1 w-6 h-6 md:w-7 md:h-7 rounded-full bg-slate-200 border-2 border-slate-400 flex items-center justify-center text-slate-800 font-black text-xs shadow-xs">
                2
              </div>
            </div>
            <div class="text-center min-w-0">
              <p class="text-xs font-bold text-text truncate max-w-[80px] md:max-w-none">
                {{ currentRanking[1]?.name || currentRanking[1]?.username || '—' }}
              </p>
              <p class="text-[0.65rem] font-bold text-primary">{{ currentRanking[1]?.score || 0 }} pts</p>
            </div>
          </div>

          <!-- 1st Place (Winner) -->
          <div class="flex flex-col items-center gap-4">
            <div class="w-20 h-20 md:w-28 md:h-28 rounded-full border-4 border-yellow-400 relative shadow-glow shadow-yellow-400/30 scale-110 bg-bg-secondary overflow-hidden">
              <img
                :src="getAvatar(currentRanking[0]?.avatar_url)"
                alt=""
                class="w-full h-full object-cover"
                @error="(e: any) => { e.currentTarget.src = DEFAULT_AVATAR_URL; }"
              />
              <div class="absolute -top-1 -right-1 w-7 h-7 md:w-8 md:h-8 rounded-full bg-yellow-400 border-2 border-yellow-500 flex items-center justify-center text-yellow-950 font-black text-xs shadow-xs">
                1
              </div>
            </div>
            <div class="text-center min-w-0">
              <span class="text-base md:text-xl">👑</span>
              <p class="text-sm font-black text-text truncate max-w-[100px] md:max-w-none">
                {{ currentRanking[0]?.name || currentRanking[0]?.username || '—' }}
              </p>
              <span class="text-xs font-extrabold text-yellow-500">
                {{ currentRanking[0]?.score || 0 }} pts
              </span>
            </div>
          </div>

          <!-- 3rd Place -->
          <div class="flex flex-col items-center gap-3">
            <div class="w-14 h-14 md:w-20 md:h-20 rounded-full border-4 border-amber-600/70 relative bg-bg-secondary overflow-hidden shadow-md">
              <img
                :src="getAvatar(currentRanking[2]?.avatar_url)"
                alt=""
                class="w-full h-full object-cover"
                @error="(e: any) => { e.currentTarget.src = DEFAULT_AVATAR_URL; }"
              />
              <div class="absolute -top-1 -right-1 w-6 h-6 md:w-7 md:h-7 rounded-full bg-amber-600 border-2 border-amber-700 flex items-center justify-center text-white font-black text-xs shadow-xs">
                3
              </div>
            </div>
            <div class="text-center min-w-0">
              <p class="text-xs font-bold text-text truncate max-w-[80px] md:max-w-none">
                {{ currentRanking[2]?.name || currentRanking[2]?.username || '—' }}
              </p>
              <p class="text-[0.65rem] font-bold text-primary">{{ currentRanking[2]?.score || 0 }} pts</p>
            </div>
          </div>
        </div>

        <!-- Positions 4+ Table -->
        <div class="divide-y divide-border">
          <div
            v-for="(entry, idx) in currentRanking.slice(3)"
            :key="entry.username"
            class="flex items-center justify-between p-4 px-6 hover:bg-bg-secondary/30 transition-colors"
            :class="entry.username === user?.username ? 'bg-primary/5 border-l-4 border-primary' : ''"
          >
            <div class="flex items-center gap-4 min-w-0">
              <span class="text-xs font-black text-text-subtle w-6 text-center">
                #{{ idx + 4 }}
              </span>
              <div class="w-9 h-9 rounded-full bg-primary/10 overflow-hidden shrink-0 border border-border">
                <img
                  :src="getAvatar(entry.avatar_url)"
                  alt=""
                  class="w-full h-full object-cover"
                  @error="(e: any) => { e.currentTarget.src = DEFAULT_AVATAR_URL; }"
                />
              </div>
              <div class="min-w-0">
                <p class="text-xs font-bold text-text truncate">
                  {{ entry.name || entry.username }}
                </p>
                <span class="text-[0.65rem] text-text-muted">@{{ entry.username }}</span>
              </div>
            </div>

            <div class="flex items-center gap-3 shrink-0">
              <span
                v-if="entry.level"
                class="px-2 py-0.5 rounded-md bg-bg-secondary text-[0.65rem] font-bold text-text-muted uppercase"
              >
                {{ entry.level }}
              </span>
              <span class="text-xs font-black text-primary">
                {{ entry.score }} pts
              </span>
            </div>
          </div>
        </div>
      </div>

      <!-- Current User Standing Floating Banner -->
      <div
        v-if="userRankIndex !== -1"
        class="p-4 rounded-2xl bg-surface border-2 border-primary/40 shadow-lg flex items-center justify-between"
      >
        <div class="flex items-center gap-3">
          <span class="text-lg font-black text-primary">
            #{{ userRankIndex + 1 }}
          </span>
          <div>
            <p class="text-xs font-bold text-text">Your Standing</p>
            <p class="text-[0.7rem] text-text-muted">
              You have {{ currentRanking[userRankIndex]?.score || 0 }} competition points. Keep practicing!
            </p>
          </div>
        </div>
        <div class="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold">
          🔥
        </div>
      </div>
    </div>
  </div>
</template>
