<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import {
  Compass,
  Plus,
  Trash2,
  Save,
  RotateCcw,
  Unlock,
  CheckCircle2,
  Lock,
  Swords,
  Trophy,
  BookOpen,
  Headphones,
  Music,
  Gamepad2,
  Sparkles,
  Users,
  MessageSquare,
  FileText,
  Search,
  ExternalLink,
  Edit2,
  Check,
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

const toast = useToast();

const students = ref<any[]>([]);
const selectedUsername = ref<string>('');
const searchQuery = ref('');
const isLoadingStudents = ref(false);
const isLoadingTrail = ref(false);
const isSaving = ref(false);
const isApplyingTemplate = ref(false);

const trail = ref<LearningTrail | null>(null);

// Modal de adicionar etapa
const isAddStepModalOpen = ref(false);
const targetPhaseId = ref<string>('');
const newStepCategory = ref<string>('grammar');
const newStepTitle = ref<string>('');
const newStepDescription = ref<string>('');
const newStepRoute = ref<string>('/grammar');

// Categoria icons & cores
const CATEGORIES = [
  { id: 'grammar', label: 'Grammar', icon: FileText, route: '/grammar', color: 'text-blue-500 bg-blue-500/10 border-blue-500/20' },
  { id: 'vocabulary', label: 'Vocabulary', icon: BookOpen, route: '/vocabulary', color: 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20' },
  { id: 'reading', label: 'Reading', icon: BookOpen, route: '/reading', color: 'text-amber-500 bg-amber-500/10 border-amber-500/20' },
  { id: 'listening', label: 'Listening / Podcast', icon: Headphones, route: '/listening', color: 'text-purple-500 bg-purple-500/10 border-purple-500/20' },
  { id: 'simulations', label: 'Simulations / Voice', icon: Users, route: '/voice', color: 'text-rose-500 bg-rose-500/10 border-rose-500/20' },
  { id: 'music', label: 'Music & Lyrics', icon: Music, route: '/music', color: 'text-pink-500 bg-pink-500/10 border-pink-500/20' },
  { id: 'games', label: 'Games & Wordwall', icon: Gamepad2, route: '/games', color: 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20' },
  { id: 'flashcards', label: 'Flashcards (SRS)', icon: Sparkles, route: '/flashcards', color: 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20' },
  { id: 'custom', label: 'Custom / PDF', icon: FileText, route: '', color: 'text-cyan-500 bg-cyan-500/10 border-cyan-500/20' },
];

function getCategoryMeta(cat: string) {
  const c = cat.toLowerCase();
  return (
    CATEGORIES.find((item) => item.id === c) || {
      id: cat,
      label: cat.toUpperCase(),
      icon: Compass,
      route: '',
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

async function handleSaveTrail() {
  if (!trail.value || !selectedUsername.value) return;
  isSaving.value = true;
  try {
    const res = await apiPost<LearningTrail>(`/dashboard/students/${selectedUsername.value}/trail`, {
      trail: trail.value,
    });
    trail.value = res;
    toast.success('Trilha do aluno salva com sucesso!');
  } catch (err: any) {
    toast.error(err?.message || 'Erro ao salvar trilha.');
  } finally {
    isSaving.value = false;
  }
}

async function handleApplyTemplate(level: string) {
  if (!selectedUsername.value) return;
  if (!confirm(`Substituir a trilha atual do aluno pelo template padrão ${level}?`)) return;
  isApplyingTemplate.value = true;
  try {
    const res = await apiPost<LearningTrail>(`/dashboard/students/${selectedUsername.value}/trail/template`, {
      level,
    });
    trail.value = res;
    toast.success(`Template ${level} aplicado com sucesso!`);
  } catch (err: any) {
    toast.error(err?.message || 'Erro ao aplicar template.');
  } finally {
    isApplyingTemplate.value = false;
  }
}

async function handleResetTrail() {
  if (!selectedUsername.value) return;
  if (!confirm('Deseja resetar a trilha deste aluno para o padrão inicial do seu nível?')) return;
  try {
    const res = await apiPost<LearningTrail>(`/dashboard/students/${selectedUsername.value}/trail/reset`, {});
    trail.value = res;
    toast.success('Trilha resetada com sucesso!');
  } catch (err: any) {
    toast.error(err?.message || 'Erro ao resetar trilha.');
  }
}

async function handleToggleStep(phaseId: string, step: Step) {
  if (!selectedUsername.value) return;
  const oldVal = step.is_completed;
  step.is_completed = !oldVal;
  step.progress = step.is_completed ? (step.target_count || 1) : 0;
  try {
    await apiPost(`/dashboard/students/${selectedUsername.value}/trail/step-toggle`, {
      phase_id: phaseId,
      step_id: step.id,
      is_completed: step.is_completed,
    });
    toast.success(`Etapa "${step.title}" atualizada!`);
    loadTrail(selectedUsername.value);
  } catch (err) {
    step.is_completed = oldVal;
    toast.error('Erro ao atualizar etapa.');
  }
}

async function handleUnlockBoss(phaseId: string) {
  if (!selectedUsername.value) return;
  if (!confirm('Liberar manualmente o Boss Fight (Exame Trimestral) para esta fase?')) return;
  try {
    const res = await apiPost<LearningTrail>(`/dashboard/students/${selectedUsername.value}/trail/unlock-boss`, {
      phase_id: phaseId,
    });
    trail.value = res;
    toast.success('Boss Fight liberado com sucesso para o aluno!');
  } catch (err: any) {
    toast.error(err?.message || 'Erro ao liberar Boss Fight.');
  }
}

function handleAddPhase() {
  if (!trail.value) return;
  const num = (trail.value.phases?.length || 0) + 1;
  const newPhase: Phase = {
    id: `phase-${num}-${Date.now().toString(36)}`,
    number: num,
    title: `Fase ${num}: Novo Módulo de Aprendizado`,
    description: 'Defina os objetivos específicos para este estágio.',
    duration_days: 30,
    status: num === 1 ? 'active' : 'locked',
    steps: [],
    boss_fight: {
      id: `boss-p${num}`,
      title: `👑 Boss Fight: Avaliação da Fase ${num}`,
      description: 'Exame de verificação para desbloquear a próxima fase.',
      min_score: 7.0,
      is_unlocked: false,
      is_completed: false,
      score: null,
      completed_at: null,
      teacher_feedback: null,
      route: '/exams/trimestral',
    },
  };
  trail.value.phases.push(newPhase);
  toast.success(`Fase ${num} adicionada! Lembre-se de salvar.`);
}

function handleDeletePhase(phaseIdx: number) {
  if (!trail.value) return;
  if (!confirm('Excluir esta fase da trilha?')) return;
  trail.value.phases.splice(phaseIdx, 1);
  toast.success('Fase removida.');
}

function openAddStepModal(phaseId: string) {
  targetPhaseId.value = phaseId;
  newStepCategory.value = 'grammar';
  newStepTitle.value = '';
  newStepDescription.value = '';
  newStepRoute.value = '/grammar';
  isAddStepModalOpen.value = true;
}

function handleCategoryChange() {
  const meta = getCategoryMeta(newStepCategory.value);
  newStepRoute.value = meta.route;
}

function handleSaveNewStep() {
  if (!trail.value || !targetPhaseId.value) return;
  if (!newStepTitle.value.trim()) {
    toast.error('Informe o título da atividade.');
    return;
  }

  const phase = trail.value.phases.find((p) => p.id === targetPhaseId.value);
  if (!phase) return;

  const newStep: Step = {
    id: `step-${Date.now().toString(36)}`,
    category: newStepCategory.value,
    title: newStepTitle.value.trim(),
    description: newStepDescription.value.trim(),
    route: newStepRoute.value.trim() || undefined,
    target_count: 1,
    progress: 0,
    is_completed: false,
    completed_at: null,
  };

  phase.steps.push(newStep);
  isAddStepModalOpen.value = false;
  toast.success('Atividade adicionada! Clique em Salvar para persistir.');
}

function handleDeleteStep(phase: Phase, stepIdx: number) {
  phase.steps.splice(stepIdx, 1);
  toast.success('Atividade removida.');
}

onMounted(() => {
  loadStudents();
});
</script>

<template>
  <div class="space-y-8 animate-fade-in">
    <!-- Header Controls -->
    <div class="bg-surface border border-border rounded-2xl p-6 shadow-xs flex flex-col lg:flex-row lg:items-center justify-between gap-6">
      <div class="flex items-center gap-4">
        <div class="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
          <Compass class="w-6 h-6" />
        </div>
        <div>
          <div class="flex items-center gap-2">
            <h2 class="text-xl font-display font-black text-text">Trilhas de Aprendizado & Metas</h2>
            <span class="px-2 py-0.5 rounded-full text-[0.65rem] font-bold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
              Gamified Trails
            </span>
          </div>
          <p class="text-xs text-text-muted mt-0.5">
            Crie planos personalizados com Fases, atividades obrigatórias e o Boss Fight (Exame Trimestral).
          </p>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="flex flex-wrap items-center gap-2.5">
        <!-- Preset Templates Dropdown -->
        <div class="flex items-center gap-1.5 bg-bg-secondary p-1 rounded-xl border border-border">
          <span class="text-[0.65rem] font-bold text-text-muted px-2 uppercase">Presets:</span>
          <button
            v-for="lvl in ['A1', 'A2', 'B1', 'B2', 'C1']"
            :key="lvl"
            type="button"
            @click="handleApplyTemplate(lvl)"
            :disabled="isApplyingTemplate"
            class="px-2.5 py-1 rounded-lg text-xs font-bold transition-all hover:bg-surface text-text hover:text-primary active:scale-95 disabled:opacity-50"
          >
            {{ lvl }}
          </button>
        </div>

        <button
          type="button"
          @click="handleAddPhase"
          class="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-surface hover:bg-surface-hover border border-border text-text transition-all active:scale-95"
        >
          <Plus class="w-4 h-4 text-primary" />
          Nova Fase
        </button>

        <button
          type="button"
          @click="handleResetTrail"
          class="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-surface hover:bg-error/10 border border-border text-text-muted hover:text-error transition-all active:scale-95"
          title="Resetar trilha do aluno para o padrão"
        >
          <RotateCcw class="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          @click="handleSaveTrail"
          :disabled="isSaving"
          class="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-xs transition-all active:scale-95 disabled:opacity-50"
        >
          <Save class="w-4 h-4" />
          {{ isSaving ? 'Salvando...' : 'Salvar Trilha' }}
        </button>
      </div>
    </div>

    <!-- Layout: Students Sidebar + Trail Editor -->
    <div class="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start">
      <!-- 1. Coluna de Alunos -->
      <div class="bg-surface border border-border rounded-2xl p-4 shadow-xs space-y-4 lg:col-span-1">
        <div class="flex items-center justify-between">
          <h3 class="text-xs font-bold uppercase tracking-wider text-text-subtle">Alunos ({{ students.length }})</h3>
          <span v-if="isLoadingStudents" class="text-[0.65rem] text-primary animate-pulse">Carregando...</span>
        </div>

        <!-- Search Input -->
        <div class="relative">
          <Search class="w-3.5 h-3.5 text-text-muted absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            v-model="searchQuery"
            type="text"
            placeholder="Buscar aluno por nome..."
            class="w-full pl-8 pr-3 py-1.5 bg-bg-secondary border border-border rounded-xl text-xs text-text placeholder:text-text-muted focus:outline-none focus:border-primary"
          />
        </div>

        <!-- Students List -->
        <div class="space-y-1 max-h-[580px] overflow-y-auto custom-scrollbar pr-1">
          <button
            v-for="s in filteredStudents"
            :key="s.username"
            type="button"
            @click="selectedUsername = s.username"
            class="w-full flex items-center justify-between p-2.5 rounded-xl text-left transition-all cursor-pointer border"
            :class="selectedUsername === s.username ? 'bg-primary/10 border-primary text-primary font-bold shadow-xs' : 'bg-transparent border-transparent hover:bg-surface-hover text-text'"
          >
            <div class="flex items-center gap-2.5 min-w-0">
              <div class="w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-[0.65rem] font-bold shrink-0 overflow-hidden">
                <img
                  v-if="s.avatar_url && s.avatar_url !== DEFAULT_AVATAR_URL"
                  :src="s.avatar_url"
                  :alt="s.name || s.username"
                  class="w-full h-full object-cover"
                />
                <span v-else>{{ (s.name || s.username || '?').charAt(0).toUpperCase() }}</span>
              </div>
              <div class="min-w-0">
                <div class="text-xs font-semibold truncate">{{ s.name || s.username }}</div>
                <div class="text-[0.65rem] text-text-muted truncate">@{{ s.username }}</div>
              </div>
            </div>
            <span class="text-[0.65rem] font-bold px-1.5 py-0.5 rounded-md bg-surface border border-border text-text-subtle shrink-0">
              {{ s.level || 'A1' }}
            </span>
          </button>
        </div>
      </div>

      <!-- 2. Coluna Principal do Editor da Trilha -->
      <div class="lg:col-span-3 space-y-6">
        <!-- Banner do Aluno Ativo -->
        <div v-if="currentStudent" class="p-5 rounded-2xl bg-surface border border-border shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div class="flex items-center gap-3.5">
            <div class="w-11 h-11 rounded-2xl bg-primary/15 flex items-center justify-center font-bold text-primary text-sm shrink-0 overflow-hidden">
              <img
                v-if="currentStudent.avatar_url && currentStudent.avatar_url !== DEFAULT_AVATAR_URL"
                :src="currentStudent.avatar_url"
                :alt="currentStudent.name"
                class="w-full h-full object-cover"
              />
              <span v-else>{{ (currentStudent.name || currentStudent.username || '?').charAt(0).toUpperCase() }}</span>
            </div>
            <div>
              <div class="flex items-center gap-2">
                <h3 class="font-display font-bold text-base text-text">{{ currentStudent.name || currentStudent.username }}</h3>
                <span class="px-2 py-0.2 rounded-full text-[0.65rem] font-extrabold bg-primary/15 text-primary border border-primary/20">
                  Nível CEFR: {{ currentStudent.level || 'A1' }}
                </span>
              </div>
              <p class="text-xs text-text-muted mt-0.5">
                Trilha Ativa: <span class="font-semibold text-text">{{ trail?.title || 'Carregando...' }}</span>
              </p>
            </div>
          </div>

          <!-- Campos editáveis de título e recado da professora -->
          <div class="flex-1 max-w-md space-y-2">
            <input
              v-if="trail"
              v-model="trail.title"
              type="text"
              placeholder="Nome da Trilha (ex: Trilha Rumo à Fluência)"
              class="w-full px-3 py-1.5 bg-bg-secondary border border-border rounded-xl text-xs font-semibold text-text focus:outline-none focus:border-primary"
            />
            <input
              v-if="trail"
              v-model="trail.teacher_notes"
              type="text"
              placeholder="Recado da Professora para o aluno..."
              class="w-full px-3 py-1.5 bg-bg-secondary border border-border rounded-xl text-xs text-text-muted focus:outline-none focus:border-primary"
            />
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="isLoadingTrail" class="py-16 text-center bg-surface border border-border rounded-2xl">
          <div class="w-8 h-8 border-3 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-2"></div>
          <p class="text-xs font-bold text-text-muted">Carregando fases da trilha...</p>
        </div>

        <!-- Fases da Trilha -->
        <div v-else-if="trail && trail.phases && trail.phases.length > 0" class="space-y-6">
          <div
            v-for="(phase, pIdx) in trail.phases"
            :key="phase.id || pIdx"
            class="bg-surface border border-border rounded-2xl overflow-hidden shadow-xs transition-all hover:border-primary/40"
          >
            <!-- Header da Fase -->
            <div class="p-5 border-b border-border bg-bg-secondary/40 flex flex-col md:flex-row md:items-center justify-between gap-4">
              <div class="space-y-1 min-w-0">
                <div class="flex items-center gap-2">
                  <span class="px-2 py-0.5 rounded-md text-[0.65rem] font-black uppercase tracking-wider bg-primary text-white">
                    Fase {{ phase.number || pIdx + 1 }}
                  </span>
                  <input
                    v-model="phase.title"
                    type="text"
                    class="font-display font-extrabold text-sm md:text-base text-text bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none px-1 py-0.5"
                  />
                  <span
                    class="px-2 py-0.2 rounded-full text-[0.65rem] font-bold uppercase tracking-wider"
                    :class="{
                      'bg-success/15 text-success border border-success/30': phase.status === 'completed',
                      'bg-primary/15 text-primary border border-primary/30': phase.status === 'active',
                      'bg-muted/15 text-text-muted border border-border': phase.status === 'locked',
                    }"
                  >
                    {{ phase.status }}
                  </span>
                </div>
                <input
                  v-model="phase.description"
                  type="text"
                  placeholder="Descrição ou objetivo pedagógico desta fase..."
                  class="w-full text-xs text-text-muted bg-transparent border-b border-transparent hover:border-border focus:border-primary focus:outline-none px-1"
                />
              </div>

              <!-- Controles da Fase -->
              <div class="flex items-center gap-2 shrink-0">
                <span class="text-xs font-bold text-text-subtle">
                  {{ phase.steps.filter((s) => s.is_completed).length }} / {{ phase.steps.length }} concluídas
                </span>
                <button
                  type="button"
                  @click="openAddStepModal(phase.id)"
                  class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-primary/10 hover:bg-primary/20 text-primary border border-primary/20 transition-all active:scale-95"
                >
                  <Plus class="w-3.5 h-3.5" />
                  Atividade
                </button>
                <button
                  type="button"
                  @click="handleDeletePhase(pIdx)"
                  class="p-1.5 rounded-lg text-text-muted hover:text-error hover:bg-error/10 transition-colors"
                  title="Excluir fase"
                >
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            <!-- Lista de Atividades (Steps) da Fase -->
            <div class="p-5 space-y-3">
              <div v-if="phase.steps.length === 0" class="py-6 text-center border-2 border-dashed border-border rounded-xl">
                <p class="text-xs text-text-muted">Nenhuma atividade adicionada a esta fase.</p>
                <button
                  type="button"
                  @click="openAddStepModal(phase.id)"
                  class="mt-2 text-xs font-bold text-primary hover:underline inline-flex items-center gap-1"
                >
                  <Plus class="w-3.5 h-3.5" /> Adicionar primeira atividade
                </button>
              </div>

              <div
                v-for="(step, sIdx) in phase.steps"
                :key="step.id || sIdx"
                class="flex items-center justify-between p-3.5 rounded-xl border transition-all"
                :class="step.is_completed ? 'bg-success/5 border-success/20' : 'bg-surface border-border hover:border-border/80'"
              >
                <!-- Checkbox + Category Icon + Info -->
                <div class="flex items-center gap-3 min-w-0">
                  <button
                    type="button"
                    @click="handleToggleStep(phase.id, step)"
                    class="w-5 h-5 rounded-md border flex items-center justify-center transition-all shrink-0 cursor-pointer"
                    :class="step.is_completed ? 'bg-success border-success text-white' : 'border-border hover:border-primary text-transparent'"
                  >
                    <Check class="w-3.5 h-3.5" />
                  </button>

                  <div
                    class="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border"
                    :class="getCategoryMeta(step.category).color"
                  >
                    <component :is="getCategoryMeta(step.category).icon" class="w-4 h-4" />
                  </div>

                  <div class="min-w-0">
                    <div class="flex items-center gap-2">
                      <span class="text-xs font-bold text-text truncate">{{ step.title }}</span>
                      <span class="px-1.5 py-0.2 rounded text-[0.6rem] font-bold uppercase tracking-wider bg-bg-secondary border border-border text-text-muted">
                        {{ step.category }}
                      </span>
                    </div>
                    <p v-if="step.description" class="text-[0.7rem] text-text-muted truncate mt-0.5">
                      {{ step.description }}
                    </p>
                  </div>
                </div>

                <!-- Ações do Step -->
                <div class="flex items-center gap-2 shrink-0">
                  <span
                    class="text-[0.65rem] font-black uppercase px-2 py-0.5 rounded-full"
                    :class="step.is_completed ? 'bg-success/15 text-success' : 'bg-primary/10 text-primary'"
                  >
                    {{ step.is_completed ? 'Concluída' : 'Pendente' }}
                  </span>

                  <button
                    type="button"
                    @click="handleDeleteStep(phase, sIdx)"
                    class="p-1 rounded-md text-text-muted hover:text-error hover:bg-error/10 transition-colors"
                  >
                    <Trash2 class="w-3 h-3" />
                  </button>
                </div>
              </div>

              <!-- Boss Fight Card (Exame Trimestral da Fase) -->
              <div
                class="mt-4 p-4 rounded-xl border border-amber-500/30 bg-gradient-to-r from-amber-500/5 via-amber-500/10 to-amber-500/5 shadow-xs"
              >
                <div class="flex flex-col md:flex-row md:items-center justify-between gap-3">
                  <div class="flex items-center gap-3">
                    <div class="w-10 h-10 rounded-xl bg-amber-500/20 border border-amber-500/30 flex items-center justify-center text-amber-500 shrink-0">
                      <Swords class="w-5 h-5" />
                    </div>
                    <div>
                      <div class="flex items-center gap-2">
                        <h4 class="text-xs font-extrabold text-text uppercase tracking-wider flex items-center gap-1.5">
                          {{ phase.boss_fight?.title || '👑 Boss Fight: Exame Trimestral da Fase' }}
                        </h4>
                        <span
                          class="px-2 py-0.2 rounded-full text-[0.6rem] font-black uppercase"
                          :class="phase.boss_fight?.is_completed ? 'bg-success text-white' : (phase.boss_fight?.is_unlocked ? 'bg-amber-500 text-white animate-pulse' : 'bg-surface border border-border text-text-muted')"
                        >
                          {{ phase.boss_fight?.is_completed ? 'Derrotado 🏆' : (phase.boss_fight?.is_unlocked ? 'Desbloqueado ⚔️' : 'Bloqueado 🔒') }}
                        </span>
                      </div>
                      <p class="text-[0.7rem] text-text-muted mt-0.5">
                        {{ phase.boss_fight?.description || 'O aluno precisa completar todas as missões acima para liberar o teste com IA.' }}
                      </p>
                    </div>
                  </div>

                  <!-- Botão de Liberar Boss Manualmente -->
                  <div class="flex items-center gap-2 shrink-0">
                    <div class="text-right mr-2">
                      <span class="text-[0.65rem] text-text-muted block">Nota mínima:</span>
                      <span class="text-xs font-bold text-amber-600 dark:text-amber-400">
                        {{ phase.boss_fight?.min_score || 7.0 }} / 10
                      </span>
                    </div>

                    <button
                      v-if="!phase.boss_fight?.is_unlocked && !phase.boss_fight?.is_completed"
                      type="button"
                      @click="handleUnlockBoss(phase.id)"
                      class="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-bold bg-amber-500 text-white hover:bg-amber-600 shadow-xs transition-all active:scale-95 cursor-pointer"
                    >
                      <Unlock class="w-3.5 h-3.5" />
                      Liberar Boss Agora
                    </button>
                    <span
                      v-else-if="phase.boss_fight?.is_completed"
                      class="flex items-center gap-1 text-xs font-bold text-success"
                    >
                      <Trophy class="w-4 h-4" />
                      Aprovado! (Nota: {{ phase.boss_fight?.score ?? '10' }})
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
          <h3 class="font-bold text-text text-base">Nenhuma trilha encontrada</h3>
          <p class="text-xs text-text-muted mt-1 max-w-sm mx-auto">
            Selecione um aluno ou aplique um dos templates padrão (A1, A2, B1, B2, C1) para começar.
          </p>
          <div class="mt-4 flex justify-center gap-2">
            <button
              v-for="lvl in ['A1', 'A2', 'B1', 'B2', 'C1']"
              :key="lvl"
              type="button"
              @click="handleApplyTemplate(lvl)"
              class="px-3 py-1.5 rounded-lg text-xs font-bold bg-primary text-white hover:bg-primary-hover transition-all"
            >
              Criar Trilha {{ lvl }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- Modal de Adicionar Atividade à Fase -->
    <div
      v-if="isAddStepModalOpen"
      class="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in"
    >
      <div class="bg-surface border border-border rounded-2xl max-w-md w-full p-6 shadow-2xl space-y-4">
        <h3 class="text-base font-bold text-text">Adicionar Atividade à Fase</h3>

        <!-- Categoria -->
        <div class="space-y-1.5">
          <label class="text-xs font-bold text-text-subtle">Categoria</label>
          <select
            v-model="newStepCategory"
            @change="handleCategoryChange"
            class="w-full px-3 py-2 bg-bg-secondary border border-border rounded-xl text-xs font-semibold text-text focus:outline-none focus:border-primary"
          >
            <option v-for="c in CATEGORIES" :key="c.id" :value="c.id">
              {{ c.label }}
            </option>
          </select>
        </div>

        <!-- Título -->
        <div class="space-y-1.5">
          <label class="text-xs font-bold text-text-subtle">Título da Atividade</label>
          <input
            v-model="newStepTitle"
            type="text"
            placeholder="ex: Present Perfect vs Simple Past"
            class="w-full px-3 py-2 bg-bg-secondary border border-border rounded-xl text-xs font-semibold text-text focus:outline-none focus:border-primary"
          />
        </div>

        <!-- Descrição / Instrução da Teacher -->
        <div class="space-y-1.5">
          <label class="text-xs font-bold text-text-subtle">Instruções da Professora (Opcional)</label>
          <textarea
            v-model="newStepDescription"
            rows="2"
            placeholder="ex: Faça os exercícios e grave a pronúncia das 3 frases finais..."
            class="w-full px-3 py-2 bg-bg-secondary border border-border rounded-xl text-xs text-text focus:outline-none focus:border-primary resize-none"
          ></textarea>
        </div>

        <!-- Rota / Link -->
        <div class="space-y-1.5">
          <label class="text-xs font-bold text-text-subtle">Rota do App ou Link Externo / PDF</label>
          <input
            v-model="newStepRoute"
            type="text"
            placeholder="/grammar ou link do drive/pdf"
            class="w-full px-3 py-2 bg-bg-secondary border border-border rounded-xl text-xs text-text-muted focus:outline-none focus:border-primary"
          />
        </div>

        <!-- Modal Actions -->
        <div class="flex items-center justify-end gap-2 pt-2 border-t border-border">
          <button
            type="button"
            @click="isAddStepModalOpen = false"
            class="px-3.5 py-2 rounded-xl text-xs font-bold text-text-muted hover:bg-surface-hover transition-colors"
          >
            Cancelar
          </button>
          <button
            type="button"
            @click="handleSaveNewStep"
            class="px-4 py-2 rounded-xl text-xs font-bold bg-primary text-white hover:bg-primary-hover shadow-xs transition-all"
          >
            Adicionar Atividade
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
