<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import {
  ArrowLeft,
  BookOpen,
  PenLine,
  MessageSquare,
  Globe,
  Mic,
  Square,
  Volume2,
  RotateCcw,
  ChevronRight,
  ChevronLeft,
  CheckCircle2,
  Sparkles,
  HelpCircle,
  X,
  Loader2,
  Flame,
} from 'lucide-vue-next';
import { ACCENTS, getStoredAccent, saveStoredAccent, type Accent } from '../constants/accents';
import { useAuthStore } from '../stores/auth';

interface WordResult {
  word: string;
  score: number;
  accuracy: 'correct' | 'incorrect' | 'needs_work' | string;
  error_type?: string;
  tip?: string;
}

interface PronunciationResult {
  score: number;
  transcription: string;
  words: WordResult[];
  feedback: string;
  pedagogical_tip?: string;
  suggested_sentence?: string;
  correct_audio?: string;
}

interface PracticeSentence {
  text: string;
  level: string;
  tip: string;
}

const PRACTICE_SENTENCES: PracticeSentence[] = [
  // A1
  { text: "Hello, my name is Maria.", level: "A1", tip: "Focus on clear 'H' and 'L' sounds." },
  { text: "I am a student from Brazil.", level: "A1", tip: "Short 'a' in 'am' — don't draw it out." },
  { text: "I live in a small apartment.", level: "A1", tip: "The 'v' in 'live' touches your upper teeth." },
  { text: "This is my friend, John.", level: "A1", tip: "The 'th' in 'this' — tongue between teeth." },
  { text: "I like coffee and bread.", level: "A1", tip: "Stress 'cof-fee' on the first syllable." },
  { text: "She goes to school by bus.", level: "A1", tip: "The 's' in 'bus' is sharp, not like 'z'." },
  { text: "We have two cats at home.", level: "A1", tip: "Short 'a' in 'cats' — keep it quick." },
  { text: "He works in a big hospital.", level: "A1", tip: "Stress 'HOS-pi-tal' on the first syllable." },
  { text: "The book is on the table.", level: "A1", tip: "Clear 't' at the start of 'table'." },
  { text: "It is a sunny day today.", level: "A1", tip: "Double 'n' in 'sunny' — one smooth sound." },

  // A2
  { text: "I usually wake up at seven o'clock.", level: "A2", tip: "The 's' in 'usually' sounds like 'zh'." },
  { text: "She doesn't like to wake up early.", level: "A2", tip: "The 'ea' in 'early' is one long sound." },
  { text: "I have been learning English for three years.", level: "A2", tip: "TH sound: place tongue between teeth." },
  { text: "We went to the beach last weekend.", level: "A2", tip: "The 'ch' in 'beach' is a soft sound." },
  { text: "Could you repeat that, please?", level: "A2", tip: "Rising intonation on 'please' sounds polite." },
  { text: "I need to buy some milk and eggs.", level: "A2", tip: "Link words: 'milk and eggs' flows together." },
  { text: "The restaurant serves delicious Italian food.", level: "A2", tip: "Stress 'res-tau-rant' — three clear syllables." },
  { text: "My brother is taller than me.", level: "A2", tip: "The 'th' in 'than' — tongue between teeth." },
  { text: "It rained a lot during our vacation.", level: "A2", tip: "The 'ai' in 'rained' is a long sound." },
  { text: "Can you tell me where the station is?", level: "A2", tip: "The 's' in 'station' sounds like 'sh'." },

  // B1
  { text: "I think we should take a break now.", level: "B1", tip: "The 'th' in 'think' is unvoiced — tongue out." },
  { text: "I would have gone if I had known about it.", level: "B1", tip: "Past conditionals: rhythm matters more than speed." },
  { text: "The weather has been particularly warm this month.", level: "B1", tip: "Link words smoothly: 'has been', 'this month'." },
  { text: "She is considering applying for a promotion.", level: "B1", tip: "The 'ing' ending should be clear, not 'in'." },
  { text: "Despite the difficulties, we managed to finish on time.", level: "B1", tip: "Emphasize 'de-SPITE' and 'MA-naged'." },
  { text: "I enjoy reading books about history and science.", level: "B1", tip: "The 'j' in 'enjoy' — push air through." },
  { text: "They moved to a new city because of his job.", level: "B1", tip: "The 'c' in 'city' is soft like 's'." },
  { text: "We are looking forward to the weekend trip.", level: "B1", tip: "Phrasal verb stress: 'LOOK-ing for-WARD'." },
  { text: "He apologized for arriving late to the meeting.", level: "B1", tip: "Stress 'a-PO-lo-gized' on the second syllable." },
  { text: "The movie was not as good as I expected.", level: "B1", tip: "The 'x' in 'expected' sounds like 'ks'." },

  // B2
  { text: "The instructions were quite straightforward, weren't they?", level: "B2", tip: "Tag questions rise at the end for real questions." },
  { text: "If I were you, I would reconsider the entire approach.", level: "B2", tip: "Subjunctive 'were' — don't skip it." },
  { text: "The committee has decided to postpone the project indefinitely.", level: "B2", tip: "Multi-syllable words: give each syllable space." },
  { text: "Notwithstanding the evidence, the jury reached a unanimous verdict.", level: "B2", tip: "Focus on consonant clusters: 'stand', 'ver-dict'." },
  { text: "The government ought to invest more in renewable energy.", level: "B2", tip: "The 'gh' in 'ought' is silent." },
  { text: "It is worth considering the long-term implications.", level: "B2", tip: "The 'th' in 'worth' — unvoiced, tongue out." },
  { text: "Her presentation was remarkably insightful and well-structured.", level: "B2", tip: "Stress 'pre-sen-TA-tion' on the third syllable." },
  { text: "The outbreak of the pandemic changed everything overnight.", level: "B2", tip: "The 'p' in 'pandemic' is aspirated (puff of air)." },
  { text: "We need to foster a culture of innovation and collaboration.", level: "B2", tip: "The 't' in 'culture' sounds like 'ch'." },
  { text: "The phenomenon is not as straightforward as it seems.", level: "B2", tip: "Stress 'phe-NO-me-non' on the second syllable." },

  // C1
  { text: "The pharmaceutical industry has undergone substantial regulatory reforms.", level: "C1", tip: "Focus on word stress: 'phar-ma-CEU-ti-cal', 're-GU-la-to-ry'." },
  { text: "Nevertheless, the implications of this socioeconomic phenomenon remain contentious.", level: "C1", tip: "Long words: break into syllables and maintain rhythm." },
  { text: "The government's austerity measures have precipitated widespread public dissent.", level: "C1", tip: "Consonant clusters: 'stri-ty', 'pre-CI-pi-ta-ted'." },
  { text: "From a pedagogical standpoint, the curriculum requires a more nuanced approach.", level: "C1", tip: "Stress: 'pe-da-GO-gi-cal', 'NU-an-ced'." },
  { text: "The discrepancy between the two reports is quite alarming.", level: "C1", tip: "Stress 'dis-CRE-pan-cy' on the second syllable." },

  // C2
  { text: "The epistemological foundations of postmodernist discourse are inherently paradoxical.", level: "C2", tip: "Master complex word stress: 'e-pis-te-MO-lo-gi-cal', 'pos-TMO-dern-ist'." },
  { text: "Notwithstanding the aforementioned caveats, the extrapolation remains justifiable.", level: "C2", tip: "Smooth linking between long words — don't pause between them." },
  { text: "The phenomenological approach to research elucidates subjective experiential realities.", level: "C2", tip: "Natural rhythm: 'phe-no-me-no-LO-gi-cal', 'e-LU-ci-dates'." },
  { text: "The juxtaposition of these two ideologies creates a fascinating dialectic.", level: "C2", tip: "Stress 'jux-ta-po-SI-tion' on the fourth syllable." },
  { text: "His peripatetic career has encompassed a panoply of interdisciplinary endeavors.", level: "C2", tip: "Stress 'pe-ri-pa-TE-tic' and 'PAN-o-ply'." },
];

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

type InputMode = 'preset' | 'custom' | 'free';

const inputMode = ref<InputMode>('preset');
const customText = ref('');
const selectedLevel = ref<string>('All');
const currentIndex = ref(0);
const selectedAccent = ref<string>(getStoredAccent());
const isAccentModalOpen = ref(false);

const isRecording = ref(false);
const isEvaluating = ref(false);
const isPlayingTati = ref(false);
const isPlayingUser = ref(false);
const recordingDuration = ref(0);
const recordingError = ref<string | null>(null);

const result = ref<PronunciationResult | null>(null);
const selectedWord = ref<WordResult | null>(null);
const userAudioBlobUrl = ref<string | null>(null);
const userAudioBase64 = ref<string | null>(null);

const history = ref<Array<{ sentence: string; score: number }>>([]);

let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let recordingInterval: number | null = null;
let mediaStream: MediaStream | null = null;

const currentAccentObj = computed(() => {
  return ACCENTS.find((a) => a.id === selectedAccent.value) || ACCENTS[0];
});

const filteredSentences = computed(() => {
  if (selectedLevel.value === 'All') return PRACTICE_SENTENCES;
  return PRACTICE_SENTENCES.filter((s) => s.level === selectedLevel.value);
});

const currentSentence = computed(() => {
  if (filteredSentences.value.length === 0) return null;
  return filteredSentences.value[currentIndex.value % filteredSentences.value.length];
});

const activeReferenceText = computed(() => {
  if (inputMode.value === 'preset') return currentSentence.value?.text || '';
  if (inputMode.value === 'custom') return customText.value.trim();
  return '';
});

const avgScore = computed(() => {
  if (history.value.length === 0) return 0;
  return Math.round(history.value.reduce((acc, h) => acc + h.score, 0) / history.value.length);
});

onMounted(() => {
  // If phrase was passed via query params (e.g. from chat)
  const queryPhrase = route.query.phrase as string;
  if (queryPhrase) {
    inputMode.value = 'custom';
    customText.value = queryPhrase;
  }

  const handleTestEvaluation = (e: any) => {
    if (e.detail) {
      result.value = e.detail;
      history.value.unshift({
        sentence: activeReferenceText.value || e.detail.transcription || '(Test)',
        score: e.detail.score,
      });
    }
  };
  window.addEventListener('tati_test_evaluation', handleTestEvaluation);
});

function handleSelectAccent(accId: string) {
  selectedAccent.value = accId;
  saveStoredAccent(accId);
  isAccentModalOpen.value = false;
}

function selectLevel(lvl: string) {
  selectedLevel.value = lvl;
  currentIndex.value = 0;
  result.value = null;
  selectedWord.value = null;
}

function nextSentence() {
  result.value = null;
  selectedWord.value = null;
  userAudioBlobUrl.value = null;
  if (currentIndex.value < filteredSentences.value.length - 1) {
    currentIndex.value++;
  } else {
    currentIndex.value = 0;
  }
}

function prevSentence() {
  result.value = null;
  selectedWord.value = null;
  userAudioBlobUrl.value = null;
  if (currentIndex.value > 0) {
    currentIndex.value--;
  } else {
    currentIndex.value = filteredSentences.value.length - 1;
  }
}

// Speak reference sentence with Teacher Tati's voice
async function playReferenceVoice() {
  const textToPlay = activeReferenceText.value;
  if (!textToPlay) return;

  if (isPlayingTati.value) {
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    isPlayingTati.value = false;
    return;
  }

  isPlayingTati.value = true;

  // 1. Try Backend TTS
  try {
    const res = await fetch('/chat/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify({
        text: textToPlay,
        accent: selectedAccent.value,
      }),
    });

    if (res.ok) {
      const data = await res.json();
      const b64 = data.audio || data.audio_b64;
      if (b64) {
        const audio = new Audio(`data:audio/mp3;base64,${b64}`);
        audio.onended = () => { isPlayingTati.value = false; };
        audio.onerror = () => { isPlayingTati.value = false; fallbackSpeak(textToPlay); };
        await audio.play();
        return;
      }
    }
  } catch (err) {
    console.warn('TTS backend failed, using Web Speech fallback:', err);
  }

  // Fallback to Web Speech API
  fallbackSpeak(textToPlay);
}

function fallbackSpeak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    isPlayingTati.value = false;
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = selectedAccent.value || 'en-US';
  utterance.rate = 0.9;
  utterance.onend = () => { isPlayingTati.value = false; };
  utterance.onerror = () => { isPlayingTati.value = false; };
  window.speechSynthesis.speak(utterance);
}

// Play student's recorded audio
function playUserAudio() {
  if (!userAudioBlobUrl.value) return;
  const audio = new Audio(userAudioBlobUrl.value);
  isPlayingUser.value = true;
  audio.onended = () => { isPlayingUser.value = false; };
  audio.onerror = () => { isPlayingUser.value = false; };
  audio.play().catch(() => { isPlayingUser.value = false; });
}

// Start audio recording with MediaRecorder
async function startRecording() {
  if (isRecording.value || isEvaluating.value) return;
  recordingError.value = null;
  result.value = null;
  selectedWord.value = null;
  userAudioBlobUrl.value = null;

  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
    mediaStream = stream;

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
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
        mediaStream = null;
      }

      if (audioChunks.length === 0) {
        recordingError.value = 'Nenhum áudio foi gravado. Tente novamente.';
        return;
      }

      const blob = new Blob(audioChunks, { type: mimeType });
      userAudioBlobUrl.value = URL.createObjectURL(blob);

      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = async () => {
        const resultStr = reader.result as string;
        const b64 = resultStr.includes(',') ? resultStr.split(',')[1] : resultStr;
        userAudioBase64.value = b64;
        await evaluateRecording(b64);
      };
      reader.readAsDataURL(blob);
    };

    recorder.start(250);
    recordingDuration.value = 0;
    isRecording.value = true;

    recordingInterval = window.setInterval(() => {
      recordingDuration.value++;
    }, 1000);
  } catch (err: any) {
    console.error('Mic error:', err);
    recordingError.value = 'Acesso ao microfone negado ou não encontrado. Verifique suas permissões.';
    isRecording.value = false;
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

// Evaluate via Backend
async function evaluateRecording(base64: string) {
  isEvaluating.value = true;
  recordingError.value = null;

  try {
    const payload: Record<string, any> = {
      audio: base64,
      accent: selectedAccent.value,
    };

    if (activeReferenceText.value) {
      payload.reference_text = activeReferenceText.value;
    }

    const res = await fetch('/speech/verify-pronunciation', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      throw new Error(`Servidor respondeu com status ${res.status}`);
    }

    const data: PronunciationResult = await res.json();
    result.value = data;

    // Record into history
    history.value.unshift({
      sentence: activeReferenceText.value || data.transcription || '(Free Speech)',
      score: data.score,
    });
  } catch (err: any) {
    console.error('Evaluation error:', err);
    recordingError.value = 'Erro ao avaliar a pronúncia. Tente novamente.';
  } finally {
    isEvaluating.value = false;
  }
}

function formatDuration(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function getWordBadgeClass(acc: string) {
  if (acc === 'correct') return 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 hover:bg-emerald-500/20';
  if (acc === 'needs_work') return 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/30 hover:bg-amber-500/20';
  return 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/30 hover:bg-rose-500/20';
}

function getScoreColorClass(score: number) {
  if (score >= 85) return 'text-emerald-500 border-emerald-500/30 bg-emerald-500/10';
  if (score >= 60) return 'text-amber-500 border-amber-500/30 bg-amber-500/10';
  return 'text-rose-500 border-rose-500/30 bg-rose-500/10';
}

onUnmounted(() => {
  if (recordingInterval) clearInterval(recordingInterval);
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  if (mediaStream) {
    mediaStream.getTracks().forEach((t) => t.stop());
  }
  if (userAudioBlobUrl.value) {
    URL.revokeObjectURL(userAudioBlobUrl.value);
  }
});
</script>

<template>
  <div class="min-h-screen bg-bg flex flex-col font-sans">
    <!-- Topbar Header -->
    <header class="sticky top-0 z-20 border-b border-line bg-surface/80 backdrop-blur-md px-4 py-3">
      <div class="max-w-5xl mx-auto flex items-center justify-between gap-3">
        <div class="flex items-center gap-3">
          <button
            type="button"
            class="p-2 rounded-xl text-muted hover:text-ink hover:bg-bgSecondary transition active:scale-95 cursor-pointer"
            title="Voltar ao Chat"
            @click="route.query.conv_id ? router.push({ path: '/chat', query: { conv_id: route.query.conv_id } }) : router.push('/chat')"
          >
            <ArrowLeft :size="20" />
          </button>

          <div>
            <h1 class="text-base sm:text-lg font-bold text-ink flex items-center gap-2">
              <BookOpen :size="18" class="text-primary" />
              Pronunciation Reader
            </h1>
            <p class="text-xs text-muted hidden sm:block">
              Treine sua fala, dicção e entonação com a Teacher Tati
            </p>
          </div>
        </div>

        <!-- Controls: Accent + Avg Score -->
        <div class="flex items-center gap-2 sm:gap-3">
          <!-- Accent Selector Button -->
          <button
            type="button"
            class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface border border-line hover:border-primary/50 text-xs font-semibold text-ink transition shadow-sm active:scale-95 cursor-pointer"
            title="Alterar sotaque da Teacher Tati"
            @click="isAccentModalOpen = true"
          >
            <span class="text-base">{{ currentAccentObj.flag }}</span>
            <span class="hidden md:inline">{{ currentAccentObj.shortLabel }}</span>
            <Globe :size="13" class="text-muted ml-0.5" />
          </button>

          <!-- History Score Average -->
          <div v-if="history.length > 0" class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line bg-surface shadow-sm">
            <Flame :size="14" class="text-amber-500 fill-amber-500" />
            <div class="text-xs">
              <span class="font-bold" :class="getScoreColorClass(avgScore)">{{ avgScore }}%</span>
              <span class="text-muted ml-1 hidden sm:inline">média</span>
            </div>
          </div>
        </div>
      </div>
    </header>

    <!-- Main Content Container -->
    <main class="flex-1 max-w-3xl w-full mx-auto p-4 sm:p-6 flex flex-col gap-5">
      <!-- Mode Selection Tabs -->
      <div class="grid grid-cols-3 gap-2 p-1.5 rounded-2xl bg-bgSecondary border border-line">
        <button
          type="button"
          class="flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer"
          :class="inputMode === 'preset' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-ink'"
          @click="inputMode = 'preset'"
        >
          <BookOpen :size="15" />
          <span class="truncate">Frases Prontas</span>
        </button>

        <button
          type="button"
          class="flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer"
          :class="inputMode === 'custom' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-ink'"
          @click="inputMode = 'custom'"
        >
          <PenLine :size="15" />
          <span class="truncate">Texto Próprio</span>
        </button>

        <button
          type="button"
          class="flex items-center justify-center gap-2 py-2 px-3 rounded-xl text-xs sm:text-sm font-semibold transition cursor-pointer"
          :class="inputMode === 'free' ? 'bg-primary text-white shadow-sm' : 'text-muted hover:text-ink'"
          @click="inputMode = 'free'"
        >
          <MessageSquare :size="15" />
          <span class="truncate">Fala Livre</span>
        </button>
      </div>

      <!-- Level Filter (only for Preset mode) -->
      <div v-if="inputMode === 'preset'" class="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
        <span class="text-xs font-semibold text-muted mr-1">Nível:</span>
        <button
          v-for="lvl in ['All', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2']"
          :key="lvl"
          type="button"
          class="px-2.5 py-1 rounded-lg text-xs font-bold transition cursor-pointer"
          :class="selectedLevel === lvl ? 'bg-primarySoft text-primary border border-primary/30' : 'bg-surface border border-line text-muted hover:text-ink'"
          @click="selectLevel(lvl)"
        >
          {{ lvl }}
        </button>
      </div>

      <!-- Practice Card Arena -->
      <section class="rounded-3xl border border-line bg-surface p-5 sm:p-7 shadow-sm flex flex-col gap-5">
        <!-- MODE 1: Preset Sentences -->
        <div v-if="inputMode === 'preset' && currentSentence" class="flex flex-col gap-4">
          <div class="flex items-center justify-between">
            <span class="px-2.5 py-0.5 rounded-full text-xs font-bold bg-primarySoft text-primary border border-primary/20">
              Nível {{ currentSentence.level }}
            </span>
            <span class="text-xs text-muted">
              {{ currentIndex + 1 }} de {{ filteredSentences.length }}
            </span>
          </div>

          <!-- Sentence text -->
          <div class="py-2">
            <p class="text-xl sm:text-2xl font-serif font-medium text-ink leading-relaxed">
              "{{ currentSentence.text }}"
            </p>
          </div>

          <!-- Pedagogical tip & Listen button -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2 border-t border-line/60">
            <div class="flex items-center gap-2 text-xs text-muted">
              <Sparkles :size="14" class="text-primary shrink-0" />
              <span><strong>Dica:</strong> {{ currentSentence.tip }}</span>
            </div>

            <button
              type="button"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-primary/30 bg-primarySoft text-primary hover:bg-primary/20 font-semibold text-xs transition cursor-pointer shrink-0 self-start sm:self-auto"
              @click="playReferenceVoice"
            >
              <Volume2 :size="14" />
              <span>{{ isPlayingTati ? 'Pausar' : 'Ouvir Tati' }}</span>
            </button>
          </div>

          <!-- Navigation Prev / Next -->
          <div class="flex items-center justify-between pt-2">
            <button
              type="button"
              class="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-line text-xs font-medium text-muted hover:text-ink hover:bg-bgSecondary transition cursor-pointer"
              @click="prevSentence"
            >
              <ChevronLeft :size="15" />
              Anterior
            </button>
            <button
              type="button"
              class="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-line text-xs font-medium text-muted hover:text-ink hover:bg-bgSecondary transition cursor-pointer"
              @click="nextSentence"
            >
              Próxima
              <ChevronRight :size="15" />
            </button>
          </div>
        </div>

        <!-- MODE 2: Custom Text -->
        <div v-else-if="inputMode === 'custom'" class="flex flex-col gap-3">
          <label class="text-xs font-bold text-muted">Digite qualquer frase ou texto em inglês:</label>
          <textarea
            v-model="customText"
            rows="3"
            placeholder="Ex: I would like to schedule our next appointment on Tuesday."
            class="w-full rounded-2xl border border-line bg-bgSecondary/60 p-3.5 text-sm sm:text-base text-ink placeholder:text-muted outline-none focus:border-primary/50 focus:ring-2 focus:ring-primary/10 transition leading-relaxed resize-none"
          />

          <div class="flex justify-end">
            <button
              v-if="customText.trim()"
              type="button"
              class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-primary/30 bg-primarySoft text-primary hover:bg-primary/20 font-semibold text-xs transition cursor-pointer"
              @click="playReferenceVoice"
            >
              <Volume2 :size="14" />
              <span>{{ isPlayingTati ? 'Pausar' : 'Ouvir pronúncia da Tati' }}</span>
            </button>
          </div>
        </div>

        <!-- MODE 3: Free Speech -->
        <div v-else-if="inputMode === 'free'" class="flex flex-col items-center text-center py-4 gap-2">
          <div class="h-12 w-12 rounded-2xl bg-primarySoft text-primary flex items-center justify-center mb-1">
            <MessageSquare :size="24" />
          </div>
          <h3 class="text-base font-bold text-ink">Prática de Fala Livre</h3>
          <p class="text-xs sm:text-sm text-muted max-w-md">
            Grave qualquer relato, ideia ou responda sobre seu dia em inglês. A Teacher Tati vai transcrever e avaliar sua pronúncia e clareza automaticamente.
          </p>
        </div>

        <!-- Error Alert -->
        <div v-if="recordingError" class="p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 text-xs">
          {{ recordingError }}
        </div>

        <!-- Record Action Controls -->
        <div class="flex flex-col items-center justify-center gap-3 pt-3">
          <!-- Evaluating Spinner -->
          <div v-if="isEvaluating" class="flex flex-col items-center gap-2 py-4 text-primary">
            <Loader2 :size="32" class="animate-spin" />
            <span class="text-sm font-semibold">Analisando fonemas e pronúncia com IA...</span>
          </div>

          <!-- Record / Stop Button -->
          <div v-else class="flex flex-col items-center gap-2">
            <button
              type="button"
              class="relative h-16 w-16 sm:h-20 sm:w-20 rounded-full flex items-center justify-center transition-all duration-300 shadow-lg active:scale-95 cursor-pointer"
              :class="isRecording ? 'bg-rose-500 text-white shadow-rose-500/40 animate-pulse ring-8 ring-rose-500/20' : 'bg-primary text-white shadow-primary/30 hover:bg-primaryHover'"
              :title="isRecording ? 'Parar gravação' : 'Gravar pronúncia'"
              @click="isRecording ? stopRecording() : startRecording()"
            >
              <Square v-if="isRecording" :size="24" class="fill-current" />
              <Mic v-else :size="28" />
            </button>

            <span class="text-xs font-semibold text-muted">
              {{ isRecording ? `Gravando... ${formatDuration(recordingDuration)} (Clique para parar)` : 'Clique no microfone para falar' }}
            </span>
          </div>
        </div>
      </section>

      <!-- RESULTS SECTION -->
      <section v-if="result" class="rounded-3xl border border-line bg-surface p-5 sm:p-7 shadow-sm flex flex-col gap-5">
        <div class="flex items-center justify-between border-b border-line pb-4">
          <div>
            <h2 class="text-base font-bold text-ink">Avaliação de Pronúncia</h2>
            <p class="text-xs text-muted">Veja seu desempenho fonético e dicas pedagógicas</p>
          </div>

          <!-- Score Gauge Badge -->
          <div
            class="flex items-center gap-2 px-3.5 py-1.5 rounded-2xl border font-bold text-base sm:text-lg"
            :class="getScoreColorClass(result.score)"
          >
            <span>{{ result.score }}%</span>
            <span class="text-xs font-medium">Pontuação</span>
          </div>
        </div>

        <!-- Audio Comparison Bar -->
        <div class="flex flex-wrap items-center gap-3 p-3 rounded-2xl bg-bgSecondary border border-line">
          <span class="text-xs font-bold text-muted">Comparar áudios:</span>
          
          <button
            type="button"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line bg-surface text-ink hover:border-primary/40 text-xs font-semibold transition cursor-pointer"
            @click="playUserAudio"
          >
            <Volume2 :size="14" class="text-primary" />
            <span>{{ isPlayingUser ? 'Pausando...' : 'Ouvir sua gravação' }}</span>
          </button>

          <button
            type="button"
            class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-primary/20 bg-primarySoft text-primary hover:bg-primary/20 text-xs font-semibold transition cursor-pointer"
            @click="playReferenceVoice"
          >
            <Volume2 :size="14" />
            <span>Ouvir nativo (Tati)</span>
          </button>
        </div>

        <!-- Word-by-Word Breakdown -->
        <div v-if="result.words && result.words.length > 0" class="flex flex-col gap-2">
          <span class="text-xs font-bold text-muted">Toque em cada palavra para detalhes fonéticos:</span>
          
          <div class="flex flex-wrap gap-2 p-3.5 rounded-2xl bg-bgSecondary/40 border border-line">
            <button
              v-for="(w, idx) in result.words"
              :key="idx"
              type="button"
              class="px-2.5 py-1 rounded-xl text-sm font-semibold border transition active:scale-95 cursor-pointer"
              :class="[getWordBadgeClass(w.accuracy), selectedWord?.word === w.word ? 'ring-2 ring-primary' : '']"
              @click="selectedWord = w"
            >
              {{ w.word }}
            </button>
          </div>
        </div>

        <!-- Word Details Modal / Box -->
        <div
          v-if="selectedWord"
          class="p-4 rounded-2xl border border-primary/30 bg-primarySoft flex items-start justify-between gap-3"
        >
          <div class="space-y-1">
            <div class="flex items-center gap-2">
              <span class="text-base font-bold text-ink">"{{ selectedWord.word }}"</span>
              <span class="text-xs font-semibold px-2 py-0.5 rounded-md" :class="getWordBadgeClass(selectedWord.accuracy)">
                {{ selectedWord.accuracy === 'correct' ? 'Excelente' : selectedWord.accuracy === 'needs_work' ? 'Pode melhorar' : 'Incorreto' }} ({{ selectedWord.score }}%)
              </span>
            </div>
            <p v-if="selectedWord.tip" class="text-xs text-ink/80 leading-relaxed">
              💡 {{ selectedWord.tip }}
            </p>
          </div>

          <button
            type="button"
            class="p-1 rounded-lg text-muted hover:text-ink cursor-pointer"
            @click="selectedWord = null"
          >
            <X :size="16" />
          </button>
        </div>

        <!-- Teacher Feedback / Pedagogical Tip -->
        <div v-if="result.feedback || result.pedagogical_tip" class="p-4 rounded-2xl border border-line bg-bgSecondary flex flex-col gap-2">
          <div class="flex items-center gap-1.5 text-xs font-bold text-primary">
            <Sparkles :size="15" />
            <span>Feedback da Teacher Tati</span>
          </div>
          <p v-if="result.feedback" class="text-xs sm:text-sm text-ink leading-relaxed">
            {{ result.feedback }}
          </p>
          <p v-if="result.pedagogical_tip" class="text-xs text-muted leading-relaxed italic border-t border-line/60 pt-2">
            📌 {{ result.pedagogical_tip }}
          </p>
        </div>

        <!-- Try Again / Next buttons -->
        <div class="flex items-center justify-end gap-3 pt-2">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl border border-line bg-surface text-ink text-xs font-semibold hover:bg-bgSecondary transition cursor-pointer"
            @click="startRecording"
          >
            <RotateCcw :size="14" />
            Tentar novamente
          </button>

          <button
            v-if="inputMode === 'preset'"
            type="button"
            class="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-xs font-semibold hover:bg-primaryHover transition cursor-pointer"
            @click="nextSentence"
          >
            Próxima frase
            <ChevronRight :size="14" />
          </button>
        </div>
      </section>
    </main>

    <!-- Accent Selection Modal -->
    <div
      v-if="isAccentModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
      @click.self="isAccentModalOpen = false"
    >
      <div class="w-full max-w-sm rounded-3xl border border-line bg-surface p-5 shadow-2xl space-y-4">
        <div class="flex items-center justify-between border-b border-line pb-3">
          <div class="flex items-center gap-2">
            <Globe :size="18" class="text-primary" />
            <h3 class="text-base font-bold text-ink">Sotaque da Teacher Tati</h3>
          </div>
          <button
            type="button"
            class="p-1 rounded-lg text-muted hover:text-ink cursor-pointer"
            @click="isAccentModalOpen = false"
          >
            <X :size="18" />
          </button>
        </div>

        <p class="text-xs text-muted">
          Escolha qual variação da língua inglesa você gostaria de treinar na escuta e pronúncia:
        </p>

        <div class="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-1">
          <button
            v-for="acc in ACCENTS"
            :key="acc.id"
            type="button"
            class="flex items-center justify-between p-3 rounded-2xl border text-xs font-semibold transition cursor-pointer"
            :class="selectedAccent === acc.id ? 'border-primary bg-primarySoft text-primary' : 'border-line bg-surface hover:bg-bgSecondary text-ink'"
            @click="handleSelectAccent(acc.id)"
          >
            <div class="flex items-center gap-2.5">
              <span class="text-lg">{{ acc.flag }}</span>
              <span>{{ acc.label }}</span>
            </div>
            <CheckCircle2 v-if="selectedAccent === acc.id" :size="16" class="text-primary" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
