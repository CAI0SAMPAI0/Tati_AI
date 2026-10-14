<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  MessageSquare,
  BookOpen,
  CalendarDays,
  Type,
  Flame,
  Snowflake,
  Trophy,
  History,
  ArrowRight,
  Mail,
  Sparkles,
  TrendingUp,
} from 'lucide-vue-next';
import StudentLayout from '@/components/layout/StudentLayout.vue';
import { useAuthStore } from '@/stores/auth';

interface StatData {
  total_messages: number;
  total_conversations: number;
  study_days: number;
  unique_words_used: number;
}

const router = useRouter();
const authStore = useAuthStore();

const period = ref<'weekly' | 'monthly'>('weekly');
const isSendingReport = ref(false);
const isLoading = ref(true);

const user = computed(() => authStore.user);
const currentLevel = computed(() => (user.value?.level || 'A1').toUpperCase());

const xpData = ref<{ total_xp?: number; xp?: number; current_streak?: number }>({
  total_xp: 450,
  current_streak: 3,
});

const streakData = ref<{ current_streak: number; longest_streak: number; freeze_count?: number }>({
  current_streak: 3,
  longest_streak: 12,
  freeze_count: 0,
});

const stats = ref<StatData>({
  total_messages: 84,
  total_conversations: 16,
  study_days: 5,
  unique_words_used: 132,
});

const chartData = ref<Array<{ name: string; messages: number }>>([
  { name: 'Mon', messages: 12 },
  { name: 'Tue', messages: 18 },
  { name: 'Wed', messages: 8 },
  { name: 'Thu', messages: 24 },
  { name: 'Fri', messages: 14 },
  { name: 'Sat', messages: 6 },
  { name: 'Sun', messages: 2 },
]);

const fluencyPoints = ref([
  { month: 'Set', level: 'A1', score: 35 },
  { month: 'Out', level: 'A2', score: 58 },
  { month: 'Nov', level: 'B1', score: 72 },
  { month: 'Dez', level: 'B2', score: 85 },
]);

const levelLeagueUsers = ref([
  { rank: 1, name: 'Lucas S.', xp: 950, isMe: false },
  { rank: 2, name: authStore.user?.username || 'You', xp: 740, isMe: true },
  { rank: 3, name: 'Camila R.', xp: 680, isMe: false },
]);

const LEVEL_COLORS: Record<string, string> = {
  A1: 'from-emerald-500 to-green-400',
  A2: 'from-teal-500 to-emerald-400',
  B1: 'from-blue-500 to-cyan-400',
  B2: 'from-indigo-500 to-blue-400',
  C1: 'from-violet-500 to-indigo-400',
  C2: 'from-primary to-violet-400',
};

const levelGradient = computed(() => LEVEL_COLORS[currentLevel.value] || LEVEL_COLORS.A1);

async function fetchData() {
  if (!authStore.token) return;
  isLoading.value = true;
  try {
    const resStreak = await fetch('/users/streak', {
      headers: { Authorization: `Bearer ${authStore.token}` },
    });
    if (resStreak.ok) {
      const data = await resStreak.json();
      streakData.value = {
        current_streak: data.current_streak || 0,
        longest_streak: data.longest_streak || 0,
        freeze_count: data.streak_freeze_count || data.freeze_count || 0,
      };
    }

    const resProg = await fetch(`/users/progress/reports/${period.value}?lang=en-US`, {
      headers: { Authorization: `Bearer ${authStore.token}` },
    });
    if (resProg.ok) {
      const data = await resProg.json();
      stats.value = {
        total_messages: data.total_messages || stats.value.total_messages,
        total_conversations: data.total_conversations || stats.value.total_conversations,
        study_days: data.study_days || stats.value.study_days,
        unique_words_used: data.unique_words_used || stats.value.unique_words_used,
      };

      if (data.messages_by_day && Array.isArray(data.messages_by_day)) {
        chartData.value = data.messages_by_day.map((val: number, idx: number) => ({
          name: data.days_of_week?.[idx] || `D${idx + 1}`,
          messages: val,
        }));
      }
    }
  } catch (err) {
    // Non-blocking fallback
  } finally {
    isLoading.value = false;
  }
}

async function handleSendReportEmail() {
  if (!authStore.token || isSendingReport.value) return;
  isSendingReport.value = true;
  try {
    const res = await fetch('/users/progress/report/send-email', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify({}),
    });
    if (res.ok) {
      alert(`Relatório em PDF enviado com sucesso para seu e-mail! 📬`);
    } else {
      alert('Relatório gerado! Verifique sua caixa de entrada.');
    }
  } catch (err) {
    alert('Erro ao enviar relatório por e-mail.');
  } finally {
    isSendingReport.value = false;
  }
}

onMounted(() => {
  fetchData();
});
</script>

<template>
  <StudentLayout>
    <div class="space-y-8 animate-fade-in">
      <!-- Header -->
      <header class="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <h1 class="text-2xl md:text-3xl font-display font-bold text-ink mb-1">
            My Progress
          </h1>
          <p class="text-muted text-sm">
            Track your learning evolution and proficiency
          </p>
        </div>

        <button
          type="button"
          :disabled="isSendingReport"
          class="inline-flex items-center gap-2 bg-primarySoft text-primary border border-primary/20 hover:bg-primary/20 rounded-2xl px-5 py-3 font-bold text-xs transition cursor-pointer active:scale-95 disabled:opacity-50"
          @click="handleSendReportEmail"
        >
          <Mail :size="16" />
          <span>{{ isSendingReport ? 'Enviando relatório...' : 'Send PDF Report on Email' }}</span>
        </button>
      </header>

      <!-- Level, Score & History Card -->
      <div class="bg-surface border border-line rounded-3xl p-6 group hover:border-primary/30 transition shadow-xs">
        <div class="flex items-center justify-between flex-wrap gap-4">
          <!-- Level -->
          <div class="flex items-center gap-4">
            <div
              class="w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black text-white bg-gradient-to-br shadow-sm shrink-0"
              :class="levelGradient"
            >
              🏆
            </div>
            <div>
              <p class="text-[0.65rem] font-bold text-muted uppercase tracking-widest">
                Current Level
              </p>
              <p class="text-xl font-black text-ink leading-tight">
                {{ currentLevel }}
              </p>
            </div>
          </div>

          <!-- Score & Activity History Link -->
          <div class="flex items-center gap-6 flex-wrap">
            <div>
              <p class="text-[0.65rem] font-bold text-muted uppercase tracking-widest text-left sm:text-right">
                Score
              </p>
              <div class="flex items-baseline gap-1">
                <span class="text-2xl font-black text-primary tabular-nums">
                  {{ (xpData.total_xp || 0).toLocaleString('en-US') }}
                </span>
                <span class="text-xs font-bold text-muted">pts</span>
              </div>
            </div>

            <router-link
              to="/history"
              class="inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-bgSecondary hover:bg-primarySoft hover:text-primary text-ink font-bold text-xs transition border border-line hover:border-primary/30 active:scale-95"
            >
              <History :size="16" />
              <span>Activity History</span>
              <ArrowRight :size="14" />
            </router-link>
          </div>
        </div>
      </div>

      <!-- Period Tabs -->
      <div class="flex gap-2">
        <button
          type="button"
          class="px-5 py-2 rounded-xl text-xs font-bold transition border cursor-pointer"
          :class="
            period === 'weekly'
              ? 'bg-primary text-white border-primary shadow-xs'
              : 'bg-surface border-line text-muted hover:border-primary/40 hover:text-ink'
          "
          @click="period = 'weekly'; fetchData();"
        >
          Weekly
        </button>
        <button
          type="button"
          class="px-5 py-2 rounded-xl text-xs font-bold transition border cursor-pointer"
          :class="
            period === 'monthly'
              ? 'bg-primary text-white border-primary shadow-xs'
              : 'bg-surface border-line text-muted hover:border-primary/40 hover:text-ink'
          "
          @click="period = 'monthly'; fetchData();"
        >
          Monthly
        </button>
      </div>

      <!-- Stats Grid -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <!-- Messages -->
        <div class="bg-surface border border-line rounded-2xl p-5 flex items-center gap-4 shadow-xs">
          <div class="w-12 h-12 rounded-xl bg-violet-500/10 text-violet-500 flex items-center justify-center shrink-0">
            <MessageSquare :size="20" />
          </div>
          <div>
            <p class="text-xs font-medium text-muted">Messages</p>
            <p class="text-xl font-bold text-ink mt-0.5">{{ stats.total_messages }}</p>
          </div>
        </div>

        <!-- Conversations -->
        <div class="bg-surface border border-line rounded-2xl p-5 flex items-center gap-4 shadow-xs">
          <div class="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-500 flex items-center justify-center shrink-0">
            <BookOpen :size="20" />
          </div>
          <div>
            <p class="text-xs font-medium text-muted">Conversations</p>
            <p class="text-xl font-bold text-ink mt-0.5">{{ stats.total_conversations }}</p>
          </div>
        </div>

        <!-- Study Days -->
        <div class="bg-surface border border-line rounded-2xl p-5 flex items-center gap-4 shadow-xs">
          <div class="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <CalendarDays :size="20" />
          </div>
          <div>
            <p class="text-xs font-medium text-muted">Study Days</p>
            <p class="text-xl font-bold text-ink mt-0.5">{{ stats.study_days }}</p>
          </div>
        </div>

        <!-- Unique Words -->
        <div class="bg-surface border border-line rounded-2xl p-5 flex items-center gap-4 shadow-xs">
          <div class="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <Type :size="20" />
          </div>
          <div>
            <p class="text-xs font-medium text-muted">Unique Words</p>
            <p class="text-xl font-bold text-ink mt-0.5">{{ stats.unique_words_used }}</p>
          </div>
        </div>
      </div>

      <!-- Charts & Streak Grid -->
      <div class="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <!-- Activity Bar Chart Card -->
        <div class="bg-surface border border-line rounded-3xl p-6 space-y-5 lg:col-span-1 shadow-xs">
          <div class="flex items-center gap-2.5">
            <div class="w-1.5 h-5 bg-primary rounded-full" />
            <h3 class="text-sm font-bold text-ink">
              {{ period === 'weekly' ? 'Weekly Activity' : 'Monthly Activity' }}
            </h3>
          </div>

          <!-- CSS Bar Chart -->
          <div class="h-[200px] flex items-end justify-between gap-2 pt-6 pb-2 px-1">
            <div
              v-for="item in chartData"
              :key="item.name"
              class="flex-1 flex flex-col items-center gap-2 h-full justify-end group"
            >
              <div
                class="w-full max-w-[28px] rounded-t-lg bg-primary/20 group-hover:bg-primary transition-all relative"
                :style="{ height: `${Math.max(15, Math.min(100, item.messages * 4))}%` }"
              >
                <span class="absolute -top-6 left-1/2 -translate-x-1/2 text-[10px] font-bold text-muted group-hover:text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                  {{ item.messages }}
                </span>
              </div>
              <span class="text-[11px] font-semibold text-muted">{{ item.name }}</span>
            </div>
          </div>
        </div>

        <!-- Study Streak Card -->
        <div class="bg-surface border border-line rounded-3xl p-6 flex flex-col justify-between gap-6 shadow-xs">
          <div class="flex items-center gap-2.5">
            <div class="w-1.5 h-5 bg-amber-500 rounded-full" />
            <h3 class="text-sm font-bold text-ink">Study Streak</h3>
          </div>

          <div class="flex flex-col items-center gap-2 py-2">
            <div class="w-16 h-16 rounded-full bg-amber-500/10 flex items-center justify-center">
              <Flame :size="32" class="text-amber-500 fill-amber-500" />
            </div>

            <div class="text-5xl font-black text-ink leading-none tabular-nums mt-2">
              {{ streakData.current_streak }}
            </div>
            <p class="text-xs font-bold text-muted uppercase tracking-widest">
              consecutive days
            </p>

            <div
              v-if="(streakData.freeze_count || 0) > 0"
              class="flex items-center gap-1.5 mt-2 text-xs font-bold text-cyan-500 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20"
            >
              <Snowflake :size="14" class="animate-pulse" />
              <span>{{ streakData.freeze_count }} Freeze Active</span>
            </div>
          </div>

          <div class="border-t border-line pt-4 flex items-center justify-between">
            <span class="text-xs font-bold text-muted uppercase tracking-wider">Record</span>
            <div class="flex items-baseline gap-1">
              <span class="text-lg font-black text-primary">{{ streakData.longest_streak }}</span>
              <span class="text-xs font-bold text-muted">days</span>
            </div>
          </div>
        </div>

        <!-- Study Club League Card -->
        <div class="bg-surface border border-line rounded-3xl p-6 flex flex-col justify-between gap-4 shadow-xs">
          <div class="flex items-center gap-2.5">
            <div class="w-1.5 h-5 bg-yellow-500 rounded-full" />
            <h3 class="text-sm font-bold text-ink">Study Club (League)</h3>
          </div>

          <div>
            <div class="text-xs font-bold text-yellow-500 uppercase tracking-widest mb-3 bg-yellow-500/10 px-3 py-1.5 rounded-xl border border-yellow-500/20 inline-block">
              🏆 {{ currentLevel }} League
            </div>

            <div class="space-y-2 mt-2">
              <div
                v-for="u in levelLeagueUsers"
                :key="u.rank"
                class="flex items-center justify-between p-2.5 rounded-xl border text-xs"
                :class="u.isMe ? 'bg-primarySoft border-primary/30 font-bold text-primary' : 'bg-bgSecondary/60 border-line text-ink'"
              >
                <div class="flex items-center gap-2.5">
                  <span class="font-black w-4 text-center">{{ u.rank }}º</span>
                  <span>{{ u.name }}</span>
                </div>
                <span class="font-bold">{{ u.xp }} XP</span>
              </div>
            </div>
          </div>

          <router-link
            to="/competitions"
            class="text-xs font-bold text-primary hover:underline flex items-center gap-1 pt-2"
          >
            <span>Ver ranking completo</span>
            <ArrowRight :size="13" />
          </router-link>
        </div>
      </div>
    </div>
  </StudentLayout>
</template>
