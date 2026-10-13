<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { Volume2, X, Languages } from 'lucide-vue-next';
import { useAuthStore } from '../../stores/auth';
import { getStoredAccent } from '../../constants/accents';

export interface WordLookupData {
  word: string;
  lemma?: string;
  partOfSpeech?: string;
  phonetic?: string;
  translation: string;
  english_definition?: string;
  portuguese_explanation?: string;
  example?: string;
  example_pt?: string;
  audio?: string;
  audio_b64?: string;
}

const props = defineProps<{
  word: string | null;
  position: { x: number; y: number } | null;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const authStore = useAuthStore();

const loading = ref(true);
const data = ref<WordLookupData | null>(null);
const tatiAudio = ref<string | null>(null);
const isPlaying = ref(false);
const coords = ref<{ left: number; top: number }>({ left: 16, top: 16 });

const tooltipRef = ref<HTMLDivElement | null>(null);
let audioElement: HTMLAudioElement | null = null;

const isSentence = computed(() => {
  return Boolean(props.word && (props.word.includes(' ') || props.word.length > 30));
});

function updatePosition() {
  if (!props.position || typeof window === 'undefined') return;

  const tooltipEl = tooltipRef.value;
  const width = tooltipEl?.offsetWidth || 320;
  const height = tooltipEl?.offsetHeight || 160;
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

async function fetchData(targetWord: string) {
  loading.value = true;
  data.value = null;
  tatiAudio.value = null;

  const cleanedWord = isSentence.value
    ? targetWord.trim()
    : targetWord.toLowerCase().replace(/[^a-z'-]/g, '');

  if (!cleanedWord) {
    loading.value = false;
    return;
  }

  const accent = getStoredAccent();
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (authStore.token) {
    headers['Authorization'] = `Bearer ${authStore.token}`;
  }

  try {
    const res = await fetch('/chat/word-lookup', {
      method: 'POST',
      headers,
      body: JSON.stringify({ word: cleanedWord, accent }),
    });

    if (res.ok) {
      const result: WordLookupData = await res.json();
      if (result && result.translation) {
        data.value = result;
        const audio = result.audio || result.audio_b64;
        if (audio) {
          tatiAudio.value = audio;
        } else {
          // Fetch TTS
          fetch('/chat/tts', {
            method: 'POST',
            headers,
            body: JSON.stringify({ text: cleanedWord, accent }),
          })
            .then((r) => r.ok ? r.json() : null)
            .then((ttsData) => {
              if (ttsData?.audio) tatiAudio.value = ttsData.audio;
            })
            .catch(() => {});
        }
      } else {
        await handleFallbackTranslation(cleanedWord, headers, accent);
      }
    } else {
      await handleFallbackTranslation(cleanedWord, headers, accent);
    }
  } catch (err) {
    console.error('Error fetching word translation:', err);
    await handleFallbackTranslation(cleanedWord, headers, accent);
  } finally {
    loading.value = false;
    await nextTick();
    updatePosition();
  }
}

async function handleFallbackTranslation(cleanedWord: string, headers: Record<string, string>, accent: string) {
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

  fetch('/chat/tts', {
    method: 'POST',
    headers,
    body: JSON.stringify({ text: cleanedWord, accent }),
  })
    .then((r) => r.ok ? r.json() : null)
    .then((ttsData) => {
      if (ttsData?.audio) tatiAudio.value = ttsData.audio;
    })
    .catch(() => {});
}

function playAudio() {
  if (!tatiAudio.value) return;
  if (audioElement) {
    audioElement.pause();
  }
  const url = `data:audio/mp3;base64,${tatiAudio.value}`;
  audioElement = new Audio(url);
  isPlaying.value = true;
  audioElement.onended = () => {
    isPlaying.value = false;
  };
  audioElement.onerror = () => {
    isPlaying.value = false;
  };
  audioElement.play().catch(() => {
    isPlaying.value = false;
  });
}

function handleOutsideClick(e: MouseEvent | TouchEvent) {
  if (tooltipRef.value && !tooltipRef.value.contains(e.target as Node)) {
    emit('close');
  }
}

watch(
  () => props.word,
  (newWord) => {
    if (newWord) {
      fetchData(newWord);
    }
  },
  { immediate: true }
);

watch(
  () => props.position,
  () => {
    nextTick(updatePosition);
  },
  { deep: true }
);

onMounted(() => {
  document.addEventListener('mousedown', handleOutsideClick);
  document.addEventListener('touchstart', handleOutsideClick);
  window.addEventListener('resize', updatePosition);
  window.addEventListener('scroll', updatePosition, true);
  nextTick(updatePosition);
});

onUnmounted(() => {
  document.removeEventListener('mousedown', handleOutsideClick);
  document.removeEventListener('touchstart', handleOutsideClick);
  window.removeEventListener('resize', updatePosition);
  window.removeEventListener('scroll', updatePosition, true);
  if (audioElement) {
    audioElement.pause();
  }
});
</script>

<template>
  <div
    v-if="word && position"
    ref="tooltipRef"
    class="fixed z-[100] w-[calc(100vw-24px)] max-w-[340px] sm:max-w-[380px] bg-surface border border-line rounded-2xl shadow-2xl overflow-hidden animate-fade-in pointer-events-auto"
    :style="{ left: `${coords.left}px`, top: `${coords.top}px` }"
  >
    <!-- Top Header -->
    <div class="p-3 bg-bg flex items-center justify-between border-b border-line">
      <div class="flex items-baseline gap-2 min-w-0 pr-2">
        <span
          class="font-bold text-ink text-sm sm:text-base leading-snug line-clamp-2 select-text"
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
        <span class="text-[0.6rem] font-bold text-muted uppercase tracking-widest italic shrink-0">
          {{ data?.partOfSpeech || (isSentence ? 'sentence' : '') }}
        </span>
      </div>
      <button
        type="button"
        class="p-1 hover:bg-surface rounded-md text-muted hover:text-ink transition-colors shrink-0 cursor-pointer"
        aria-label="Fechar"
        @click="$emit('close')"
      >
        <X :size="15" />
      </button>
    </div>

    <div class="p-3 space-y-3 max-h-[75vh] overflow-y-auto">
      <!-- Pronunciation & Audio -->
      <div class="flex items-center gap-2">
        <button
          type="button"
          :disabled="!tatiAudio"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[0.72rem] font-bold transition-all border shadow-xs cursor-pointer"
          :class="
            tatiAudio
              ? 'bg-primary/10 border-primary/25 text-primary hover:bg-primary/20 active:scale-95'
              : 'bg-bg border-line text-muted opacity-50 cursor-not-allowed'
          "
          @click="playAudio"
        >
          <Volume2 :size="14" :class="{ 'animate-pulse': isPlaying }" />
          PRONOUNCE
        </button>

        <span
          v-if="data?.phonetic && !isSentence"
          class="text-[0.75rem] font-mono text-muted font-medium truncate"
        >
          {{ data.phonetic }}
        </span>
      </div>

      <!-- Portuguese Translation -->
      <div class="flex items-start gap-2.5 p-3 rounded-xl bg-primary/5 border border-primary/20">
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
            <p class="text-[0.88rem] sm:text-[0.92rem] font-semibold text-ink leading-snug select-text">
              {{ data.translation }}
            </p>
            <p
              v-if="data.portuguese_explanation"
              class="text-[0.72rem] text-muted mt-1.5 leading-relaxed italic"
            >
              💡 {{ data.portuguese_explanation }}
            </p>
          </div>
          <p v-else class="text-[0.75rem] text-muted italic">Traduzindo frase...</p>
        </div>
      </div>
    </div>
  </div>
</template>
