<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  Compass,
  Target,
  Swords,
  Trophy,
  CheckCircle2,
  Lock,
  Flame,
  Clock,
  Sparkles,
  BookOpen,
  Headphones,
  Music,
  Gamepad2,
  ExternalLink,
  ChevronRight,
  X,
  Play,
  RotateCcw,
  Check,
  Star,
  Award,
  Loader2,
  FileCheck,
  Dumbbell,
  Package,
} from 'lucide-vue-next';
import { apiGet, apiPost } from '@/api/client';
import { useToast } from '@/composables/useToast';

const router = useRouter();
const toast = useToast();

// Aba principal: Trilha de Aprendizagem ou Metas Semanais
const activeMainTab = ref<'trail' | 'weekly'>('trail');

// Tipos da trilha de aprendizagem
interface TrailStep {
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

interface TrailPhase {
  id: string;
  number: number;
  title: string;
  description: string;
  duration_days: number;
  status: 'active' | 'completed' | 'locked';
  steps: TrailStep[];
  boss_fight: BossFight;
  steps_completed_count?: number;
  total_steps_count?: number;
}

interface LearningTrail {
  trail_id?: string;
  title: string;
  level: string;
  teacher_notes?: string;
  phases: TrailPhase[];
  updated_at?: string;
  is_in_testing?: boolean;
}

// Tipos das metas semanais
interface Goal {
  id: string;
  type: string;
  title?: string;
  description?: string;
  target: number;
  progress?: number;
  current?: number;
  period?: 'daily' | 'weekly';
  is_completed?: boolean;
  achieved?: boolean;
}

interface StreakData {
  current_streak: number;
  trophies_earned?: number;
}

// Estados reativos da página
const trail = ref<LearningTrail | null>(null);
const isLoadingTrail = ref(true);

const goals = ref<Goal[]>([]);
const streakData = ref<StreakData | null>(null);
const filterTab = ref<'todo' | 'completed' | 'all'>('todo');
const isLoadingGoals = ref(true);
const isTogglingStep = ref(false);

// Modal de detalhes e ações do nó da trilha
const selectedNode = ref<{
  type: 'step' | 'exam';
  phase: TrailPhase;
  step?: TrailStep;
  boss?: BossFight;
  index?: number;
} | null>(null);

const selectedStep = computed<TrailStep | null>(() => {
  return selectedNode.value?.type === 'step' ? (selectedNode.value.step || null) : null;
});

const selectedBoss = computed<BossFight | null>(() => {
  return selectedNode.value?.type === 'exam' ? (selectedNode.value.boss || null) : null;
});

const selectedPhase = computed<TrailPhase | null>(() => {
  return selectedNode.value?.phase || null;
});

// Modal de recompensa do baú de checkpoint
const selectedChest = ref<{
  phase: TrailPhase;
  isUnlocked: boolean;
} | null>(null);

// Metadados visuais e ícones de cada categoria pedagógica
const CATEGORY_META: Record<
  string,
  { label: string; icon: any; color: string; buttonBg: string; buttonBorder: string }
> = {
  grammar: {
    label: 'Grammar',
    icon: Star,
    color: 'text-blue-500',
    buttonBg: 'bg-blue-500',
    buttonBorder: 'border-b-[#1d4ed8]',
  },
  vocabulary: {
    label: 'Vocabulary',
    icon: Sparkles,
    color: 'text-emerald-500',
    buttonBg: 'bg-emerald-500',
    buttonBorder: 'border-b-[#047857]',
  },
  reading: {
    label: 'Reading',
    icon: BookOpen,
    color: 'text-amber-500',
    buttonBg: 'bg-amber-500',
    buttonBorder: 'border-b-[#b45309]',
  },
  listening: {
    label: 'Listening',
    icon: Headphones,
    color: 'text-purple-500',
    buttonBg: 'bg-purple-500',
    buttonBorder: 'border-b-[#6d28d9]',
  },
  simulations: {
    label: 'Simulation',
    icon: Dumbbell,
    color: 'text-rose-500',
    buttonBg: 'bg-rose-500',
    buttonBorder: 'border-b-[#be123c]',
  },
  music: {
    label: 'Music & Lyrics',
    icon: Music,
    color: 'text-pink-500',
    buttonBg: 'bg-pink-500',
    buttonBorder: 'border-b-[#be185d]',
  },
  games: {
    label: 'Learning Game',
    icon: Gamepad2,
    color: 'text-indigo-500',
    buttonBg: 'bg-indigo-500',
    buttonBorder: 'border-b-[#4338ca]',
  },
  flashcards: {
    label: 'Flashcards',
    icon: Sparkles,
    color: 'text-yellow-500',
    buttonBg: 'bg-yellow-500',
    buttonBorder: 'border-b-[#a16207]',
  },
  custom: {
    label: 'Custom Quest',
    icon: Target,
    color: 'text-cyan-500',
    buttonBg: 'bg-cyan-500',
    buttonBorder: 'border-b-[#0e7490]',
  },
};

function getCategoryMeta(cat: string) {
  const c = (cat || '').toLowerCase();
  return (
    CATEGORY_META[c] || {
      label: cat.toUpperCase(),
      icon: Star,
      color: 'text-primary',
      buttonBg: 'bg-primary',
      buttonBorder: 'border-b-[#3730a3]',
    }
  );
}

// Identificação da fase ativa e da primeira etapa pendente
const activePhase = computed<TrailPhase | null>(() => {
  if (!trail.value?.phases || trail.value.phases.length === 0) return null;
  return trail.value.phases.find((p) => p.status === 'active') || trail.value.phases[0];
});

const activeStepId = computed(() => {
  if (!activePhase.value?.steps) return null;
  const firstPending = activePhase.value.steps.find((s) => !s.is_completed);
  return firstPending ? firstPending.id : null;
});

// Sumário geral de fases e etapas concluídas
const trailSummary = computed(() => {
  const phases = trail.value?.phases || [];
  const allSteps = phases.flatMap((phase) => phase.steps || []);
  const completedSteps = allSteps.filter((step) => step.is_completed).length;
  const completedPhases = phases.filter((phase) => phase.status === 'completed').length;
  const percent = allSteps.length > 0 ? Math.round((completedSteps / allSteps.length) * 100) : 0;

  return {
    phases: phases.length,
    completedPhases,
    totalSteps: allSteps.length,
    completedSteps,
    percent,
  };
});

function getPhaseProgress(phase: TrailPhase) {
  const steps = phase.steps || [];
  const completed = steps.filter((s) => s.is_completed).length;
  const total = steps.length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const remaining = Math.max(0, total - completed);
  return { completed, total, percent, remaining };
}

// Resumo numérico para a aba de metas semanais
const summary = computed(() => {
  const active = goals.value.filter(
    (g) => !(g.is_completed ?? g.achieved ?? ((g.progress ?? g.current ?? 0) >= g.target))
  ).length;
  const completed = goals.value.filter(
    (g) => g.is_completed ?? g.achieved ?? ((g.progress ?? g.current ?? 0) >= g.target)
  ).length;
  const streak = streakData.value?.current_streak || 0;
  return { active, completed, streak };
});

const filteredGoals = computed(() => {
  return goals.value.filter((goal) => {
    const current = goal.progress ?? goal.current ?? 0;
    const isDone = goal.is_completed ?? goal.achieved ?? current >= goal.target;
    if (filterTab.value === 'todo') return !isDone;
    if (filterTab.value === 'completed') return isDone;
    return true;
  });
});

// Modelos da trilha contínua em curva unificada
export interface TrailNodeItem {
  type: 'step' | 'chest' | 'exam';
  id: string;
  x: number;
  y: number;
  step?: TrailStep;
  boss?: BossFight;
  phase: TrailPhase;
  isCompleted?: boolean;
  isUnlocked?: boolean;
  isActive?: boolean;
  title: string;
  category?: string;
  stepIndex?: number;
  globalIndex: number;
}

export interface PhaseBannerItem {
  phase: TrailPhase;
  phaseIndex: number;
  y: number;
}

export interface MascotItem {
  id: string;
  avatar: string;
  name: string;
  quote: string;
  icon: string;
  side: 'left' | 'right';
  x: number;
  y: number;
}

// Deslocamentos sinusoidais orgânicos para o fluxo do caminho (largura do contêiner = 480)
const S_OFFSETS = [0, 52, 85, 52, 0, -52, -85, -52];
const CONTAINER_WIDTH = 480;
const CENTER_X = CONTAINER_WIDTH / 2; // Ponto central em x = 240
const NODE_SPACING_Y = 125;
const PHASE_BANNER_HEIGHT = 86;
const INTER_PHASE_ROAD_GAP = 160;

// Cálculo da geometria do traçado e posicionamento dos elementos
const fullTrailLayout = computed(() => {
  const phases = trail.value?.phases || [];
  if (phases.length === 0) {
    return {
      nodes: [],
      banners: [],
      mascots: [],
      totalHeight: 400,
      fullPathD: '',
      completedPathD: '',
    };
  }

  const nodes: TrailNodeItem[] = [];
  const banners: PhaseBannerItem[] = [];
  const mascots: MascotItem[] = [];
  let currentY = 24;
  let globalIndex = 0;

  phases.forEach((phase, pIdx) => {
    // Posição do banner da fase
    banners.push({
      phase,
      phaseIndex: pIdx,
      y: currentY,
    });
    currentY += PHASE_BANNER_HEIGHT + 45;

    const steps = phase.steps || [];
    const allStepsDone = steps.length > 0 && steps.every((s) => s.is_completed);

    steps.forEach((step, sIdx) => {
      const isActive =
        phase.status === 'active' &&
        step.id === activeStepId.value &&
        !step.is_completed;

      const x = CENTER_X + S_OFFSETS[globalIndex % S_OFFSETS.length];
      const y = currentY;

      nodes.push({
        type: 'step',
        id: step.id || `step-${pIdx}-${sIdx}`,
        x,
        y,
        step,
        phase,
        isCompleted: !!step.is_completed,
        isUnlocked: phase.status !== 'locked',
        isActive,
        title: step.title,
        category: step.category,
        stepIndex: sIdx,
        globalIndex,
      });

      // Mascote 1 na baía esquerda da Fase 1 (quando a estrada curva para a direita em x=292..325)
      if (pIdx === 0 && sIdx === 1) {
        mascots.push({
          id: 'mascot-p1-left',
          avatar: '/avatar/avatar_tati_normal.webp',
          name: 'Teacher Tati',
          quote: 'Keep it up! 🚀',
          icon: '★',
          side: 'left',
          x: 75,
          y: y + 55,
        });
      }

      globalIndex++;
      currentY += NODE_SPACING_Y;

      // Baú de checkpoint intermediário para fases com 4 ou mais etapas
      if (steps.length >= 4 && sIdx === 2) {
        const priorStepsDone = steps.slice(0, 3).every((s) => s.is_completed);
        const chestX = CENTER_X + S_OFFSETS[globalIndex % S_OFFSETS.length];
        const chestY = currentY;

        nodes.push({
          type: 'chest',
          id: `${phase.id}-chest`,
          x: chestX,
          y: chestY,
          phase,
          isCompleted: priorStepsDone,
          isUnlocked: priorStepsDone && phase.status !== 'locked',
          title: `Phase ${phase.number} Checkpoint Chest`,
          globalIndex,
        });

        globalIndex++;
        currentY += NODE_SPACING_Y;
      }
    });

    // Mascote 2 na baía direita da Fase 1 (quando a estrada curva para a esquerda em x=188..155)
    if (pIdx === 0) {
      mascots.push({
        id: 'mascot-p1-right',
        avatar: '/avatar/avatar_tati_ouvindo.webp',
        name: 'Teacher Tati',
        quote: 'Great ear! 🎧',
        icon: '🎧',
        side: 'right',
        x: 405,
        y: currentY - 50,
      });
    }

    // Exame final da fase
    const examUnlocked =
      phase.status !== 'locked' &&
      (!!phase.boss_fight?.is_unlocked || allStepsDone);

    const examX = CENTER_X + S_OFFSETS[globalIndex % S_OFFSETS.length];
    const examY = currentY;

    nodes.push({
      type: 'exam',
      id: `${phase.id}-exam`,
      x: examX,
      y: examY,
      boss: phase.boss_fight,
      phase,
      isCompleted: !!phase.boss_fight?.is_completed,
      isUnlocked: examUnlocked,
      title: `Phase ${phase.number} Exam`,
      globalIndex,
    });

    // Mascote 3 na baía esquerda da Fase 2
    if (pIdx === 1) {
      mascots.push({
        id: 'mascot-p2-left',
        avatar: '/avatar/avatar_tati_aberta.webp',
        name: 'Teacher Tati',
        quote: 'Fluency in sight! 🌟',
        icon: '✨',
        side: 'left',
        x: 75,
        y: examY - 40,
      });
    }

    globalIndex++;

    // Transição suave conectando fisicamente à próxima fase
    if (pIdx < phases.length - 1) {
      currentY += INTER_PHASE_ROAD_GAP;
    } else {
      currentY += 80;
    }
  });

  const totalHeight = currentY;

  // Traçado contínuo em curva Bézier cúbica conectando todos os nós
  let fullPathD = '';
  let completedPathD = '';

  if (nodes.length > 0) {
    fullPathD = `M ${nodes[0].x} ${nodes[0].y}`;
    for (let i = 1; i < nodes.length; i++) {
      const prev = nodes[i - 1];
      const curr = nodes[i];
      const dy = curr.y - prev.y;
      fullPathD += ` C ${prev.x} ${prev.y + dy * 0.5}, ${curr.x} ${curr.y - dy * 0.5}, ${curr.x} ${curr.y}`;

      if (prev.isCompleted) {
        if (!completedPathD) {
          completedPathD = `M ${prev.x} ${prev.y}`;
        }
        completedPathD += ` C ${prev.x} ${prev.y + dy * 0.5}, ${curr.x} ${curr.y - dy * 0.5}, ${curr.x} ${curr.y}`;
      }
    }
  }

  return {
    nodes,
    banners,
    mascots,
    totalHeight,
    fullPathD,
    completedPathD,
  };
});

// Carregamento dos dados da trilha
async function loadTrail() {
  isLoadingTrail.value = true;
  try {
    const res = await apiGet<LearningTrail>('/users/trail');
    trail.value = res;
  } catch (err) {
    console.error('Erro ao carregar trilha de aprendizagem:', err);
  } finally {
    isLoadingTrail.value = false;
  }
}

// Carregamento das metas de estudo e sequência de dias
async function loadGoals() {
  isLoadingGoals.value = true;
  try {
    const [goalsRes, streakRes] = await Promise.allSettled([
      apiGet<any>('/users/goals'),
      apiGet<StreakData>('/users/streak'),
    ]);

    if (goalsRes.status === 'fulfilled' && goalsRes.value) {
      const data = goalsRes.value;
      if (Array.isArray(data)) goals.value = data;
      else if (Array.isArray(data.goals)) goals.value = data.goals;
      else if (Array.isArray(data.data)) goals.value = data.data;
    }

    if (streakRes.status === 'fulfilled' && streakRes.value) {
      streakData.value = streakRes.value;
    }
  } catch (err) {
    console.error('Erro ao carregar metas de estudo:', err);
  } finally {
    isLoadingGoals.value = false;
  }
}

// Clique em uma etapa de atividade da trilha
function handleNodeClick(item: TrailNodeItem) {
  if (item.phase.status === 'locked' || (!item.isUnlocked && !item.isCompleted)) {
    toast.error(`Phase ${item.phase.number} is locked. Complete Phase ${item.phase.number - 1} and pass its Exam to unlock!`);
    return;
  }
  selectedNode.value = { type: 'step', phase: item.phase, step: item.step, index: item.stepIndex };
}

// Clique no exame da fase
function handleExamClick(item: TrailNodeItem) {
  if (item.phase.status === 'locked' || (!item.isUnlocked && !item.isCompleted)) {
    toast.error(`Phase ${item.phase.number} Exam is locked. Complete all previous quests to unlock!`);
    return;
  }
  selectedNode.value = { type: 'exam', phase: item.phase, boss: item.boss };
}

// Clique no baú de checkpoint
function handleChestClick(phase: TrailPhase, isUnlocked: boolean) {
  if (phase.status === 'locked') {
    toast.error(`Phase ${phase.number} is locked! Complete earlier phases to unlock.`);
    return;
  }
  selectedChest.value = { phase, isUnlocked };
}

// Abre a atividade diretamente em nova aba sem redirecionamento para filtros vazios
function handleStartActivity(step: TrailStep) {
  let targetRoute = (step.route || '').trim();

  if (step.category === 'simulations') {
    selectedNode.value = null;
    router.push('/voice');
    return;
  }

  // Link direto externo: abre imediatamente em nova aba
  if (targetRoute.startsWith('http://') || targetRoute.startsWith('https://')) {
    window.open(targetRoute, '_blank');
    return;
  }

  // Rota direta de fallback com slug sanitizado
  const cat = ['grammar', 'vocabulary', 'reading', 'listening'].includes(step.category)
    ? step.category
    : 'grammar';
  const cleanSlug = step.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const directUrl = `https://test-english.com/${cat}/${cleanSlug}/`;
  window.open(directUrl, '_blank');
}

// Alterna o status de conclusão e sincroniza todo o sistema com WebSocket e pontuação
async function handleToggleStepCompletion(phase: TrailPhase, step: TrailStep) {
  if (isTogglingStep.value) return;
  isTogglingStep.value = true;
  const previousStatus = step.is_completed;
  const previousProgress = step.progress;
  const newStatus = !previousStatus;
  step.is_completed = newStatus;
  step.progress = newStatus ? (step.target_count || 1) : 0;

  try {
    await apiPost('/users/trail/step/toggle', {
      phase_id: phase.id,
      step_id: step.id,
      is_completed: newStatus,
    });
    toast.success(
      newStatus
        ? 'Activity completed! +25 XP awarded.'
        : 'Activity marked as pending.',
    );

    await loadGoals();
  } catch (err) {
    step.is_completed = previousStatus;
    step.progress = previousProgress;
    console.error('Erro ao atualizar atividade da trilha:', err);
    toast.error('Could not update activity status. Please try again.');
  } finally {
    isTogglingStep.value = false;
  }
}

// Navega até a interface de exames
function handleStartExam(boss?: BossFight) {
  selectedNode.value = null;
  if (!boss?.is_unlocked && !boss?.is_completed) {
    toast.error('Complete all quests in this phase to unlock the Exam!');
    return;
  }
  router.push('/exams');
}

// Ouvinte de atualização em tempo real de etapa via WebSocket
function handleLearningTrailUpdate(event: any) {
  const data = event?.detail || event;
  if (!data) return;

  if (trail.value?.phases) {
    for (const phase of trail.value.phases) {
      if (!data.phase_id || phase.id === data.phase_id) {
        const step = phase.steps?.find((s) => s.id === data.step_id);
        if (step) {
          step.is_completed = data.is_completed;
          step.progress = data.is_completed ? (step.target_count || 1) : 0;
        }
        if (data.boss_unlocked !== undefined && phase.boss_fight) {
          phase.boss_fight.is_unlocked = data.boss_unlocked;
        }
      }
    }
    trail.value = { ...trail.value };
  }
}

// Ouvinte de atualização em tempo real de trilha completa
function handleFullTrailUpdate(event: any) {
  const data = event?.detail || event;
  if (!data) return;
  if (data.trail) {
    trail.value = data.trail;
  } else {
    loadTrail();
  }
}

onMounted(() => {
  loadTrail();
  loadGoals();
  window.addEventListener('learning-trail-step-updated', handleLearningTrailUpdate);
  window.addEventListener('learning-trail-updated', handleFullTrailUpdate);
});

onUnmounted(() => {
  window.removeEventListener('learning-trail-step-updated', handleLearningTrailUpdate);
  window.removeEventListener('learning-trail-updated', handleFullTrailUpdate);
});
</script>

<template>
  <div class="trail-page p-4 md:p-8 max-w-5xl mx-auto w-full space-y-8 animate-fade-in">
    <!-- Cabeçalho superior e seletor de modo -->
    <header class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="flex items-center gap-3.5">
        <div class="w-12 h-12 rounded-2xl bg-primary text-white shadow-lg shadow-primary/20 flex items-center justify-center shrink-0">
          <Compass class="w-6 h-6" />
        </div>
        <div>
          <h1 class="text-2xl md:text-3xl font-display font-black text-text">
            Learning Trail & Goals
          </h1>
          <p class="text-text-muted text-xs md:text-sm mt-0.5">
            Advance along the curved path, complete your teacher's quests, and conquer the Phase Exam!
          </p>
        </div>
      </div>

      <!-- Seletor de abas principal -->
      <div class="flex bg-surface border border-border p-1 rounded-2xl shrink-0 shadow-xs">
        <button
          type="button"
          @click="activeMainTab = 'trail'"
          class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
          :class="activeMainTab === 'trail' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text'"
        >
          <Swords class="w-3.5 h-3.5" />
          Learning Path
        </button>
        <button
          type="button"
          @click="activeMainTab = 'weekly'"
          class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
          :class="activeMainTab === 'weekly' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text'"
        >
          <Target class="w-3.5 h-3.5" />
          Weekly Goals
        </button>
      </div>
    </header>

    <!-- Aba 1: Trilha contínua de aprendizagem -->
    <div v-if="activeMainTab === 'trail'" class="space-y-8">
      <!-- Carregamento inicial da trilha -->
      <div v-if="isLoadingTrail" class="py-24 text-center bg-surface border border-border rounded-3xl shadow-sm">
        <div class="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3"></div>
        <p class="text-xs font-bold text-text-muted">Loading your learning trail...</p>
      </div>

      <!-- Tela de Recurso em Fase de Teste quando bloqueado por feature flag -->
      <div
        v-else-if="trail?.is_in_testing"
        class="w-full max-w-xl mx-auto py-12 px-6 bg-surface border border-border rounded-3xl text-center space-y-6 shadow-sm animate-fade-in"
      >
        <div class="relative w-28 h-28 mx-auto">
          <div class="absolute -inset-3 rounded-full bg-primary/20 blur-xl animate-pulse"></div>
          <div class="relative w-28 h-28 rounded-full border-4 border-primary/30 p-1 bg-surface shadow-xl overflow-hidden flex items-center justify-center">
            <img
              src="/avatar/avatar_tati_normal.webp"
              alt="Teacher Tatiana"
              class="w-full h-full rounded-full object-cover"
              referrerpolicy="no-referrer"
            />
          </div>
          <div class="absolute -bottom-1 -right-1 px-2.5 py-0.5 rounded-full bg-amber-500 text-white text-[0.65rem] font-black uppercase tracking-wider shadow-md flex items-center gap-1 border-2 border-surface">
            <Sparkles class="w-3 h-3" />
            BETA
          </div>
        </div>

        <div class="space-y-2 max-w-md mx-auto">
          <div class="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/20 text-primary text-xs font-black uppercase tracking-wider">
            <Compass class="w-3.5 h-3.5" />
            Recurso em Fase de Testes
          </div>
          <h2 class="text-xl sm:text-2xl font-display font-black text-text">
            Trilha de Aprendizagem em Teste
          </h2>
          <p class="text-xs sm:text-sm text-text-muted leading-relaxed">
            A nova trilha gamificada com missões diárias e exames está sendo calibrada pedagogicamente pela Teacher Tatiana e administradores. Em breve estará liberada para todos os alunos!
          </p>
        </div>

        <div class="p-4 rounded-2xl bg-bg-secondary border border-border text-left flex items-start gap-3 max-w-md mx-auto">
          <div class="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0 mt-0.5">
            <Target class="w-4 h-4" />
          </div>
          <div class="min-w-0">
            <h4 class="text-xs font-bold text-text">Pratique nas Metas Semanais</h4>
            <p class="text-[0.7rem] text-text-muted mt-0.5">
              Seu progresso de atividades, flashcards e conversações continua ativo e pontuando normalmente.
            </p>
          </div>
        </div>

        <div>
          <button
            type="button"
            @click="activeMainTab = 'weekly'"
            class="px-6 py-3 rounded-2xl bg-primary text-white text-xs font-black uppercase tracking-wider shadow-md hover:bg-primary-hover active:scale-95 transition-all cursor-pointer inline-flex items-center gap-2"
          >
            <Target class="w-4 h-4" />
            Ver Minhas Metas Semanais
          </button>
        </div>
      </div>

      <!-- Trilha completa e ativa quando o aluno tem permissão -->
      <div v-else-if="trail && trail.phases && trail.phases.length > 0" class="space-y-8">
        <!-- Banner de progresso geral da jornada -->
        <section class="w-full max-w-xl mx-auto rounded-3xl border border-primary/20 bg-surface shadow-sm p-4 sm:p-5">
          <div class="flex items-center justify-between gap-4">
            <div class="space-y-1 min-w-0">
              <div class="flex items-center gap-2">
                <span class="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-primary text-white text-[0.65rem] font-black uppercase tracking-wider shadow-xs">
                  <Sparkles class="w-3 h-3" />
                  Level {{ trail.level || 'B1' }}
                </span>
                <span class="text-[0.68rem] font-bold text-text-muted">
                  {{ trailSummary.completedPhases }} of {{ trailSummary.phases }} phases completed
                </span>
              </div>
              <h2 class="text-base sm:text-lg font-display font-black text-text truncate">
                {{ trail.title }}
              </h2>
            </div>

            <!-- Pílula de progresso -->
            <div class="text-right shrink-0">
              <div class="text-lg sm:text-xl font-black text-primary">
                {{ trailSummary.percent }}%
              </div>
              <span class="text-[0.62rem] font-bold text-text-muted block">
                {{ trailSummary.completedSteps }} / {{ trailSummary.totalSteps }} quests
              </span>
            </div>
          </div>

          <!-- Barra de progresso -->
          <div class="w-full bg-bg-secondary h-2 rounded-full overflow-hidden mt-3 border border-border">
            <div
              class="h-full rounded-full bg-gradient-to-r from-primary to-emerald-500 transition-all duration-700"
              :style="{ width: `${trailSummary.percent}%` }"
            ></div>
          </div>

          <!-- Recado da Teacher Tatiana -->
          <div v-if="trail.teacher_notes" class="mt-3 flex items-center gap-2.5 p-2.5 rounded-2xl bg-primary/5 border border-primary/15">
            <img
              src="/avatar/avatar_tati_normal.webp"
              alt="Teacher Tatiana"
              class="w-7 h-7 rounded-full object-cover border border-primary/25 shrink-0"
              referrerpolicy="no-referrer"
            />
            <p class="text-xs text-text-muted truncate">
              <strong class="text-primary font-bold">Teacher Tati:</strong> {{ trail.teacher_notes }}
            </p>
          </div>
        </section>

        <!-- Trilha contínua conectando todas as fases -->
        <div class="w-full flex justify-center py-4">
          <div
            class="relative w-[480px] max-w-full mx-auto overflow-visible select-none"
            :style="{ height: fullTrailLayout.totalHeight + 'px' }"
          >
            <!-- 1. Leito contínuo da estrada em SVG -->
            <svg
              class="absolute inset-0 w-full h-full pointer-events-none"
              :viewBox="`0 0 480 ${fullTrailLayout.totalHeight}`"
              fill="none"
            >
              <!-- 1a. Sombra e profundidade do leito -->
              <path
                v-if="fullTrailLayout.fullPathD"
                :d="fullTrailLayout.fullPathD"
                fill="none"
                class="stroke-black/10 dark:stroke-black/45"
                stroke-width="58"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <!-- 1b. Superfície de pavimentação da trilha -->
              <path
                v-if="fullTrailLayout.fullPathD"
                :d="fullTrailLayout.fullPathD"
                fill="none"
                class="stroke-border/75 dark:stroke-surface-hover/75"
                stroke-width="46"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <!-- 1c. Fita iluminada de etapas concluídas -->
              <path
                v-if="fullTrailLayout.completedPathD"
                :d="fullTrailLayout.completedPathD"
                fill="none"
                class="stroke-primary/75 dark:stroke-primary/60 transition-all duration-700"
                stroke-width="46"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
              <!-- 1d. Linha guia central pontilhada -->
              <path
                v-if="fullTrailLayout.fullPathD"
                :d="fullTrailLayout.fullPathD"
                fill="none"
                class="stroke-white/40 dark:stroke-white/20"
                stroke-width="3"
                stroke-dasharray="8 12"
                stroke-linecap="round"
                stroke-linejoin="round"
              />
            </svg>

            <!-- 2. Banners de unidade das fases ao longo da estrada -->
            <div
              v-for="b in fullTrailLayout.banners"
              :key="b.phase.id || b.phaseIndex"
              class="absolute left-1/2 -translate-x-1/2 w-[92%] sm:w-[450px] z-20 pointer-events-auto"
              :style="{ top: b.y + 'px' }"
            >
              <div
                class="rounded-2xl border border-border bg-gradient-to-r from-surface via-surface to-bg-secondary p-4 shadow-sm flex items-center justify-between gap-3 transition-all"
                :class="b.phase.status === 'locked' ? 'opacity-70 grayscale-[25%]' : ''"
              >
                <div class="space-y-0.5 min-w-0">
                  <div class="flex items-center gap-2">
                    <span
                      class="px-2.5 py-0.5 rounded-lg text-[0.65rem] font-black uppercase tracking-wider shadow-xs"
                      :class="b.phase.status === 'locked' ? 'bg-muted text-text-muted' : 'bg-primary text-white'"
                    >
                      Phase {{ b.phase.number }}
                    </span>
                    <span
                      class="px-2 py-0.5 rounded-lg text-[0.62rem] font-bold uppercase tracking-wider flex items-center gap-1"
                      :class="{
                        'bg-success/15 text-success border border-success/30': b.phase.status === 'completed',
                        'bg-amber-500/15 text-amber-500 border border-amber-500/30': b.phase.status === 'active',
                        'bg-muted/15 text-text-muted border border-border': b.phase.status === 'locked',
                      }"
                    >
                      <component
                        :is="b.phase.status === 'completed' ? CheckCircle2 : b.phase.status === 'active' ? Play : Lock"
                        class="w-3 h-3"
                      />
                      {{ b.phase.status === 'completed' ? 'COMPLETED' : b.phase.status === 'active' ? 'IN PROGRESS' : 'LOCKED' }}
                    </span>
                  </div>
                  <h3 class="text-sm sm:text-base font-display font-black text-text truncate">
                    {{ b.phase.title }}
                  </h3>
                </div>

                <!-- Estatísticas de conclusão da fase -->
                <div class="text-right shrink-0">
                  <span class="text-xs font-black text-text block">
                    {{ getPhaseProgress(b.phase).completed }} / {{ getPhaseProgress(b.phase).total }} done
                  </span>
                  <span class="text-[0.62rem] font-bold text-text-muted block mt-0.5">
                    {{
                      b.phase.status === 'locked'
                        ? 'Locked'
                        : getPhaseProgress(b.phase).percent === 100
                        ? 'Exam Ready'
                        : `${getPhaseProgress(b.phase).remaining} to Exam`
                    }}
                  </span>
                </div>
              </div>
            </div>

            <!-- 3. Mascotes da Teacher Tatiana nos recantos da curva -->
            <div
              v-for="m in fullTrailLayout.mascots"
              :key="m.id"
              class="absolute pointer-events-none flex flex-col items-center z-15 hidden sm:flex -translate-x-1/2 -translate-y-1/2"
              :style="{ left: m.x + 'px', top: m.y + 'px' }"
            >
              <div class="mb-2 px-3 py-1 bg-surface border border-primary/25 rounded-2xl shadow-md text-xs font-semibold text-text flex items-center gap-1.5 animate-bounce">
                <span class="text-primary font-black">{{ m.name }}:</span>
                <span>{{ m.quote }}</span>
              </div>
              <div class="relative w-16 h-16 sm:w-18 sm:h-18 rounded-full p-1 bg-surface border-2 border-primary/40 shadow-lg shadow-primary/10">
                <img
                  :src="m.avatar"
                  :alt="m.name"
                  class="w-full h-full rounded-full object-cover"
                  referrerpolicy="no-referrer"
                />
                <div class="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs shadow-xs font-black">
                  {{ m.icon }}
                </div>
              </div>
            </div>

            <!-- 4. Botões 3D interativos ao longo da estrada -->
            <div
              v-for="item in fullTrailLayout.nodes"
              :key="item.id"
              class="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-25 pointer-events-auto"
              :style="{ left: item.x + 'px', top: item.y + 'px' }"
            >
              <!-- 4a. Nó de atividade pedagógica -->
              <template v-if="item.type === 'step' && item.step">
                <!-- Balão flutuante de início para a etapa ativa -->
                <div
                  v-if="item.isActive"
                  class="absolute -top-12 z-30 flex flex-col items-center animate-bounce pointer-events-none"
                >
                  <div class="px-3.5 py-1.5 rounded-2xl bg-primary text-white text-[0.72rem] font-black uppercase tracking-wider shadow-xl shadow-primary/40 flex items-center gap-1.5 border border-white/20">
                    <Play class="w-3 h-3 fill-white text-white" />
                    START
                  </div>
                  <div class="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-primary"></div>
                </div>

                <!-- Anel pulsante ampliado para o nó ativo -->
                <div
                  v-if="item.isActive"
                  class="absolute -inset-3.5 sm:-inset-4 rounded-full ring-4 ring-primary/40 ring-offset-4 ring-offset-bg animate-pulse pointer-events-none"
                ></div>

                <!-- Botão 3D da trilha de aprendizado -->
                <button
                  type="button"
                  @click="handleNodeClick(item)"
                  :class="[
                    item.phase.status === 'locked' || (!item.isUnlocked && !item.isCompleted)
                      ? 'w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-all duration-200 transform shadow-md bg-surface border border-border border-b-[6px] border-b-border/80 text-text-muted opacity-50 cursor-not-allowed'
                      : item.isCompleted
                      ? 'w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-all duration-200 transform cursor-pointer active:translate-y-1 active:border-b-2 shadow-md bg-emerald-500 border-b-[6px] border-b-[#047857] text-white shadow-emerald-500/25 hover:scale-105'
                      : item.isActive
                      ? 'w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-all duration-200 transform cursor-pointer active:translate-y-1 active:border-b-2 shadow-lg bg-primary border-b-[6px] border-b-[#3730a3] text-white shadow-primary/30 hover:scale-105'
                      : 'w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-all duration-200 transform cursor-pointer active:translate-y-1 active:border-b-2 shadow-md bg-surface border border-border border-b-[6px] border-b-border/80 text-text hover:border-primary/40 hover:scale-105',
                  ]"
                >
                  <component
                    :is="item.phase.status === 'locked' || (!item.isUnlocked && !item.isCompleted) ? Lock : item.isCompleted ? Check : item.isActive ? Star : getCategoryMeta(item.category || '').icon"
                    class="w-7 h-7 sm:w-8 sm:h-8"
                    :class="item.isCompleted ? 'stroke-[3.5]' : item.isActive ? 'fill-white' : ''"
                  />
                </button>

                <!-- Rótulo do nó -->
                <div class="mt-2 text-center max-w-[130px] pointer-events-none">
                  <span class="text-[0.7rem] font-bold text-text truncate block leading-tight">
                    {{ item.title }}
                  </span>
                  <span class="text-[0.6rem] font-bold uppercase text-text-muted tracking-wider">
                    {{ getCategoryMeta(item.category || '').label }}
                  </span>
                </div>
              </template>

              <!-- 4b. Nó de baú de checkpoint -->
              <template v-else-if="item.type === 'chest'">
                <div class="relative flex flex-col items-center">
                  <button
                    type="button"
                    @click="handleChestClick(item.phase, !!item.isUnlocked)"
                    :class="[
                      item.isUnlocked
                        ? 'w-18 h-16 sm:w-20 sm:h-18 rounded-2xl flex flex-col items-center justify-center transition-all duration-200 transform cursor-pointer active:translate-y-1 shadow-lg bg-gradient-to-b from-amber-400 to-amber-600 border-2 border-amber-300 border-b-[6px] border-b-amber-800 text-white hover:scale-110 shadow-amber-500/25'
                        : 'w-18 h-16 sm:w-20 sm:h-18 rounded-2xl flex flex-col items-center justify-center transition-all duration-200 transform shadow-md bg-surface border border-border border-b-[6px] border-b-border/80 text-text-muted opacity-60 cursor-not-allowed',
                    ]"
                  >
                    <Package class="w-8 h-8 drop-shadow-xs" />
                    <span class="text-[0.55rem] font-black uppercase tracking-wider mt-0.5" :class="item.isUnlocked ? 'text-amber-100' : 'text-text-muted'">
                      {{ item.isUnlocked ? 'BONUS' : 'LOCKED' }}
                    </span>
                  </button>

                  <!-- Rótulo do baú -->
                  <div class="mt-1 text-center max-w-[120px] pointer-events-none">
                    <span class="text-[0.65rem] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
                      Checkpoint
                    </span>
                  </div>
                </div>
              </template>

              <!-- 4c. Botão 3D do exame da fase -->
              <template v-else-if="item.type === 'exam'">
                <div class="relative flex flex-col items-center mt-2">
                  <!-- Balão indicador para o exame da fase -->
                  <div
                    v-if="item.isUnlocked && !item.isCompleted"
                    class="absolute -top-11 z-30 flex flex-col items-center animate-bounce pointer-events-none"
                  >
                    <div class="px-3.5 py-1 rounded-xl bg-primary text-white text-[0.7rem] font-black uppercase tracking-wider shadow-lg shadow-primary/30 flex items-center gap-1.5 border border-primary-hover">
                      <FileCheck class="w-3.5 h-3.5" />
                      TAKE EXAM
                    </div>
                    <div class="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-primary"></div>
                  </div>

                  <!-- Botão 3D do exame -->
                  <button
                    type="button"
                    @click="handleExamClick(item)"
                    :class="[
                      item.phase.status === 'locked' || (!item.isUnlocked && !item.isCompleted)
                        ? 'w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center transition-all duration-300 transform shadow-md bg-surface border-2 border-border border-b-[8px] border-b-border text-text-muted opacity-60 cursor-not-allowed'
                        : item.isCompleted
                        ? 'w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center transition-all duration-300 transform cursor-pointer active:translate-y-1 active:border-b-2 shadow-xl bg-emerald-500 border-b-[8px] border-b-emerald-800 text-white shadow-emerald-500/30 hover:scale-105'
                        : 'w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center transition-all duration-300 transform cursor-pointer active:translate-y-1 active:border-b-2 shadow-xl bg-gradient-to-b from-amber-500 to-amber-600 border-b-[8px] border-b-amber-800 text-white ring-4 ring-amber-400/40 ring-offset-4 ring-offset-bg shadow-amber-500/30 animate-pulse hover:scale-105',
                    ]"
                  >
                    <component
                      :is="item.phase.status === 'locked' || (!item.isUnlocked && !item.isCompleted) ? Lock : item.isCompleted ? Trophy : Award"
                      class="w-10 h-10 sm:w-11 sm:h-11"
                    />
                  </button>

                  <!-- Rótulo do exame -->
                  <div class="mt-2 text-center max-w-[150px] pointer-events-none">
                    <span class="text-xs font-black uppercase tracking-wider text-text block">
                      Phase {{ item.phase.number }} Exam
                    </span>
                    <span
                      class="text-[0.65rem] font-extrabold uppercase mt-0.5 inline-block px-2 py-0.2 rounded-full"
                      :class="
                        item.isCompleted
                          ? 'bg-success/15 text-success'
                          : item.isUnlocked
                          ? 'bg-amber-500/15 text-amber-500'
                          : 'bg-surface text-text-muted border border-border'
                      "
                    >
                      {{ item.isCompleted ? 'Passed' : item.isUnlocked ? 'Unlocked' : 'Locked' }}
                    </span>
                  </div>
                </div>
              </template>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Aba 2: Metas semanais e sequência de estudos -->
    <div v-else class="space-y-8 animate-fade-in">
      <!-- Cartões de resumo -->
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div class="p-5 rounded-2xl bg-surface border border-border flex items-center justify-between shadow-xs">
          <div>
            <span class="text-xs font-bold text-text-subtle uppercase tracking-wider block">To Do</span>
            <p class="text-2xl font-black text-primary mt-1">{{ summary.active }}</p>
          </div>
          <div class="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
            <Target class="w-6 h-6" />
          </div>
        </div>

        <div class="p-5 rounded-2xl bg-surface border border-border flex items-center justify-between shadow-xs">
          <div>
            <span class="text-xs font-bold text-text-subtle uppercase tracking-wider block">Completed</span>
            <p class="text-2xl font-black text-success mt-1">{{ summary.completed }}</p>
          </div>
          <div class="w-11 h-11 rounded-xl bg-success/10 flex items-center justify-center text-success">
            <CheckCircle2 class="w-6 h-6" />
          </div>
        </div>

        <div class="p-5 rounded-2xl bg-surface border border-border flex items-center justify-between shadow-xs">
          <div>
            <span class="text-xs font-bold text-text-subtle uppercase tracking-wider block">Current Streak</span>
            <p class="text-2xl font-black text-orange-500 mt-1">{{ summary.streak }} days</p>
          </div>
          <div
            class="w-11 h-11 rounded-xl flex items-center justify-center"
            :class="summary.streak > 0 ? 'bg-orange-500/10' : 'bg-muted/10'"
          >
            <Flame class="w-6 h-6 text-orange-500" />
          </div>
        </div>
      </div>

      <!-- Abas de filtro -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 class="text-lg font-bold text-text">Weekly Category Goals</h2>
          <p class="text-xs text-text-muted mt-0.5">
            Complete activities across each category to maintain your weekly consistency bonus.
          </p>
        </div>

        <div class="flex bg-surface border border-border p-1 rounded-xl shrink-0">
          <button
            type="button"
            @click="filterTab = 'todo'"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
            :class="filterTab === 'todo' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text'"
          >
            To Do ({{ summary.active }})
          </button>
          <button
            type="button"
            @click="filterTab = 'completed'"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
            :class="filterTab === 'completed' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text'"
          >
            Completed ({{ summary.completed }})
          </button>
          <button
            type="button"
            @click="filterTab = 'all'"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer"
            :class="filterTab === 'all' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text'"
          >
            All ({{ goals.length }})
          </button>
        </div>
      </div>

      <!-- Carregamento das metas -->
      <div v-if="isLoadingGoals" class="py-16 text-center">
        <div class="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3"></div>
        <p class="text-xs font-bold text-text-muted">Loading your goals...</p>
      </div>

      <!-- Grade de metas -->
      <div v-else-if="filteredGoals.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          v-for="goal in filteredGoals"
          :key="goal.id || goal.type"
          class="p-5 rounded-2xl bg-surface border border-border shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between"
        >
          <div class="flex items-start justify-between gap-3 mb-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <component :is="getCategoryMeta(goal.type).icon" class="w-5 h-5" />
              </div>
              <div>
                <h3 class="font-bold text-sm text-text">{{ goal.title || goal.type }}</h3>
                <p class="text-xs text-text-muted line-clamp-1">
                  {{ goal.description || `Complete ${goal.target} items this period` }}
                </p>
              </div>
            </div>

            <span
              v-if="goal.is_completed ?? goal.achieved ?? ((goal.progress ?? goal.current ?? 0) >= goal.target)"
              class="px-2 py-0.5 rounded-full bg-success/10 text-success text-[0.65rem] font-black uppercase tracking-wider shrink-0"
            >
              Done
            </span>
            <span
              v-else
              class="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[0.65rem] font-black uppercase tracking-wider shrink-0"
            >
              In Progress
            </span>
          </div>

          <!-- Barra de progresso da meta -->
          <div class="space-y-1.5 pt-2">
            <div class="flex items-center justify-between text-xs font-semibold">
              <span class="text-text-muted">Progress</span>
              <span class="text-text">
                {{ goal.progress ?? goal.current ?? 0 }} / {{ goal.target }}
              </span>
            </div>

            <div class="w-full h-2 rounded-full bg-bg-secondary overflow-hidden">
              <div
                class="h-full rounded-full transition-all duration-500"
                :class="(goal.progress ?? goal.current ?? 0) >= goal.target ? 'bg-success' : 'bg-primary'"
                :style="{
                  width: `${Math.min(100, Math.round(((goal.progress ?? goal.current ?? 0) / (goal.target || 1)) * 100))}%`,
                }"
              />
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Diálogo de detalhes da atividade -->
    <Teleport to="body">
      <div v-if="selectedNode" class="fixed inset-0 z-[99999] overflow-y-auto" role="dialog" aria-modal="true">
        <!-- Cortina de fundo -->
        <div class="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity" @click="selectedNode = null"></div>

        <!-- Contêiner centralizado -->
        <div class="flex min-h-full items-center justify-center p-4 text-center sm:p-6">
          <div
            class="relative w-full max-w-sm transform overflow-visible rounded-3xl bg-surface border border-border p-6 text-center shadow-2xl transition-all sm:my-8 space-y-5 animate-in fade-in zoom-in-95 duration-150"
            @click.stop
          >
            <!-- Botão de fechar -->
            <button
              type="button"
              @click="selectedNode = null"
              class="absolute right-4 top-4 p-1.5 rounded-xl text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <X class="w-4 h-4" />
            </button>

            <!-- 1. Modal da etapa da atividade -->
            <template v-if="selectedStep && selectedPhase">
              <div
                class="w-16 h-16 rounded-full mx-auto flex items-center justify-center border-b-[4px] shadow-md"
                :class="[
                  selectedStep.is_completed
                    ? 'bg-emerald-500 border-b-emerald-700 text-white'
                    : 'bg-primary border-b-[#4c3552] text-white',
                ]"
              >
                <component
                  :is="selectedStep.is_completed ? Check : getCategoryMeta(selectedStep.category).icon"
                  class="w-8 h-8"
                />
              </div>

              <div class="space-y-1.5">
                <span class="px-2.5 py-0.5 rounded-full text-[0.65rem] font-bold uppercase tracking-wider bg-bg-secondary border border-border text-text-muted">
                  {{ getCategoryMeta(selectedStep.category).label }}
                </span>
                <h3 class="text-base font-black text-text mt-1 leading-snug">
                  {{ selectedStep.title }}
                </h3>
                <p class="text-xs text-text-muted leading-relaxed">
                  {{ selectedStep.description || 'Complete this exercise to progress toward the Phase Exam!' }}
                </p>
              </div>

              <!-- Ações da atividade: abrir link direto ou marcar como concluído -->
              <div class="space-y-2 pt-1">
                <button
                  type="button"
                  @click="handleStartActivity(selectedStep)"
                  class="w-full py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all transform active:translate-y-1 cursor-pointer flex items-center justify-center gap-1.5 bg-primary hover:bg-primary-hover text-white"
                >
                  <ExternalLink class="w-4 h-4" />
                  {{ selectedStep.is_completed ? 'Review Activity' : 'Open Activity' }}
                </button>

                <button
                  type="button"
                  @click="handleToggleStepCompletion(selectedPhase, selectedStep)"
                  :disabled="isTogglingStep"
                  class="w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center justify-center gap-1.5"
                  :class="[
                    selectedStep.is_completed
                      ? 'border-border text-text-muted hover:border-text-muted hover:bg-surface-hover'
                      : 'border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20',
                  ]"
                >
                  <component
                    :is="isTogglingStep ? Loader2 : selectedStep.is_completed ? RotateCcw : CheckCircle2"
                    class="w-4 h-4"
                    :class="isTogglingStep ? 'animate-spin' : ''"
                  />
                  {{
                    selectedStep.is_completed
                      ? 'Mark as Pending'
                      : 'Mark as Completed'
                  }}
                </button>
              </div>
            </template>

            <!-- 2. Modal do exame da fase -->
            <template v-else-if="selectedBoss && selectedPhase">
              <div
                class="w-20 h-20 rounded-full mx-auto flex items-center justify-center border-b-[5px] shadow-lg"
                :class="[
                  selectedBoss.is_completed
                    ? 'bg-success border-b-emerald-800 text-white shadow-success/30'
                    : selectedBoss.is_unlocked
                    ? 'bg-amber-500 border-b-amber-700 text-white shadow-amber-500/40 animate-pulse'
                    : 'bg-surface border-2 border-border border-b-border text-text-muted',
                ]"
              >
                <component
                  :is="selectedBoss.is_completed ? Trophy : selectedBoss.is_unlocked ? Award : Lock"
                  class="w-10 h-10"
                />
              </div>

              <div class="space-y-1.5">
                <span
                  class="px-2.5 py-0.5 rounded-full text-[0.65rem] font-black uppercase tracking-wider"
                  :class="
                    selectedBoss.is_completed
                      ? 'bg-success/15 text-success'
                      : selectedBoss.is_unlocked
                      ? 'bg-amber-500/15 text-amber-500'
                      : 'bg-surface text-text-muted border border-border'
                  "
                >
                  {{ selectedBoss.is_completed ? 'PASSED' : selectedBoss.is_unlocked ? 'READY' : 'LOCKED' }}
                </span>
                <h3 class="text-base font-black text-text">
                  Phase {{ selectedPhase.number }} Exam
                </h3>
                <p class="text-xs text-text-muted leading-relaxed">
                  {{ selectedBoss.description || 'Comprehensive evaluation based on the activities completed in this phase.' }}
                </p>
                <div class="text-[0.7rem] font-bold text-text-muted pt-1">
                  Passing grade: <span class="text-amber-500">{{ selectedBoss.min_score || 7.0 }} / 10</span>
                </div>
              </div>

              <!-- Ação do exame da fase -->
              <button
                type="button"
                @click="handleStartExam(selectedBoss)"
                :disabled="!selectedBoss.is_unlocked && !selectedBoss.is_completed"
                class="w-full py-3.5 px-6 rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg transition-all transform active:translate-y-1 active:border-b-2 cursor-pointer border-b-[5px] disabled:opacity-50 disabled:cursor-not-allowed"
                :class="[
                  selectedBoss.is_completed
                    ? 'bg-success border-b-emerald-800 text-white shadow-success/25'
                    : selectedBoss.is_unlocked
                    ? 'bg-amber-500 border-b-amber-700 hover:bg-amber-600 text-white shadow-amber-500/30'
                    : 'bg-surface border-border text-text-muted',
                ]"
              >
                {{
                  selectedBoss.is_completed
                    ? 'Review Exam Results'
                    : selectedBoss.is_unlocked
                    ? 'Start Phase Exam'
                    : 'Complete all quests to unlock'
                }}
              </button>
            </template>
          </div>
        </div>
      </div>
    </Teleport>

    <!-- Diálogo do baú de checkpoint -->
    <Teleport to="body">
      <div v-if="selectedChest" class="fixed inset-0 z-[99999] overflow-y-auto" role="dialog" aria-modal="true">
        <!-- Cortina de fundo -->
        <div class="fixed inset-0 bg-black/75 backdrop-blur-sm transition-opacity" @click="selectedChest = null"></div>

        <!-- Contêiner centralizado -->
        <div class="flex min-h-full items-center justify-center p-4 text-center sm:p-6">
          <div
            class="relative w-full max-w-sm transform overflow-visible rounded-3xl bg-surface border border-border p-6 text-center shadow-2xl transition-all sm:my-8 space-y-4 animate-in fade-in zoom-in-95 duration-150"
            @click.stop
          >
            <button
              type="button"
              @click="selectedChest = null"
              class="absolute right-4 top-4 p-1.5 rounded-xl text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <X class="w-4 h-4" />
            </button>

            <div
              class="w-20 h-16 rounded-2xl mx-auto flex items-center justify-center border-b-[4px] shadow-lg"
              :class="
                selectedChest.isUnlocked
                  ? 'bg-gradient-to-b from-amber-400 to-amber-600 border-b-amber-800 text-white shadow-amber-500/30'
                  : 'bg-surface border-2 border-border border-b-border text-text-muted'
              "
            >
              <Package class="w-9 h-9" />
            </div>

            <div class="space-y-1.5">
              <span
                class="px-2.5 py-0.5 rounded-full text-[0.65rem] font-black uppercase tracking-wider"
                :class="
                  selectedChest.isUnlocked
                    ? 'bg-amber-500/15 text-amber-500 border border-amber-500/30'
                    : 'bg-surface text-text-muted border border-border'
                "
              >
                {{ selectedChest.isUnlocked ? 'UNLOCKED' : 'LOCKED' }}
              </span>
              <h3 class="text-base font-black text-text">
                Checkpoint Chest
              </h3>
              <p class="text-xs text-text-muted leading-relaxed">
                {{
                  selectedChest.isUnlocked
                    ? 'Awesome progress! You reached the midpoint checkpoint of this phase. Keep up the great pace toward the Exam!'
                    : 'Complete the previous quests in this phase to open this milestone reward chest.'
                }}
              </p>
            </div>

            <button
              type="button"
              @click="selectedChest = null"
              class="w-full py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider bg-primary text-white hover:bg-primary-hover shadow-sm transition-all cursor-pointer"
            >
              {{ selectedChest.isUnlocked ? 'Claim Momentum' : 'Got it' }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
