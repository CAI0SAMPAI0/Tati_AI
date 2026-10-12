<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { Shield, Maximize, Minimize } from 'lucide-vue-next';
import type { SecureViewerAccess } from '@tati/hub-core';

const props = defineProps<{
  access: SecureViewerAccess;
  watermarkText: string;
}>();

const isFullscreen = ref(false);
const isEmulatedFullscreen = ref(false);
const viewerRef = ref<HTMLDivElement | null>(null);
const aspectRatios = ref<Record<number, number>>({});
const loadedPages = ref<Record<number, boolean>>({});

const watermarkTiles = Array.from({ length: 24 });

function getSafeUrl(url: string) {
  if (!url) return '';
  if (url.startsWith('http')) return url;
  const storageUrl = 'https://gkziqqjswecteekanwnv.supabase.co/storage/v1/object/public/hub-secure-pages';
  return `${storageUrl}/${url.replace(/^\/+/, '')}`;
}

function handleImageLoad(e: Event, index: number) {
  const img = e.target as HTMLImageElement;
  if (img.naturalWidth && img.naturalHeight) {
    aspectRatios.value[index] = img.naturalWidth / img.naturalHeight;
  }
  loadedPages.value[index] = true;
}

function handleImageError(e: Event, rawUrl: string) {
  const img = e.target as HTMLImageElement;
  if (!img.dataset.retried) {
    img.dataset.retried = 'true';
    const safeUrl = getSafeUrl(rawUrl);
    setTimeout(() => {
      const sep = safeUrl.includes('?') ? '&' : '?';
      img.src = `${safeUrl}${sep}retry=${Date.now()}`;
    }, 1200);
  }
}

function getPageLinks(pageIndex: number) {
  if (!props.access.external_links || !Array.isArray(props.access.external_links)) {
    return [];
  }
  const hasZero = props.access.external_links.some((l) => l.page === 0);
  const targetPage = hasZero ? pageIndex : pageIndex + 1;
  return props.access.external_links.filter(
    (l) => l.page === targetPage || l.page === pageIndex
  );
}

function handleLinkClick(e: MouseEvent, uri: string) {
  e.preventDefault();
  e.stopPropagation();
  if (uri) {
    window.open(uri, '_blank', 'noopener,noreferrer');
  }
}

function blockContext(e: MouseEvent) {
  e.preventDefault();
}

const activeFullscreen = computed(() => isFullscreen.value || isEmulatedFullscreen.value);

function toggleFullscreen() {
  const el = viewerRef.value;
  if (!document.fullscreenElement && !isEmulatedFullscreen.value) {
    if (el?.requestFullscreen) {
      el.requestFullscreen().catch(() => {
        // Fallback para tela cheia emulada caso a API nativa seja rejeitada pelo navegador
        isEmulatedFullscreen.value = true;
      });
    } else if ((el as any)?.webkitRequestFullscreen) {
      (el as any).webkitRequestFullscreen();
    } else {
      isEmulatedFullscreen.value = true;
    }
  } else {
    if (document.fullscreenElement) {
      if (document.exitFullscreen) {
        document.exitFullscreen().catch(() => {});
      } else if ((document as any)?.webkitExitFullscreen) {
        (document as any).webkitExitFullscreen();
      }
    }
    isEmulatedFullscreen.value = false;
  }
}

function handleFullscreenChange() {
  isFullscreen.value = !!document.fullscreenElement;
  if (!document.fullscreenElement) {
    isEmulatedFullscreen.value = false;
  }
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Escape' && isEmulatedFullscreen.value) {
    isEmulatedFullscreen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('contextmenu', blockContext);
  document.addEventListener('fullscreenchange', handleFullscreenChange);
  document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.addEventListener('keydown', handleKeyDown);
});

onUnmounted(() => {
  document.removeEventListener('contextmenu', blockContext);
  document.removeEventListener('fullscreenchange', handleFullscreenChange);
  document.removeEventListener('webkitfullscreenchange', handleFullscreenChange);
  document.removeEventListener('keydown', handleKeyDown);
});
</script>

<template>
  <div
    ref="viewerRef"
    :class="[
      'secure-viewer relative select-none transition-colors duration-200',
      activeFullscreen
        ? 'fixed inset-0 z-[100] h-screen w-screen overflow-y-auto bg-bg p-4 md:p-8'
        : 'w-full',
    ]"
    style="user-select: none; -webkit-user-select: none"
    @contextmenu.prevent
  >
    <!-- Barra superior de ferramentas e alternância de Tela Cheia -->
    <div
      :class="[
        'mb-6 flex items-center justify-between rounded-hub border border-line bg-primarySoft px-4 py-3 text-sm text-muted transition-all duration-200',
        activeFullscreen
          ? 'sticky top-2 z-50 mx-auto max-w-5xl shadow-md backdrop-blur-md bg-surface/95'
          : 'w-full',
      ]"
    >
      <div class="flex items-center gap-2">
        <Shield :size="18" class="text-primary flex-shrink-0" />
        <span class="font-medium text-ink">
          Visualização protegida — {{ access.total_pages || access.pages?.length || 0 }} página(s)
        </span>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-hub bg-primary px-3 py-1.5 text-xs font-bold text-white shadow-sm transition hover:bg-primary-hover active:scale-95"
        @click="toggleFullscreen"
      >
        <Minimize v-if="activeFullscreen" :size="16" />
        <Maximize v-else :size="16" />
        <span class="hidden sm:inline">
          {{ activeFullscreen ? 'Sair da Tela Cheia' : 'Tela Cheia' }}
        </span>
      </button>
    </div>

    <!-- Lista de Páginas do Documento com Dimensões Otimizadas -->
    <div class="space-y-6">
      <figure
        v-for="(url, index) in (access.pages || [])"
        :key="`${url}-${index}`"
        :class="[
          'relative overflow-hidden rounded-hub border border-line bg-white shadow-sm mx-auto transition-all duration-200',
          activeFullscreen ? 'max-w-5xl my-4 shadow-xl' : 'w-full max-w-4xl',
        ]"
      >
        <!-- Container com Proporção Precisa (A4 padrão: 0.7071) -->
        <div
          class="relative w-full mx-auto transition-all duration-300 bg-white"
          :style="{
            aspectRatio: aspectRatios[index] ? `${aspectRatios[index]}` : '0.7071',
            maxWidth: activeFullscreen ? '1080px' : '880px',
          }"
        >
          <!-- Skeleton Shimmer de Carregamento (Evita colapso horizontal) -->
          <div
            v-if="!loadedPages[index]"
            class="absolute inset-0 z-0 flex flex-col items-center justify-center bg-bgSecondary/60 text-muted"
          >
            <div class="h-9 w-9 animate-spin rounded-full border-2 border-primary border-t-transparent mb-3" />
            <span class="text-xs font-semibold text-ink">Carregando página {{ index + 1 }}...</span>
          </div>

          <!-- Imagem da Página do Documento (Preenchimento Completo 100% da Folha) -->
          <img
            :src="getSafeUrl(url)"
            :alt="`Página ${index + 1}`"
            :class="[
              'absolute inset-0 w-full h-full object-contain bg-white select-none transition-opacity duration-300',
              loadedPages[index] ? 'opacity-100' : 'opacity-0',
            ]"
            draggable="false"
            @load="handleImageLoad($event, index)"
            @error="handleImageError($event, url)"
          />

          <!-- Links Interativos Mapeados ("Click here", botões de áudio e exercícios) -->
          <a
            v-for="(link, i) in getPageLinks(index)"
            :key="`link-${index}-${i}`"
            :href="link.uri"
            target="_blank"
            rel="noopener noreferrer"
            class="absolute block z-30 cursor-pointer rounded hover:bg-primary/20 hover:ring-2 hover:ring-primary/60 transition-all"
            :title="`Abrir: ${link.uri}`"
            :style="{
              left: `${link.left * 100}%`,
              top: `${link.top * 100}%`,
              width: `${link.width * 100}%`,
              height: `${link.height * 100}%`,
              backgroundColor: 'rgba(255, 255, 255, 0.01)',
            }"
            @click="handleLinkClick($event, link.uri)"
          />

          <!-- Marca d'Água Dinâmica Anticópia -->
          <div
            v-if="loadedPages[index]"
            class="pointer-events-none absolute inset-0 z-10 grid grid-cols-3 gap-8 overflow-hidden p-4 opacity-[0.12]"
            aria-hidden="true"
          >
            <span
              v-for="(_, i) in watermarkTiles"
              :key="i"
              class="rotate-[-24deg] text-center text-[10px] font-bold uppercase tracking-wide text-ink"
            >
              {{ watermarkText }}
            </span>
          </div>
        </div>

        <!-- Numeração das Páginas Mantida Embaixo de Cada Página -->
        <figcaption class="border-t border-line px-4 py-2.5 text-center text-xs font-semibold text-muted bg-surface/90">
          Página {{ index + 1 }} de {{ access.total_pages || access.pages?.length }}
        </figcaption>
      </figure>
    </div>
  </div>
</template>
