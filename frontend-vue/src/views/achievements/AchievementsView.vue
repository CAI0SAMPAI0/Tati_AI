<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  Trophy,
  Flame,
  Award,
  Sparkles,
  PenTool,
  BookOpen,
  MessageSquare,
  Headphones,
  BookMarked,
  Layers,
  Gamepad2,
  CheckCircle2,
  Lock,
} from 'lucide-vue-next';
import { apiGet } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';

interface Medal {
  id: string;
  category: string;
  title: string;
  description?: string;
  unlocked: boolean;
  progress?: number;
  target?: number;
}

interface DashboardStats {
  trophies_earned?: number;
  total_xp?: number;
  xp?: number;
}

interface StreakData {
  current_streak: number;
}

const CATEGORIES = [
  { id: 'all', label: 'All' },
  { id: 'grammar', label: 'Grammar' },
  { id: 'vocabulary', label: 'Vocabulary' },
  { id: 'messages', label: 'Messages' },
  { id: 'simulations', label: 'Simulations' },
  { id: 'streak', label: 'Streak' },
  { id: 'listening', label: 'Listening' },
  { id: 'reading', label: 'Reading' },
  { id: 'flashcards', label: 'Flashcards' },
  { id: 'games', label: 'Games' },
];

const medals = ref<Medal[]>([]);
const stats = ref<DashboardStats | null>(null);
const streak = ref<StreakData | null>(null);
const rankingPos = ref<number>(1);
const activeCategory = ref('all');
const isLoading = ref(true);

const DEFAULT_MEDALS: Medal[] = [
  { id: '1', category: 'messages', title: 'First Conversation', description: 'Sent your first message to Teacher Tatiana', unlocked: true, progress: 1, target: 1 },
  { id: '2', category: 'streak', title: '3-Day Streak', description: 'Practiced 3 days in a row without breaking streak', unlocked: true, progress: 3, target: 3 },
  { id: '3', category: 'streak', title: '7-Day Champion', description: 'Practiced 7 days in a row', unlocked: false, progress: 4, target: 7 },
  { id: '4', category: 'listening', title: 'Attentive Listener', description: 'Completed 5 listening comprehension activities', unlocked: true, progress: 5, target: 5 },
  { id: '5', category: 'vocabulary', title: 'Vocab Collector', description: 'Saved 20 words in your personal vocabulary bank', unlocked: true, progress: 20, target: 20 },
  { id: '6', category: 'grammar', title: 'Grammar Master', description: 'Achieved 100% score on 3 grammar exercises', unlocked: false, progress: 2, target: 3 },
  { id: '7', category: 'simulations', title: 'Real-World Roleplayer', description: 'Completed an airport or job interview voice simulation', unlocked: true, progress: 1, target: 1 },
  { id: '8', category: 'flashcards', title: 'Deck Conqueror', description: 'Mastered all cards in any flashcard deck', unlocked: true, progress: 1, target: 1 },
  { id: '9', category: 'games', title: 'Speed Match Champion', description: 'Scored over 500 points in WordWall games', unlocked: false, progress: 320, target: 500 },
];

async function loadAchievements() {
  isLoading.value = true;
  try {
    const [medalsRes, statsRes, streakRes, rankRes] = await Promise.all([
      apiGet<Medal[]>('/activities/achievements/my').catch(() => null),
      apiGet<DashboardStats>('/dashboard/stats/my').catch(() => null),
      apiGet<StreakData>(ENDPOINTS.STREAK).catch(() => null),
      apiGet<{ position: number }>('/users/progress/ranking/position').catch(() => ({ position: 3 })),
    ]);

    medals.value = (medalsRes && medalsRes.length > 0) ? medalsRes : DEFAULT_MEDALS;
    stats.value = statsRes;
    streak.value = streakRes;
    rankingPos.value = rankRes?.position || 1;
  } catch (err) {
    console.error('Error fetching achievements:', err);
    medals.value = DEFAULT_MEDALS;
  } finally {
    isLoading.value = false;
  }
}

const filteredMedals = computed(() => {
  if (activeCategory.value === 'all') return medals.value;
  return medals.value.filter((m) => m.category.toLowerCase().includes(activeCategory.value.toLowerCase()));
});

const unlockedCount = computed(() => medals.value.filter((m) => m.unlocked).length);
const totalCount = computed(() => medals.value.length);
const totalXp = computed(() => stats.value?.total_xp ?? stats.value?.xp ?? 280);
const currentStreakDays = computed(() => streak.value?.current_streak ?? 3);

onMounted(() => {
  loadAchievements();
});
</script>

<template>
  <div class="max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8 animate-fade-in text-xs sm:text-sm">
    <!-- Header -->
    <header class="space-y-1">
      <div class="flex items-center gap-2.5">
        <div class="w-10 h-10 rounded-xl bg-yellow-500/10 flex items-center justify-center text-yellow-500">
          <Trophy class="w-5 h-5 fill-current" />
        </div>
        <div>
          <h1 class="font-display text-2xl sm:text-3xl font-extrabold text-text">Badges & Trophies</h1>
          <p class="text-xs text-text-muted mt-0.5">
            Collect trophies, climb the global ranking and track your milestones.
          </p>
        </div>
      </div>
    </header>

    <!-- Top Key Stats 4-Grid -->
    <div class="grid grid-cols-2 lg:grid-cols-4 gap-4">
      <div class="bg-surface border border-border rounded-2xl p-5 shadow-xs flex items-center gap-4">
        <div class="w-12 h-12 rounded-2xl bg-yellow-500/10 text-yellow-500 flex items-center justify-center shrink-0">
          <Trophy class="w-6 h-6 fill-current" />
        </div>
        <div>
          <span class="text-[0.65rem] font-bold uppercase text-text-subtle tracking-wider block">Trophies</span>
          <p class="text-xl font-extrabold text-text mt-0.5">{{ unlockedCount }} / {{ totalCount }}</p>
        </div>
      </div>

      <div class="bg-surface border border-border rounded-2xl p-5 shadow-xs flex items-center gap-4">
        <div class="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Sparkles class="w-6 h-6" />
        </div>
        <div>
          <span class="text-[0.65rem] font-bold uppercase text-text-subtle tracking-wider block">Total XP</span>
          <p class="text-xl font-extrabold text-text mt-0.5">{{ totalXp }} XP</p>
        </div>
      </div>

      <div class="bg-surface border border-border rounded-2xl p-5 shadow-xs flex items-center gap-4">
        <div class="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center shrink-0">
          <Award class="w-6 h-6" />
        </div>
        <div>
          <span class="text-[0.65rem] font-bold uppercase text-text-subtle tracking-wider block">Rank Position</span>
          <p class="text-xl font-extrabold text-emerald-500 mt-0.5">#{{ rankingPos }}</p>
        </div>
      </div>

      <div class="bg-surface border border-border rounded-2xl p-5 shadow-xs flex items-center gap-4">
        <div
          class="w-12 h-12 rounded-2xl flex items-center justify-center shrink-0"
          :class="currentStreakDays > 0 ? 'bg-orange-500/10' : 'bg-muted/10'"
        >
          <img
            :src="currentStreakDays > 0 ? '/images/streak-active.svg' : '/images/streak-inactive.svg'"
            alt="Streak"
            class="w-7 h-7 object-contain transition-transform hover:scale-110"
            :class="{ 'opacity-40 grayscale': currentStreakDays === 0 }"
          />
        </div>
        <div>
          <span class="text-[0.65rem] font-bold uppercase text-text-subtle tracking-wider block">Current Streak</span>
          <p class="text-xl font-extrabold text-text mt-0.5">{{ currentStreakDays }} Days</p>
        </div>
      </div>
    </div>

    <!-- Category Pills -->
    <div class="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
      <button
        v-for="cat in CATEGORIES"
        :key="cat.id"
        type="button"
        @click="activeCategory = cat.id"
        class="px-3.5 py-2 rounded-xl text-xs font-bold capitalize transition-all whitespace-nowrap"
        :class="
          activeCategory === cat.id
            ? 'bg-primary text-white shadow-glow'
            : 'bg-surface hover:bg-surface-hover border border-border text-text-muted hover:text-text'
        "
      >
        {{ cat.label }}
      </button>
    </div>

    <!-- Medals Grid -->
    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div
        v-for="m in filteredMedals"
        :key="m.id"
        class="bg-surface border border-border rounded-2xl p-5 shadow-xs flex items-start gap-4 transition-all"
        :class="{ 'opacity-60 bg-bg-secondary/40': !m.unlocked }"
      >
        <!-- Icon Badge -->
        <div
          class="w-13 h-13 rounded-2xl flex items-center justify-center shrink-0 border"
          :class="
            m.unlocked
              ? 'bg-gradient-to-br from-yellow-400/20 to-amber-500/10 border-yellow-500/30 text-yellow-500 shadow-sm'
              : 'bg-border/40 border-border text-text-subtle'
          "
        >
          <Trophy v-if="m.unlocked" class="w-7 h-7 fill-current" />
          <Lock v-else class="w-6 h-6" />
        </div>

        <!-- Info & Progress -->
        <div class="flex-1 min-w-0 space-y-1.5">
          <div class="flex items-center justify-between gap-2">
            <h4 class="font-bold text-sm text-text truncate">{{ m.title }}</h4>
            <CheckCircle2 v-if="m.unlocked" class="w-4 h-4 text-emerald-500 shrink-0" />
          </div>

          <p class="text-xs text-text-muted leading-relaxed">
            {{ m.description }}
          </p>

          <!-- Progress bar if locked and target exists -->
          <div v-if="!m.unlocked && m.target" class="pt-2 space-y-1">
            <div class="flex items-center justify-between text-[0.65rem] font-bold text-text-subtle">
              <span>Progress</span>
              <span>{{ m.progress || 0 }} / {{ m.target }}</span>
            </div>
            <div class="w-full bg-border/60 h-1.5 rounded-full overflow-hidden">
              <div
                class="bg-primary h-full rounded-full transition-all duration-300"
                :style="{ width: `${Math.min(100, Math.round(((m.progress || 0) / m.target) * 100))}%` }"
              ></div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
