<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import {
  Mic,
  X,
  Volume2,
  Sparkles,
  PhoneOff,
  MicOff,
  Square,
  RotateCcw,
  Plus,
} from 'lucide-vue-next';
import { useVoiceSocket } from '@/composables/useVoiceSocket';
import { useAuth } from '@/composables/useAuth';
import { useToast } from '@/composables/useToast';

const router = useRouter();
const route = useRoute();
const toast = useToast();
const { accent } = useAuth();

const convIdParam = computed(() => (route.query.conv_id as string) || null);
const convId = ref<string | null>(convIdParam.value);

const {
  state,
  transcription: lastTranscript,
  lastAudio,
  activeConvId,
  sendAudio,
  createNewConversation,
} = useVoiceSocket(convId);

watch(activeConvId, (newId) => {
  if (newId && newId !== convId.value) {
    convId.value = newId;
    router.replace({ path: '/voice-only', query: { ...route.query, conv_id: newId } });
  }
});

async function handleNewVoiceConversation() {
  if (audioEl.value) audioEl.value.pause();
  convId.value = null;
  const newId = await createNewConversation();
  if (newId) {
    convId.value = newId;
    router.replace({ path: '/voice-only', query: { ...route.query, conv_id: newId } });
    toast.success('New conversation started!');
  }
}

const audioEl = ref<HTMLAudioElement | null>(null);
const isRecording = ref(false);
const mediaRecorderRef = ref<MediaRecorder | null>(null);
const streamRef = ref<MediaStream | null>(null);
const audioChunksRef = ref<Blob[]>([]);

watch(lastAudio, (newAudio) => {
  if (newAudio && audioEl.value) {
    audioEl.value.src = `data:audio/mp3;base64,${newAudio}`;
    audioEl.value.load();
    audioEl.value.play().then(() => {
      state.value = 'speaking';
    }).catch(() => {
      state.value = 'idle';
    });
  }
});

async function startRecording() {
  if (audioEl.value) {
    audioEl.value.pause();
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    streamRef.value = stream;

    const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
      ? 'audio/webm;codecs=opus'
      : MediaRecorder.isTypeSupported('audio/webm')
      ? 'audio/webm'
      : MediaRecorder.isTypeSupported('audio/mp4')
      ? 'audio/mp4'
      : '';

    const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream);
    mediaRecorderRef.value = recorder;
    audioChunksRef.value = [];

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) {
        audioChunksRef.value.push(e.data);
      }
    };

    recorder.onstop = async () => {
      try {
        const recordedType = recorder.mimeType || 'audio/webm';
        const blob = new Blob(audioChunksRef.value, { type: recordedType });
        if (blob.size > 0) {
          const reader = new FileReader();
          reader.onloadend = () => {
            const result = reader.result as string;
            if (result && result.includes(',')) {
              const base64 = result.split(',')[1];
              if (base64 && base64.trim().length > 0) {
                sendAudio(base64, accent.value || 'en-US');
              }
            }
          };
          reader.readAsDataURL(blob);
        } else {
          state.value = 'idle';
        }
      } finally {
        if (streamRef.value) {
          streamRef.value.getTracks().forEach((t: MediaStreamTrack) => t.stop());
          streamRef.value = null;
        }
      }
    };

    recorder.start(200);
    state.value = 'listening';
    isRecording.value = true;
  } catch (err) {
    console.error('[VoiceOnly] Mic error:', err);
    toast.error('Mic error: permission denied.');
    state.value = 'idle';
    isRecording.value = false;
  }
}

function stopRecording() {
  if (mediaRecorderRef.value && mediaRecorderRef.value.state !== 'inactive') {
    mediaRecorderRef.value.stop();
    state.value = 'processing';
  }
  isRecording.value = false;
}

function toggleSession() {
  if (state.value === 'listening' || isRecording.value) {
    stopRecording();
  } else {
    startRecording();
  }
}
</script>

<template>
  <div class="fixed inset-0 bg-[#0e0c1a] text-white flex flex-col items-center justify-between p-8 z-[100] safe-area-inset select-none font-sans">
    <audio ref="audioEl" playsinline @ended="state = 'idle'" />

    <!-- Header -->
    <header class="w-full flex justify-between items-center">
      <div class="flex items-center gap-2">
        <div class="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center">
          <Sparkles :size="16" class="text-primary" />
        </div>
        <span class="font-bold text-sm tracking-tight">Tati Voice Mode</span>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          @click="handleNewVoiceConversation"
          class="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 rounded-full hover:bg-white/20 transition-colors text-xs font-bold cursor-pointer"
          title="Start a new conversation"
        >
          <Plus :size="14" />
          <span>New</span>
        </button>
        <button
          type="button"
          @click="router.back()"
          class="p-2.5 bg-white/5 rounded-full hover:bg-white/10 transition-colors cursor-pointer"
          aria-label="Close"
        >
          <X :size="20" />
        </button>
      </div>
    </header>

    <!-- Visualizer Area -->
    <div class="flex-1 flex flex-col items-center justify-center w-full gap-12">
      <div class="relative flex items-center justify-center">
        <!-- Pulsing visualizer rings -->
        <div
          v-if="state === 'listening' || state === 'processing'"
          class="absolute inset-[-40px] rounded-full bg-primary/25 animate-ping pointer-events-none"
        />
        <div
          v-if="state === 'listening' || state === 'processing'"
          class="absolute inset-[-20px] rounded-full bg-purple-500/30 animate-pulse pointer-events-none"
        />

        <button
          type="button"
          @click="toggleSession"
          class="relative w-48 h-48 rounded-full flex items-center justify-center shadow-2xl transition-all duration-500 z-10 cursor-pointer"
          :class="[
            state === 'listening'
              ? 'bg-danger shadow-danger/20 scale-105'
              : state === 'processing'
              ? 'bg-amber-500 shadow-amber-500/20'
              : 'bg-primary shadow-primary/20 hover:scale-105 active:scale-95'
          ]"
        >
          <Square v-if="state === 'listening'" :size="56" class="fill-white" />
          <RotateCcw v-else-if="state === 'processing'" :size="56" class="animate-spin text-white" />
          <Mic v-else :size="64" class="text-white" />
        </button>
      </div>

      <div class="text-center space-y-4 max-w-sm px-4">
        <h2 class="text-2xl font-black">
          {{
            state === 'processing'
              ? 'Tati is thinking...'
              : state === 'listening'
              ? "I'm listening..."
              : 'Tap to start talking'
          }}
        </h2>
        <p class="text-white/40 text-sm italic min-h-[3rem] leading-relaxed">
          {{ lastTranscript ? `"${lastTranscript}"` : "Try saying 'Hello Tati, how are you today?'" }}
        </p>
      </div>
    </div>

    <!-- Footer Controls -->
    <footer class="w-full flex justify-around items-center pt-8 pb-4">
      <button type="button" class="flex flex-col items-center gap-2 opacity-40 hover:opacity-100 transition-opacity cursor-pointer">
        <div class="p-4 bg-white/5 rounded-full"><Volume2 :size="24" /></div>
        <span class="text-[0.6rem] font-bold uppercase tracking-widest">Speaker</span>
      </button>

      <button
        type="button"
        @click="router.push('/chat')"
        class="flex flex-col items-center gap-2 text-danger opacity-80 hover:opacity-100 transition-opacity cursor-pointer"
      >
        <div class="p-4 bg-danger/10 rounded-full border border-danger/20"><PhoneOff :size="24" /></div>
        <span class="text-[0.6rem] font-bold uppercase tracking-widest">End Session</span>
      </button>

      <button
        type="button"
        @click="stopRecording"
        class="flex flex-col items-center gap-2 opacity-40 hover:opacity-100 transition-opacity cursor-pointer"
      >
        <div class="p-4 bg-white/5 rounded-full"><MicOff :size="24" /></div>
        <span class="text-[0.6rem] font-bold uppercase tracking-widest">Mute</span>
      </button>
    </footer>
  </div>
</template>
