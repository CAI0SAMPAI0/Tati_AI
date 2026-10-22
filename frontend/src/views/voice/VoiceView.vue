<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  ArrowLeft,
  Globe,
  Mic,
  Moon,
  Play,
  Plus,
  RefreshCcw,
  RotateCcw,
  Sparkles,
  Square,
  Sun,
  Target,
  Volume2,
  X,
} from 'lucide-vue-next';
import { useAuth } from '@/composables/useAuth';
import { useThemeStore } from '@/stores/theme';
import { useToast } from '@/composables/useToast';
import { useVoiceSocket } from '@/composables/useVoiceSocket';
import { apiGet, apiPost, apiPut } from '@/api/client';
import VoiceAvatar from '@/components/chat/VoiceAvatar.vue';
import VoiceMessageBubble from '@/components/chat/VoiceMessageBubble.vue';
import WordTooltip from '@/components/chat/WordTooltip.vue';

const route = useRoute();
const router = useRouter();
const toast = useToast();
const themeStore = useThemeStore();
const { user, accent: authAccent, setAccent: setAuthAccent } = useAuth();

const convIdParam = computed(() => (route.query.conv_id as string) || null);
const simulationIdParam = computed(() => (route.query.simulation_id as string) || null);

const convId = ref<string | null>(convIdParam.value);
const simulationId = ref<string | null>(simulationIdParam.value);
const simulationTitle = ref<string | null>(null);
const objectives = ref<Array<{ id: string; text: string }>>([]);
const isStarting = ref(false);
const error = ref<string | null>(null);

const activeWord = ref<string | null>(null);
const tooltipPos = ref<{ x: number; y: number }>({ x: 0, y: 0 });

const ACCENTS = [
  { id: 'en-US', label: '🇺🇸 American', shortLabel: 'US', desc: 'United States' },
  { id: 'en-GB', label: '🇬🇧 British', shortLabel: 'UK', desc: 'United Kingdom' },
  { id: 'en-AU', label: '🇦🇺 Australian', shortLabel: 'AU', desc: 'Australia' },
  { id: 'en-CA', label: '🇨🇦 Canadian', shortLabel: 'CA', desc: 'Canada' },
  { id: 'en-IE', label: '🇮🇪 Irish', shortLabel: 'IE', desc: 'Ireland' },
  { id: 'en-IN', label: '🇮🇳 Indian', shortLabel: 'IN', desc: 'India' },
  { id: 'en-ZA', label: '🇿🇦 South African', shortLabel: 'ZA', desc: 'South Africa' },
  { id: 'en-NZ', label: '🇳🇿 New Zealand', shortLabel: 'NZ', desc: 'New Zealand' },
  { id: 'en-CN', label: '🇨🇳 Chinese', shortLabel: 'CN', desc: 'Chinese English' },
  { id: 'en-KR', label: '🇰🇷 Korean', shortLabel: 'KR', desc: 'Korean English' },
];

const accentIndex = ref<number>(0);
const isChangingAccent = ref(false);
const isAccentMenuOpen = ref(false);
const accentMenuRef = ref<HTMLDivElement | null>(null);

const volume = ref(1);
const speed = ref(1);
const currentTime = ref(0);
const duration = ref(0);

const audioRef = ref<HTMLAudioElement | null>(null);
const scrollRef = ref<HTMLDivElement | null>(null);

// Audio recorder references
const mediaRecorderRef = ref<MediaRecorder | null>(null);
const streamRef = ref<MediaStream | null>(null);
const audioChunksRef = ref<Blob[]>([]);

// Voice Socket composable
const {
  state,
  messages,
  lastAudio,
  transcription,
  activeConvId,
  completedObjectives,
  sendAudio,
  sendMessage,
  ensureConversation,
  createNewConversation,
} = useVoiceSocket(convId, simulationId);

watch(convIdParam, (newParam) => {
  if (newParam !== convId.value) {
    convId.value = newParam;
  }
});

watch(activeConvId, (newId) => {
  if (newId && newId !== convId.value) {
    convId.value = newId;
    router.replace({ path: '/voice', query: { ...route.query, conv_id: newId } });
  }
});

async function handleNewVoiceConversation() {
  if (audioRef.value) audioRef.value.pause();
  convId.value = null;
  const newId = await createNewConversation();
  if (newId) {
    convId.value = newId;
    router.replace({ path: '/voice', query: { ...route.query, conv_id: newId } });
    toast.success('New conversation started!');
  }
}

const isTranscribing = computed(() => {
  return Boolean(
    state.value === 'processing' &&
    messages.value.some(
      (m) =>
        m.role === 'user' &&
        typeof m.id === 'string' &&
        (m.id.startsWith('voice-temp-') ||
          m.id.startsWith('live-temp-') ||
          m.id.startsWith('user-audio-temp'))
    )
  );
});

const lastAssistantIdx = computed(() => messages.value.map((m) => m.role).lastIndexOf('assistant'));
const lastUserIdx = computed(() => messages.value.map((m) => m.role).lastIndexOf('user'));
const lastAssistantText = computed(() => {
  const assistantMsgs = messages.value.filter((m) => m.role === 'assistant');
  return assistantMsgs.at(-1)?.content;
});

const isLeveling = computed(() => {
  return Boolean(
    simulationTitle.value?.toLowerCase().includes('leveling') ||
    messages.value.some(
      (m) =>
        m.content?.includes('Leveling Challenge') ||
        m.content?.includes('CEFR English Leveling')
    )
  );
});

function initAccent() {
  try {
    const stored = typeof window !== 'undefined' ? localStorage.getItem('tati_voice_accent') : null;
    const userProfileAccent =
      (user.value as any)?.profile?.preferred_accent ||
      (user.value as any)?.profile?.accent ||
      authAccent.value;
    const preferred = stored || userProfileAccent || 'en-US';
    const idx = ACCENTS.findIndex((a) => a.id === preferred);
    if (idx !== -1) accentIndex.value = idx;
  } catch (_) { }
}

watch(
  () => [(user.value as any)?.profile?.preferred_accent, (user.value as any)?.profile?.accent, authAccent.value],
  () => {
    initAccent();
  }
);

// Auto scroll on new messages or transcription
watch(
  [() => messages.value.length, transcription],
  () => {
    scrollToBottom();
  }
);

function scrollToBottom() {
  nextTick(() => {
    if (scrollRef.value) {
      scrollRef.value.scrollTo({
        top: scrollRef.value.scrollHeight,
        behavior: 'smooth',
      });
    }
  });
}

// Play incoming audio
watch(lastAudio, (newAudio) => {
  if (newAudio && audioRef.value) {
    const audio = audioRef.value;
    const targetSrc = `data:audio/mp3;base64,${newAudio}`;
    if (audio.src !== targetSrc) {
      audio.src = targetSrc;
      audio.load();
      audio
        .play()
        .then(() => {
          state.value = 'speaking';
        })
        .catch((e) => {
          console.warn('Audio autoplay prevented or interrupted:', e);
          if (e.name === 'NotAllowedError') {
            toast.info('Tap Teacher Tati to listen.');
          }
          state.value = 'idle';
        });
    }
  }
});

// Fallback audio source from last assistant message
watch(
  () => messages.value.length,
  () => {
    if (!lastAudio.value && messages.value.length > 0) {
      const lastAssistant = [...messages.value].reverse().find((m) => m.role === 'assistant' && m.audio_b64);
      if (lastAssistant?.audio_b64 && audioRef.value && !audioRef.value.src) {
        audioRef.value.src = `data:audio/mp3;base64,${lastAssistant.audio_b64}`;
        audioRef.value.load();
      }
    }
  }
);

async function changeAccentToIndex(newIndex: number) {
  const safeIndex = (newIndex + ACCENTS.length) % ACCENTS.length;
  accentIndex.value = safeIndex;
  const newAccent = ACCENTS[safeIndex];

  try {
    localStorage.setItem('tati_voice_accent', newAccent.id);
  } catch (_) { }

  setAuthAccent(newAccent.id);
  apiPut('/profile', { preferred_accent: newAccent.id, accent: newAccent.id }).catch((err) =>
    console.error('Failed to sync accent from voice page:', err)
  );
  toast.success(`Accent: ${newAccent.label}`);

  const lastAssistantMsg = [...messages.value].reverse().find((m) => m.role === 'assistant');
  if (lastAssistantMsg && lastAssistantMsg.content) {
    isChangingAccent.value = true;
    try {
      const res = await apiPost<{ audio?: string; audio_b64?: string; data?: { audio?: string } }>(
        '/chat/tts',
        {
          text: lastAssistantMsg.content,
          accent: newAccent.id,
        }
      );
      const audioData = res?.audio_b64 || res?.audio || res?.data?.audio;
      if (audioData) {
        lastAssistantMsg.audio_b64 = audioData;
        if (audioRef.value) {
          audioRef.value.pause();
          audioRef.value.src = `data:audio/mp3;base64,${audioData}`;
          audioRef.value.load();
          audioRef.value
            .play()
            .then(() => {
              state.value = 'speaking';
            })
            .catch((e) => {
              console.log('Audio autoplay prevented or interrupted:', e);
            });
        }
      }
    } catch (err) {
      console.error('Error reloading audio with new accent:', err);
    } finally {
      isChangingAccent.value = false;
    }
  }
}

function handleCycleAccent(e?: MouseEvent) {
  if (e) e.stopPropagation();
  changeAccentToIndex(accentIndex.value + 1);
}

function handleWheelAccent(e: WheelEvent) {
  e.preventDefault();
  if (e.deltaY > 0) {
    changeAccentToIndex(accentIndex.value + 1);
  } else if (e.deltaY < 0) {
    changeAccentToIndex(accentIndex.value - 1);
  }
}

function handleClickOutside(e: MouseEvent) {
  if (accentMenuRef.value && !accentMenuRef.value.contains(e.target as Node)) {
    isAccentMenuOpen.value = false;
  }
}

function handleWordClick(word: string, x: number, y: number) {
  activeWord.value = word;
  tooltipPos.value = { x, y };
}

function handleSeek(val: number) {
  if (audioRef.value) {
    audioRef.value.currentTime = val;
    currentTime.value = val;
  }
}

function setSpeed(v: number) {
  speed.value = v;
  if (audioRef.value) {
    audioRef.value.playbackRate = v;
  }
}

function togglePlayback() {
  if (!audioRef.value) return;
  const audio = audioRef.value;
  if (!audio.paused && !audio.ended) {
    audio.pause();
    state.value = 'idle';
  } else if (audio.src) {
    if (audio.ended) {
      audio.currentTime = 0;
    }
    audio
      .play()
      .then(() => {
        state.value = 'speaking';
      })
      .catch((e) => {
        console.warn('Playback error:', e);
        state.value = 'idle';
      });
  }
}

async function startRecording() {
  if (!convId.value && !!simulationId.value) return;

  if (audioRef.value) {
    audioRef.value.pause();
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
                sendAudio(base64, ACCENTS[accentIndex.value].id);
              }
            }
          };
          reader.readAsDataURL(blob);
        } else {
          console.warn('[VoicePage] Audio blob vazio gravado.');
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
  } catch (err) {
    console.error('[VoicePage] Mic error:', err);
    toast.error('Mic error: permission denied.');
    state.value = 'idle';
  }
}

function stopRecording() {
  if (mediaRecorderRef.value && mediaRecorderRef.value.state !== 'inactive') {
    mediaRecorderRef.value.stop();
    state.value = 'processing';
  }
}

async function handleStartSimulation() {
  if (!simulationId.value || isStarting.value) return;
  isStarting.value = true;
  error.value = null;
  try {
    const userProfile = (user.value as any)?.profile as
      | { level?: string; cefr_level?: string }
      | undefined;
    const userLevel =
      (user.value as any)?.level || userProfile?.level || userProfile?.cefr_level || undefined;

    const res = await apiPost<any>('/simulation/start', {
      scenario_id: simulationId.value,
      accent: ACCENTS[accentIndex.value].id,
      level: userLevel,
    });
    const simData = res?.data || res;
    if (simData?.id) {
      convId.value = simData.id;
      if (simData.objectives) objectives.value = simData.objectives;
      if (simData.completed_objectives) completedObjectives.value = simData.completed_objectives;
      if (simData.initial_message) {
        messages.value = [
          {
            id: 'init',
            conversation_id: simData.id,
            role: 'assistant',
            content: simData.initial_message.content,
            created_at: new Date().toISOString(),
          },
        ];
        if (simData.initial_message.audio) {
          lastAudio.value = simData.initial_message.audio;
        }
      }
      router.replace(`/voice?conv_id=${simData.id}&simulation_id=${simulationId.value}`);
      toast.success('Simulation started!');
    } else {
      error.value = 'Could not start on server. Check your connection.';
    }
  } catch (err: any) {
    error.value = `Error: ${err.message || 'Connection failed'}`;
  } finally {
    isStarting.value = false;
  }
}

async function handleFinishSimulation() {
  if (!simulationId.value) return;
  try {
    await apiPost(`/simulation/complete/${simulationId.value}`, {});
    toast.success('Simulation completed!');
    router.push('/activities');
  } catch (e) {
    console.error(e);
  }
}

async function handleFinishLeveling() {
  if (
    typeof window !== 'undefined' &&
    !window.confirm(
      'Do you want to finish the Leveling assessment now? Remaining questions will be recorded as 0, and Teacher Tati will calculate your CEFR level from your answers so far.'
    )
  ) {
    return;
  }
  toast.info('Finishing Leveling Challenge...');
  await sendMessage('/finish', ACCENTS[accentIndex.value].id);
  toast.success('Submitted /finish! Grading your assessment...');
}

onMounted(() => {
  initAccent();
  document.addEventListener('mousedown', handleClickOutside);

  if (simulationId.value) {
    apiGet<any>(`/simulation/scenarios/${simulationId.value}`)
      .then((res) => {
        simulationTitle.value = res?.name || 'Simulation';
        if (res?.objectives) objectives.value = res.objectives;
      })
      .catch(() => {
        simulationTitle.value = 'Simulation';
      });
  } else if (convId.value) {
    apiGet<any>('/chat/conversations')
      .then((res) => {
        const list = Array.isArray(res) ? res : res?.results || [];
        const current = list.find((c: any) => c.id === convId.value);
        if (current?.title) simulationTitle.value = current.title;
      })
      .catch(() => { });
  }

  if (audioRef.value) {
    audioRef.value.volume = volume.value;
    audioRef.value.playbackRate = speed.value;
    audioRef.value.ontimeupdate = () => {
      if (audioRef.value) currentTime.value = audioRef.value.currentTime;
    };
    audioRef.value.onloadedmetadata = () => {
      if (audioRef.value) duration.value = audioRef.value.duration;
    };
    audioRef.value.onended = () => {
      state.value = 'idle';
    };
    audioRef.value.onplay = () => {
      state.value = 'speaking';
    };
    audioRef.value.onpause = () => {
      if (state.value === 'speaking') state.value = 'idle';
    };
  }
});

watch(volume, (v) => {
  if (audioRef.value) audioRef.value.volume = v;
});

watch(speed, (s) => {
  if (audioRef.value) audioRef.value.playbackRate = s;
});

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside);
  if (streamRef.value) {
    streamRef.value.getTracks().forEach((t: MediaStreamTrack) => t.stop());
    streamRef.value = null;
  }
  if (audioRef.value) {
    audioRef.value.pause();
    audioRef.value = null;
  }
});
</script>

<template>
  <div class="fixed inset-0 bg-[#f4f7ff] dark:bg-[#05060b] flex flex-col md:flex-row font-sans overflow-hidden">
    <div
      class="fixed inset-0 pointer-events-none overflow-hidden z-0 bg-gradient-to-b from-primary/[0.03] to-transparent" />

    <audio ref="audioRef" playsinline />

    <!-- Error state -->
    <div v-if="error"
      class="fixed inset-0 bg-bg flex flex-col items-center justify-center p-8 text-center space-y-6 z-50">
      <div class="p-4 rounded-full bg-danger/10 text-danger">
        <X class="w-12 h-12" />
      </div>
      <div class="space-y-2">
        <h2 class="text-xl font-bold">Simulation Failed</h2>
        <p class="text-text-muted">{{ error }}</p>
      </div>
      <button type="button" @click="handleStartSimulation"
        class="px-6 py-3 rounded-2xl bg-primary text-white font-bold hover:scale-105 transition-all flex items-center gap-2">
        <RefreshCcw class="w-4 h-4" /> Try Again
      </button>
      <button type="button" @click="router.back()" class="text-sm text-text-muted hover:underline">
        Back
      </button>
    </div>

    <!-- Left Column (Desktop) / Top Section (Mobile) -->
    <div
      class="w-full md:w-[42%] lg:w-[38%] h-[34vh] sm:h-[32vh] md:h-full shrink-0 relative flex flex-col items-center justify-center px-2.5 pt-2 pb-1.5 sm:p-8 bg-white/95 dark:bg-[#0f1120]/95 border-b md:border-b-0 md:border-r border-border z-20 shadow-xl transition-all animate-in fade-in slide-in-from-left-8 duration-300">
      <!-- Top Left: Back Button & New Conversation -->
      <div class="absolute top-2.5 sm:top-6 left-3 sm:left-6 flex items-center gap-2 sm:gap-3">
        <button type="button" @click="router.back()"
          class="flex items-center gap-2 px-2.5 sm:px-4 py-1 sm:py-2 rounded-xl bg-white dark:bg-[#1a1c2e] border border-border text-text hover:text-primary transition-all active:scale-95 shadow-sm group cursor-pointer">
          <ArrowLeft class="w-4 h-4 group-hover:-translate-x-1 transition-transform" />
          <span class="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">Back</span>
        </button>

        <button v-if="!simulationId" type="button" @click="handleNewVoiceConversation"
          class="flex items-center gap-1.5 px-2.5 sm:px-3 py-1 sm:py-2 rounded-xl bg-white dark:bg-[#1a1c2e] border border-border text-text-muted hover:text-primary transition-all active:scale-95 shadow-sm cursor-pointer"
          title="Start a new voice conversation">
          <Plus class="w-3.5 h-3.5" />
          <span class="text-[9px] sm:text-[10px] font-black uppercase tracking-widest">New</span>
        </button>
      </div>

      <!-- Top Right: Actions & Theme Toggle -->
      <div class="absolute top-2.5 sm:top-6 right-3 sm:right-6 flex items-center gap-2 sm:gap-3">
        <button v-if="simulationId" type="button" @click="handleFinishSimulation"
          class="px-2.5 sm:px-4 py-1 sm:py-2 rounded-xl bg-success text-white text-[9px] sm:text-[10px] font-black uppercase tracking-widest hover:bg-success/90 transition-all active:scale-95 shadow-xl cursor-pointer">
          Finish
        </button>

        <button v-if="isLeveling" type="button" @click="handleFinishLeveling"
          class="px-2.5 sm:px-4 py-1 sm:py-2 rounded-xl bg-primary text-white text-[9px] sm:text-[10px] font-black uppercase tracking-widest hover:bg-primary/90 transition-all active:scale-95 shadow-xl flex items-center gap-1.5 cursor-pointer"
          title="Finish assessment and receive grade report">
          <Target class="w-3.5 h-3.5" />
          <span>Finish Test</span>
        </button>

        <button type="button" @click="themeStore.toggleTheme"
          class="p-1 sm:p-2.5 rounded-xl bg-white dark:bg-[#1a1c2e] border border-border text-text-muted hover:text-primary transition-all active:scale-95 shadow-sm cursor-pointer"
          title="Toggle theme">
          <Sun v-if="themeStore.isDark" class="w-4 h-4" />
          <Moon v-else class="w-4 h-4" />
        </button>
      </div>

      <!-- Center: Avatar & Accent Selectors -->
      <div class="flex flex-col items-center gap-1 sm:gap-8 mt-auto sm:mt-0 mb-1 sm:mb-0">
        <div
          class="cursor-pointer hover:scale-105 active:scale-95 transition-all duration-700 w-[84px] h-[84px] sm:w-auto sm:h-auto flex items-center justify-center overflow-visible"
          @click="
            if (audioRef?.src) {
              togglePlayback();
            } else if (state === 'idle') {
              startRecording();
            }
          ">
          <div class="scale-[0.58] sm:scale-90 md:scale-100 origin-center shrink-0">
            <VoiceAvatar :state="state" :audio-element="audioRef" :last-assistant-text="lastAssistantText" />
          </div>
        </div>

        <div class="text-center space-y-0.5 sm:space-y-3 px-2 sm:px-4">
          <h1
            class="text-base sm:text-3xl md:text-5xl font-black text-text tracking-tighter line-clamp-1 md:line-clamp-2">
            {{ simulationTitle || 'Teacher Tati' }}
          </h1>

          <div ref="accentMenuRef" class="flex flex-col items-center gap-2 w-full">
            <div class="flex items-center justify-center gap-2 flex-wrap">
              <!-- Primary cycling accent pill button -->
              <button type="button" @click="handleCycleAccent" @wheel="handleWheelAccent"
                title="Click to cycle or use mouse wheel to change accent"
                class="inline-flex items-center gap-1.5 px-3 sm:px-4 py-0.5 sm:py-1.5 rounded-full bg-primary/10 hover:bg-primary/20 border border-primary/30 shadow-sm text-[9px] sm:text-[11px] font-bold text-primary transition-all active:scale-95 cursor-pointer group select-none">
                <RotateCcw v-if="isChangingAccent" class="w-3 h-3 animate-spin text-primary shrink-0" />
                <span v-else class="shrink-0">{{ ACCENTS[accentIndex].label }}</span>
                <span
                  class="text-[8px] sm:text-[10px] opacity-70 group-hover:opacity-100 group-hover:scale-110 transition-transform">⚡</span>
              </button>

              <!-- Globe button opening full accent modal -->
              <button type="button" @click="isAccentMenuOpen = true" title="View and choose all accents"
                class="p-1 sm:p-1.5 rounded-full bg-white/50 dark:bg-[#1a1c2e]/60 border border-white/60 dark:border-white/10 text-text-muted hover:text-primary transition-all active:scale-95 shadow-md text-xs flex items-center justify-center cursor-pointer">
                <Globe class="w-3.5 h-3.5 text-primary" />
              </button>
            </div>

            <!-- Horizontal Scrollable Accent Carousel (Always Visible) -->
            <div
              class="w-full max-w-[300px] sm:max-w-sm overflow-x-auto py-1 scrollbar-hide no-scrollbar flex items-center gap-1.5 px-1">
              <button v-for="(acc, idx) in ACCENTS" :key="acc.id" type="button" @click="changeAccentToIndex(idx)"
                :title="`${acc.label} (${acc.desc})`"
                class="shrink-0 inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[9px] sm:text-[10px] font-bold transition-all active:scale-95 cursor-pointer shadow-sm"
                :class="idx === accentIndex
                    ? 'bg-primary text-white shadow-primary/30 ring-2 ring-primary/40 font-black scale-105'
                    : 'bg-white/50 dark:bg-[#1a1c2e]/60 border border-white/60 dark:border-white/10 text-text-muted hover:text-primary hover:bg-white/80'
                  ">
                <span>{{ acc.label.split(' ')[0] }}</span>
                <span>{{ acc.shortLabel }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>

      <!-- Modal seletor de sotaques via Teleport to body -->
      <Teleport to="body">
        <div v-if="isAccentMenuOpen"
          class="fixed inset-0 z-[99999] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/75 dark:bg-black/85 animate-in fade-in duration-200">
          <div class="fixed inset-0 cursor-pointer" @click="isAccentMenuOpen = false" />
          <div
            class="relative w-full sm:max-w-md bg-white dark:bg-[#111322] border border-border/80 dark:border-white/10 rounded-t-3xl sm:rounded-3xl shadow-2xl p-5 sm:p-6 z-10 max-h-[85vh] flex flex-col space-y-4 animate-in slide-in-from-bottom-5 duration-300">
            <div class="flex items-center justify-between border-b border-border/40 pb-3 shrink-0">
              <div class="space-y-0.5">
                <h3 class="text-base sm:text-lg font-black text-text flex items-center gap-2">
                  <span>🌎</span> English Accents (Edge TTS)
                </h3>
                <p class="text-xs text-text-muted">Teacher Tati will respond with the selected accent</p>
              </div>
              <button type="button" @click="isAccentMenuOpen = false"
                class="p-1.5 rounded-full hover:bg-surface-hover text-text-muted hover:text-text transition-colors cursor-pointer">
                <X class="w-4 h-4" />
              </button>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2 overflow-y-auto max-h-[60vh] pr-1 custom-scrollbar">
              <button v-for="(acc, idx) in ACCENTS" :key="acc.id" type="button" @click="
                changeAccentToIndex(idx);
                isAccentMenuOpen = false;
              "
                class="flex items-center justify-between p-3 rounded-2xl border text-left transition-all active:scale-98 cursor-pointer"
                :class="idx === accentIndex
                    ? 'bg-primary text-white border-primary shadow-lg font-bold scale-[1.02]'
                    : 'bg-surface/60 dark:bg-white/5 border-border/60 hover:border-primary/40 hover:bg-primary/5 text-text'
                  ">
                <div class="flex items-center gap-2.5 min-w-0">
                  <span class="text-xl shrink-0">{{ acc.label.split(' ')[0] }}</span>
                  <div class="min-w-0">
                    <div class="text-xs font-bold truncate">{{ acc.label.split(' ').slice(1).join(' ') }}</div>
                    <div class="text-[10px]" :class="idx === accentIndex ? 'text-white/80' : 'text-text-muted'">
                      {{ acc.desc || acc.shortLabel }}
                    </div>
                  </div>
                </div>
                <span v-if="idx === accentIndex"
                  class="w-5 h-5 rounded-full bg-white text-primary flex items-center justify-center text-xs font-black shrink-0 shadow">
                  ✓
                </span>
              </button>
            </div>
          </div>
        </div>
      </Teleport>
    </div>

    <!-- Right Column: Conversation Stream & Bottom Player Footer -->
    <div
      class="flex-1 flex flex-col min-h-0 bg-white/5 dark:bg-[#05060b]/40 relative z-10 animate-in fade-in slide-in-from-right-8 duration-300">
      <!-- Scrollable Message Transcript -->
      <div ref="scrollRef"
        class="flex-1 overflow-y-auto px-4 sm:px-6 md:px-12 py-6 sm:py-10 space-y-6 sm:space-y-8 scrollbar-hide mask-fade-top-giant">
        <!-- Simulation Scenario Welcome Card -->
        <div v-if="!convId && simulationId"
          class="h-full flex flex-col items-center justify-center text-center space-y-8 p-6">
          <div class="relative">
            <div class="absolute inset-0 bg-primary/10 rounded-full animate-pulse" />
            <div
              class="relative w-20 h-20 sm:w-24 sm:h-24 rounded-3xl bg-surface border border-border flex items-center justify-center shadow-xl">
              <Sparkles class="w-10 h-10 text-primary animate-bounce" />
            </div>
          </div>
          <div class="max-w-xs space-y-4">
            <h3 class="text-2xl font-black tracking-tight">Conversation Scenario</h3>
            <p class="text-sm text-text-muted leading-relaxed">
              Click the button below to enter the scenario and practice your English with Teacher Tati.
            </p>
          </div>
          <button type="button" @click="handleStartSimulation" :disabled="isStarting"
            class="group relative px-10 py-5 bg-primary text-white rounded-[2rem] font-black text-lg shadow-glow hover:scale-105 active:scale-95 transition-all disabled:opacity-50 cursor-pointer">
            <div class="flex items-center gap-3">
              <RotateCcw v-if="isStarting" class="w-6 h-6 animate-spin" />
              <Play v-else class="w-6 h-6 fill-white" />
              <span>{{ isStarting ? 'Starting...' : 'Start Practice' }}</span>
            </div>
          </button>
        </div>

        <!-- Empty Conversation State -->
        <div v-else-if="messages.length === 0 && !transcription"
          class="h-full flex flex-col items-center justify-center text-center opacity-40 gap-4 p-4">
          <div
            class="w-12 h-12 sm:w-16 sm:h-16 rounded-full border-2 border-dashed border-primary/30 flex items-center justify-center">
            <Mic class="w-6 h-6 text-primary/50" />
          </div>
          <p class="text-sm sm:text-lg italic tracking-widest text-center">
            {{ simulationId ? 'Waiting for simulation...' : 'Say "Hello" to start your class...' }}
          </p>
        </div>

        <!-- Conversation Messages List -->
        <div v-else class="w-full space-y-6">
          <div class="w-full flex flex-col gap-6 sm:gap-8">
            <VoiceMessageBubble v-for="(m, idx) in messages" :key="m.id || `msg-${idx}`" :message="m"
              :is-speaking="state === 'speaking' && idx === lastAssistantIdx" :is-processing="state === 'processing' &&
                idx === lastAssistantIdx &&
                lastAssistantIdx > lastUserIdx &&
                !isTranscribing &&
                !m.content
                " @word-click="handleWordClick" />
          </div>

          <!-- Processing bubble when waiting for assistant -->
          <div
            v-if="state === 'processing' && !isTranscribing && (messages.length === 0 || messages[messages.length - 1].role === 'user')"
            class="flex flex-col gap-1.5 max-w-[85%] md:max-w-[75%] animate-in fade-in slide-in-from-bottom-2 duration-300 mr-auto text-left">
            <div class="flex items-center gap-2 px-2">
              <span class="text-[0.55rem] font-black text-text-subtle uppercase tracking-[0.2em]">
                Teacher Tati
              </span>
            </div>
            <div
              class="px-5 py-3.5 rounded-[22px] rounded-tl-md bg-surface/90 dark:bg-[#151726]/80 backdrop-blur-2xl border border-border/60 dark:border-white/10 text-text shadow-xl flex items-center gap-2">
              <div class="flex items-center gap-1.5">
                <span class="w-2.5 h-2.5 rounded-full bg-primary animate-bounce [animation-delay:-0.32s]" />
                <span class="w-2.5 h-2.5 rounded-full bg-primary animate-bounce [animation-delay:-0.16s]" />
                <span class="w-2.5 h-2.5 rounded-full bg-primary animate-bounce" />
              </div>
              <span class="text-xs text-text-subtle font-medium italic">
                Teacher Tati is preparing your answer...
              </span>
            </div>
          </div>

          <!-- Live transcription line -->
          <div v-if="transcription && state === 'listening'"
            class="flex justify-end italic text-primary/70 pr-4 text-sm">
            &ldquo;{{ transcription }}&rdquo;
          </div>
        </div>
      </div>

      <!-- Bottom Audio Player & Big Floating Mic Footer -->
      <footer
        class="p-2 sm:p-4 md:p-6 bg-white/95 dark:bg-[#0a0b14]/95 border-t border-border shrink-0 pb-safe max-w-full overflow-x-hidden">
        <div class="max-w-full mx-auto flex flex-col md:flex-row items-center gap-4 md:gap-8 w-full overflow-x-hidden">
          <!-- Audio Playback & Speed Scrubber Bar -->
          <div
            class="flex-1 w-full max-w-full min-w-0 bg-white/30 dark:bg-white/5 rounded-2xl sm:rounded-3xl p-2 sm:p-4 space-y-2 shadow-lg border border-white/20 overflow-x-hidden">
            <div class="flex items-center gap-2 sm:gap-4 max-w-full min-w-0 overflow-x-hidden">
              <button type="button" @click="togglePlayback" :disabled="!audioRef?.src"
                class="w-8 h-8 sm:w-10 sm:h-10 rounded-lg sm:rounded-xl flex items-center justify-center transition-all shadow-md active:scale-90 shrink-0 cursor-pointer disabled:opacity-40"
                :class="state === 'speaking' ? 'bg-danger text-white' : 'bg-primary text-white hover:scale-105'">
                <Square v-if="state === 'speaking'" class="w-4 h-4 fill-white" />
                <Play v-else class="w-4 h-4 fill-white ml-0.5" />
              </button>

              <div class="flex-1 min-w-0 space-y-1">
                <!-- Seek Bar -->
                <div class="flex items-center gap-2 sm:gap-3">
                  <span class="text-[7px] sm:text-[9px] tabular-nums text-text-muted w-5 sm:w-7 shrink-0">
                    {{ Math.floor(currentTime / 60) }}:{{ (currentTime % 60).toFixed(0).padStart(2, '0') }}
                  </span>
                  <input type="range" min="0" :max="duration || 0" step="0.1" :value="currentTime"
                    @input="handleSeek(parseFloat(($event.target as HTMLInputElement).value))"
                    class="flex-1 h-1 bg-black/10 dark:bg-white/10 rounded-full appearance-none cursor-pointer accent-primary min-w-[50px]" />
                  <span class="text-[7px] sm:text-[9px] tabular-nums text-text-muted w-5 sm:w-7 shrink-0">
                    {{ Math.floor(duration / 60) }}:{{ (duration % 60).toFixed(0).padStart(2, '0') }}
                  </span>
                </div>

                <!-- Volume & Speed Controls -->
                <div class="flex items-center justify-between flex-wrap gap-2">
                  <div class="flex items-center gap-2 sm:gap-4 flex-wrap">
                    <div class="flex items-center gap-1.5 group shrink-0">
                      <Volume2 class="w-3 h-3 text-text-muted group-hover:text-primary transition-colors shrink-0" />
                      <input type="range" min="0" max="1" step="0.01" :value="volume"
                        @input="volume = parseFloat(($event.target as HTMLInputElement).value)"
                        class="w-12 sm:w-16 h-0.5 bg-black/10 dark:bg-white/10 rounded-full appearance-none cursor-pointer accent-primary" />
                    </div>
                    <div class="flex items-center gap-1 sm:gap-2 shrink-0">
                      <button v-for="v in [0.75, 1, 1.25, 1.5]" :key="v" type="button" @click="setSpeed(v)"
                        class="text-[7px] sm:text-[9px] font-black transition-all px-1 rounded-sm shrink-0 cursor-pointer"
                        :class="speed === v ? 'text-primary bg-primary/5' : 'text-text-muted hover:text-text'">
                        {{ v }}x
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- Big Floating Central Microphone Button -->
          <button type="button" title="Start speaking" aria-label="Start speaking"
            @click="state === 'listening' ? stopRecording() : startRecording()"
            :disabled="state === 'processing' || (!convId && !!simulationId)"
            class="w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center transition-all duration-500 shadow-2xl active:scale-95 border-4 border-white/20 shrink-0 cursor-pointer"
            :class="[
              !convId && simulationId
                ? 'bg-text-subtle/20 opacity-50 cursor-not-allowed'
                : state === 'listening'
                  ? 'bg-danger'
                  : state === 'processing'
                    ? 'bg-warning'
                    : 'bg-primary hover:scale-105'
            ]">
            <Square v-if="state === 'listening'" class="w-6 h-6 fill-white" />
            <RotateCcw v-else-if="state === 'processing'" class="w-7 h-7 animate-spin text-white" />
            <Mic v-else class="w-8 h-8 text-white" />
          </button>
        </div>

        <!-- Animated Status Caption -->
        <p
          class="text-center mt-4 sm:mt-6 text-[8px] sm:text-[10px] font-black uppercase tracking-[0.3em] sm:tracking-[0.5em] text-text-subtle animate-pulse">
          {{
            !convId && simulationId
              ? 'Start simulation above'
              : state === 'listening'
                ? '🎙 Listening…'
                : isTranscribing
                  ? '🎙 Transcribing audio…'
                  : state === 'processing'
                    ? '⏳ Preparing response…'
                    : 'Tap to speak'
          }}
        </p>
      </footer>
    </div>

    <!-- Dica da palavra -->
    <WordTooltip v-if="activeWord" :word="activeWord" :position="tooltipPos" @close="activeWord = null" />
  </div>
</template>

<style scoped>
.scrollbar-hide::-webkit-scrollbar {
  display: none;
}

.scrollbar-hide {
  -ms-overflow-style: none;
  scrollbar-width: none;
}

.mask-fade-top-giant {
  mask-image: linear-gradient(to bottom, transparent, black 15%);
}

@keyframes spin-slow {
  from {
    transform: rotate(0deg);
  }

  to {
    transform: rotate(360deg);
  }
}

.animate-spin-slow {
  animation: spin-slow 8s linear infinite;
}
</style>
