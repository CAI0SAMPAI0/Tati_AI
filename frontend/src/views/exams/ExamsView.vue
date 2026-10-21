<script setup lang="ts">
import { ref, onMounted, computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  GraduationCap,
  Clock,
  Calendar,
  CheckCircle2,
  XCircle,
  ArrowRight,
  ChevronLeft,
  Sparkles,
  BookOpen,
  TrendingUp,
  RotateCcw,
  Trophy,
  Flame,
  Check,
  FileText,
  Headphones,
  Play,
  Pause,
  Mic,
  Square,
  AlertTriangle,
} from 'lucide-vue-next';
import { useAuth } from '@/composables/useAuth';
import { useToast } from '@/composables/useToast';
import { useAudioRecorder } from '@/composables/useAudioRecorder';
import { useTTS } from '@/composables/useTTS';
import { apiGet } from '@/api/client';
import {
  getExamStatus,
  startExam,
  getCurrentExam,
  submitExam,
  getExamHistory,
  resetExam,
  getTtsAudio,
} from '@/api/exams';
import type { ExamStatus, ExamActive, Question, ExamHistoryItem } from '@/api/types';
import DialogModal from '@/components/ui/DialogModal.vue';
import Button from '@/components/ui/Button.vue';

const router = useRouter();
const { user, userLevel, accent } = useAuth();
const toast = useToast();
const { isRecording, recordingDuration, startRecording, stopRecording } = useAudioRecorder();
const { isPlaying, speak, playBase64, stop: stopAudio } = useTTS();

const statusData = ref<ExamStatus | null>(null);
const activeExam = ref<ExamActive | null>(null);
const history = ref<ExamHistoryItem[]>([]);
const answers = ref<Record<string, any>>({});
const activeSpeakingQuestionId = ref<string | null>(null);
const playingListeningQuestionId = ref<string | null>(null);
const isExamFinished = ref(false);
const examResult = ref<any | null>(null);
const isStarting = ref(false);
const isSubmitting = ref(false);
const showConfirmModal = ref(false);
const showResetModal = ref(false);

const selectedReviewExam = ref<any | null>(null);
const isReviewing = ref(false);

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const currentCefrIndex = computed(() => {
  const lvl = (statusData.value?.current_level || userLevel.value || 'A1').toUpperCase();
  const idx = CEFR_LEVELS.indexOf(lvl);
  return idx !== -1 ? idx : 0;
});

function getWordCount(text: string): number {
  if (!text) return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
}

async function handleReviewPastExam(hItem: any) {
  try {
    let corrections = hItem.corrections;
    let summaryFeedback = hItem.summary_feedback || hItem.feedback || '';
    let canDo = hItem.can_do_statements || [];
    let skills = hItem.skills_breakdown || {};
    let pointsToImprove = hItem.points_to_improve || [];

    if (!corrections || corrections.length === 0) {
      try {
        const detail = await apiGet<any>(`/exams/trimestral/${hItem.id}`);
        if (detail) {
          corrections = detail.corrections || [];
          summaryFeedback = detail.summary_feedback || detail.feedback || summaryFeedback;
          canDo = detail.can_do_statements || canDo;
          skills = detail.skills_breakdown || skills;
          pointsToImprove = detail.points_to_improve || pointsToImprove;
        }
      } catch (_) {}
    }

    selectedReviewExam.value = {
      ...hItem,
      corrections,
      summary_feedback: summaryFeedback,
      can_do_statements: canDo,
      skills_breakdown: skills,
      points_to_improve: pointsToImprove,
    };
    isReviewing.value = true;
  } catch (err) {
    console.error('Error reviewing past exam:', err);
  }
}

const answeredCount = computed(() => {
  if (!activeExam.value?.questions) return 0;
  return activeExam.value.questions.filter((q) => {
    const val = answers.value[q.id];
    return val !== undefined && val !== null && String(val).trim() !== '';
  }).length;
});

const progressPercentage = computed(() => {
  if (!activeExam.value?.questions || activeExam.value.questions.length === 0) return 0;
  return Math.round((answeredCount.value / activeExam.value.questions.length) * 100);
});

async function loadStatus() {
  try {
    const data = await getExamStatus();
    statusData.value = data;

    if (data.status === 'in_progress' && data.active_exam_id) {
      loadActiveExam();
    }
  } catch (err) {
    console.error('Error fetching exam status:', err);
  }

  try {
    const hist = await getExamHistory();
    history.value = hist || [];
  } catch {}
}

async function loadActiveExam() {
  try {
    const exam = await getCurrentExam();
    if (exam && exam.questions && exam.questions.length > 0) {
      activeExam.value = exam;
    }
  } catch {
    toast.error('Erro ao carregar exame em andamento.');
  }
}

async function handleStartExam() {
  isStarting.value = true;
  try {
    const exam = await startExam();
    activeExam.value = exam;
    answers.value = {};
    toast.success('Exame iniciado com sucesso! Boa sorte!');
  } catch (err: any) {
    toast.error(err?.message || 'Não foi possível iniciar o exame trimestral.');
  } finally {
    isStarting.value = false;
  }
}

function handleSelectAnswer(questionId: string, answer: string) {
  answers.value[questionId] = answer;
}

async function handlePlayListening(question: Question) {
  if (playingListeningQuestionId.value === question.id && isPlaying.value) {
    stopAudio();
    playingListeningQuestionId.value = null;
    return;
  }

  playingListeningQuestionId.value = question.id;
  const audioText = question.audio_text || question.question;

  try {
    const res = await getTtsAudio(audioText, accent.value);
    if (res?.audio_b64) {
      await playBase64(res.audio_b64);
    } else {
      await speak(audioText, accent.value);
    }
  } catch {
    toast.error('Erro ao reproduzir áudio do listening.');
  } finally {
    playingListeningQuestionId.value = null;
  }
}

async function handleRecordSpeaking(question: Question) {
  if (isRecording.value && activeSpeakingQuestionId.value === question.id) {
    try {
      const { base64, duration } = await stopRecording();
      const minSec = question.min_seconds || 15;
      if (duration < minSec) {
        toast.error(`Áudio de ${duration}s muito curto. Mínimo exigido: ${minSec}s.`);
        activeSpeakingQuestionId.value = null;
        return;
      }
      answers.value[question.id] = base64;
      toast.success('Gravação concluída e salva com sucesso!');
    } catch {
      toast.error('Erro ao salvar gravação de voz.');
    } finally {
      activeSpeakingQuestionId.value = null;
    }
  } else {
    activeSpeakingQuestionId.value = question.id;
    try {
      await startRecording();
    } catch {
      toast.error('Permissão de microfone negada ou erro ao iniciar gravador.');
      activeSpeakingQuestionId.value = null;
    }
  }
}

function scrollToQuestion(index: number) {
  const el = document.getElementById(`question-card-${index}`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

async function confirmSubmit() {
  showConfirmModal.value = false;
  if (!activeExam.value) return;

  isSubmitting.value = true;
  try {
    const payloadAnswers = activeExam.value.questions.map((q) => ({
      question_id: q.id,
      answer: typeof answers.value[q.id] === 'string' ? answers.value[q.id] : '',
      audio_data: typeof answers.value[q.id] === 'string' && answers.value[q.id].startsWith('data:audio') ? answers.value[q.id] : undefined,
    }));
    const result = await submitExam({
      exam_id: activeExam.value.exam_id,
      answers: payloadAnswers,
    });
    examResult.value = result;
    isExamFinished.value = true;
    activeExam.value = null;
    toast.success('Exame enviado e corrigido com sucesso!');
    loadStatus();
  } catch (err: any) {
    toast.error(err?.message || 'Erro ao enviar exame para correção.');
  } finally {
    isSubmitting.value = false;
  }
}

async function handleResetExam() {
  showResetModal.value = false;
  try {
    await resetExam();
    activeExam.value = null;
    isExamFinished.value = false;
    examResult.value = null;
    toast.success('Exame resetado com sucesso.');
    loadStatus();
  } catch {
    toast.error('Erro ao resetar exame.');
  }
}

onMounted(() => {
  loadStatus();
});
</script>

<template>
  <div class="flex-1 flex flex-col bg-bg text-text min-h-screen">
    <!-- Top Sticky Bar during active exam -->
    <div
      v-if="activeExam"
      class="sticky top-16 z-30 bg-surface/95 backdrop-blur-md border-b border-border py-3 px-4 sm:px-6 shadow-sm"
    >
      <div class="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
        <div class="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
          <span class="text-xs font-bold px-2.5 py-1 rounded-lg bg-primary text-white">
            Level {{ activeExam.level }}
          </span>
          <span class="text-xs font-semibold text-text-muted">
            Progress: <strong class="text-text">{{ answeredCount }}</strong> / {{ activeExam.questions.length }}
          </span>
        </div>

        <!-- Shortcuts Pill Buttons -->
        <div class="flex items-center gap-1.5 overflow-x-auto max-w-full py-1 custom-scrollbar">
          <button
            v-for="(q, idx) in activeExam.questions"
            :key="q.id"
            type="button"
            @click="scrollToQuestion(idx)"
            class="w-7 h-7 rounded-lg text-xs font-bold transition-all flex items-center justify-center flex-shrink-0"
            :class="
              answers[q.id]
                ? 'bg-success text-white'
                : 'bg-input text-text-muted hover:border-primary border border-border'
            "
          >
            {{ idx + 1 }}
          </button>
        </div>

        <button
          type="button"
          @click="showConfirmModal = true"
          :disabled="isSubmitting"
          class="w-full sm:w-auto px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow-glow hover:bg-primary-hover transition-all disabled:opacity-50"
        >
          {{ isSubmitting ? 'Submitting...' : 'Submit Exam' }}
        </button>
      </div>

      <!-- Linear Progress Line -->
      <div class="w-full bg-border/40 h-1.5 rounded-full mt-2.5 overflow-hidden">
        <div
          class="bg-primary h-full transition-all duration-300"
          :style="{ width: `${progressPercentage}%` }"
        ></div>
      </div>
    </div>

    <!-- Container Content -->
    <div class="flex-1 max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8">
      
      <!-- Exam Status Header (when not taking exam and not viewing finished result) -->
      <div v-if="!activeExam && !isExamFinished && !isReviewing" class="space-y-6 animate-fade-in">
        <!-- CEFR Journey Roadmap -->
        <div class="bg-surface border border-border rounded-2xl p-6 shadow-sm space-y-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <TrendingUp class="w-4 h-4 text-primary" />
              <span class="text-xs font-bold uppercase tracking-widest text-text">Sua Jornada CEFR</span>
            </div>
            <span class="text-xs font-bold text-primary">Nível Atual: {{ statusData?.current_level || userLevel || 'A1' }}</span>
          </div>
          <div class="grid grid-cols-6 gap-2">
            <div v-for="(lvl, idx) in CEFR_LEVELS" :key="lvl" class="space-y-1.5">
              <div class="h-2 rounded-full bg-bg-secondary overflow-hidden">
                <div
                  class="h-full rounded-full bg-primary transition-all duration-500"
                  :style="{
                    width: idx < currentCefrIndex ? '100%' : idx === currentCefrIndex ? `${statusData?.last_exam_evolution?.score || 60}%` : '0%'
                  }"
                />
              </div>
              <span
                class="block text-center text-xs font-bold"
                :class="idx === currentCefrIndex ? 'text-primary' : 'text-text-muted'"
              >
                {{ lvl }}
              </span>
            </div>
          </div>
        </div>

        <div class="bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-sm">
          <div class="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-border">
            <div class="flex items-center gap-4">
              <div class="w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-glow">
                <GraduationCap class="w-7 h-7" />
              </div>
              <div>
                <h1 class="font-display text-2xl font-extrabold text-text">
                  Trimestral Exam (Exame Trimestral)
                </h1>
                <p class="text-xs sm:text-sm text-text-muted mt-0.5">
                  Evaluated every 3 months to validate your progression through CEFR standards.
                </p>
              </div>
            </div>

            <span
              v-if="statusData"
              class="px-3 py-1.5 rounded-xl text-xs font-bold capitalize"
              :class="{
                'bg-success/15 text-success border border-success/30': statusData.status === 'available' || statusData.status === 'ready',
                'bg-warning/15 text-warning border border-warning/30': statusData.status === 'in_progress',
                'bg-border text-text-muted': statusData.status === 'locked'
              }"
            >
              {{ statusData.status === 'ready' || statusData.status === 'available' ? 'Available' : statusData.status }}
            </span>
          </div>

          <!-- Status Info Grid -->
          <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
            <div class="p-4 rounded-xl bg-input border border-border">
              <div class="flex items-center gap-2 text-text-muted text-xs font-medium mb-1">
                <Calendar class="w-4 h-4" />
                <span>Current CEFR Level</span>
              </div>
              <p class="text-lg font-extrabold text-text">{{ statusData?.current_level || userLevel }}</p>
            </div>

            <div class="p-4 rounded-xl bg-input border border-border">
              <div class="flex items-center gap-2 text-text-muted text-xs font-medium mb-1">
                <Clock class="w-4 h-4" />
                <span>Next Available Exam</span>
              </div>
              <p class="text-lg font-extrabold text-text">
                {{ statusData?.days_remaining && statusData.days_remaining > 0 ? `In ${statusData.days_remaining} days` : 'Ready now' }}
              </p>
            </div>

            <div class="p-4 rounded-xl bg-input border border-border">
              <div class="flex items-center gap-2 text-text-muted text-xs font-medium mb-1">
                <Trophy class="w-4 h-4 text-yellow-500" />
                <span>Last Score</span>
              </div>
              <p class="text-lg font-extrabold text-text">
                {{ statusData?.last_exam_evolution?.score !== undefined ? `${statusData.last_exam_evolution.score}%` : 'None yet' }}
              </p>
            </div>
          </div>

          <!-- Action Button -->
          <div class="flex flex-col sm:flex-row items-center gap-3 pt-4 border-t border-border">
            <Button
              v-if="statusData?.can_start || statusData?.status === 'available' || statusData?.status === 'ready' || statusData?.status === 'in_progress'"
              size="lg"
              full-width
              :loading="isStarting"
              @click="handleStartExam"
            >
              <Sparkles class="w-5 h-5 mr-2" />
              <span>{{ statusData?.status === 'in_progress' ? 'Continue Exam' : 'Start Trimestral Exam' }}</span>
            </Button>

            <button
              v-if="statusData?.status === 'in_progress'"
              type="button"
              @click="showResetModal = true"
              class="text-xs text-text-muted hover:text-danger underline transition-colors px-2 py-1"
            >
              Reset and start new
            </button>
          </div>
        </div>

        <!-- Last Evolution Details -->
        <div
          v-if="statusData?.last_exam_evolution"
          class="bg-surface border border-border rounded-2xl p-6 sm:p-8 space-y-4"
        >
          <div class="flex items-center gap-2 text-primary font-bold text-sm">
            <TrendingUp class="w-4 h-4" />
            <span>Latest Performance Overview</span>
          </div>

          <p v-if="statusData.last_exam_evolution.summary" class="text-sm text-text-muted leading-relaxed">
            {{ statusData.last_exam_evolution.summary }}
          </p>

          <div v-if="statusData.last_exam_evolution.can_do_statements?.length" class="space-y-2 pt-2">
            <h4 class="text-xs font-bold uppercase tracking-wider text-text-subtle">Key Can-Do Statements</h4>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div
                v-for="(stmt, idx) in statusData.last_exam_evolution.can_do_statements"
                :key="idx"
                class="flex items-start gap-2 p-2.5 rounded-xl bg-input border border-border/80 text-xs"
              >
                <CheckCircle2 class="w-4 h-4 text-success flex-shrink-0 mt-0.5" />
                <span class="text-text">{{ stmt }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- Past Exam History List -->
        <div class="bg-surface border border-border rounded-2xl p-6 sm:p-8 space-y-4">
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2 text-text font-bold text-sm">
              <Calendar class="w-4 h-4 text-primary" />
              <span>Histórico de Exames Anteriores</span>
            </div>
            <span class="text-xs text-text-muted">{{ history.length }} exame(s) realizado(s)</span>
          </div>

          <div v-if="history.length > 0" class="space-y-3 pt-2">
            <div
              v-for="(hItem, idx) in history"
              :key="hItem.id || idx"
              class="p-4 md:p-5 rounded-2xl bg-bg-secondary/40 border border-border hover:border-primary/30 transition-all flex flex-col sm:flex-row sm:items-center justify-between gap-4"
            >
              <div class="flex items-center gap-4">
                <div class="w-14 text-center">
                  <span class="text-2xl font-black text-primary leading-none block">{{ hItem.score }}%</span>
                  <span class="text-[10px] text-text-muted font-bold uppercase mt-1 block">
                    {{ hItem.passed ? 'Aprovado' : 'Prática' }}
                  </span>
                </div>
                <div>
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="text-xs px-2.5 py-0.5 rounded-full font-bold bg-primary/10 text-primary border border-primary/20">
                      Nível {{ hItem.level }}
                    </span>
                    <span class="text-xs text-text-muted font-medium">
                      {{ hItem.completed_at ? new Date(hItem.completed_at).toLocaleDateString() : 'Realizado' }}
                    </span>
                  </div>
                  <p class="text-xs text-text-muted mt-1 line-clamp-1">
                    {{ hItem.feedback || hItem.summary || 'Exame trimestral concluído com sucesso.' }}
                  </p>
                </div>
              </div>

              <button
                type="button"
                @click="handleReviewPastExam(hItem)"
                class="px-4 py-2 rounded-xl bg-surface hover:bg-primary/10 text-primary border border-primary/25 text-xs font-bold transition-all shrink-0 cursor-pointer"
              >
                Ver Feedback
              </button>
            </div>
          </div>

          <div v-else class="p-8 text-center bg-bg-secondary/20 rounded-2xl border border-dashed border-border text-text-muted text-xs">
            Nenhum exame realizado ainda. Seus exames trimestrais concluídos aparecerão aqui.
          </div>
        </div>
      </div>

      <!-- Active Exam Questions (Continuous Scroll) -->
      <div v-else-if="activeExam" class="space-y-6">
        <div
          v-for="(question, index) in activeExam.questions"
          :key="question.id"
          :id="`question-card-${index}`"
          class="bg-surface border border-border rounded-2xl p-6 sm:p-8 shadow-sm space-y-5 transition-all"
          :class="{ 'border-primary ring-1 ring-primary/20': answers[question.id] !== undefined }"
        >
          <!-- Header question number & points -->
          <div class="flex items-center justify-between pb-3 border-b border-border/60">
            <span class="px-3 py-1 rounded-lg text-xs font-extrabold bg-bg-secondary text-text">
              Question {{ index + 1 }} of {{ activeExam.questions.length }}
            </span>
            <span class="text-xs font-semibold text-text-muted">
              {{ question.points || 10 }} points
            </span>
          </div>

          <!-- Reading Passage if applicable -->
          <div
            v-if="question.reading_text"
            class="p-4 rounded-xl bg-input border border-border text-sm leading-relaxed text-text italic"
          >
            <div class="flex items-center gap-2 text-xs font-bold text-primary not-italic mb-2">
              <BookOpen class="w-4 h-4" />
              <span>Reading Passage</span>
            </div>
            {{ question.reading_text }}
          </div>

          <!-- Listening Player if applicable -->
          <div
            v-if="question.type === 'listening' || question.audio_text"
            class="p-4 rounded-xl bg-primary/5 border border-primary/20 flex items-center justify-between gap-4"
          >
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center">
                <Headphones class="w-5 h-5" />
              </div>
              <div>
                <p class="text-xs font-bold text-text">Listening Audio</p>
                <p class="text-[0.7rem] text-text-muted">Click to play dialogue in selected accent</p>
              </div>
            </div>

            <button
              type="button"
              @click="handlePlayListening(question)"
              class="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all shadow-sm"
              :class="
                playingListeningQuestionId === question.id && isPlaying
                  ? 'bg-danger text-white'
                  : 'bg-primary text-white hover:bg-primary-hover shadow-glow'
              "
            >
              <Pause v-if="playingListeningQuestionId === question.id && isPlaying" class="w-4 h-4" />
              <Play v-else class="w-4 h-4" />
              <span>{{ playingListeningQuestionId === question.id && isPlaying ? 'Pause Audio' : 'Play Audio' }}</span>
            </button>
          </div>

          <!-- Question Prompt Title -->
          <h3 class="font-display font-bold text-base sm:text-lg text-text">
            {{ question.question }}
          </h3>

          <!-- Multiple Choice Options -->
          <div v-if="question.options && question.options.length > 0" class="space-y-2.5 pt-2">
            <button
              v-for="(opt, optIdx) in question.options"
              :key="optIdx"
              type="button"
              @click="handleSelectAnswer(question.id, opt)"
              class="w-full p-4 rounded-xl text-left text-xs sm:text-sm font-medium border transition-all flex items-center gap-3"
              :class="
                answers[question.id] === opt
                  ? 'bg-primary/10 border-primary text-text shadow-sm'
                  : 'bg-input border-border text-text hover:border-primary/50 hover:bg-surface-hover'
              "
            >
              <div
                class="w-5 h-5 rounded-full border flex items-center justify-center flex-shrink-0 text-xs font-bold transition-all"
                :class="
                  answers[question.id] === opt
                    ? 'border-primary bg-primary text-white'
                    : 'border-border text-text-subtle'
                "
              >
                <Check v-if="answers[question.id] === opt" class="w-3 h-3 stroke-[3]" />
                <span v-else>{{ String.fromCharCode(65 + optIdx) }}</span>
              </div>
              <span class="flex-1">{{ opt }}</span>
            </button>
          </div>

          <!-- Speaking Question Live Recorder -->
          <div v-else-if="question.type === 'speaking'" class="space-y-4 pt-2">
            <div class="p-4 rounded-xl bg-input border border-border flex flex-col sm:flex-row items-center justify-between gap-4">
              <div class="flex items-center gap-3">
                <button
                  type="button"
                  @click="handleRecordSpeaking(question)"
                  class="w-12 h-12 rounded-full flex items-center justify-center transition-all shadow-md"
                  :class="
                    isRecording && activeSpeakingQuestionId === question.id
                      ? 'bg-danger text-white animate-pulse'
                      : 'bg-primary text-white hover:bg-primary-hover shadow-glow'
                  "
                >
                  <Square v-if="isRecording && activeSpeakingQuestionId === question.id" class="w-5 h-5 fill-current" />
                  <Mic v-else class="w-5 h-5" />
                </button>
                <div>
                  <p class="text-xs font-bold text-text">
                    {{ isRecording && activeSpeakingQuestionId === question.id ? 'Recording your speech...' : 'Press to Record' }}
                  </p>
                  <p class="text-[0.7rem] text-text-muted">
                    Min: {{ question.min_seconds || 15 }}s | Max: {{ question.max_seconds || 45 }}s
                  </p>
                </div>
              </div>

              <span
                v-if="isRecording && activeSpeakingQuestionId === question.id"
                class="text-sm font-extrabold text-danger"
              >
                00:{{ recordingDuration < 10 ? `0${recordingDuration}` : recordingDuration }}
              </span>

              <span
                v-else-if="answers[question.id]"
                class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold bg-success/15 text-success"
              >
                <CheckCircle2 class="w-4 h-4" />
                Audio Recorded
              </span>
            </div>
          </div>

          <!-- Text input for open questions / writing -->
          <div v-else class="space-y-2 pt-2">
            <div class="flex items-center justify-between text-xs text-text-muted font-medium">
              <span>Write your response in English (aim for {{ question.min_words || 20 }}-{{ question.max_words || 60 }} words).</span>
              <span
                class="px-2 py-0.5 rounded-full font-bold text-[10px] border"
                :class="
                  getWordCount(answers[question.id] || '') >= (question.min_words || 20)
                    ? 'bg-success/10 text-success border-success/30'
                    : 'bg-warning/10 text-warning border-warning/30'
                "
              >
                {{ getWordCount(answers[question.id] || '') }} words
              </span>
            </div>
            <textarea
              v-model="answers[question.id]"
              rows="4"
              placeholder="Write your answer in English here..."
              class="w-full p-4 rounded-xl border border-border bg-input text-text text-sm focus:outline-none focus:border-primary resize-none"
            ></textarea>
          </div>
        </div>

        <!-- Submit Button at bottom of continuous scroll -->
        <div class="text-center py-6">
          <Button
            size="lg"
            full-width
            :loading="isSubmitting"
            @click="showConfirmModal = true"
          >
            Review and Submit Trimestral Exam
          </Button>
        </div>
      </div>

      <!-- Finished Exam Results Modal / Screen -->
      <div v-else-if="isExamFinished && examResult" class="bg-surface border border-border rounded-2xl p-6 sm:p-8 space-y-6 animate-fade-in">
        <div class="text-center space-y-2">
          <div class="w-16 h-16 rounded-3xl bg-success/15 text-success mx-auto flex items-center justify-center mb-3">
            <Trophy class="w-8 h-8" />
          </div>
          <h2 class="font-display text-2xl font-extrabold text-text">
            Exam Completed!
          </h2>
          <p class="text-xs sm:text-sm text-text-muted">
            Here is your official evaluation breakdown.
          </p>
        </div>

        <div class="grid grid-cols-1 sm:grid-cols-3 gap-4 my-6">
          <div class="p-4 rounded-xl bg-input border border-border text-center">
            <span class="text-xs font-bold text-text-muted">Score</span>
            <p class="text-3xl font-extrabold text-primary mt-1">{{ examResult.score }}%</p>
          </div>
          <div class="p-4 rounded-xl bg-input border border-border text-center">
            <span class="text-xs font-bold text-text-muted">Assessed Level</span>
            <p class="text-3xl font-extrabold text-text mt-1">{{ examResult.level }}</p>
          </div>
          <div class="p-4 rounded-xl bg-input border border-border text-center">
            <span class="text-xs font-bold text-text-muted">Result</span>
            <p
              class="text-2xl font-extrabold mt-1"
              :class="examResult.passed ? 'text-success' : 'text-danger'"
            >
              {{ examResult.passed ? 'PASSED' : 'NEEDS PRACTICE' }}
            </p>
          </div>
        </div>

        <div v-if="examResult.summary" class="p-4 rounded-xl bg-input border border-border text-sm leading-relaxed text-text">
          <p class="font-bold text-xs uppercase tracking-wider text-text-muted mb-1">Teacher Tatiana's Feedback:</p>
          {{ examResult.summary }}
        </div>

        <Button size="lg" full-width @click="isExamFinished = false; loadStatus()">
          Back to Overview
        </Button>
      </div>

      <!-- Past Exam Review Detail Screen -->
      <div v-else-if="isReviewing && selectedReviewExam" class="bg-surface border border-border rounded-2xl p-6 sm:p-8 space-y-6 animate-fade-in">
        <div class="flex items-center justify-between pb-4 border-b border-border">
          <div class="flex items-center gap-3">
            <button
              type="button"
              @click="isReviewing = false; selectedReviewExam = null"
              class="p-2 rounded-xl bg-input hover:bg-surface-hover text-text transition-colors cursor-pointer"
            >
              <ChevronLeft class="w-5 h-5" />
            </button>
            <div>
              <h2 class="font-display text-xl font-bold text-text">
                Revisão do Exame Nível {{ selectedReviewExam.level }}
              </h2>
              <p class="text-xs text-text-muted">
                {{ selectedReviewExam.completed_at ? new Date(selectedReviewExam.completed_at).toLocaleDateString() : 'Realizado' }}
              </p>
            </div>
          </div>
          <span
            class="px-3 py-1.5 rounded-xl text-xs font-bold"
            :class="selectedReviewExam.passed ? 'bg-success/15 text-success border border-success/30' : 'bg-warning/15 text-warning border border-warning/30'"
          >
            {{ selectedReviewExam.passed ? 'Aprovado' : 'Concluído' }} ({{ selectedReviewExam.score }}%)
          </span>
        </div>

        <div v-if="selectedReviewExam.summary_feedback" class="p-4 rounded-xl bg-input border border-border text-sm leading-relaxed text-text">
          <p class="font-bold text-xs uppercase tracking-wider text-primary mb-1">Feedback Pedagógico da Teacher Tati:</p>
          {{ selectedReviewExam.summary_feedback }}
        </div>

        <!-- Question corrections list if present -->
        <div v-if="selectedReviewExam.corrections?.length" class="space-y-4">
          <h3 class="font-bold text-sm text-text uppercase tracking-wider">Correção Questão por Questão</h3>
          <div
            v-for="(corr, cIdx) in selectedReviewExam.corrections"
            :key="corr.question_id || cIdx"
            class="p-4 rounded-xl border space-y-3"
            :class="corr.is_correct ? 'bg-success/5 border-success/30' : 'bg-danger/5 border-danger/30'"
          >
            <div class="flex items-center justify-between text-xs font-bold">
              <span class="text-text">Questão {{ cIdx + 1 }}: {{ corr.question }}</span>
              <span :class="corr.is_correct ? 'text-success' : 'text-danger'">
                {{ corr.is_correct ? '✓ Correta' : '✗ Incorreta' }}
              </span>
            </div>
            <div class="text-xs space-y-1">
              <p><strong class="text-text-muted">Sua resposta:</strong> {{ corr.student_answer || 'Sem resposta' }}</p>
              <p v-if="!corr.is_correct"><strong class="text-success">Resposta correta:</strong> {{ corr.correct_answer }}</p>
              <p v-if="corr.explanation" class="text-text-muted italic mt-1">{{ corr.explanation }}</p>
            </div>
          </div>
        </div>

        <Button size="lg" full-width @click="isReviewing = false; selectedReviewExam = null">
          Voltar ao Visão Geral
        </Button>
      </div>

    </div>

    <!-- Modals -->
    <DialogModal
      :is-open="showConfirmModal"
      title="Submit Trimestral Exam?"
      :description="`You have answered ${answeredCount} of ${activeExam?.questions?.length || 0} questions. Are you ready to submit for final AI correction?`"
      confirm-text="Yes, Submit Exam"
      cancel-text="Continue Answering"
      :is-loading="isSubmitting"
      @confirm="confirmSubmit"
      @cancel="showConfirmModal = false"
      @close="showConfirmModal = false"
    />

    <DialogModal
      :is-open="showResetModal"
      title="Reset current exam?"
      description="This will clear your ongoing exam draft and allow generating a fresh exam."
      confirm-text="Reset Exam"
      cancel-text="Cancel"
      :is-destructive="true"
      @confirm="handleResetExam"
      @cancel="showResetModal = false"
      @close="showResetModal = false"
    />
  </div>
</template>

