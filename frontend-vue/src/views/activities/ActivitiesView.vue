<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  Layers,
  Drama,
  Headphones,
  Play,
  FileBox,
  Search,
  BookOpen,
  Lightbulb,
  FileText,
  Gamepad2,
  Newspaper,
  Music,
  CheckSquare,
  Keyboard,
  Mic,
  ExternalLink,
  CheckCircle2,
  Clock,
  ChevronDown,
  Award,
  X,
} from 'lucide-vue-next';
import { apiGet, apiPost } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { useAuth } from '@/composables/useAuth';
import { useToast } from '@/composables/useToast';
import { normalizeLevel } from '@/constants/levels';
import ActivityCard from '@/components/activities/ActivityCard.vue';
import ActivityViewerModal from '@/components/activities/ActivityViewerModal.vue';

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

const CEFR_LEVELS = ['All', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
const MUSIC_GENRES = [
  'All',
  'Pop',
  'Rock',
  'Hard Rock',
  'Heavy Metal',
  'Indie / Acoustic',
  'Dance / Electronic',
  'R&B / Soul',
  'Classics',
] as const;

const router = useRouter();
const toast = useToast();
const { user } = useAuth();

const activeTab = ref<TabType>('grammar');
const searchQuery = ref('');
const filterLevel = ref<string>('All');
const statusFilter = ref<'all' | 'pending' | 'done'>('all');
const musicGenre = ref<string>('All');
const visibleCount = ref(12);

// Data States
const grammarItems = ref<any[]>([]);
const vocabularyItems = ref<any[]>([]);
const readingItems = ref<any[]>([]);
const listeningItems = ref<any[]>([]);
const musicsRaw = ref<any[]>([]);
const flashcardsRaw = ref<any[]>([]);
const simulationsRaw = ref<any[]>([]);
const gamesRaw = ref<any[]>([]);
const newsRaw = ref<any[]>([]);
const mySubmissions = ref<any[]>([]);
const isLoading = ref(true);

const selectedActivity = ref<any | null>(null);

const effectiveLevel = computed(() => {
  if (filterLevel.value !== 'All') return filterLevel.value;
  return 'All';
});

const testEnglishLevel = computed(() => {
  if (filterLevel.value === 'All') return 'all';
  const lvl = filterLevel.value.toLowerCase().trim();
  if (lvl.startsWith('b1+')) return 'b1';
  return lvl || 'a1';
});

function getCleanLevels(levels?: string[]): string[] {
  if (!Array.isArray(levels)) return [];
  return levels
    .map((l) => (l || '').trim().toUpperCase())
    .filter((l) => l && l !== 'ALL');
}

const completedActivityIds = computed(() => {
  const set = new Set<string>();
  if (Array.isArray(mySubmissions.value)) {
    mySubmissions.value.forEach((sub: any) => {
      const isDoneScore = sub.score !== undefined ? sub.score > 0 : true;
      const statusNotPending = sub.metadata?.status !== 'pending';
      if (isDoneScore && statusNotPending) {
        if (sub.module_id) set.add(sub.module_id);
        if (sub.activity_id) set.add(sub.activity_id);
        if (sub.metadata?.url) set.add(sub.metadata.url);
        if (sub.metadata?.slug) set.add(sub.metadata.slug);
        if (sub.metadata?.id) set.add(sub.metadata.id);
      }
    });
  }
  return set;
});

async function fetchSubmissions() {
  try {
    const res = await apiGet<any[]>('/activities/submissions/my');
    mySubmissions.value = Array.isArray(res) ? res : [];
  } catch (_) {}
}

async function fetchCurrentTabContent() {
  isLoading.value = true;
  try {
    if (activeTab.value === 'grammar') {
      const res = await apiGet<any>(ENDPOINTS.TEST_ENGLISH_CONTENT(testEnglishLevel.value, 'grammar'));
      grammarItems.value = res?.items || res || [];
    } else if (activeTab.value === 'vocabulary') {
      const res = await apiGet<any>(ENDPOINTS.TEST_ENGLISH_CONTENT(testEnglishLevel.value, 'vocabulary'));
      vocabularyItems.value = res?.items || res || [];
    } else if (activeTab.value === 'reading') {
      const res = await apiGet<any>(ENDPOINTS.TEST_ENGLISH_CONTENT(testEnglishLevel.value, 'reading'));
      readingItems.value = res?.items || res || [];
    } else if (activeTab.value === 'listenings') {
      const [teRes, podsRes] = await Promise.allSettled([
        apiGet<any>(ENDPOINTS.TEST_ENGLISH_CONTENT(testEnglishLevel.value, 'listening')),
        apiGet<any[]>(ENDPOINTS.ACTIVITIES_PODCASTS_RECOMMENDATIONS),
      ]);
      const list1 = teRes.status === 'fulfilled' ? teRes.value?.items || teRes.value || [] : [];
      const list2 = podsRes.status === 'fulfilled' ? podsRes.value || [] : [];
      listeningItems.value = [...list1, ...list2];
    } else if (activeTab.value === 'musics') {
      const res = await apiGet<any[]>(ENDPOINTS.ACTIVITIES_MUSICS);
      musicsRaw.value = Array.isArray(res) ? res : [];
    } else if (activeTab.value === 'flashcards') {
      const res = await apiGet<any[]>(ENDPOINTS.ACTIVITIES_MODULES);
      flashcardsRaw.value = Array.isArray(res) ? res : [];
    } else if (activeTab.value === 'simulations') {
      const res = await apiGet<any[]>('/simulation/scenarios');
      simulationsRaw.value = Array.isArray(res) ? res : [];
    } else if (activeTab.value === 'games') {
      const res = await apiGet<any[]>(ENDPOINTS.ACTIVITIES_GAMES);
      gamesRaw.value = Array.isArray(res) ? res : [];
    } else if (activeTab.value === 'news') {
      const res = await apiGet<any[]>(ENDPOINTS.ACTIVITIES_NEWS);
      newsRaw.value = Array.isArray(res) ? res : [];
    }
  } catch (err) {
    console.warn(`Error loading ${activeTab.value}:`, err);
  } finally {
    isLoading.value = false;
  }
}

watch([activeTab, filterLevel], () => {
  visibleCount.value = 12;
  fetchCurrentTabContent();
});

const filteredList = computed(() => {
  let list: any[] = [];
  if (activeTab.value === 'grammar') list = grammarItems.value;
  else if (activeTab.value === 'vocabulary') list = vocabularyItems.value;
  else if (activeTab.value === 'reading') list = readingItems.value;
  else if (activeTab.value === 'listenings') list = listeningItems.value;
  else if (activeTab.value === 'musics') {
    list = musicsRaw.value;
    if (musicGenre.value !== 'All') {
      list = list.filter((m) => (m.genre || 'Pop') === musicGenre.value);
    }
  } else if (activeTab.value === 'flashcards') {
    let fList = flashcardsRaw.value;
    if (filterLevel.value !== 'All') {
      const target = filterLevel.value.toUpperCase().trim();
      fList = fList.filter((f) => {
        if (f.level && f.level.toUpperCase().trim() === target) return true;
        const clean = getCleanLevels(f.levels);
        if (clean.length > 0) return clean.includes(target);
        return (f.level && f.level.toLowerCase() === 'all') || (Array.isArray(f.levels) && f.levels.map((l: string) => (l || '').toLowerCase()).includes('all'));
      });
    }
    list = fList;
  } else if (activeTab.value === 'simulations') {
    let sList = simulationsRaw.value;
    if (filterLevel.value !== 'All') {
      const target = filterLevel.value.toUpperCase().trim();
      sList = sList.filter((s) => {
        const clean = getCleanLevels(s.levels);
        if (clean.length > 0) return clean.includes(target);
        return (s.difficulty && s.difficulty.toUpperCase().trim() === target) || (Array.isArray(s.levels) && s.levels.map((l: string) => (l || '').toLowerCase()).includes('all'));
      });
    }
    list = sList;
  }
  else if (activeTab.value === 'games') {
    let gList = gamesRaw.value;
    if (filterLevel.value !== 'All') {
      const target = filterLevel.value.toUpperCase().trim();
      gList = gList.filter((g) => {
        const clean = getCleanLevels(g.levels);
        if (clean.length > 0) {
          return clean.includes(target);
        }
        return Array.isArray(g.levels) && g.levels.map((l: string) => (l || '').toLowerCase()).includes('all');
      });
    }
    list = gList.map((g) => {
      const clean = getCleanLevels(g.levels);
      const displayLevel = clean.length > 0
        ? (filterLevel.value !== 'All' && clean.includes(filterLevel.value.toUpperCase())
          ? filterLevel.value.toUpperCase()
          : clean.join(', '))
        : 'ALL';
      return {
        ...g,
        url: g.wordwall_url || g.url,
        wordwall_url: g.wordwall_url || g.url,
        source: 'WordWall',
        category: 'games',
        level: displayLevel,
      };
    });
  } else if (activeTab.value === 'news') {
    let nList = newsRaw.value;
    if (filterLevel.value !== 'All') {
      const target = filterLevel.value.toUpperCase().trim();
      nList = nList.filter((n) => {
        const clean = getCleanLevels(n.levels);
        if (clean.length > 0) {
          return clean.includes(target);
        }
        return Array.isArray(n.levels) && n.levels.map((l: string) => (l || '').toLowerCase()).includes('all');
      });
    }
    list = nList;
  }

  // Search filtering
  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase().trim();
    list = list.filter(
      (item) =>
        (item.title && item.title.toLowerCase().includes(q)) ||
        (item.name && item.name.toLowerCase().includes(q)) ||
        (item.artist && item.artist.toLowerCase().includes(q))
    );
  }

  // Status filtering
  if (statusFilter.value === 'done') {
    list = list.filter((item) => {
      const id = item.url || item.wordwall_url || item.slug || item.id;
      return completedActivityIds.value.has(id);
    });
  } else if (statusFilter.value === 'pending') {
    list = list.filter((item) => {
      const id = item.url || item.wordwall_url || item.slug || item.id;
      return !completedActivityIds.value.has(id);
    });
  }

  return list;
});

const displayedItems = computed(() => {
  return filteredList.value.slice(0, visibleCount.value);
});

const hasMore = computed(() => {
  return filteredList.value.length > visibleCount.value;
});

function handleSelectActivity(item: any) {
  if (activeTab.value === 'flashcards') {
    router.push(`/flashcards/${item.id}`);
    return;
  }
  if (activeTab.value === 'simulations') {
    router.push(`/voice?simulation_id=${item.id}`);
    return;
  }
  if (activeTab.value === 'listenings' && item.media_type) {
    router.push(`/listenings/${item.id}`);
    return;
  }
  if (activeTab.value === 'games') {
    selectedActivity.value = {
      id: item.id,
      title: item.title,
      url: item.wordwall_url || item.url,
      wordwall_url: item.wordwall_url || item.url,
      source: 'WordWall',
      category: 'games',
      level: item.level || 'ALL',
    };
    return;
  }

  selectedActivity.value = {
    ...item,
    title: item.title || item.name,
    category: activeTab.value,
  };
}

async function handleMarkDone(item: any) {
  const actId = item.wordwall_url || item.url || item.slug || item.id;
  try {
    const res = await apiPost<any>('/activities/submissions', {
      activity_id: actId,
      activity_type: item.category || activeTab.value,
      score: 100,
      metadata: {
        id: item.id,
        title: item.title || item.name,
        url: item.wordwall_url || item.url,
        slug: item.slug,
        status: 'done',
        category: item.category || activeTab.value,
      },
    });

    const earnedXp = res?.data?.xp_earned ?? 25;
    toast.success(`Activity completed! +${earnedXp} XP 🎉`);
    await fetchSubmissions();
  } catch (e) {
    toast.error('Error completing activity.');
  }
}

async function handleMarkPending(item: any) {
  const actId = item.wordwall_url || item.url || item.slug || item.id;
  try {
    await apiPost('/activities/submissions', {
      activity_id: actId,
      activity_type: item.category || activeTab.value,
      score: 0,
      status: 'pending',
      metadata: {
        id: item.id,
        title: item.title || item.name,
        url: item.wordwall_url || item.url,
        slug: item.slug,
        status: 'pending',
        category: item.category || activeTab.value,
      },
    });

    toast.success('Activity reverted to pending.');
    await fetchSubmissions();
  } catch (e) {
    toast.error('Error reverting activity.');
  }
}

const tabs = [
  { id: 'grammar', label: 'Grammar', icon: BookOpen },
  { id: 'vocabulary', label: 'Vocabulary', icon: Lightbulb },
  { id: 'listenings', label: 'Listening', icon: Headphones },
  { id: 'reading', label: 'Reading', icon: FileText },
  { id: 'musics', label: 'Music', icon: Music },
  { id: 'flashcards', label: 'Flashcards', icon: Layers },
  { id: 'simulations', label: 'Simulations', icon: Drama },
  { id: 'games', label: 'Games', icon: Gamepad2 },
  { id: 'news', label: 'News', icon: Newspaper },
] as const;

onMounted(() => {
  fetchSubmissions();
  fetchCurrentTabContent();
});
</script>

<template>
  <div class="p-4 sm:p-6 lg:p-8 max-w-7xl w-full mx-auto space-y-6 animate-fade-in">
    <!-- Header banner -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h1 class="font-display font-black text-2xl sm:text-3xl text-text">Activities & Learning Hub</h1>
        <p class="text-xs sm:text-sm text-text-muted mt-1">
          Practice vocabulary, grammar, reading and listening. Track Completed vs Pending activities!
        </p>
      </div>

      <router-link
        to="/activities/hub"
        class="px-4 py-2 rounded-xl bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 font-bold text-xs transition-colors flex items-center gap-1.5 shadow-xs"
      >
        <span>Materials Hub</span>
        <ExternalLink class="w-3.5 h-3.5" />
      </router-link>
    </div>

    <!-- 9 Navigation Category Tabs -->
        <div class="flex items-center gap-1.5 overflow-x-auto pb-2 custom-scrollbar">
          <button
            v-for="t in tabs"
            :key="t.id"
            type="button"
            @click="activeTab = t.id"
            class="flex items-center gap-2 px-4 py-2.5 rounded-2xl text-xs font-bold transition-all shrink-0 cursor-pointer shadow-xs"
            :class="
              activeTab === t.id
                ? 'bg-primary text-white shadow-primary/20 scale-[1.02]'
                : 'bg-surface hover:bg-surface-hover text-text-muted hover:text-text border border-border/60'
            "
          >
            <component :is="t.icon" class="w-4 h-4" />
            <span>{{ t.label }}</span>
          </button>
        </div>

        <!-- Filter Row: Levels + Search + Status -->
        <div class="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-4 bg-surface border border-border rounded-2xl p-4 shadow-xs">
          <!-- CEFR Levels -->
          <div class="flex items-center gap-1.5 overflow-x-auto pb-1 md:pb-0 scrollbar-none">
            <button
              v-for="lvl in CEFR_LEVELS"
              :key="lvl"
              type="button"
              @click="filterLevel = lvl"
              class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer"
              :class="
                filterLevel === lvl
                  ? 'bg-primary text-white shadow-xs font-black'
                  : 'bg-bg text-text-muted hover:text-text hover:bg-surface-hover border border-border/50'
              "
            >
              {{ lvl }}
            </button>
          </div>

          <div class="flex items-center gap-3">
            <!-- Status Filter -->
            <div class="flex items-center p-1 bg-bg border border-border rounded-xl">
              <button
                v-for="st in ['all', 'pending', 'done'] as const"
                :key="st"
                type="button"
                @click="statusFilter = st"
                class="px-2.5 py-1 rounded-lg text-[0.7rem] font-bold capitalize transition-colors"
                :class="
                  statusFilter === st
                    ? 'bg-primary text-white shadow-xs'
                    : 'text-text-muted hover:text-text'
                "
              >
                {{ st }}
              </button>
            </div>

            <!-- Search Bar -->
            <div class="relative w-full md:w-56">
              <Search class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
              <input
                v-model="searchQuery"
                type="text"
                placeholder="Search..."
                class="w-full pl-8 pr-7 py-1.5 rounded-xl bg-bg border border-border text-text text-xs outline-none focus:border-primary transition-colors"
              />
              <button
                v-if="searchQuery"
                type="button"
                @click="searchQuery = ''"
                class="absolute right-2 top-1/2 -translate-y-1/2 text-text-muted hover:text-text"
              >
                <X class="w-3 h-3" />
              </button>
            </div>
          </div>
        </div>

        <!-- Music Genre Filter Pills (if activeTab === 'musics') -->
        <div v-if="activeTab === 'musics'" class="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
          <button
            v-for="g in MUSIC_GENRES"
            :key="g"
            type="button"
            @click="musicGenre = g"
            class="px-3 py-1 rounded-full text-xs font-bold transition-all shrink-0 cursor-pointer"
            :class="
              musicGenre === g
                ? 'bg-primary text-white shadow-xs'
                : 'bg-surface hover:bg-surface-hover text-text-muted hover:text-text border border-border'
            "
          >
            {{ g }}
          </button>
        </div>

        <!-- Grid of Activities -->
        <div v-if="isLoading" class="py-24 text-center">
          <div class="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3"></div>
          <p class="text-xs font-bold text-text-muted">Loading activities...</p>
        </div>

        <div v-else-if="filteredList.length === 0" class="py-20 text-center text-text-muted border border-dashed border-border rounded-3xl bg-surface/30">
          No activities found matching your filters.
        </div>

        <div v-else class="space-y-8">
          <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            <ActivityCard
              v-for="item in displayedItems"
              :key="item.id || item.slug || item.url"
              :title="item.title || item.name"
              :description="item.description || item.artist || 'Practice English with Teacher Tatiana.'"
              :image-url="item.image || item.thumbnail || item.thumbnail_url"
              :emoji="item.emoji || item.icon"
              :status="
                completedActivityIds.has(item.url || item.slug || item.id)
                  ? 'done'
                  : 'pending'
              "
              :meta="[
                { icon: BookOpen, label: item.level || effectiveLevel },
                ...(item.card_count ? [{ icon: FileBox, label: `${item.card_count} cards` }] : []),
                ...(item.genre ? [{ icon: Music, label: item.genre }] : []),
              ]"
              @click="handleSelectActivity(item)"
            />
          </div>

          <!-- Load More Button -->
          <div v-if="hasMore" class="flex justify-center pt-4">
            <button
              type="button"
              @click="visibleCount += 12"
              class="px-6 py-3 bg-surface hover:bg-surface-hover border border-border hover:border-primary/50 text-text font-bold text-sm rounded-2xl transition-all shadow-sm flex items-center gap-2 cursor-pointer group"
            >
              <span>Load More ({{ filteredList.length - visibleCount }} remaining)</span>
              <ChevronDown class="w-4 h-4 group-hover:translate-y-0.5 transition-transform" />
            </button>
          </div>
        </div>

    <!-- Activity Viewer Modal -->
    <ActivityViewerModal
      :is-open="Boolean(selectedActivity)"
      :activity="selectedActivity"
      :is-done="
        selectedActivity
          ? completedActivityIds.has(selectedActivity.url || selectedActivity.slug || selectedActivity.id)
          : false
      "
      @close="selectedActivity = null"
      @mark-done="handleMarkDone"
      @mark-pending="handleMarkPending"
    />
  </div>
</template>
