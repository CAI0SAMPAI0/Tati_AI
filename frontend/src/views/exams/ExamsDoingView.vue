<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter, useRoute } from 'vue-router';
import {
  ArrowLeft,
  BookOpen,
  GraduationCap,
  CheckCircle2,
  XCircle,
  Play,
  Pause,
  Mic,
  Square,
  FileText,
  Volume2,
  Trophy,
  Flame,
  Calendar,
  Sparkles,
  BookmarkCheck,
  Check,
  Lightbulb,
  AlertTriangle,
  ArrowRight,
} from 'lucide-vue-next';
import { useAuth } from '@/composables/useAuth';
import { useToast } from '@/composables/useToast';
import { getCurrentExam, startExam, submitExam, getTtsAudio } from '@/api/exams';
import { apiGet } from '@/api/client';
import type { ExamActive, Question } from '@/api/types';
import Button from '@/components/ui/Button.vue';

const router = useRouter();
const route = useRoute();
const toast = useToast();
const { accent } = useAuth();

const activeExam = ref<ExamActive | null>(null);
const isLoading = ref(true);
const isSubmitting = ref(false);
const showSubmitModal = ref(false);

const answers = ref<Record<string, string>>({});
const recordedAudios = ref<Record<string, string>>({});
const showTranscript = ref<Record<string, boolean>>({});

// Audio playback states
const playingAudioId = ref<string | null>(null);
const audioListenCount = ref<Record<string, number>>({});
const audioPlayerRef = ref<HTMLAudioElement | null>(null);

// Voice recording states
const recordingQuestionId = ref<string | null>(null);
const recordingSeconds = ref(0);
const recordingTimer = ref<any>(null);
const mediaRecorder = ref<MediaRecorder | null>(null);
const audioChunks = ref<Blob[]>([]);

// Results & Review View State
const isFinished = ref(false);
const examResult = ref<any | null>(null);
const isReviewingHistory = ref(false);

const answeredCount = computed(() => {
  if (!activeExam.value) return 0;
  return activeExam.value.questions.filter(
    (q) => Boolean(answers.value[q.id]) || Boolean(recordedAudios.value[q.id])
  ).length;
});

const progressPercentage = computed(() => {
  if (!activeExam.value || !activeExam.value.total_questions) return 0;
  return Math.round((answeredCount.value / activeExam.value.total_questions) * 100);
});

const unansweredQuestions = computed(() => {
  if (!activeExam.value) return [];
  return activeExam.value.questions.filter(
    (q) => !Boolean(answers.value[q.id]) && !Boolean(recordedAudios.value[q.id])
  );
});

async function loadExam() {
  isLoading.value = true;
  const reviewId = route.query.review_id as string;

  if (reviewId) {
    try {
      const detail = await apiGet<any>(`/exams/trimestral/${reviewId}`);
      if (detail) {
        examResult.value = {
          exam_id: detail.id,
          score: detail.score,
          passed: detail.passed,
          recommended_level: detail.level,
          xp_earned: detail.xp_earned ?? detail.score,
          next_exam_date: detail.completed_at,
          summary_feedback: detail.summary_feedback || detail.feedback || 'Assessment completed.',
          can_do_statements: detail.can_do_statements || [],
          points_to_improve: detail.points_to_improve || [],
          skills_breakdown: detail.skills_breakdown || {},
          corrections: detail.corrections || [],
        };
        isReviewingHistory.value = true;
        isFinished.value = true;
      }
    } catch (err) {
      toast.error('Unable to load exam review.');
      router.push('/exams');
    } finally {
      isLoading.value = false;
    }
    return;
  }

  try {
    let exam = await getCurrentExam().catch(() => null);
    if (!exam || !exam.questions || exam.questions.length === 0) {
      exam = await startExam();
    }
    if (exam && exam.questions && exam.questions.length > 0) {
      activeExam.value = exam;
    } else {
      toast.error('No exam available at this time.');
      router.push('/exams');
    }
  } catch (err: any) {
    console.error('Error starting or loading exam:', err);
    toast.error(err?.message || 'Could not load exam. Redirecting to dashboard.');
    router.push('/exams');
  } finally {
    isLoading.value = false;
  }
}

function scrollToQuestion(idx: number) {
  const el = document.getElementById(`question-card-${idx}`);
  if (el) {
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function toggleTranscript(qId: string) {
  showTranscript.value[qId] = !showTranscript.value[qId];
}

// Audio Listening Playback
async function handlePlayQuestionAudio(q: Question) {
  if (playingAudioId.value === q.id && audioPlayerRef.value) {
    audioPlayerRef.value.pause();
    playingAudioId.value = null;
    return;
  }

  let src = q.audio_url;
  if (!src && q.audio_text) {
    try {
      const tts = await getTtsAudio(q.audio_text, accent.value || 'en-US');
      if (tts && tts.audio_b64) {
        src = `data:audio/mp3;base64,${tts.audio_b64}`;
      }
    } catch (err) {
      console.error('TTS error:', err);
    }
  }

  if (!src) {
    toast.error('Audio source not available for this question.');
    return;
  }

  if (audioPlayerRef.value) {
    audioPlayerRef.value.pause();
  }

  audioPlayerRef.value = new Audio(src);
  playingAudioId.value = q.id;
  audioListenCount.value[q.id] = (audioListenCount.value[q.id] || 0) + 1;

  audioPlayerRef.value.onended = () => {
    playingAudioId.value = null;
  };

  audioPlayerRef.value.play().catch(() => {
    playingAudioId.value = null;
  });
}

// Voice Recording for Speaking
async function handleToggleRecording(q: Question) {
  if (recordingQuestionId.value === q.id) {
    // Stop recording
    if (mediaRecorder.value && mediaRecorder.value.state === 'recording') {
      mediaRecorder.value.stop();
    }
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    audioChunks.value = [];
    recordingSeconds.value = 0;
    recordingQuestionId.value = q.id;

    const recorder = new MediaRecorder(stream);
    mediaRecorder.value = recorder;

    recorder.ondataavailable = (e) => {
      if (e.data.size > 0) audioChunks.value.push(e.data);
    };

    recorder.onstop = async () => {
      clearInterval(recordingTimer.value);
      const audioBlob = new Blob(audioChunks.value, { type: 'audio/webm' });
      stream.getTracks().forEach((t) => t.stop());

      // Convert to base64
      const reader = new FileReader();
      reader.onloadend = () => {
        const base64 = (reader.result as string).split(',')[1];
        if (base64) {
          recordedAudios.value[q.id] = base64;
          answers.value[q.id] = '[Audio Recorded]';
          toast.success('Audio response recorded successfully!');
        }
      };
      reader.readAsDataURL(audioBlob);
      recordingQuestionId.value = null;
    };

    recorder.start();
    recordingTimer.value = setInterval(() => {
      recordingSeconds.value++;
    }, 1000);
  } catch (err) {
    toast.error('Microphone permission required for speaking questions.');
    recordingQuestionId.value = null;
  }
}

// Submit Exam Execution
async function handleExecuteSubmit() {
  if (!activeExam.value) return;
  showSubmitModal.value = false;
  isSubmitting.value = true;

  try {
    // Construct answers array matching backend expectation
    const payloadAnswers = activeExam.value.questions.map((q) => ({
      question_id: q.id,
      answer: answers.value[q.id] || (recordedAudios.value[q.id] ? '[Audio Recorded]' : ''),
      audio_data: recordedAudios.value[q.id] || undefined,
    }));

    const result = await submitExam({
      exam_id: activeExam.value.exam_id,
      answers: payloadAnswers,
    });

    examResult.value = result;
    isFinished.value = true;
    toast.success(`Exam submitted successfully! Score: ${result.score}% 🎉`);
  } catch (err: any) {
    console.error('Error submitting exam:', err);
    toast.error(err?.message || 'Error submitting exam.');
  } finally {
    isSubmitting.value = false;
  }
}

onMounted(() => {
  loadExam();
});

onUnmounted(() => {
  if (audioPlayerRef.value) {
    audioPlayerRef.value.pause();
    audioPlayerRef.value = null;
  }
  if (recordingTimer.value) clearInterval(recordingTimer.value);
});
</script>

<template>
  <div class="min-h-screen bg-bg text-text flex flex-col">
    <!-- Loading Screen -->
    <div v-if="isLoading" class="flex-1 flex flex-col items-center justify-center p-8">
      <div class="w-12 h-12 rounded-full border-4 border-primary/20 border-t-primary animate-spin mb-4"></div>
      <p class="font-bold text-sm text-text-muted">Loading Trimestral Exam...</p>
    </div>

    <!-- RESULT SCREEN -->
    <div v-else-if="isFinished && examResult" class="flex-1 max-w-4xl w-full mx-auto p-4 md:p-8 animate-fade-in">
      <div v-if="isReviewingHistory" class="mb-6 p-4 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-between gap-4">
        <div class="flex items-center gap-2 text-xs md:text-sm font-bold text-primary">
          <BookmarkCheck class="w-5 h-5 shrink-0" />
          <span>Historical Exam Review • Level {{ examResult.recommended_level || examResult.level || 'B1' }}</span>
        </div>
        <button
          type="button"
          @click="router.push('/exams')"
          class="px-4 py-2 rounded-xl bg-surface border border-border text-xs font-bold text-text hover:text-primary transition-all flex items-center gap-1.5 cursor-pointer shadow-xs"
        >
          <ArrowLeft class="w-4 h-4" /> Back to Dashboard
        </button>
      </div>

      <!-- Result Score Banner -->
      <div class="bg-surface border border-border rounded-3xl p-6 md:p-10 shadow-sm text-center mb-8 relative overflow-hidden">
        <div class="w-20 h-20 mx-auto rounded-3xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary mb-4 shadow-inner">
          <Trophy class="w-10 h-10 text-primary animate-bounce" />
        </div>

        <span
          class="text-xs px-4 py-1.5 rounded-full font-bold uppercase tracking-wider inline-block mb-3"
          :class="examResult.passed ? 'bg-success/10 text-success border border-success/20' : 'bg-warning/10 text-warning border border-warning/20'"
        >
          {{ examResult.passed ? 'Quarterly Assessment Passed' : 'Assessment Completed' }}
        </span>

        <h1 class="text-3xl md:text-5xl font-black text-text mb-2 tracking-tight">
          {{ examResult.score }}% <span class="text-xl md:text-2xl font-normal text-text-muted">Overall Score</span>
        </h1>

        <p class="text-sm md:text-base text-text-muted max-w-xl mx-auto mb-6 leading-relaxed">
          {{ examResult.summary_feedback || examResult.summary || 'Exam successfully evaluated by Teacher Tatiana.' }}
        </p>

        <div class="flex flex-wrap items-center justify-center gap-3 md:gap-4 mb-6">
          <div class="bg-bg-secondary px-4 py-2 rounded-xl flex items-center gap-2 border border-border text-sm font-bold">
            <Flame class="w-4 h-4 text-amber-500" />
            <span>+{{ examResult.xp_earned || 50 }} XP Earned</span>
          </div>

          <div v-if="examResult.recommended_level || examResult.level" class="bg-primary/10 text-primary px-4 py-2 rounded-xl flex items-center gap-2 border border-primary/20 text-sm font-bold">
            <Sparkles class="w-4 h-4" />
            <span>Calibrated Level: {{ examResult.recommended_level || examResult.level }}</span>
          </div>
        </div>

        <button
          type="button"
          @click="router.push('/exams')"
          class="px-8 py-3.5 rounded-xl bg-primary text-white font-bold text-sm hover:opacity-90 shadow-md inline-flex items-center gap-2 cursor-pointer transition-all active:scale-95"
        >
          <span>Return to Exams Dashboard</span>
          <ArrowRight class="w-4 h-4" />
        </button>
      </div>

      <!-- Can-Do Statements -->
      <div v-if="examResult.can_do_statements && examResult.can_do_statements.length > 0" class="bg-surface border border-border rounded-3xl p-6 md:p-8 mb-8 shadow-xs">
        <div class="flex items-center gap-3 mb-6">
          <div class="w-10 h-10 rounded-xl bg-success/10 text-success flex items-center justify-center font-bold">
            <BookmarkCheck class="w-5 h-5" />
          </div>
          <div>
            <h2 class="text-lg md:text-xl font-bold text-text">Demonstrated Competencies</h2>
            <p class="text-xs text-text-muted">Official CEFR competencies proven in this assessment</p>
          </div>
        </div>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            v-for="(stmt, idx) in examResult.can_do_statements"
            :key="idx"
            class="flex items-start gap-3 p-4 rounded-2xl bg-bg-secondary/60 border border-border"
          >
            <div class="w-6 h-6 rounded-full bg-success/10 text-success flex items-center justify-center shrink-0 mt-0.5">
              <Check class="w-3.5 h-3.5" />
            </div>
            <p class="text-sm font-medium text-text leading-snug">{{ stmt }}</p>
          </div>
        </div>
      </div>

      <!-- Points to Improve -->
      <div v-if="examResult.points_to_improve && examResult.points_to_improve.length > 0" class="bg-surface border border-border rounded-3xl p-6 md:p-8 mb-8 shadow-xs">
        <div class="flex items-center gap-3 mb-5">
          <div class="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center font-bold">
            <Lightbulb class="w-5 h-5" />
          </div>
          <div>
            <h2 class="text-lg md:text-xl font-bold text-text">Recommended Improvements</h2>
            <p class="text-xs text-text-muted">Constructive next steps to strengthen your English</p>
          </div>
        </div>
        <div class="space-y-2.5">
          <div
            v-for="(tip, idx) in examResult.points_to_improve"
            :key="idx"
            class="flex items-start gap-3 p-3.5 rounded-2xl bg-amber-500/5 border border-amber-500/20 text-xs sm:text-sm text-text"
          >
            <Sparkles class="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
            <span>{{ tip }}</span>
          </div>
        </div>
      </div>

      <!-- Detailed Corrections Review -->
      <div v-if="examResult.corrections && examResult.corrections.length > 0" class="bg-surface border border-border rounded-3xl p-6 md:p-8 shadow-xs">
        <h2 class="text-lg md:text-xl font-bold text-text mb-2 flex items-center gap-2">
          <FileText class="w-5 h-5 text-primary" />
          <span>Exam Review & Pedagogical Feedback</span>
        </h2>
        <p class="text-xs text-text-muted mb-6">Review Teacher Tatiana's explanations and AI evaluations for each question</p>

        <div class="space-y-4">
          <div
            v-for="(corr, idx) in examResult.corrections"
            :key="idx"
            class="p-5 rounded-2xl border transition-all"
            :class="corr.is_correct ? 'border-success/30 bg-success/5' : 'border-danger/30 bg-danger/5'"
          >
            <div class="flex items-center justify-between gap-2 mb-2">
              <span class="text-xs font-bold uppercase tracking-wider text-text-muted">
                Question {{ idx + 1 }} • {{ corr.type.toUpperCase() }}
              </span>
              <span
                class="text-xs font-bold px-2.5 py-1 rounded-full flex items-center gap-1"
                :class="corr.is_correct ? 'bg-success/10 text-success border border-success/20' : 'bg-danger/10 text-danger border border-danger/20'"
              >
                <CheckCircle2 v-if="corr.is_correct" class="w-3 h-3" />
                <XCircle v-else class="w-3 h-3" />
                <span>{{ corr.is_correct ? `Correct (+${corr.points_earned} pts)` : `Needs Review (+${corr.points_earned || 0} pts)` }}</span>
              </span>
            </div>

            <p class="text-sm font-bold text-text mb-3">{{ corr.question }}</p>

            <div class="text-xs space-y-1 mb-3">
              <p class="text-text-muted">
                Your answer: <strong :class="corr.is_correct ? 'text-success' : 'text-danger'">{{ corr.student_answer || '(not answered)' }}</strong>
              </p>
              <p v-if="corr.correct_answer && (corr.type === 'writing' || !corr.is_correct)" class="text-text-muted">
                {{ corr.type === 'writing' ? 'Polished version:' : 'Target answer:' }}
                <strong class="text-success">{{ corr.correct_answer }}</strong>
              </p>
            </div>

            <div v-if="corr.explanation" class="bg-bg/60 p-3 rounded-xl border border-border text-xs text-text-muted flex items-start gap-2">
              <Lightbulb class="w-4 h-4 text-primary shrink-0 mt-0.5" />
              <span><strong>Pedagogical Feedback:</strong> {{ corr.explanation }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- EXAM TAKING VIEW -->
    <div v-else-if="activeExam" class="flex-1 flex flex-col">
      <!-- Sticky Navigation Bar -->
      <div class="sticky top-0 z-30 bg-surface/95 backdrop-blur-md border-b border-border py-3 px-4 sm:px-6 shadow-xs">
        <div class="max-w-4xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-3">
          <div class="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-start">
            <button
              type="button"
              @click="router.push('/exams')"
              class="p-1.5 rounded-lg border border-border text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
              title="Return to dashboard (answers are saved in progress)"
            >
              <ArrowLeft class="w-4 h-4" />
            </button>
            <span class="text-xs font-bold px-2.5 py-1 rounded-lg bg-primary text-white">
              Level {{ activeExam.level }}
            </span>
            <span class="text-xs font-semibold text-text-muted">
              Progress: <strong class="text-text">{{ answeredCount }}</strong> / {{ activeExam.questions.length }} ({{ progressPercentage }}%)
            </span>
          </div>

          <!-- Shortcuts Pill Buttons -->
          <div class="flex items-center gap-1.5 overflow-x-auto max-w-full py-1 custom-scrollbar">
            <button
              v-for="(q, idx) in activeExam.questions"
              :key="q.id"
              type="button"
              @click="scrollToQuestion(idx)"
              class="w-7 h-7 rounded-lg text-xs font-bold transition-all flex items-center justify-center shrink-0 cursor-pointer"
              :class="
                answers[q.id] || recordedAudios[q.id]
                  ? 'bg-success text-white'
                  : 'bg-input text-text-muted hover:border-primary border border-border'
              "
            >
              {{ idx + 1 }}
            </button>
          </div>

          <button
            type="button"
            @click="showSubmitModal = true"
            :disabled="isSubmitting"
            class="w-full sm:w-auto px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow-glow hover:bg-primary-hover transition-all disabled:opacity-50 flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <CheckCircle2 class="w-3.5 h-3.5" />
            <span>{{ isSubmitting ? 'Submitting...' : 'Submit Exam' }}</span>
          </button>
        </div>

        <!-- Linear Progress Line -->
        <div class="max-w-4xl mx-auto w-full bg-border/40 h-1.5 rounded-full mt-2.5 overflow-hidden">
          <div
            class="bg-primary h-full transition-all duration-300"
            :style="{ width: `${progressPercentage}%` }"
          />
        </div>
      </div>

      <!-- Question List -->
      <div class="max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6">
        <div
          v-for="(q, idx) in activeExam.questions"
          :key="q.id"
          :id="`question-card-${idx}`"
          class="bg-surface border border-border rounded-3xl p-6 md:p-8 space-y-5 transition-all shadow-xs"
        >
          <!-- Question Header -->
          <div class="flex items-center justify-between gap-2 border-b border-border/60 pb-3">
            <div class="flex items-center gap-2">
              <span class="w-7 h-7 rounded-lg bg-primary/10 text-primary text-xs font-black flex items-center justify-center">
                {{ idx + 1 }}
              </span>
              <span class="text-xs font-bold uppercase tracking-wider text-text-muted">
                {{ q.type }}
              </span>
            </div>

            <span class="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-bg border border-border text-text-muted">
              {{ q.points || 1 }} pt{{ (q.points || 1) > 1 ? 's' : '' }}
            </span>
          </div>

          <!-- Reading Text Passage (if present) -->
          <div v-if="q.reading_text" class="p-4 rounded-2xl bg-bg border border-border/80 text-xs sm:text-sm text-text leading-relaxed">
            <p class="font-bold text-[0.68rem] uppercase tracking-wider text-primary mb-1.5 flex items-center gap-1.5">
              <BookOpen class="w-3.5 h-3.5" /> Reading Passage
            </p>
            <div class="whitespace-pre-wrap">{{ q.reading_text }}</div>
          </div>

          <!-- Audio Listening Section (with Audio Player + TRANSCRIPT Toggle) -->
          <div v-if="q.audio_url || q.audio_text" class="p-4 rounded-2xl bg-primary/5 border border-primary/20 space-y-3">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <button
                type="button"
                @click="handlePlayQuestionAudio(q)"
                class="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover shadow-xs transition-colors cursor-pointer"
              >
                <Pause v-if="playingAudioId === q.id" class="w-4 h-4" />
                <Play v-else class="w-4 h-4" />
                <span>{{ playingAudioId === q.id ? 'Pause Audio' : 'Play Listening Audio' }}</span>
              </button>

              <span class="text-xs text-text-muted">
                Listened: <strong class="text-text">{{ audioListenCount[q.id] || 0 }}</strong> time{{ (audioListenCount[q.id] || 0) === 1 ? '' : 's' }}
              </span>
            </div>

            <!-- TRANSCRIPT TOGGLE & TEXT -->
            <div v-if="q.audio_text" class="pt-2 border-t border-primary/10">
              <button
                type="button"
                @click="toggleTranscript(q.id)"
                class="text-xs font-bold text-text-muted hover:text-emerald-500 underline transition-colors cursor-pointer"
              >
                {{ showTranscript[q.id] ? 'Hide Audio Transcript' : 'Show Audio Transcript (Practice)' }}
              </button>

              <div
                v-if="showTranscript[q.id]"
                class="mt-3 p-4 rounded-xl bg-surface/90 border border-emerald-500/20 text-xs md:text-sm font-mono text-text animate-fade-in"
              >
                <p class="text-text-muted text-[11px] uppercase tracking-wider mb-1 font-sans font-bold">Transcript:</p>
                <p class="italic leading-relaxed">{{ q.audio_text }}</p>
              </div>
            </div>
          </div>

          <!-- Question Prompt -->
          <p class="text-sm md:text-base font-bold text-text leading-snug">
            {{ q.question }}
          </p>

          <!-- Speaking Question Mic Recorder -->
          <div v-if="q.type === 'speaking'" class="space-y-3 pt-2">
            <div class="flex flex-wrap items-center gap-3">
              <button
                type="button"
                @click="handleToggleRecording(q)"
                class="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
                :class="
                  recordingQuestionId === q.id
                    ? 'bg-danger text-white animate-pulse'
                    : 'bg-primary text-white hover:bg-primary-hover'
                "
              >
                <Square v-if="recordingQuestionId === q.id" class="w-4 h-4" />
                <Mic v-else class="w-4 h-4" />
                <span>{{ recordingQuestionId === q.id ? `Stop (${recordingSeconds}s)` : 'Record Voice Answer' }}</span>
              </button>

              <span v-if="recordedAudios[q.id]" class="text-xs text-success font-bold flex items-center gap-1">
                <CheckCircle2 class="w-4 h-4" /> Audio response saved
              </span>
            </div>
          </div>

          <!-- Multiple Choice Options -->
          <div v-else-if="q.options && q.options.length > 0" class="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
            <button
              v-for="opt in q.options"
              :key="opt"
              type="button"
              @click="answers[q.id] = opt"
              class="p-3.5 rounded-2xl border text-left text-xs sm:text-sm font-medium transition-all cursor-pointer flex items-center justify-between"
              :class="
                answers[q.id] === opt
                  ? 'border-primary bg-primary/10 text-primary font-bold ring-2 ring-primary/20 shadow-xs'
                  : 'border-border bg-bg hover:border-primary/40 text-text'
              "
            >
              <span>{{ opt }}</span>
              <span
                v-if="answers[q.id] === opt"
                class="w-4 h-4 rounded-full bg-primary text-white flex items-center justify-center text-[0.65rem] shrink-0 font-black"
              >
                ✓
              </span>
            </button>
          </div>

          <!-- Open-ended Writing Textarea -->
          <div v-else class="pt-2">
            <textarea
              rows="4"
              v-model="answers[q.id]"
              placeholder="Write your paragraph in English here..."
              class="w-full px-4 py-3 rounded-xl bg-bg border border-border text-sm text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-y"
            ></textarea>
            <div class="flex items-center justify-between text-[0.7rem] text-text-muted mt-1.5 px-1">
              <span>Punctuation errors do not reduce your writing score.</span>
              <span class="font-bold">
                Words: {{ (answers[q.id] || '').trim() ? (answers[q.id] || '').trim().split(/\s+/).length : 0 }}
                <template v-if="q.min_words && q.max_words"> ({{ q.min_words }}–{{ q.max_words }} recommended)</template>
              </span>
            </div>
          </div>
        </div>

        <!-- Bottom Submit Bar -->
        <div class="flex justify-end pt-4">
          <Button
            @click="showSubmitModal = true"
            :loading="isSubmitting"
            size="lg"
            class="px-8 font-bold gap-2"
          >
            <CheckCircle2 class="w-5 h-5" />
            <span>Finalize & Submit Exam</span>
          </Button>
        </div>
      </div>
    </div>

    <!-- Submit Confirmation Modal -->
    <Teleport to="body">
      <div
        v-if="showSubmitModal"
        class="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      >
        <div class="w-full max-w-md bg-surface border border-border rounded-3xl shadow-2xl p-6 space-y-5 animate-in zoom-in-95 duration-200">
          <div class="flex items-start gap-3.5 p-4 rounded-2xl" :class="unansweredQuestions.length > 0 ? 'bg-warning/10 border border-warning/20 text-warning' : 'bg-primary/10 border border-primary/20 text-primary'">
            <AlertTriangle v-if="unansweredQuestions.length > 0" class="shrink-0 mt-0.5 w-5 h-5" />
            <CheckCircle2 v-else class="shrink-0 mt-0.5 w-5 h-5" />
            <div class="text-xs space-y-1">
              <p class="font-bold text-sm">
                {{ unansweredQuestions.length > 0 ? 'Incomplete Exam Submission' : 'Submit Quarterly Exam?' }}
              </p>
              <p class="text-text-muted leading-relaxed">
                {{ unansweredQuestions.length > 0
                  ? `You still have ${unansweredQuestions.length} unanswered question(s). You can review or submit now.`
                  : 'Teacher Tatiana will evaluate your responses and calibrate your CEFR level and awarded XP.'
                }}
              </p>
            </div>
          </div>

          <div class="flex items-center justify-end gap-3 pt-3 border-t border-border">
            <Button
              variant="secondary"
              @click="showSubmitModal = false"
              :disabled="isSubmitting"
            >
              Review Questions
            </Button>
            <Button
              :loading="isSubmitting"
              @click="handleExecuteSubmit"
              class="gap-2 font-bold"
            >
              <CheckCircle2 class="w-4 h-4" />
              <span>Yes, Submit Exam</span>
            </Button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
