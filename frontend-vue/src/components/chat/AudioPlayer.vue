<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { Play, Pause, Volume2, VolumeX, Loader2 } from 'lucide-vue-next';
import { getStoredAccent } from '@/constants/accents';
import { useAuthStore } from '@/stores/auth';

const props = withDefaults(
  defineProps<{
    url?: string;
    base64?: string;
    text?: string;
    autoPlay?: boolean;
  }>(),
  {
    autoPlay: false,
  }
);

const emit = defineEmits<{
  (e: 'audioUpdated', newBase64: string): void;
}>();

const authStore = useAuthStore();
const isPlaying = ref(false);
const isLoadingAudio = ref(false);
const progress = ref(0);
const speed = ref(1);
const isMuted = ref(false);
const audioRef = ref<HTMLAudioElement | null>(null);
const activeBase64 = ref(props.base64);

const audioSrc = computed(() => {
  if (activeBase64.value) {
    return activeBase64.value.startsWith('data:')
      ? activeBase64.value
      : `data:audio/mp3;base64,${activeBase64.value}`;
  }
  return props.url || '';
});

watch(
  () => props.base64,
  (val) => {
    activeBase64.value = val;
  }
);

function onTimeUpdate() {
  if (audioRef.value && audioRef.value.duration) {
    progress.value = Math.min(
      100,
      (audioRef.value.currentTime / audioRef.value.duration) * 100
    );
  }
}

function onEnded() {
  isPlaying.value = false;
  progress.value = 100;
}

async function togglePlay() {
  if (isPlaying.value) {
    if (audioRef.value) {
      audioRef.value.pause();
    }
    isPlaying.value = false;
    return;
  }

  // Se não tem áudio ainda e temos texto, sintetiza com voz neural feminina do sotaque escolhido
  if (!audioSrc.value && props.text) {
    isLoadingAudio.value = true;
    try {
      const res = await fetch('/chat/tts', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: authStore.token ? `Bearer ${authStore.token}` : '',
        },
        body: JSON.stringify({
          text: props.text,
          message: props.text,
          accent: getStoredAccent(),
        }),
      });
      if (res.ok) {
        const data = await res.json();
        const b64 = data.audio || data.audio_b64;
        if (b64) {
          activeBase64.value = b64;
          emit('audioUpdated', b64);
          await nextTick();
          setTimeout(() => {
            if (audioRef.value) {
              audioRef.value.playbackRate = speed.value;
              audioRef.value.play().then(() => {
                isPlaying.value = true;
              }).catch((e) => {
                console.warn('Playback error after TTS fetch:', e);
              });
            }
          }, 60);
          return;
        }
      }
    } catch (err) {
      console.warn('TTS on-demand failed:', err);
    } finally {
      isLoadingAudio.value = false;
    }
  }

  if (audioRef.value && audioSrc.value) {
    audioRef.value.playbackRate = speed.value;
    audioRef.value
      .play()
      .then(() => {
        isPlaying.value = true;
      })
      .catch((e) => {
        console.warn('Playback error:', e);
        fallbackSpeak();
      });
  } else {
    fallbackSpeak();
  }
}

function fallbackSpeak() {
  if (typeof window === 'undefined' || !('speechSynthesis' in window) || !props.text) return;
  window.speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(props.text);
  const targetAccent = getStoredAccent();
  u.lang = targetAccent;
  u.rate = speed.value;

  // Busca estritamente voz feminina correspondente para evitar voz masculina
  const voices = window.speechSynthesis.getVoices();
  const femaleVoice = voices.find(
    (v) =>
      v.lang.toLowerCase().startsWith(targetAccent.slice(0, 2).toLowerCase()) &&
      (v.name.includes('Female') ||
        v.name.includes('Zira') ||
        v.name.includes('Jenny') ||
        v.name.includes('Sonia') ||
        v.name.includes('Natural') ||
        v.name.includes('Samantha') ||
        v.name.includes('Victoria') ||
        v.name.includes('Aria') ||
        v.name.includes('Ava')) &&
      !v.name.includes('David') &&
      !v.name.includes('George') &&
      !v.name.includes('Male')
  ) || voices.find((v) => 
    v.lang.toLowerCase().startsWith('en') && 
    !v.name.includes('David') && 
    !v.name.includes('George') && 
    !v.name.includes('Mark') && 
    !v.name.includes('Richard') && 
    !v.name.includes('Male')
  );

  if (femaleVoice) {
    u.voice = femaleVoice;
  }

  isPlaying.value = true;
  u.onend = () => { isPlaying.value = false; };
  u.onerror = () => { isPlaying.value = false; };
  window.speechSynthesis.speak(u);
}

function cycleSpeed() {
  const speeds = [1, 1.25, 1.5, 2, 0.75];
  const nextIdx = (speeds.indexOf(speed.value) + 1) % speeds.length;
  speed.value = speeds[nextIdx];
  if (audioRef.value) {
    audioRef.value.playbackRate = speed.value;
  }
}

function toggleMute() {
  isMuted.value = !isMuted.value;
  if (audioRef.value) {
    audioRef.value.muted = isMuted.value;
  }
}

onMounted(() => {
  if (props.autoPlay && audioSrc.value) {
    togglePlay();
  }
});

onUnmounted(() => {
  if (audioRef.value) {
    audioRef.value.pause();
    audioRef.value = null;
  }
});
</script>

<template>
  <div class="flex flex-col gap-2 mt-2 max-w-full overflow-x-hidden animate-fade-in">
    <div class="flex items-center gap-1.5 sm:gap-2 bg-surface/80 dark:bg-bgSecondary/80 backdrop-blur-sm border border-line rounded-xl px-2.5 sm:px-3 py-1.5 sm:py-2 w-fit max-w-full shadow-xs flex-nowrap">
      <audio
        ref="audioRef"
        :src="audioSrc"
        @timeupdate="onTimeUpdate"
        @ended="onEnded"
      />

      <!-- Play / Pause Button -->
      <button
        type="button"
        class="h-7 w-7 sm:h-8 sm:w-8 flex items-center justify-center rounded-lg bg-primary hover:bg-primaryHover text-white transition-all shadow-xs active:scale-95 cursor-pointer shrink-0"
        :title="isPlaying ? 'Pausar áudio' : 'Ouvir Teacher Tati'"
        :disabled="isLoadingAudio"
        @click="togglePlay"
      >
        <Loader2 v-if="isLoadingAudio" :size="14" class="animate-spin text-white" />
        <Pause v-else-if="isPlaying" :size="14" class="fill-current" />
        <Play v-else :size="14" class="fill-current ml-0.5" />
      </button>

      <!-- Waveform / Progress bar -->
      <div class="w-20 sm:w-28 md:w-36 h-2 bg-line rounded-full overflow-hidden shrink-0">
        <div
          class="h-full bg-primary rounded-full transition-all duration-100"
          :style="{ width: `${progress}%` }"
        />
      </div>

      <!-- Playback Speed Button -->
      <button
        type="button"
        class="text-[10px] sm:text-xs font-bold text-muted hover:text-ink px-1.5 py-0.5 rounded border border-line/60 hover:bg-bgSecondary transition cursor-pointer shrink-0"
        title="Velocidade de reprodução"
        @click="cycleSpeed"
      >
        {{ speed }}x
      </button>

      <!-- Mute / Unmute Button -->
      <button
        type="button"
        class="p-1 text-muted hover:text-ink rounded transition cursor-pointer shrink-0"
        :title="isMuted ? 'Ativar som' : 'Silenciar áudio'"
        @click="toggleMute"
      >
        <VolumeX v-if="isMuted" :size="14" />
        <Volume2 v-else :size="14" />
      </button>
    </div>
  </div>
</template>
