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
  Headphones,
  Sparkles,
  Gamepad2,
  Newspaper,
  ArrowRight,
  Filter,
  History as HistoryIcon,
} from 'lucide-vue-next';
import StudentLayout from '@/components/layout/StudentLayout.vue';
import { useAuthStore } from '@/stores/auth';

interface HistoryItem {
  id: string;
  category: string;
  title: string;
  score: number;
  completed_at: string;
  details?: string;
}

const router = useRouter();
const authStore = useAuthStore();

const searchQuery = ref('');
const selectedCategory = ref('all');
const sortOption = ref<'newest' | 'oldest' | 'highest_score' | 'lowest_score'>('newest');
const isLoading = ref(true);

const items = ref<HistoryItem[]>([
  {
    id: 'h1',
    category: 'grammar',
    title: 'Present Perfect vs Past Simple Exercise',
    score: 95,
    completed_at: '2026-10-12T14:30:00Z',
    details: '10/10 questions correct · 3 min duration',
  },
  {
    id: 'h2',
    category: 'listening',
    title: 'Podcast: Ordering at a London Coffee Shop',
    score: 88,
    completed_at: '2026-10-11T18:15:00Z',
    details: 'Pronunciation score 88% · Teacher Tati feedback received',
  },
  {
    id: 'h3',
    category: 'flashcards',
    title: 'Business English Vocabulary Deck',
    score: 100,
    completed_at: '2026-10-10T09:40:00Z',
    details: '20 cards reviewed · 100% mastery',
  },
  {
    id: 'h4',
    category: 'simulations',
    title: 'Job Interview Simulation: Strengths & Weaknesses',
    score: 90,
    completed_at: '2026-10-09T16:00:00Z',
    details: 'Fluency B2 · 14 messages exchanged',
  },
  {
    id: 'h5',
    category: 'games',
    title: 'Irregular Verbs Speed Challenge',
    score: 82,
    completed_at: '2026-10-08T11:20:00Z',
    details: 'Level Intermediate · 450 pts earned',
  },
]);

const categories = [
  { id: 'all', label: 'All', icon: HistoryIcon },
  { id: 'grammar', label: 'Grammar', icon: BookOpen },
  { id: 'vocabulary', label: 'Vocabulary', icon: Layers },
  { id: 'listening', label: 'Listening', icon: Headphones },
  { id: 'simulations', label: 'Simulations', icon: Sparkles },
  { id: 'games', label: 'Games', icon: Gamepad2 },
  { id: 'flashcards', label: 'Flashcards', icon: Layers },
];

const totalCompleted = computed(() => items.value.length);
const avgScore = computed(() => {
  if (items.value.length === 0) return 0;
  return Math.round(items.value.reduce((acc, i) => acc + i.score, 0) / items.value.length);
});

const filteredItems = computed(() => {
  let list = items.value.filter((i) => {
    const matchCat = selectedCategory.value === 'all' || i.category === selectedCategory.value;
    const matchSearch =
      !searchQuery.value.trim() ||
      i.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
      i.category.toLowerCase().includes(searchQuery.value.toLowerCase());
    return matchCat && matchSearch;
  });

  list.sort((a, b) => {
    if (sortOption.value === 'newest') {
      return new Date(b.completed_at).getTime() - new Date(a.completed_at).getTime();
    }
    if (sortOption.value === 'oldest') {
      return new Date(a.completed_at).getTime() - new Date(b.completed_at).getTime();
    }
    if (sortOption.value === 'highest_score') {
      return b.score - a.score;
    }
    if (sortOption.value === 'lowest_score') {
      return a.score - b.score;
    }
    return 0;
  });

  return list;
});

function formatDate(isoStr: string) {
  try {
    const d = new Date(isoStr);
    return d.toLocaleDateString('pt-BR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  } catch (_) {
    return isoStr;
  }
}

function getCategoryBadge(cat: string) {
  switch (cat) {
    case 'grammar':
      return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
    case 'vocabulary':
      return 'bg-amber-500/10 text-amber-500 border-amber-500/20';
    case 'listening':
      return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
    case 'simulations':
      return 'bg-rose-500/10 text-rose-500 border-rose-500/20';
    case 'games':
      return 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20';
    case 'flashcards':
      return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
    default:
      return 'bg-primarySoft text-primary border-primary/20';
  }
}

async function fetchHistory() {
  if (!authStore.token) return;
  isLoading.value = true;
  try {
    const res = await fetch('/users/progress', {
      headers: { Authorization: `Bearer ${authStore.token}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (Array.isArray(data.submissions) && data.submissions.length > 0) {
        items.value = data.submissions.map((s: any) => ({
          id: s.id || String(Math.random()),
          category: s.category || s.activity_type || 'grammar',
          title: s.metadata?.title || s.title || 'Completed Exercise',
          score: s.score ?? 85,
          completed_at: s.created_at || new Date().toISOString(),
          details: s.metadata?.details || 'Activity submitted',
        }));
      }
    }
  } catch (_) {
  } finally {
    isLoading.value = false;
  }
}

onMounted(() => {
  fetchHistory();
});
</script>

<template>
  <StudentLayout>
    <div class="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <!-- Header -->
      <header>
        <h1 class="text-2xl md:text-3xl font-display font-bold text-ink mb-1">
          Activity History
        </h1>
        <p class="text-muted text-sm">
          View all your completed exercises, tests, and conversation milestones.
        </p>
      </header>

      <!-- Stats Cards -->
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div class="bg-surface border border-line rounded-2xl p-5 shadow-xs">
          <p class="text-xs font-semibold text-muted">Total Completed</p>
          <p class="text-2xl font-black text-ink mt-1">{{ totalCompleted }}</p>
        </div>
        <div class="bg-surface border border-line rounded-2xl p-5 shadow-xs">
          <p class="text-xs font-semibold text-muted">Average Score</p>
          <p class="text-2xl font-black text-primary mt-1">{{ avgScore }}%</p>
        </div>
        <div class="bg-surface border border-line rounded-2xl p-5 shadow-xs">
          <p class="text-xs font-semibold text-muted">Study Streak</p>
          <p class="text-2xl font-black text-amber-500 mt-1">3 days</p>
        </div>
        <div class="bg-surface border border-line rounded-2xl p-5 shadow-xs">
          <p class="text-xs font-semibold text-muted">Categories Mastered</p>
          <p class="text-2xl font-black text-emerald-500 mt-1">5</p>
        </div>
      </div>

      <!-- Filters & Search Toolbar -->
      <div class="bg-surface border border-line rounded-3xl p-4 sm:p-5 shadow-xs space-y-4">
        <div class="flex flex-col sm:flex-row gap-3 items-center justify-between">
          <!-- Search input -->
          <div class="relative w-full sm:max-w-xs">
            <Search :size="16" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search activity..."
              class="w-full pl-9 pr-3 py-2 rounded-xl border border-line bg-bgSecondary/60 text-xs text-ink placeholder:text-muted outline-none focus:border-primary/50"
            />
          </div>

          <!-- Sort dropdown -->
          <div class="flex items-center gap-2 self-end sm:self-auto text-xs">
            <span class="text-muted font-semibold">Sort by:</span>
            <select
              v-model="sortOption"
              class="px-3 py-1.5 rounded-xl border border-line bg-surface text-ink text-xs font-bold outline-none focus:border-primary/50 cursor-pointer"
            >
              <option value="newest">Mais recentes</option>
              <option value="oldest">Mais antigos</option>
              <option value="highest_score">Maior nota</option>
              <option value="lowest_score">Menor nota</option>
            </select>
          </div>
        </div>

        <!-- Category pills -->
        <div class="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar pt-1">
          <button
            v-for="cat in categories"
            :key="cat.id"
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer"
            :class="
              selectedCategory === cat.id
                ? 'bg-primary text-white shadow-xs'
                : 'bg-bgSecondary border border-line text-muted hover:text-ink hover:border-primary/30'
            "
            @click="selectedCategory = cat.id"
          >
            <component :is="cat.icon" :size="13" />
            <span>{{ cat.label }}</span>
          </button>
        </div>
      </div>

      <!-- Activity Items List -->
      <div class="space-y-3">
        <div
          v-if="filteredItems.length === 0"
          class="p-8 text-center bg-surface border border-line rounded-3xl text-sm text-muted"
        >
          No activity found matching your criteria.
        </div>

        <div
          v-for="item in filteredItems"
          :key="item.id"
          class="bg-surface border border-line rounded-2xl p-4 sm:p-5 transition hover:border-primary/30 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4"
        >
          <div class="space-y-1.5">
            <div class="flex items-center gap-2">
              <span
                class="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase border"
                :class="getCategoryBadge(item.category)"
              >
                {{ item.category }}
              </span>
              <span class="text-[11px] text-muted flex items-center gap-1">
                <Calendar :size="12" />
                {{ formatDate(item.completed_at) }}
              </span>
            </div>

            <h3 class="text-sm sm:text-base font-bold text-ink">
              {{ item.title }}
            </h3>

            <p v-if="item.details" class="text-xs text-muted">
              {{ item.details }}
            </p>
          </div>

          <!-- Score & Replay action -->
          <div class="flex items-center gap-4 self-end sm:self-auto shrink-0">
            <div class="text-right">
              <span class="text-base sm:text-lg font-black text-primary">{{ item.score }}%</span>
              <p class="text-[10px] font-bold text-muted uppercase">Score</p>
            </div>

            <button
              type="button"
              class="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-bgSecondary hover:bg-primarySoft hover:text-primary text-xs font-bold text-ink border border-line hover:border-primary/30 transition cursor-pointer active:scale-95"
              @click="router.push('/activities')"
            >
              <RotateCcw :size="13" />
              <span>Practice</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </StudentLayout>
</template>
