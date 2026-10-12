<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  BookOpen,
  Headphones,
  FileText,
  Layers,
  Drama,
  Gamepad2,
  Newspaper,
  Music,
  Search,
  CheckCircle2,
  ExternalLink,
  Play,
  RotateCcw,
  X,
  Loader2,
  Flame,
  ArrowLeft,
  Filter,
} from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';

interface ActivityItem {
  id: string;
  title: string;
  description?: string;
  category: string;
  level?: string;
  image?: string;
  url?: string;
  route?: string;
  source?: string;
  isDone?: boolean;
}

type TabType =
  | 'grammar'
  | 'vocabulary'
  | 'listenings'
  | 'reading'
  | 'flashcards'
  | 'simulations'
  | 'games'
  | 'news'
  | 'musics';

const router = useRouter();
const authStore = useAuthStore();

const activeTab = ref<TabType>('grammar');
const searchQuery = ref('');
const filterLevel = ref('All');
const filterStatus = ref<'all' | 'pending' | 'done'>('all');
const isLoading = ref(false);
const selectedActivity = ref<ActivityItem | null>(null);

const completedIds = ref<Set<string>>(new Set());

const CEFR_LEVELS = ['All', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const TABS: Array<{ id: TabType; label: string; icon: any }> = [
  { id: 'grammar', label: 'Gramática', icon: BookOpen },
  { id: 'vocabulary', label: 'Vocabulário', icon: FileText },
  { id: 'listenings', label: 'Listening & Podcasts', icon: Headphones },
  { id: 'reading', label: 'Leitura', icon: BookOpen },
  { id: 'flashcards', label: 'Flashcards', icon: Layers },
  { id: 'simulations', label: 'Simulações', icon: Drama },
  { id: 'games', label: 'Jogos', icon: Gamepad2 },
  { id: 'news', label: 'Notícias', icon: Newspaper },
  { id: 'musics', label: 'Músicas', icon: Music },
];

// Activity items per category
const rawItems = ref<Record<TabType, ActivityItem[]>>({
  grammar: [],
  vocabulary: [],
  listenings: [],
  reading: [],
  flashcards: [],
  simulations: [],
  games: [],
  news: [],
  musics: [],
});

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
          title: i.title || `Exercício ${i.slug || ''}`,
          description: `Exercício prático de ${section} (Nível ${i.level || filterLevel.value})`,
          category: tab,
          level: (i.level || 'B1').toUpperCase(),
          image: i.image || '',
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
          description: g.description || 'Jogo interativo no WordWall para reforçar seu vocabulário.',
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
          description: n.description || 'Notícia e conteúdo do mundo real para prática de inglês.',
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
          description: f.description || `Baralho com ${f.card_count || 10} cartas de memorização.`,
          category: 'flashcards',
          level: (f.level || 'B1').toUpperCase(),
        }));
      }
    } else if (tab === 'musics') {
      const res = await fetch('/data/lingoclip_musics.json');
      if (res.ok) {
        const data = await res.json();
        rawItems.value.musics = (data || []).map((m: any) => ({
          id: m.id || m.title,
          title: `${m.title} — ${m.artist || ''}`,
          description: `Treine listening e dicção com a música de ${m.artist || 'Artista'}.`,
          category: 'musics',
          image: m.image || '',
          url: m.url || m.modes?.karaoke || m.modes?.choice,
        }));
      }
    }
  } catch (err) {
    console.error('Failed to load tab items:', err);
  } finally {
    isLoading.value = false;
  }
}

const filteredItems = computed(() => {
  let list = rawItems.value[activeTab.value] || [];

  if (filterLevel.value !== 'All') {
    const target = filterLevel.value.toUpperCase();
    list = list.filter((i) => !i.level || i.level === target || i.level === 'ALL');
  }

  if (searchQuery.value.trim()) {
    const q = searchQuery.value.toLowerCase();
    list = list.filter(
      (i) => i.title.toLowerCase().includes(q) || (i.description || '').toLowerCase().includes(q)
    );
  }

  if (filterStatus.value === 'done') {
    list = list.filter((i) => completedIds.value.has(i.id));
  } else if (filterStatus.value === 'pending') {
    list = list.filter((i) => !completedIds.value.has(i.id));
  }

  return list;
});

function openActivity(item: ActivityItem) {
  if (item.route) {
    router.push(item.route);
  } else if (item.url) {
    selectedActivity.value = item;
  }
}

async function toggleMarkDone(item: ActivityItem) {
  const isDone = completedIds.value.has(item.id);
  try {
    if (isDone) {
      completedIds.value.delete(item.id);
    } else {
      completedIds.value.add(item.id);
      await fetch('/activities/submissions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.token}`,
        },
        body: JSON.stringify({
          activity_id: item.id,
          module_id: item.id,
          score: 100,
          metadata: { status: 'done', title: item.title, url: item.url },
        }),
      });
    }
  } catch (err) {
    console.error('Failed to toggle submission:', err);
  }
}

watch([activeTab, filterLevel], () => {
  fetchTabContent(activeTab.value);
});

onMounted(() => {
  fetchSubmissions();
  fetchTabContent(activeTab.value);
});
</script>

<template>
  <div class="min-h-screen bg-bg flex flex-col font-sans">
    <!-- Topbar Navigation -->
    <header class="sticky top-0 z-20 border-b border-line bg-surface/80 backdrop-blur-md px-4 py-3 shrink-0">
      <div class="max-w-6xl mx-auto flex items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="p-2 rounded-xl text-muted hover:text-ink hover:bg-bgSecondary transition active:scale-95 cursor-pointer"
            title="Voltar ao Chat"
            @click="router.push('/chat')"
          >
            <ArrowLeft :size="20" />
          </button>

          <div>
            <h1 class="text-base sm:text-lg font-bold text-ink flex items-center gap-2">
              <BookOpen :size="18" class="text-primary" />
              <span>Atividades e Exercícios</span>
            </h1>
            <p class="text-xs text-muted hidden sm:block">
              Exercícios interativos, gramática, podcasts e simulações com a Teacher Tati
            </p>
          </div>
        </div>

        <div class="flex items-center gap-2">
          <router-link
            to="/chat"
            class="px-3.5 py-1.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primaryHover transition active:scale-95 cursor-pointer shadow-xs"
          >
            Ir para o Chat
          </router-link>
        </div>
      </div>
    </header>

    <!-- Main Container -->
    <main class="flex-1 max-w-6xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-6">
      <!-- Category Tabs (Horizontal Scrollable) -->
      <div class="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar border-b border-line">
        <button
          v-for="t in TABS"
          :key="t.id"
          type="button"
          class="flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-bold whitespace-nowrap transition cursor-pointer"
          :class="
            activeTab === t.id
              ? 'bg-primary text-white shadow-xs'
              : 'text-muted hover:bg-bgSecondary hover:text-ink'
          "
          @click="activeTab = t.id"
        >
          <component :is="t.icon" :size="16" />
          <span>{{ t.label }}</span>
        </button>
      </div>

      <!-- Filters & Search Bar Row -->
      <div class="flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
        <!-- Search Input -->
        <div class="relative flex-1 max-w-md">
          <Search :size="16" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
          <input
            type="text"
            v-model="searchQuery"
            placeholder="Buscar atividade..."
            class="w-full pl-10 pr-4 py-2 rounded-xl bg-surface border border-line text-xs sm:text-sm text-ink placeholder:text-muted outline-none focus:border-primary transition"
          />
        </div>

        <!-- Level and Status Filters -->
        <div class="flex flex-wrap items-center gap-2">
          <!-- Level Chips -->
          <div class="flex items-center gap-1 bg-bgSecondary/60 p-1 rounded-xl border border-line">
            <button
              v-for="lvl in CEFR_LEVELS"
              :key="lvl"
              type="button"
              class="px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer"
              :class="
                filterLevel === lvl
                  ? 'bg-primary text-white shadow-xs'
                  : 'text-muted hover:text-ink'
              "
              @click="filterLevel = lvl"
            >
              {{ lvl }}
            </button>
          </div>

          <!-- Status Dropdown / Toggle -->
          <div class="flex items-center gap-1 bg-bgSecondary/60 p-1 rounded-xl border border-line text-xs font-bold">
            <button
              type="button"
              class="px-2.5 py-1 rounded-lg transition cursor-pointer"
              :class="filterStatus === 'all' ? 'bg-surface text-ink shadow-xs' : 'text-muted'"
              @click="filterStatus = 'all'"
            >
              Todas
            </button>
            <button
              type="button"
              class="px-2.5 py-1 rounded-lg transition cursor-pointer"
              :class="filterStatus === 'pending' ? 'bg-surface text-ink shadow-xs' : 'text-muted'"
              @click="filterStatus = 'pending'"
            >
              Pendentes
            </button>
            <button
              type="button"
              class="px-2.5 py-1 rounded-lg transition cursor-pointer"
              :class="filterStatus === 'done' ? 'bg-surface text-emerald-600 shadow-xs' : 'text-muted'"
              @click="filterStatus = 'done'"
            >
              Concluídas
            </button>
          </div>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="py-20 flex flex-col items-center justify-center gap-3 text-muted">
        <Loader2 :size="32" class="animate-spin text-primary" />
        <span class="text-xs font-semibold">Carregando atividades...</span>
      </div>

      <!-- Empty State -->
      <div
        v-else-if="filteredItems.length === 0"
        class="py-16 text-center bg-surface border border-line rounded-2xl p-8"
      >
        <BookOpen :size="36" class="text-muted mx-auto mb-3 opacity-60" />
        <h3 class="text-sm font-bold text-ink">Nenhuma atividade encontrada</h3>
        <p class="text-xs text-muted mt-1">
          Tente ajustar os filtros de nível ou o termo de busca para visualizar mais conteúdos.
        </p>
      </div>

      <!-- Activity Cards Grid -->
      <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <article
          v-for="item in filteredItems"
          :key="item.id"
          class="group bg-surface border border-line rounded-2xl p-4 flex flex-col gap-3 hover:border-primary/50 transition-all cursor-pointer shadow-xs hover:-translate-y-0.5"
          @click="openActivity(item)"
        >
          <!-- Thumbnail if present -->
          <div v-if="item.image" class="relative aspect-video rounded-xl overflow-hidden bg-bgSecondary">
            <img
              :src="item.image"
              :alt="item.title"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div class="absolute inset-0 bg-black/30 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
              <div class="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center shadow-lg">
                <Play :size="18" class="fill-current ml-0.5" />
              </div>
            </div>
          </div>

          <!-- Card Header & Badges -->
          <div class="flex items-start justify-between gap-2">
            <h3 class="text-sm font-bold text-ink group-hover:text-primary transition-colors line-clamp-2">
              {{ item.title }}
            </h3>
            <span
              v-if="item.level"
              class="text-[0.65rem] font-bold px-2 py-0.5 rounded-full border border-line bg-bgSecondary text-muted shrink-0"
            >
              {{ item.level }}
            </span>
          </div>

          <!-- Card Description -->
          <p class="text-xs text-muted line-clamp-2 leading-relaxed">
            {{ item.description }}
          </p>

          <!-- Bottom Action Row -->
          <div class="mt-auto pt-2 border-t border-line/60 flex items-center justify-between">
            <button
              type="button"
              class="text-xs font-bold text-primary flex items-center gap-1 group-hover:underline"
            >
              <span>Abrir atividade</span>
              <ExternalLink :size="12" />
            </button>

            <!-- Done Checkbox -->
            <button
              type="button"
              class="flex items-center gap-1 text-[11px] font-bold px-2 py-1 rounded-lg border transition cursor-pointer"
              :class="
                completedIds.has(item.id)
                  ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-600'
                  : 'border-line text-muted hover:border-primary/40'
              "
              @click.stop="toggleMarkDone(item)"
            >
              <CheckCircle2 :size="13" />
              <span>{{ completedIds.has(item.id) ? 'Concluída' : 'Marcar' }}</span>
            </button>
          </div>
        </article>
      </div>
    </main>

    <!-- Activity Viewer Modal (Iframe / Viewer) -->
    <Teleport to="body">
      <div
        v-if="selectedActivity"
        class="fixed inset-0 z-[9999] flex items-center justify-center p-3 sm:p-6 bg-black/70 backdrop-blur-sm animate-fade-in"
        @click="selectedActivity = null"
      >
        <div
          class="relative w-full max-w-5xl h-[88vh] bg-surface border border-line rounded-3xl shadow-2xl overflow-hidden flex flex-col"
          @click.stop
        >
          <!-- Modal Header -->
          <div class="px-5 py-3.5 border-b border-line flex items-center justify-between gap-3 bg-bgSecondary/40">
            <div class="flex items-center gap-3 truncate">
              <h3 class="text-sm font-bold text-ink truncate">
                {{ selectedActivity.title }}
              </h3>
              <span
                v-if="selectedActivity.level"
                class="text-[0.65rem] font-bold px-2 py-0.5 rounded-full border border-line bg-surface text-muted"
              >
                {{ selectedActivity.level }}
              </span>
            </div>

            <div class="flex items-center gap-2 shrink-0">
              <button
                type="button"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-bold transition cursor-pointer"
                :class="
                  completedIds.has(selectedActivity.id)
                    ? 'bg-emerald-500 text-white border-emerald-600'
                    : 'bg-surface border-line text-ink hover:border-primary'
                "
                @click="toggleMarkDone(selectedActivity)"
              >
                <CheckCircle2 :size="14" />
                <span>{{ completedIds.has(selectedActivity.id) ? 'Concluída' : 'Marcar como Concluída' }}</span>
              </button>

              <button
                type="button"
                class="p-1.5 rounded-lg text-muted hover:text-ink hover:bg-bgSecondary transition cursor-pointer"
                @click="selectedActivity = null"
              >
                <X :size="20" />
              </button>
            </div>
          </div>

          <!-- Modal Body / Iframe -->
          <div class="flex-1 bg-black/5 relative">
            <iframe
              v-if="selectedActivity.url"
              :src="selectedActivity.url"
              class="w-full h-full border-none"
              sandbox="allow-same-origin allow-scripts allow-forms allow-popups"
            />
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>