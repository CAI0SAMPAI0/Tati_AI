<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
import {
  Compass,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Unlock,
  Swords,
  Trophy,
  BookOpen,
  Headphones,
  Music,
  Gamepad2,
  Sparkles,
  Users,
  FileText,
  Search,
  Edit2,
  Check,
  ChevronDown,
  Loader2,
} from 'lucide-vue-next';
import { apiGet, apiPost } from '@/api/client';
import { useToast } from '@/composables/useToast';
import { DEFAULT_AVATAR_URL } from '@/constants/user';

interface Step {
  id: string;
  category: string;
  title: string;
  description?: string;
  route?: string;
  target_count?: number;
  progress?: number;
  is_completed?: boolean;
  completed_at?: string | null;
}

interface BossFight {
  id?: string;
  title: string;
  description: string;
  min_score: number;
  is_unlocked: boolean;
  is_completed: boolean;
  score?: number | null;
  completed_at?: string | null;
  teacher_feedback?: string | null;
  route?: string;
}

interface Phase {
  id: string;
  number: number;
  title: string;
  description: string;
  duration_days: number;
  status: 'active' | 'completed' | 'locked';
  steps: Step[];
  boss_fight: BossFight;
  steps_completed_count?: number;
  total_steps_count?: number;
}

interface LearningTrail {
  trail_id?: string;
  title: string;
  level: string;
  teacher_notes?: string;
  phases: Phase[];
  updated_at?: string;
  updated_by?: string;
}

interface CatalogItem {
  id: string;
  title: string;
  level: string;
  category: string;
  route: string;
}

const toast = useToast();

const students = ref<any[]>([]);
const selectedUsername = ref<string>('');
const searchQuery = ref('');
const isLoadingStudents = ref(false);
const isLoadingTrail = ref(false);
const isSaving = ref(false);
const isApplyingTemplate = ref(false);

const trail = ref<LearningTrail | null>(null);

// Modal de adicionar / editar etapa
const isStepModalOpen = ref(false);
const isEditingStep = ref(false);
const editingStepId = ref<string | null>(null);
const targetPhaseId = ref<string>('');

const newStepCategory = ref<string>('grammar');
const newStepTitle = ref<string>('');
const newStepDescription = ref<string>('');
const newStepRoute = ref<string>('/activities?tab=grammar');

// Autocomplete do Catálogo
const catalogSuggestions = ref<CatalogItem[]>([]);
const isSearchingCatalog = ref(false);
const showSuggestions = ref(false);
let searchDebounceTimer: any = null;

// Categorias
const CATEGORIES = [
  { id: 'grammar', label: 'Grammar', icon: FileText, tab: 'grammar', color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' },
  { id: 'vocabulary', label: 'Vocabulary', icon: BookOpen, tab: 'vocabulary', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
  { id: 'reading', label: 'Reading', icon: BookOpen, tab: 'reading', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
  { id: 'listening', label: 'Listening / Podcast', icon: Headphones, tab: 'listening', color: 'text-purple-500 bg-purple-500/10 border-purple-500/20' },
  { id: 'simulations', label: 'Simulations / Voice', icon: Users, tab: 'simulations', color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' },
  { id: 'music', label: 'Music & Lyrics', icon: Music, tab: 'musics', color: 'text-pink-500 bg-pink-500/10 border-pink-500/20' },
  { id: 'games', label: 'Games & Wordwall', icon: Gamepad2, tab: 'games', color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20' },
  { id: 'flashcards', label: 'Flashcards (SRS)', icon: Sparkles, tab: 'flashcards', color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20' },
  { id: 'custom', label: 'Custom Quest', icon: FileText, tab: 'grammar', color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20' },
];

function handleLearningTrailUpdate(event?: any) {
  const data = event?.detail || event;
  if (!data) return;

  // Atualização instantânea em memória se for o aluno atualmente selecionado
  if (selectedUsername.value && data.student_username === selectedUsername.value && trail.value) {
    let stepFound = false;
    for (const phase of trail.value.phases) {
      if (!data.phase_id || phase.id === data.phase_id) {
        const step = phase.steps.find((s) => s.id === data.step_id);
        if (step) {
          step.is_completed = data.is_completed;
          step.progress = data.is_completed ? (step.target_count || 1) : 0;
          stepFound = true;
        }
        if (data.boss_unlocked !== undefined && phase.boss_fight) {
          phase.boss_fight.is_unlocked = data.boss_unlocked;
        }
      }
    }
    trail.value = { ...trail.value };

    if (!stepFound) {
      loadTrail(selectedUsername.value);
    }
  }

  if (data.student_name && data.step_title) {
    toast.info(
      `${data.student_name}: "${data.step_title}" marked as ${
        data.is_completed ? 'Completed' : 'Pending'
      }`
    );
  }
}

onMounted(() => {
  loadStudents();

  window.addEventListener(
    'learning-trail-step-updated',
    handleLearningTrailUpdate
  );
});

onUnmounted(() => {
  window.removeEventListener(
    'learning-trail-step-updated',
    handleLearningTrailUpdate
  );
});

function getCategoryMeta(cat: string) {
  const c = (cat || '').toLowerCase();
  return (
    CATEGORIES.find((item) => item.id === c) || {
      id: cat,
      label: cat.toUpperCase(),
      icon: Compass,
      tab: 'grammar',
      color: 'text-primary bg-primary/10 border-primary/20',
    }
  );
}

// Filtro de alunos
const filteredStudents = computed(() => {
  if (!searchQuery.value.trim()) return students.value;
  const q = searchQuery.value.toLowerCase();
  return students.value.filter(
    (s) =>
      (s.name || '').toLowerCase().includes(q) ||
      (s.username || '').toLowerCase().includes(q) ||
      (s.level || '').toLowerCase().includes(q)
  );
});

const currentStudent = computed(() => {
  return students.value.find((s) => s.username === selectedUsername.value) || null;
});

async function loadStudents() {
  isLoadingStudents.value = true;
  try {
    const res = await apiGet<any[]>('/dashboard/students');
    students.value = Array.isArray(res) ? res : [];
    if (students.value.length > 0 && !selectedUsername.value) {
      selectedUsername.value = students.value[0].username;
      loadTrail(selectedUsername.value);
    }
  } catch (err) {
    toast.error('Erro ao listar estudantes.');
  } finally {
    isLoadingStudents.value = false;
  }
}

async function loadTrail(username: string) {
  if (!username) return;
  isLoadingTrail.value = true;
  try {
    const res = await apiGet<LearningTrail>(`/dashboard/students/${username}/trail`);
    trail.value = res;
  } catch (err) {
    toast.error('Erro ao carregar trilha do aluno.');
  } finally {
    isLoadingTrail.value = false;
  }
}

watch(selectedUsername, (newVal) => {
  if (newVal) {
    loadTrail(newVal);
  }
});

// Autocomplete de atividades
async function fetchCatalogSuggestions(queryText = '') {
  const cleanQ = queryText.trim();
  if (cleanQ.length < 2) {
    catalogSuggestions.value = [];
    showSuggestions.value = false;
    return;
  }
  isSearchingCatalog.value = true;
  try {
    const cat = newStepCategory.value;
    const res = await apiGet<{ items: CatalogItem[] }>(
      `/dashboard/activities/catalog?category=${cat}&query=${encodeURIComponent(cleanQ)}`
    );
    catalogSuggestions.value = res?.items || [];
    showSuggestions.value = catalogSuggestions.value.length > 0;
  } catch (err) {
    catalogSuggestions.value = [];
    showSuggestions.value = false;
  } finally {
    isSearchingCatalog.value = false;
  }
}

function handleTitleInput() {
  clearTimeout(searchDebounceTimer);
  const q = newStepTitle.value.trim();
  if (q.length < 2) {
    catalogSuggestions.value = [];
    showSuggestions.value = false;
    return;
  }
  searchDebounceTimer = setTimeout(() => {
    fetchCatalogSuggestions(q);
  }, 250);
}

function handleCategoryChange() {
  catalogSuggestions.value = [];
  showSuggestions.value = false;
  const meta = getCategoryMeta(newStepCategory.value);
  if (newStepCategory.value === 'simulations') {
    newStepRoute.value = '/voice';
  } else {
    newStepRoute.value = `/activities?tab=${meta.tab}`;
  }
  const q = newStepTitle.value.trim();
  if (q.length >= 2) {
    fetchCatalogSuggestions(q);
  }
}

function handleSelectSuggestion(item: CatalogItem) {
  newStepTitle.value = item.title;
  newStepRoute.value = item.route;
  showSuggestions.value = false;
}

// Abertura do modal para adicionar ou editar
function openAddStepModal(phaseId: string) {
  targetPhaseId.value = phaseId;
  isEditingStep.value = false;
  editingStepId.value = null;
  newStepCategory.value = 'grammar';
  newStepTitle.value = '';
  newStepDescription.value = '';
  newStepRoute.value = '/activities?tab=grammar';
  catalogSuggestions.value = [];
  showSuggestions.value = false;
  isStepModalOpen.value = true;
}

function openEditStepModal(phaseId: string, step: Step) {
  targetPhaseId.value = phaseId;
  isEditingStep.value = true;
  editingStepId.value = step.id;
  newStepCategory.value = step.category || 'grammar';
  newStepTitle.value = step.title;
  newStepDescription.value = step.description || '';
  newStepRoute.value = step.route || `/activities?tab=${newStepCategory.value}`;
  catalogSuggestions.value = [];
  showSuggestions.value = false;
  isStepModalOpen.value = true;
}

function handleSaveStep() {
  if (!trail.value || !targetPhaseId.value) return;
  if (!newStepTitle.value.trim()) {
    toast.error('Please enter the activity title.');
    return;
  }

  const phase = trail.value.phases.find((p) => p.id === targetPhaseId.value);
  if (!phase) return;

  const cat = newStepCategory.value;
  let resolvedRoute = (newStepRoute.value || '').trim();
  if (!resolvedRoute || resolvedRoute.startsWith('/grammar') || resolvedRoute.startsWith('/vocabulary') || resolvedRoute.startsWith('/activities')) {
    if (cat === 'simulations') {
      resolvedRoute = '/voice';
    } else {
      const match = catalogSuggestions.value.find(
        (s) => s.title.toLowerCase() === newStepTitle.value.trim().toLowerCase()
      );
      if (match?.route) {
        resolvedRoute = match.route;
      } else {
        const cleanSlug = newStepTitle.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        resolvedRoute = `https://test-english.com/${cat}/${cleanSlug}/`;
      }
    }
  }

  if (isEditingStep.value && editingStepId.value) {
    const existing = phase.steps.find((s) => s.id === editingStepId.value);
    if (existing) {
      existing.category = newStepCategory.value;
      existing.title = newStepTitle.value.trim();
      existing.description = newStepDescription.value.trim();
      existing.route = resolvedRoute;
      toast.success('Activity updated! Remember to save the trail.');
    }
  } else {
    const newStep: Step = {
      id: `step-${Date.now().toString(36)}`,
      category: newStepCategory.value,
      title: newStepTitle.value.trim(),
      description: newStepDescription.value.trim(),
      route: resolvedRoute,
      target_count: 1,
      progress: 0,
      is_completed: false,
      completed_at: null,
    };
    phase.steps.push(newStep);
    toast.success('Activity added to phase! Remember to save the trail.');
  }

  isStepModalOpen.value = false;
}

function handleDeleteStep(phase: Phase, stepIdx: number) {
  phase.steps.splice(stepIdx, 1);
  toast.success('Activity removed.');
}

async function handleSaveTrail() {
  if (!trail.value || !selectedUsername.value) return;
  isSaving.value = true;
  try {
    const res = await apiPost<LearningTrail>(`/dashboard/students/${selectedUsername.value}/trail`, {
      trail: trail.value,
    });
    trail.value = res;
    toast.success('Student trail saved successfully!');
  } catch (err: any) {
    toast.error(err?.message || 'Error saving trail.');
  } finally {
    isSaving.value = false;
  }
}

async function handleApplyTemplate(level: string) {
  if (!selectedUsername.value) return;
  if (!confirm(`Replace current student trail with the standard ${level} preset?`)) return;
  isApplyingTemplate.value = true;
  try {
    const res = await apiPost<LearningTrail>(`/dashboard/students/${selectedUsername.value}/trail/template`, {
      level,
    });
    trail.value = res;
    toast.success(`${level} preset applied successfully!`);
  } catch (err: any) {
    toast.error(err?.message || 'Error applying template.');
  } finally {
    isApplyingTemplate.value = false;
  }
}

async function handleResetTrail() {
  if (!selectedUsername.value) return;
  if (!confirm('Reset this student trail to the initial level default?')) return;
  try {
    const res = await apiPost<LearningTrail>(`/dashboard/students/${selectedUsername.value}/trail/reset`, {});
    trail.value = res;
    toast.success('Trail reset successfully!');
  } catch (err: any) {
    toast.error(err?.message || 'Error resetting trail.');
  }
}

async function handleToggleStep(phaseId: string, step: Step) {
  if (!selectedUsername.value) return;
  const oldVal = step.is_completed;
  const oldProgress = step.progress;
  const newVal = !oldVal;

  step.is_completed = !oldVal;
  step.progress = step.is_completed ? (step.target_count || 1) : 0;
  try {
    await apiPost(`/dashboard/students/${selectedUsername.value}/trail/step-toggle`, {
      phase_id: phaseId,
      step_id: step.id,
      is_completed: newVal,
    });
    toast.success(`Quest "${step.title}" updated!`);
  } catch (err) {
    step.is_completed = oldVal;
    step.progress = oldProgress;
    console.error(err);
    toast.error('Error updating step.');
  }
}

async function handleUnlockBoss(phaseId: string) {
  if (!selectedUsername.value) return;
  if (!confirm('Manually unlock the Exam for this phase?')) return;
  try {
    const res = await apiPost<LearningTrail>(`/dashboard/students/${selectedUsername.value}/trail/unlock-boss`, {
      phase_id: phaseId,
    });
    trail.value = res;
    toast.success('Exam unlocked successfully for the student!');
  } catch (err: any) {
    toast.error(err?.message || 'Error unlocking Exam.');
  }
}

function handleAddPhase() {
  if (!trail.value) return;
  const num = (trail.value.phases?.length || 0) + 1;
  const newPhase: Phase = {
    id: `phase-${num}-${Date.now().toString(36)}`,
    number: num,
    title: `Phase ${num}: New Learning Module`,
    description: 'Define specific learning goals and topics for this stage.',
    duration_days: 30,
    status: num === 1 ? 'active' : 'locked',
    steps: [],
    boss_fight: {
      id: `boss-p${num}`,
      title: `Phase ${num} Exam`,
      description: 'Custom evaluation exam based on the activities completed in this phase.',
      min_score: 7.0,
      is_unlocked: false,
      is_completed: false,
      score: null,
      completed_at: null,
      teacher_feedback: null,
      route: '/exams',
    },
  };
  trail.value.phases.push(newPhase);
  toast.success(`Phase ${num} added! Remember to save.`);
}

function handleDeletePhase(phaseIdx: number) {
  if (!trail.value) return;
  if (!confirm('Delete this phase from the trail?')) return;
  trail.value.phases.splice(phaseIdx, 1);
  toast.success('Phase removed.');
}
</script>

<template>
  <div class="space-y-8 animate-fade-in">
    <!-- Header Controls -->
    <div
      class="bg-surface border border-border rounded-2xl p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
      <div class="flex items-center gap-4">
        <div
          class="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
          <Compass class="w-6 h-6" />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-xl font-display font-black text-text">Learning Trails & Goals</h2>
            <span
              class="px-2 py-0.5 rounded-full text-[0.65rem] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
              Teacher Hub
            </span>
          </div>
          <p class="text-xs text-text-muted mt-0.5">
            Build custom learning phases with direct activities. The Exam evaluates exactly what the student practiced!
          </p>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex flex-wrap items-center gap-2.5">
        <!-- Preset Templates Dropdown -->
        <div class="flex items-center gap-1.5 bg-bg-secondary p-1 rounded-xl border border-border">
          <span class="text-[0.65rem] font-bold text-text-muted px-2 uppercase">Presets:</span>
          <button v-for="lvl in ['A1', 'A2', 'B1', 'B2', 'C1']" :key="lvl" type="button"
            @click="handleApplyTemplate(lvl)" :disabled="isApplyingTemplate"
            class="px-2.5 py-1 rounded-lg text-xs font-bold transition-all hover:bg-surface text-text hover:text-primary active:scale-95 disabled:opacity-50 cursor-pointer">
            {{ lvl }}
          </button>
        </div>

        <button type="button" @click="handleAddPhase"
          class="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-surface hover:bg-surface-hover border border-border text-text transition-all active:scale-95 cursor-pointer">
          <Plus class="w-4 h-4 text-primary" />
          New Phase
        </button>

        <button type="button" @click="handleResetTrail"
          class="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-surface hover:bg-error/10 border border-border text-text-muted hover:text-error transition-all active:scale-95 cursor-pointer"
          title="Reset student trail to level default">
          <RotateCcw class="w-3.5 h-3.5" />
        </button>

        <button type="button" @click="handleSaveTrail" :disabled="isSaving"
          class="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-xs transition-all active:scale-95 disabled:opacity-50 cursor-pointer">
          <Save class="w-4 h-4" />
          {{ isSaving ? 'Saving...' : 'Save Trail' }}
        </button>
      </div>
    </div>

    <!-- Layout: Students Sidebar + Trail Editor -->
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
      <!-- 1. Coluna de Alunos -->
      <div class="bg-surface border border-border rounded-2xl p-4 shadow-xs space-y-4 lg:col-span-1">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-bold uppercase tracking-wider text-text-subtle">Students ({{ students.length }})</h3>
          <span v-if="isLoadingStudents" class="text-[0.65rem] text-primary animate-pulse">Loading...</span>
        </div>

        <!-- Search Input -->
        <div class="relative">
          <Search class="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input v-model="searchQuery" type="text" placeholder="Search student by name..."
            class="w-full pl-8 pr-3 py-1.5 bg-bg-secondary border border-border rounded-xl text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary" />
        </div>

        <!-- Students List -->
        <div class="space-y-1 max-h-[580px] overflow-y-auto custom-scrollbar pr-1">
          <button v-for="s in filteredStudents" :key="s.username" type="button" @click="selectedUsername = s.username"
            class="w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all cursor-pointer border"
            :class="selectedUsername === s.username ? 'bg-primary/10 border-primary text-primary font-bold shadow-xs' : 'bg-transparent border-transparent hover:bg-surface-hover text-text'">
            <div class="flex items-center gap-2.5 min-w-0">
              <div
                class="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-[0.65rem] font-bold shrink-0 overflow-hidden">
                <img v-if="s.avatar_url && s.avatar_url !== DEFAULT_AVATAR_URL" :src="s.avatar_url"
                  :alt="s.name || s.username" class="w-full h-full object-cover" />
                <span v-else>{{ (s.name || s.username || '?').charAt(0).toUpperCase() }}</span>
              </div>
              <div class="min-w-0">
                <div class="text-xs font-semibold truncate">{{ s.name || s.username }}</div>
                <div class="text-[0.65rem] text-text-muted truncate">@{{ s.username }}</div>
              </div>
            </div>
            <span
              class="text-[0.65rem] font-bold px-1.5 py-0.5 rounded-md bg-surface border border-border text-text-subtle shrink-0">
              {{ s.level || 'A1' }}
            </span>
          </button>
        </div>
      </div>

      <!-- 2. Coluna Principal do Editor da Trilha -->
      <div class="lg:col-span-3 space-y-6">
        <!-- Banner do Aluno Ativo -->
        <div v-if="currentStudent"
          class="p-5 rounded-2xl bg-surface border border-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="flex items-center gap-3.5">
            <div
              class="w-11 h-11 rounded-2xl bg-primary/15 flex items-center justify-center font-bold text-primary text-sm shrink-0 overflow-hidden">
              <img v-if="currentStudent.avatar_url && currentStudent.avatar_url !== DEFAULT_AVATAR_URL"
                :src="currentStudent.avatar_url" :alt="currentStudent.name" class="w-full h-full object-cover" />
              <span v-else>{{ (currentStudent.name || currentStudent.username || '?').charAt(0).toUpperCase() }}</span>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="font-display font-bold text-base text-text">{{ currentStudent.name || currentStudent.username
                  }}</h3>
                <span
                  class="px-2 py-0.2 rounded-full text-[0.65rem] font-extrabold bg-primary/15 text-primary border border-primary/20">
                  CEFR Level: {{ currentStudent.level || 'A1' }}
                </span>
              </div>
              <p class="text-xs text-text-muted mt-0.5">
                Active Trail: <span class="font-semibold text-text">{{ trail?.title || 'Loading...' }}</span>
              </p>
            </div>
          </div>

          <!-- Campos editáveis de título e recado da professora -->
          <div class="flex-1 max-w-md space-y-2">
            <input v-if="trail" v-model="trail.title" type="text"
              placeholder="Trail Name (e.g. Intermediate Trail: Fluency & Career)"
              class="w-full px-3 py-1.5 bg-bg-secondary border border-border rounded-xl text-xs font-semibold text-text focus:outline-none focus:border-primary" />
            <input v-if="trail" v-model="trail.teacher_notes" type="text" placeholder="Teacher notes for the student..."
              class="w-full px-3 py-1.5 bg-bg-secondary border border-border rounded-xl text-xs text-text-muted focus:outline-none focus:border-primary" />
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="isLoadingTrail" class="py-16 text-center bg-surface border border-border rounded-2xl">
          <div class="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-2"></div>
          <p class="text-xs font-bold text-text-muted">Loading trail phases...</p>
        </div>

        <!-- Fases da Trilha -->
        <div v-else-if="trail && trail.phases && trail.phases.length > 0" class="space-y-6">
          <div v-for="(phase, pIdx) in trail.phases" :key="phase.id || pIdx"
            class="bg-surface border border-border rounded-2xl overflow-hidden shadow-xs transition-all hover:border-primary/40">
            <!-- Header da Fase -->
            <div
              class="p-5 border-b border-border bg-bg-secondary/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div class="space-y-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span
                    class="px-2 py-0.5 rounded-md text-[0.65rem] font-black uppercase tracking-wider bg-primary text-white">
                    Phase {{ phase.number || pIdx + 1 }}
                  </span>
                  <input v-model="phase.title" type="text"
                    class="font-display font-extrabold text-sm md:text-base text-text bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none px-1 py-0.5" />
                  <span class="px-2 py-0.2 rounded-full text-[0.65rem] font-bold uppercase tracking-wider" :class="{
                    'bg-success/15 text-success border border-success/30': phase.status === 'completed',
                    'bg-primary/15 text-primary border border-primary/30': phase.status === 'active',
                    'bg-muted/15 text-text-muted border border-border': phase.status === 'locked',
                  }">
                    {{ phase.status }}
                  </span>
                </div>
                <input v-model="phase.description" type="text" placeholder="Phase description or learning objectives..."
                  class="w-full text-xs text-text-muted bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none px-1" />
              </div>

              <!-- Controles da Fase -->
              <div class="flex items-center gap-2 shrink-0">
                <span class="text-xs font-bold text-text-subtle">
                  {{phase.steps.filter((s) => s.is_completed).length}} / {{ phase.steps.length }} completed
                </span>
                <button type="button" @click="openAddStepModal(phase.id)"
                  class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all active:scale-95 cursor-pointer">
                  <Plus class="w-3.5 h-3.5" />
                  Add Activity
                </button>
                <button type="button" @click="handleDeletePhase(pIdx)"
                  class="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
                  title="Delete phase">
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <!-- Lista de Atividades (Steps) da Fase -->
            <div class="p-5 space-y-3">
              <div v-if="phase.steps.length === 0"
                class="py-6 text-center border-2 border-dashed border-border rounded-xl">
                <p class="text-xs text-text-muted">No activities added to this phase.</p>
                <button type="button" @click="openAddStepModal(phase.id)"
                  class="mt-2 text-xs font-bold text-primary hover:underline inline-flex items-center gap-1 cursor-pointer">
                  <Plus class="w-3.5 h-3.5" /> Add first activity
                </button>
              </div>

              <div v-for="(step, sIdx) in phase.steps" :key="step.id || sIdx"
                class="flex items-center justify-between p-3.5 rounded-xl border transition-all"
                :class="step.is_completed ? 'bg-success/5 border-success/20' : 'bg-surface border-border hover:border-border/80'">
                <!-- Checkbox + Category Icon + Info -->
                <div class="flex items-center gap-3 min-w-0">
                  <button type="button" @click="handleToggleStep(phase.id, step)"
                    class="w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 cursor-pointer"
                    :class="step.is_completed ? 'bg-success border-success text-white' : 'border-border hover:border-primary text-transparent'">
                    <Check class="w-3.5 h-3.5" />
                  </button>

                  <div class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border"
                    :class="getCategoryMeta(step.category).color">
                    <component :is="getCategoryMeta(step.category).icon" class="w-4 h-4" />
                  </div>

                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-bold text-text truncate">{{ step.title }}</span>
                      <span
                        class="px-1.5 py-0.2 rounded text-[0.6rem] font-bold uppercase tracking-wider bg-bg-secondary border border-border text-text-muted">
                        {{ step.category }}
                      </span>
                    </div>
                    <p v-if="step.description" class="text-[0.7rem] text-text-muted truncate mt-0.5">
                      {{ step.description }}
                    </p>
                  </div>
                </div>

                <!-- Ações do Step: Editar / Excluir / Status -->
                <div class="flex items-center gap-2 shrink-0">
                  <span class="text-[0.65rem] font-black uppercase px-2 py-0.5 rounded-full"
                    :class="step.is_completed ? 'bg-success/15 text-success' : 'bg-primary/10 text-primary'">
                    {{ step.is_completed ? 'Completed' : 'Pending' }}
                  </span>

                  <button type="button" @click="openEditStepModal(phase.id, step)"
                    class="p-1 rounded-md text-text-muted hover:text-primary hover:bg-primary/10 transition-colors cursor-pointer"
                    title="Edit Activity">
                    <Edit2 class="w-3.5 h-3.5" />
                  </button>

                  <button type="button" @click="handleDeleteStep(phase, sIdx)"
                    class="p-1 rounded-md text-text-muted hover:text-error hover:bg-error/10 transition-colors cursor-pointer"
                    title="Delete">
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              <!-- Phase Exam Card (Exame Trimestral Personalizado da Fase) -->
              <div
                class="mt-4 p-4 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/5 via-amber-500/10 to-amber-500/5 shadow-xs">
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div class="flex items-center gap-3">
                    <div
                      class="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
                      <Swords class="w-5 h-5" />
                    </div>
                    <div>
                      <div class="flex items-center gap-2">
                        <h4 class="text-xs font-extrabold text-text uppercase tracking-wider flex items-center gap-1.5">
                          Phase {{ phase.number }} Exam
                        </h4>
                        <span class="px-2 py-0.2 rounded-full text-[0.6rem] font-black uppercase"
                          :class="phase.boss_fight?.is_completed ? 'bg-success text-white' : (phase.boss_fight?.is_unlocked ? 'bg-amber-500 text-white animate-pulse' : 'bg-surface border border-border text-text-muted')">
                          {{ phase.boss_fight?.is_completed ? 'Completed' : (phase.boss_fight?.is_unlocked ? 'Unlocked'
                          : 'Locked') }}
                        </span>
                      </div>
                      <p class="text-[0.7rem] text-text-muted mt-0.5">
                        Exam generated based on the activities configured above for this student.
                      </p>
                    </div>
                  </div>

                  <!-- Botão de Liberar Exame Manualmente -->
                  <div class="flex items-center gap-2 shrink-0">
                    <div class="text-right mr-2">
                      <span class="text-[0.65rem] text-text-muted block">Minimum score:</span>
                      <span class="text-xs font-bold text-amber-600 dark:text-amber-400">
                        {{ phase.boss_fight?.min_score || 7.0 }} / 10
                      </span>
                    </div>

                    <button v-if="!phase.boss_fight?.is_unlocked && !phase.boss_fight?.is_completed" type="button"
                      @click="handleUnlockBoss(phase.id)"
                      class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 shadow-xs transition-all active:scale-95 cursor-pointer">
                      <Unlock class="w-3.5 h-3.5" />
                      Unlock Exam
                    </button>
                    <span v-else-if="phase.boss_fight?.is_completed"
                      class="flex items-center gap-1 text-xs font-bold text-success">
                      <Trophy class="w-4 h-4" />
                      Passed (Score: {{ phase.boss_fight?.score ?? '10' }})
                    </span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="p-12 text-center bg-surface border border-border rounded-2xl">
          <Compass class="w-12 h-12 text-primary/40 mx-auto mb-3" />
          <h3 class="font-bold text-text text-base">No learning trail found</h3>
          <p class="text-xs text-text-muted mt-1 max-w-sm mx-auto">
            Select a student or apply a standard preset (A1, A2, B1, B2, C1) to start.
          </p>
          <div class="mt-4 flex justify-center gap-2">
            <button v-for="lvl in ['A1', 'A2', 'B1', 'B2', 'C1']" :key="lvl" type="button"
              @click="handleApplyTemplate(lvl)"
              class="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-white hover:bg-primary-hover transition-all cursor-pointer">
              Create {{ lvl }} Trail
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal de Adicionar / Editar Atividade à Fase (Teleported directly to body to avoid container scroll cutoff) -->
    <Teleport to="body">
      <div v-if="isStepModalOpen"
        class="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto"
        @click.self="isStepModalOpen = false">
        <div role="dialog" aria-modal="true"
          class="relative w-full max-w-lg bg-surface border border-border rounded-3xl shadow-2xl p-6 space-y-4 max-h-[85vh] overflow-y-auto mx-auto my-auto animate-in fade-in zoom-in-95 duration-150"
          @click.stop>
          <h3 class="text-base font-bold text-text">
            {{ isEditingStep ? 'Edit Phase Activity' : 'Add Activity to Phase' }}
          </h3>

          <!-- Categoria -->
          <div class="space-y-1.5">
            <label class="text-xs font-bold text-text-subtle">Pedagogical Category</label>
            <select v-model="newStepCategory" @change="handleCategoryChange"
              class="w-full px-3 py-2 bg-bg-secondary border border-border rounded-xl text-xs font-semibold text-text focus:outline-none focus:border-primary cursor-pointer">
              <option v-for="c in CATEGORIES" :key="c.id" :value="c.id">
                {{ c.label }}
              </option>
            </select>
          </div>

          <!-- Título com Busca / Autocomplete ao digitar -->
          <div class="space-y-1.5 relative">
            <div class="flex items-center justify-between">
              <label class="text-xs font-bold text-text-subtle">Activity Title</label>
              <span v-if="isSearchingCatalog" class="text-[0.65rem] text-primary flex items-center gap-1">
                <Loader2 class="w-3 h-3 animate-spin" /> Searching catalog...
              </span>
            </div>

            <div class="relative">
              <input v-model="newStepTitle" type="text" @input="handleTitleInput"
                placeholder="Type activity name (e.g. Adjectives: Old, new...)"
                class="w-full px-3 py-2 bg-bg-secondary border border-border rounded-xl text-xs font-semibold text-text focus:outline-none focus:border-primary" />
              <button v-if="catalogSuggestions.length > 0" type="button" @click="showSuggestions = !showSuggestions"
                class="absolute right-2.5 top-1/2 -translate-y-1/2 text-text-muted hover:text-text cursor-pointer">
                <ChevronDown class="w-4 h-4" />
              </button>
            </div>

            <!-- Dropdown Autocomplete de Sugestões Reais da Categoria -->
            <div v-if="showSuggestions && catalogSuggestions.length > 0"
              class="absolute left-0 right-0 top-full mt-1 bg-surface border border-border rounded-xl shadow-2xl max-h-52 overflow-y-auto z-[10000] divide-y divide-border/50">
              <button v-for="sug in catalogSuggestions" :key="sug.id || sug.title" type="button"
                @click="handleSelectSuggestion(sug)"
                class="w-full px-3 py-2.5 text-left hover:bg-surface-hover flex items-center justify-between gap-3 text-xs transition-colors cursor-pointer">
                <div class="min-w-0">
                  <span class="font-semibold text-text block truncate">{{ sug.title }}</span>
                  <span class="text-[0.65rem] text-text-muted uppercase">{{ sug.category }}</span>
                </div>
                <span class="px-1.5 py-0.5 rounded text-[0.6rem] font-bold bg-primary/10 text-primary shrink-0">
                  {{ sug.level }}
                </span>
              </button>
            </div>
          </div>

          <!-- Instruções da Professora (Opcional) -->
          <div class="space-y-1.5">
            <label class="text-xs font-bold text-text-subtle">Teacher Instructions (Optional)</label>
            <textarea v-model="newStepDescription" rows="2"
              placeholder="e.g. Complete exercises and record your pronunciation of the final 3 sentences..."
              class="w-full px-3 py-2 bg-bg-secondary border border-border rounded-xl text-xs text-text focus:outline-none focus:border-primary resize-none"></textarea>
          </div>

          <!-- Modal Actions -->
          <div class="flex items-center justify-end gap-2 pt-2 border-t border-border">
            <button type="button" @click="isStepModalOpen = false"
              class="px-3.5 py-2 rounded-xl text-xs font-bold text-text-muted hover:bg-surface-hover transition-colors cursor-pointer">
              Cancel
            </button>
            <button type="button" @click="handleSaveStep"
              class="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-xs transition-all cursor-pointer">
              {{ isEditingStep ? 'Save Changes' : 'Add Activity' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
