<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  ArrowLeft,
  Mic,
  MicOff,
  Square,
  Play,
  RotateCcw,
  Globe,
  Sun,
  Moon,
  Target,
  Sparkles,
  CheckCircle2,
  Volume2,
  Loader2,
  X,
} from 'lucide-vue-next';
import VoiceAvatar from '@/components/chat/VoiceAvatar.vue';
import { ACCENTS, getStoredAccent, saveStoredAccent } from '@/constants/accents';
import { useAuthStore } from '@/stores/auth';

interface VoiceMessage {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  audio_b64?: string;
  created_at: string;
}

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const convId = ref<string | null>((route.query.conv_id || route.query.id) as string || null);
const state = ref<'idle' | 'listening' | 'processing' | 'speaking'>('idle');
const messages = ref<VoiceMessage[]>([]);
const audioRef = ref<HTMLAudioElement | null>(null);
const currentAccent = ref(getStoredAccent());
const isAccentModalOpen = ref(false);

const isLeveling = ref(false);

let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let audioStream: MediaStream | null = null;

const stateLabels = {
  idle: 'Pronta para conversar',
  listening: 'Ouvindo você falar...',
  processing: 'Teacher Tati está pensando...',
  speaking: 'Teacher Tati está falando...',
};

const currentAccentObj = computed(() => {
  return ACCENTS.find((a) => a.id === currentAccent.value) || ACCENTS[0];
});

const lastAssistantMessage = computed(() => {
  return [...messages.value].reverse().find((m) => m.role === 'assistant') || null;
});

async function loadConversationMessages() {
  if (!convId.value || !authStore.token) return;
  try {
    const res = await fetch(`/chat/conversations/${convId.value}/messages`, {
      headers: { Authorization: `Bearer ${authStore.token}` },
    });
    if (res.ok) {
      const data = await res.json();
      messages.value = data.map((m: any) => ({
        id: m.id || String(Math.random()),
        role: m.role || 'assistant',
        content: m.content || m.text || '',
        audio_b64: m.audio_b64 || m.audio,
        created_at: m.created_at || new Date().toISOString(),
      }));

      // Check if leveling challenge
      if (messages.value.some((m) => m.content?.includes('Leveling') || m.content?.includes('Nivelamento'))) {
        isLeveling.value = true;
      }

      // If last message has audio, play it
      const last = messages.value[messages.value.length - 1];
      if (last && last.role === 'assistant' && last.audio_b64) {
        playAudioBase64(last.audio_b64);
      }
    }
  } catch (err) {
    console.error('Failed to load voice messages:', err);
  }
}

function playAudioBase64(base64: string) {
  if (!audioRef.value) return;
  const src = base64.startsWith('data:') ? base64 : `data:audio/mp3;base64,${base64}`;
  audioRef.value.src = src;
  audioRef.value
    .play()
    .then(() => {
      state.value = 'speaking';
    })
    .catch((err) => {
      console.warn('Playback error in voice mode:', err);
      state.value = 'idle';
    });
}

async function startRecording() {
  if (state.value === 'listening' || state.value === 'processing') return;

  if (audioRef.value && !audioRef.value.paused) {
    audioRef.value.pause();
  }

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

    recorder.onstop = async () => {
      state.value = 'processing';
      const blob = new Blob(audioChunks, { type: mimeType });
      const reader = new FileReader();
      reader.onloadend = async () => {
        const resultStr = reader.result as string;
        const b64 = resultStr.includes(',') ? resultStr.split(',')[1] : resultStr;
        await processUserAudio(b64);
      };
      reader.readAsDataURL(blob);

      if (audioStream) {
        audioStream.getTracks().forEach((t) => t.stop());
        audioStream = null;
      }
    };

    recorder.start();
    state.value = 'listening';
  } catch (err) {
    console.error('Microphone error in voice mode:', err);
    alert('Por favor, permita o acesso ao microfone no navegador.');
  }
}

function stopRecording() {
  if (mediaRecorder && state.value === 'listening') {
    mediaRecorder.stop();
  }
}

async function processUserAudio(base64: string) {
  try {
    // 1. Transcribe audio
    const trRes = await fetch('/chat/transcribe', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify({ audio: base64 }),
    });

    let transcribedText = '';
    if (trRes.ok) {
      const trData = await trRes.json();
      transcribedText = trData.transcription || trData.text || '';
    }

    if (!transcribedText.trim()) {
      state.value = 'idle';
      return;
    }

    messages.value.push({
      id: `user-${Date.now()}`,
      role: 'user',
      content: transcribedText,
      created_at: new Date().toISOString(),
    });

    // 2. Ensure conversation id
    let currentId = convId.value;
    if (!currentId) {
      const convRes = await fetch('/chat/conversations', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${authStore.token}`,
        },
        body: JSON.stringify({ title: 'Conversa no Modo de Voz' }),
      });
      if (convRes.ok) {
        const newC = await convRes.json();
        currentId = newC.id;
        convId.value = newC.id;
        router.replace({ query: { conv_id: newC.id } });
      }
    }

    // 3. Send message & get neural reply with accent
    const replyRes = await fetch('/chat/message', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify({
        conversation_id: currentId,
        message: transcribedText,
        accent: currentAccent.value,
      }),
    });

    if (replyRes.ok) {
      const data = await replyRes.json();
      const replyMsg: VoiceMessage = {
        id: `tati-${Date.now()}`,
        role: 'assistant',
        content: data.reply || data.content || '',
        audio_b64: data.audio_b64 || data.audio,
        created_at: new Date().toISOString(),
      };
      messages.value.push(replyMsg);

      if (replyMsg.audio_b64) {
        playAudioBase64(replyMsg.audio_b64);
      } else {
        state.value = 'idle';
      }
    } else {
      state.value = 'idle';
    }
  } catch (err) {
    console.error('Error processing voice turn:', err);
    state.value = 'idle';
  }
}

async function handleFinishLeveling() {
  if (!confirm('Deseja finalizar o teste de nivelamento agora? Suas respostas serão avaliadas e sua nota CEFR será calculada.')) return;
  state.value = 'processing';
  try {
    const res = await fetch('/chat/leveling/finish', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify({
        conversation_id: convId.value,
        accent: currentAccent.value,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      if (data.reply) {
        messages.value.push({
          id: `leveling-fin-${Date.now()}`,
          role: 'assistant',
          content: data.reply,
          audio_b64: data.audio_b64,
          created_at: new Date().toISOString(),
        });
        if (data.audio_b64) {
          playAudioBase64(data.audio_b64);
        }
      }
    }
  } catch (err) {
    console.error('Failed to finish leveling early:', err);
  } finally {
    state.value = 'idle';
  }
}

function handleSelectAccent(id: string) {
  currentAccent.value = id;
  saveStoredAccent(id);
  isAccentModalOpen.value = false;
}

onMounted(() => {
  loadConversationMessages();
});

onUnmounted(() => {
  if (audioRef.value) {
    audioRef.value.pause();
    audioRef.value = null;
  }
  if (audioStream) {
    audioStream.getTracks().forEach((t) => t.stop());
  }
});
</script>

<template>
  <div class="fixed inset-0 bg-bg flex flex-col md:flex-row font-sans overflow-hidden">
    <!-- Hidden Audio Player for Speech -->
    <audio
      ref="audioRef"
      @ended="state = 'idle'"
      @pause="state = 'idle'"
      @play="state = 'speaking'"
    />

    <!-- Left / Top Column: Avatar & Stage -->
    <div
      class="w-full md:w-[45%] lg:w-[40%] h-[42vh] md:h-full shrink-0 relative flex flex-col items-center justify-between p-4 sm:p-8 bg-surface border-b md:border-b-0 md:border-r border-line shadow-lg z-20"
    >
      <!-- Top Bar in Stage -->
      <div class="w-full flex items-center justify-between">
        <button
          type="button"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-bgSecondary border border-line text-ink hover:text-primary text-xs font-bold transition active:scale-95 cursor-pointer shadow-xs"
          title="Voltar ao Chat"
          @click="convId ? router.push({ path: '/chat', query: { conv_id: convId } }) : router.push('/chat')"
        >
          <ArrowLeft :size="15" />
          <span>Voltar</span>
        </button>

        <div class="flex items-center gap-2">
          <!-- Leveling Finish Button -->
          <button
            v-if="isLeveling"
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-bold transition active:scale-95 shadow-xs cursor-pointer"
            title="Finalizar avaliação e calcular nível"
            @click="handleFinishLeveling"
          >
            <Target :size="14" />
            <span>Encerrar Teste</span>
          </button>

          <!-- Accent Selector Button -->
          <button
            type="button"
            class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-bgSecondary border border-line text-xs font-semibold text-ink transition active:scale-95 cursor-pointer shadow-xs"
            title="Sotaque da Teacher Tati"
            @click="isAccentModalOpen = true"
          >
            <span class="text-sm">{{ currentAccentObj.flag }}</span>
            <span class="text-[11px] font-bold text-muted hidden sm:inline">{{ currentAccentObj.shortLabel }}</span>
            <Globe :size="12" class="text-muted ml-0.5" />
          </button>
        </div>
      </div>

      <!-- Center Avatar -->
      <div class="my-auto flex flex-col items-center gap-3">
        <VoiceAvatar :state="state" :audio-element="audioRef" />

        <!-- Status Pill -->
        <div class="flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-bgSecondary border border-line shadow-xs">
          <span
            class="w-2 h-2 rounded-full"
            :class="{
              'bg-emerald-500 animate-pulse': state === 'speaking',
              'bg-primary animate-ping': state === 'listening',
              'bg-amber-500 animate-bounce': state === 'processing',
              'bg-muted': state === 'idle',
            }"
          />
          <span class="text-xs font-bold text-ink">
            {{ stateLabels[state] }}
          </span>
        </div>
      </div>

      <!-- Stage Bottom Mic Controls -->
      <div class="w-full flex items-center justify-center gap-4">
        <!-- Main Mic Action Button -->
        <button
          v-if="state !== 'listening'"
          type="button"
          class="w-14 h-14 rounded-full bg-primary hover:bg-primaryHover text-white shadow-xl shadow-primary/30 flex items-center justify-center transition-all active:scale-95 cursor-pointer"
          title="Falar com a Teacher Tati"
          :disabled="state === 'processing'"
          @click="startRecording"
        >
          <Mic :size="24" />
        </button>

        <button
          v-else
          type="button"
          class="w-14 h-14 rounded-full bg-rose-500 hover:bg-rose-600 text-white shadow-xl shadow-rose-500/30 flex items-center justify-center transition-all active:scale-95 cursor-pointer animate-pulse"
          title="Parar e enviar áudio"
          @click="stopRecording"
        >
          <Square :size="20" class="fill-current" />
        </button>
      </div>
    </div>

    <!-- Right / Bottom Column: Live Conversation Transcript -->
    <div class="flex-1 flex flex-col min-w-0 bg-bg h-[58vh] md:h-full relative overflow-hidden">
      <!-- Conversation Header -->
      <div class="px-6 py-4 border-b border-line bg-surface/60 backdrop-blur-sm flex items-center justify-between shrink-0">
        <div class="flex items-center gap-2">
          <Sparkles :size="16" class="text-primary" />
          <h2 class="text-sm font-bold text-ink">Transcrição em Tempo Real</h2>
        </div>
        <span class="text-[11px] font-bold text-muted uppercase tracking-wider">
          {{ messages.length }} mensagens
        </span>
      </div>

      <!-- Messages Feed -->
      <div class="flex-1 overflow-y-auto p-4 sm:p-6 space-y-4 no-scrollbar">
        <div
          v-if="messages.length === 0"
          class="h-full flex flex-col items-center justify-center text-center p-6 text-muted"
        >
          <Mic :size="36" class="mb-3 opacity-40 text-primary" />
          <h3 class="text-sm font-bold text-ink">Nenhuma fala gravada ainda</h3>
          <p class="text-xs text-muted max-w-sm mt-1">
            Toque no botão do microfone para começar a conversar em inglês com a Teacher Tati.
          </p>
        </div>

        <div
          v-for="msg in messages"
          :key="msg.id"
          class="flex flex-col gap-1 max-w-[85%] animate-fade-in"
          :class="msg.role === 'user' ? 'ml-auto items-end' : 'mr-auto items-start'"
        >
          <div class="flex items-center gap-1.5 px-1">
            <span class="text-[10px] font-bold uppercase tracking-wider text-muted">
              {{ msg.role === 'user' ? 'Você' : 'Teacher Tati' }}
            </span>
          </div>

          <div
            class="px-4 py-3 rounded-2xl text-sm leading-relaxed shadow-xs"
            :class="
              msg.role === 'user'
                ? 'bg-primary text-white rounded-br-xs'
                : 'bg-surface border border-line text-ink rounded-bl-xs'
            "
          >
            <p class="whitespace-pre-wrap">{{ msg.content }}</p>
          </div>

          <!-- Replay button for Assistant -->
          <button
            v-if="msg.role === 'assistant' && msg.audio_b64"
            type="button"
            class="inline-flex items-center gap-1 text-[11px] font-bold text-primary hover:underline px-1 mt-0.5 cursor-pointer"
            title="Ouvir novamente"
            @click="playAudioBase64(msg.audio_b64)"
          >
            <Volume2 :size="12" />
            <span>Ouvir novamente</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Accent Selector Modal -->
    <Teleport to="body">
      <div
        v-if="isAccentModalOpen"
        class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
        @click="isAccentModalOpen = false"
      >
        <div
          class="relative w-full max-w-md bg-surface border border-line rounded-2xl shadow-2xl p-5 overflow-hidden flex flex-col max-h-[85vh]"
          @click.stop
        >
          <div class="flex items-center justify-between pb-3 border-b border-line mb-3">
            <h3 class="text-sm font-bold text-ink">Selecionar Sotaque da Teacher Tati</h3>
            <button
              type="button"
              class="p-1 rounded-lg text-muted hover:text-ink cursor-pointer"
              @click="isAccentModalOpen = false"
            >
              <X :size="18" />
            </button>
          </div>

          <div class="overflow-y-auto space-y-1.5 no-scrollbar">
            <button
              v-for="acc in ACCENTS"
              :key="acc.id"
              type="button"
              class="w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-semibold transition cursor-pointer"
              :class="
                acc.id === currentAccent
                  ? 'bg-primary text-white font-bold shadow-xs'
                  : 'bg-surface border border-line text-ink hover:border-primary/40'
              "
              @click="handleSelectAccent(acc.id)"
            >
              <div class="flex items-center gap-2.5">
                <span class="text-base">{{ acc.flag }}</span>
                <span>{{ acc.label }}</span>
              </div>
              <CheckCircle2 v-if="acc.id === currentAccent" :size="16" />
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>