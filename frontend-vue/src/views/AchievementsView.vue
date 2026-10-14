<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  Trophy,
  Flame,
  Clock,
  Target,
  Sparkles,
  Medal,
  PenTool,
  BookOpen,
  MessageSquare,
  Headphones,
  BookMarked,
  Layers,
  Gamepad2,
  CheckCircle2,
} from 'lucide-vue-next';
import StudentLayout from '@/components/layout/StudentLayout.vue';
import { useAuthStore } from '@/stores/auth';

interface MedalItem {
  id: string;
  category: string;
  title: string;
  description?: string;
  unlocked: boolean;
  progress?: number;
  target?: number;
}

const authStore = useAuthStore();
const activeCategory = ref('all');
const isLoading = ref(true);

const streak = ref({
  current_streak: 3,
  longest_streak: 12,
});

const userScore = ref(740);

const medals = ref<MedalItem[]>([
  {
    id: 'm1',
    category: 'messages',
    title: 'First Words',
    description: 'Send your first message to Teacher Tati AI',
    unlocked: true,
    progress: 1,
    target: 1,
  },
  {
    id: 'm2',
    category: 'messages',
    title: 'Chat Enthusiast',
    description: 'Send 50 messages practicing conversation',
    unlocked: true,
    progress: 50,
    target: 50,
  },
  {
    id: 'm3',
    category: 'streak',
    title: 'Consistent Learner',
    description: 'Maintain a 7-day study streak',
    unlocked: false,
    progress: 3,
    target: 7,
  },
  {
    id: 'm4',
    category: 'grammar',
    title: 'Grammar Master',
    description: 'Complete 10 grammar correction activities',
    unlocked: false,
    progress: 4,
    target: 10,
  },
  {
    id: 'm5',
    category: 'vocabulary',
    title: 'Word Collector',
    description: 'Learn 100 new unique words in your vocabulary list',
    unlocked: true,
    progress: 100,
    target: 100,
  },
  {
    id: 'm6',
    category: 'listening',
    title: 'Active Listener',
    description: 'Listen to 5 podcasts or pronunciation audio lessons',
    unlocked: false,
    progress: 2,
    target: 5,
  },
]);

const categories = [
  { id: 'all', icon: Trophy, label: 'All' },
  { id: 'grammar', icon: PenTool, label: 'Grammar' },
  { id: 'vocabulary', icon: BookOpen, label: 'Vocabulary' },
  { id: 'messages', icon: MessageSquare, label: 'Messages' },
  { id: 'simulations', icon: Sparkles, label: 'Simulations' },
  { id: 'streak', icon: Flame, label: 'Streak' },
  { id: 'listening', icon: Headphones, label: 'Listening' },
  { id: 'reading', icon: BookMarked, label: 'Reading' },
  { id: 'flashcards', icon: Layers, label: 'Flashcards' },
  { id: 'games', icon: Gamepad2, label: 'Games' },
];

const categoryMap: Record<string, string[]> = {
  all: [],
  grammar: ['grammar', 'questions'],
  vocabulary: ['vocabulary', 'vocab'],
  messages: ['messages', 'message', 'msg', 'chat'],
  simulations: ['simulations', 'simulation'],
  streak: ['streak'],
  listening: ['listening', 'listen', 'podcast'],
  reading: ['reading', 'read'],
  flashcards: ['flashcards', 'flashcard'],
  games: ['games', 'game'],
};

const filteredMedals = computed(() => {
  if (activeCategory.value === 'all') return medals.value;
  const tokens = categoryMap[activeCategory.value] || [];
  return medals.value.filter((m) => {
    const cat = (m.category || '').toLowerCase();
    return tokens.some((t) => cat.includes(t));
  });
});

const trophyCount = computed(() => medals.value.filter((m) => m.unlocked).length);
const trophyProgress = computed(() => {
  if (medals.value.length === 0) return 0;
  return Math.round((trophyCount.value / medals.value.length) * 100);
});

const isStreakActive = computed(() => streak.value.current_streak > 0);

async function fetchAchievements() {
  if (!authStore.token) return;
  isLoading.value = true;
  try {
    const resStreak = await fetch('/users/streak', {
      headers: { Authorization: `Bearer ${authStore.token}` },
    });
    if (resStreak.ok) {
      const s = await resStreak.json();
      streak.value.current_streak = s.current_streak || 0;
      streak.value.longest_streak = s.longest_streak || 0;
    }

    const resMedals = await fetch('/activities/achievements/my', {
      headers: { Authorization: `Bearer ${authStore.token}` },
    });
    if (resMedals.ok) {
      const m = await resMedals.json();
      if (Array.isArray(m) && m.length > 0) {
        medals.value = m;
      }
    }
  } catch (_) {
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  fetchAchievements();
});
</script>

<template>
  <StudentLayout>
    <div class="max-w-7xl mx-auto space-y-8 animate-fade-in">
      <!-- Header -->
      <header>
        <h1 class="text-2xl md:text-3xl font-display font-bold text-ink mb-1">
          My Achievements
        </h1>
        <p class="text-muted text-sm">
          Milestones achieved in your learning journey with Teacher Tati.
        </p>
      </header>

      <!-- Top Summary: Streak + Trophy Cards -->
      <div class="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <!-- Streak Status Card -->
        <div class="bg-surface border border-line rounded-3xl p-6 flex flex-col md:flex-row items-center gap-8 group hover:border-primary/30 transition shadow-xs">
          <div class="relative group">
            <div
              class="w-24 h-24 rounded-full flex items-center justify-center transition-all duration-300"
              :class="isStreakActive ? 'bg-amber-500/10' : 'bg-bgSecondary'"
            >
              <img
                :src="isStreakActive ? '/images/streak-active.svg' : '/images/streak-inactive.svg'"
                alt="Streak Status"
                class="w-14 h-14 object-contain transition-transform group-hover:scale-110"
                :class="{ 'opacity-40 grayscale': !isStreakActive }"
              />
            </div>
            <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-surface border border-line rounded-full text-[0.6rem] font-black text-muted uppercase tracking-widest whitespace-nowrap">
              {{ isStreakActive ? 'Active' : 'Inactive' }}
            </div>
          </div>

          <div class="flex-1 text-center md:text-left">
            <div class="text-5xl font-black text-ink leading-none mb-1 tabular-nums">
              {{ streak.current_streak }}
            </div>
            <p class="text-xs font-bold text-muted uppercase tracking-widest">
              days streak
            </p>
            <div class="grid grid-cols-2 gap-4 mt-6">
              <div>
                <p class="text-[0.6rem] font-bold text-muted uppercase">Longest streak</p>
                <p class="text-sm font-bold text-ink">{{ streak.longest_streak }} days</p>
              </div>
              <div>
                <p class="text-[0.6rem] font-bold text-muted uppercase">Score</p>
                <p class="text-sm font-bold text-ink">{{ userScore.toLocaleString('pt-BR') }} pts</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Trophy Progress Card -->
        <div class="bg-surface border border-line rounded-3xl p-6 space-y-6 group hover:border-primary/30 transition shadow-xs">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-bold uppercase tracking-widest text-muted">
              Trophy Progress
            </h3>
            <div class="flex items-baseline gap-1">
              <span class="text-2xl font-black text-primary">{{ trophyCount }}</span>
              <span class="text-xs font-bold text-muted">/{{ medals.length }}</span>
            </div>
          </div>

          <!-- Progress Bar -->
          <div class="space-y-2">
            <div class="w-full h-3 bg-bgSecondary border border-line rounded-full overflow-hidden p-0.5">
              <div
                class="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-1000"
                :style="{ width: `${trophyProgress}%` }"
              />
            </div>
          </div>

          <!-- Tier Medals Milestone Icons -->
          <div class="flex gap-2">
            <div
              v-for="i in [1, 2, 3, 4]"
              :key="i"
              class="flex-1 h-8 rounded-lg flex items-center justify-center border transition-all"
              :class="
                trophyCount >= i * 3
                  ? 'bg-primarySoft border-primary/30 text-primary'
                  : 'bg-bgSecondary border-line text-muted opacity-40 grayscale'
              "
            >
              <Medal :size="16" />
            </div>
          </div>
        </div>
      </div>

      <!-- Categories Filter Tabs -->
      <div class="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          v-for="cat in categories"
          :key="cat.id"
          type="button"
          class="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer"
          :class="
            activeCategory === cat.id
              ? 'bg-primary text-white shadow-xs'
              : 'bg-surface border border-line text-muted hover:text-ink hover:border-primary/30'
          "
          @click="activeCategory = cat.id"
        >
          <component :is="cat.icon" :size="14" />
          <span>{{ cat.label }}</span>
        </button>
      </div>

      <!-- Medals Grid -->
      <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div
          v-for="m in filteredMedals"
          :key="m.id"
          class="bg-surface border rounded-3xl p-5 transition flex flex-col justify-between gap-4 shadow-xs"
          :class="m.unlocked ? 'border-primary/30 shadow-primary/5' : 'border-line opacity-75'"
        >
          <div class="flex items-start gap-3.5">
            <div
              class="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
              :class="
                m.unlocked
                  ? 'bg-amber-500/10 text-amber-500 border border-amber-500/30'
                  : 'bg-bgSecondary text-muted'
              "
            >
              <Trophy v-if="m.unlocked" :size="22" class="fill-current" />
              <Medal v-else :size="22" />
            </div>

            <div class="space-y-1">
              <h4 class="text-sm font-bold text-ink flex items-center gap-1.5">
                {{ m.title }}
                <CheckCircle2 v-if="m.unlocked" :size="14" class="text-emerald-500" />
              </h4>
              <p class="text-xs text-muted leading-relaxed">
                {{ m.description }}
              </p>
            </div>
          </div>

          <!-- Progress bar if not completed -->
          <div v-if="m.target && m.target > 1" class="space-y-1 pt-1">
            <div class="flex justify-between text-[11px] font-semibold text-muted">
              <span>{{ m.unlocked ? 'Desbloqueado' : 'Em andamento' }}</span>
              <span>{{ m.progress || 0 }} / {{ m.target }}</span>
            </div>
            <div class="w-full h-1.5 rounded-full bg-bgSecondary overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500"
                :class="m.unlocked ? 'bg-emerald-500' : 'bg-primary'"
                :style="{ width: `${Math.min(100, Math.round(((m.progress || 0) / m.target) * 100))}%` }"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  </StudentLayout>
</template>
