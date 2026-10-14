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
  X,
  Loader2,
} from 'lucide-vue-next';
import { ACCENTS, getStoredAccent, saveStoredAccent } from '../constants/accents';
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
  metadata?: {
    accuracy_score?: number;
    fluency_score?: number;
    completeness_score?: number;
    segments?: any[];
    language?: string;
    duration?: number;
    free_speech?: boolean;
  };
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
  { text: "The proposed legislation would fundamentally alter the healthcare landscape.", level: "C1", tip: "The 'g' in 'legislation' sounds like 'j'." },
  { text: "It is imperative that we address these issues without further delay.", level: "C1", tip: "Stress 'im-PE-ra-tive' on the second syllable." },
  { text: "The correlation between diet and cognitive function is well documented.", level: "C1", tip: "Stress 'cor-re-LA-tion' and 'COG-ni-tive'." },
  { text: "Her unequivocal stance on the matter surprised many of her colleagues.", level: "C1", tip: "The 'qu' in 'unequivocal' sounds like 'kw'." },
  { text: "The unprecedented scale of the challenge requires a coordinated global response.", level: "C1", tip: "Stress 'un-PRE-ce-den-ted' — five clear syllables." },

  // C2
  { text: "The epistemological foundations of postmodernist discourse are inherently paradoxical.", level: "C2", tip: "Master complex word stress: 'e-pis-te-MO-lo-gi-cal', 'pos-TMO-dern-ist'." },
  { text: "Notwithstanding the aforementioned caveats, the extrapolation remains justifiable.", level: "C2", tip: "Smooth linking between long words — don't pause between them." },
  { text: "The phenomenological approach to research elucidates subjective experiential realities.", level: "C2", tip: "Natural rhythm: 'phe-no-me-no-LO-gi-cal', 'e-LU-ci-dates'." },
  { text: "A multidisciplinary synthesis of contemporaneous paradigms proves indispensable.", level: "C2", tip: "Intonation patterns in very long sentences — use pitch variation." },
  { text: "The quintessence of her argument lies in the ontological distinction she draws.", level: "C2", tip: "Stress 'quin-TES-sence' and 'on-to-LO-gi-cal'." },
  { text: "The juxtaposition of these two ideologies creates a fascinating dialectic.", level: "C2", tip: "Stress 'jux-ta-po-SI-tion' on the fourth syllable." },
  { text: "Her magnum opus constitutes an invaluable contribution to sociolinguistic theory.", level: "C2", tip: "Latin phrases: 'MAG-num O-pus' — maintain original pronunciation." },
  { text: "The inscrutable nature of the data renders any definitive conclusion untenable.", level: "C2", tip: "Stress 'in-SCRU-ta-ble' and 'un-TE-na-ble'." },
  { text: "The proliferation of disinformation necessitates a paradigm shift in media literacy.", level: "C2", tip: "Stress 'pro-li-fe-RA-tion' — six syllables with clear rhythm." },
  { text: "His peripatetic career has encompassed a panoply of interdisciplinary endeavors.", level: "C2", tip: "Stress 'pe-ri-pa-TE-tic' and 'PAN-o-ply'." },
];

type InputMode = 'preset' | 'custom' | 'free';

const router = useRouter();
const route = useRoute();
const authStore = useAuthStore();

const inputMode = ref<InputMode>('preset');
const currentIndex = ref(0);
const customText = ref('');
const isRecording = ref(false);
const isEvaluating = ref(false);
const isPlayingTati = ref(false);
const isPlayingUser = ref(false);
const isPlayingWord = ref<string | null>(null);
const recordingError = ref<string | null>(null);
const result = ref<PronunciationResult | null>(null);
const selectedWord = ref<WordResult | null>(null);
const userAudioBlobUrl = ref<string | null>(null);
const history = ref<{ sentence: string; score: number }[]>([]);

const selectedAccent = ref<string>(getStoredAccent());
const isAccentModalOpen = ref(false);

const canvasRef = ref<HTMLCanvasElement | null>(null);
let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let mediaStream: MediaStream | null = null;
let audioContext: AudioContext | null = null;
let analyser: AnalyserNode | null = null;
let animFrame: number | null = null;

const currentAccentObj = computed(() => {
  return ACCENTS.find((a) => a.id === selectedAccent.value) || ACCENTS[0];
});

const currentSentence = computed(() => {
  if (PRACTICE_SENTENCES.length === 0) return null;
  return PRACTICE_SENTENCES[currentIndex.value % PRACTICE_SENTENCES.length];
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
});

function handleBack() {
  const convId = (route.query.conv_id || route.query.id) as string;
  if (convId) {
    router.push({ path: '/chat', query: { conv_id: convId } });
  } else if (window.history.length > 1) {
    router.back();
  } else {
    router.push('/chat');
  }
}

function handleSelectAccent(accId: string) {
  selectedAccent.value = accId;
  saveStoredAccent(accId);
  isAccentModalOpen.value = false;
}

function nextSentence() {
  result.value = null;
  selectedWord.value = null;
  recordingError.value = null;
  userAudioBlobUrl.value = null;
  if (currentIndex.value < PRACTICE_SENTENCES.length - 1) {
    currentIndex.value++;
  } else {
    currentIndex.value = 0;
  }
}

function prevSentence() {
  result.value = null;
  selectedWord.value = null;
  recordingError.value = null;
  userAudioBlobUrl.value = null;
  if (currentIndex.value > 0) {
    currentIndex.value--;
  } else {
    currentIndex.value = PRACTICE_SENTENCES.length - 1;
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

  fallbackSpeak(textToPlay);
}

function fallbackSpeak(text: string) {
  if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
    isPlayingTati.value = false;
    return;
  }
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  const targetAccent = selectedAccent.value || 'en-US';
  utterance.lang = targetAccent;
  utterance.rate = 0.85;

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
    utterance.voice = femaleVoice;
  }

  isPlayingTati.value = true;
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

// Play correct audio for a specific word
async function playWordAudio(wordToPlay: string) {
  isPlayingWord.value = wordToPlay;
  const clean = wordToPlay.replace(/[^\w\s']/g, '').trim();
  try {
    const res = await fetch('/chat/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify({
        text: clean,
        accent: selectedAccent.value,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      const b64 = data.audio || data.audio_b64;
      if (b64) {
        const audio = new Audio(`data:audio/mp3;base64,${b64}`);
        audio.onended = () => { isPlayingWord.value = null; };
        audio.onerror = () => { isPlayingWord.value = null; };
        await audio.play();
        return;
      }
    }
  } catch (_) {}

  if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
    const u = new SpeechSynthesisUtterance(clean);
    u.lang = selectedAccent.value || 'en-US';
    u.rate = 0.85;
    const voices = window.speechSynthesis.getVoices();
    const femaleVoice = voices.find(
      (v) =>
        v.lang.toLowerCase().startsWith(selectedAccent.value.slice(0, 2).toLowerCase()) &&
        !v.name.includes('David') &&
        !v.name.includes('George') &&
        !v.name.includes('Male')
    );
    if (femaleVoice) u.voice = femaleVoice;
    u.onend = () => { isPlayingWord.value = null; };
    u.onerror = () => { isPlayingWord.value = null; };
    window.speechSynthesis.speak(u);
  } else {
    isPlayingWord.value = null;
  }
}

function drawWaveform() {
  if (!canvasRef.value || !analyser) return;
  const canvas = canvasRef.value;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);

  const draw = () => {
    if (!isRecording.value) return;
    animFrame = requestAnimationFrame(draw);
    analyser!.getByteTimeDomainData(dataArray);

    ctx.fillStyle = 'rgba(0, 0, 0, 0.05)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.lineWidth = 2;
    ctx.strokeStyle = '#8b5cf6';
    ctx.beginPath();

    const sliceWidth = (canvas.width * 1.0) / bufferLength;
    let x = 0;

    for (let i = 0; i < bufferLength; i++) {
      const v = dataArray[i] / 128.0;
      const y = (v * canvas.height) / 2;

      if (i === 0) {
        ctx.moveTo(x, y);
      } else {
        ctx.lineTo(x, y);
      }
      x += sliceWidth;
    }

    ctx.lineTo(canvas.width, canvas.height / 2);
    ctx.stroke();
  };

  draw();
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

    // Web Audio waveform analyser
    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        audioContext = new AudioCtxClass();
        if (audioContext.state === 'suspended') {
          await audioContext.resume();
        }
        const source = audioContext.createMediaStreamSource(stream);
        analyser = audioContext.createAnalyser();
        analyser.fftSize = 2048;
        source.connect(analyser);
        drawWaveform();
      }
    } catch (e) {
      console.warn('AudioContext waveform not available:', e);
    }

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
      if (audioContext && audioContext.state !== 'closed') {
        try { audioContext.close(); } catch (_) {}
        audioContext = null;
      }
      if (animFrame) {
        cancelAnimationFrame(animFrame);
        animFrame = null;
      }

      if (audioChunks.length === 0) {
        recordingError.value = 'Nenhum áudio foi gravado. Tente novamente.';
        return;
      }

      const blob = new Blob(audioChunks, { type: mimeType });
      userAudioBlobUrl.value = URL.createObjectURL(blob);

      const reader = new FileReader();
      reader.onloadend = async () => {
        const resultStr = reader.result as string;
        const b64 = resultStr.includes(',') ? resultStr.split(',')[1] : resultStr;
        await evaluateRecording(b64);
      };
      reader.readAsDataURL(blob);
    };

    recorder.start(250);
    isRecording.value = true;
  } catch (err: any) {
    console.error('Mic error:', err);
    recordingError.value = 'Acesso ao microfone negado ou não encontrado. Verifique suas permissões.';
    isRecording.value = false;
  }
}

function stopRecording() {
  if (animFrame) {
    cancelAnimationFrame(animFrame);
    animFrame = null;
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

    // Auto-play correct pronunciation if returned
    if (data.correct_audio) {
      const audio = new Audio(`data:audio/mp3;base64,${data.correct_audio}`);
      audio.play().catch((e) => console.warn('Could not auto-play audio:', e));
    }

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

function playCorrectAudio() {
  if (result.value?.correct_audio) {
    const audio = new Audio(`data:audio/mp3;base64,${result.value.correct_audio}`);
    audio.play().catch((e) => console.warn('Could not play correct audio:', e));
  }
}

function getWordBadgeClass(acc: string) {
  if (acc === 'correct') return 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30';
  if (acc === 'needs_work') return 'bg-amber-500/10 hover:bg-amber-500/20 text-amber-600 dark:text-amber-400 border-amber-500/40 ring-1 ring-amber-500/20';
  return 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-600 dark:text-rose-400 border-rose-500/40 line-through';
}

function getScoreColorClass(score: number) {
  if (score >= 85) return 'text-emerald-500';
  if (score >= 60) return 'text-amber-500';
  return 'text-rose-500';
}

onUnmounted(() => {
  if (animFrame) cancelAnimationFrame(animFrame);
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
    <!-- Header matching design_system/pronunciation.html -->
    <header class="border-b border-border bg-bg-secondary/50 backdrop-blur-sm px-4 py-3 flex items-center gap-3">
      <button
        type="button"
        class="p-2 rounded-lg hover:bg-surface-hover transition-colors cursor-pointer text-text"
        title="Voltar ao Chat"
        @click="handleBack"
      >
        <ArrowLeft :size="20" />
      </button>

      <div class="flex-1">
        <h1 class="text-lg font-bold text-text flex items-center gap-2">
          <BookOpen :size="20" class="text-primary" />
          Pronunciation Reader
        </h1>
        <p class="text-xs text-text-muted">Read aloud, write your own text, or just speak freely</p>
      </div>

      <!-- Accent Selector Button in Header -->
      <button
        type="button"
        class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-surface border border-border hover:border-primary/40 text-xs font-bold text-text transition-all shadow-sm active:scale-95 shrink-0 cursor-pointer"
        title="Change Teacher Tati's accent"
        @click="isAccentModalOpen = true"
      >
        <span class="text-base">{{ currentAccentObj.flag }}</span>
        <span class="hidden sm:inline">{{ currentAccentObj.shortLabel }}</span>
        <Globe :size="13" class="text-text-muted ml-0.5" />
      </button>

      <!-- History Score Average -->
      <div v-if="history.length > 0" class="text-right">
        <div class="text-lg font-bold" :class="getScoreColorClass(avgScore)">{{ avgScore }}%</div>
        <div class="text-[0.6rem] text-text-muted">Avg. Score</div>
      </div>
    </header>

    <!-- Main Workspace Container -->
    <div class="flex-1 flex flex-col items-center justify-center p-4 md:p-8 max-w-2xl mx-auto w-full">
      <!-- Mode Selection Tabs -->
      <div class="flex gap-2 mb-3 w-full">
        <button
          type="button"
          class="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
          :class="inputMode === 'preset' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-surface border border-border text-text-muted hover:bg-surface-hover'"
          @click="inputMode = 'preset'"
        >
          <BookOpen :size="14" />
          Preset Sentences
        </button>

        <button
          type="button"
          class="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
          :class="inputMode === 'custom' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-surface border border-border text-text-muted hover:bg-surface-hover'"
          @click="inputMode = 'custom'"
        >
          <PenLine :size="14" />
          Write Your Own
        </button>

        <button
          type="button"
          class="flex-1 flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
          :class="inputMode === 'free' ? 'bg-primary text-white shadow-lg shadow-primary/20' : 'bg-surface border border-border text-text-muted hover:bg-surface-hover'"
          @click="inputMode = 'free'"
        >
          <MessageSquare :size="14" />
          Free Speech
        </button>
      </div>

      <!-- Accent Quick Selection Bar -->
      <div class="w-full flex items-center justify-between gap-2 mb-5 px-1 overflow-x-hidden">
        <span class="text-[0.7rem] font-bold text-text-subtle uppercase tracking-wider flex items-center gap-1.5 shrink-0">
          <Globe :size="12" class="text-primary" />
          Accent:
        </span>
        <div class="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5 max-w-full">
          <button
            v-for="acc in ACCENTS.slice(0, 5)"
            :key="acc.id"
            type="button"
            class="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-bold transition-all shrink-0 active:scale-95 cursor-pointer"
            :class="selectedAccent === acc.id ? 'bg-primary text-white shadow-sm shadow-primary/30' : 'bg-surface border border-border text-text-muted hover:text-text hover:border-primary/30'"
            :title="acc.desc"
            @click="handleSelectAccent(acc.id)"
          >
            <span>{{ acc.flag }}</span>
            <span>{{ acc.shortLabel }}</span>
          </button>
          <button
            type="button"
            class="px-2.5 py-1 rounded-full text-[10px] font-bold bg-surface border border-border text-primary hover:bg-surface-hover shrink-0 cursor-pointer"
            title="View all accents"
            @click="isAccentModalOpen = true"
          >
            More...
          </button>
        </div>
      </div>

      <!-- MODE 1: Preset Sentences -->
      <template v-if="inputMode === 'preset'">
        <div
          class="px-3 py-1 rounded-full text-xs font-bold mb-6"
          :class="
            currentSentence?.level === 'A1' ? 'bg-green-500/20 text-green-400' :
            currentSentence?.level === 'A2' ? 'bg-green-500/15 text-green-300' :
            currentSentence?.level === 'B1' ? 'bg-blue-500/20 text-blue-400' :
            'bg-purple-500/20 text-purple-400'
          "
        >
          {{ currentSentence?.level || 'A1' }}
        </div>

        <div class="w-full bg-surface border border-border rounded-2xl p-6 md:p-8 mb-6 text-center">
          <p class="text-xl md:text-2xl font-display font-bold text-text leading-relaxed mb-4">
            {{ currentSentence?.text }}
          </p>
          <p class="text-xs text-text-muted italic">
            💡 {{ currentSentence?.tip }}
          </p>
        </div>
      </template>

      <!-- MODE 2: Custom Text -->
      <div v-else-if="inputMode === 'custom'" class="w-full bg-surface border border-border rounded-2xl p-6 md:p-8 mb-6">
        <label class="text-xs font-bold text-text-subtle uppercase tracking-wider mb-2 block">
          Type or paste the text you want to practice
        </label>
        <textarea
          v-model="customText"
          placeholder="e.g. The quick brown fox jumps over the lazy dog..."
          class="w-full h-32 bg-bg border border-border rounded-xl p-4 text-text text-base resize-none outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/50 transition-all"
          maxlength="500"
        />
        <div class="flex justify-between items-center mt-2">
          <p class="text-[0.65rem] text-text-muted">
            {{ customText.length }}/500 characters
          </p>
          <button
            v-if="customText.trim()"
            type="button"
            class="text-[0.65rem] text-primary hover:underline cursor-pointer"
            @click="customText = ''"
          >
            Clear
          </button>
        </div>
      </div>

      <!-- MODE 3: Free Speech -->
      <div v-else class="w-full bg-surface border border-border rounded-2xl p-6 md:p-8 mb-6 text-center">
        <div class="w-16 h-16 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto mb-4">
          <MessageSquare :size="28" />
        </div>
        <p class="text-lg font-bold text-text mb-2">Free Speech Mode</p>
        <p class="text-sm text-text-muted">
          Just tap the microphone and speak naturally. Tati will transcribe and analyze your pronunciation.
        </p>
      </div>

      <!-- Action Controls Bar -->
      <div class="flex items-center gap-4 mb-6">
        <button
          v-if="inputMode === 'preset'"
          type="button"
          class="p-3 rounded-full bg-surface border border-border hover:bg-surface-hover transition-colors text-text cursor-pointer"
          title="Previous sentence"
          @click="prevSentence"
        >
          <ChevronLeft :size="20" />
        </button>

        <button
          type="button"
          class="p-4 rounded-full bg-surface border border-border hover:bg-surface-hover transition-colors text-primary"
          :class="(!activeReferenceText || isRecording || isEvaluating) ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'"
          :disabled="!activeReferenceText || isRecording || isEvaluating"
          title="Listen to Teacher Tati"
          @click="playReferenceVoice"
        >
          <Volume2 :size="24" />
        </button>

        <button
          type="button"
          class="p-5 rounded-full shadow-lg transition-all duration-300 cursor-pointer"
          :class="[
            isRecording
              ? 'bg-red-500 shadow-red-500/30 animate-pulse scale-110'
              : 'bg-primary shadow-primary/20 hover:scale-105 active:scale-95',
            isEvaluating ? 'opacity-50 cursor-not-allowed' : ''
          ]"
          :disabled="isEvaluating"
          :title="isRecording ? 'Stop recording' : 'Start speaking'"
          @click="isRecording ? stopRecording() : startRecording()"
        >
          <Square v-if="isRecording" :size="28" class="text-white fill-white" />
          <Mic v-else :size="28" class="text-white" />
        </button>

        <button
          type="button"
          class="p-3 rounded-full bg-surface border border-border hover:bg-surface-hover transition-colors text-text cursor-pointer"
          title="Reset"
          @click="result = null; recordingError = null;"
        >
          <RotateCcw :size="20" />
        </button>

        <button
          v-if="inputMode === 'preset'"
          type="button"
          class="p-3 rounded-full bg-surface border border-border hover:bg-surface-hover transition-colors text-text cursor-pointer"
          title="Next sentence"
          @click="nextSentence"
        >
          <ChevronRight :size="20" />
        </button>
      </div>

      <!-- Recording Waveform & Indicator -->
      <div v-if="isRecording" class="mb-4 flex flex-col items-center animate-fade-in">
        <div class="flex items-center gap-2 text-red-500 text-sm font-bold">
          <div class="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
          Recording — speak now...
        </div>
        <canvas ref="canvasRef" width="300" height="60" class="mt-2 rounded-lg" />
      </div>

      <!-- Recording Error Alert -->
      <div v-if="recordingError" class="mb-4 w-full animate-fade-in">
        <div class="bg-red-500/10 border border-red-500/30 rounded-xl p-3 text-sm text-red-500 text-center">
          {{ recordingError }}
        </div>
      </div>

      <!-- Evaluating Spinner -->
      <div v-if="isEvaluating" class="mb-4 flex items-center gap-2 text-primary text-sm font-semibold animate-fade-in">
        <Sparkles :size="16" class="animate-spin text-primary" />
        Analyzing your pronunciation...
      </div>

      <!-- Results Card Arena -->
      <div v-if="result" class="w-full animate-fade-in">
        <div class="bg-surface border border-border rounded-2xl p-6 space-y-4 shadow-sm">
          <!-- Overall Score -->
          <div class="text-center">
            <div class="text-5xl font-black" :class="getScoreColorClass(result.score)">
              {{ result.score }}%
            </div>
            <p class="text-xs text-text-subtle mt-1 font-medium">
              {{ result.score >= 85 ? 'Excelente articulação e clareza!' : result.score >= 60 ? 'Bom esforço! Ajuste os fonemas destacados.' : 'Vamos praticar novamente ouvindo a Teacher Tati.' }}
            </p>
          </div>

          <!-- Comparison Voice Players: Student vs Teacher Tati -->
          <div class="grid grid-cols-2 gap-3 pt-1">
            <button
              type="button"
              class="flex items-center justify-center gap-2 px-4 py-2.5 bg-primary/10 hover:bg-primary/20 disabled:opacity-40 disabled:cursor-not-allowed text-primary rounded-xl text-xs font-bold transition-all cursor-pointer"
              :disabled="!userAudioBlobUrl"
              @click="playUserAudio"
            >
              <Volume2 :size="16" />
              Listen to your own voice
            </button>
            <button
              type="button"
              class="flex items-center justify-center gap-2 px-4 py-2.5 bg-purple-500/10 hover:bg-purple-500/20 disabled:opacity-40 disabled:cursor-not-allowed text-purple-600 dark:text-purple-400 rounded-xl text-xs font-bold transition-all cursor-pointer"
              :disabled="!result.correct_audio"
              @click="playCorrectAudio"
            >
              <Volume2 :size="16" />
              Teacher Tati
            </button>
          </div>

          <!-- Suggested Sentence from Teacher Tati -->
          <div v-if="result.suggested_sentence" class="p-3.5 bg-blue-500/10 border border-blue-500/25 rounded-2xl flex flex-col gap-1.5 text-left">
            <div class="flex items-center justify-between">
              <span class="text-[0.68rem] font-bold text-blue-500 uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles :size="13" />
                Sugestão natural da Teacher Tati:
              </span>
              <button
                v-if="result.correct_audio"
                type="button"
                class="text-xs text-blue-500 hover:text-blue-600 font-semibold flex items-center gap-1 transition-colors cursor-pointer"
                @click="playCorrectAudio"
              >
                <Volume2 :size="13" />
                Ouvir frase
              </button>
            </div>
            <p class="text-xs md:text-sm font-semibold text-text leading-relaxed">
              &ldquo;{{ result.suggested_sentence }}&rdquo;
            </p>
          </div>

          <!-- Teacher Tati Pedagogical Tip Card in Portuguese -->
          <div v-if="result.pedagogical_tip" class="p-4 bg-primary/10 border border-primary/25 rounded-2xl flex flex-col gap-3 text-left">
            <div class="flex items-start gap-3">
              <div class="w-9 h-9 rounded-full overflow-hidden shrink-0 border border-primary/40 mt-0.5">
                <img src="/images/tati_logo.jpg" alt="Teacher Tati" class="w-full h-full object-cover" />
              </div>
              <div class="space-y-1">
                <p class="text-[0.7rem] font-bold text-primary uppercase tracking-wider">
                  Dica da Teacher Tati
                </p>
                <p class="text-xs md:text-sm text-foreground leading-relaxed">
                  {{ result.pedagogical_tip }}
                </p>
              </div>
            </div>

            <!-- Words to Practice List -->
            <div v-if="result.words && result.words.filter(w => w.tip || w.accuracy !== 'correct').length > 0" class="pt-3 border-t border-primary/20 space-y-2">
              <p class="text-[0.68rem] font-bold text-primary uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles :size="13" />
                Pontos para praticar:
              </p>
              <div class="space-y-1.5">
                <button
                  v-for="(w, idx) in result.words.filter(w => w.tip || w.accuracy !== 'correct')"
                  :key="idx"
                  type="button"
                  class="w-full text-left flex items-start gap-2.5 p-2 rounded-xl bg-surface/70 hover:bg-surface border border-border/70 hover:border-primary/50 transition-all text-xs group cursor-pointer"
                  @click="selectedWord = w"
                >
                  <span
                    class="font-bold shrink-0 px-2 py-0.5 rounded text-[0.7rem] font-mono"
                    :class="w.accuracy === 'needs_work' ? 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30' : 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/30'"
                  >
                    {{ w.word }}
                  </span>
                  <span class="text-text-muted group-hover:text-text leading-relaxed flex-1">
                    {{ w.tip || "Ajuste a pronúncia desta palavra." }}
                  </span>
                  <span class="text-[0.65rem] text-primary shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                    Ver detalhe →
                  </span>
                </button>
              </div>
            </div>
          </div>

          <!-- General Feedback -->
          <div v-if="result.feedback" class="bg-surface border border-border rounded-2xl p-4">
            <div class="flex items-start gap-3">
              <div class="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center flex-shrink-0 mt-0.5 text-primary">
                <Sparkles :size="16" />
              </div>
              <div>
                <p class="text-xs text-text-subtle font-semibold uppercase tracking-wider mb-0.5">General Feedback</p>
                <p class="text-sm text-text leading-relaxed italic">&ldquo;{{ result.feedback }}&rdquo;</p>
              </div>
            </div>
          </div>

          <!-- Word-by-Word Breakdown Badges -->
          <div v-if="result.words && result.words.length > 0">
            <div class="flex items-center justify-between mb-2">
              <h3 class="text-xs font-bold text-text-subtle uppercase tracking-wider">Word-by-Word</h3>
              <span class="text-[0.65rem] text-text-muted">Toque na palavra para ver a dica</span>
            </div>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="(w, i) in result.words"
                :key="i"
                type="button"
                class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border text-xs font-mono transition-all cursor-pointer hover:scale-105 active:scale-95 shadow-sm"
                :class="getWordBadgeClass(w.accuracy)"
                @click="selectedWord = w"
              >
                <span class="font-bold">{{ w.word }}</span>
                <span class="text-[0.65rem] opacity-75 font-sans">{{ Math.round(w.score) }}%</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Word Detail Modal -->
    <div
      v-if="selectedWord"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
      @click.self="selectedWord = null"
    >
      <div class="w-full max-w-sm rounded-3xl border border-border bg-surface p-6 shadow-2xl space-y-4">
        <div class="flex items-center justify-between border-b border-border pb-3">
          <div class="flex items-center gap-2">
            <h3 class="text-lg font-bold font-mono text-text">&ldquo;{{ selectedWord.word }}&rdquo;</h3>
            <span
              class="px-2 py-0.5 rounded text-[0.7rem] font-bold"
              :class="selectedWord.accuracy === 'correct' ? 'bg-emerald-500/10 text-emerald-600' : selectedWord.accuracy === 'needs_work' ? 'bg-amber-500/10 text-amber-600' : 'bg-rose-500/10 text-rose-600'"
            >
              {{ Math.round(selectedWord.score) }}%
            </span>
          </div>
          <button
            type="button"
            class="p-1 rounded-lg text-text-muted hover:text-text cursor-pointer"
            @click="selectedWord = null"
          >
            <X :size="18" />
          </button>
        </div>

        <p v-if="selectedWord.tip" class="text-sm text-text leading-relaxed">
          💡 {{ selectedWord.tip }}
        </p>
        <p v-else class="text-sm text-text-muted">
          Pronúncia correspondente aos padrões do sotaque {{ currentAccentObj.label }}.
        </p>

        <div class="pt-2 flex justify-end">
          <button
            type="button"
            class="inline-flex items-center gap-2 px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl hover:bg-primary-hover transition cursor-pointer"
            @click="playWordAudio(selectedWord.word)"
          >
            <Volume2 :size="14" />
            <span>{{ isPlayingWord === selectedWord.word ? 'Reproduzindo...' : 'Ouvir palavra' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Accent Selection Modal -->
    <div
      v-if="isAccentModalOpen"
      class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
      @click.self="isAccentModalOpen = false"
    >
      <div class="w-full max-w-sm rounded-3xl border border-border bg-surface p-5 shadow-2xl space-y-4">
        <div class="flex items-center justify-between border-b border-border pb-3">
          <div class="flex items-center gap-2">
            <Globe :size="18" class="text-primary" />
            <h3 class="text-base font-bold text-text">Sotaque da Teacher Tati</h3>
          </div>
          <button
            type="button"
            class="p-1 rounded-lg text-text-muted hover:text-text cursor-pointer"
            @click="isAccentModalOpen = false"
          >
            <X :size="18" />
          </button>
        </div>

        <p class="text-xs text-text-muted">
          Escolha qual variação da língua inglesa você gostaria de treinar na escuta e pronúncia:
        </p>

        <div class="grid grid-cols-1 gap-2 max-h-[300px] overflow-y-auto pr-1">
          <button
            v-for="acc in ACCENTS"
            :key="acc.id"
            type="button"
            class="flex items-center justify-between p-3 rounded-2xl border text-xs font-semibold transition cursor-pointer"
            :class="selectedAccent === acc.id ? 'border-primary bg-primary/10 text-primary' : 'border-border bg-surface hover:bg-bg-secondary text-text'"
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
