<script setup lang="ts">
import { ref, computed } from 'vue';
import { Pencil, Check, X, Copy, Volume2, FileText } from 'lucide-vue-next';
import type { Message } from '@/api/types';
import { parseAIResponse, formatTime } from '@/utils';
import ClickableText from './ClickableText.vue';
import AudioPlayer from './AudioPlayer.vue';
import TatiLogo from '../ui/TatiLogo.vue';
import { getChatTts } from '@/api/chat';
import { useAuth } from '@/composables/useAuth';
import { useToast } from '@/composables/useToast';

const props = defineProps<{
  message: Message;
  isStreaming?: boolean;
}>();

const emit = defineEmits<{
  (e: 'wordClick', word: string, x: number, y: number): void;
  (e: 'edit', messageId: string, newContent: string): void;
}>();

const { accent } = useAuth();
const toast = useToast();
const isUser = computed(() => props.message.role === 'user');

const isEditing = ref(false);
const editContent = ref(props.message.content);
const isSaving = ref(false);
const copied = ref(false);

const isPlayingUser = ref(false);
const userAudioEl = ref<HTMLAudioElement | null>(null);

const isPlayingCorrection = ref(false);
const isLoadingCorrection = ref(false);
const correctionAudioEl = ref<HTMLAudioElement | null>(null);

const parsed = computed(() => parseAIResponse(props.message.content));

const hasAudio = computed(() => {
  return !isUser.value && (Boolean(props.message.audio_b64) || Boolean(props.message.audio_url) || Boolean(parsed.value.reply));
});

function handleCopy() {
  const textToCopy = isUser.value ? props.message.content : parsed.value.reply;
  navigator.clipboard.writeText(textToCopy);
  copied.value = true;
  toast.success('Copied to clipboard!');
  setTimeout(() => {
    copied.value = false;
  }, 2000);
}

function handleStartEdit() {
  editContent.value = props.message.content;
  isEditing.value = true;
}

function handleCancelEdit() {
  isEditing.value = false;
  editContent.value = props.message.content;
}

async function handleSaveEdit() {
  if (!editContent.value.trim() || editContent.value.trim() === props.message.content) {
    isEditing.value = false;
    return;
  }
  isSaving.value = true;
  try {
    emit('edit', props.message.id, editContent.value.trim());
    isEditing.value = false;
  } finally {
    isSaving.value = false;
  }
}

function handleToggleUserAudio() {
  if (!props.message.audio_b64) return;
  if (isPlayingUser.value && userAudioEl.value) {
    userAudioEl.value.pause();
    isPlayingUser.value = false;
    return;
  }

  if (!userAudioEl.value) {
    userAudioEl.value = new Audio(`data:audio/mp3;base64,${props.message.audio_b64}`);
    userAudioEl.value.onended = () => {
      isPlayingUser.value = false;
    };
  }

  isPlayingUser.value = true;
  userAudioEl.value.play().catch(() => {
    isPlayingUser.value = false;
  });
}

async function handlePlayCorrection(text: string) {
  if (isPlayingCorrection.value && correctionAudioEl.value) {
    correctionAudioEl.value.pause();
    isPlayingCorrection.value = false;
    return;
  }

  if (!correctionAudioEl.value) {
    isLoadingCorrection.value = true;
    try {
      const res = await getChatTts(text, accent.value || 'en-US');
      const b64 = res.audio_b64 || res.audio;
      if (b64) {
        correctionAudioEl.value = new Audio(`data:audio/mp3;base64,${b64}`);
        correctionAudioEl.value.onended = () => {
          isPlayingCorrection.value = false;
        };
      }
    } catch (e) {
      console.error('Error playing correction audio:', e);
    } finally {
      isLoadingCorrection.value = false;
    }
  }

  if (correctionAudioEl.value) {
    isPlayingCorrection.value = true;
    correctionAudioEl.value.play().catch(() => {
      isPlayingCorrection.value = false;
    });
  }
}
</script>

<template>
  <div
    class="flex gap-3 max-w-[85%] animate-fade-in group"
    :class="isUser ? 'ml-auto flex-row-reverse' : 'mr-auto'"
  >
    <!-- Avatar for assistant -->
    <div
      v-if="!isUser"
      class="w-7 h-7 rounded-full border border-border overflow-hidden shrink-0 mt-1 shadow-sm bg-surface flex items-center justify-center"
    >
      <TatiLogo :size="28" class="w-full h-full object-cover" />
    </div>

    <div class="flex flex-col gap-1" :class="isUser ? 'items-end' : 'items-start'">
      <!-- Message Card -->
      <div
        class="relative px-4 py-3 rounded-2xl text-[0.9375rem] leading-relaxed break-words shadow-xs transition-all"
        :class="
          isUser
            ? 'bg-primary text-white rounded-br-xs font-normal'
            : 'bg-surface border border-border text-foreground rounded-bl-xs hover:border-primary/25'
        "
      >
        <!-- User Editing Mode -->
        <div v-if="isEditing" class="flex flex-col gap-2 w-full min-w-[260px] sm:min-w-[360px]">
          <textarea
            v-model="editContent"
            rows="3"
            class="w-full bg-white/10 text-white border border-white/20 rounded-xl p-2.5 text-sm outline-none focus:border-white/40 resize-y"
          ></textarea>
          <div class="flex justify-end gap-2">
            <button
              type="button"
              @click="handleCancelEdit"
              :disabled="isSaving"
              class="px-2.5 py-1 text-xs text-white/80 hover:bg-white/10 rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              @click="handleSaveEdit"
              :disabled="isSaving"
              class="px-3 py-1 text-xs font-semibold bg-white text-primary rounded-lg hover:bg-white/90 transition-colors flex items-center gap-1"
            >
              <Check class="w-3.5 h-3.5" />
              Save
            </button>
          </div>
        </div>

        <!-- Normal Message Content -->
        <div v-else>
          <!-- User message -->
          <template v-if="isUser">
            <p class="whitespace-pre-wrap">{{ message.content }}</p>

            <!-- User voice playback button if audio present -->
            <div v-if="message.audio_b64" class="pt-2">
              <button
                type="button"
                @click="handleToggleUserAudio"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-white/20 hover:bg-white/30 text-white text-xs font-semibold backdrop-blur-sm transition-all active:scale-95 shadow-sm"
              >
                <Volume2 class="w-3.5 h-3.5" :class="{ 'animate-pulse': isPlayingUser }" />
                <span>{{ isPlayingUser ? 'Pause audio' : 'Listen to your voice' }}</span>
              </button>
            </div>
          </template>

          <!-- Assistant message -->
          <template v-else>
            <!-- Streaming indicator -->
            <div v-if="isStreaming && !parsed.reply" class="flex items-center gap-1.5 py-1">
              <span class="w-2.5 h-2.5 rounded-full bg-primary animate-bounce [animation-delay:-0.32s]"></span>
              <span class="w-2.5 h-2.5 rounded-full bg-primary animate-bounce [animation-delay:-0.16s]"></span>
              <span class="w-2.5 h-2.5 rounded-full bg-primary animate-bounce"></span>
            </div>

            <!-- Assistant Text with Clickable Words -->
            <div v-else class="space-y-2">
              <ClickableText
                :content="parsed.reply"
                @word-click="(word, x, y) => emit('wordClick', word, x, y)"
              />

              <!-- Teacher correction box -->
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
                          : 'Ouvir como a Teacher Tati pronuncia'
                      }}
                    </span>
                  </button>
                </div>
              </div>

              <!-- Assistant Audio Player -->
              <div v-if="hasAudio && !isStreaming" class="pt-2">
                <AudioPlayer
                  :base64="message.audio_b64"
                  :url="message.audio_url"
                  :text="parsed.reply"
                />
              </div>
            </div>
          </template>
        </div>
      </div>

      <!-- Action row: timestamp, copy, edit -->
      <div
        class="flex items-center gap-2 text-[0.68rem] text-text-subtle px-1"
        :class="isUser ? 'flex-row-reverse' : 'flex-row'"
      >
        <span>{{ formatTime(message.created_at) }}</span>

        <button
          v-if="isUser && !isEditing"
          type="button"
          @click="handleStartEdit"
          class="opacity-0 group-hover:opacity-100 hover:text-primary transition-opacity"
          title="Edit message"
        >
          <Pencil class="w-3 h-3" />
        </button>

        <button
          type="button"
          @click="handleCopy"
          class="opacity-0 group-hover:opacity-100 hover:text-primary transition-opacity"
          title="Copy message"
        >
          <Copy class="w-3 h-3" />
        </button>
      </div>
    </div>
  </div>
</template>

