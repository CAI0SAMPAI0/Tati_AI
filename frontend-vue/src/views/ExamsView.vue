<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import { useRouter } from 'vue-router';
import {
  GraduationCap,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ChevronRight,
  ChevronLeft,
  Sparkles,
  BookOpen,
  TrendingUp,
  RotateCcw,
  Trophy,
  Flame,
  Award,
  Lightbulb,
  Check,
  BrainCircuit,
  BookmarkCheck,
  FileText,
  Headphones,
  Play,
  Pause,
  Mic,
  Square,
  Loader2,
} from 'lucide-vue-next';
import StudentLayout from '@/components/layout/StudentLayout.vue';
import { useAuthStore } from '@/stores/auth';
import { getStoredAccent } from '@/constants/accents';

interface ExamStatus {
  can_start: boolean;
  status: 'available' | 'locked' | 'in_progress' | 'ready' | 'forbidden' | string;
  days_remaining: number;
  next_available_date?: string | null;
  last_exam_date?: string | null;
  active_exam_id?: string | null;
  current_level: string;
  last_exam_evolution?: {
    score: number;
    level: string;
    total_questions: number;
    completed_at?: string;
    summary?: string;
    can_do_statements?: string[];
    skills_breakdown?: Record<string, { label: string; correct: number; total: number; percentage: number }>;
    points_to_improve?: string[];
  };
}

interface Question {
  id: string;
  type: string;
  question: string;
  points: number;
  options: string[];
  audio_url?: string | null;
  audio_text?: string | null;
  reading_text?: string | null;
}

interface ExamActive {
  exam_id: string;
  level: string;
  total_questions: number;
  started_at: string;
  questions: Question[];
}

interface CorrectionItem {
  question_id: string;
  question: string;
  type: string;
  student_answer: string;
  correct_answer: string;
  is_correct: boolean;
  points_earned: number;
  explanation: string;
}

interface ExamResult {
  exam_id: string;
  score: number;
  passed: boolean;
  recommended_level?: string | null;
  xp_earned: number;
  next_exam_date: string;
  summary_feedback: string;
  can_do_statements?: string[];
  points_to_improve?: string[];
  skills_breakdown?: Record<string, { label: string; correct: number; total: number; percentage: number }>;
  corrections: CorrectionItem[];
}

interface HistoryItem {
  id: string;
  level: string;
  score: number;
  passed: boolean;
  completed_at: string;
  total_questions: number;
  feedback?: string;
  can_do_statements?: string[];
  skills_breakdown?: Record<string, { label: string; correct: number; total: number; percentage: number }>;
  points_to_improve?: string[];
}

const router = useRouter();
const authStore = useAuthStore();

// Restrict to programador only
if (authStore.user?.username !== 'programador') {
  router.replace('/activities');
}

const view = ref<'dashboard' | 'taking' | 'result'>('dashboard');
const status = ref<ExamStatus | null>(null);
const history = ref<HistoryItem[]>([]);
const loadingStatus = ref(true);

const activeExam = ref<ExamActive | null>(null);
const currentQuestionIndex = ref(0);
const answers = ref<Record<string, string>>({});
const recordedAudioB64 = ref<Record<string, string>>({});
const isSubmitting = ref(false);
const isStarting = ref(false);

const examResult = ref<ExamResult | null>(null);

const isPlayingAudio = ref(false);
const audioListenCount = ref<Record<string, number>>({});
const showTranscript = ref(false);
const isRecording = ref(false);
const recordingSeconds = ref(0);
const recordedAudios = ref<Record<string, string>>({});

let mediaRecorder: MediaRecorder | null = null;
let audioChunks: Blob[] = [];
let recordingTimer: any = null;
let audioElement: HTMLAudioElement | null = null;

const currentQuestion = computed(() => {
  if (!activeExam.value || !activeExam.value.questions.length) return null;
  return activeExam.value.questions[currentQuestionIndex.value] || null;
});

const progressPercentage = computed(() => {
  if (!status.value) return 0;
  const days = Math.max(0, 90 - (status.value.days_remaining || 0));
  return Math.min(100, Math.round((days / 90) * 100));
});

async function fetchStatusAndHistory() {
  if (!authStore.token) return;
  loadingStatus.value = true;
  try {
    const headers = { Authorization: `Bearer ${authStore.token}` };
    const [resStatus, resHistory] = await Promise.all([
      fetch('/exams/trimestral/status', { headers }),
      fetch('/exams/trimestral/history', { headers }),
    ]);

    if (resStatus.ok) {
      status.value = await resStatus.json();
    }
    if (resHistory.ok) {
      history.value = await resHistory.json();
    }
  } catch (err) {
    console.error('Failed to load exam data:', err);
  } finally {
    loadingStatus.value = false;
  }
}

async function handleStartExam(force: boolean = false) {
  if (!authStore.token) return;
  isStarting.value = true;
  try {
    const res = await fetch('/exams/trimestral/start', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify({ num_questions: 10, force }),
    });

    if (res.ok) {
      const data: ExamActive = await res.json();
      activeExam.value = data;
      currentQuestionIndex.value = 0;
      answers.value = {};
      recordedAudioB64.value = {};
      view.value = 'taking';
    } else {
      const err = await res.json().catch(() => ({}));
      alert(err.detail || 'Não foi possível iniciar o exame trimestral.');
    }
  } catch (err) {
    console.error('Error starting exam:', err);
  } finally {
    isStarting.value = false;
  }
}

async function handleResumeActiveExam() {
  if (!authStore.token) return;
  isStarting.value = true;
  try {
    const res = await fetch('/exams/trimestral/current', {
      headers: { Authorization: `Bearer ${authStore.token}` },
    });
    if (res.ok) {
      const data: ExamActive = await res.json();
      if (data && data.exam_id) {
        activeExam.value = data;
        currentQuestionIndex.value = 0;
        view.value = 'taking';
        return;
      }
    }
    await handleStartExam(false);
  } catch {
    await handleStartExam(false);
  } finally {
    isStarting.value = false;
  }
}

async function handlePlayAudio(text: string, qId: string) {
  if (isPlayingAudio.value) {
    if (audioElement) audioElement.pause();
    isPlayingAudio.value = false;
    return;
  }

  const clean = text.replace(/^(Station Announcer|Speaker\s*\w*|Woman|Man|Announcer|Flight Attendant|Receptionist):\s*/gim, '').trim();
  const phrase = clean || text;
  const accent = getStoredAccent();

  try {
    isPlayingAudio.value = true;
    const res = await fetch('/chat/tts', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify({ text: phrase, accent }),
    });

    if (res.ok) {
      const data = await res.json();
      const b64 = data.audio || data.audio_b64;
      if (b64) {
        if (audioElement) audioElement.pause();
        audioElement = new Audio(`data:audio/mp3;base64,${b64}`);
        audioElement.onended = () => {
          isPlayingAudio.value = false;
          audioListenCount.value[qId] = (audioListenCount.value[qId] || 0) + 1;
        };
        audioElement.onerror = () => {
          isPlayingAudio.value = false;
        };
        await audioElement.play();
        return;
      }
    }
    isPlayingAudio.value = false;
  } catch {
    isPlayingAudio.value = false;
  }
}

async function startRecording(qId: string) {
  try {
    if (!navigator.mediaDevices?.getUserMedia) {
      alert('Gravação de microfone não suportada neste navegador.');
      return;
    }
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    mediaRecorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.push(e.data);
    };

    mediaRecorder.onstop = () => {
      const audioBlob = new Blob(audioChunks, { type: 'audio/webm' });
      const url = URL.createObjectURL(audioBlob);
      recordedAudios.value[qId] = url;

      const reader = new FileReader();
      reader.onloadend = () => {
        const b64 = reader.result as string;
        recordedAudioB64.value[qId] = b64;
        answers.value[qId] = '[Audio recorded]';
      };
      reader.readAsDataURL(audioBlob);
      stream.getTracks().forEach((t) => t.stop());
    };

    mediaRecorder.start();
    isRecording.value = true;
    recordingSeconds.value = 0;

    recordingTimer = setInterval(() => {
      recordingSeconds.value += 1;
      if (recordingSeconds.value >= 45) {
        stopRecording();
      }
    }, 1000);
  } catch (err) {
    console.error('Mic access error:', err);
    alert('Permissão de microfone negada ou indisponível.');
  }
}

function stopRecording() {
  if (recordingTimer) clearInterval(recordingTimer);
  if (mediaRecorder && mediaRecorder.state !== 'inactive') {
    mediaRecorder.stop();
  }
  isRecording.value = false;
}

async function handleSubmitExam() {
  if (!activeExam.value) return;

  const answeredCount = activeExam.value.questions.filter(
    (q) => Boolean(answers.value[q.id]) || Boolean(recordedAudioB64.value[q.id])
  ).length;
  const totalCount = activeExam.value.questions.length;

  if (answeredCount < totalCount) {
    const ok = confirm(`Você respondeu ${answeredCount} de ${totalCount} questões. Deseja enviar assim mesmo?`);
    if (!ok) return;
  }

  isSubmitting.value = true;
  try {
    const payload = activeExam.value.questions.map((q) => ({
      question_id: q.id,
      answer: answers.value[q.id] || (recordedAudioB64.value[q.id] ? '[Audio Recorded]' : ''),
      audio_data: recordedAudioB64.value[q.id] || undefined,
    }));

    const res = await fetch('/exams/trimestral/submit', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${authStore.token}`,
      },
      body: JSON.stringify({
        exam_id: activeExam.value.exam_id,
        answers: payload,
      }),
    });

    if (res.ok) {
      const data: ExamResult = await res.json();
      examResult.value = data;
      view.value = 'result';
      await fetchStatusAndHistory();
    } else {
      alert('Erro ao enviar respostas do exame.');
    }
  } catch (err) {
    console.error('Submit error:', err);
  } finally {
    isSubmitting.value = false;
  }
}

async function handleResetCycleDev() {
  if (!confirm('Deseja resetar o ciclo trimestral (Dev)?')) return;
  try {
    await fetch('/exams/trimestral/reset', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authStore.token}` },
    });
    await fetchStatusAndHistory();
  } catch (err) {
    console.error('Reset error:', err);
  }
}

watch(currentQuestionIndex, () => {
  if (audioElement) audioElement.pause();
  isPlayingAudio.value = false;
  showTranscript.value = false;
  if (isRecording.value) stopRecording();
});

onMounted(() => {
  if (authStore.user?.username === 'programador') {
    fetchStatusAndHistory();
  }
});

onUnmounted(() => {
  if (audioElement) audioElement.pause();
  if (recordingTimer) clearInterval(recordingTimer);
});
</script>

<template>
  <StudentLayout>
    <!-- VIEW 1: DASHBOARD -->
    <div v-if="view === 'dashboard'" class="space-y-8 animate-fade-in">
      <!-- Header -->
      <header class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div class="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-widest mb-1">
            <GraduationCap :size="16" />
            <span>Periodic Assessment • Every 3 Months</span>
          </div>
          <h1 class="text-2xl md:text-3xl font-display font-bold text-ink">
            Quarterly CEFR Exam
          </h1>
          <p class="text-muted text-sm mt-1 max-w-2xl">
            Track your actual proficiency in Reading, Grammar, Vocabulary, Listening, and Speaking every 3 months.
          </p>
        </div>

        <!-- Dev Controls -->
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="px-3 py-1.5 rounded-xl border border-line text-xs font-bold text-muted hover:text-ink hover:bg-bgSecondary transition cursor-pointer"
            @click="handleResetCycleDev"
          >
            Reset (Dev)
          </button>
          <button
            type="button"
            class="px-3.5 py-1.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primaryHover transition cursor-pointer shadow-xs"
            @click="handleStartExam(true)"
          >
            Start Now (Bypass Dev)
          </button>
        </div>
      </header>

      <!-- Status Card Banner -->
      <div class="bg-surface border border-line rounded-3xl p-6 md:p-8 shadow-xs">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-6 items-center">
          <!-- Col 1: Current Level -->
          <div class="space-y-1">
            <span class="text-xs font-bold text-muted uppercase tracking-wider">Current Level</span>
            <div class="text-4xl font-display font-black text-primary">
              {{ status?.current_level || 'B1' }}
            </div>
            <p class="text-xs text-muted">Council of Europe CEFR Standard</p>
          </div>

          <!-- Col 2: Cycle Progress -->
          <div class="space-y-2">
            <div class="flex items-center justify-between text-xs font-bold">
              <span class="text-ink">Quarterly Cycle</span>
              <span class="text-primary">{{ 90 - (status?.days_remaining || 0) }}/90 days</span>
            </div>
            <div class="h-3 bg-bgSecondary rounded-full overflow-hidden">
              <div
                class="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500 rounded-full"
                :style="{ width: `${progressPercentage}%` }"
              />
            </div>
            <p class="text-[0.7rem] text-muted">
              {{ status?.days_remaining ? `Next exam unlocked in ${status.days_remaining} days` : 'Exam is ready to take!' }}
            </p>
          </div>

          <!-- Col 3: Action Button -->
          <div class="flex flex-col items-start md:items-end gap-2">
            <button
              v-if="status?.status === 'in_progress' || status?.status === 'ready'"
              type="button"
              class="w-full md:w-auto px-6 py-3 rounded-2xl bg-primary text-white font-bold text-sm hover:bg-primaryHover transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
              @click="handleResumeActiveExam"
            >
              <span>Resume Active Exam</span>
              <ArrowRight :size="16" />
            </button>
            <button
              v-else-if="status?.can_start"
              type="button"
              class="w-full md:w-auto px-6 py-3 rounded-2xl bg-emerald-600 text-white font-bold text-sm hover:bg-emerald-700 transition shadow-md flex items-center justify-center gap-2 cursor-pointer"
              @click="handleStartExam(false)"
            >
              <span>Start Quarterly Exam</span>
              <ArrowRight :size="16" />
            </button>
            <button
              v-else
              type="button"
              class="w-full md:w-auto px-6 py-3 rounded-2xl bg-bgSecondary border border-line text-muted font-bold text-sm cursor-not-allowed flex items-center justify-center gap-2"
              disabled
            >
              <Clock :size="16" />
              <span>Locked ({{ status?.days_remaining || 0 }}d remaining)</span>
            </button>
          </div>
        </div>
      </div>

      <!-- What You Have Mastered -->
      <section class="space-y-4">
        <div>
          <h2 class="text-lg font-bold text-ink flex items-center gap-2">
            <BookmarkCheck :size="20" class="text-primary" />
            <span>What You Have Mastered</span>
          </h2>
          <p class="text-xs text-muted">Communicative competencies proven in your assessments</p>
        </div>

        <div v-if="status?.last_exam_evolution?.can_do_statements?.length" class="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div
            v-for="(stmt, i) in status.last_exam_evolution.can_do_statements"
            :key="i"
            class="p-4 rounded-2xl bg-surface border border-line flex items-start gap-3 shadow-xs"
          >
            <CheckCircle2 :size="18" class="text-emerald-500 shrink-0 mt-0.5" />
            <span class="text-xs text-ink leading-relaxed">{{ stmt }}</span>
          </div>
        </div>
        <div v-else class="p-8 text-center bg-surface border border-dashed border-line rounded-3xl text-muted space-y-1">
          <p class="text-sm font-semibold text-ink">No quarterly assessments recorded yet.</p>
          <p class="text-xs">As soon as you complete your first quarterly exam, this panel will display everything you can do in English!</p>
        </div>
      </section>

      <!-- Exam History -->
      <section class="space-y-4">
        <div>
          <h2 class="text-lg font-bold text-ink flex items-center gap-2">
            <Clock :size="20" class="text-primary" />
            <span>Quarterly Exam History</span>
          </h2>
          <p class="text-xs text-muted">Your evolution timeline every 3 months</p>
        </div>

        <div v-if="history.length > 0" class="space-y-3">
          <div
            v-for="item in history"
            :key="item.id"
            class="p-5 rounded-2xl bg-surface border border-line flex items-center justify-between gap-4 shadow-xs"
          >
            <div class="flex items-center gap-4">
              <div class="w-12 h-12 rounded-2xl bg-primary/10 text-primary font-display font-black text-lg flex items-center justify-center">
                {{ item.level }}
              </div>
              <div>
                <div class="flex items-center gap-2">
                  <span class="font-bold text-sm text-ink">{{ item.score }}% Score</span>
                  <span
                    class="text-[0.65rem] font-bold px-2 py-0.5 rounded-full uppercase"
                    :class="item.passed ? 'bg-emerald-500/15 text-emerald-600' : 'bg-rose-500/15 text-rose-600'"
                  >
                    {{ item.passed ? 'Passed' : 'Needs Practice' }}
                  </span>
                </div>
                <p class="text-xs text-muted mt-0.5">{{ new Date(item.completed_at).toLocaleDateString() }}</p>
              </div>
            </div>
          </div>
        </div>
        <div v-else class="p-8 text-center bg-surface border border-dashed border-line rounded-3xl text-muted text-xs">
          0 exams completed. No past history yet.
        </div>
      </section>
    </div>

    <!-- VIEW 2: TAKING EXAM -->
    <div v-else-if="view === 'taking' && activeExam" class="max-w-3xl mx-auto space-y-6 animate-fade-in">
      <!-- Exam Header / Progress -->
      <div class="flex items-center justify-between pb-4 border-b border-line">
        <div>
          <div class="text-xs font-bold text-primary uppercase tracking-wider">
            Quarterly CEFR Exam • Level {{ activeExam.level }}
          </div>
          <h2 class="text-lg font-bold text-ink">
            Question {{ currentQuestionIndex + 1 }} of {{ activeExam.questions.length }}
          </h2>
        </div>
        <button
          type="button"
          class="text-xs text-muted hover:text-ink font-semibold"
          @click="view = 'dashboard'"
        >
          Exit Exam
        </button>
      </div>

      <!-- Current Question Card -->
      <div v-if="currentQuestion" class="bg-surface border border-line rounded-3xl p-6 md:p-8 space-y-6 shadow-xs">
        <!-- Reading Passage (if present) -->
        <div v-if="currentQuestion.reading_text" class="p-5 rounded-2xl bg-bgSecondary/60 border border-line/60 space-y-2">
          <div class="flex items-center gap-2 text-xs font-bold text-primary uppercase">
            <FileText :size="14" />
            <span>Reading Passage</span>
          </div>
          <p class="text-xs sm:text-sm text-ink leading-relaxed whitespace-pre-wrap">
            {{ currentQuestion.reading_text }}
          </p>
        </div>

        <!-- Listening Audio Player (if present) -->
        <div v-if="currentQuestion.audio_text || currentQuestion.type === 'listening'" class="p-5 rounded-2xl bg-primary/5 border border-primary/20 space-y-3">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 text-xs font-bold text-primary uppercase">
              <Headphones :size="14" />
              <span>Listening Audio</span>
            </div>
            <span class="text-[0.7rem] text-muted font-mono">
              Listened: {{ audioListenCount[currentQuestion.id] || 0 }}x
            </span>
          </div>

          <button
            type="button"
            class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white font-bold text-xs hover:bg-primaryHover transition cursor-pointer shadow-xs"
            @click="handlePlayAudio(currentQuestion.audio_text || currentQuestion.question, currentQuestion.id)"
          >
            <component :is="isPlayingAudio ? Pause : Play" :size="16" />
            <span>{{ isPlayingAudio ? 'Pausar Áudio' : 'Ouvir Diálogo (Teacher Tati)' }}</span>
          </button>
        </div>

        <!-- Speaking Voice Recorder (if present) -->
        <div v-if="currentQuestion.type === 'speaking'" class="p-5 rounded-2xl bg-amber-500/10 border border-amber-500/20 space-y-3">
          <div class="flex items-center gap-2 text-xs font-bold text-amber-600 uppercase">
            <Mic :size="14" />
            <span>Speaking Task (Grave sua resposta em inglês)</span>
          </div>

          <div class="flex items-center gap-3">
            <button
              v-if="!isRecording"
              type="button"
              class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-amber-500 text-white font-bold text-xs hover:bg-amber-600 transition cursor-pointer shadow-xs"
              @click="startRecording(currentQuestion.id)"
            >
              <Mic :size="16" />
              <span>Gravar Resposta</span>
            </button>
            <button
              v-else
              type="button"
              class="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-rose-600 text-white font-bold text-xs hover:bg-rose-700 transition cursor-pointer shadow-xs animate-pulse"
              @click="stopRecording"
            >
              <Square :size="16" />
              <span>Parar Gravação ({{ recordingSeconds }}s)</span>
            </button>

            <span v-if="recordedAudios[currentQuestion.id]" class="text-xs text-emerald-600 font-bold flex items-center gap-1">
              <CheckCircle2 :size="14" /> Áudio Gravado
            </span>
          </div>
        </div>

        <!-- Question Prompt -->
        <div class="space-y-2">
          <span class="text-[0.7rem] font-bold text-muted uppercase tracking-wider">
            {{ currentQuestion.type }} • {{ currentQuestion.points }} pts
          </span>
          <h3 class="text-base sm:text-lg font-bold text-ink leading-snug">
            {{ currentQuestion.question }}
          </h3>
        </div>

        <!-- Options (if multiple choice) -->
        <div v-if="currentQuestion.options && currentQuestion.options.length" class="space-y-2.5">
          <button
            v-for="(opt, idx) in currentQuestion.options"
            :key="idx"
            type="button"
            class="w-full text-left p-4 rounded-2xl border text-xs sm:text-sm font-semibold transition cursor-pointer flex items-center justify-between"
            :class="
              answers[currentQuestion.id] === opt
                ? 'bg-primary/10 border-primary text-primary font-bold shadow-xs'
                : 'bg-surface border-line text-ink hover:border-primary/40'
            "
            @click="answers[currentQuestion.id] = opt"
          >
            <span>{{ opt }}</span>
            <div
              class="w-5 h-5 rounded-full border flex items-center justify-center shrink-0"
              :class="answers[currentQuestion.id] === opt ? 'border-primary bg-primary text-white' : 'border-line'"
            >
              <Check v-if="answers[currentQuestion.id] === opt" :size="12" />
            </div>
          </button>
        </div>
      </div>

      <!-- Navigation Footer -->
      <div class="flex items-center justify-between pt-2">
        <button
          type="button"
          :disabled="currentQuestionIndex === 0"
          class="px-4 py-2.5 rounded-xl border border-line text-xs font-bold text-ink hover:bg-bgSecondary transition disabled:opacity-30 disabled:cursor-not-allowed flex items-center gap-1.5 cursor-pointer"
          @click="currentQuestionIndex -= 1"
        >
          <ChevronLeft :size="16" />
          <span>Previous</span>
        </button>

        <button
          v-if="currentQuestionIndex < activeExam.questions.length - 1"
          type="button"
          class="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primaryHover transition flex items-center gap-1.5 cursor-pointer shadow-xs"
          @click="currentQuestionIndex += 1"
        >
          <span>Next</span>
          <ChevronRight :size="16" />
        </button>

        <button
          v-else
          type="button"
          :disabled="isSubmitting"
          class="px-6 py-2.5 rounded-xl bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 transition flex items-center gap-2 cursor-pointer shadow-md"
          @click="handleSubmitExam"
        >
          <Loader2 v-if="isSubmitting" :size="16" class="animate-spin" />
          <span>{{ isSubmitting ? 'Evaluating...' : 'Submit Exam' }}</span>
        </button>
      </div>
    </div>

    <!-- VIEW 3: RESULT -->
    <div v-else-if="view === 'result' && examResult" class="max-w-3xl mx-auto space-y-8 animate-fade-in">
      <!-- Result Banner -->
      <div class="p-8 rounded-3xl bg-surface border border-line text-center space-y-4 shadow-sm">
        <div class="w-20 h-20 rounded-full mx-auto flex items-center justify-center text-3xl font-display font-black shadow-lg"
          :class="examResult.passed ? 'bg-emerald-500 text-white shadow-emerald-500/20' : 'bg-amber-500 text-white shadow-amber-500/20'"
        >
          {{ examResult.score }}%
        </div>

        <div class="space-y-1">
          <h2 class="text-2xl font-display font-bold text-ink">
            {{ examResult.passed ? 'Quarterly Assessment Passed! 🎉' : 'Assessment Completed!' }}
          </h2>
          <p class="text-sm text-muted max-w-md mx-auto leading-relaxed">
            {{ examResult.summary_feedback }}
          </p>
        </div>

        <div class="flex items-center justify-center gap-3 pt-2">
          <span class="px-3 py-1 rounded-full text-xs font-bold bg-primary/10 text-primary">
            +{{ examResult.xp_earned }} XP Earned
          </span>
          <span v-if="examResult.recommended_level" class="px-3 py-1 rounded-full text-xs font-bold bg-accent/15 text-accent">
            Level: {{ examResult.recommended_level }}
          </span>
        </div>
      </div>

      <!-- Corrections Review -->
      <div class="space-y-4">
        <h3 class="text-lg font-bold text-ink">Question Review</h3>
        <div class="space-y-3">
          <div
            v-for="c in examResult.corrections"
            :key="c.question_id"
            class="p-5 rounded-2xl bg-surface border border-line space-y-2 shadow-xs"
          >
            <div class="flex items-center justify-between gap-2">
              <span class="text-xs font-bold text-ink line-clamp-1">{{ c.question }}</span>
              <span
                class="text-[0.65rem] font-bold px-2 py-0.5 rounded-full uppercase"
                :class="c.is_correct ? 'bg-emerald-500/15 text-emerald-600' : 'bg-rose-500/15 text-rose-600'"
              >
                {{ c.is_correct ? 'Correct' : 'Incorrect' }}
              </span>
            </div>
            <p v-if="!c.is_correct" class="text-xs text-muted">
              Correct Answer: <strong class="text-emerald-600">{{ c.correct_answer }}</strong>
            </p>
            <p v-if="c.explanation" class="text-xs text-muted italic">
              💡 {{ c.explanation }}
            </p>
          </div>
        </div>
      </div>

      <!-- Back to Dashboard -->
      <div class="text-center pt-4">
        <button
          type="button"
          class="px-6 py-3 rounded-2xl bg-primary text-white font-bold text-sm hover:bg-primaryHover transition cursor-pointer shadow-xs"
          @click="view = 'dashboard'"
        >
          Return to Assessments Dashboard
        </button>
      </div>
    </div>
  </StudentLayout>
</template>
