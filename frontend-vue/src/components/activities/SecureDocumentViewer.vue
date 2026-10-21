<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Shield, Maximize, Minimize, Loader2, RefreshCw } from 'lucide-vue-next';

export type SecureViewerAccess = {
  type: string;
  pages: string[];
  total_pages: number;
  is_secure_viewer: boolean;
  title?: string;
  external_links?: {
    uri: string;
    page: number;
    left: number;
    top: number;
    width: number;
    height: number;
  }[];
};

const props = defineProps<{
  access: SecureViewerAccess;
  watermarkText: string;
}>();

const isFullscreen = ref(false);
const viewerRef = ref<HTMLDivElement | null>(null);
const loadedPages = ref<Record<number, boolean>>({});
const pageErrors = ref<Record<number, boolean>>({});
const retryAttempts = ref<Record<number, number>>({});

const watermarkTiles = computed(() => Array.from({ length: 24 }));

function blockEvent(e: Event) {
  e.preventDefault();
}

function handleFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement;
}

onMounted(() => {
  document.addEventListener('contextmenu', blockEvent);
  document.addEventListener('fullscreenchange', handleFullscreenChange);
});

onUnmounted(() => {
  document.removeEventListener('contextmenu', blockEvent);
  document.removeEventListener('fullscreenchange', handleFullscreenChange);
});

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    viewerRef.value?.requestFullscreen().catch((err) => {
      console.error('Fullscreen error:', err);
    });
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

function getSafePageUrl(url: string, index: number) {
  const base = url.startsWith('http')
    ? url
    : `https://gkziqqjswecteekanwnv.supabase.co/storage/v1/object/public/hub-secure-pages/${url}`;
  const attempt = retryAttempts.value[index] || 0;
  if (attempt === 0) return base;
  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}retry=${attempt}`;
}

function handleImageLoad(index: number) {
  loadedPages.value[index] = true;
  pageErrors.value[index] = false;
}

function handleImageError(index: number) {
  pageErrors.value[index] = true;
  loadedPages.value[index] = false;
}

function retryPage(index: number) {
  retryAttempts.value[index] = (retryAttempts.value[index] || 0) + 1;
  pageErrors.value[index] = false;
  loadedPages.value[index] = false;
}
</script>

<template>
  <div
    ref="viewerRef"
    :class="[
      'secure-viewer relative select-none',
      isFullscreen ? 'bg-bg overflow-y-auto p-4' : ''
    ]"
    @contextmenu.prevent
    style="user-select: none; -webkit-user-select: none;"
  >
    <!-- Top Security & Fullscreen Bar -->
    <div class="mb-6 flex items-center justify-between rounded-2xl border border-border bg-primary/10 px-4 py-3 text-xs text-text-muted">
      <div class="flex items-center gap-2">
        <Shield :size="16" class="text-primary" />
        <span class="font-semibold text-text">
          Visualização protegida — {{ access.total_pages }} página(s).
        </span>
      </div>
      <button
        type="button"
        @click="toggleFullscreen"
        class="flex items-center gap-1.5 text-primary font-bold hover:opacity-80 transition-opacity cursor-pointer"
      >
        <Minimize v-if="isFullscreen" :size="16" />
        <Maximize v-else :size="16" />
        <span class="hidden sm:inline">{{ isFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia' }}</span>
      </button>
    </div>

    <!-- Page List -->
    <div class="space-y-6">
      <figure
        v-for="(url, index) in access.pages"
        :key="`${url}-${index}`"
        :class="[
          'relative overflow-hidden rounded-2xl border border-border bg-white shadow-xs mx-auto',
          isFullscreen ? 'max-w-5xl my-4 shadow-lg' : 'w-full'
        ]"
      >
        <div
          class="relative w-full mx-auto min-h-[500px] flex items-center justify-center bg-white"
          :style="{ maxWidth: isFullscreen ? '1024px' : '768px' }"
        >
          <!-- Page Image -->
          <img
            :src="getSafePageUrl(url, index)"
            :alt="`Página ${index + 1}`"
            :class="[
              'w-full h-auto object-contain transition-opacity duration-300',
              loadedPages[index] ? 'opacity-100' : 'opacity-0 absolute inset-0'
            ]"
            @load="handleImageLoad(index)"
            @error="handleImageError(index)"
            draggable="false"
          />

          <!-- Loading state -->
          <div
            v-if="!loadedPages[index] && !pageErrors[index]"
            class="absolute inset-0 z-5 flex flex-col items-center justify-center gap-3 bg-white text-xs text-text-muted"
          >
            <Loader2 class="animate-spin text-primary" :size="28" />
            <span class="animate-pulse font-medium">Preparando página {{ index + 1 }}...</span>
          </div>

          <!-- Error state -->
          <div
            v-if="pageErrors[index]"
            class="absolute inset-0 z-5 flex flex-col items-center justify-center gap-3 bg-white text-xs text-text-muted"
          >
            <span>Não foi possível carregar a página {{ index + 1 }}.</span>
            <button
              type="button"
              @click="retryPage(index)"
              class="inline-flex items-center gap-1.5 rounded-xl border border-border px-3 py-1.5 font-bold text-text hover:bg-bgSecondary cursor-pointer"
            >
              <RefreshCw :size="14" />
              <span>Tentar novamente</span>
            </button>
          </div>

          <!-- Clickable Mapped Links -->
          <template v-if="access.external_links">
            <a
              v-for="(link, i) in access.external_links.filter((l) => l.page === index)"
              :key="`link-${index}-${i}`"
              :href="link.uri"
              target="_blank"
              rel="noopener noreferrer"
              class="absolute z-20 cursor-pointer rounded bg-primary/0 hover:bg-primary/10 transition-colors"
              :title="link.uri"
              :style="{
                left: `${link.left * 100}%`,
                top: `${link.top * 100}%`,
                width: `${link.width * 100}%`,
                height: `${link.height * 100}%`,
              }"
            />
          </template>

          <!-- Dynamic Watermark Tiles (Diagonal repeating text) -->
          <div
            class="pointer-events-none absolute inset-0 z-10 grid grid-cols-3 gap-8 overflow-hidden p-4 opacity-[0.12]"
            aria-hidden="true"
          >
            <span
              v-for="(_, i) in watermarkTiles"
              :key="i"
              class="rotate-[-24deg] text-center text-[10px] font-bold uppercase tracking-wide text-black select-none pointer-events-none"
            >
              {{ watermarkText }}
            </span>
          </div>
        </div>

        <figcaption class="border-t border-border/60 px-4 py-2 text-center text-[11px] text-text-muted bg-neutral-50 dark:bg-neutral-900">
          Página {{ index + 1 }} de {{ access.total_pages }}
        </figcaption>
      </figure>
    </div>
  </div>
</template>
