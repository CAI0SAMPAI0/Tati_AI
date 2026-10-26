<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
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

// Question AI & Manual editing states
const openAiBoxByQuestion = ref<Record<string, boolean>>({});
const aiSuggestionByQuestion = ref<Record<string, string>>({});
const aiLoadingByQuestion = ref<Record<string, boolean>>({});
const statusLoadingByQuestion = ref<Record<string, boolean>>({});
const recentlyUpdatedByQuestion = ref<Record<string, boolean>>({});

const openManualEditByQuestion = ref<Record<string, boolean>>({});
const manualDraftByQuestion = ref<Record<string, any>>({});
const manualSavingByQuestion = ref<Record<string, boolean>>({});

// Expanded scraped activities in DB tab
const expandedActivities = ref<Record<string, boolean>>({});

// Audio TTS preview player for Listening questions
const playingAudioQId = ref<string | null>(null);
const audioPlayer = ref<HTMLAudioElement | null>(null);

const QUICK_AI_SUGGESTIONS = [
  'Simplify the vocabulary and sentence structure for this level',
  'Change the theme to everyday routine, family, or travel',
  'Make the distractors clearer so only one option is unambiguously correct',
  'Rewrite the question to match the student completed activities more closely',
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

// Combine completed exams + any in-progress exam that already has partial answers so the teacher can always inspect responses
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

const hasAnyExamToReset = computed(() => {
  return Boolean(activeExam.value) || completedExams.value.length > 0;
});

function countWords(text?: string | null): number {
  if (!text || !text.trim()) return 0;
  return text.trim().split(/\s+/).length;
}

function formatDate(iso?: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return iso;
  }
}

function isOptionSelectedByStudent(opt: string, corr: any): boolean {
  const raw = String(corr?.raw_student_answer || corr?.student_answer || '').trim().toLowerCase();
  if (!raw || raw === '(not answered)') return false;
  return String(opt || '').trim().toLowerCase() === raw;
}

function isOptionCorrect(opt: string, corr: any): boolean {
  const expected = String(corr?.correct_answer || '').trim().toLowerCase();
  if (!expected) return false;
  return String(opt || '').trim().toLowerCase() === expected;
}

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
    toast.error(err?.message || 'Could not load exams overview.');
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
    } else if (detail.active_exam) {
      activeTab.value = 'questions';
    } else if (detail.completed_exams && detail.completed_exams.length > 0) {
      activeTab.value = 'answers';
    } else {
      activeTab.value = 'questions';
    }
  } catch (err: any) {
    toast.error(err?.message || 'Error loading student exam details.');
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
        ? `Playwright extracted ${newly} new activity(ies)! (${total} saved in DB)`
        : `All ${total} completed level activity(ies) are verified in the database.`
    );
  } catch (err: any) {
    toast.error(err?.message || 'Error verifying activities with Playwright.');
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
    toast.success(`New ${res.student?.level} exam generated from student's completed activities!`);
  } catch (err: any) {
    toast.error(err?.message || 'Could not generate exam.');
  } finally {
    isGeneratingExam.value = false;
  }
}

async function handleResetExam(mode: 'reopen' | 'clear_all' | 'delete_one', examId?: string) {
  if (!selectedUsername.value || isResettingExam.value) return;
  if (mode === 'delete_one' && !confirm('Delete this specific exam attempt?')) return;

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
      toast.success('Exam reopened! The student can retake it immediately with the current questions.');
    } else if (mode === 'delete_one') {
      toast.success('Exam attempt removed.');
    } else {
      activeTab.value = 'questions';
      toast.success('Student exam cycle completely reset!');
    }
    // Refresh KPI counters silently
    const params = new URLSearchParams();
    if (selectedLevel.value !== 'ALL') params.set('level', selectedLevel.value);
    const qs = params.toString();
    const overviewUrl = qs ? `${ENDPOINTS.DASHBOARD_EXAMS_OVERVIEW}?${qs}` : ENDPOINTS.DASHBOARD_EXAMS_OVERVIEW;
    apiGet<any>(overviewUrl)
      .then((ov) => {
        if (ov?.summary) overviewSummary.value = ov.summary;
        if (ov?.level_counts) levelCounts.value = ov.level_counts;
      })
      .catch(() => {});
  } catch (err: any) {
    toast.error(err?.message || 'Error resetting student exam.');
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
    if (status === 'rejected') {
      openAiBoxByQuestion.value[q.id] = true;
    }
    toast.success(
      status === 'approved'
        ? `Question ${q.id.toUpperCase()} approved!`
        : status === 'rejected'
        ? `Question ${q.id.toUpperCase()} marked for adjustment.`
        : `Question ${q.id.toUpperCase()} reset to pending.`
    );
  } catch (err: any) {
    toast.error(err?.message || 'Could not update question status.');
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
    toast.success('All exam questions approved!');
  } catch (err: any) {
    toast.error(err?.message || 'Error approving all questions.');
  } finally {
    isBulkApproving.value = false;
  }
}

function toggleAiBox(qId: string) {
  openAiBoxByQuestion.value[qId] = !openAiBoxByQuestion.value[qId];
  if (openAiBoxByQuestion.value[qId]) {
    openManualEditByQuestion.value[qId] = false;
  }
}

async function handleApplyAiImprovement(q: any) {
  if (!activeExam.value) return;
  const suggestion = (aiSuggestionByQuestion.value[q.id] || '').trim();
  if (!suggestion) {
    toast.error('Type what you want the AI to improve or change in this question.');
    return;
  }

  aiLoadingByQuestion.value[q.id] = true;
  try {
    const res = await apiPost<any>(
      ENDPOINTS.DASHBOARD_EXAMS_AI_IMPROVE(activeExam.value.id, q.id),
      { suggestion }
    );
    if (studentDetail.value && res.exam) {
      studentDetail.value.active_exam = res.exam;
      syncStudentRowInList(studentDetail.value);
    }
    aiSuggestionByQuestion.value[q.id] = '';
    openAiBoxByQuestion.value[q.id] = false;
    recentlyUpdatedByQuestion.value[q.id] = true;
    setTimeout(() => {
      recentlyUpdatedByQuestion.value[q.id] = false;
    }, 4500);
    toast.success(`Question ${q.id.toUpperCase()} updated in real time by AI!`);
  } catch (err: any) {
    toast.error(err?.message || 'AI could not update the question right now.');
  } finally {
    aiLoadingByQuestion.value[q.id] = false;
  }
}

function toggleManualEdit(q: any) {
  const isOpen = !openManualEditByQuestion.value[q.id];
  openManualEditByQuestion.value[q.id] = isOpen;
  if (isOpen) {
    openAiBoxByQuestion.value[q.id] = false;
    manualDraftByQuestion.value[q.id] = {
      question: q.question || '',
      reading_text: q.reading_text || '',
      audio_text: q.audio_text || '',
      options: Array.isArray(q.options) ? [...q.options] : [],
      correct_answer: q.correct_answer || '',
      explanation: q.explanation || '',
    };
  }
}

async function handleSaveManualEdit(q: any) {
  if (!activeExam.value) return;
  const draft = manualDraftByQuestion.value[q.id];
  if (!draft) return;

  manualSavingByQuestion.value[q.id] = true;
  try {
    const res = await apiPatch<any>(
      ENDPOINTS.DASHBOARD_EXAMS_QUESTION_EDIT(activeExam.value.id, q.id),
      draft
    );
    if (studentDetail.value && res.exam) {
      studentDetail.value.active_exam = res.exam;
      syncStudentRowInList(studentDetail.value);
    }
    openManualEditByQuestion.value[q.id] = false;
    toast.success(`Question ${q.id.toUpperCase()} saved!`);
  } catch (err: any) {
    toast.error(err?.message || 'Could not save manual changes.');
  } finally {
    manualSavingByQuestion.value[q.id] = false;
  }
}

async function handlePlayListeningPreview(keyId: string, audioText?: string | null) {
  if (playingAudioQId.value === keyId && audioPlayer.value) {
    audioPlayer.value.pause();
    playingAudioQId.value = null;
    return;
  }
  if (!audioText) return;
  try {
    const tts = await getTtsAudio(audioText, 'en-US');
    if (!tts?.audio_b64) {
      toast.error('Audio preview unavailable.');
      return;
    }
    if (audioPlayer.value) {
      audioPlayer.value.pause();
    }
    audioPlayer.value = new Audio(`data:audio/mp3;base64,${tts.audio_b64}`);
    playingAudioQId.value = keyId;
    audioPlayer.value.onended = () => {
      playingAudioQId.value = null;
    };
    await audioPlayer.value.play();
  } catch {
    playingAudioQId.value = null;
    toast.error('Failed to play TTS audio preview.');
  }
}

function toggleActivityExpand(key: string) {
  expandedActivities.value[key] = !expandedActivities.value[key];
}

function getApprovalBadgeClass(status?: string) {
  if (status === 'approved') return 'bg-success/15 text-success border-success/30';
  if (status === 'rejected' || status === 'changes_requested') return 'bg-danger/15 text-danger border-danger/30';
  return 'bg-amber-500/15 text-amber-500 border-amber-500/30';
}

function getModalityBadgeClass(type?: string) {
  const t = (type || '').toLowerCase();
  if (t === 'reading') return 'bg-blue-500/10 text-blue-500 border-blue-500/25';
  if (t === 'grammar') return 'bg-purple-500/10 text-purple-500 border-purple-500/25';
  if (t === 'vocabulary') return 'bg-emerald-500/10 text-emerald-500 border-emerald-500/25';
  if (t === 'listening') return 'bg-cyan-500/10 text-cyan-500 border-cyan-500/25';
  if (t === 'writing') return 'bg-amber-500/10 text-amber-500 border-amber-500/25';
  if (t === 'speaking') return 'bg-rose-500/10 text-rose-500 border-rose-500/25';
  return 'bg-primary/10 text-primary border-primary/25';
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
  <div class="space-y-5">
    <!-- Top Filter & Summary Header -->
    <div class="bg-surface border border-border rounded-2xl p-5 shadow-xs space-y-4">
      <div class="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div class="flex items-center gap-3">
          <div class="w-10 h-10 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
            <ExamIcon class="w-5 h-5" />
          </div>
          <div>
            <h2 class="text-base md:text-lg font-bold text-text">
              Exams — Verification, AI Adjustments &amp; Student Answers
            </h2>
          </div>
        </div>

        <!-- KPI Badges -->
        <div class="flex flex-wrap items-center gap-2 text-xs">
          <div class="px-3 py-1.5 rounded-xl bg-bg border border-border font-semibold text-text-muted">
            Students: <strong class="text-text">{{ overviewSummary.filtered_students }}</strong>
          </div>
          <div class="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/25 font-semibold text-amber-500">
            Pending Review: <strong>{{ overviewSummary.pending_review_exams }}</strong>
          </div>
          <div class="px-3 py-1.5 rounded-xl bg-success/10 border border-success/25 font-semibold text-success">
            Approved: <strong>{{ overviewSummary.approved_exams }}</strong>
          </div>
          <div class="px-3 py-1.5 rounded-xl bg-primary/10 border border-primary/25 font-semibold text-primary">
            Submitted Exams: <strong>{{ overviewSummary.completed_exams }}</strong>
          </div>
        </div>
      </div>

      <!-- Level Filter Pills + Search -->
      <div class="flex flex-col md:flex-row md:items-center justify-between gap-3 pt-2 border-t border-border/60">
        <div class="flex flex-wrap items-center gap-1.5">
          <button
            v-for="lvl in LEVELS"
            :key="lvl"
            type="button"
            @click="handleChangeLevel(lvl)"
            class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border"
            :class="
              selectedLevel === lvl
                ? 'bg-primary text-white border-primary shadow-glow'
                : 'bg-bg border-border text-text-muted hover:text-primary hover:border-primary/40'
            "
          >
            <span>{{ lvl === 'ALL' ? 'All Levels' : lvl }}</span>
            <span
              class="text-[0.65rem] px-1.5 py-0.2 rounded-full font-black"
              :class="selectedLevel === lvl ? 'bg-white/20 text-white' : 'bg-surface-hover text-text-subtle'"
            >
              {{ levelCounts[lvl] ?? 0 }}
            </span>
          </button>
        </div>

        <div class="flex items-center gap-2 w-full md:w-80">
          <div class="relative flex-1">
            <Search class="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
            <input
              v-model="searchQuery"
              type="text"
              placeholder="Search student by name or @username..."
              class="w-full pl-9 pr-3 py-2 bg-bg border border-border rounded-xl text-xs text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            />
          </div>
          <button
            type="button"
            @click="loadOverview(true)"
            class="p-2 rounded-xl bg-bg border border-border text-text-muted hover:text-primary hover:border-primary/40 transition-colors cursor-pointer"
            title="Refresh list"
          >
            <RefreshCw class="w-4 h-4" :class="isLoadingOverview ? 'animate-spin text-primary' : ''" />
          </button>
        </div>
      </div>
    </div>

    <!-- Master-Detail Grid (Side-by-Side Equal Height with Internal Scrollbars) -->
    <div class="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
      <!-- LEFT COLUMN: Students List -->
      <div class="lg:col-span-4 bg-surface border border-border rounded-2xl overflow-hidden shadow-xs flex flex-col lg:h-[78vh]">
        <div class="px-4 py-3.5 border-b border-border flex items-center justify-between bg-bg-secondary/40 shrink-0">
          <span class="text-xs font-bold uppercase tracking-wider text-text-subtle">
            Students ({{ filteredStudents.length }})
          </span>
          <span v-if="selectedLevel !== 'ALL'" class="text-[0.65rem] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary">
            Level {{ selectedLevel }}
          </span>
        </div>

        <div v-if="isLoadingOverview" class="p-8 text-center space-y-2 flex-1 flex flex-col items-center justify-center">
          <div class="w-7 h-7 mx-auto rounded-full border-3 border-primary/20 border-t-primary animate-spin" />
          <p class="text-xs text-text-muted font-medium">Loading students &amp; exams...</p>
        </div>

        <div v-else-if="filteredStudents.length === 0" class="p-8 text-center text-xs text-text-muted flex-1 flex items-center justify-center">
          No students found for this level filter.
        </div>

        <div v-else class="flex-1 min-h-0 max-h-[65vh] lg:max-h-none overflow-y-auto divide-y divide-border custom-scrollbar">
          <div
            v-for="stu in filteredStudents"
            :key="stu.username"
            @click="selectStudent(stu.username)"
            class="w-full p-4 text-left transition-all cursor-pointer flex items-start gap-3 hover:bg-bg-secondary/40"
            :class="selectedUsername === stu.username ? 'bg-primary/8 border-l-4 border-l-primary' : ''"
          >
            <div class="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary shrink-0 overflow-hidden mt-0.5">
              <img
                v-if="stu.avatar_url && stu.avatar_url !== DEFAULT_AVATAR_URL"
                :src="stu.avatar_url"
                :alt="stu.name"
                class="w-full h-full object-cover"
                @error="(e: any) => { e.currentTarget.style.display = 'none'; }"
              />
              <span v-else>{{ (stu.name || stu.username || '?').charAt(0).toUpperCase() }}</span>
            </div>

            <div class="min-w-0 flex-1 space-y-1.5">
              <div class="flex items-center justify-between gap-2">
                <div class="flex items-center gap-1.5 min-w-0">
                  <span class="text-xs sm:text-sm font-bold text-text truncate">{{ stu.name || stu.username }}</span>
                  <span
                    v-if="stu.is_admin_account"
                    class="text-[0.58rem] font-bold uppercase px-1.5 py-0.2 rounded bg-amber-500/15 text-amber-500 border border-amber-500/30 shrink-0"
                    title="Admin account visible only during test mode; hidden automatically once exams are released to all students."
                  >
                    Admin
                  </span>
                </div>
                <span class="text-[0.65rem] font-black px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 shrink-0">
                  {{ stu.level }}
                </span>
              </div>

              <div class="text-[0.68rem] text-text-muted truncate">@{{ stu.username }}</div>

              <div class="flex flex-wrap items-center gap-1.5 pt-0.5">
                <span class="text-[0.62rem] font-semibold px-2 py-0.5 rounded-md bg-bg border border-border text-text-subtle">
                  {{ stu.completed_activities_summary?.total || 0 }} done ({{ stu.completed_activities_summary?.scraped_count || 0 }} DB)
                </span>

                <span
                  v-if="stu.active_exam"
                  class="text-[0.62rem] font-bold px-2 py-0.5 rounded-md border"
                  :class="getApprovalBadgeClass(stu.active_exam.approval_summary?.overall_status)"
                >
                  {{
                    stu.active_exam.approval_summary?.overall_status === 'approved'
                      ? 'Exam Approved'
                      : stu.active_exam.approval_summary?.overall_status === 'changes_requested'
                      ? `${stu.active_exam.approval_summary?.rejected} Rejected`
                      : `${stu.active_exam.approval_summary?.approved}/${stu.active_exam.approval_summary?.total} Approved`
                  }}
                </span>

                <button
                  v-if="stu.completed_exams_count > 0"
                  type="button"
                  @click.stop="selectStudent(stu.username, 'answers')"
                  class="text-[0.62rem] font-bold px-2 py-0.5 rounded-md bg-primary text-white hover:opacity-90 inline-flex items-center gap-1 cursor-pointer shadow-xs"
                  title="Click to inspect student's submitted exam answers"
                >
                  <Eye class="w-3 h-3" />
                  <span>
                    Answers ({{ stu.completed_exams_count }})
                    <template v-if="stu.latest_completed_exam"> • {{ stu.latest_completed_exam.score }}%</template>
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- RIGHT COLUMN: Selected Student Workspace (Fixed height matching left column + internal scroll) -->
      <div class="lg:col-span-8 flex flex-col gap-4 lg:h-[78vh] min-h-0">
        <div
          v-if="isLoadingStudent"
          class="bg-surface border border-border rounded-2xl p-12 text-center space-y-3 flex-1 flex flex-col items-center justify-center"
        >
          <div class="w-9 h-9 mx-auto rounded-full border-3 border-primary/20 border-t-primary animate-spin" />
          <p class="text-xs font-bold text-text-muted">Loading student exam &amp; verified activities...</p>
        </div>

        <div
          v-else-if="!studentDetail"
          class="bg-surface border border-border rounded-2xl p-12 text-center text-xs text-text-muted flex-1 flex items-center justify-center"
        >
          Select a student on the left to review exam questions, apply real-time AI adjustments, or inspect exam answers.
        </div>

        <template v-else>
          <!-- Pinned Student Header & Actions Card -->
          <div class="bg-surface border border-border rounded-2xl p-5 shadow-xs space-y-4 shrink-0">
            <div class="flex flex-col xl:flex-row xl:items-center justify-between gap-4">
              <div class="space-y-1">
                <div class="flex flex-wrap items-center gap-2">
                  <h3 class="text-base md:text-lg font-bold text-text">
                    {{ studentDetail.student.name }}
                  </h3>
                  <span class="text-xs font-black px-2.5 py-0.5 rounded-full bg-primary text-white">
                    Current Level: {{ studentDetail.student.level }}
                  </span>
                  <span class="text-xs text-text-muted">@{{ studentDetail.student.username }}</span>
                </div>
                <p class="text-xs text-text-muted">
                  Completed in Level {{ studentDetail.student.level }}:
                  <strong class="text-text">{{ studentDetail.completed_activities_summary.by_category.grammar }}</strong> Grammar •
                  <strong class="text-text">{{ studentDetail.completed_activities_summary.by_category.vocabulary }}</strong> Vocabulary •
                  <strong class="text-text">{{ studentDetail.completed_activities_summary.by_category.listening }}</strong> Listening •
                  <strong class="text-text">{{ studentDetail.completed_activities_summary.by_category.reading }}</strong> Reading
                  ({{ studentDetail.completed_activities_summary.scraped_count }}/{{ studentDetail.completed_activities_summary.total }} scraped in DB)
                </p>
              </div>

              <div class="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  @click="handleSyncPlaywright(false)"
                  :disabled="isSyncingPlaywright || isGeneratingExam || isResettingExam"
                  class="px-3 py-2 rounded-xl bg-bg border border-border hover:border-primary/50 text-xs font-bold text-text flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                >
                  <RefreshCw class="w-3.5 h-3.5 text-primary" :class="isSyncingPlaywright ? 'animate-spin' : ''" />
                  <span>{{ isSyncingPlaywright ? 'Scraping...' : 'Verify (Playwright)' }}</span>
                </button>

                <button
                  v-if="hasAnyExamToReset"
                  type="button"
                  @click="isResetModalOpen = true"
                  :disabled="isResettingExam || isGeneratingExam"
                  class="px-3 py-2 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500 hover:text-white text-xs font-bold text-amber-500 flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  title="Reset or reopen this student's exam"
                >
                  <RotateCcw class="w-3.5 h-3.5" :class="isResettingExam ? 'animate-spin' : ''" />
                  <span>Reset Exam</span>
                </button>

                <button
                  type="button"
                  @click="handleGenerateExam"
                  :disabled="isGeneratingExam || isSyncingPlaywright || isResettingExam"
                  class="px-4 py-2 rounded-xl bg-primary text-white hover:opacity-90 text-xs font-bold flex items-center gap-1.5 shadow-glow transition-all cursor-pointer disabled:opacity-50"
                >
                  <Sparkles class="w-3.5 h-3.5" :class="isGeneratingExam ? 'animate-spin' : ''" />
                  <span>
                    {{
                      isGeneratingExam
                        ? 'Generating Exam...'
                        : activeExam
                        ? `Regenerate ${studentDetail.student.level} Exam`
                        : `Generate ${studentDetail.student.level} Exam`
                    }}
                  </span>
                </button>
              </div>
            </div>

            <!-- Sub-navigation Tabs -->
            <div class="flex flex-wrap items-center gap-2 pt-3 border-t border-border/60">
              <button
                type="button"
                @click="activeTab = 'questions'"
                class="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
                :class="
                  activeTab === 'questions'
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-bg border border-border text-text-muted hover:text-text'
                "
              >
                <CheckCircle2 class="w-3.5 h-3.5" />
                <span>Verify Questions &amp; AI Adjust</span>
                <span
                  v-if="activeExam"
                  class="px-1.5 py-0.2 rounded-full text-[0.65rem]"
                  :class="activeTab === 'questions' ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'"
                >
                  {{ activeExam.total_questions }}
                </span>
              </button>

              <button
                type="button"
                @click="activeTab = 'answers'"
                class="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
                :class="
                  activeTab === 'answers'
                    ? 'bg-primary text-white shadow-xs'
                    : answerableExams.length > 0
                    ? 'bg-primary/10 border border-primary/30 text-primary hover:bg-primary/15'
                    : 'bg-bg border border-border text-text-muted hover:text-text'
                "
              >
                <UserCheck class="w-3.5 h-3.5" />
                <span>View Student Answers</span>
                <span
                  class="px-1.5 py-0.2 rounded-full text-[0.65rem] font-black"
                  :class="activeTab === 'answers' ? 'bg-white/20 text-white' : 'bg-primary/15 text-primary'"
                >
                  {{ answerableExams.length }}
                </span>
              </button>

              <button
                type="button"
                @click="activeTab = 'activities'"
                class="px-4 py-2 rounded-xl text-xs font-bold flex items-center gap-2 transition-all cursor-pointer"
                :class="
                  activeTab === 'activities'
                    ? 'bg-primary text-white shadow-xs'
                    : 'bg-bg border border-border text-text-muted hover:text-text'
                "
              >
                <Layers class="w-3.5 h-3.5" />
                <span>Playwright Scraped Base (DB)</span>
                <span
                  class="px-1.5 py-0.2 rounded-full text-[0.65rem]"
                  :class="activeTab === 'activities' ? 'bg-white/20 text-white' : 'bg-primary/10 text-primary'"
                >
                  {{ completedActivities.length }}
                </span>
              </button>
            </div>
          </div>

          <!-- SCROLLABLE TAB CONTENT CONTAINER (Matches left Students List scroll) -->
          <div class="flex-1 min-h-0 max-h-[70vh] lg:max-h-none overflow-y-auto pr-1.5 space-y-4 custom-scrollbar">
            <!-- TAB 1: QUESTION VERIFICATION & REAL-TIME AI IMPROVEMENT -->
            <div v-if="activeTab === 'questions'" class="space-y-4 pb-2">
              <div v-if="!activeExam" class="bg-surface border border-border rounded-2xl p-10 text-center space-y-4">
                <div class="w-12 h-12 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
                  <ExamIcon class="w-6 h-6" />
                </div>
                <div class="space-y-1 max-w-md mx-auto">
                  <h4 class="text-sm font-bold text-text">No Active Exam Generated Yet for {{ studentDetail.student.name }}</h4>
                  <p class="text-xs text-text-muted leading-relaxed">
                    Click <strong>Generate {{ studentDetail.student.level }} Exam</strong> above. The system will verify the student's completed Grammar, Vocabulary, Listening, and Reading activities with Playwright, save their questions and texts in the database, and create the exam for your approval.
                  </p>
                </div>
                <div class="flex flex-wrap items-center justify-center gap-3 pt-1">
                  <button
                    type="button"
                    @click="handleGenerateExam"
                    :disabled="isGeneratingExam"
                    class="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold inline-flex items-center gap-2 shadow-glow cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles class="w-4 h-4" :class="isGeneratingExam ? 'animate-spin' : ''" />
                    <span>{{ isGeneratingExam ? 'Generating Personalized Exam...' : `Generate ${studentDetail.student.level} Exam Now` }}</span>
                  </button>

                  <button
                    v-if="answerableExams.length > 0"
                    type="button"
                    @click="activeTab = 'answers'"
                    class="px-5 py-2.5 rounded-xl bg-surface border border-primary/30 text-primary text-xs font-bold inline-flex items-center gap-2 hover:bg-primary/10 cursor-pointer"
                  >
                    <Eye class="w-4 h-4" />
                    <span>View {{ answerableExams.length }} Submitted Exam(s)</span>
                  </button>
                </div>
              </div>

              <template v-else>
                <!-- Sticky Approval Progress Bar -->
                <div class="sticky top-0 z-10 bg-surface/95 backdrop-blur-sm border border-border rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
                  <div class="flex flex-wrap items-center gap-2 text-xs">
                    <span class="font-bold text-text">
                      Exam Level {{ activeExam.level }} ({{ activeExam.status === 'in_progress' ? 'In Progress by Student' : 'Ready for Student' }})
                    </span>
                    <span class="px-2.5 py-0.5 rounded-full bg-success/10 text-success font-bold border border-success/25">
                      {{ activeExam.approval_summary.approved }} Approved
                    </span>
                    <span
                      v-if="activeExam.approval_summary.rejected > 0"
                      class="px-2.5 py-0.5 rounded-full bg-danger/10 text-danger font-bold border border-danger/25"
                    >
                      {{ activeExam.approval_summary.rejected }} Rejected
                    </span>
                    <span
                      v-if="activeExam.approval_summary.pending > 0"
                      class="px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-500 font-bold border border-amber-500/25"
                    >
                      {{ activeExam.approval_summary.pending }} Pending
                    </span>
                  </div>

                  <button
                    type="button"
                    @click="handleApproveAll"
                    :disabled="isBulkApproving || activeExam.approval_summary.approved === activeExam.approval_summary.total"
                    class="px-4 py-2 rounded-xl bg-success text-white text-xs font-bold flex items-center justify-center gap-1.5 hover:opacity-90 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Check class="w-4 h-4" />
                    <span>{{ isBulkApproving ? 'Approving...' : 'Approve All Questions' }}</span>
                  </button>
                </div>

                <!-- Question Cards -->
                <div
                  v-for="(q, idx) in activeExam.questions"
                  :key="q.id"
                  class="bg-surface border rounded-2xl p-5 space-y-4 transition-all shadow-xs"
                  :class="
                    recentlyUpdatedByQuestion[q.id]
                      ? 'border-primary ring-2 ring-primary/30'
                      : q.approval_status === 'approved'
                      ? 'border-success/40'
                      : q.approval_status === 'rejected'
                      ? 'border-danger/40'
                      : 'border-border'
                  "
                >
                  <!-- Header Row -->
                  <div class="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-border/60">
                    <div class="flex flex-wrap items-center gap-2">
                      <span class="w-7 h-7 rounded-lg bg-primary/10 text-primary text-xs font-black flex items-center justify-center">
                        {{ idx + 1 }}
                      </span>
                      <span
                        class="text-[0.68rem] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full border"
                        :class="getModalityBadgeClass(q.type)"
                      >
                        {{ q.type }}
                      </span>
                      <span class="text-xs text-text-muted font-semibold">{{ q.points || 10 }} pts</span>
                      <span
                        v-if="q.ai_updated"
                        class="text-[0.65rem] font-bold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/25 inline-flex items-center gap-1"
                      >
                        <Sparkles class="w-3 h-3" /> Updated by AI
                      </span>
                    </div>

                    <span
                      class="text-[0.68rem] font-bold uppercase px-2.5 py-1 rounded-full border"
                      :class="getApprovalBadgeClass(q.approval_status)"
                    >
                      {{ q.approval_status || 'pending' }}
                    </span>
                  </div>

                  <!-- Reading Text -->
                  <div v-if="q.reading_text" class="p-4 rounded-xl bg-bg border border-border/80 space-y-1.5">
                    <div class="flex items-center justify-between text-[0.68rem] font-bold uppercase tracking-wider text-primary">
                      <span class="flex items-center gap-1.5"><BookOpen class="w-3.5 h-3.5" /> Reading Passage</span>
                      <span class="text-text-muted">{{ countWords(q.reading_text) }} words</span>
                    </div>
                    <p class="text-xs sm:text-sm text-text leading-relaxed whitespace-pre-wrap">{{ q.reading_text }}</p>
                  </div>

                  <!-- Listening Script + Audio Preview -->
                  <div v-if="q.audio_text" class="p-4 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                    <div class="flex flex-wrap items-center justify-between gap-2">
                      <span class="text-[0.68rem] font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
                        <Volume2 class="w-3.5 h-3.5" /> Listening Script ({{ countWords(q.audio_text) }} words)
                      </span>
                      <button
                        type="button"
                        @click="handlePlayListeningPreview(q.id, q.audio_text)"
                        class="px-3 py-1 rounded-lg bg-primary text-white text-[0.7rem] font-bold inline-flex items-center gap-1.5 cursor-pointer hover:opacity-90"
                      >
                        <Pause v-if="playingAudioQId === q.id" class="w-3 h-3" />
                        <Play v-else class="w-3 h-3" />
                        <span>{{ playingAudioQId === q.id ? 'Pause TTS' : 'Listen Preview' }}</span>
                      </button>
                    </div>
                    <p class="text-xs sm:text-sm text-text italic leading-relaxed whitespace-pre-wrap">{{ q.audio_text }}</p>
                  </div>

                  <!-- Question Text -->
                  <div class="space-y-1">
                    <p class="text-sm font-bold text-text leading-snug">{{ q.question }}</p>
                    <p v-if="q.type === 'writing' && q.min_words && q.max_words" class="text-[0.7rem] text-text-muted">
                      Expected word count: <strong>{{ q.min_words }}–{{ q.max_words }} words</strong> (punctuation excluded from score deductions)
                    </p>
                    <p v-if="q.type === 'speaking' && q.min_seconds && q.max_seconds" class="text-[0.7rem] text-text-muted">
                      Expected speaking duration: <strong>{{ q.min_seconds }}–{{ q.max_seconds }} seconds</strong>
                    </p>
                  </div>

                  <!-- Multiple-Choice Options with Correct Answer Highlighted -->
                  <div v-if="q.options && q.options.length > 0 && q.type !== 'speaking'" class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div
                      v-for="(opt, oIdx) in q.options"
                      :key="oIdx"
                      class="p-3 rounded-xl border text-xs flex items-center justify-between gap-2"
                      :class="
                        opt === q.correct_answer
                          ? 'bg-success/10 border-success/40 text-success font-bold'
                          : 'bg-bg border-border text-text'
                      "
                    >
                      <span><strong>{{ ['A', 'B', 'C', 'D'][oIdx] || '•' }}.</strong> {{ opt }}</span>
                      <span v-if="opt === q.correct_answer" class="text-[0.65rem] font-black uppercase px-2 py-0.5 rounded bg-success text-white shrink-0">
                        Correct
                      </span>
                    </div>
                  </div>

                  <!-- Explanation -->
                  <div v-if="q.explanation" class="p-3 rounded-xl bg-bg-secondary/60 border border-border text-xs text-text-muted flex items-start gap-2">
                    <Lightbulb class="w-4 h-4 text-primary shrink-0 mt-0.5" />
                    <div>
                      <strong class="text-text">Rule / Explanation:</strong> {{ q.explanation }}
                    </div>
                  </div>

                  <!-- Previous Admin AI Note -->
                  <div v-if="q.admin_notes" class="text-[0.7rem] text-primary bg-primary/5 border border-primary/15 px-3 py-2 rounded-lg">
                    <strong>Last Admin Instruction:</strong> "{{ q.admin_notes }}"
                  </div>

                  <!-- Action Bar: Approve / Reject / AI Adjust / Manual Edit -->
                  <div class="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/60">
                    <div class="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        @click="handleSetQuestionStatus(q, 'approved')"
                        :disabled="statusLoadingByQuestion[q.id]"
                        class="px-3.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer border"
                        :class="
                          q.approval_status === 'approved'
                            ? 'bg-success text-white border-success'
                            : 'bg-success/10 text-success border-success/30 hover:bg-success hover:text-white'
                        "
                      >
                        <CheckCircle2 class="w-3.5 h-3.5" />
                        <span>Approve</span>
                      </button>

                      <button
                        type="button"
                        @click="handleSetQuestionStatus(q, 'rejected')"
                        :disabled="statusLoadingByQuestion[q.id]"
                        class="px-3.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer border"
                        :class="
                          q.approval_status === 'rejected'
                            ? 'bg-danger text-white border-danger'
                            : 'bg-danger/10 text-danger border-danger/30 hover:bg-danger hover:text-white'
                        "
                      >
                        <XCircle class="w-3.5 h-3.5" />
                        <span>Disapprove</span>
                      </button>
                    </div>

                    <div class="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        @click="toggleAiBox(q.id)"
                        class="px-3.5 py-1.5 rounded-xl text-xs font-bold inline-flex items-center gap-1.5 transition-all cursor-pointer border"
                        :class="
                          openAiBoxByQuestion[q.id]
                            ? 'bg-primary text-white border-primary'
                            : 'bg-primary/10 text-primary border-primary/30 hover:bg-primary hover:text-white'
                        "
                      >
                        <Wand2 class="w-3.5 h-3.5" />
                        <span>Suggest Improvement (AI)</span>
                      </button>

                      <button
                        type="button"
                        @click="toggleManualEdit(q)"
                        class="px-3 py-1.5 rounded-xl text-xs font-semibold bg-bg border border-border text-text-muted hover:text-text inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Edit3 class="w-3.5 h-3.5" />
                        <span>Manual Edit</span>
                      </button>
                    </div>
                  </div>

                  <!-- INLINE AI IMPROVEMENT PANEL -->
                  <div
                    v-if="openAiBoxByQuestion[q.id]"
                    class="p-4 rounded-2xl bg-primary/5 border border-primary/25 space-y-3 animate-fade-in"
                  >
                    <div class="flex items-center justify-between gap-2">
                      <span class="text-xs font-bold text-primary flex items-center gap-1.5">
                        <Sparkles class="w-4 h-4" />
                        What should the AI improve or change in Question {{ idx + 1 }}?
                      </span>
                      <span class="text-[0.68rem] text-text-muted">Updates immediately in English</span>
                    </div>

                    <!-- Quick Chips -->
                    <div class="flex flex-wrap gap-1.5">
                      <button
                        v-for="chip in QUICK_AI_SUGGESTIONS"
                        :key="chip"
                        type="button"
                        @click="aiSuggestionByQuestion[q.id] = chip"
                        class="text-[0.68rem] px-2.5 py-1 rounded-lg bg-surface border border-border hover:border-primary/50 text-text-muted hover:text-primary transition-colors cursor-pointer"
                      >
                        + {{ chip }}
                      </button>
                    </div>

                    <textarea
                      v-model="aiSuggestionByQuestion[q.id]"
                      rows="2"
                      placeholder="Ex: Deixe o vocabulário mais simples para A1 e troque o tema para rotina da manhã / Make option B less ambiguous..."
                      class="w-full px-3.5 py-2.5 rounded-xl bg-surface border border-border text-xs text-text outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-y"
                    ></textarea>

                    <div class="flex items-center justify-end gap-2">
                      <button
                        type="button"
                        @click="openAiBoxByQuestion[q.id] = false"
                        :disabled="aiLoadingByQuestion[q.id]"
                        class="px-3 py-1.5 rounded-xl text-xs font-semibold text-text-muted hover:text-text cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        @click="handleApplyAiImprovement(q)"
                        :disabled="aiLoadingByQuestion[q.id]"
                        class="px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold inline-flex items-center gap-1.5 shadow-glow hover:opacity-90 cursor-pointer disabled:opacity-50"
                      >
                        <RefreshCw v-if="aiLoadingByQuestion[q.id]" class="w-3.5 h-3.5 animate-spin" />
                        <Sparkles v-else class="w-3.5 h-3.5" />
                        <span>{{ aiLoadingByQuestion[q.id] ? 'AI Updating Question...' : 'Update Question Now with AI' }}</span>
                      </button>
                    </div>
                  </div>

                  <!-- INLINE MANUAL EDIT PANEL -->
                  <div
                    v-if="openManualEditByQuestion[q.id] && manualDraftByQuestion[q.id]"
                    class="p-4 rounded-2xl bg-bg-secondary/60 border border-border space-y-3 animate-fade-in"
                  >
                    <p class="text-xs font-bold text-text">Direct Question Editor</p>

                    <div v-if="q.type === 'reading'" class="space-y-1">
                      <label class="text-[0.68rem] font-bold text-text-muted uppercase">Reading Passage</label>
                      <textarea
                        v-model="manualDraftByQuestion[q.id].reading_text"
                        rows="3"
                        class="w-full px-3 py-2 rounded-xl bg-surface border border-border text-xs text-text outline-none focus:border-primary"
                      ></textarea>
                    </div>

                    <div v-if="q.type === 'listening'" class="space-y-1">
                      <label class="text-[0.68rem] font-bold text-text-muted uppercase">Listening Script</label>
                      <textarea
                        v-model="manualDraftByQuestion[q.id].audio_text"
                        rows="3"
                        class="w-full px-3 py-2 rounded-xl bg-surface border border-border text-xs text-text outline-none focus:border-primary"
                      ></textarea>
                    </div>

                    <div class="space-y-1">
                      <label class="text-[0.68rem] font-bold text-text-muted uppercase">Question Prompt</label>
                      <textarea
                        v-model="manualDraftByQuestion[q.id].question"
                        rows="2"
                        class="w-full px-3 py-2 rounded-xl bg-surface border border-border text-xs text-text outline-none focus:border-primary"
                      ></textarea>
                    </div>

                    <div v-if="manualDraftByQuestion[q.id].options?.length" class="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <div v-for="(_, oIdx) in manualDraftByQuestion[q.id].options" :key="oIdx" class="space-y-1">
                        <label class="text-[0.65rem] font-bold text-text-muted uppercase">Option {{ ['A', 'B', 'C', 'D'][oIdx] || oIdx + 1 }}</label>
                        <input
                          v-model="manualDraftByQuestion[q.id].options[oIdx]"
                          type="text"
                          class="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-xs text-text outline-none focus:border-primary"
                        />
                      </div>
                    </div>

                    <div v-if="q.type !== 'writing' && q.type !== 'speaking'" class="space-y-1">
                      <label class="text-[0.68rem] font-bold text-text-muted uppercase">Correct Answer (must match one option)</label>
                      <input
                        v-model="manualDraftByQuestion[q.id].correct_answer"
                        type="text"
                        class="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-xs text-text outline-none focus:border-primary"
                      />
                    </div>

                    <div class="space-y-1">
                      <label class="text-[0.68rem] font-bold text-text-muted uppercase">Explanation</label>
                      <input
                        v-model="manualDraftByQuestion[q.id].explanation"
                        type="text"
                        class="w-full px-3 py-1.5 rounded-lg bg-surface border border-border text-xs text-text outline-none focus:border-primary"
                      />
                    </div>

                    <div class="flex justify-end gap-2 pt-1">
                      <button
                        type="button"
                        @click="openManualEditByQuestion[q.id] = false"
                        class="px-3 py-1.5 rounded-xl text-xs font-semibold text-text-muted hover:text-text cursor-pointer"
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        @click="handleSaveManualEdit(q)"
                        :disabled="manualSavingByQuestion[q.id]"
                        class="px-4 py-1.5 rounded-xl bg-primary text-white text-xs font-bold cursor-pointer disabled:opacity-50"
                      >
                        {{ manualSavingByQuestion[q.id] ? 'Saving...' : 'Save Question' }}
                      </button>
                    </div>
                  </div>
                </div>
              </template>
            </div>

            <!-- TAB 2: STUDENT ANSWERS & LEVEL DIAGNOSTIC -->
            <div v-else-if="activeTab === 'answers'" class="space-y-4 pb-2">
              <div v-if="answerableExams.length === 0" class="bg-surface border border-border rounded-2xl p-10 text-center space-y-2">
                <Award class="w-10 h-10 text-text-subtle mx-auto" />
                <h4 class="text-sm font-bold text-text">No Exam Answers Recorded Yet</h4>
                <p class="text-xs text-text-muted max-w-md mx-auto">
                  Once {{ studentDetail.student.name }} answers an exam, all selected multiple-choice alternatives, written paragraphs, oral speaking transcriptions, and CEFR skill breakdown will appear here.
                </p>
              </div>

              <template v-else-if="selectedAnsweredExam">
                <!-- Attempt Selector if multiple exams -->
                <div v-if="answerableExams.length > 1" class="flex flex-wrap items-center gap-2">
                  <button
                    v-for="(ce, cIdx) in answerableExams"
                    :key="ce.id"
                    type="button"
                    @click="selectedCompletedExamIdx = cIdx"
                    class="px-3.5 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer"
                    :class="
                      selectedCompletedExamIdx === cIdx
                        ? 'bg-primary text-white border-primary shadow-xs'
                        : 'bg-surface border-border text-text-muted hover:text-text'
                    "
                  >
                    <template v-if="ce.is_in_progress_preview">
                      {{ ce.level }} • In Progress ({{ ce.answered_count }}/{{ ce.total_questions }} answered)
                    </template>
                    <template v-else>
                      {{ ce.level }} • {{ ce.score }}% ({{ formatDate(ce.completed_at) }})
                    </template>
                  </button>
                </div>

                <!-- Overall Proficiency Diagnostic Card -->
                <div class="bg-surface border border-border rounded-2xl p-6 space-y-5 shadow-xs">
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border/60 pb-4">
                    <div class="space-y-1">
                      <div class="flex flex-wrap items-center gap-2">
                        <template v-if="selectedAnsweredExam.is_in_progress_preview">
                          <span class="text-sm font-black px-3 py-1 rounded-full bg-amber-500/15 text-amber-500 border border-amber-500/30">
                            In Progress ({{ selectedAnsweredExam.answered_count }}/{{ selectedAnsweredExam.total_questions }} answered)
                          </span>
                        </template>
                        <template v-else>
                          <span class="text-2xl font-black text-text">{{ selectedAnsweredExam.score }}%</span>
                          <span
                            class="text-xs font-bold px-2.5 py-0.5 rounded-full border"
                            :class="selectedAnsweredExam.passed ? 'bg-success/10 text-success border-success/30' : 'bg-amber-500/10 text-amber-500 border-amber-500/30'"
                          >
                            {{ selectedAnsweredExam.passed ? 'Passed Level Assessment' : 'Needs Reinforcement' }}
                          </span>
                        </template>

                        <span class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-primary/10 text-primary">
                          Exam Level: {{ selectedAnsweredExam.level }}
                        </span>
                        <span
                          v-if="selectedAnsweredExam.recommended_level"
                          class="text-xs font-bold px-2.5 py-0.5 rounded-full bg-emerald-500/10 text-emerald-500 border border-emerald-500/25"
                        >
                          Recommended Next: {{ selectedAnsweredExam.recommended_level }}
                        </span>
                      </div>
                      <p class="text-xs text-text-muted">
                        {{
                          selectedAnsweredExam.is_in_progress_preview
                            ? `Started on ${formatDate(selectedAnsweredExam.started_at)}`
                            : `Completed on ${formatDate(selectedAnsweredExam.completed_at)}`
                        }}
                      </p>
                    </div>

                    <!-- Per-Attempt Reset / Delete Actions -->
                    <div class="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        @click="handleResetExam('reopen', selectedAnsweredExam.id)"
                        :disabled="isResettingExam"
                        class="px-3 py-1.5 rounded-xl bg-amber-500/10 border border-amber-500/30 hover:bg-amber-500 hover:text-white text-xs font-bold text-amber-500 inline-flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                        title="Clear answers and reopen this exam so the student can retake it immediately"
                      >
                        <RotateCcw class="w-3.5 h-3.5" />
                        <span>Allow Retake</span>
                      </button>

                      <button
                        type="button"
                        @click="handleResetExam('delete_one', selectedAnsweredExam.id)"
                        :disabled="isResettingExam"
                        class="px-3 py-1.5 rounded-xl bg-danger/10 border border-danger/30 hover:bg-danger hover:text-white text-xs font-bold text-danger inline-flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                        title="Delete this exam attempt"
                      >
                        <Trash2 class="w-3.5 h-3.5" />
                        <span>Delete Attempt</span>
                      </button>
                    </div>
                  </div>

                  <p v-if="selectedAnsweredExam.summary_feedback" class="text-xs sm:text-sm text-text leading-relaxed bg-bg p-4 rounded-xl border border-border">
                    {{ selectedAnsweredExam.summary_feedback }}
                  </p>

                  <!-- Skills Breakdown Bars -->
                  <div v-if="selectedAnsweredExam.skills_breakdown && Object.keys(selectedAnsweredExam.skills_breakdown).length" class="space-y-3">
                    <h4 class="text-xs font-bold uppercase tracking-wider text-text-subtle">
                      Proficiency Breakdown by Modality
                    </h4>
                    <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div
                        v-for="(sInfo, sKey) in selectedAnsweredExam.skills_breakdown"
                        :key="sKey"
                        class="p-3 rounded-xl bg-bg border border-border space-y-1.5"
                      >
                        <div class="flex items-center justify-between text-xs">
                          <span class="font-bold text-text capitalize">{{ sInfo.label || sKey }}</span>
                          <span class="font-black" :class="sInfo.percentage >= 65 ? 'text-success' : 'text-amber-500'">
                            {{ sInfo.correct }}/{{ sInfo.total }} ({{ sInfo.percentage }}%)
                          </span>
                        </div>
                        <div class="w-full h-2 rounded-full bg-border/50 overflow-hidden">
                          <div
                            class="h-full rounded-full transition-all"
                            :class="sInfo.percentage >= 65 ? 'bg-success' : 'bg-amber-500'"
                            :style="{ width: `${sInfo.percentage}%` }"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <!-- Improvements Needed -->
                  <div v-if="selectedAnsweredExam.points_to_improve?.length" class="space-y-2">
                    <h4 class="text-xs font-bold uppercase tracking-wider text-amber-500 flex items-center gap-1.5">
                      <AlertCircle class="w-3.5 h-3.5" /> Areas the Student Needs to Improve
                    </h4>
                    <div class="grid grid-cols-1 gap-2">
                      <div
                        v-for="(pt, pIdx) in selectedAnsweredExam.points_to_improve"
                        :key="pIdx"
                        class="px-3.5 py-2.5 rounded-xl bg-amber-500/5 border border-amber-500/20 text-xs text-text"
                      >
                        • {{ pt }}
                      </div>
                    </div>
                  </div>
                </div>

                <!-- Detailed Student Answers Question-by-Question -->
                <div class="bg-surface border border-border rounded-2xl p-6 space-y-4 shadow-xs">
                  <h4 class="text-sm font-bold text-text flex items-center gap-2">
                    <FileText class="w-4 h-4 text-primary" />
                    <span>Student Answers Question by Question ({{ selectedAnsweredExam.corrections?.length || 0 }})</span>
                  </h4>

                  <div class="space-y-4">
                    <div
                      v-for="(corr, cIdx) in selectedAnsweredExam.corrections"
                      :key="cIdx"
                      class="p-5 rounded-2xl border space-y-3 bg-surface shadow-xs"
                      :class="corr.is_correct ? 'border-success/35' : 'border-danger/35'"
                    >
                      <div class="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-border/60">
                        <div class="flex items-center gap-2">
                          <span class="w-7 h-7 rounded-lg bg-primary/10 text-primary text-xs font-black flex items-center justify-center">
                            {{ Number(cIdx) + 1 }}
                          </span>
                          <span
                            class="text-[0.65rem] font-bold uppercase px-2.5 py-0.5 rounded-full border"
                            :class="getModalityBadgeClass(corr.type)"
                          >
                            {{ corr.type }}
                          </span>
                        </div>
                        <span
                          class="text-xs font-bold px-2.5 py-0.5 rounded-full"
                          :class="corr.is_correct ? 'bg-success/15 text-success' : 'bg-danger/15 text-danger'"
                        >
                          {{ corr.is_correct ? `Correct (+${corr.points_earned} pts)` : `Needs Work (+${corr.points_earned || 0} pts)` }}
                        </span>
                      </div>

                      <!-- Context Passage or Listening Script -->
                      <div v-if="corr.reading_text" class="p-3.5 rounded-xl bg-bg border border-border text-xs space-y-1">
                        <span class="text-[0.65rem] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                          <BookOpen class="w-3 h-3" /> Reading Text
                        </span>
                        <p class="text-text leading-relaxed whitespace-pre-wrap">{{ corr.reading_text }}</p>
                      </div>

                      <div v-if="corr.audio_text" class="p-3.5 rounded-xl bg-primary/5 border border-primary/20 text-xs space-y-1.5">
                        <div class="flex items-center justify-between gap-2">
                          <span class="text-[0.65rem] font-bold uppercase tracking-wider text-primary flex items-center gap-1">
                            <Volume2 class="w-3 h-3" /> Listening Script
                          </span>
                          <button
                            type="button"
                            @click="handlePlayListeningPreview(`ans_${selectedAnsweredExam.id}_${corr.question_id}`, corr.audio_text)"
                            class="px-2.5 py-1 rounded-lg bg-primary text-white text-[0.68rem] font-bold inline-flex items-center gap-1 cursor-pointer"
                          >
                            <Pause v-if="playingAudioQId === `ans_${selectedAnsweredExam.id}_${corr.question_id}`" class="w-3 h-3" />
                            <Play v-else class="w-3 h-3" />
                            <span>Listen</span>
                          </button>
                        </div>
                        <p class="text-text italic leading-relaxed whitespace-pre-wrap">{{ corr.audio_text }}</p>
                      </div>

                      <!-- Question Prompt -->
                      <p class="text-xs sm:text-sm font-bold text-text leading-snug">{{ corr.question }}</p>

                      <!-- All 4 Multiple-Choice Options showing Student Selection vs Correct Answer -->
                      <div
                        v-if="corr.options && corr.options.length > 0 && corr.type !== 'speaking' && corr.type !== 'writing'"
                        class="grid grid-cols-1 sm:grid-cols-2 gap-2"
                      >
                        <div
                          v-for="(opt, oIdx) in corr.options"
                          :key="oIdx"
                          class="p-3 rounded-xl border text-xs flex items-center justify-between gap-2"
                          :class="
                            isOptionSelectedByStudent(opt, corr) && isOptionCorrect(opt, corr)
                              ? 'bg-success/15 border-success text-success font-bold'
                              : isOptionSelectedByStudent(opt, corr) && !isOptionCorrect(opt, corr)
                              ? 'bg-danger/15 border-danger text-danger font-bold'
                              : isOptionCorrect(opt, corr)
                              ? 'bg-success/10 border-success/40 text-success font-bold'
                              : 'bg-bg border-border text-text'
                          "
                        >
                          <span><strong>{{ ['A', 'B', 'C', 'D'][oIdx] || '•' }}.</strong> {{ opt }}</span>
                          <div class="flex items-center gap-1 shrink-0">
                            <span
                              v-if="isOptionSelectedByStudent(opt, corr)"
                              class="text-[0.6rem] font-black uppercase px-1.5 py-0.5 rounded"
                              :class="isOptionCorrect(opt, corr) ? 'bg-success text-white' : 'bg-danger text-white'"
                            >
                              Student's Choice
                            </span>
                            <span
                              v-else-if="isOptionCorrect(opt, corr)"
                              class="text-[0.6rem] font-black uppercase px-1.5 py-0.5 rounded bg-success text-white"
                            >
                              Correct
                            </span>
                          </div>
                        </div>
                      </div>

                      <!-- Student Written / Spoken / Direct Answer Box -->
                      <div class="p-3.5 rounded-xl bg-bg border border-border text-xs space-y-2">
                        <div>
                          <span class="text-text-muted font-semibold">
                            {{
                              corr.type === 'writing'
                                ? `Student's Written Text (${countWords(corr.raw_student_answer || corr.student_answer)} words): `
                                : corr.type === 'speaking'
                                ? "Student's Spoken Response & Transcription: "
                                : "Student's Answer: "
                            }}
                          </span>
                          <p
                            class="mt-1 font-semibold whitespace-pre-wrap leading-relaxed"
                            :class="corr.is_correct ? 'text-success' : 'text-danger'"
                          >
                            {{ corr.student_answer || '(not answered)' }}
                          </p>
                        </div>

                        <!-- Recorded Voice Playback if audio was saved -->
                        <div v-if="corr.student_audio_data" class="pt-1">
                          <p class="text-[0.68rem] font-bold text-text-muted flex items-center gap-1 mb-1">
                            <Mic class="w-3 h-3 text-primary" /> Recorded Student Audio:
                          </p>
                          <audio :src="corr.student_audio_data" controls class="w-full h-9" />
                        </div>

                        <div v-if="corr.correct_answer && corr.type !== 'speaking'" class="pt-1 border-t border-border/60">
                          <span class="text-text-muted font-semibold">
                            {{ corr.type === 'writing' ? 'AI Polished Reference Version: ' : 'Expected Correct Answer: ' }}
                          </span>
                          <p class="mt-0.5 font-bold text-success whitespace-pre-wrap leading-relaxed">{{ corr.correct_answer }}</p>
                        </div>
                      </div>

                      <!-- AI Feedback & Specific Improvements -->
                      <div v-if="corr.explanation" class="text-xs text-text-muted bg-bg-secondary/50 p-3.5 rounded-xl border border-border space-y-1.5">
                        <div>
                          <strong class="text-text">AI Feedback &amp; Evaluation:</strong> {{ corr.explanation }}
                        </div>
                        <ul v-if="corr.improvements?.length" class="list-disc pl-4 space-y-0.5 text-text pt-1">
                          <li v-for="(imp, iIdx) in corr.improvements" :key="iIdx">{{ imp }}</li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </template>
            </div>

            <!-- TAB 3: PLAYWRIGHT VERIFIED ACTIVITIES IN DATABASE -->
            <div v-else-if="activeTab === 'activities'" class="space-y-4 pb-2">
              <div v-if="completedActivities.length === 0" class="bg-surface border border-border rounded-2xl p-10 text-center space-y-2">
                <Layers class="w-10 h-10 text-text-subtle mx-auto" />
                <h4 class="text-sm font-bold text-text">
                  No Completed Grammar–Reading Activities Found at Level {{ studentDetail.student.level }}
                </h4>
                <p class="text-xs text-text-muted max-w-md mx-auto">
                  {{ studentDetail.student.name }} has not yet completed Grammar, Vocabulary, Listening, or Reading exercises at level {{ studentDetail.student.level }}. (Music, Flashcards, Simulations, Games, and News are excluded from exams.)
                </p>
              </div>

              <div v-else class="space-y-3">
                <div
                  v-for="(act, aIdx) in completedActivities"
                  :key="act.submission_id || aIdx"
                  class="bg-surface border border-border rounded-2xl p-4 space-y-3 shadow-xs"
                >
                  <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <div class="space-y-1 min-w-0">
                      <div class="flex flex-wrap items-center gap-2">
                        <span
                          class="text-[0.65rem] font-bold uppercase px-2 py-0.5 rounded-full border"
                          :class="getModalityBadgeClass(act.category)"
                        >
                          {{ act.category }}
                        </span>
                        <span class="text-xs sm:text-sm font-bold text-text truncate">{{ act.title }}</span>
                        <span
                          class="text-[0.65rem] font-bold px-2 py-0.5 rounded-full border"
                          :class="act.scraped ? 'bg-success/10 text-success border-success/30' : 'bg-amber-500/10 text-amber-500 border-amber-500/30'"
                        >
                          {{ act.scraped ? `Saved in DB (${act.questions_count} Qs)` : 'Pending Playwright Sync' }}
                        </span>
                      </div>
                      <div class="flex flex-wrap items-center gap-3 text-[0.7rem] text-text-muted">
                        <span>Completed: {{ formatDate(act.completed_at) }}</span>
                        <a
                          v-if="act.url"
                          :href="act.url"
                          target="_blank"
                          rel="noopener noreferrer"
                          class="text-primary hover:underline inline-flex items-center gap-1 font-semibold"
                        >
                          <span>Source Activity</span>
                          <ExternalLink class="w-3 h-3" />
                        </a>
                      </div>
                    </div>

                    <button
                      v-if="act.scraped"
                      type="button"
                      @click="toggleActivityExpand(act.url || String(aIdx))"
                      class="px-3 py-1.5 rounded-xl bg-bg border border-border text-xs font-bold text-text-muted hover:text-text inline-flex items-center gap-1.5 cursor-pointer shrink-0"
                    >
                      <span>{{ expandedActivities[act.url || String(aIdx)] ? 'Hide Extracted Data' : 'View Extracted Questions' }}</span>
                      <ChevronUp v-if="expandedActivities[act.url || String(aIdx)]" class="w-3.5 h-3.5" />
                      <ChevronDown v-else class="w-3.5 h-3.5" />
                    </button>
                  </div>

                  <!-- Expanded Scraped Questions & Passages from DB -->
                  <div
                    v-if="act.scraped && expandedActivities[act.url || String(aIdx)]"
                    class="pt-3 border-t border-border/60 space-y-3 animate-fade-in"
                  >
                    <div v-if="act.reading_text" class="p-3 rounded-xl bg-bg border border-border text-xs space-y-1">
                      <p class="font-bold text-primary uppercase text-[0.65rem]">Extracted Reading Text (Saved in DB):</p>
                      <p class="text-text whitespace-pre-wrap leading-relaxed">{{ act.reading_text }}</p>
                    </div>

                    <div v-if="act.audio_text" class="p-3 rounded-xl bg-primary/5 border border-primary/20 text-xs space-y-1">
                      <p class="font-bold text-primary uppercase text-[0.65rem]">Extracted Listening Context &amp; Details (Saved in DB):</p>
                      <p class="text-text whitespace-pre-wrap leading-relaxed">{{ act.audio_text }}</p>
                    </div>

                    <div v-if="act.questions && act.questions.length" class="space-y-2">
                      <p class="text-[0.68rem] font-bold uppercase tracking-wider text-text-subtle">
                        Extracted Questions &amp; Correct Answers ({{ act.questions.length }}):
                      </p>
                      <div
                        v-for="(sq, sqIdx) in act.questions"
                        :key="sqIdx"
                        class="p-3 rounded-xl bg-bg border border-border text-xs space-y-1"
                      >
                        <p class="font-bold text-text">{{ sq.number || Number(sqIdx) + 1 }}. {{ sq.question }}</p>
                        <p v-if="sq.options?.length" class="text-text-muted">
                          Options: {{ sq.options.join(' | ') }}
                        </p>
                        <p class="text-success font-bold">Correct Answer: {{ sq.correct_answer || '—' }}</p>
                        <p v-if="sq.explanation" class="text-text-muted italic">{{ sq.explanation }}</p>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </template>
      </div>
    </div>

    <!-- RESET EXAM MODAL -->
    <div
      v-if="isResetModalOpen && studentDetail"
      class="fixed inset-0 z-[90] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 animate-fade-in"
      @click.self="isResetModalOpen = false"
    >
      <div class="bg-surface border border-border rounded-2xl max-w-md w-full p-6 space-y-5 shadow-2xl">
        <div class="flex items-start justify-between gap-3">
          <div class="flex items-center gap-2.5">
            <div class="w-9 h-9 rounded-xl bg-amber-500/15 text-amber-500 flex items-center justify-center shrink-0">
              <RotateCcw class="w-4 h-4" />
            </div>
            <div>
              <h3 class="text-sm sm:text-base font-bold text-text">Reset Exam — {{ studentDetail.student.name }}</h3>
              <p class="text-xs text-text-muted">Choose how you would like to reset this student's exam:</p>
            </div>
          </div>
          <button
            type="button"
            @click="isResetModalOpen = false"
            class="p-1.5 rounded-lg text-text-muted hover:text-text cursor-pointer"
          >
            <X class="w-4 h-4" />
          </button>
        </div>

        <div class="space-y-3">
          <button
            type="button"
            @click="handleResetExam('reopen')"
            :disabled="isResettingExam"
            class="w-full p-4 rounded-xl bg-bg hover:bg-primary/5 border border-border hover:border-primary/40 text-left space-y-1 transition-all cursor-pointer disabled:opacity-50"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-primary flex items-center gap-1.5">
                <RotateCcw class="w-3.5 h-3.5" /> Allow Retake (Keep Approved Questions)
              </span>
            </div>
            <p class="text-[0.72rem] text-text-muted leading-relaxed">
              Clears previous answers and unlocks the 90-day cooldown immediately so the student can retake the current exam with its existing questions.
            </p>
          </button>

          <button
            type="button"
            @click="handleResetExam('clear_all')"
            :disabled="isResettingExam"
            class="w-full p-4 rounded-xl bg-bg hover:bg-danger/5 border border-border hover:border-danger/40 text-left space-y-1 transition-all cursor-pointer disabled:opacity-50"
          >
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-danger flex items-center gap-1.5">
                <Trash2 class="w-3.5 h-3.5" /> Full Reset (Clear All Exams &amp; Cooldown)
              </span>
            </div>
            <p class="text-[0.72rem] text-text-muted leading-relaxed">
              Deletes all exam records for this student and completely resets their quarterly exam cycle so a brand-new exam can be generated.
            </p>
          </button>
        </div>

        <div class="flex justify-end pt-1">
          <button
            type="button"
            @click="isResetModalOpen = false"
            :disabled="isResettingExam"
            class="px-4 py-2 rounded-xl text-xs font-semibold text-text-muted hover:text-text cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
