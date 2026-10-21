<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  CheckCircle2,
  Search,
  Calendar,
  Award,
  ExternalLink,
  RotateCcw,
  BookOpen,
  Layers,
  Podcast,
  Drama,
  Gamepad2,
  Newspaper,
  TrendingUp,
  History as HistoryIcon,
  Sparkles,
} from 'lucide-vue-next';
import { apiGet } from '@/api/client';
import { getExamHistory } from '@/api/exams';
import type { ExamHistoryItem } from '@/api/types';

interface ActivitySubmission {
  id: string;
  activity_id: string;
  activity_type: string;
  score: number;
  status: string;
  completed_at?: string;
  created_at?: string;
  metadata?: any;
}

const CATEGORY_CONFIG: Record<
  string,
  { label: string; icon: any; color: string; bg: string; border: string }
> = {
  grammar: { label: 'Grammar', icon: BookOpen, color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
  vocabulary: { label: 'Vocabulary', icon: Layers, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  flashcards: { label: 'Flashcards', icon: Layers, color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/20' },
  listening: { label: 'Listening', icon: Podcast, color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/20' },
  reading: { label: 'Reading', icon: BookOpen, color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  simulations: { label: 'Simulations', icon: Drama, color: 'text-rose-500', bg: 'bg-rose-500/10', border: 'border-rose-500/20' },
  games: { label: 'Games', icon: Gamepad2, color: 'text-indigo-500', bg: 'bg-indigo-500/10', border: 'border-indigo-500/20' },
  news: { label: 'News', icon: Newspaper, color: 'text-teal-500', bg: 'bg-teal-500/10', border: 'border-teal-500/20' },
  exams: { label: 'Exams', icon: Award, color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/20' },
};

const router = useRouter();
const submissions = ref<ActivitySubmission[]>([]);
const examHistory = ref<ExamHistoryItem[]>([]);
const isLoading = ref(true);

const searchQuery = ref('');
const activeCategory = ref('all');

async function loadData() {
  isLoading.value = true;
  try {
    const [subRes, examRes] = await Promise.all([
      apiGet<ActivitySubmission[]>('/activities/submissions').catch(() => []),
      getExamHistory().catch(() => []),
    ]);
    submissions.value = subRes || [];
    examHistory.value = examRes || [];
  } catch (err) {
    console.error('Error loading history:', err);
  } finally {
    isLoading.value = false;
  }
}

const allHistoryItems = computed(() => {
  const list: any[] = [];

  submissions.value.forEach((s) => {
    list.push({
      id: s.id,
      title: s.metadata?.title || `${s.activity_type} Practice`,
      type: s.activity_type || 'activity',
      score: s.score ?? 100,
      date: s.completed_at || s.created_at,
      url: s.metadata?.url || `/activities`,
    });
  });

  examHistory.value.forEach((e) => {
    list.push({
      id: e.id,
      title: `Trimestral Exam (Level ${e.level})`,
      type: 'exams',
      score: e.score,
      date: e.completed_at,
      url: `/exams`,
    });
  });

  return list.sort((a, b) => {
    const da = a.date ? new Date(a.date).getTime() : 0;
    const db = b.date ? new Date(b.date).getTime() : 0;
    return db - da;
  });
});

const filteredItems = computed(() => {
  return allHistoryItems.value.filter((item) => {
    const matchCat =
      activeCategory.value === 'all' ||
      item.type.toLowerCase().includes(activeCategory.value.toLowerCase());
    const matchQ =
      !searchQuery.value.trim() ||
      item.title.toLowerCase().includes(searchQuery.value.toLowerCase());
    return matchCat && matchQ;
  });
});

const stats = computed(() => {
  const items = allHistoryItems.value;
  const total = items.length;
  const perfect = items.filter((i) => i.score === 100).length;
  const avg = total > 0 ? Math.round(items.reduce((acc, i) => acc + (i.score || 0), 0) / total) : 0;
  return { total, perfect, avg };
});

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8 animate-fade-in text-xs sm:text-sm">
    <!-- Header -->
    <header class="space-y-1">
      <div class="flex items-center gap-2.5">
        <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <HistoryIcon class="w-5 h-5" />
        </div>
        <div>
          <h1 class="font-display text-2xl sm:text-3xl font-extrabold text-text">Activity & Exam History</h1>
          <p class="text-xs text-text-muted mt-0.5">
            Track all completed exercises, flashcards, simulations, and trimestral exams.
          </p>
        </div>
      </div>
    </header>

    <!-- Stats Bar -->
    <div class="grid grid-cols-3 gap-3">
      <div class="bg-surface border border-border rounded-2xl p-4 text-center shadow-xs">
        <span class="text-[0.65rem] font-bold text-text-subtle uppercase tracking-wider block">Total Completed</span>
        <span class="text-xl font-extrabold text-text mt-1 block">{{ stats.total }}</span>
      </div>
      <div class="bg-surface border border-border rounded-2xl p-4 text-center shadow-xs">
        <span class="text-[0.65rem] font-bold text-text-subtle uppercase tracking-wider block">Average Score</span>
        <span class="text-xl font-extrabold text-primary mt-1 block">{{ stats.avg }}%</span>
      </div>
      <div class="bg-surface border border-border rounded-2xl p-4 text-center shadow-xs">
        <span class="text-[0.65rem] font-bold text-text-subtle uppercase tracking-wider block">Perfect Scores (100%)</span>
        <span class="text-xl font-extrabold text-emerald-500 mt-1 block">{{ stats.perfect }}</span>
      </div>
    </div>

    <!-- Search & Filter Bar -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="relative flex-1 max-w-sm">
        <Search class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Search activity or exam name..."
          class="w-full pl-9 pr-3 py-2 bg-surface border border-border rounded-xl text-xs text-text outline-none focus:border-primary shadow-xs"
        />
      </div>

      <div class="flex items-center gap-1.5 overflow-x-auto custom-scrollbar pb-1">
        <button
          v-for="cat in ['all', 'exams', 'flashcards', 'listening', 'reading', 'simulations', 'games']"
          :key="cat"
          type="button"
          @click="activeCategory = cat"
          class="px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all whitespace-nowrap"
          :class="
            activeCategory === cat
              ? 'bg-primary text-white shadow-xs'
              : 'bg-surface hover:bg-surface-hover border border-border text-text-muted hover:text-text'
          "
        >
          {{ cat }}
        </button>
      </div>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="py-20 flex justify-center">
      <div class="w-8 h-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="filteredItems.length === 0"
      class="bg-surface/50 border border-dashed border-border rounded-3xl p-12 text-center space-y-3"
    >
      <HistoryIcon class="w-12 h-12 text-text-subtle/30 mx-auto" />
      <h3 class="font-bold text-sm text-text">No activity history recorded</h3>
      <p class="text-xs text-text-muted max-w-sm mx-auto">
        Complete exercises, flashcard decks, or trimestral exams to build your history log.
      </p>
    </div>

    <!-- History List -->
    <div v-else class="space-y-3">
      <div
        v-for="item in filteredItems"
        :key="item.id"
        class="bg-surface border border-border rounded-2xl p-4 sm:p-5 flex items-center justify-between gap-4 shadow-xs hover:border-primary/40 transition-all group"
      >
        <div class="flex items-center gap-3.5 min-w-0">
          <div
            class="w-11 h-11 rounded-2xl flex items-center justify-center shrink-0 border"
            :class="
              CATEGORY_CONFIG[item.type]?.bg || 'bg-primary/10',
              CATEGORY_CONFIG[item.type]?.border || 'border-primary/20',
              CATEGORY_CONFIG[item.type]?.color || 'text-primary'
            "
          >
            <component :is="CATEGORY_CONFIG[item.type]?.icon || CheckCircle2" class="w-5 h-5" />
          </div>

          <div class="min-w-0">
            <h4 class="font-bold text-sm text-text truncate group-hover:text-primary transition-colors">
              {{ item.title }}
            </h4>
            <div class="flex items-center gap-2 text-xs text-text-muted mt-0.5">
              <span class="capitalize font-semibold text-primary">{{ item.type }}</span>
              <span>•</span>
              <span class="flex items-center gap-1">
                <Calendar class="w-3 h-3 text-text-subtle" />
                {{ item.date ? new Date(item.date).toLocaleDateString() : 'Recent' }}
              </span>
            </div>
          </div>
        </div>

        <div class="flex items-center gap-4 shrink-0">
          <div class="text-right">
            <span
              class="text-lg font-black block"
              :class="
                item.score >= 80 ? 'text-emerald-500' : item.score >= 60 ? 'text-amber-500' : 'text-danger'
              "
            >
              {{ item.score }}%
            </span>
            <span class="text-[0.65rem] font-bold text-text-subtle uppercase tracking-wider">Score</span>
          </div>

          <button
            type="button"
            @click="router.push(item.url)"
            class="p-2 rounded-xl border border-border hover:bg-surface-hover text-text-muted hover:text-primary transition-colors"
            title="Open or Re-practice"
          >
            <ExternalLink class="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
