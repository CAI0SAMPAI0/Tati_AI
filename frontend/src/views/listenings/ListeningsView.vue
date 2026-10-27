<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { Headphones, Tag, Play, Sparkles, Waves, Video } from 'lucide-vue-next';
import { apiGet } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { peekActivityCache, cachedActivityFetch, TTL_1_DAY_MS } from '@/utils/activityCache';

interface Podcast {
  id: string;
  title: string;
  description?: string;
  thumbnail?: string;
  level: string;
  media_type?: 'audio' | 'video';
  recommendation_reason?: string;
  external_url?: string;
}

const router = useRouter();
const initialCached = peekActivityCache<Podcast[]>('podcasts:all');
const listenings = ref<Podcast[]>(initialCached || []);
const isLoading = ref(!initialCached);
const visibleCount = ref(12);

async function loadListenings() {
  if (!peekActivityCache<Podcast[]>('podcasts:all')) {
    isLoading.value = true;
  }
  try {
    const data = await cachedActivityFetch<Podcast[]>(
      'podcasts:all',
      () => apiGet<Podcast[]>(`${ENDPOINTS.ACTIVITIES_PODCASTS_RECOMMENDATIONS}?level=all`),
      TTL_1_DAY_MS
    );
    listenings.value = data || [];
  } catch (err) {
    console.error('Error fetching listenings:', err);
  } finally {
    isLoading.value = false;
  }
}

function handleOpenListening(id: string) {
  router.push(`/listenings/${id}`);
}

onMounted(() => {
  loadListenings();
});
</script>

<template>
  <div class="max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8 animate-fade-in">
    <!-- Header -->
    <header class="space-y-1">
      <div class="flex items-center gap-2">
        <div class="w-9 h-9 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
          <Headphones class="w-5 h-5" />
        </div>
        <h1 class="text-2xl sm:text-3xl font-display font-extrabold text-text">Listenings</h1>
      </div>
      <p class="text-xs sm:text-sm text-text-muted max-w-2xl">
        Improve listening comprehension and pronunciation with native English audio and video content for your CEFR level.
      </p>
    </header>

    <!-- Loading State -->
    <div v-if="isLoading" class="py-20 flex justify-center">
      <div class="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
    </div>

    <!-- Empty State -->
    <div
      v-else-if="listenings.length === 0"
      class="py-20 text-center text-text-muted border border-dashed border-border rounded-3xl bg-surface/30 space-y-3"
    >
      <Headphones class="w-12 h-12 text-primary/30 mx-auto" />
      <p class="font-bold text-sm">No listening activities available right now.</p>
    </div>

    <!-- Listenings Grid -->
    <div v-else class="space-y-6">
      <div class="text-xs font-bold text-text-subtle uppercase tracking-wider px-1">
        Showing {{ Math.min(visibleCount, listenings.length) }} of {{ listenings.length }} listenings
      </div>

      <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        <div
          v-for="p in listenings.slice(0, visibleCount)"
          :key="p.id"
          @click="handleOpenListening(p.id)"
          class="bg-surface border border-border rounded-2xl overflow-hidden hover:border-primary/50 hover:shadow-lg transition-all cursor-pointer flex flex-col group"
        >
          <!-- Thumbnail / Video Banner -->
          <div class="aspect-video w-full bg-bg-secondary relative overflow-hidden">
            <img
              v-if="p.thumbnail"
              :src="p.thumbnail"
              :alt="p.title"
              class="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            />
            <div v-else class="w-full h-full flex items-center justify-center bg-primary/5">
              <Headphones class="w-12 h-12 text-primary/30" />
            </div>

            <div class="absolute top-3 left-3 flex items-center gap-1.5">
              <span class="px-2.5 py-1 rounded-lg text-[0.65rem] font-black uppercase tracking-wider bg-surface/90 backdrop-blur-md text-primary border border-primary/20 shadow-xs">
                {{ p.level || 'All' }}
              </span>
              <span class="px-2 py-1 rounded-lg text-[0.65rem] font-bold uppercase tracking-wider bg-black/60 text-white backdrop-blur-md flex items-center gap-1">
                <Video v-if="p.media_type !== 'audio'" class="w-3 h-3" />
                <Waves v-else class="w-3 h-3" />
                {{ p.media_type === 'audio' ? 'Audio' : 'Video' }}
              </span>
            </div>
          </div>

          <!-- Content Details -->
          <div class="p-5 flex-1 flex flex-col justify-between space-y-4">
            <div class="space-y-2">
              <h3 class="font-bold text-base text-text line-clamp-2 leading-snug group-hover:text-primary transition-colors">
                {{ p.title }}
              </h3>
              <p class="text-xs text-text-muted line-clamp-2 leading-relaxed">
                {{ p.description || 'Improve your listening comprehension and shadowing.' }}
              </p>
            </div>

            <div class="pt-2 border-t border-border flex items-center justify-between text-xs font-bold text-primary">
              <span>Start Activity</span>
              <div class="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-colors">
                <Play class="w-3.5 h-3.5 fill-current ml-0.5" />
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- Show More Button -->
      <div v-if="visibleCount < listenings.length" class="flex justify-center pt-4">
        <button
          type="button"
          @click="visibleCount += 12"
          class="px-6 py-2.5 rounded-xl border border-border bg-surface hover:bg-surface-hover font-bold text-xs text-text transition-all shadow-xs"
        >
          Show More
        </button>
      </div>
    </div>
  </div>
</template>
