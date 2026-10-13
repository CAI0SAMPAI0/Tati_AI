<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  BookOpen,
  Lightbulb,
  Podcast,
  FileText,
  Music,
  Layers,
  Drama,
  Gamepad2,
  Newspaper,
  Search,
  CheckCircle2,
  ExternalLink,
  Play,
  Loader2,
  ChevronDown,
} from 'lucide-vue-next';
import StudentLayout from '@/components/layout/StudentLayout.vue';
import ActivityViewerModal, { type ActivityItem } from '@/components/activities/ActivityViewerModal.vue';
import { useAuthStore } from '@/stores/auth';

type TabType =
  | 'grammar'
  | 'vocabulary'
  | 'listenings'
  | 'reading'
  | 'musics'
  | 'flashcards'
  | 'simulations'
  | 'games'
  | 'news';

const router = useRouter();
const authStore = useAuthStore();

const activeTab = ref<TabType>('grammar');
const searchQuery = ref('');
const filterLevel = ref('All');
const statusFilter = ref<'all' | 'pending' | 'done'>('all');
const isLoading = ref(false);
const visibleCount = ref(12);
const selectedActivity = ref<ActivityItem | null>(null);
const isTogglingDone = ref(false);

const completedIds = ref<Set<string>>(new Set());

const CEFR_LEVELS = ['All', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const TABS: Array<{ id: TabType; label: string; icon: any }> = [
  { id: 'grammar', label: 'Grammar', icon: BookOpen },
  { id: 'vocabulary', label: 'Vocabulary', icon: Lightbulb },
  { id: 'listenings', label: 'Listening', icon: Podcast },
  { id: 'reading', label: 'Reading', icon: FileText },
  { id: 'musics', label: 'Music', icon: Music },
  { id: 'flashcards', label: 'Flashcards', icon: Layers },
  { id: 'simulations', label: 'Simulations', icon: Drama },
  { id: 'games', label: 'Games', icon: Gamepad2 },
  { id: 'news', label: 'News', icon: Newspaper },
];

const rawItems = ref<Record<TabType, ActivityItem[]>>({
  grammar: [],
  vocabulary: [],
  listenings: [],
  reading: [],
  musics: [],
  flashcards: [],
  simulations: [],
  games: [],
  news: [],
});

function teImg(url?: string): string {
  if (!url) return '';
  if (url.includes('test-english.com')) {
    return `/activities/test-english/image-proxy?url=${encodeURIComponent(url)}`;
  }
  return url;
}

async function fetchSubmissions() {
  if (!authStore.token) return;
  try {
    const res = await fetch('/activities/submissions/my', {
      headers: { Authorization: `Bearer ${authStore.token}` },
    });
    if (res.ok) {
      const data = await res.json();
      const set = new Set<string>();
      if (Array.isArray(data)) {
        data.forEach((sub: any) => {
          if (sub.score > 0 || sub.metadata?.status === 'done') {
            if (sub.module_id) set.add(sub.module_id);
            if (sub.activity_id) set.add(sub.activity_id);
            if (sub.metadata?.url) set.add(sub.metadata.url);
            if (sub.metadata?.slug) set.add(sub.metadata.slug);
            if (sub.metadata?.id) set.add(sub.metadata.id);
          }
        });
      }
      completedIds.value = set;
    }
  } catch (_) {}
}

async function fetchTabContent(tab: TabType) {
  if (!authStore.token) return;
  isLoading.value = true;
  try {
    if (tab === 'grammar' || tab === 'vocabulary' || tab === 'listenings' || tab === 'reading') {
      const section = tab === 'listenings' ? 'listening' : tab;
      const lvl = filterLevel.value === 'All' ? 'all' : filterLevel.value;
      const res = await fetch(`/activities/test-english/content?level=${lvl}&section=${section}`, {
        headers: { Authorization: `Bearer ${authStore.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        const items = (data.items || []).map((i: any) => ({
          id: i.url || i.slug || Math.random().toString(),
          slug: i.slug,
          title: i.title || `Exercise ${i.slug || ''}`,
          description: `Interactive ${section} exercise from test-english.com (Level ${i.level || filterLevel.value}).`,
          category: tab,
          level: (i.level || 'B1').toUpperCase(),
          image: i.image ? teImg(i.image) : '',
          url: i.url || '',
          source: 'test-english.com',
        }));
        rawItems.value[tab] = items;
      }
    } else if (tab === 'simulations') {
      const res = await fetch('/simulation/scenarios', {
        headers: { Authorization: `Bearer ${authStore.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        rawItems.value.simulations = (data || []).map((s: any) => ({
          id: s.id,
          title: s.name,
          description: s.description || 'Simulação prática em cenário do mundo real com IA.',
          category: 'simulations',
          level: (s.difficulty || 'A2').toUpperCase(),
          route: `/voice?simulation_id=${s.id}`,
        }));
      }
    } else if (tab === 'games') {
      const res = await fetch('/admin-games/public', {
        headers: { Authorization: `Bearer ${authStore.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        rawItems.value.games = (data || []).map((g: any) => ({
          id: g.id,
          title: g.title,
          description: g.description || 'Interactive WordWall game to practice vocabulary and grammar.',
          category: 'games',
          level: (g.levels?.[0] || 'ALL').toUpperCase(),
          url: g.wordwall_url,
          source: 'wordwall.net',
        }));
      }
    } else if (tab === 'news') {
      const res = await fetch('/admin-news/public', {
        headers: { Authorization: `Bearer ${authStore.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        rawItems.value.news = (data || []).map((n: any) => ({
          id: n.id,
          title: n.title,
          description: n.description || 'Real-world English news article and practice.',
          category: 'news',
          level: (n.levels?.[0] || 'ALL').toUpperCase(),
          image: n.thumbnail_url || '',
          url: n.url,
        }));
      }
    } else if (tab === 'flashcards') {
      const res = await fetch('/activities/flashcards/my', {
        headers: { Authorization: `Bearer ${authStore.token}` },
      });
      if (res.ok) {
        const data = await res.json();
        rawItems.value.flashcards = (data || []).map((f: any) => ({
          id: f.id,
          title: f.title,
          description: f.description || `Flashcard deck with ${f.card_count || 10} study cards.`,
          category: 'flashcards',
          level: (f.level || 'B1').toUpperCase(),
        }));
      }
    } else if (tab === 'musics') {
      try {
        const res = await fetch('/data/lingoclip_musics.json');
        if (res.ok) {
          const data = await res.json();
          rawItems.value.musics = (data || []).map((m: any) => ({
            id: m.id || m.title,
            title: m.title,
            artist: m.artist || '',
            description: `Practice listening & lyrics with ${m.artist || 'music'}.`,
            category: 'musics',
            genre: m.genre || 'Pop',
            image: m.image || '',
            url: m.url || m.modes?.karaoke || m.modes?.choice,
            modes: m.modes,
            source: 'LingoClip',
          }));
        }
      } catch (_) {}
    }
  } catch (err) {
    console.error('Failed to load tab items:', err);
  } finally {
    isLoading.value = false;
  }
}

const filteredItems = computed(() => {
  let list = rawItems.value[activeTab.value] || [];

  if (filterLevel.value !== 'All' && activeTab.value !== 'musics') {
    const target = filterLevel.value.toUpperCase();
    list = list.filter((i) => !i.level || i.level === target || i.level === 'ALL');
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase();
    list = list.filter(
      (i) =>
        i.title.toLowerCase().includes(q) ||
        (i.artist || '').toLowerCase().includes(q) ||
        (i.description || '').toLowerCase().includes(q)
    );
  }

  if (statusFilter.value === 'done') {
    list = list.filter(
      (i) => completedIds.value.has(i.id) || (i.url && completedIds.value.has(i.url)) || (i.slug && completedIds.value.has(i.slug))
    );
  } else if (statusFilter.value === 'pending') {
    list = list.filter(
      (i) => !completedIds.value.has(i.id) && (!i.url || !completedIds.value.has(i.url)) && (!i.slug || !completedIds.value.has(i.slug))
    );
  }

  return list;
});

const paginatedItems = computed(() => {
  return filteredItems.value.slice(0, visibleCount.value);
});

const hasMore = computed(() => {
  return filteredItems.value.length > visibleCount.value;
});

function loadMore() {
  visibleCount.value += 12;
}

function openActivity(item: ActivityItem) {
  if (item.route) {
    router.push(item.route);
  } else {
    selectedActivity.value = item;
  }
}

async function toggleMarkDone(item: ActivityItem) {
  const actId = item.url || item.slug || item.id;
  const isDone = completedIds.value.has(actId) || completedIds.value.has(item.id);
  isTogglingDone.value = true;
  try {
    if (isDone) {
      completedIds.value.delete(actId);
      completedIds.value.delete(item.id);
      if (item.url) completedIds.value.delete(item.url);
      if (item.slug) completedIds.value.delete(item.slug);
    } else {
      completedIds.value.add(actId);
      completedIds.value.add(item.id);
      if (item.url) completedIds.value.add(item.url);
      if (item.slug) completedIds.value.add(item.slug);

      await fetch('/activities/submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.token}`,
        },
        body: JSON.stringify({
          activity_id: actId,
          activity_type: item.category || item.source || 'external',
          score: 100,
          metadata: {
            id: item.id,
            title: item.title,
            url: item.url,
            slug: item.slug,
            status: 'done',
          },
        }),
      });
    }
  } catch (err) {
    console.error('Failed to toggle submission:', err);
  } finally {
    isTogglingDone.value = false;
  }
}

watch([activeTab, filterLevel], () => {
  visibleCount.value = 12;
  fetchTabContent(activeTab.value);
});

onMounted(() => {
  fetchSubmissions();
  fetchTabContent(activeTab.value);
});
</script>

<template>
  <StudentLayout>
    <div class="space-y-6">
      <!-- Canonical Page Header -->
      <header class="flex flex-col md:flex-row md:items-end justify-between gap-6">
        <div>
          <div class="flex items-center gap-3 mb-2">
            <h1 class="text-2xl md:text-3xl font-display font-bold text-ink">
              My Activities
            </h1>
          </div>
          <p class="text-muted text-sm md:text-base max-w-2xl hidden lg:block">
            Practice vocabulary, grammar, reading and listening. Track Completed vs Pending activities!
          </p>
        </div>

        <!-- Filters Row -->
        <div class="flex flex-col sm:flex-row gap-3 w-full md:w-auto items-stretch sm:items-center flex-wrap">
          <!-- Level Filter -->
          <div v-if="activeTab !== 'musics'" class="flex items-center gap-2">
            <span class="text-xs font-bold text-muted uppercase tracking-wider whitespace-nowrap">
              Level:
            </span>
            <select
              v-model="filterLevel"
              class="px-3 py-2 bg-surface border border-line rounded-2xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all cursor-pointer text-ink"
            >
              <option value="All">All Levels</option>
              <option v-for="lvl in CEFR_LEVELS.slice(1)" :key="lvl" :value="lvl">
                {{ lvl }}
              </option>
            </select>
          </div>

          <!-- Status Filter -->
          <div class="flex items-center gap-2">
            <span class="text-xs font-bold text-muted uppercase tracking-wider whitespace-nowrap">
              Status:
            </span>
            <select
              v-model="statusFilter"
              class="px-3 py-2 bg-surface border border-line rounded-2xl text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all cursor-pointer text-ink"
            >
              <option value="all">All Status</option>
              <option value="pending">⏳ Pending</option>
              <option value="done">✓ Completed</option>
            </select>
          </div>

          <!-- Search Input -->
          <div class="relative w-full md:w-64">
            <Search class="absolute left-3 top-1/2 -translate-y-1/2 text-muted" :size="18" />
            <input
              type="text"
              v-model="searchQuery"
              placeholder="Search activity..."
              class="w-full pl-10 pr-4 py-2 bg-surface border border-line rounded-2xl text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all text-ink placeholder:text-muted"
            />
          </div>
        </div>
      </header>

      <!-- Category Navigation Tabs -->
      <nav class="flex flex-row overflow-x-auto pb-2 border-b border-line gap-2 items-center flex-nowrap scrollbar-none">
        <button
          v-for="tab in TABS"
          :key="tab.id"
          type="button"
          class="flex items-center shrink-0 gap-2 px-4 py-2.5 sm:px-5 sm:py-3 rounded-xl sm:rounded-t-xl sm:rounded-b-none text-sm font-bold transition-all whitespace-nowrap cursor-pointer"
          :class="
            activeTab === tab.id
              ? 'bg-surface border border-line border-b-surface text-primary shadow-xs'
              : 'text-muted hover:text-ink hover:bg-surface/50 border border-transparent'
          "
          @click="activeTab = tab.id"
        >
          <component :is="tab.icon" :size="18" />
          <span>{{ tab.label }}</span>
        </button>
      </nav>

      <!-- Content Area -->
      <div>
        <!-- Loading State -->
        <div v-if="isLoading" class="py-20 flex flex-col items-center justify-center gap-3 text-muted">
          <Loader2 :size="32" class="animate-spin text-primary" />
          <span class="text-xs font-semibold">Carregando atividades...</span>
        </div>

        <!-- Empty State -->
        <div
          v-else-if="filteredItems.length === 0"
          class="py-20 text-center text-muted border border-dashed border-line rounded-3xl bg-surface/30 p-8"
        >
          No {{ activeTab }} activities found matching your filters.
        </div>

        <!-- Activities Grid -->
        <div v-else class="space-y-8">
          <p class="text-muted text-sm max-w-2xl">
            Interactive {{ activeTab }} exercises for level {{ filterLevel }} from Teacher Tati Hub.
          </p>

          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <div
              v-for="item in paginatedItems"
              :key="item.id"
              class="text-left bg-surface border border-line rounded-2xl overflow-hidden hover:border-primary/40 hover:-translate-y-0.5 transition-all group cursor-pointer flex flex-col justify-between shadow-xs"
              @click="openActivity(item)"
            >
              <div>
                <!-- Thumbnail -->
                <div v-if="item.image" class="h-36 overflow-hidden bg-bgSecondary relative">
                  <img
                    :src="item.image"
                    :alt="item.title"
                    loading="lazy"
                    class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div class="absolute top-2 right-2 flex gap-1">
                    <span
                      v-if="completedIds.has(item.id) || (item.url && completedIds.has(item.url)) || (item.slug && completedIds.has(item.slug))"
                      class="flex items-center gap-1 bg-emerald-600 text-white text-[0.65rem] font-bold px-2 py-0.5 rounded-full shadow"
                    >
                      <CheckCircle2 :size="12" /> Done
                    </span>
                  </div>
                </div>

                <!-- Card Body -->
                <div class="p-5 space-y-2">
                  <div class="flex items-center justify-between gap-2">
                    <span
                      v-if="item.level"
                      class="text-[0.68rem] font-black uppercase px-2 py-0.5 rounded-full bg-primary/10 text-primary"
                    >
                      {{ item.level }}
                    </span>
                    <span
                      v-if="!item.image && (completedIds.has(item.id) || (item.url && completedIds.has(item.url)))"
                      class="flex items-center gap-1 bg-emerald-600 text-white text-[0.65rem] font-bold px-2 py-0.5 rounded-full shadow"
                    >
                      <CheckCircle2 :size="12" /> Done
                    </span>
                  </div>

                  <h3 class="font-bold text-ink text-base group-hover:text-primary transition-colors line-clamp-2">
                    {{ item.title }}
                  </h3>

                  <p v-if="item.description" class="text-xs text-muted line-clamp-2 leading-relaxed">
                    {{ item.description }}
                  </p>
                </div>
              </div>

              <!-- Card Footer -->
              <div class="px-5 py-3 border-t border-line/60 bg-bg/40 flex items-center justify-between">
                <span class="text-xs font-bold text-primary flex items-center gap-1 group-hover:underline">
                  <span>{{ item.route ? 'Open Activity' : 'Open Exercise' }}</span>
                  <ExternalLink :size="12" />
                </span>

                <button
                  type="button"
                  class="p-1 rounded-md text-muted hover:text-emerald-600 transition"
                  :title="completedIds.has(item.id) ? 'Completed' : 'Mark done'"
                  @click.stop="toggleMarkDone(item)"
                >
                  <CheckCircle2
                    :size="16"
                    :class="
                      completedIds.has(item.id) || (item.url && completedIds.has(item.url))
                        ? 'text-emerald-600 fill-emerald-600/20'
                        : 'text-muted'
                    "
                  />
                </button>
              </div>
            </div>
          </div>

          <!-- Load 10 More Button -->
          <div v-if="hasMore" class="flex flex-col items-center justify-center pt-4">
            <button
              type="button"
              class="px-6 py-3 bg-surface hover:bg-bgSecondary border border-line hover:border-primary/50 text-ink font-bold text-sm rounded-2xl transition-all shadow-xs flex items-center gap-2 group cursor-pointer"
              @click="loadMore"
            >
              <span>Load More ({{ filteredItems.length - visibleCount }} remaining)</span>
              <ChevronDown :size="16" class="group-hover:translate-y-0.5 transition-transform" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Canonical Activity Viewer Modal -->
    <ActivityViewerModal
      :is-open="Boolean(selectedActivity)"
      :activity="selectedActivity"
      :is-done="
        Boolean(
          selectedActivity &&
            (completedIds.has(selectedActivity.id) ||
              (selectedActivity.url && completedIds.has(selectedActivity.url)) ||
              (selectedActivity.slug && completedIds.has(selectedActivity.slug)))
        )
      "
      :loading="isTogglingDone"
      @close="selectedActivity = null"
      @toggle-done="toggleMarkDone"
    />
  </StudentLayout>
</template>