<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue';
import { Play, Pause, Volume2, VolumeX, Gauge } from 'lucide-vue-next';
import { getChatTts } from '@/api/chat';
import { useAuth } from '@/composables/useAuth';
import { getStoredAccent } from '@/constants/accents';

const props = defineProps<{
  url?: string | null;
  base64?: string | null;
  text?: string;
  autoPlay?: boolean;
}>();

const emit = defineEmits<{
  (e: 'play'): void;
  (e: 'pause'): void;
}>();

const { accent } = useAuth();
const isPlaying = ref(false);
const isLoading = ref(false);
const progress = ref(0);
const duration = ref(0);
const currentTime = ref(0);
const speed = ref(1);
const showSpeedMenu = ref(false);

const activeSrc = ref<string | null>(null);
const audioEl = ref<HTMLAudioElement | null>(null);
const currentVoiceAccent = ref<string>(getStoredAccent());

function resolveSrc() {
  if (props.base64) {
    return `data:audio/mp3;base64,${props.base64}`;
  }
  if (props.url) {
    return props.url;
  }
  return null;
}

watch(
  () => [props.base64, props.url],
  () => {
    activeSrc.value = resolveSrc();
  },
  { immediate: true }
);

function handleAccentChange(newAccent: string) {
  if (props.text && currentVoiceAccent.value && currentVoiceAccent.value !== newAccent) {
    if (isPlaying.value && audioEl.value) {
      audioEl.value.pause();
      isPlaying.value = false;
    }
    activeSrc.value = null;
  }
}

watch(accent, (newAcc) => {
  if (newAcc) handleAccentChange(newAcc);
});

async function ensureAudioSrc(forceRefreshAccent = false): Promise<string | null> {
  const currentAccent = getStoredAccent();

  // If accent changed and we have the message text, re-fetch audio with new accent
  if (forceRefreshAccent || (props.text && currentVoiceAccent.value !== currentAccent) || (!activeSrc.value && props.text)) {
    if (props.text) {
      isLoading.value = true;
      try {
        const res = await getChatTts(props.text, currentAccent);
        const b64 = res.audio_b64 || res.audio;
        if (b64) {
          const fullSrc = `data:audio/mp3;base64,${b64}`;
          activeSrc.value = fullSrc;
          currentVoiceAccent.value = currentAccent;
          return fullSrc;
        }
      } catch (e) {
        console.error('Failed to regenerate TTS with updated accent:', e);
      } finally {
        isLoading.value = false;
      }
    }
  }

  if (activeSrc.value) {
    return activeSrc.value;
  }

  if (props.text) {
    isLoading.value = true;
    try {
      const res = await getChatTts(props.text, currentAccent);
      const b64 = res.audio_b64 || res.audio;
      if (b64) {
        const fullSrc = `data:audio/mp3;base64,${b64}`;
        activeSrc.value = fullSrc;
        currentVoiceAccent.value = currentAccent;
        return fullSrc;
      }
    } catch (e) {
      console.error('Failed to generate TTS:', e);
    } finally {
      isLoading.value = false;
    }
  }
  return null;
}

async function togglePlay() {
  if (isPlaying.value && audioEl.value) {
    audioEl.value.pause();
    isPlaying.value = false;
    emit('pause');
    return;
  }

  const currentAccent = getStoredAccent();
  const accentChanged = Boolean(props.text && currentVoiceAccent.value !== currentAccent);
  const src = await ensureAudioSrc(accentChanged);
  if (!src) return;

  if (!audioEl.value) {
    audioEl.value = new Audio(src);
    audioEl.value.playbackRate = speed.value;

    audioEl.value.ontimeupdate = () => {
      if (audioEl.value) {
        currentTime.value = audioEl.value.currentTime;
        duration.value = audioEl.value.duration || 0;
        progress.value = duration.value ? (currentTime.value / duration.value) * 100 : 0;
      }
    };

    audioEl.value.onended = () => {
      isPlaying.value = false;
      progress.value = 0;
      emit('pause');
    };
  } else if (audioEl.value.src !== src) {
    audioEl.value.src = src;
    audioEl.value.load();
  }

  isPlaying.value = true;
  emit('play');
  audioEl.value.play().catch(() => {
    isPlaying.value = false;
  });
}

function setSpeed(newSpeed: number) {
  speed.value = newSpeed;
  if (audioEl.value) {
    audioEl.value.playbackRate = newSpeed;
  }
  showSpeedMenu.value = false;
}

function handleSeek(e: MouseEvent) {
  const container = e.currentTarget as HTMLElement;
  const rect = container.getBoundingClientRect();
  const clickX = e.clientX - rect.left;
  const newProgress = Math.max(0, Math.min(1, clickX / rect.width));

  if (audioEl.value && duration.value) {
    audioEl.value.currentTime = newProgress * duration.value;
    progress.value = newProgress * 100;
  }
}

function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function onAccentEvent(e: any) {
  handleAccentChange(e.detail || getStoredAccent());
}

onMounted(() => {
  if (typeof window !== 'undefined') {
    window.addEventListener('tati_accent_changed', onAccentEvent);
  }
  if (props.autoPlay) {
    togglePlay();
  }
});

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('tati_accent_changed', onAccentEvent);
  }
  if (audioEl.value) {
    audioEl.value.pause();
    audioEl.value = null;
  }
});
</script>

<template>
  <div class="inline-flex items-center gap-2 p-1.5 px-2.5 rounded-xl bg-surface-hover/70 border border-border/80 text-xs">
    <!-- Play/Pause Button -->
    <button
      type="button"
      @click="togglePlay"
      :disabled="isLoading"
      class="w-7 h-7 rounded-lg bg-primary text-white flex items-center justify-center shrink-0 hover:bg-primary-hover active:scale-95 transition-all shadow-xs"
      :title="isPlaying ? 'Pause' : 'Play audio'"
    >
      <div v-if="isLoading" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
      <Pause v-else-if="isPlaying" class="w-3.5 h-3.5 fill-current" />
      <Play v-else class="w-3.5 h-3.5 fill-current ml-0.5" />
    </button>

    <!-- Progress bar & time -->
    <div class="flex flex-col gap-1 w-24 sm:w-32 cursor-pointer" @click="handleSeek">
      <div class="h-1.5 w-full bg-border rounded-full overflow-hidden relative">
        <div class="h-full bg-primary rounded-full transition-all" :style="{ width: `${progress}%` }"></div>
      </div>
      <div class="flex justify-between text-[0.62rem] text-text-subtle font-mono leading-none">
        <span>{{ formatTime(currentTime) }}</span>
        <span>{{ formatTime(duration) }}</span>
      </div>
    </div>

    <!-- Speed toggle -->
    <div class="relative">
      <button
        type="button"
        @click="showSpeedMenu = !showSpeedMenu"
        class="px-1.5 py-0.5 rounded-md hover:bg-border/60 text-[0.65rem] font-bold text-text-muted hover:text-text transition-colors"
        title="Playback Speed"
      >
        {{ speed }}x
      </button>

      <div
        v-if="showSpeedMenu"
        class="absolute bottom-full right-0 mb-1 py-1 bg-surface border border-border rounded-lg shadow-lg z-50 flex flex-col min-w-[50px]"
      >
        <button
          v-for="s in [0.8, 1, 1.2, 1.5]"
          :key="s"
          type="button"
          @click="setSpeed(s)"
          class="px-2 py-1 text-[0.7rem] hover:bg-surface-hover text-left"
          :class="{ 'text-primary font-bold': speed === s }"
        >
          {{ s }}x
        </button>
      </div>
    </div>
  </div>
</template>

