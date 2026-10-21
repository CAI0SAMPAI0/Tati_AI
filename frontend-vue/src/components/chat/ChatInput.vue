<script setup lang="ts">
import { ref, watch, nextTick, onMounted, onUnmounted } from 'vue';
import { ArrowUp, Mic, Square } from 'lucide-vue-next';
import { useToast } from '@/composables/useToast';

const props = defineProps<{
  disabled?: boolean;
  isStreaming?: boolean;
}>();

const emit = defineEmits<{
  (e: 'send', text: string): void;
  (e: 'sendAudio', base64: string): void;
}>();

const toast = useToast();
const text = ref('');
const isRecording = ref(false);
const recordingTime = ref(0);
const textareaRef = ref<HTMLTextAreaElement | null>(null);

let timerInterval: any = null;
let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];

function autoResize() {
  const el = textareaRef.value;
  if (el) {
    el.style.height = 'auto';
    el.style.height = `${Math.min(el.scrollHeight, 140)}px`;
  }
}

watch(text, () => {
  nextTick(autoResize);
});

function handleSend() {
  const trimmed = text.value.trim();
  if (!trimmed || props.disabled || props.isStreaming) return;
  emit('send', trimmed);
  text.value = '';
  nextTick(autoResize);
}

function handleKeyDown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault();
    handleSend();
  }
}

async function startRecording() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const blob = new Blob(audioChunks, { type: 'audio/webm' });
      const reader = new FileReader();
      reader.onloadend = () => {
        const result = reader.result as string;
        const base64 = result.split(',')[1];
        if (base64) {
          emit('sendAudio', base64);
        }
      };
      reader.readAsDataURL(blob);
      stream.getTracks().forEach((track) => track.stop());
    };

    mediaRecorder.start();
    recordingTime.value = 0;
    isRecording.value = true;
    timerInterval = setInterval(() => {
      recordingTime.value += 1;
    }, 1000);
  } catch (err) {
    console.error('Microphone error:', err);
    toast.error('Could not access microphone.');
  }
}

function stopRecording() {
  if (mediaRecorder && isRecording.value) {
    mediaRecorder.stop();
    isRecording.value = false;
    if (timerInterval) clearInterval(timerInterval);
  }
}

function formatRecordingTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

onUnmounted(() => {
  if (timerInterval) clearInterval(timerInterval);
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
});
</script>

<template>
  <div class="p-2 md:p-4 bg-transparent shrink-0">
    <div class="max-w-3xl mx-auto relative">
      <div
        class="flex items-end gap-2.5 bg-surface border rounded-2xl p-3 md:p-3.5 border-border shadow-sm focus-within:border-primary/50 focus-within:ring-2 focus-within:ring-primary/10 transition-all"
        :class="{ 'border-red-500/40 ring-2 ring-red-500/10': isRecording }"
      >
        <!-- Audio recording state -->
        <div
          v-if="isRecording"
          class="flex-1 flex items-center justify-center py-2 h-[42px] text-red-500 animate-pulse font-medium text-sm"
        >
          Recording audio... {{ formatRecordingTime(recordingTime) }}
        </div>

        <!-- Normal Text Input -->
        <textarea
          v-else
          ref="textareaRef"
          v-model="text"
          rows="1"
          placeholder="Type your message..."
          @keydown="handleKeyDown"
          :disabled="disabled || isStreaming"
          class="flex-1 bg-transparent border-none outline-none text-base text-foreground placeholder:text-text-muted py-1.5 px-1 resize-none min-h-[38px] max-h-[140px] scrollbar-none leading-relaxed"
        ></textarea>

        <!-- Action Buttons -->
        <div class="flex items-center gap-1.5 shrink-0 pb-0.5">
          <!-- Mic / Stop Recording Button -->
          <button
            v-if="isRecording"
            type="button"
            @click="stopRecording"
            class="p-2.5 rounded-xl bg-red-500 text-white hover:bg-red-600 transition-all shadow-sm active:scale-95 cursor-pointer"
            title="Stop recording"
          >
            <div class="w-4 h-4 rounded-xs bg-current"></div>
          </button>
          <button
            v-else
            type="button"
            @click="startRecording"
            :disabled="disabled || isStreaming"
            class="p-2.5 rounded-xl text-text-muted hover:bg-surface-hover hover:text-foreground transition-colors disabled:opacity-40 cursor-pointer"
            :class="{ 'hover:text-primary': !text.trim() }"
            title="Record audio"
          >
            <Mic class="w-5 h-5" />
          </button>

          <!-- Send Button -->
          <button
            v-if="!isRecording"
            type="button"
            @click="handleSend"
            :disabled="!text.trim() || disabled || isStreaming"
            class="p-2.5 rounded-xl bg-primary text-white transition-all active:scale-95 disabled:opacity-30 disabled:scale-100 disabled:pointer-events-none shadow-sm cursor-pointer"
            :class="{ 'hover:bg-primary-hover shadow-primary/20': text.trim() }"
            title="Send"
          >
            <ArrowUp class="w-4 h-4" />
          </button>
        </div>
      </div>

      <p class="mt-2 text-[0.7rem] text-center text-text-muted">
        Taty's Hub practices English with you · Enter to send · Shift+Enter for new line
      </p>
    </div>
  </div>
</template>

