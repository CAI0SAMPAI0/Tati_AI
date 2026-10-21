<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  GraduationCap,
  Clock,
  Sparkles,
  BookOpen,
  Headphones,
  CheckCircle2,
  Calendar,
  RotateCcw,
  Trophy,
  ArrowRight,
  TrendingUp,
  BookmarkCheck,
  ChevronRight,
  History as HistoryIcon,
} from 'lucide-vue-next';
import { useAuth } from '@/composables/useAuth';
import { useToast } from '@/composables/useToast';
import { getExamStatus, getExamHistory, resetExam } from '@/api/exams';
import type { ExamStatus, ExamHistoryItem } from '@/api/types';
import Button from '@/components/ui/Button.vue';

const router = useRouter();
const toast = useToast();
const { user, userLevel } = useAuth();

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;

const statusData = ref<ExamStatus | null>(null);
const historyList = ref<ExamHistoryItem[]>([]);
const isLoading = ref(true);
const isResetting = ref(false);

const isStaff = computed(() => {
  const role = user.value?.role;
  return role === 'admin' || role === 'teacher' || role === 'professor' || role === 'programmer' || role === 'programador';
});

const isResume = computed(() => statusData.value?.status === 'in_progress');
const canStart = computed(() => Boolean(statusData.value?.can_start) || isResume.value);
const daysRemaining = computed(() => statusData.value?.days_remaining ?? 90);

const currentCefrIndex = computed(() => {
  const lvl = (statusData.value?.current_level || userLevel.value || 'A1').toUpperCase();
  const idx = CEFR_LEVELS.indexOf(lvl as any);
  return idx >= 0 ? idx : 0;
});

const latestEvolution = computed(() => {
  if (statusData.value?.last_exam_evolution) {
    return statusData.value.last_exam_evolution;
  }
  if (historyList.value.length > 0) {
    const h = historyList.value[0];
    return {
      score: h.score,
      level: h.level,
      total_questions: h.total_questions || h.corrections?.length || 0,
      completed_at: h.completed_at,
      summary: h.feedback || h.summary_feedback,
      can_do_statements: h.can_do_statements,
      points_to_improve: h.points_to_improve,
    };
  }
  return null;
});

async function loadData() {
  isLoading.value = true;
  try {
    const [st, hist] = await Promise.all([
      getExamStatus().catch(() => null),
      getExamHistory().catch(() => []),
    ]);
    statusData.value = st;
    historyList.value = Array.isArray(hist) ? hist : [];
  } catch (err) {
    console.error('Failed to load exams dashboard data:', err);
  } finally {
    isLoading.value = false;
  }
}

function handleStartExam() {
  router.push('/exams/doing');
}

function handleReviewPast(item: ExamHistoryItem) {
  router.push({ path: '/exams/doing', query: { review_id: item.id } });
}

async function handleResetDev() {
  if (!confirm('Deseja resetar o ciclo do exame para testar imediatamente? (Função de Dev)')) return;
  isResetting.value = true;
  try {
    await resetExam();
    toast.success('Ciclo de exame resetado com sucesso!');
    await loadData();
  } catch (err: any) {
    toast.error(err?.message || 'Erro ao resetar exame.');
  } finally {
    isResetting.value = false;
  }
}

function formatDate(iso?: string | null) {
  if (!iso) return '--/--/----';
  try {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  } catch {
    return iso;
  }
}

onMounted(() => {
  loadData();
});
</script>

<template>
  <div class="flex-1 max-w-6xl w-full mx-auto p-4 md:p-8 space-y-6 animate-fade-in text-text">
    <!-- Top Header -->
    <header class="flex flex-col sm:flex-row sm:items-end justify-between gap-4">
      <div>
        <div class="flex items-center gap-2 text-xs font-bold text-primary uppercase tracking-wider mb-1">
          <GraduationCap class="w-4 h-4" />
          <span>Taty's Exams</span>
        </div>
        <h1 class="text-2xl md:text-3xl font-display font-bold text-text">Trimestral Exam</h1>
        <p class="text-xs text-text-muted mt-0.5">
          Quarterly CEFR diagnostic assessment with personalized feedback by Teacher Tatiana.
        </p>
      </div>

      <div class="flex items-center gap-2 flex-wrap">
        <span
          v-if="!isLoading && !canStart"
          class="px-4 py-2 rounded-full bg-surface border border-border text-xs font-semibold text-text-muted flex items-center gap-2"
        >
          <Clock class="w-3.5 h-3.5 text-primary" />
          <span>Next exam in <strong class="text-text">{{ daysRemaining }} days</strong></span>
        </span>

        <button
          v-if="isStaff"
          type="button"
          @click="handleResetDev"
          :disabled="isResetting"
          class="px-3 py-1.5 rounded-xl border border-border bg-surface hover:bg-surface-hover text-xs font-bold text-text-muted hover:text-text flex items-center gap-1.5 transition-all cursor-pointer"
          title="Reset exam cycle for testing"
        >
          <RotateCcw class="w-3.5 h-3.5" :class="{ 'animate-spin': isResetting }" />
          <span>Reset (Dev)</span>
        </button>
      </div>
    </header>

    <!-- CEFR Journey Roadmap -->
    <section v-if="!isLoading" class="bg-surface border border-border rounded-3xl p-6 md:p-8 shadow-xs">
      <div class="flex items-center justify-between text-xs font-bold uppercase tracking-wider mb-4">
        <span class="text-text-muted flex items-center gap-1.5">
          <TrendingUp class="w-3.5 h-3.5 text-primary" /> CEFR Journey
        </span>
        <span class="text-primary">
          You are here: Level {{ statusData?.current_level || userLevel || 'A1' }}
        </span>
      </div>

      <ol class="grid grid-cols-6 gap-2">
        <li v-for="(lvl, idx) in CEFR_LEVELS" :key="lvl" class="space-y-2">
          <div class="h-2 rounded-full bg-bg-secondary overflow-hidden">
            <div
              class="h-full rounded-full bg-primary transition-all duration-500"
              :style="{
                width: idx < currentCefrIndex ? '100%' : idx === currentCefrIndex ? `${latestEvolution?.score || 60}%` : '0%'
              }"
            />
          </div>
          <span
            class="block text-xs font-bold"
            :class="idx === currentCefrIndex ? 'text-primary' : 'text-text-muted'"
          >
            {{ lvl }}
            <span v-if="idx === currentCefrIndex && latestEvolution?.score">
              · {{ latestEvolution.score }}%
            </span>
          </span>
        </li>
      </ol>
    </section>

    <!-- Action Card (Start or Resume Exam vs Locked) -->
    <div v-if="isLoading" class="h-48 bg-surface border border-border rounded-3xl animate-pulse flex items-center justify-center">
      <span class="text-xs text-text-muted font-bold">Loading quarterly exam status...</span>
    </div>

    <!-- Active State: Ready or In Progress -->
    <section
      v-else-if="canStart"
      class="bg-gradient-to-br from-primary to-primary-hover text-white rounded-3xl p-6 md:p-8 shadow-md"
    >
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
        <div class="space-y-4 max-w-2xl">
          <span class="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-wider bg-white/15 rounded-full px-3 py-1.5">
            <Clock v-if="isResume" class="w-3.5 h-3.5" />
            <Sparkles v-else class="w-3.5 h-3.5" />
            <span>{{ isResume ? 'In progress' : 'Ready for you' }}</span>
          </span>

          <div>
            <h2 class="text-2xl md:text-3xl font-extrabold text-white">
              {{ isResume ? 'Your exam is in progress. Pick up where you left off.' : 'See how far your English has come' }}
            </h2>
            <p class="text-sm text-white/85 mt-2 leading-relaxed">
              {{ isResume
                ? 'Your answers are saved. Continue to finish your exam, calibrate your CEFR level and earn your XP!'
                : `Your level ${statusData?.current_level || userLevel || 'A1'} quarterly assessment is ready. Answer adaptive questions and get pedagogical feedback directly from Teacher Tatiana.`
              }}
            </p>
          </div>

          <div class="flex flex-wrap gap-x-5 gap-y-2 text-xs font-semibold text-white/85">
            <span class="flex items-center gap-1.5"><Clock class="w-3.5 h-3.5" /> ~15 minutes</span>
            <span class="flex items-center gap-1.5"><BookOpen class="w-3.5 h-3.5" /> 5 core skills</span>
            <span class="flex items-center gap-1.5"><Headphones class="w-3.5 h-3.5" /> Audio & Speech</span>
          </div>
        </div>

        <button
          type="button"
          @click="handleStartExam"
          class="shrink-0 px-8 py-4 rounded-2xl bg-white text-primary font-bold text-sm hover:bg-white/90 transition-all shadow-md active:scale-95 flex items-center justify-center gap-2 cursor-pointer"
        >
          <span>{{ isResume ? 'Continue Quarterly Exam' : 'Start Quarterly Exam' }}</span>
          <ArrowRight class="w-4 h-4" />
        </button>
      </div>
    </section>

    <!-- Locked State: Countdown until next exam -->
    <section
      v-else
      class="bg-surface border border-border rounded-3xl p-6 md:p-8 flex flex-col md:flex-row items-center justify-between gap-6 shadow-xs"
    >
      <div class="flex items-center gap-5">
        <div class="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
          <Clock class="w-8 h-8" />
        </div>
        <div class="space-y-1">
          <span class="text-xs font-bold text-text-subtle uppercase tracking-wider block">Quarterly Exam Interval</span>
          <h2 class="text-lg md:text-xl font-bold text-text">
            Next exam unlocks in {{ daysRemaining }} days
          </h2>
          <p class="text-xs text-text-muted">
            Next Available Date: <strong class="text-text">{{ formatDate(statusData?.next_available_date) }}</strong>
          </p>
        </div>
      </div>

      <div class="text-center md:text-right shrink-0">
        <router-link
          to="/activities"
          class="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold transition-colors"
        >
          <BookOpen class="w-4 h-4" />
          <span>Practice Activities in the Meantime</span>
        </router-link>
      </div>
    </section>

    <!-- Latest Evolution & Demonstrated Competencies -->
    <section v-if="latestEvolution" class="grid grid-cols-1 md:grid-cols-3 gap-6">
      <div class="bg-surface border border-border rounded-3xl p-6 flex flex-col items-center justify-center text-center gap-3 shadow-xs">
        <div class="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center text-2xl font-black">
          🏆
        </div>
        <div>
          <span class="text-3xl font-black text-text">{{ latestEvolution.score }}%</span>
          <p class="text-xs font-bold text-text-subtle uppercase tracking-wider mt-0.5">Last Exam Score</p>
        </div>
        <span class="text-xs font-bold text-primary px-3 py-1 bg-primary/10 rounded-full">
          Level {{ latestEvolution.level }}
        </span>
      </div>

      <div class="md:col-span-2 bg-surface border border-border rounded-3xl p-6 space-y-4 shadow-xs">
        <div class="flex items-center gap-2 text-primary font-bold text-sm">
          <BookmarkCheck class="w-4 h-4" />
          <h2>Latest Pedagogical Evaluation</h2>
        </div>

        <p v-if="latestEvolution.summary" class="text-xs text-text leading-relaxed bg-bg p-4 rounded-2xl border border-border/60 italic">
          "{{ latestEvolution.summary }}"
        </p>

        <div v-if="latestEvolution.can_do_statements && latestEvolution.can_do_statements.length > 0" class="space-y-2 pt-2">
          <span class="text-[0.65rem] font-bold text-text-muted uppercase tracking-wider block">Demonstrated Competencies:</span>
          <div class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div
              v-for="(stmt, i) in latestEvolution.can_do_statements.slice(0, 4)"
              :key="i"
              class="text-xs p-2.5 bg-bg-secondary/40 border border-border rounded-xl flex items-start gap-2"
            >
              <CheckCircle2 class="w-3.5 h-3.5 text-success shrink-0 mt-0.5" />
              <span class="text-text leading-tight">{{ stmt }}</span>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- Historical Exams List -->
    <section class="bg-surface border border-border rounded-3xl p-6 md:p-8 space-y-4 shadow-xs">
      <div class="flex items-center justify-between">
        <div class="flex items-center gap-2 text-primary font-bold text-base">
          <HistoryIcon class="w-4 h-4" />
          <h2>Exam History</h2>
        </div>
        <span class="text-xs text-text-muted">{{ historyList.length }} completed exams</span>
      </div>

      <div v-if="historyList.length === 0" class="text-center py-12 border border-dashed border-border rounded-2xl space-y-2">
        <GraduationCap class="w-8 h-8 mx-auto text-text-subtle" />
        <p class="text-xs text-text-muted">No quarterly exams completed yet.</p>
      </div>

      <div v-else class="space-y-3">
        <div
          v-for="item in historyList"
          :key="item.id"
          class="p-4 rounded-2xl bg-bg border border-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 hover:border-primary/40 transition-all"
        >
          <div class="flex items-center gap-3.5">
            <div class="w-10 h-10 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold text-sm shrink-0">
              {{ item.level }}
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="text-sm font-bold text-text">Quarterly Exam - Level {{ item.level }}</h3>
                <span
                  class="px-2 py-0.5 rounded-md text-[0.65rem] font-bold"
                  :class="item.passed ? 'bg-success/15 text-success' : 'bg-warning/15 text-warning'"
                >
                  {{ item.passed ? 'Passed' : 'Completed' }}
                </span>
              </div>
              <p class="text-xs text-text-muted mt-0.5">
                Completed on {{ formatDate(item.completed_at) }} • Score: <strong class="text-text">{{ item.score }}%</strong>
              </p>
            </div>
          </div>

          <button
            type="button"
            @click="handleReviewPast(item)"
            class="px-4 py-2 rounded-xl border border-border bg-surface hover:bg-surface-hover text-xs font-bold text-text hover:text-primary transition-colors flex items-center gap-1.5 cursor-pointer self-end sm:self-auto"
          >
            <span>Review Exam</span>
            <ChevronRight class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
