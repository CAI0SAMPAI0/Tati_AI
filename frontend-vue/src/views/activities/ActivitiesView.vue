<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { BookOpen, Radio, Newspaper, Music, Trophy, Sparkles } from 'lucide-vue-next';
import { getMyFlashcards, getNews, getMusics, getPodcasts } from '@/api/activities';

const flashcards = ref<any[]>([]);
const newsList = ref<any[]>([]);
const musicsList = ref<any[]>([]);
const podcastsList = ref<any[]>([]);
const activeTab = ref<'flashcards' | 'podcasts' | 'news' | 'music'>('flashcards');
const loading = ref(true);

onMounted(async () => {
  try {
    const [fc, nw, mu, pod] = await Promise.allSettled([
      getMyFlashcards(),
      getNews(),
      getMusics(),
      getPodcasts(),
    ]);
    if (fc.status === 'fulfilled') flashcards.value = fc.value || [];
    if (nw.status === 'fulfilled') newsList.value = nw.value || [];
    if (mu.status === 'fulfilled') musicsList.value = mu.value || [];
    if (pod.status === 'fulfilled') podcastsList.value = pod.value || [];
  } finally {
    loading.value = false;
  }
});
</script>

<template>
  <div class="max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
    <!-- Header -->
    <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
      <div>
        <h1 class="font-display text-2xl font-extrabold text-text">Activities & Learning Hub</h1>
        <p class="text-xs sm:text-sm text-text-muted mt-0.5">
          Practice reading, listening, vocabulary decks and real-world English.
        </p>
      </div>

      <!-- Tabs -->
      <div class="flex items-center gap-1.5 p-1 bg-surface border border-border rounded-xl">
        <button
          type="button"
          @click="activeTab = 'flashcards'"
          class="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
          :class="activeTab === 'flashcards' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-text'"
        >
          Decks
        </button>
        <button
          type="button"
          @click="activeTab = 'podcasts'"
          class="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
          :class="activeTab === 'podcasts' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-text'"
        >
          Podcasts
        </button>
        <button
          type="button"
          @click="activeTab = 'news'"
          class="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
          :class="activeTab === 'news' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-text'"
        >
          News
        </button>
        <button
          type="button"
          @click="activeTab = 'music'"
          class="px-3 py-1.5 rounded-lg text-xs font-bold transition-colors"
          :class="activeTab === 'music' ? 'bg-primary text-white shadow-sm' : 'text-text-muted hover:text-text'"
        >
          Music
        </button>
      </div>
    </div>

    <!-- Content Sections -->
    <div v-if="loading" class="text-center py-16">
      <div class="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3"></div>
      <p class="text-xs font-bold text-text-muted">Loading activities...</p>
    </div>

    <!-- Flashcards tab -->
    <div v-else-if="activeTab === 'flashcards'" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="(deck, idx) in (flashcards.length > 0 ? flashcards : [
          { title: 'Essential Verbs & Actions', count: 40, level: 'A1-A2', color: 'bg-primary/10' },
          { title: 'Business & Workplace English', count: 55, level: 'B1-B2', color: 'bg-success/10' },
          { title: 'Travel & Airport Conversations', count: 32, level: 'A2-B1', color: 'bg-warning/10' },
          { title: 'Idioms & Native Expressions', count: 60, level: 'B2-C1', color: 'bg-accent/10' },
        ])"
        :key="idx"
        class="bg-surface border border-border rounded-2xl p-5 hover:border-primary/50 transition-all shadow-sm hover:shadow-md cursor-pointer group"
      >
        <div class="flex items-center justify-between mb-3">
          <span class="text-[0.68rem] font-extrabold px-2 py-0.5 rounded-md bg-bg-secondary text-text">
            {{ deck.level || 'All Levels' }}
          </span>
          <span class="text-xs font-medium text-text-muted">
            {{ deck.count || deck.cards_count || 25 }} cards
          </span>
        </div>
        <h3 class="font-display font-bold text-base text-text group-hover:text-primary transition-colors mb-1">
          {{ deck.title || deck.name }}
        </h3>
        <p class="text-xs text-text-muted">Master spaced-repetition vocabulary.</p>
      </div>
    </div>

    <!-- Podcasts Tab -->
    <div v-else-if="activeTab === 'podcasts'" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div
        v-for="(pod, idx) in (podcastsList.length > 0 ? podcastsList : [
          { title: 'Coffee Break English #42', duration: '12 min', level: 'B1' },
          { title: '6 Minute English: Tech & AI', duration: '6 min', level: 'B2' },
        ])"
        :key="idx"
        class="bg-surface border border-border rounded-2xl p-5 flex items-center gap-4 hover:border-primary/50 transition-all shadow-sm"
      >
        <div class="w-12 h-12 rounded-xl bg-primary/10 text-primary flex items-center justify-center flex-shrink-0">
          <Radio class="w-6 h-6" />
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="font-display font-bold text-sm text-text truncate">{{ pod.title }}</h4>
          <p class="text-xs text-text-muted">{{ pod.duration || '10 min' }} • Level {{ pod.level || 'B1' }}</p>
        </div>
      </div>
    </div>

    <!-- News Tab -->
    <div v-else-if="activeTab === 'news'" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div
        v-for="(item, idx) in (newsList.length > 0 ? newsList : [
          { title: 'Global Tech Breakthroughs in 2026', source: 'BBC Learning English' },
          { title: 'Cultural Trends in Modern Cities', source: 'VOA News' },
        ])"
        :key="idx"
        class="bg-surface border border-border rounded-2xl p-5 hover:border-primary/50 transition-all shadow-sm"
      >
        <div class="flex items-center gap-2 text-xs font-bold text-primary mb-2">
          <Newspaper class="w-4 h-4" />
          <span>{{ item.source || 'News' }}</span>
        </div>
        <h4 class="font-display font-bold text-sm text-text mb-1">{{ item.title }}</h4>
        <p class="text-xs text-text-muted">Read with synchronized vocabulary definitions.</p>
      </div>
    </div>

    <!-- Music Tab -->
    <div v-else-if="activeTab === 'music'" class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div
        v-for="(song, idx) in (musicsList.length > 0 ? musicsList : [
          { title: 'Fix You', artist: 'Coldplay', level: 'A2' },
          { title: 'Someone Like You', artist: 'Adele', level: 'B1' },
        ])"
        :key="idx"
        class="bg-surface border border-border rounded-2xl p-5 flex items-center gap-4 hover:border-primary/50 transition-all shadow-sm"
      >
        <div class="w-12 h-12 rounded-xl bg-accent/10 text-accent flex items-center justify-center flex-shrink-0">
          <Music class="w-6 h-6" />
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="font-display font-bold text-sm text-text truncate">{{ song.title }}</h4>
          <p class="text-xs text-text-muted">{{ song.artist }} • Level {{ song.level }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
