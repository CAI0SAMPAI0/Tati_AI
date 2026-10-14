<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { ArrowUp, Mic, Square } from 'lucide-vue-next';

const props = withDefaults(
  defineProps<{
    disabled?: boolean;
    isStreaming?: boolean;
    placeholder?: string;
  }>(),
  {
    disabled: false,
    isStreaming: false,
    placeholder: 'Type your message...',
  }
);

const emit = defineEmits<{
  (e: 'send', text: string): void;
  (e: 'send-audio', base64: string): void;
}>();

const text = ref('');
const isRecording = ref(false);
const recordingTime = ref(0);
const textareaRef = ref<HTMLTextAreaElement | null>(null);

let recordingInterval: number | null = null;
let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let audioStream: MediaStream | null = null;

function autoResize() {
  const el = textareaRef.value;
  if (el) {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }
}

watch(text, () => {
  nextTick(() => autoResize());
});

function handleSend() {
  const trimmed = text.value.trim();
  if (!trimmed || props.disabled || props.isStreaming) return;
  emit('send', trimmed);
  text.value = '';
  nextTick(() => {
    if (textareaRef.value) {
      textareaRef.value.style.height = '38px';
    }
  });
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

async function startRecording() {
  if (props.disabled || props.isStreaming) return;
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioStream = stream;

    let mimeType = 'audio/webm';
    if (typeof MediaRecorder !== 'undefined' && typeof MediaRecorder.isTypeSupported === 'function') {
      if (MediaRecorder.isTypeSupported('audio/webm;codecs=opus')) {
        mimeType = 'audio/webm;codecs=opus';
      } else if (MediaRecorder.isTypeSupported('audio/mp4')) {
        mimeType = 'audio/mp4';
      }
    }

    const recorder = new MediaRecorder(stream, { mimeType });
    mediaRecorder = recorder;
    audioChunks = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        audioChunks.push(e.data);
      }
    };

    recorder.onstop = () => {
      const blob = new Blob(audioChunks, { type: mimeType });
      const reader = new FileReader();
      reader.onloadend = () => {
        const resultStr = reader.result as string;
        const base64 = resultStr.includes(',') ? resultStr.split(',')[1] : resultStr;
        if (base64) {
          emit('send-audio', base64);
        }
      };
      reader.readAsDataURL(blob);

      if (audioStream) {
        audioStream.getTracks().forEach((track) => track.stop());
        audioStream = null;
      }
    };

    recorder.start(250);
    recordingTime.value = 0;
    isRecording.value = true;

    recordingInterval = window.setInterval(() => {
      recordingTime.value++;
    }, 1000);
  } catch (err) {
    console.error('Failed to access microphone:', err);
    alert('Não foi possível acessar o microfone. Verifique as permissões do seu navegador.');
  }
}

function stopRecording() {
  if (recordingInterval) {
    clearInterval(recordingInterval);
    recordingInterval = null;
  }
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  isRecording.value = false;
}

onUnmounted(() => {
  if (recordingInterval) clearInterval(recordingInterval);
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  if (audioStream) {
    audioStream.getTracks().forEach((t) => t.stop());
  }
});
</script>

<template>
  <div class="p-2 md:p-6 bg-gradient-to-t from-bg via-bg/80 to-transparent">
    <div class="max-w-4xl mx-auto w-full">
      <div class="p-2 md:p-4 bg-transparent shrink-0">
        <div class="max-w-3xl mx-auto relative">
          <label class="block relative">
            <span class="sr-only">Your message</span>
            <div
              class="flex items-end gap-2.5 bg-surface border rounded-2xl p-3 md:p-3.5 border-border shadow-sm focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all"
              :class="{ 'border-rose-500/50 ring-2 ring-rose-500/10': isRecording }"
            >
              <!-- When Recording Audio -->
              <div
                v-if="isRecording"
                class="flex-1 flex items-center justify-center py-2 h-[38px] text-rose-500 animate-pulse font-medium text-sm"
              >
                Recording audio... {{ formatTime(recordingTime) }}
              </div>

              <!-- Textarea -->
              <textarea
                v-else
                ref="textareaRef"
                rows="1"
                v-model="text"
                :placeholder="placeholder"
                :disabled="disabled || isStreaming"
                class="flex-1 bg-transparent border-none outline-none text-base text-foreground placeholder:text-muted py-1.5 px-1 resize-none min-h-[38px] max-h-[140px] scrollbar-none leading-relaxed"
                style="height: 38px;"
                @keydown="handleKeyDown"
              />

              <!-- Action Buttons -->
              <div class="flex items-center gap-1.5 shrink-0 pb-0.5">
                <!-- Recording Controls -->
                <button
                  v-if="isRecording"
                  type="button"
                  aria-label="Stop recording"
                  title="Stop recording"
                  class="p-2.5 rounded-xl bg-rose-500 text-white hover:bg-rose-600 transition-all shadow-sm active:scale-95 cursor-pointer"
                  @click="stopRecording"
                >
                  <Square :size="16" class="fill-current" />
                </button>

                <!-- Mic Trigger Button -->
                <button
                  v-else
                  type="button"
                  aria-label="Record audio"
                  title="Record audio"
                  :disabled="disabled || isStreaming"
                  class="p-2.5 rounded-xl text-muted hover:bg-surface-hover hover:text-foreground transition-colors disabled:opacity-40 cursor-pointer hover:text-primary"
                  @click="startRecording"
                >
                  <Mic :size="19" />
                </button>

                <!-- Send Message Button -->
                <button
                  v-if="!isRecording"
                  type="button"
                  aria-label="Send message"
                  title="Send"
                  :disabled="!text.trim() || disabled || isStreaming"
                  class="p-2.5 rounded-xl bg-primary text-on-primary transition-all active:scale-95 disabled:opacity-30 disabled:scale-100 disabled:pointer-events-none shadow-sm cursor-pointer"
                  @click="handleSend"
                >
                  <ArrowUp :size="18" />
                </button>
              </div>
            </div>
          </label>

          <p class="mt-2 text-[0.7rem] text-center text-muted">
            Taty's Hub practices English with you · Enter to send · Shift+Enter for new line
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
