<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { Volume2, X, Languages } from 'lucide-vue-next';
import { lookupWord, type WordLookupResult } from '@/api/chat';
import { useAuth } from '@/composables/useAuth';

const props = defineProps<{
  word: string | null;
  position: { x: number; y: number } | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

function computeInitialCoords(pos: { x: number; y: number } | null) {
  if (!pos || typeof window === 'undefined') return { left: 16, top: 16 };
  const width = 340;
  const height = 180;
  const padding = 12;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = pos.x + 8;
  let top = pos.y + 8;

  if (left + width > viewportWidth - padding) {
    left = pos.x - width - 8;
    if (left < padding) {
      left = Math.max(padding, viewportWidth - width - padding);
    }
  }

  if (top + height > viewportHeight - padding) {
    top = pos.y - height - 8;
    if (top < padding) {
      top = Math.max(padding, viewportHeight - height - padding);
    }
  }

  left = Math.max(padding, Math.min(left, viewportWidth - width - padding));
  top = Math.max(padding, Math.min(top, viewportHeight - height - padding));

  return { left, top };
}

const { accent } = useAuth();
const loading = ref(true);
const data = ref<WordLookupResult | null>(null);
const isPlaying = ref(false);
const coords = ref<{ left: number; top: number }>(computeInitialCoords(props.position));
const tooltipRef = ref<HTMLDivElement | null>(null);
const audioRef = ref<HTMLAudioElement | null>(null);

const isSentence = computed(() => {
  return Boolean(props.word && (props.word.includes(' ') || props.word.length > 30));
});

function updatePosition() {
  if (!props.position || typeof window === 'undefined') return;

  const tooltipEl = tooltipRef.value;
  const width = tooltipEl?.offsetWidth || 340;
  const height = tooltipEl?.offsetHeight || 180;
  const padding = 12;

  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = props.position.x + 8;
  let top = props.position.y + 8;

  if (left + width > viewportWidth - padding) {
    left = props.position.x - width - 8;
    if (left < padding) {
      left = Math.max(padding, viewportWidth - width - padding);
    }
  }

  if (top + height > viewportHeight - padding) {
    top = props.position.y - height - 8;
    if (top < padding) {
      top = Math.max(padding, viewportHeight - height - padding);
    }
  }

  left = Math.max(padding, Math.min(left, viewportWidth - width - padding));
  top = Math.max(padding, Math.min(top, viewportHeight - height - padding));

  coords.value = { left, top };
}

watch(
  () => props.position,
  (newPos) => {
    if (newPos) {
      coords.value = computeInitialCoords(newPos);
      nextTick(updatePosition);
    }
  },
  { immediate: true }
);

async function fetchLookup() {
  if (!props.word) {
    data.value = null;
    return;
  }
  loading.value = true;
  data.value = null;

  const cleanedWord = isSentence.value ? props.word.trim() : props.word.trim();
  if (!cleanedWord) {
    loading.value = false;
    return;
  }

  try {
    const res = await lookupWord(cleanedWord, accent.value || 'en-US');
    if (res && res.translation) {
      data.value = res;
    } else {
      throw new Error('No translation returned');
    }
  } catch (err) {
    // Fallback via Google Translate single API
    let fallbackTranslation = cleanedWord;
    try {
      const gtRes = await fetch(
        `https://translate.googleapis.com/translate_a/single?client=gtx&sl=en&tl=pt&dt=t&q=${encodeURIComponent(cleanedWord)}`
      );
      if (gtRes.ok) {
        const gtData = await gtRes.json();
        if (gtData && gtData[0]) {
          fallbackTranslation = gtData[0].map((p: any) => p[0]).join('') || cleanedWord;
        }
      }
    } catch (_) {}

    data.value = {
      word: cleanedWord,
      partOfSpeech: isSentence.value ? 'sentence' : 'word',
      phonetic: isSentence.value ? '' : `/${cleanedWord}/`,
      translation: fallbackTranslation,
    };
  } finally {
    loading.value = false;
    nextTick(updatePosition);
  }
}

watch(
  () => props.word,
  () => {
    if (props.word) {
      if (props.position) {
        coords.value = computeInitialCoords(props.position);
      }
      fetchLookup();
    }
  },
  { immediate: true }
);

function playAudio() {
  if (!data.value?.audio && !data.value?.audio_b64) return;
  if (isPlaying.value && audioRef.value) {
    audioRef.value.pause();
    isPlaying.value = false;
    return;
  }

  const src = data.value.audio_b64
    ? `data:audio/mp3;base64,${data.value.audio_b64}`
    : data.value.audio;

  if (!src) return;

  if (!audioRef.value) {
    audioRef.value = new Audio(src);
    audioRef.value.onended = () => {
      isPlaying.value = false;
    };
  } else {
    audioRef.value.src = src;
  }

  isPlaying.value = true;
  audioRef.value.play().catch(() => {
    isPlaying.value = false;
  });
}

function handleOutsideClick(e: MouseEvent) {
  if (tooltipRef.value && !tooltipRef.value.contains(e.target as Node)) {
    emit('close');
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleOutsideClick);
  window.addEventListener('resize', updatePosition);
});

onUnmounted(() => {
  document.removeEventListener('mousedown', handleOutsideClick);
  window.removeEventListener('resize', updatePosition);
  if (audioRef.value) {
    audioRef.value.pause();
    audioRef.value = null;
  }
});
</script>

<template>
  <div
    v-if="word && position"
    ref="tooltipRef"
    class="fixed z-[100] w-[calc(100vw-24px)] max-w-[340px] sm:max-w-[380px] bg-surface border border-border rounded-2xl shadow-2xl overflow-hidden animate-in zoom-in-95 fade-in duration-200 pointer-events-auto"
    :style="{ left: `${coords.left}px`, top: `${coords.top}px` }"
  >
    <!-- Top Header -->
    <div class="p-3 bg-bg-secondary flex items-center justify-between border-b border-border">
      <div class="flex items-baseline gap-2 min-w-0 pr-2">
        <span
          class="font-bold text-text text-sm sm:text-base leading-snug line-clamp-2 select-text"
          :title="data?.word || word"
        >
          {{ data?.word || word }}
        </span>
        <span
          v-if="data?.lemma && data.lemma !== (data?.word || word).toLowerCase() && !isSentence"
          class="text-[0.68rem] text-primary font-mono font-medium truncate shrink-0"
        >
          (base: {{ data.lemma }})
        </span>
        <span class="text-[0.6rem] font-bold text-text-muted uppercase tracking-widest italic shrink-0">
          {{ data?.partOfSpeech || (isSentence ? 'sentence' : '') }}
        </span>
      </div>
      <button
        type="button"
        @click="emit('close')"
        class="p-1 hover:bg-surface rounded-md text-text-muted hover:text-text transition-colors shrink-0"
        aria-label="Close"
      >
        <X :size="15" />
      </button>
    </div>

    <div class="p-3 space-y-3 max-h-[75vh] overflow-y-auto">
      <!-- Pronunciation & Audio -->
      <div class="flex items-center gap-2">
        <button
          type="button"
          :disabled="!data?.audio && !data?.audio_b64"
          @click="playAudio"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.72rem] font-bold transition-all border shadow-xs"
          :class="
            data?.audio || data?.audio_b64
              ? 'bg-primary/10 border-primary/20 text-primary hover:bg-primary/20 active:scale-95 cursor-pointer'
              : 'bg-bg-secondary border-border text-text-muted opacity-50 cursor-not-allowed'
          "
        >
          <Volume2 :size="14" :class="{ 'animate-pulse': isPlaying }" />
          PRONOUNCE
        </button>

        <span
          v-if="data?.phonetic && !isSentence"
          class="text-[0.75rem] font-mono text-text-subtle font-medium truncate"
        >
          {{ data.phonetic }}
        </span>
      </div>

      <!-- Portuguese Translation -->
      <div class="flex items-start gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/15">
        <div class="mt-0.5 flex items-center justify-center w-5 h-5 rounded-md bg-primary/10 text-primary shrink-0">
          <Languages :size="13" />
        </div>
        <div class="flex-1 min-w-0">
          <p class="text-[0.65rem] font-black text-primary uppercase tracking-tight mb-1 leading-none">
            Tradução em Português
          </p>
          <div v-if="loading" class="space-y-1.5 pt-1">
            <div class="h-2.5 bg-primary/10 rounded w-full animate-pulse" />
            <div class="h-2.5 bg-primary/10 rounded w-3/4 animate-pulse" />
          </div>
          <div v-else-if="data?.translation">
            <p class="text-[0.88rem] sm:text-[0.92rem] font-semibold text-text leading-snug select-text">
              {{ data.translation }}
            </p>
            <p
              v-if="data.portuguese_explanation"
              class="text-[0.72rem] text-text-muted mt-1.5 leading-relaxed italic"
            >
              💡 {{ data.portuguese_explanation }}
            </p>
          </div>
          <p v-else class="text-[0.75rem] text-text-subtle italic">
            Traduzindo texto...
          </p>
        </div>
      </div>

      <!-- Example if available -->
      <div
        v-if="data?.example"
        class="p-2.5 rounded-xl bg-bg-secondary/60 border border-border/50 text-[0.75rem]"
      >
        <p class="italic text-text font-medium leading-tight">"{{ data.example }}"</p>
        <p v-if="data.example_pt" class="text-text-muted mt-0.5 text-[0.7rem] leading-tight">
          {{ data.example_pt }}
        </p>
      </div>
    </div>
  </div>
</template>
