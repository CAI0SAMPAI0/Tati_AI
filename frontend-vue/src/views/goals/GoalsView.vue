<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  Type,
  BookOpen,
  Headphones,
  Music,
  Sparkles,
  Award,
  Gamepad2,
  MessageSquare,
  Flame,
  Clock,
  Users,
  CheckCircle2,
  Target,
  RefreshCw,
} from 'lucide-vue-next';
import { apiGet } from '@/api/client';

interface Goal {
  id: string;
  type: string;
  title?: string;
  description?: string;
  target: number;
  progress?: number;
  current?: number;
  period?: 'daily' | 'weekly';
  is_completed?: boolean;
  achieved?: boolean;
}

interface StreakData {
  current_streak: number;
  trophies_earned?: number;
}

const goals = ref<Goal[]>([]);
const streakData = ref<StreakData | null>(null);
const filterTab = ref<'todo' | 'completed' | 'all'>('todo');
const isLoading = ref(true);

const summary = computed(() => {
  const active = goals.value.filter(
    (g) => !(g.is_completed ?? g.achieved ?? ((g.progress ?? g.current ?? 0) >= g.target))
  ).length;
  const completed = goals.value.filter(
    (g) => g.is_completed ?? g.achieved ?? ((g.progress ?? g.current ?? 0) >= g.target)
  ).length;
  const streak = streakData.value?.current_streak || 0;
  return { active, completed, streak };
});

const filteredGoals = computed(() => {
  return goals.value.filter((goal) => {
    const current = goal.progress ?? goal.current ?? 0;
    const isDone = goal.is_completed ?? goal.achieved ?? (current >= goal.target);
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
    case 'vocab_practice':
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
    case 'weekly_simulations':
      return Award;
    case 'games':
      return Gamepad2;
    case 'daily_messages':
      return MessageSquare;
    case 'weekly_streak':
      return Flame;
    case 'daily_minutes':
      return Clock;
    case 'weekly_conversations':
      return Users;
    default:
      return Target;
  }
}

function getGoalTitle(goal: Goal): string {
  if (goal.title) return goal.title;
  switch (goal.type) {
    case 'grammar':
      return 'Grammar Practice';
    case 'vocabulary':
      return 'Vocabulary Expansion';
    case 'listening':
      return 'Listening & Podcasts';
    case 'reading':
      return 'Reading Comprehension';
    case 'music':
      return 'Music & Lyrics';
    case 'flashcards':
      return 'Flashcards Mastery';
    case 'simulations':
      return 'Real-World Simulations';
    case 'games':
      return 'Learning Games';
    case 'daily_messages':
      return 'Daily AI Conversation';
    case 'weekly_streak':
      return 'Weekly Consistency';
    default:
      return goal.type.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
  }
}

async function loadGoals() {
  isLoading.value = true;
  try {
    const [goalsRes, streakRes] = await Promise.allSettled([
      apiGet<any>('/users/goals'),
      apiGet<StreakData>('/users/streak'),
    ]);

    if (goalsRes.status === 'fulfilled' && goalsRes.value) {
      const data = goalsRes.value;
      if (Array.isArray(data)) goals.value = data;
      else if (Array.isArray(data.goals)) goals.value = data.goals;
      else if (Array.isArray(data.data)) goals.value = data.data;
    }

    if (streakRes.status === 'fulfilled' && streakRes.value) {
      streakData.value = streakRes.value;
    }
  } catch (err) {
    console.error('Error loading study goals:', err);
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  loadGoals();
});
</script>

<template>
  <div class="p-4 md:p-8 max-w-4xl mx-auto space-y-8 animate-fade-in">
    <!-- Hero Title -->
    <div class="flex items-center gap-3">
      <div class="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0 text-primary">
        <Target class="w-7 h-7" />
      </div>
      <div>
        <h1 class="text-2xl md:text-3xl font-display font-extrabold text-text">
          My Study Goals
        </h1>
        <p class="text-text-muted text-sm md:text-base mt-0.5">
          Track your learning objectives and activity progress automatically
        </p>
      </div>
    </div>

    <!-- Summary 3 Cards -->
    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div class="p-5 rounded-2xl bg-surface border border-border flex items-center justify-between shadow-xs">
        <div>
          <span class="text-xs font-bold text-text-subtle uppercase tracking-wider block">To Do</span>
          <p class="text-2xl font-black text-primary mt-1">{{ summary.active }}</p>
        </div>
        <div class="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <Target class="w-6 h-6" />
        </div>
      </div>

      <div class="p-5 rounded-2xl bg-surface border border-border flex items-center justify-between shadow-xs">
        <div>
          <span class="text-xs font-bold text-text-subtle uppercase tracking-wider block">Completed</span>
          <p class="text-2xl font-black text-success mt-1">{{ summary.completed }}</p>
        </div>
        <div class="w-11 h-11 rounded-xl bg-success/10 flex items-center justify-center text-success">
          <CheckCircle2 class="w-6 h-6" />
        </div>
      </div>

      <div class="p-5 rounded-2xl bg-surface border border-border flex items-center justify-between shadow-xs">
        <div>
          <span class="text-xs font-bold text-text-subtle uppercase tracking-wider block">Current Streak</span>
          <p class="text-2xl font-black text-orange-500 mt-1">{{ summary.streak }} days</p>
        </div>
        <div
          class="w-11 h-11 rounded-xl flex items-center justify-center"
          :class="summary.streak > 0 ? 'bg-orange-500/10' : 'bg-muted/10'"
        >
          <img
            :src="summary.streak > 0 ? '/images/streak-active.svg' : '/images/streak-inactive.svg'"
            alt="Streak"
            class="w-6 h-6 object-contain transition-transform hover:scale-110"
            :class="{ 'opacity-40 grayscale': summary.streak === 0 }"
          />
        </div>
      </div>
    </div>

    <!-- Filter Tabs & Section Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
      <div>
        <h2 class="text-lg font-bold text-text">Activity Goals</h2>
        <p class="text-xs text-text-muted mt-0.5">
          Completed activities, simulations and practice sessions automatically update your goals.
        </p>
      </div>

      <!-- Tab Buttons -->
      <div class="flex bg-surface border border-border p-1 rounded-xl shrink-0">
        <button
          type="button"
          @click="filterTab = 'todo'"
          class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
          :class="filterTab === 'todo' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text'"
        >
          To Do ({{ summary.active }})
        </button>
        <button
          type="button"
          @click="filterTab = 'completed'"
          class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
          :class="filterTab === 'completed' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text'"
        >
          Completed ({{ summary.completed }})
        </button>
        <button
          type="button"
          @click="filterTab = 'all'"
          class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
          :class="filterTab === 'all' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text'"
        >
          All ({{ goals.length }})
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="py-16 text-center">
      <div class="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3"></div>
      <p class="text-xs font-bold text-text-muted">Loading your goals...</p>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="filteredGoals.length === 0"
      class="p-12 text-center bg-surface border border-border rounded-3xl"
    >
      <CheckCircle2 class="w-12 h-12 text-success mx-auto mb-3 opacity-70" />
      <h3 class="font-bold text-text text-base">
        {{ filterTab === 'todo' ? 'All caught up!' : 'No goals found' }}
      </h3>
      <p class="text-xs text-text-muted mt-1">
        {{ filterTab === 'todo' ? 'You have completed all active study goals. Awesome work!' : 'No goals match the selected filter.' }}
      </p>
    </div>

    <!-- Goals Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
      <div
        v-for="goal in filteredGoals"
        :key="goal.id || goal.type"
        class="p-5 rounded-2xl bg-surface border border-border shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between"
      >
        <div class="flex items-start justify-between gap-3 mb-3">
          <div class="flex items-center gap-3">
            <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
              <component :is="getGoalIcon(goal.type)" class="w-5 h-5" />
            </div>
            <div>
              <h3 class="font-bold text-sm text-text">{{ getGoalTitle(goal) }}</h3>
              <p class="text-xs text-text-muted line-clamp-1">
                {{ goal.description || `Complete ${goal.target} items this period` }}
              </p>
            </div>
          </div>

          <span
            v-if="goal.is_completed ?? goal.achieved ?? ((goal.progress ?? goal.current ?? 0) >= goal.target)"
            class="px-2 py-0.5 rounded-full bg-success/10 text-success text-[0.65rem] font-black uppercase tracking-wider shrink-0"
          >
            Done
          </span>
          <span
            v-else
            class="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[0.65rem] font-black uppercase tracking-wider shrink-0"
          >
            In Progress
          </span>
        </div>

        <!-- Progress Bar -->
        <div class="space-y-1.5 pt-2">
          <div class="flex items-center justify-between text-xs font-semibold">
            <span class="text-text-muted">Progress</span>
            <span class="text-text">
              {{ goal.progress ?? goal.current ?? 0 }} / {{ goal.target }}
            </span>
          </div>

          <div class="w-full h-2 rounded-full bg-bg-secondary overflow-hidden">
            <div
              class="h-full rounded-full transition-all duration-500"
              :class="(goal.progress ?? goal.current ?? 0) >= goal.target ? 'bg-success' : 'bg-primary'"
              :style="{
                width: `${Math.min(100, Math.round(((goal.progress ?? goal.current ?? 0) / (goal.target || 1)) * 100))}%`,
              }"
            />
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
