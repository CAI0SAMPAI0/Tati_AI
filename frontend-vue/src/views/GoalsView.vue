<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  Clock,
  MessageSquare,
  Users,
  Type,
  CheckCircle2,
  Flame,
  Sparkles,
  Award,
  BookOpen,
  Headphones,
  Gamepad2,
  Music,
  Target,
} from 'lucide-vue-next';
import StudentLayout from '@/components/layout/StudentLayout.vue';
import { useAuthStore } from '@/stores/auth';

interface Goal {
  id: string;
  type: string;
  title?: string;
  description?: string;
  target: number;
  progress?: number;
  current?: number;
  period: 'daily' | 'weekly';
  is_completed?: boolean;
}

const authStore = useAuthStore();
const filterTab = ref<'todo' | 'completed' | 'all'>('todo');
const isLoading = ref(true);

const goals = ref<Goal[]>([
  {
    id: '1',
    type: 'daily_messages',
    title: 'Daily AI Conversation',
    description: 'Send at least 10 messages practicing English with Teacher Tati',
    target: 10,
    progress: 7,
    period: 'daily',
  },
  {
    id: '2',
    type: 'listening',
    title: 'Listening & Podcasts',
    description: 'Listen to 1 episode or audio exercise',
    target: 1,
    progress: 1,
    period: 'daily',
    is_completed: true,
  },
  {
    id: '3',
    type: 'flashcards',
    title: 'Flashcards Mastery',
    description: 'Review 20 vocabulary cards in your deck',
    target: 20,
    progress: 15,
    period: 'weekly',
  },
  {
    id: '4',
    type: 'weekly_streak',
    title: 'Weekly Consistency',
    description: 'Keep your streak active for at least 5 days this week',
    target: 5,
    progress: 3,
    period: 'weekly',
  },
]);

const currentStreak = ref(3);

const summary = computed(() => {
  const activeCount = goals.value.filter(
    (g) => !g.is_completed && ((g.progress || g.current || 0) < g.target)
  ).length;
  const completedCount = goals.value.filter(
    (g) => g.is_completed || ((g.progress || g.current || 0) >= g.target)
  ).length;
  return {
    active: activeCount,
    completed: completedCount,
    streak: currentStreak.value,
  };
});

const filteredGoals = computed(() => {
  return goals.value.filter((g) => {
    const isDone = g.is_completed || ((g.progress || g.current || 0) >= g.target);
    if (filterTab.value === 'todo') return !isDone;
    if (filterTab.value === 'completed') return isDone;
    return true;
  });
});

function getGoalIcon(type: string) {
  switch (type) {
    case 'grammar':
      return Type;
    case 'vocabulary':
      return BookOpen;
    case 'listening':
      return Headphones;
    case 'reading':
      return BookOpen;
    case 'music':
      return Music;
    case 'flashcards':
      return Sparkles;
    case 'simulations':
      return Award;
    case 'games':
      return Gamepad2;
    case 'daily_messages':
      return MessageSquare;
    case 'weekly_streak':
      return Flame;
    case 'daily_minutes':
      return Clock;
    default:
      return Target;
  }
}

async function fetchGoals() {
  if (!authStore.token) return;
  isLoading.value = true;
  try {
    const res = await fetch('/users/goals', {
      headers: { Authorization: `Bearer ${authStore.token}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data)) {
        goals.value = data;
      } else if (data.goals && Array.isArray(data.goals)) {
        goals.value = data.goals;
      }
    }

    const resStreak = await fetch('/users/streak', {
      headers: { Authorization: `Bearer ${authStore.token}` },
    });
    if (resStreak.ok) {
      const s = await resStreak.json();
      currentStreak.value = s.current_streak || 0;
    }
  } catch (err) {
    // Non-blocking fallback
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  fetchGoals();
});
</script>

<template>
  <StudentLayout>
    <div class="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <!-- Hero -->
      <div class="flex items-center gap-3">
        <div class="w-12 h-12 rounded-2xl bg-primarySoft text-primary flex items-center justify-center shrink-0">
          <Target :size="26" />
        </div>
        <div>
          <h1 class="text-2xl md:text-3xl font-display font-bold text-ink">
            My Study Goals
          </h1>
          <p class="text-muted text-sm md:text-base">
            Track your learning objectives and activity progress automatically
          </p>
        </div>
      </div>

      <!-- Summary Cards -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <!-- To Do -->
        <div class="bg-surface border border-line rounded-2xl p-5 flex items-center gap-4 shadow-xs">
          <div class="w-12 h-12 rounded-xl bg-primarySoft text-primary flex items-center justify-center shrink-0">
            <Target :size="22" />
          </div>
          <div>
            <p class="text-xs font-semibold text-muted">To Do</p>
            <p class="text-2xl font-black text-ink mt-0.5">{{ summary.active }}</p>
          </div>
        </div>

        <!-- Completed -->
        <div class="bg-surface border border-line rounded-2xl p-5 flex items-center gap-4 shadow-xs">
          <div class="w-12 h-12 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
            <CheckCircle2 :size="22" />
          </div>
          <div>
            <p class="text-xs font-semibold text-muted">Completed</p>
            <p class="text-2xl font-black text-ink mt-0.5">{{ summary.completed }}</p>
          </div>
        </div>

        <!-- Streak -->
        <div class="bg-surface border border-line rounded-2xl p-5 flex items-center gap-4 shadow-xs">
          <div class="w-12 h-12 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <Flame :size="22" class="fill-current" />
          </div>
          <div>
            <p class="text-xs font-semibold text-muted">Active Streak</p>
            <p class="text-2xl font-black text-ink mt-0.5">{{ summary.streak }} days</p>
          </div>
        </div>
      </div>

      <!-- Filter Tabs -->
      <div class="flex items-center gap-2 border-b border-line pb-3">
        <button
          type="button"
          class="px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
          :class="
            filterTab === 'todo'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-surface border border-line text-muted hover:text-ink'
          "
          @click="filterTab = 'todo'"
        >
          To Do ({{ summary.active }})
        </button>

        <button
          type="button"
          class="px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
          :class="
            filterTab === 'completed'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-surface border border-line text-muted hover:text-ink'
          "
          @click="filterTab = 'completed'"
        >
          Completed ({{ summary.completed }})
        </button>

        <button
          type="button"
          class="px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
          :class="
            filterTab === 'all'
              ? 'bg-primary text-white shadow-xs'
              : 'bg-surface border border-line text-muted hover:text-ink'
          "
          @click="filterTab = 'all'"
        >
          All Goals ({{ goals.length }})
        </button>
      </div>

      <!-- Goals List -->
      <div class="space-y-4">
        <div
          v-if="filteredGoals.length === 0"
          class="p-8 text-center bg-surface border border-line rounded-3xl text-sm text-muted"
        >
          No goals found in this filter.
        </div>

        <div
          v-for="g in filteredGoals"
          :key="g.id"
          class="bg-surface border border-line rounded-3xl p-5 sm:p-6 transition hover:border-primary/30 shadow-xs flex flex-col gap-4"
        >
          <div class="flex items-start justify-between gap-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-primarySoft text-primary flex items-center justify-center shrink-0">
                <component :is="getGoalIcon(g.type)" :size="20" />
              </div>
              <div>
                <h3 class="text-sm sm:text-base font-bold text-ink">
                  {{ g.title || g.type }}
                </h3>
                <p class="text-xs text-muted mt-0.5">
                  {{ g.description }}
                </p>
              </div>
            </div>

            <!-- Status Pill -->
            <span
              v-if="g.is_completed || (g.progress || 0) >= g.target"
              class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 shrink-0"
            >
              <CheckCircle2 :size="13" />
              Concluído
            </span>
            <span
              v-else
              class="px-2.5 py-1 rounded-full text-xs font-bold bg-primarySoft text-primary border border-primary/20 shrink-0"
            >
              {{ g.period === 'daily' ? 'Diária' : 'Semanal' }}
            </span>
          </div>

          <!-- Progress Bar -->
          <div class="space-y-1.5 pt-1">
            <div class="flex items-center justify-between text-xs font-semibold">
              <span class="text-muted">Progresso</span>
              <span class="text-ink font-bold">
                {{ Math.min(g.target, g.progress || g.current || 0) }} / {{ g.target }}
              </span>
            </div>
            <div class="w-full h-2.5 rounded-full bg-bgSecondary overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500"
                :class="
                  (g.progress || 0) >= g.target
                    ? 'bg-emerald-500'
                    : 'bg-primary'
                "
                :style="{
                  width: `${Math.min(100, Math.round(((g.progress || g.current || 0) / g.target) * 100))}%`,
                }"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </StudentLayout>
</template>
