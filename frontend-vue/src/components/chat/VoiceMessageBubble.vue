<script setup lang="ts">
import { ref, computed, watch, onUnmounted } from 'vue';
import { Play, Pause, Copy, Check, Volume2 } from 'lucide-vue-next';
import type { Message } from '@/api/types';
import { parseAIResponse } from '@/utils';
import ClickableText from './ClickableText.vue';
import { useToast } from '@/composables/useToast';
import { apiPost } from '@/api/client';

const props = defineProps<{
  message: Message;
  isSpeaking?: boolean;
  isProcessing?: boolean;
}>();

const emit = defineEmits<{
  (e: 'wordClick', word: string, x: number, y: number): void;
}>();

const toast = useToast();
const isUser = computed(() => props.message.role === 'user');
const isPlaying = ref(false);
const isPlayingCorrection = ref(false);
const isLoadingCorrection = ref(false);
const copied = ref(false);

const audioEl = ref<HTMLAudioElement | null>(null);
const correctionAudioEl = ref<HTMLAudioElement | null>(null);

const parsed = computed(() => parseAIResponse(props.message.content));
const displayReply = computed(() => parsed.value.reply || props.message.content);

const isTranscribing = computed(() => {
  return (
    isUser.value &&
    typeof props.message.id === 'string' &&
    (props.message.id.startsWith('live-temp-') ||
      props.message.id.startsWith('voice-temp-') ||
      props.message.id.startsWith('user-audio-temp') ||
      props.message.content.includes('Transcribing'))
  );
});

function handleCopy() {
  const textToCopy = isUser.value ? props.message.content : (parsed.value.reply || props.message.content);
  navigator.clipboard.writeText(textToCopy);
  copied.value = true;
  toast.success('Copied to clipboard!');
  setTimeout(() => {
    copied.value = false;
  }, 2000);
}

function toggleAudio() {
  if (!props.message.audio_b64) return;

  if (!audioEl.value) {
    audioEl.value = new Audio(`data:audio/mp3;base64,${props.message.audio_b64}`);
    audioEl.value.onended = () => { isPlaying.value = false; };
    audioEl.value.onpause = () => { isPlaying.value = false; };
    audioEl.value.onplay = () => { isPlaying.value = true; };
  }

  if (isPlaying.value) {
    audioEl.value.pause();
  } else {
    if (audioEl.value.ended || audioEl.value.currentTime > 0) {
      audioEl.value.currentTime = 0;
    }
    audioEl.value.play().catch(console.error);
  }
}

async function handlePlayCorrection(textToPlay: string) {
  if (isPlayingCorrection.value && correctionAudioEl.value) {
    correctionAudioEl.value.pause();
    isPlayingCorrection.value = false;
    return;
  }

  if (correctionAudioEl.value) {
    correctionAudioEl.value.currentTime = 0;
    correctionAudioEl.value.play().catch(console.error);
    return;
  }

  isLoadingCorrection.value = true;
  try {
    const res = await apiPost<{ audio?: string; audio_b64?: string }>('/chat/tts', { text: textToPlay });
    const audioData = res?.audio_b64 || res?.audio;
    if (audioData) {
      const audio = new Audio(`data:audio/mp3;base64,${audioData}`);
      correctionAudioEl.value = audio;
      audio.onplay = () => { isPlayingCorrection.value = true; };
      audio.onpause = () => { isPlayingCorrection.value = false; };
      audio.onended = () => { isPlayingCorrection.value = false; };
      audio.play().catch(console.error);
    }
  } catch (err) {
    console.error('Error playing correction audio:', err);
  } finally {
    isLoadingCorrection.value = false;
  }
}

watch(
  () => props.message.audio_b64,
  (newAudio) => {
    if (newAudio) {
      const newSrc = `data:audio/mp3;base64,${newAudio}`;
      if (!audioEl.value) {
        audioEl.value = new Audio(newSrc);
        audioEl.value.onplay = () => { isPlaying.value = true; };
        audioEl.value.onpause = () => { isPlaying.value = false; };
        audioEl.value.onended = () => { isPlaying.value = false; };
      } else if (audioEl.value.src !== newSrc) {
        audioEl.value.src = newSrc;
      }
    }
  }
);

onUnmounted(() => {
  if (audioEl.value) {
    audioEl.value.pause();
    audioEl.value = null;
  }
  if (correctionAudioEl.value) {
    correctionAudioEl.value.pause();
    correctionAudioEl.value = null;
  }
});
</script>

<template>
  <div
    class="flex flex-col gap-1.5 max-w-[85%] md:max-w-[75%] animate-in fade-in slide-in-from-bottom-2 duration-700 group"
    :class="isUser ? 'items-end ml-auto text-right' : 'items-start mr-auto text-left'"
  >
    <div class="flex items-center gap-2 px-2">
      <span class="text-[0.55rem] font-black text-text-subtle uppercase tracking-[0.2em]">
        {{ isUser ? 'You' : 'Teacher Tati' }}
      </span>
    </div>

    <div class="flex items-end gap-2 relative">
      <!-- User audio playback button -->
      <button
        v-if="isUser && !isTranscribing && message.audio_b64"
        type="button"
        @click="toggleAudio"
        class="p-2 rounded-full border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary transition-all duration-300 shadow-md flex items-center justify-center shrink-0 active:scale-90"
        title="Listen to your voice"
      >
        <Pause v-if="isPlaying" class="w-3 h-3" />
        <Play v-else class="w-3 h-3" />
      </button>

      <!-- User copy button -->
      <button
        v-if="isUser && !isTranscribing"
        type="button"
        @click="handleCopy"
        class="p-2 rounded-full border border-border bg-surface text-text-subtle hover:text-primary transition-all duration-300 opacity-0 group-hover:opacity-100 shadow-md flex items-center justify-center shrink-0"
        title="Copy message"
      >
        <Check v-if="copied" class="w-3 h-3 text-green-500" />
        <Copy v-else class="w-3 h-3" />
      </button>

      <!-- Main Message Bubble Container -->
      <div
        class="px-5 py-3.5 rounded-[22px] text-[0.9rem] md:text-sm font-medium leading-relaxed shadow-xl border transition-all duration-500"
        :class="
          isUser
            ? 'bg-gradient-to-br from-primary/10 to-primary/5 backdrop-blur-xl border-primary/20 text-text rounded-tr-md hover:border-primary/40'
            : 'bg-surface/90 dark:bg-[#151726]/80 backdrop-blur-2xl border-border/60 dark:border-white/10 text-text rounded-tl-md hover:border-primary/30 shadow-primary/5'
        "
      >
        <!-- User Content -->
        <template v-if="isUser">
          <div v-if="isTranscribing" class="flex items-center gap-2 text-primary font-medium text-xs sm:text-sm py-0.5">
            <span class="w-2 h-2 rounded-full bg-primary animate-pulse" />
            <span class="italic">Transcribing audio...</span>
          </div>
          <p v-else class="whitespace-pre-wrap">{{ message.content }}</p>
        </template>

        <!-- Assistant Processing Skeleton -->
        <template v-else-if="isProcessing && !displayReply">
          <div class="flex items-center gap-2 py-1 px-1">
            <div class="flex items-center gap-1.5">
              <span class="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.32s]" />
              <span class="w-2 h-2 rounded-full bg-primary animate-bounce [animation-delay:-0.16s]" />
              <span class="w-2 h-2 rounded-full bg-primary animate-bounce" />
            </div>
            <span class="text-xs text-text-subtle font-medium italic">Teacher Tati is preparing your answer...</span>
          </div>
        </template>

        <!-- Assistant Content & Pedagogical Correction -->
        <template v-else>
          <div class="flex flex-col gap-2">
            <div class="inline">
              <ClickableText
                :content="displayReply"
                @word-click="(word, x, y) => emit('wordClick', word, x, y)"
              />
            </div>

            <!-- Grammar / Pronunciation Correction Alert -->
            <div
              v-if="parsed.correction"
              class="mt-2 text-xs bg-amber-500/10 dark:bg-amber-500/5 border border-amber-500/20 text-amber-700 dark:text-amber-300 rounded-xl p-3 flex flex-col gap-2 max-w-full text-left"
            >
              <div class="flex items-start gap-2">
                <span class="text-base select-none">💡</span>
                <div class="flex-1">
                  <span class="font-bold text-amber-800 dark:text-amber-200">Teacher Tati noticed: </span>
                  <span class="italic">{{ parsed.correction }}</span>
                </div>
              </div>
              <div class="pt-1.5 border-t border-amber-500/20 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  @click="handlePlayCorrection(parsed.correction)"
                  :disabled="isLoadingCorrection"
                  class="inline-flex items-center gap-1.5 px-3 py-1 rounded-lg bg-amber-500/20 hover:bg-amber-500/30 text-amber-800 dark:text-amber-200 text-[0.7rem] font-bold transition-all disabled:opacity-50 active:scale-95 shadow-sm"
                >
                  <Volume2 class="w-3 h-3" :class="{ 'animate-pulse text-amber-600': isPlayingCorrection }" />
                  <span>
                    {{
                      isLoadingCorrection
                        ? 'Carregando áudio...'
                        : isPlayingCorrection
                        ? 'Pausar pronúncia da Tati'
                        : 'Ouvir pronúncia da Teacher Tati'
                    }}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </template>
      </div>

      <!-- Assistant audio playback and copy button -->
      <template v-if="!isUser && !isProcessing">
        <div class="flex items-center gap-2">
          <button
            type="button"
            @click="toggleAudio"
            :disabled="!message.audio_b64"
            class="p-2.5 rounded-full transition-all duration-300 shadow-lg active:scale-90 shrink-0"
            :class="[
              !message.audio_b64
                ? 'opacity-30 cursor-not-allowed grayscale'
                : isPlaying
                ? 'bg-primary text-white scale-110'
                : 'bg-surface dark:bg-white/5 text-text-subtle hover:text-primary hover:scale-110 border border-border/40'
            ]"
            title="Listen again"
          >
            <Pause v-if="isPlaying" class="w-3.5 h-3.5 fill-white" />
            <Play v-else class="w-3.5 h-3.5" />
          </button>

          <button
            type="button"
            @click="handleCopy"
            class="p-2.5 rounded-full border border-border bg-surface text-text-subtle hover:text-primary transition-all duration-300 opacity-0 group-hover:opacity-100 shadow-lg flex items-center justify-center shrink-0"
            title="Copy message"
          >
            <Check v-if="copied" class="w-3 h-3 text-green-500" />
            <Copy v-else class="w-3 h-3" />
          </button>
        </div>
      </template>
    </div>
  </div>
</template>
