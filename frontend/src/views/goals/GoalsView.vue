<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  Compass,
  Target,
  Swords,
  Trophy,
  CheckCircle2,
  Lock,
  Unlock,
  Flame,
  Clock,
  Sparkles,
  BookOpen,
  Headphones,
  Music,
  Gamepad2,
  Users,
  MessageSquare,
  FileText,
  ArrowRight,
  RotateCcw,
  ExternalLink,
  ChevronRight,
  ShieldCheck,
  AlertCircle,
} from 'lucide-vue-next';
import { apiGet, apiPost } from '@/api/client';
import { useToast } from '@/composables/useToast';

const router = useRouter();
const toast = useToast();

// Tab principal: Trilha Gamificada ou Metas Semanais
const activeMainTab = ref<'trail' | 'weekly'>('trail');

// --- TIPOS DA TRILHA GAMIFICADA ---
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
}

// --- TIPOS DAS METAS SEMANAIS ---
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

// Estados
const trail = ref<LearningTrail | null>(null);
const selectedPhaseIndex = ref<number>(0);
const isLoadingTrail = ref(true);

const goals = ref<Goal[]>([]);
const streakData = ref<StreakData | null>(null);
const filterTab = ref<'todo' | 'completed' | 'all'>('todo');
const isLoadingGoals = ref(true);

// Categoria icons & cores
const CATEGORY_ICONS: Record<string, any> = {
  grammar: FileText,
  vocabulary: BookOpen,
  reading: BookOpen,
  listening: Headphones,
  simulations: Users,
  music: Music,
  games: Gamepad2,
  flashcards: Sparkles,
  custom: FileText,
};

function getCategoryIcon(cat: string) {
  const c = (cat || '').toLowerCase();
  return CATEGORY_ICONS[c] || Target;
}

function getCategoryColor(cat: string) {
  const c = (cat || '').toLowerCase();
  switch (c) {
    case 'grammar':
      return 'text-blue-500 bg-blue-500/10 border-blue-500/20';
    case 'vocabulary':
      return 'text-emerald-500 bg-emerald-500/10 border-emerald-500/20';
    case 'reading':
      return 'text-amber-500 bg-amber-500/10 border-amber-500/20';
    case 'listening':
      return 'text-purple-500 bg-purple-500/10 border-purple-500/20';
    case 'simulations':
      return 'text-rose-500 bg-rose-500/10 border-rose-500/20';
    case 'music':
      return 'text-pink-500 bg-pink-500/10 border-pink-500/20';
    case 'games':
      return 'text-indigo-500 bg-indigo-500/10 border-indigo-500/20';
    case 'flashcards':
      return 'text-yellow-500 bg-yellow-500/10 border-yellow-500/20';
    default:
      return 'text-primary bg-primary/10 border-primary/20';
  }
}

// Fase ativa selecionada
const activePhase = computed<TrailPhase | null>(() => {
  if (!trail.value?.phases || trail.value.phases.length === 0) return null;
  return trail.value.phases[selectedPhaseIndex.value] || trail.value.phases[0];
});

// Progresso da fase ativa
const phaseProgress = computed(() => {
  if (!activePhase.value) return { completed: 0, total: 0, percent: 0, remaining: 0 };
  const steps = activePhase.value.steps || [];
  const completed = steps.filter((s) => s.is_completed).length;
  const total = steps.length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const remaining = Math.max(0, total - completed);
  return { completed, total, percent, remaining };
});

// Sumário das metas semanais
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

async function loadTrail() {
  isLoadingTrail.value = true;
  try {
    const res = await apiGet<LearningTrail>('/users/trail');
    trail.value = res;
    // Seleciona a primeira fase ativa ou a atual
    if (res?.phases) {
      const activeIdx = res.phases.findIndex((p) => p.status === 'active');
      if (activeIdx !== -1) selectedPhaseIndex.value = activeIdx;
    }
  } catch (err) {
    console.error('Error loading learning trail:', err);
  } finally {
    isLoadingTrail.value = false;
  }
}

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
    console.error('Error loading study goals:', err);
  } finally {
    isLoadingGoals.value = false;
  }
}

function handleStartStep(step: TrailStep) {
  if (step.route) {
    if (step.route.startsWith('http')) {
      window.open(step.route, '_blank');
    } else {
      router.push(step.route);
    }
  } else {
    router.push('/chat');
  }
}

function handleEnterBossFight(boss: BossFight) {
  if (!boss.is_unlocked && !boss.is_completed) {
    toast.error('Complete todas as etapas da Fase para desbloquear o Boss Fight!');
    return;
  }
  router.push('/exams');
}

onMounted(() => {
  loadTrail();
  loadGoals();
});
</script>

<template>
  <div class="p-4 md:p-8 max-w-5xl mx-auto space-y-8 animate-fade-in">
    <!-- Top Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="flex items-center gap-3.5">
        <div class="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary">
          <Compass class="w-6 h-6" />
        </div>
        <div>
          <h1 class="text-2xl md:text-3xl font-display font-extrabold text-text">
            Trilha de Aprendizado & Metas
          </h1>
          <p class="text-text-muted text-xs md:text-sm mt-0.5">
            Avance pelas fases, conquiste missões e derrote o Boss Fight no Exame Trimestral!
          </p>
        </div>
      </div>

      <!-- Main Tab Switcher -->
      <div class="flex bg-surface border border-border p-1 rounded-2xl shrink-0 shadow-xs">
        <button
          type="button"
          @click="activeMainTab = 'trail'"
          class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
          :class="activeMainTab === 'trail' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text'"
        >
          <Swords class="w-3.5 h-3.5" />
          Trilha de Fases
        </button>
        <button
          type="button"
          @click="activeMainTab = 'weekly'"
          class="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer"
          :class="activeMainTab === 'weekly' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text'"
        >
          <Target class="w-3.5 h-3.5" />
          Metas Semanais
        </button>
      </div>
    </div>

    <!-- =================================================================== -->
    <!-- ABA 1: TRILHA GAMIFICADA (FASES & BOSS FIGHT)                       -->
    <!-- =================================================================== -->
    <div v-if="activeMainTab === 'trail'" class="space-y-6">
      <!-- Loading Trail -->
      <div v-if="isLoadingTrail" class="py-20 text-center bg-surface border border-border rounded-3xl">
        <div class="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3"></div>
        <p class="text-xs font-bold text-text-muted">Carregando seu mapa de fases...</p>
      </div>

      <div v-else-if="trail && activePhase" class="space-y-6">
        <!-- Hero Card da Fase Atual -->
        <div class="relative overflow-hidden rounded-3xl border border-border bg-gradient-to-br from-surface via-surface to-bg-secondary p-6 md:p-8 shadow-sm">
          <!-- Background Decorator -->
          <div class="absolute -right-12 -bottom-12 w-48 h-48 bg-primary/5 rounded-full blur-2xl pointer-events-none"></div>

          <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div class="space-y-2 max-w-xl">
              <div class="flex flex-wrap items-center gap-2.5">
                <span class="px-2.5 py-1 rounded-lg text-[0.7rem] font-black uppercase tracking-wider bg-primary text-white shadow-xs">
                  Fase {{ activePhase.number }}
                </span>
                <span class="px-2.5 py-1 rounded-lg text-[0.7rem] font-extrabold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                  Nível {{ trail.level || 'B1' }}
                </span>
                <span
                  class="px-2.5 py-1 rounded-lg text-[0.7rem] font-bold uppercase tracking-wider"
                  :class="{
                    'bg-success/15 text-success border border-success/30': activePhase.status === 'completed',
                    'bg-amber-500/15 text-amber-500 border border-amber-500/30': activePhase.status === 'active',
                    'bg-muted/15 text-text-muted border border-border': activePhase.status === 'locked',
                  }"
                >
                  {{ activePhase.status === 'completed' ? 'Concluída ✅' : (activePhase.status === 'active' ? 'Em Andamento ⚔️' : 'Bloqueada 🔒') }}
                </span>
              </div>

              <h2 class="text-xl md:text-2xl font-display font-black text-text">
                {{ activePhase.title }}
              </h2>
              <p class="text-xs md:text-sm text-text-muted leading-relaxed">
                {{ activePhase.description }}
              </p>

              <!-- Recado da Professora Tatiana -->
              <div v-if="trail.teacher_notes" class="mt-3 p-3 rounded-2xl bg-primary/5 border border-primary/15 flex items-start gap-2.5">
                <span class="text-sm">👩‍🏫</span>
                <p class="text-xs text-text-muted leading-relaxed">
                  <strong class="text-primary font-bold">Teacher Tati:</strong> {{ trail.teacher_notes }}
                </p>
              </div>
            </div>

            <!-- Progresso Circular / Card -->
            <div class="flex flex-col items-center justify-center p-5 rounded-2xl bg-surface border border-border shadow-xs shrink-0 min-w-[200px]">
              <span class="text-[0.65rem] font-bold uppercase tracking-wider text-text-subtle">Progresso da Fase</span>
              <div class="text-3xl font-black text-text my-1">
                {{ phaseProgress.completed }} <span class="text-text-muted text-lg font-bold">/ {{ phaseProgress.total }}</span>
              </div>
              <div class="w-full bg-bg-secondary h-2.5 rounded-full overflow-hidden mt-1 border border-border">
                <div
                  class="h-full rounded-full transition-all duration-500"
                  :class="phaseProgress.percent === 100 ? 'bg-success' : 'bg-primary'"
                  :style="{ width: `${phaseProgress.percent}%` }"
                ></div>
              </div>
              <span class="text-[0.65rem] font-bold text-text-muted mt-2">
                {{ phaseProgress.percent === 100 ? 'Boss Desbloqueado! ⚔️' : `Faltam ${phaseProgress.remaining} missões para o Boss` }}
              </span>
            </div>
          </div>

          <!-- Selector de Fases (Fase 1, Fase 2...) -->
          <div v-if="trail.phases.length > 1" class="mt-6 pt-5 border-t border-border flex items-center gap-2 overflow-x-auto pb-1">
            <span class="text-[0.65rem] font-bold text-text-muted uppercase tracking-wider shrink-0 mr-2">Fases:</span>
            <button
              v-for="(phase, idx) in trail.phases"
              :key="phase.id"
              type="button"
              @click="selectedPhaseIndex = idx"
              class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all shrink-0 cursor-pointer border"
              :class="selectedPhaseIndex === idx ? 'bg-primary text-white border-primary shadow-xs' : 'bg-surface border-border text-text hover:bg-surface-hover'"
            >
              <component
                :is="phase.status === 'completed' ? CheckCircle2 : (phase.status === 'locked' ? Lock : Swords)"
                class="w-3.5 h-3.5"
                :class="selectedPhaseIndex === idx ? 'text-white' : (phase.status === 'completed' ? 'text-success' : 'text-text-muted')"
              />
              Fase {{ phase.number }}
            </button>
          </div>
        </div>

        <!-- Trilha de Missões (Steps) -->
        <div class="space-y-4">
          <div class="flex items-center justify-between">
            <h3 class="text-sm font-extrabold uppercase tracking-wider text-text-subtle flex items-center gap-2">
              <Sparkles class="w-4 h-4 text-primary" />
              Missões Obrigatórias desta Fase
            </h3>
            <span class="text-xs font-bold text-text-muted">
              {{ phaseProgress.completed }} de {{ phaseProgress.total }} concluídas
            </span>
          </div>

          <!-- Lista de Steps -->
          <div class="space-y-3">
            <div
              v-for="(step, sIdx) in activePhase.steps"
              :key="step.id || sIdx"
              class="p-4 rounded-2xl border transition-all duration-300 flex flex-col sm:flex-row sm:items-center justify-between gap-4"
              :class="step.is_completed ? 'bg-success/5 border-success/30 shadow-xs' : 'bg-surface border-border hover:border-primary/40 hover:shadow-sm'"
            >
              <!-- Info do Step -->
              <div class="flex items-start sm:items-center gap-3.5 min-w-0">
                <!-- Status Icon -->
                <div
                  class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0 border transition-transform duration-300"
                  :class="step.is_completed ? 'bg-success text-white border-success' : getCategoryColor(step.category)"
                >
                  <component
                    :is="step.is_completed ? CheckCircle2 : getCategoryIcon(step.category)"
                    class="w-5 h-5"
                  />
                </div>

                <div class="min-w-0">
                  <div class="flex items-center gap-2">
                    <h4 class="text-sm font-bold text-text truncate">{{ step.title }}</h4>
                    <span class="px-2 py-0.2 rounded-full text-[0.6rem] font-bold uppercase tracking-wider bg-bg-secondary border border-border text-text-muted">
                      {{ step.category }}
                    </span>
                  </div>
                  <p class="text-xs text-text-muted mt-0.5 line-clamp-2">
                    {{ step.description || 'Complete a atividade recomendada para pontuar nesta fase.' }}
                  </p>
                </div>
              </div>

              <!-- Action Button -->
              <div class="flex items-center gap-2 shrink-0 self-end sm:self-center">
                <button
                  type="button"
                  @click="handleStartStep(step)"
                  class="flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold transition-all active:scale-95 cursor-pointer shadow-xs"
                  :class="step.is_completed ? 'bg-surface border border-border text-text hover:bg-surface-hover' : 'bg-primary text-white hover:bg-primary-hover shadow-primary/20'"
                >
                  <span>{{ step.is_completed ? 'Revisar' : 'Praticar Agora' }}</span>
                  <ArrowRight class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>

          <!-- BOSS FIGHT FINAL (Exame Trimestral da Fase) -->
          <div
            class="mt-6 rounded-3xl p-6 md:p-8 border transition-all duration-500 shadow-md relative overflow-hidden"
            :class="{
              'border-amber-500/50 bg-gradient-to-br from-amber-500/10 via-surface to-amber-500/5': activePhase.boss_fight?.is_unlocked && !activePhase.boss_fight?.is_completed,
              'border-success/40 bg-gradient-to-br from-success/10 via-surface to-success/5': activePhase.boss_fight?.is_completed,
              'border-border bg-surface/50 opacity-90': !activePhase.boss_fight?.is_unlocked && !activePhase.boss_fight?.is_completed,
            }"
          >
            <!-- Background Glow -->
            <div
              v-if="activePhase.boss_fight?.is_unlocked"
              class="absolute -right-8 -top-8 w-40 h-40 bg-amber-500/15 rounded-full blur-2xl pointer-events-none"
            ></div>

            <div class="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
              <div class="flex items-start gap-4">
                <div
                  class="w-14 h-14 rounded-2xl flex items-center justify-center shrink-0 border shadow-sm transition-transform duration-300"
                  :class="{
                    'bg-amber-500 text-white border-amber-400 animate-pulse': activePhase.boss_fight?.is_unlocked && !activePhase.boss_fight?.is_completed,
                    'bg-success text-white border-success': activePhase.boss_fight?.is_completed,
                    'bg-bg-secondary text-text-muted border-border': !activePhase.boss_fight?.is_unlocked && !activePhase.boss_fight?.is_completed,
                  }"
                >
                  <component
                    :is="activePhase.boss_fight?.is_completed ? Trophy : (activePhase.boss_fight?.is_unlocked ? Swords : Lock)"
                    class="w-7 h-7"
                  />
                </div>

                <div class="space-y-1">
                  <div class="flex items-center gap-2">
                    <span
                      class="px-2 py-0.5 rounded-full text-[0.65rem] font-black uppercase tracking-wider"
                      :class="{
                        'bg-amber-500 text-white': activePhase.boss_fight?.is_unlocked && !activePhase.boss_fight?.is_completed,
                        'bg-success text-white': activePhase.boss_fight?.is_completed,
                        'bg-muted/20 text-text-muted': !activePhase.boss_fight?.is_unlocked && !activePhase.boss_fight?.is_completed,
                      }"
                    >
                      {{ activePhase.boss_fight?.is_completed ? 'Derrotado 🏆' : (activePhase.boss_fight?.is_unlocked ? 'Pronto para a Batalha ⚔️' : 'Bloqueado 🔒') }}
                    </span>
                    <span class="text-xs font-bold text-text-muted">
                      Nota de corte: {{ activePhase.boss_fight?.min_score || 7.0 }} / 10
                    </span>
                  </div>

                  <h3 class="text-lg md:text-xl font-display font-black text-text">
                    {{ activePhase.boss_fight?.title || '👑 Boss Fight: Exame Trimestral de Fase' }}
                  </h3>
                  <p class="text-xs text-text-muted max-w-lg leading-relaxed">
                    {{ activePhase.boss_fight?.description }}
                  </p>
                </div>
              </div>

              <!-- CTA do Boss Fight -->
              <div class="shrink-0 flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  @click="handleEnterBossFight(activePhase.boss_fight)"
                  :disabled="!activePhase.boss_fight?.is_unlocked && !activePhase.boss_fight?.is_completed"
                  class="w-full sm:w-auto px-6 py-3.5 rounded-2xl text-xs md:text-sm font-black uppercase tracking-wider transition-all duration-300 shadow-md cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  :class="{
                    'bg-amber-500 hover:bg-amber-600 text-white shadow-amber-500/25 active:scale-95': activePhase.boss_fight?.is_unlocked && !activePhase.boss_fight?.is_completed,
                    'bg-success hover:bg-success/90 text-white shadow-success/20': activePhase.boss_fight?.is_completed,
                    'bg-bg-secondary text-text-muted border border-border': !activePhase.boss_fight?.is_unlocked && !activePhase.boss_fight?.is_completed,
                  }"
                >
                  <component
                    :is="activePhase.boss_fight?.is_completed ? Trophy : (activePhase.boss_fight?.is_unlocked ? Swords : Lock)"
                    class="w-4 h-4"
                  />
                  <span>
                    {{
                      activePhase.boss_fight?.is_completed
                        ? 'Ver Resultado do Boss'
                        : activePhase.boss_fight?.is_unlocked
                        ? 'Enfrentar o Boss Agora!'
                        : 'Boss Bloqueado'
                    }}
                  </span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- =================================================================== -->
    <!-- ABA 2: METAS SEMANAIS & STREAK (VISÃO ORIGINAL PRESERVADA)          -->
    <!-- =================================================================== -->
    <div v-else class="space-y-8 animate-fade-in">
      <!-- Summary 3 Cards -->
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

      <!-- Abas de filtro & Section Header -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
        <div>
          <h2 class="text-lg font-bold text-text">Activity Goals</h2>
          <p class="text-xs text-text-muted mt-0.5">
            Completed activities, simulations and practice sessions automatically update your goals.
          </p>
        </div>

        <!-- Tab Buttons -->
        <div class="flex bg-surface border border-border p-1 rounded-xl shrink-0">
          <button
            type="button"
            @click="filterTab = 'todo'"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            :class="filterTab === 'todo' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text'"
          >
            To Do ({{ summary.active }})
          </button>
          <button
            type="button"
            @click="filterTab = 'completed'"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            :class="filterTab === 'completed' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text'"
          >
            Completed ({{ summary.completed }})
          </button>
          <button
            type="button"
            @click="filterTab = 'all'"
            class="px-3 py-1.5 rounded-lg text-xs font-bold transition-all"
            :class="filterTab === 'all' ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text'"
          >
            All ({{ goals.length }})
          </button>
        </div>
      </div>

      <!-- Loading State -->
      <div v-if="isLoadingGoals" class="py-16 text-center">
        <div class="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3"></div>
        <p class="text-xs font-bold text-text-muted">Loading your goals...</p>
      </div>

      <!-- Goals Grid -->
      <div v-else-if="filteredGoals.length > 0" class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          v-for="goal in filteredGoals"
          :key="goal.id || goal.type"
          class="p-5 rounded-2xl bg-surface border border-border shadow-xs hover:border-primary/40 transition-all flex flex-col justify-between"
        >
          <div class="flex items-start justify-between gap-3 mb-3">
            <div class="flex items-center gap-3">
              <div class="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center text-primary shrink-0">
                <component :is="getCategoryIcon(goal.type)" class="w-5 h-5" />
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

          <!-- Progress Bar -->
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

      <!-- Empty State -->
      <div v-else class="p-12 text-center bg-surface border border-border rounded-3xl">
        <CheckCircle2 class="w-12 h-12 text-success mx-auto mb-3 opacity-70" />
        <h3 class="font-bold text-text text-base">
          {{ filterTab === 'todo' ? 'All caught up!' : 'No goals found' }}
        </h3>
        <p class="text-xs text-text-muted mt-1">
          {{ filterTab === 'todo' ? 'You have completed all active study goals. Awesome work!' : 'No goals match the selected filter.' }}
        </p>
      </div>
    </div>
  </div>
</template>
