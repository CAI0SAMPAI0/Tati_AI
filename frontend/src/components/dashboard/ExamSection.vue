<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import {
  Search,
  CheckCircle2,
  XCircle,
  Sparkles,
  RefreshCw,
  RotateCcw,
  Trash2,
  Eye,
  Play,
  Pause,
  BookOpen,
  Volume2,
  Mic,
  Check,
  Edit3,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Award,
  AlertCircle,
  Lightbulb,
  Layers,
  FileText,
  UserCheck,
  Wand2,
  X,
  Clock,
  Sliders,
  Save,
  GraduationCap,
  MessageSquare,
} from 'lucide-vue-next';
import { apiGet, apiPost, apiPatch } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { getTtsAudio } from '@/api/exams';
import { useToast } from '@/composables/useToast';
import { DEFAULT_AVATAR_URL } from '@/constants/user';
import ExamIcon from '@/components/icons/ExamIcon.vue';

const toast = useToast();

const LEVELS = ['ALL', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
type LevelFilter = (typeof LEVELS)[number];
type WorkspaceTab = 'questions' | 'answers' | 'activities';

const selectedLevel = ref<LevelFilter>('ALL');
const searchQuery = ref('');
const isLoadingOverview = ref(true);
const isLoadingStudent = ref(false);
const isSyncingPlaywright = ref(false);
const isGeneratingExam = ref(false);
const isBulkApproving = ref(false);
const isResettingExam = ref(false);
const isResetModalOpen = ref(false);

const levelCounts = ref<Record<string, number>>({
  ALL: 0,
  A1: 0,
  A2: 0,
  B1: 0,
  B2: 0,
  C1: 0,
  C2: 0,
});

const overviewSummary = ref({
  filtered_students: 0,
  pending_review_exams: 0,
  approved_exams: 0,
  completed_exams: 0,
});

const studentsList = ref<any[]>([]);
const selectedUsername = ref<string | null>(null);
const studentDetail = ref<any | null>(null);
const activeTab = ref<WorkspaceTab>('questions');
const selectedCompletedExamIdx = ref(0);

// Status loading & TTS
const statusLoadingByQuestion = ref<Record<string, boolean>>({});
const playingAudioQId = ref<string | null>(null);
const audioPlayer = ref<HTMLAudioElement | null>(null);

// Modal AI Improve
const aiModalQuestion = ref<any | null>(null);
const aiModalSuggestion = ref('');
const isAiImproving = ref(false);

// Modal Manual Edit
const manualModalQuestion = ref<any | null>(null);
const manualDraft = ref<any>({});
const isSavingManual = ref(false);

// Teacher Grading State
const isSavingTeacherGrade = ref(false);
const teacherGradeForm = ref({
  hasCustomScore: false,
  score: 70,
  feedback: '',
  passed: true,
});
const teacherQuestionComments = ref<Record<string, string>>({});
const isSavingQuestionComment = ref<Record<string, boolean>>({});

const QUICK_AI_SUGGESTIONS = [
  'Simplificar o vocabulário e a estrutura frasal para este nível',
  'Mudar o contexto para cotidiano, família, trabalho ou viagens',
  'Tornar as alternativas incorretas mais claras e sem ambiguidade',
  'Alinhar a questão mais diretamente com as atividades feitas pelo aluno',
];

const filteredStudents = computed(() => {
  const q = searchQuery.value.trim().toLowerCase();
  if (!q) return studentsList.value;
  return studentsList.value.filter(
    (s) =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.username || '').toLowerCase().includes(q) ||
      (s.email || '').toLowerCase().includes(q)
  );
});

const activeExam = computed(() => studentDetail.value?.active_exam || null);
const completedExams = computed<any[]>(() => studentDetail.value?.completed_exams || []);

const answerableExams = computed<any[]>(() => {
  const list: any[] = [];
  if (activeExam.value && (activeExam.value.answered_count || 0) > 0) {
    list.push({
      ...activeExam.value,
      is_in_progress_preview: true,
    });
  }
  for (const ce of completedExams.value) {
    list.push(ce);
  }
  return list;
});

const selectedAnsweredExam = computed(() => {
  if (!answerableExams.value.length) return null;
  const idx = Math.min(selectedCompletedExamIdx.value, answerableExams.value.length - 1);
  return answerableExams.value[Math.max(0, idx)] || null;
});

const completedActivities = computed<any[]>(() => studentDetail.value?.completed_activities || []);

watch(
  selectedAnsweredExam,
  (exam) => {
    if (exam) {
      const hasTeacherScore = exam.teacher_score !== undefined && exam.teacher_score !== null;
      teacherGradeForm.value = {
        hasCustomScore: hasTeacherScore,
        score: hasTeacherScore ? Number(exam.teacher_score) : (exam.ai_score ?? exam.score ?? 70),
        feedback: exam.teacher_feedback || '',
        passed: exam.passed ?? true,
      };

      const qComments: Record<string, string> = {};
      if (exam.teacher_question_comments && typeof exam.teacher_question_comments === 'object') {
        Object.assign(qComments, exam.teacher_question_comments);
      }
      if (Array.isArray(exam.corrections)) {
        exam.corrections.forEach((c: any, idx: number) => {
          const qId = String(c.question_id || `q${idx + 1}`);
          if (c.teacher_comment && !qComments[qId]) {
            qComments[qId] = c.teacher_comment;
          }
        });
      }
      teacherQuestionComments.value = qComments;
    }
  },
  { immediate: true }
);

function countWords(text?: string | null): number {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function getModalityBadge(type?: string) {
  const t = (type || '').toLowerCase();
  if (t === 'reading') return { label: 'Reading', color: 'bg-blue-500/10 text-blue-500 border-blue-500/25', icon: BookOpen };
  if (t === 'grammar') return { label: 'Grammar', color: 'bg-purple-500/10 text-purple-500 border-purple-500/25', icon: FileText };
  if (t === 'vocabulary') return { label: 'Vocabulary', color: 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25', icon: Sparkles };
  if (t === 'listening') return { label: 'Listening', color: 'bg-cyan-500/10 text-cyan-500 border-cyan-500/25', icon: HeadphonesIcon };
  if (t === 'writing') return { label: 'Writing', color: 'bg-amber-500/10 text-amber-500 border-amber-500/25', icon: Edit3 };
  if (t === 'speaking') return { label: 'Speaking', color: 'bg-rose-500/10 text-rose-500 border-rose-500/25', icon: Mic };
  return { label: type || 'Question', color: 'bg-primary/10 text-primary border-primary/25', icon: FileText };
}

// Headphones icon fallback
const HeadphonesIcon = Volume2;

async function loadOverview(preserveSelection = true) {
  isLoadingOverview.value = true;
  try {
    const params = new URLSearchParams();
    if (selectedLevel.value !== 'ALL') {
      params.set('level', selectedLevel.value);
    }
    const qs = params.toString();
    const url = qs ? `${ENDPOINTS.DASHBOARD_EXAMS_OVERVIEW}?${qs}` : ENDPOINTS.DASHBOARD_EXAMS_OVERVIEW;
    const res = await apiGet<any>(url);
    levelCounts.value = res.level_counts || levelCounts.value;
    overviewSummary.value = res.summary || overviewSummary.value;
    studentsList.value = res.students || [];

    if (studentsList.value.length > 0) {
      const stillExists =
        preserveSelection &&
        selectedUsername.value &&
        studentsList.value.some((s: any) => s.username === selectedUsername.value);
      const nextUser = stillExists ? selectedUsername.value! : studentsList.value[0].username;
      await selectStudent(nextUser);
    } else {
      selectedUsername.value = null;
      studentDetail.value = null;
    }
  } catch (err: any) {
    toast.error(err?.message || 'Erro ao carregar exames.');
  } finally {
    isLoadingOverview.value = false;
  }
}

async function selectStudent(username: string, preferredTab?: WorkspaceTab) {
  selectedUsername.value = username;
  isLoadingStudent.value = true;
  selectedCompletedExamIdx.value = 0;
  try {
    const detail = await apiGet<any>(ENDPOINTS.DASHBOARD_EXAMS_STUDENT(username));
    studentDetail.value = detail;
    if (preferredTab) {
      activeTab.value = preferredTab;
    } else if (detail.completed_exams && detail.completed_exams.length > 0) {
      activeTab.value = 'answers';
    } else if (detail.active_exam) {
      activeTab.value = 'questions';
    } else {
      activeTab.value = 'questions';
    }
  } catch (err: any) {
    toast.error(err?.message || 'Erro ao carregar detalhes do estudante.');
  } finally {
    isLoadingStudent.value = false;
  }
}

function handleChangeLevel(lvl: LevelFilter) {
  if (selectedLevel.value === lvl) return;
  selectedLevel.value = lvl;
  loadOverview(false);
}

function syncStudentRowInList(detail: any) {
  if (!detail?.student?.username) return;
  const idx = studentsList.value.findIndex((s) => s.username === detail.student.username);
  if (idx !== -1) {
    const completedList = detail.completed_exams || [];
    const latest = completedList.length > 0 ? completedList[0] : null;
    studentsList.value[idx] = {
      ...studentsList.value[idx],
      completed_activities_summary: detail.completed_activities_summary,
      active_exam: detail.active_exam,
      completed_exams_count: completedList.length,
      latest_completed_exam: latest
        ? {
            id: latest.id,
            level: latest.level,
            score: latest.score,
            passed: latest.passed,
            completed_at: latest.completed_at,
          }
        : null,
    };
  }
}

async function handleSyncPlaywright(forceRefresh = false) {
  if (!selectedUsername.value || isSyncingPlaywright.value) return;
  isSyncingPlaywright.value = true;
  try {
    const res = await apiPost<any>(ENDPOINTS.DASHBOARD_EXAMS_SYNC_ACTIVITIES(selectedUsername.value), {
      force_refresh: forceRefresh,
    });
    studentDetail.value = res;
    syncStudentRowInList(res);
    const newly = res.sync_result?.newly_scraped ?? 0;
    const total = res.sync_result?.total_scraped ?? 0;
    toast.success(
      newly > 0
        ? `Playwright extraiu ${newly} nova(s) atividade(s)! (${total} salvas no banco)`
        : `Todas as ${total} atividades de Grammar a Reading estão verificadas no banco.`
    );
  } catch (err: any) {
    toast.error(err?.message || 'Erro ao sincronizar com Playwright.');
  } finally {
    isSyncingPlaywright.value = false;
  }
}

async function handleGenerateExam() {
  if (!selectedUsername.value || isGeneratingExam.value) return;
  isGeneratingExam.value = true;
  try {
    const res = await apiPost<any>(ENDPOINTS.DASHBOARD_EXAMS_GENERATE(selectedUsername.value), {
      num_questions: 10,
    });
    studentDetail.value = res;
    syncStudentRowInList(res);
    activeTab.value = 'questions';
    toast.success(`Novo exame nível ${res.student?.level} gerado com base nas atividades do aluno!`);
  } catch (err: any) {
    toast.error(err?.message || 'Não foi possível gerar o exame.');
  } finally {
    isGeneratingExam.value = false;
  }
}

async function handleResetExam(mode: 'reopen' | 'clear_all' | 'delete_one', examId?: string) {
  if (!selectedUsername.value || isResettingExam.value) return;
  if (mode === 'delete_one' && !confirm('Excluir esta tentativa específica do exame?')) return;

  isResettingExam.value = true;
  try {
    const res = await apiPost<any>(ENDPOINTS.DASHBOARD_EXAMS_RESET(selectedUsername.value), {
      mode,
      exam_id: examId || undefined,
    });
    studentDetail.value = res;
    syncStudentRowInList(res);
    isResetModalOpen.value = false;
    selectedCompletedExamIdx.value = 0;

    if (mode === 'reopen') {
      activeTab.value = 'questions';
      toast.success('Exame reaberto! O aluno já pode refazê-lo com as questões atuais.');
    } else if (mode === 'delete_one') {
      toast.success('Tentativa de exame excluída.');
    } else {
      activeTab.value = 'questions';
      toast.success('Ciclo de exames do aluno resetado com sucesso.');
    }
  } catch (err: any) {
    toast.error(err?.message || 'Erro ao resetar exame.');
  } finally {
    isResettingExam.value = false;
  }
}

async function handleSetQuestionStatus(q: any, status: 'approved' | 'rejected' | 'pending') {
  if (!activeExam.value) return;
  statusLoadingByQuestion.value[q.id] = true;
  try {
    const res = await apiPatch<any>(
      ENDPOINTS.DASHBOARD_EXAMS_QUESTION_STATUS(activeExam.value.id, q.id),
      {
        approval_status: status,
        admin_notes: q.admin_notes || undefined,
      }
    );
    if (studentDetail.value && res.exam) {
      studentDetail.value.active_exam = res.exam;
      syncStudentRowInList(studentDetail.value);
    }
    toast.success(
      status === 'approved'
        ? `Questão ${q.id.toUpperCase()} aprovada!`
        : status === 'rejected'
        ? `Questão ${q.id.toUpperCase()} marcada para ajuste.`
        : `Questão ${q.id.toUpperCase()} pendente.`
    );
  } catch (err: any) {
    toast.error(err?.message || 'Erro ao atualizar status da questão.');
  } finally {
    statusLoadingByQuestion.value[q.id] = false;
  }
}

async function handleApproveAll() {
  if (!activeExam.value || isBulkApproving.value) return;
  isBulkApproving.value = true;
  try {
    const res = await apiPost<any>(ENDPOINTS.DASHBOARD_EXAMS_APPROVE_ALL(activeExam.value.id), {
      approval_status: 'approved',
    });
    if (studentDetail.value && res.exam) {
      studentDetail.value.active_exam = res.exam;
      syncStudentRowInList(studentDetail.value);
    }
    toast.success('Todas as 10 questões foram aprovadas!');
  } catch (err: any) {
    toast.error(err?.message || 'Erro ao aprovar questões em lote.');
  } finally {
    isBulkApproving.value = false;
  }
}

// Open AI modal
function openAiModal(q: any) {
  aiModalQuestion.value = q;
  aiModalSuggestion.value = '';
}

async function handleExecuteAiImprovement() {
  if (!activeExam.value || !aiModalQuestion.value) return;
  const suggestion = aiModalSuggestion.value.trim();
  if (!suggestion) {
    toast.error('Informe o que a IA deve ajustar nesta questão.');
    return;
  }

  isAiImproving.value = true;
  try {
    const res = await apiPost<any>(
      ENDPOINTS.DASHBOARD_EXAMS_AI_IMPROVE(activeExam.value.id, aiModalQuestion.value.id),
      { suggestion }
    );
    if (studentDetail.value && res.exam) {
      studentDetail.value.active_exam = res.exam;
      syncStudentRowInList(studentDetail.value);
    }
    toast.success(`Questão ${aiModalQuestion.value.id.toUpperCase()} atualizada pela IA!`);
    aiModalQuestion.value = null;
  } catch (err: any) {
    toast.error(err?.message || 'Não foi possível atualizar a questão com IA.');
  } finally {
    isAiImproving.value = false;
  }
}

// Open manual edit modal
function openManualModal(q: any) {
  manualModalQuestion.value = q;
  manualDraft.value = {
    question: q.question || '',
    reading_text: q.reading_text || '',
    audio_text: q.audio_text || '',
    options: Array.isArray(q.options) ? [...q.options] : [],
    correct_answer: q.correct_answer || '',
    explanation: q.explanation || '',
  };
}

async function handleExecuteManualSave() {
  if (!activeExam.value || !manualModalQuestion.value) return;
  isSavingManual.value = true;
  try {
    const res = await apiPatch<any>(
      ENDPOINTS.DASHBOARD_EXAMS_QUESTION_EDIT(activeExam.value.id, manualModalQuestion.value.id),
      manualDraft.value
    );
    if (studentDetail.value && res.exam) {
      studentDetail.value.active_exam = res.exam;
      syncStudentRowInList(studentDetail.value);
    }
    toast.success(`Questão ${manualModalQuestion.value.id.toUpperCase()} salva com sucesso!`);
    manualModalQuestion.value = null;
  } catch (err: any) {
    toast.error(err?.message || 'Erro ao salvar alterações da questão.');
  } finally {
    isSavingManual.value = false;
  }
}

function applyUpdatedExam(examId: string, updatedExam: any) {
  const cList = studentDetail.value?.completed_exams || [];
  const idx = cList.findIndex((e: any) => e.id === examId);
  if (idx !== -1) {
    cList[idx] = updatedExam;
  }
  if (studentDetail.value?.active_exam?.id === examId) {
    studentDetail.value.active_exam = updatedExam;
  }
  syncStudentRowInList(studentDetail.value);
}

// Teacher Grading (Geral + Notas + Todas as Questões)
async function handleSaveTeacherGrade() {
  if (!selectedAnsweredExam.value) return;
  const examId = selectedAnsweredExam.value.id || selectedAnsweredExam.value.exam_id;
  if (!examId) return;

  isSavingTeacherGrade.value = true;
  try {
    const res = await apiPost<any>(ENDPOINTS.DASHBOARD_EXAMS_GRADE(examId), {
      teacher_score: teacherGradeForm.value.hasCustomScore ? Number(teacherGradeForm.value.score) : null,
      clear_score: !teacherGradeForm.value.hasCustomScore,
      teacher_feedback: teacherGradeForm.value.feedback,
      passed: Boolean(teacherGradeForm.value.passed),
      question_comments: teacherQuestionComments.value,
    });
    if (res.exam) {
      applyUpdatedExam(examId, res.exam);
    }
    toast.success('Avaliação da professora salva com sucesso!');
  } catch (err: any) {
    toast.error(err?.message || 'Erro ao salvar avaliação da professora.');
  } finally {
    isSavingTeacherGrade.value = false;
  }
}

// Salvar comentário específico de uma única questão
async function handleSaveSingleQuestionComment(qId: string) {
  if (!selectedAnsweredExam.value) return;
  const examId = selectedAnsweredExam.value.id || selectedAnsweredExam.value.exam_id;
  if (!examId) return;

  isSavingQuestionComment.value[qId] = true;
  try {
    const payloadComment = teacherQuestionComments.value[qId] || '';
    const res = await apiPost<any>(ENDPOINTS.DASHBOARD_EXAMS_GRADE(examId), {
      question_comments: {
        [qId]: payloadComment,
      },
    });
    if (res.exam) {
      applyUpdatedExam(examId, res.exam);
    }
    if (payloadComment.trim()) {
      toast.success(`Comentário da questão ${qId} salvo!`);
    } else {
      toast.success(`Comentário da questão ${qId} removido!`);
    }
  } catch (err: any) {
    toast.error(err?.message || 'Erro ao salvar comentário da questão.');
  } finally {
    isSavingQuestionComment.value[qId] = false;
  }
}

// Apagar comentário específico de uma única questão
async function handleDeleteQuestionComment(qId: string) {
  teacherQuestionComments.value[qId] = '';
  await handleSaveSingleQuestionComment(qId);
}

async function handlePlayAudio(keyId: string, audioText?: string | null, rawAudioBase64?: string | null) {
  if (playingAudioQId.value === keyId && audioPlayer.value) {
    audioPlayer.value.pause();
    playingAudioQId.value = null;
    return;
  }

  if (rawAudioBase64) {
    if (audioPlayer.value) audioPlayer.value.pause();
    const src = rawAudioBase64.startsWith('data:audio') ? rawAudioBase64 : `data:audio/webm;base64,${rawAudioBase64}`;
    audioPlayer.value = new Audio(src);
    playingAudioQId.value = keyId;
    audioPlayer.value.onended = () => { playingAudioQId.value = null; };
    await audioPlayer.value.play();
    return;
  }

  if (!audioText) return;
  try {
    const tts = await getTtsAudio(audioText, 'en-US');
    if (!tts?.audio_b64) {
      toast.error('Prévia de áudio indisponível.');
      return;
    }
    if (audioPlayer.value) audioPlayer.value.pause();
    audioPlayer.value = new Audio(`data:audio/mp3;base64,${tts.audio_b64}`);
    playingAudioQId.value = keyId;
    audioPlayer.value.onended = () => { playingAudioQId.value = null; };
    await audioPlayer.value.play();
  } catch {
    playingAudioQId.value = null;
    toast.error('Erro ao reproduzir áudio.');
  }
}

onMounted(() => {
  loadOverview(false);
});

onUnmounted(() => {
  if (audioPlayer.value) {
    audioPlayer.value.pause();
    audioPlayer.value = null;
  }
});
</script>

<template>
  <div class="space-y-6">
    <!-- 1. CLEAN TOP HEADER & METRIC CARDS -->
    <div class="space-y-4">
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 class="text-xl md:text-2xl font-black text-text tracking-tight flex items-center gap-2.5">
            <span class="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
              <ExamIcon class="w-4 h-4" />
            </span>
            <span>Exames Trimestrais</span>
          </h2>
          <p class="text-xs text-text-muted mt-0.5">
            Revisão de questões com IA, sincronização Playwright e avaliação da professora.
          </p>
        </div>

        <div class="flex items-center gap-2">
          <!-- Search Input -->
          <div class="relative w-64 sm:w-72">
            <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Buscar aluno ou @username..."
              class="w-full pl-9 pr-3 py-2 bg-surface border border-border rounded-xl text-xs text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all shadow-2xs"
            />
          </div>

          <button
            type="button"
            @click="loadOverview(true)"
            class="p-2.5 rounded-xl bg-surface border border-border text-text-muted hover:text-primary hover:border-primary/40 transition-colors cursor-pointer shadow-2xs"
            title="Atualizar listagem"
          >
            <RefreshCw class="w-4 h-4" :class="isLoadingOverview ? 'animate-spin text-primary' : ''" />
          </button>
        </div>
      </div>

      <!-- 4 Compact Stat Cards -->
      <div class="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div class="p-3.5 bg-surface border border-border rounded-2xl shadow-2xs flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-bg-secondary flex items-center justify-center text-text-muted shrink-0">
            <UserCheck class="w-4 h-4" />
          </div>
          <div>
            <span class="text-[0.68rem] font-bold text-text-muted uppercase tracking-wider block">Alunos</span>
            <span class="text-lg font-black text-text">{{ overviewSummary.filtered_students }}</span>
          </div>
        </div>

        <div class="p-3.5 bg-surface border border-border rounded-2xl shadow-2xs flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center shrink-0">
            <Clock class="w-4 h-4" />
          </div>
          <div>
            <span class="text-[0.68rem] font-bold text-amber-500 uppercase tracking-wider block">Pendente Revisão</span>
            <span class="text-lg font-black text-text">{{ overviewSummary.pending_review_exams }}</span>
          </div>
        </div>

        <div class="p-3.5 bg-surface border border-border rounded-2xl shadow-2xs flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-success/10 text-success flex items-center justify-center shrink-0">
            <CheckCircle2 class="w-4 h-4" />
          </div>
          <div>
            <span class="text-[0.68rem] font-bold text-success uppercase tracking-wider block">Exames Aprovados</span>
            <span class="text-lg font-black text-text">{{ overviewSummary.approved_exams }}</span>
          </div>
        </div>

        <div class="p-3.5 bg-surface border border-border rounded-2xl shadow-2xs flex items-center gap-3">
          <div class="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
            <GraduationCap class="w-4 h-4" />
          </div>
          <div>
            <span class="text-[0.68rem] font-bold text-primary uppercase tracking-wider block">Entregues / Feitos</span>
            <span class="text-lg font-black text-text">{{ overviewSummary.completed_exams }}</span>
          </div>
        </div>
      </div>

      <!-- CEFR Level Pills -->
      <div class="flex items-center gap-1.5 overflow-x-auto py-1 custom-scrollbar">
        <button
          v-for="lvl in LEVELS"
          :key="lvl"
          type="button"
          @click="handleChangeLevel(lvl)"
          class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 shrink-0 border"
          :class="
            selectedLevel === lvl
              ? 'bg-primary text-white border-primary shadow-xs'
              : 'bg-surface border-border text-text-muted hover:text-primary hover:border-primary/40'
          "
        >
          <span>{{ lvl === 'ALL' ? 'Todos os Níveis' : lvl }}</span>
          <span
            class="text-[0.62rem] px-1.5 py-0.2 rounded-full font-bold"
            :class="selectedLevel === lvl ? 'bg-white/20 text-white' : 'bg-bg-secondary text-text-muted'"
          >
            {{ levelCounts[lvl] ?? 0 }}
          </span>
        </button>
      </div>
    </div>

    <!-- 2. TWO-COLUMN WORKSPACE: Clean & Structured -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      <!-- LEFT: Students Sidebar -->
      <div class="lg:col-span-4 bg-surface border border-border rounded-2xl overflow-hidden shadow-xs flex flex-col lg:h-[76vh]">
        <div class="px-4 py-3 border-b border-border bg-bg-secondary/30 flex items-center justify-between shrink-0">
          <span class="text-xs font-bold uppercase tracking-wider text-text-muted">
            Estudantes ({{ filteredStudents.length }})
          </span>
          <span v-if="selectedLevel !== 'ALL'" class="text-[0.65rem] font-black px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            {{ selectedLevel }}
          </span>
        </div>

        <div v-if="isLoadingOverview" class="p-8 text-center space-y-2 flex-1 flex flex-col items-center justify-center">
          <div class="w-7 h-7 mx-auto rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <p class="text-xs text-text-muted">Carregando alunos...</p>
        </div>

        <div v-else-if="filteredStudents.length === 0" class="p-8 text-center text-xs text-text-muted flex-1 flex items-center justify-center">
          Nenhum estudante encontrado neste filtro.
        </div>

        <div v-else class="flex-1 min-h-0 overflow-y-auto divide-y divide-border/60 custom-scrollbar">
          <div
            v-for="stu in filteredStudents"
            :key="stu.username"
            @click="selectStudent(stu.username)"
            class="w-full p-3.5 text-left transition-all cursor-pointer flex items-center gap-3 hover:bg-bg-secondary/40"
            :class="selectedUsername === stu.username ? 'bg-primary/8 border-l-4 border-l-primary' : ''"
          >
            <!-- Avatar -->
            <div class="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0 overflow-hidden">
              <img
                v-if="stu.avatar_url && stu.avatar_url !== DEFAULT_AVATAR_URL"
                :src="stu.avatar_url"
                :alt="stu.name"
                class="w-full h-full object-cover"
                referrerpolicy="no-referrer"
                @error="(e: any) => { e.currentTarget.style.display = 'none'; }"
              />
              <span v-else>{{ (stu.name || stu.username || '?').charAt(0).toUpperCase() }}</span>
            </div>

            <!-- Info -->
            <div class="min-w-0 flex-1 space-y-1">
              <div class="flex items-center justify-between gap-1.5">
                <span class="text-xs font-bold text-text truncate">{{ stu.name || stu.username }}</span>
                <span class="text-[0.62rem] font-black px-2 py-0.5 rounded-full bg-primary/10 text-primary shrink-0">
                  {{ stu.level }}
                </span>
              </div>

              <div class="text-[0.65rem] text-text-muted truncate">@{{ stu.username }}</div>

              <!-- Status badge -->
              <div class="flex items-center gap-1.5 pt-0.5">
                <span
                  v-if="stu.completed_exams_count > 0"
                  class="text-[0.6rem] font-bold px-2 py-0.5 rounded-md bg-primary/10 text-primary border border-primary/20 flex items-center gap-1"
                >
                  <Award class="w-2.5 h-2.5" />
                  <span>{{ stu.completed_exams_count }} concluído(s) • {{ stu.latest_completed_exam?.score }}%</span>
                </span>
                <span
                  v-else-if="stu.active_exam"
                  class="text-[0.6rem] font-bold px-2 py-0.5 rounded-md border"
                  :class="stu.active_exam.approval_summary?.overall_status === 'approved' ? 'bg-success/10 text-success border-success/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'"
                >
                  {{ stu.active_exam.approval_summary?.overall_status === 'approved' ? '✓ Aprovado' : `${stu.active_exam.approval_summary?.approved}/10 Aprovadas` }}
                </span>
                <span v-else class="text-[0.6rem] text-text-subtle">Sem exame ativo</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT: Student Workspace -->
      <div class="lg:col-span-8 flex flex-col gap-4 lg:h-[76vh] min-h-0">
        <div
          v-if="isLoadingStudent"
          class="bg-surface border border-border rounded-2xl p-12 text-center space-y-3 flex-1 flex flex-col items-center justify-center shadow-xs"
        >
          <div class="w-8 h-8 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
          <p class="text-xs text-text-muted font-medium">Carregando exames e atividades do estudante...</p>
        </div>

        <div
          v-else-if="!studentDetail"
          class="bg-surface border border-border rounded-2xl p-12 text-center text-xs text-text-muted flex-1 flex items-center justify-center shadow-xs"
        >
          Selecione um aluno na coluna à esquerda para revisar questões, aplicar ajustes com IA ou lançar notas.
        </div>

        <template v-else>
          <!-- Modern Student Pinned Header -->
          <div class="bg-surface border border-border rounded-2xl p-4 md:p-5 shadow-xs space-y-3.5 shrink-0">
            <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div class="space-y-1">
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="text-base font-black text-text">
                    {{ studentDetail.student.name }}
                  </h3>
                  <span class="text-xs font-black px-2.5 py-0.5 rounded-full bg-primary text-white">
                    Nível {{ studentDetail.student.level }}
                  </span>
                  <span class="text-xs text-text-muted">@{{ studentDetail.student.username }}</span>
                </div>
                <p class="text-xs text-text-muted flex items-center gap-2 flex-wrap">
                  <span>Atividades feitas no nível {{ studentDetail.student.level }}:</span>
                  <span class="font-bold text-text">{{ studentDetail.completed_activities_summary.by_category.grammar }} Grammar</span> •
                  <span class="font-bold text-text">{{ studentDetail.completed_activities_summary.by_category.vocabulary }} Vocab</span> •
                  <span class="font-bold text-text">{{ studentDetail.completed_activities_summary.by_category.listening }} Listening</span> •
                  <span class="font-bold text-text">{{ studentDetail.completed_activities_summary.by_category.reading }} Reading</span>
                  <span class="text-[0.65rem] px-2 py-0.5 rounded-md bg-bg-secondary text-text-muted border border-border">
                    {{ studentDetail.completed_activities_summary.scraped_count }}/{{ studentDetail.completed_activities_summary.total }} salvas no banco
                  </span>
                </p>
              </div>

              <!-- Quick Actions Toolbar -->
              <div class="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  @click="handleGenerateExam"
                  :disabled="isGeneratingExam"
                  class="px-3.5 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover transition-all flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50"
                  title="Gera ou regenera o exame com IA baseado nas atividades que o aluno fez"
                >
                  <Sparkles class="w-3.5 h-3.5" :class="isGeneratingExam ? 'animate-spin' : ''" />
                  <span>{{ isGeneratingExam ? 'Gerando...' : 'Gerar Exame IA' }}</span>
                </button>

                <button
                  type="button"
                  @click="handleSyncPlaywright(false)"
                  :disabled="isSyncingPlaywright"
                  class="px-3 py-2 rounded-xl bg-surface border border-border text-xs font-bold text-text-muted hover:text-primary hover:border-primary/40 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50 shadow-2xs"
                  title="Executa o Playwright para extrair as atividades concluídas pelo aluno"
                >
                  <RefreshCw class="w-3.5 h-3.5" :class="isSyncingPlaywright ? 'animate-spin text-primary' : ''" />
                  <span>Playwright Sync</span>
                </button>

                <button
                  v-if="activeExam && activeExam.approval_summary?.overall_status !== 'approved'"
                  type="button"
                  @click="handleApproveAll"
                  :disabled="isBulkApproving"
                  class="px-3 py-2 rounded-xl bg-success/15 border border-success/30 text-xs font-bold text-success hover:bg-success/20 transition-all flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                >
                  <CheckCircle2 class="w-3.5 h-3.5" />
                  <span>Aprovar Todas</span>
                </button>

                <!-- Options / Reset -->
                <button
                  type="button"
                  @click="isResetModalOpen = true"
                  class="p-2 rounded-xl bg-surface border border-border text-text-muted hover:text-danger hover:border-danger/30 transition-colors cursor-pointer shadow-2xs"
                  title="Opções de Reset do Exame"
                >
                  <RotateCcw class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <!-- Segmented Modern Tabs -->
            <div class="flex items-center gap-1 bg-bg-secondary/40 p-1 rounded-xl border border-border/80">
              <button
                type="button"
                @click="activeTab = 'questions'"
                class="flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                :class="activeTab === 'questions' ? 'bg-surface text-primary shadow-xs' : 'text-text-muted hover:text-text'"
              >
                <FileText class="w-3.5 h-3.5" />
                <span>Questões do Exame</span>
                <span v-if="activeExam?.questions?.length" class="text-[0.65rem] px-1.5 py-0.2 rounded-full bg-primary/10 text-primary">
                  {{ activeExam.questions.length }}
                </span>
              </button>

              <button
                type="button"
                @click="activeTab = 'answers'"
                class="flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                :class="activeTab === 'answers' ? 'bg-surface text-primary shadow-xs' : 'text-text-muted hover:text-text'"
              >
                <Award class="w-3.5 h-3.5" />
                <span>Respostas &amp; Avaliação</span>
                <span v-if="answerableExams.length" class="text-[0.65rem] px-1.5 py-0.2 rounded-full bg-success/15 text-success">
                  {{ answerableExams.length }}
                </span>
              </button>

              <button
                type="button"
                @click="activeTab = 'activities'"
                class="flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-2"
                :class="activeTab === 'activities' ? 'bg-surface text-primary shadow-xs' : 'text-text-muted hover:text-text'"
              >
                <Layers class="w-3.5 h-3.5" />
                <span>Base Playwright</span>
                <span class="text-[0.65rem] px-1.5 py-0.2 rounded-full bg-bg border border-border text-text-subtle">
                  {{ completedActivities.length }}
                </span>
              </button>
            </div>
          </div>

          <!-- TAB 1: QUESTÕES DO EXAME (Clean Cards with Modals) -->
          <div v-if="activeTab === 'questions'" class="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
            <div v-if="!activeExam" class="p-12 bg-surface border border-border rounded-2xl text-center space-y-3">
              <Sparkles class="w-8 h-8 mx-auto text-primary/60" />
              <p class="text-sm font-bold text-text">Nenhum exame ativo para este aluno.</p>
              <p class="text-xs text-text-muted max-w-md mx-auto">
                Clique no botão "Gerar Exame IA" acima para sintetizar 10 questões personalizadas a partir das atividades concluídas.
              </p>
              <button
                type="button"
                @click="handleGenerateExam"
                class="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover shadow-xs cursor-pointer inline-flex items-center gap-2"
              >
                <Sparkles class="w-4 h-4" />
                <span>Gerar Exame Agora</span>
              </button>
            </div>

            <div v-else class="space-y-3">
              <div
                v-for="(q, idx) in activeExam.questions"
                :key="q.id"
                class="bg-surface border border-border rounded-2xl p-4 md:p-5 shadow-2xs space-y-3 transition-all hover:border-primary/30"
              >
                <!-- Question Top Row -->
                <div class="flex items-center justify-between gap-2 border-b border-border/50 pb-2.5">
                  <div class="flex items-center gap-2">
                    <span class="w-6 h-6 rounded-lg bg-primary/10 text-primary text-xs font-black flex items-center justify-center">
                      {{ idx + 1 }}
                    </span>
                    <span
                      class="text-[0.65rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded-md border flex items-center gap-1"
                      :class="getModalityBadge(q.type).color"
                    >
                      <component :is="getModalityBadge(q.type).icon" class="w-3 h-3" />
                      <span>{{ getModalityBadge(q.type).label }}</span>
                    </span>
                    <span class="text-[0.65rem] text-text-muted font-medium">
                      {{ q.points || 10 }} pts
                    </span>
                  </div>

                  <!-- Actions -->
                  <div class="flex items-center gap-1.5">
                    <button
                      type="button"
                      @click="openAiModal(q)"
                      class="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary/20 text-primary text-[0.7rem] font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                      title="Solicitar alterações pontuais à IA para esta questão"
                    >
                      <Wand2 class="w-3 h-3" />
                      <span>Ajustar com IA</span>
                    </button>

                    <button
                      type="button"
                      @click="openManualModal(q)"
                      class="px-2.5 py-1 rounded-lg bg-bg-secondary hover:bg-border text-text text-[0.7rem] font-bold transition-colors inline-flex items-center gap-1 cursor-pointer"
                      title="Editar enunciado, opções ou gabarito manualmente"
                    >
                      <Edit3 class="w-3 h-3" />
                      <span>Editar</span>
                    </button>

                    <!-- Approve Toggle -->
                    <button
                      type="button"
                      @click="handleSetQuestionStatus(q, q.approval_status === 'approved' ? 'pending' : 'approved')"
                      :disabled="statusLoadingByQuestion[q.id]"
                      class="px-2.5 py-1 rounded-lg text-[0.7rem] font-bold transition-all inline-flex items-center gap-1 cursor-pointer border"
                      :class="
                        q.approval_status === 'approved'
                          ? 'bg-success text-white border-success'
                          : 'bg-surface border-border text-text-muted hover:border-success/50 hover:text-success'
                      "
                    >
                      <Check class="w-3 h-3" />
                      <span>{{ q.approval_status === 'approved' ? 'Aprovada' : 'Aprovar' }}</span>
                    </button>
                  </div>
                </div>

                <!-- Stem Text -->
                <p class="text-xs sm:text-sm font-semibold text-text leading-relaxed">
                  {{ q.question }}
                </p>

                <!-- Reading passage snippet (if reading) -->
                <div v-if="q.reading_text" class="p-3 bg-bg-secondary/40 rounded-xl border border-border text-xs text-text-muted leading-relaxed">
                  <span class="font-bold text-primary text-[0.65rem] uppercase block mb-1">Texto de Leitura</span>
                  <div class="line-clamp-3 text-text">{{ q.reading_text }}</div>
                </div>

                <!-- Listening Audio preview -->
                <div v-if="q.audio_text" class="flex items-center justify-between gap-3 p-2.5 bg-cyan-500/5 border border-cyan-500/20 rounded-xl">
                  <span class="text-xs text-text-muted truncate">
                    🎧 Áudio / Script de Listening configurado
                  </span>
                  <button
                    type="button"
                    @click="handlePlayAudio(q.id, q.audio_text)"
                    class="px-2.5 py-1 rounded-lg bg-cyan-500 text-white text-[0.7rem] font-bold hover:opacity-90 transition-opacity inline-flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <Pause v-if="playingAudioQId === q.id" class="w-3 h-3" />
                    <Play v-else class="w-3 h-3" />
                    <span>{{ playingAudioQId === q.id ? 'Pausar' : 'Ouvir Áudio' }}</span>
                  </button>
                </div>

                <!-- Options / Answer preview -->
                <div v-if="q.options && q.options.length" class="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1">
                  <div
                    v-for="opt in q.options"
                    :key="opt"
                    class="p-2 rounded-xl text-xs border flex items-center justify-between"
                    :class="
                      String(opt).trim().toLowerCase() === String(q.correct_answer || '').trim().toLowerCase()
                        ? 'bg-success/10 border-success/30 text-success font-bold'
                        : 'bg-bg-secondary/30 border-border text-text-muted'
                    "
                  >
                    <span>{{ opt }}</span>
                    <span v-if="String(opt).trim().toLowerCase() === String(q.correct_answer || '').trim().toLowerCase()" class="text-[0.65rem]">
                      ✓ Gabarito
                    </span>
                  </div>
                </div>

                <div v-else-if="q.correct_answer" class="text-xs text-text-muted pt-1">
                  Gabarito esperado: <strong class="text-success">{{ q.correct_answer }}</strong>
                </div>
              </div>
            </div>
          </div>

          <!-- TAB 2: RESPOSTAS DO ALUNO & AVALIAÇÃO DA TATIANA -->
          <div v-else-if="activeTab === 'answers'" class="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
            <div v-if="!answerableExams.length" class="p-12 bg-surface border border-border rounded-2xl text-center text-xs text-text-muted">
              Nenhuma resposta ou exame concluído para este aluno ainda.
            </div>

            <div v-else class="space-y-4">
              <!-- Selector if multiple attempts -->
              <div v-if="answerableExams.length > 1" class="flex items-center gap-2 overflow-x-auto pb-1">
                <button
                  v-for="(ae, aIdx) in answerableExams"
                  :key="ae.id"
                  type="button"
                  @click="selectedCompletedExamIdx = aIdx"
                  class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer border"
                  :class="selectedCompletedExamIdx === aIdx ? 'bg-primary text-white border-primary shadow-xs' : 'bg-surface border-border text-text-muted hover:text-text'"
                >
                  Exam done on {{ formatDate(ae.completed_at || ae.started_at) }}
                </button>
              </div>

              <!-- PAINEL DE AVALIAÇÃO DA PROFESSORA (TATIANA) -->
              <div class="bg-surface border-2 border-primary/30 rounded-2xl p-5 shadow-sm space-y-4">
                <div class="flex items-center justify-between gap-2 border-b border-border/80 pb-3">
                  <div class="flex items-center gap-2.5">
                    <div class="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                      <GraduationCap class="w-4 h-4" />
                    </div>
                    <div>
                      <h4 class="text-sm font-black text-text">Avaliação da Professora Tatiana</h4>
                      <p class="text-[0.68rem] text-text-muted">
                        Altere ou atribua a nota final e escreva seu parecer pedagógico para o aluno.
                      </p>
                    </div>
                  </div>

                  <span
                    v-if="selectedAnsweredExam?.is_teacher_graded"
                    class="text-[0.65rem] font-bold px-2.5 py-0.5 rounded-full bg-success/15 text-success border border-success/30 flex items-center gap-1"
                  >
                    <Check class="w-3 h-3" />
                    <span>Validado por {{ selectedAnsweredExam.teacher_graded_by || 'Tatiana' }}</span>
                  </span>
                </div>

                <!-- Comparison Row -->
                <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <!-- AI Score Block -->
                  <div class="p-3.5 bg-bg-secondary/40 border border-border rounded-xl space-y-1">
                    <span class="text-[0.65rem] font-bold text-text-muted uppercase tracking-wider block">Nota Calculada pela IA</span>
                    <div class="flex items-baseline gap-2">
                      <span class="text-2xl font-black text-text">{{ selectedAnsweredExam?.ai_score ?? selectedAnsweredExam?.score ?? 0 }}%</span>
                      <span class="text-[0.65rem] text-text-muted">Baseada em múltipla escolha e análise oral</span>
                    </div>
                  </div>

                  <!-- Teacher Score Input Block -->
                  <div class="p-3.5 bg-primary/5 border border-primary/20 rounded-xl space-y-2">
                    <div class="flex items-center justify-between">
                      <label class="flex items-center gap-2 cursor-pointer select-none">
                        <input
                          type="checkbox"
                          v-model="teacherGradeForm.hasCustomScore"
                          class="rounded text-primary focus:ring-primary"
                        />
                        <span class="text-[0.68rem] font-bold text-primary uppercase tracking-wider">
                          Atribuir Nota Oficial da Tatiana (Opcional)
                        </span>
                      </label>
                      <span v-if="teacherGradeForm.hasCustomScore" class="text-xs font-black text-primary">{{ teacherGradeForm.score }}%</span>
                      <span v-else class="text-[0.65rem] text-text-muted italic">Mantendo nota da IA</span>
                    </div>

                    <div v-if="teacherGradeForm.hasCustomScore" class="flex items-center gap-3 pt-1">
                      <input
                        type="range"
                        min="0"
                        max="100"
                        step="1"
                        v-model.number="teacherGradeForm.score"
                        class="flex-1 accent-primary cursor-pointer"
                      />
                      <input
                        type="number"
                        min="0"
                        max="100"
                        v-model.number="teacherGradeForm.score"
                        class="w-16 px-2 py-1 text-center bg-surface border border-border rounded-lg text-xs font-bold text-text outline-none focus:border-primary"
                      />
                      <button
                        type="button"
                        @click="teacherGradeForm.score = selectedAnsweredExam?.ai_score ?? 70"
                        class="text-[0.65rem] text-text-muted hover:text-primary transition-colors cursor-pointer px-2 py-1 border border-border rounded-lg"
                        title="Restaurar valor original calculado pela IA"
                      >
                        Restaurar IA
                      </button>
                    </div>
                  </div>
                </div>

                <!-- Teacher Feedback Textarea -->
                <div class="space-y-1.5">
                  <div class="flex items-center justify-between">
                    <label class="text-xs font-bold text-text flex items-center justify-between w-full">
                      <span>Parecer &amp; Comentários da Professora para o Aluno (Geral)</span>
                      <span class="text-[0.65rem] text-text-muted font-normal">Visível no histórico de exames do aluno</span>
                    </label>
                  </div>
                  <textarea
                    rows="3"
                    v-model="teacherGradeForm.feedback"
                    placeholder="Ex: Excelente evolução na fala e vocabulário! Continuar praticando as preposições de tempo... (Opcional, deixe em branco para nenhum parecer geral)"
                    class="w-full px-3.5 py-2.5 bg-bg border border-border rounded-xl text-xs text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-y"
                  ></textarea>
                  <div v-if="teacherGradeForm.feedback" class="flex justify-end">
                    <button
                      type="button"
                      @click="teacherGradeForm.feedback = ''"
                      class="text-[0.65rem] text-destructive hover:underline cursor-pointer inline-flex items-center gap-1"
                    >
                      <Trash2 class="w-3 h-3" />
                      <span>Limpar parecer geral</span>
                    </button>
                  </div>
                </div>

                <div class="flex items-center justify-between pt-1">
                  <label class="flex items-center gap-2 cursor-pointer text-xs font-semibold text-text">
                    <input
                      type="checkbox"
                      v-model="teacherGradeForm.passed"
                      class="rounded text-primary focus:ring-primary"
                    />
                    <span>Considerar aluno aprovado no nível {{ selectedAnsweredExam?.level }}</span>
                  </label>

                  <button
                    type="button"
                    @click="handleSaveTeacherGrade"
                    :disabled="isSavingTeacherGrade"
                    class="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover shadow-xs transition-all inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Save class="w-3.5 h-3.5" :class="isSavingTeacherGrade ? 'animate-spin' : ''" />
                    <span>{{ isSavingTeacherGrade ? 'Salvando...' : 'Salvar Avaliação da Professora' }}</span>
                  </button>
                </div>
              </div>

              <!-- List of Student Answers -->
              <div class="space-y-3">
                <h5 class="text-xs font-bold uppercase tracking-wider text-text-muted px-1">
                  Detalhamento das Questões &amp; Respostas do Aluno
                </h5>

                <div
                  v-for="(corr, cIdx) in (selectedAnsweredExam?.corrections || [])"
                  :key="corr.question_id || cIdx"
                  class="bg-surface border border-border rounded-2xl p-4 md:p-5 shadow-2xs space-y-3"
                >
                  <div class="flex items-center justify-between gap-2 border-b border-border/50 pb-2">
                    <div class="flex items-center gap-2">
                      <span class="w-6 h-6 rounded-lg bg-primary/10 text-primary text-xs font-black flex items-center justify-center">
                        {{ cIdx + 1 }}
                      </span>
                      <span class="text-xs font-bold uppercase tracking-wider text-text-muted">
                        {{ corr.type }}
                      </span>
                    </div>

                    <span
                      class="text-xs font-bold px-2.5 py-0.5 rounded-full flex items-center gap-1 border"
                      :class="corr.is_correct ? 'bg-success/10 text-success border-success/20' : 'bg-destructive/10 text-destructive border-destructive/20'"
                    >
                      <CheckCircle2 v-if="corr.is_correct" class="w-3 h-3" />
                      <XCircle v-else class="w-3 h-3" />
                      <span>{{ corr.is_correct ? `Correto (+${corr.points_earned || 10} pts)` : `Incorreto (+${corr.points_earned || 0} pts)` }}</span>
                    </span>
                  </div>

                  <!-- Question Text -->
                  <p class="text-xs sm:text-sm font-semibold text-text leading-relaxed">
                    {{ corr.question }}
                  </p>

                  <!-- Answers Comparison -->
                  <div class="p-3 bg-bg-secondary/40 rounded-xl border border-border space-y-1.5 text-xs">
                    <div>
                      <span class="text-text-muted">Resposta do aluno: </span>
                      <strong :class="corr.is_correct ? 'text-success' : 'text-destructive'">
                        {{ corr.student_answer || corr.raw_student_answer || '(não respondida)' }}
                      </strong>
                    </div>

                    <div v-if="corr.correct_answer && !corr.is_correct">
                      <span class="text-text-muted">Gabarito esperado: </span>
                      <strong class="text-success">{{ corr.correct_answer }}</strong>
                    </div>

                    <!-- Audio Player if speaking / listening submission -->
                    <div v-if="corr.student_audio_data" class="pt-2 flex items-center gap-2">
                      <button
                        type="button"
                        @click="handlePlayAudio(`corr_${cIdx}`, null, corr.student_audio_data)"
                        class="px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover shadow-2xs inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Pause v-if="playingAudioQId === `corr_${cIdx}`" class="w-3 h-3" />
                        <Play v-else class="w-3 h-3" />
                        <span>{{ playingAudioQId === `corr_${cIdx}` ? 'Pausar Áudio' : 'Ouvir Áudio Gravado pelo Aluno' }}</span>
                      </button>
                    </div>
                  </div>

                  <!-- Pedagogical Feedback from AI -->
                  <div v-if="corr.explanation" class="text-xs text-text-muted leading-relaxed bg-bg p-3 rounded-xl border border-border/80">
                    <span class="font-bold text-text block mb-0.5">Explicação pedagógica da IA:</span>
                    <span>{{ corr.explanation }}</span>
                  </div>

                  <!-- Teacher Per-Question Comment (Optional, Editable & Deletable) -->
                  <div class="p-3.5 bg-primary/5 rounded-xl border border-primary/20 space-y-2">
                    <div class="flex items-center justify-between">
                      <span class="text-xs font-bold text-primary flex items-center gap-1.5">
                        <MessageSquare class="w-3.5 h-3.5" />
                        <span>Comentário da Tatiana para esta questão (Opcional)</span>
                      </span>

                      <button
                        v-if="teacherQuestionComments[corr.question_id || `q${cIdx + 1}`]"
                        type="button"
                        @click="handleDeleteQuestionComment(corr.question_id || `q${cIdx + 1}`)"
                        :disabled="isSavingQuestionComment[corr.question_id || `q${cIdx + 1}`]"
                        class="text-[0.65rem] text-destructive hover:underline inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <Trash2 class="w-3 h-3" />
                        <span>Apagar comentário</span>
                      </button>
                    </div>

                    <textarea
                      rows="2"
                      v-model="teacherQuestionComments[corr.question_id || `q${cIdx + 1}`]"
                      placeholder="Ex: Excelente clareza na pronúncia! Apenas cuide da entonação na pergunta... (Opcional)"
                      class="w-full px-3 py-2 bg-bg border border-border rounded-xl text-xs text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-y"
                    ></textarea>

                    <div class="flex items-center justify-between pt-0.5">
                      <span class="text-[0.65rem] text-text-muted">
                        {{ teacherQuestionComments[corr.question_id || `q${cIdx + 1}`] ? 'Comentário personalizado pronto para o aluno' : 'Sem comentário específico nesta questão' }}
                      </span>
                      <button
                        type="button"
                        @click="handleSaveSingleQuestionComment(corr.question_id || `q${cIdx + 1}`)"
                        :disabled="isSavingQuestionComment[corr.question_id || `q${cIdx + 1}`]"
                        class="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary text-primary hover:text-white text-[0.68rem] font-bold transition-all inline-flex items-center gap-1 cursor-pointer disabled:opacity-50"
                      >
                        <Save class="w-3 h-3" :class="isSavingQuestionComment[corr.question_id || `q${cIdx + 1}`] ? 'animate-spin' : ''" />
                        <span>{{ isSavingQuestionComment[corr.question_id || `q${cIdx + 1}`] ? 'Salvando...' : 'Salvar nesta questão' }}</span>
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- TAB 3: BASE DE ATIVIDADES PLAYWRIGHT -->
          <div v-else-if="activeTab === 'activities'" class="flex-1 min-h-0 overflow-y-auto space-y-4 pr-1 custom-scrollbar">
            <div class="bg-surface border border-border rounded-2xl p-4 shadow-2xs flex items-center justify-between gap-4">
              <div>
                <h4 class="text-xs font-bold uppercase tracking-wider text-text">Atividades Concluídas no Nível {{ studentDetail.student.level }}</h4>
                <p class="text-[0.68rem] text-text-muted">
                  Base estruturada pelo Playwright estritamente para Grammar, Vocabulary, Listening e Reading.
                </p>
              </div>
              <button
                type="button"
                @click="handleSyncPlaywright(true)"
                :disabled="isSyncingPlaywright"
                class="px-3 py-1.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover transition-all flex items-center gap-1.5 cursor-pointer shadow-xs disabled:opacity-50"
              >
                <RefreshCw class="w-3.5 h-3.5" :class="isSyncingPlaywright ? 'animate-spin' : ''" />
                <span>Forçar Re-extração</span>
              </button>
            </div>

            <div v-if="!completedActivities.length" class="p-12 bg-surface border border-border rounded-2xl text-center text-xs text-text-muted">
              Nenhuma atividade de Grammar até Reading concluída neste nível pelo aluno.
            </div>

            <div v-else class="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div
                v-for="act in completedActivities"
                :key="act.url || act.title"
                class="bg-surface border border-border rounded-2xl p-4 shadow-2xs space-y-2 hover:border-primary/30 transition-all"
              >
                <div class="flex items-center justify-between gap-2">
                  <span
                    class="text-[0.62rem] font-bold uppercase px-2 py-0.5 rounded-md border"
                    :class="getModalityBadge(act.category).color"
                  >
                    {{ act.category }}
                  </span>
                  <span
                    class="text-[0.62rem] font-bold px-2 py-0.5 rounded-md border"
                    :class="act.scraped ? 'bg-success/10 text-success border-success/20' : 'bg-amber-500/10 text-amber-500 border-amber-500/20'"
                  >
                    {{ act.scraped ? '✓ Salvo no Banco' : 'Pendente Playwright' }}
                  </span>
                </div>

                <h5 class="text-xs font-bold text-text truncate">
                  {{ act.title || act.slug }}
                </h5>

                <div class="text-[0.65rem] text-text-muted flex items-center gap-2">
                  <span>{{ act.questions?.length || 0 }} questões extraídas</span>
                  <span v-if="act.reading_text">• Texto de Reading</span>
                  <span v-if="act.audio_text">• Áudio de Listening</span>
                </div>

                <a
                  v-if="act.url"
                  :href="act.url"
                  target="_blank"
                  class="text-[0.65rem] text-primary hover:underline inline-flex items-center gap-1 font-medium pt-1"
                >
                  <span>Abrir atividade original</span>
                  <ExternalLink class="w-2.5 h-2.5" />
                </a>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- MODAL: AJUSTE PONTUAL COM IA -->
    <Teleport to="body">
      <div
        v-if="aiModalQuestion"
        class="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      >
        <div class="w-full max-w-lg bg-surface border border-border rounded-3xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200">
          <div class="flex items-center justify-between border-b border-border/80 pb-3">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center">
                <Sparkles class="w-4 h-4" />
              </div>
              <div>
                <h4 class="text-sm font-black text-text">Ajustar Questão {{ aiModalQuestion.id.toUpperCase() }} com IA</h4>
                <p class="text-[0.68rem] text-text-muted">A IA reescreverá a questão em tempo real mantendo o nível CEFR.</p>
              </div>
            </div>
            <button
              type="button"
              @click="aiModalQuestion = null"
              class="p-1 rounded-lg text-text-muted hover:text-text cursor-pointer"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <div class="p-3 bg-bg-secondary/40 rounded-xl border border-border text-xs text-text">
            <span class="text-text-muted font-bold block mb-0.5">Enunciado Atual:</span>
            <span>{{ aiModalQuestion.question }}</span>
          </div>

          <!-- Quick suggestions -->
          <div class="space-y-1.5">
            <span class="text-[0.68rem] font-bold uppercase tracking-wider text-text-muted block">Sugestões Rápidas:</span>
            <div class="flex flex-wrap gap-1.5">
              <button
                v-for="sug in QUICK_AI_SUGGESTIONS"
                :key="sug"
                type="button"
                @click="aiModalSuggestion = sug"
                class="text-[0.65rem] px-2.5 py-1 rounded-lg bg-surface border border-border hover:border-primary/40 text-text-muted hover:text-primary transition-colors cursor-pointer text-left"
              >
                {{ sug }}
              </button>
            </div>
          </div>

          <!-- Prompt input -->
          <div class="space-y-1.5">
            <label class="text-xs font-bold text-text">Instrução para a IA:</label>
            <textarea
              rows="3"
              v-model="aiModalSuggestion"
              placeholder="Ex: Troque as opções para focar no Simple Past irregular e use o vocabulário de viagens..."
              class="w-full px-3 py-2 bg-bg border border-border rounded-xl text-xs text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all resize-y"
            ></textarea>
          </div>

          <div class="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
            <button
              type="button"
              @click="aiModalQuestion = null"
              class="px-4 py-2 rounded-xl bg-surface border border-border text-xs font-bold text-text-muted hover:text-text cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              @click="handleExecuteAiImprovement"
              :disabled="isAiImproving || !aiModalSuggestion.trim()"
              class="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover shadow-xs transition-all inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Sparkles class="w-3.5 h-3.5" :class="isAiImproving ? 'animate-spin' : ''" />
              <span>{{ isAiImproving ? 'Ajustando...' : 'Aplicar Ajuste' }}</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- MODAL: EDIÇÃO MANUAL DE QUESTÃO -->
    <Teleport to="body">
      <div
        v-if="manualModalQuestion"
        class="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      >
        <div class="w-full max-w-xl bg-surface border border-border rounded-3xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto custom-scrollbar">
          <div class="flex items-center justify-between border-b border-border/80 pb-3">
            <div class="flex items-center gap-2.5">
              <div class="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Edit3 class="w-4 h-4" />
              </div>
              <div>
                <h4 class="text-sm font-black text-text">Editar Questão {{ manualModalQuestion.id.toUpperCase() }}</h4>
                <p class="text-[0.68rem] text-text-muted">Ajuste diretamente enunciado, opções e gabarito.</p>
              </div>
            </div>
            <button
              type="button"
              @click="manualModalQuestion = null"
              class="p-1 rounded-lg text-text-muted hover:text-text cursor-pointer"
            >
              <X class="w-4 h-4" />
            </button>
          </div>

          <!-- Form Fields -->
          <div class="space-y-3 text-xs">
            <div class="space-y-1">
              <label class="font-bold text-text">Enunciado da Questão:</label>
              <textarea
                rows="2"
                v-model="manualDraft.question"
                class="w-full px-3 py-2 bg-bg border border-border rounded-xl text-text outline-none focus:border-primary"
              ></textarea>
            </div>

            <div v-if="manualModalQuestion.type === 'reading'" class="space-y-1">
              <label class="font-bold text-text">Texto de Leitura (Reading Passage):</label>
              <textarea
                rows="4"
                v-model="manualDraft.reading_text"
                class="w-full px-3 py-2 bg-bg border border-border rounded-xl text-text outline-none focus:border-primary"
              ></textarea>
            </div>

            <div v-if="manualModalQuestion.type === 'listening'" class="space-y-1">
              <label class="font-bold text-text">Script de Áudio (Listening Script):</label>
              <textarea
                rows="3"
                v-model="manualDraft.audio_text"
                class="w-full px-3 py-2 bg-bg border border-border rounded-xl text-text outline-none focus:border-primary"
              ></textarea>
            </div>

            <div v-if="manualDraft.options && manualDraft.options.length" class="space-y-1.5">
              <label class="font-bold text-text">Alternativas:</label>
              <div v-for="(_, oIdx) in manualDraft.options" :key="oIdx" class="flex items-center gap-2">
                <span class="w-5 text-center font-bold text-text-muted">{{ String.fromCharCode(65 + oIdx) }}</span>
                <input
                  type="text"
                  v-model="manualDraft.options[oIdx]"
                  class="flex-1 px-3 py-1.5 bg-bg border border-border rounded-lg text-text outline-none focus:border-primary"
                />
              </div>
            </div>

            <div class="space-y-1">
              <label class="font-bold text-text">Resposta Correta (Gabarito):</label>
              <input
                type="text"
                v-model="manualDraft.correct_answer"
                class="w-full px-3 py-1.5 bg-bg border border-border rounded-lg text-text outline-none focus:border-primary"
              />
            </div>

            <div class="space-y-1">
              <label class="font-bold text-text">Explicação Pedagógica:</label>
              <textarea
                rows="2"
                v-model="manualDraft.explanation"
                class="w-full px-3 py-2 bg-bg border border-border rounded-xl text-text outline-none focus:border-primary"
              ></textarea>
            </div>
          </div>

          <div class="flex items-center justify-end gap-2.5 pt-2 border-t border-border">
            <button
              type="button"
              @click="manualModalQuestion = null"
              class="px-4 py-2 rounded-xl bg-surface border border-border text-xs font-bold text-text-muted hover:text-text cursor-pointer"
            >
              Cancelar
            </button>
            <button
              type="button"
              @click="handleExecuteManualSave"
              :disabled="isSavingManual"
              class="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover shadow-xs transition-all inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <Save class="w-3.5 h-3.5" :class="isSavingManual ? 'animate-spin' : ''" />
              <span>{{ isSavingManual ? 'Salvando...' : 'Salvar Questão' }}</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- MODAL: RESET DE EXAME -->
    <Teleport to="body">
      <div
        v-if="isResetModalOpen"
        class="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
      >
        <div class="w-full max-w-md bg-surface border border-border rounded-3xl shadow-2xl p-6 space-y-4 animate-in zoom-in-95 duration-200">
          <div class="flex items-center justify-between border-b border-border/80 pb-3">
            <h4 class="text-sm font-black text-text">Opções de Reset de Exame</h4>
            <button type="button" @click="isResetModalOpen = false" class="p-1 rounded-lg text-text-muted hover:text-text cursor-pointer">
              <X class="w-4 h-4" />
            </button>
          </div>

          <div class="space-y-2.5 text-xs">
            <button
              type="button"
              @click="handleResetExam('reopen')"
              :disabled="isResettingExam"
              class="w-full p-3 rounded-2xl bg-bg hover:bg-bg-secondary border border-border text-left transition-colors cursor-pointer space-y-0.5"
            >
              <span class="font-bold text-text block">Reabrir Exame Atual</span>
              <span class="text-text-muted">Mantém as 10 questões aprovadas e permite ao aluno refazer a prova agora.</span>
            </button>

            <button
              type="button"
              @click="handleResetExam('clear_all')"
              :disabled="isResettingExam"
              class="w-full p-3 rounded-2xl bg-destructive/5 hover:bg-destructive/10 border border-destructive/20 text-left transition-colors cursor-pointer space-y-0.5"
            >
              <span class="font-bold text-destructive block">Zerar Ciclo Trimestral</span>
              <span class="text-text-muted">Apaga tentativas em andamento e permite gerar um novo exame do zero.</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
