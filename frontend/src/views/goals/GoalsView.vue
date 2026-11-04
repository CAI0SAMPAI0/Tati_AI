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
  FileText,
  ArrowRight,
  ExternalLink,
  ChevronRight,
  X,
  Play,
  RotateCcw,
  Check,
  Star,
  Award,
} from 'lucide-vue-next';
import { apiGet } from '@/api/client';
import { useToast } from '@/composables/useToast';

const router = useRouter();
const toast = useToast();

// Main Tab: Duolingo Learning Trail or Weekly Goals
const activeMainTab = ref<'trail' | 'weekly'>('trail');

// --- LEARNING TRAIL TYPES ---
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

// --- WEEKLY GOALS TYPES ---
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

// State
const trail = ref<LearningTrail | null>(null);
const selectedPhaseIndex = ref<number>(0);
const isLoadingTrail = ref(true);

const goals = ref<Goal[]>([]);
const streakData = ref<StreakData | null>(null);
const filterTab = ref<'todo' | 'completed' | 'all'>('todo');
const isLoadingGoals = ref(true);

// Node Modal for Duolingo popup
const selectedNode = ref<{ type: 'step' | 'boss'; step?: TrailStep; boss?: BossFight; index?: number } | null>(null);

// Category Icons & Metadata (in English)
const CATEGORY_META: Record<string, { label: string; icon: any; color: string; buttonBg: string; buttonBorder: string }> = {
  grammar: { label: 'Grammar', icon: FileText, color: 'text-blue-500', buttonBg: 'bg-blue-500', buttonBorder: 'border-b-[#1d4ed8]' },
  vocabulary: { label: 'Vocabulary', icon: BookOpen, color: 'text-emerald-500', buttonBg: 'bg-emerald-500', buttonBorder: 'border-b-[#047857]' },
  reading: { label: 'Reading', icon: BookOpen, color: 'text-amber-500', buttonBg: 'bg-amber-500', buttonBorder: 'border-b-[#b45309]' },
  listening: { label: 'Listening', icon: Headphones, color: 'text-purple-500', buttonBg: 'bg-purple-500', buttonBorder: 'border-b-[#6d28d9]' },
  simulations: { label: 'Simulation', icon: Users, color: 'text-rose-500', buttonBg: 'bg-rose-500', buttonBorder: 'border-b-[#be123c]' },
  music: { label: 'Music & Lyrics', icon: Music, color: 'text-pink-500', buttonBg: 'bg-pink-500', buttonBorder: 'border-b-[#be185d]' },
  games: { label: 'Learning Game', icon: Gamepad2, color: 'text-indigo-500', buttonBg: 'bg-indigo-500', buttonBorder: 'border-b-[#4338ca]' },
  flashcards: { label: 'Flashcards', icon: Sparkles, color: 'text-yellow-500', buttonBg: 'bg-yellow-500', buttonBorder: 'border-b-[#a16207]' },
  custom: { label: 'Custom Quest', icon: Target, color: 'text-cyan-500', buttonBg: 'bg-cyan-500', buttonBorder: 'border-b-[#0e7490]' },
};

function getCategoryMeta(cat: string) {
  const c = (cat || '').toLowerCase();
  return (
    CATEGORY_META[c] || {
      label: cat.toUpperCase(),
      icon: Target,
      color: 'text-primary',
      buttonBg: 'bg-primary',
      buttonBorder: 'border-b-[#3730a3]',
    }
  );
}

// Active Phase
const activePhase = computed<TrailPhase | null>(() => {
  if (!trail.value?.phases || trail.value.phases.length === 0) return null;
  return trail.value.phases[selectedPhaseIndex.value] || trail.value.phases[0];
});

// Phase Progress
const phaseProgress = computed(() => {
  if (!activePhase.value) return { completed: 0, total: 0, percent: 0, remaining: 0 };
  const steps = activePhase.value.steps || [];
  const completed = steps.filter((s) => s.is_completed).length;
  const total = steps.length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const remaining = Math.max(0, total - completed);
  return { completed, total, percent, remaining };
});

// Identify the active step (first uncompleted step in the active phase)
const activeStepId = computed(() => {
  if (!activePhase.value?.steps) return null;
  const firstPending = activePhase.value.steps.find((s) => !s.is_completed);
  return firstPending ? firstPending.id : null;
});

// Duolingo S-curve horizontal offsets for winding path
const S_CURVE_OFFSETS = [0, 48, 68, 32, -32, -68, -48];

function getNodeOffset(index: number): number {
  return S_CURVE_OFFSETS[index % S_CURVE_OFFSETS.length];
}

// Weekly Summary
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

function handleNodeClick(step: TrailStep, index: number) {
  selectedNode.value = { type: 'step', step, index };
}

function handleBossClick(boss: BossFight) {
  selectedNode.value = { type: 'boss', boss };
}

function handleStartActivity(step: TrailStep) {
  selectedNode.value = null;
  const meta = getCategoryMeta(step.category);
  let targetRoute = step.route;
  if (!targetRoute || targetRoute.startsWith('/grammar') || targetRoute.startsWith('/vocabulary')) {
    if (step.category === 'simulations') {
      targetRoute = '/voice';
    } else {
      const tabName = (step.category === 'listening' ? 'listenings' : (step.category === 'music' ? 'musics' : step.category));
      targetRoute = `/activities?tab=${tabName}&search=${encodeURIComponent(step.title)}`;
    }
  }

  if (targetRoute.startsWith('http')) {
    window.open(targetRoute, '_blank');
  } else {
    router.push(targetRoute);
  }
}

function handleStartBoss(boss: BossFight) {
  selectedNode.value = null;
  if (!boss.is_unlocked && !boss.is_completed) {
    toast.error('Complete all quests in this phase to unlock the Boss Exam!');
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
  <div class="p-4 md:p-8 max-w-4xl mx-auto space-y-8 animate-fade-in">
    <!-- Top Header & Mode Switcher -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="flex items-center gap-3.5">
        <div class="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0 text-primary">
          <Compass class="w-6 h-6" />
        </div>
        <div>
          <h1 class="text-2xl md:text-3xl font-display font-extrabold text-text">
            Learning Trail & Quests
          </h1>
          <p class="text-text-muted text-xs md:text-sm mt-0.5">
            Advance along the path, complete your teacher's quests, and defeat the Boss Exam!
          </p>
        </div>
      </div>

      <!-- Main Switcher -->
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
    </div>

    <!-- =================================================================== -->
    <!-- TAB 1: DUOLINGO-STYLE LEARNING TRAIL (SNAKE PATH)                   -->
    <!-- =================================================================== -->
    <div v-if="activeMainTab === 'trail'" class="space-y-8">
      <!-- Loading Trail -->
      <div v-if="isLoadingTrail" class="py-24 text-center bg-surface border border-border rounded-3xl">
        <div class="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3"></div>
        <p class="text-xs font-bold text-text-muted">Loading your learning trail...</p>
      </div>

      <div v-else-if="trail && activePhase" class="space-y-6">
        <!-- Phase Banner Header -->
        <div class="rounded-3xl border border-border bg-gradient-to-br from-surface via-surface to-bg-secondary p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div class="space-y-2 max-w-lg">
            <div class="flex items-center gap-2.5">
              <span class="px-2.5 py-1 rounded-lg text-[0.7rem] font-black uppercase tracking-wider bg-primary text-white shadow-xs">
                Phase {{ activePhase.number }}
              </span>
              <span class="px-2.5 py-1 rounded-lg text-[0.7rem] font-extrabold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                Level {{ trail.level || 'B1' }}
              </span>
              <span
                class="px-2.5 py-1 rounded-lg text-[0.7rem] font-bold uppercase tracking-wider"
                :class="{
                  'bg-success/15 text-success border border-success/30': activePhase.status === 'completed',
                  'bg-amber-500/15 text-amber-500 border border-amber-500/30': activePhase.status === 'active',
                  'bg-muted/15 text-text-muted border border-border': activePhase.status === 'locked',
                }"
              >
                {{ activePhase.status === 'completed' ? 'COMPLETED' : (activePhase.status === 'active' ? 'IN PROGRESS' : 'LOCKED') }}
              </span>
            </div>

            <h2 class="text-xl md:text-2xl font-display font-black text-text">
              {{ activePhase.title }}
            </h2>
            <p class="text-xs md:text-sm text-text-muted leading-relaxed">
              {{ activePhase.description }}
            </p>

            <!-- Teacher Note -->
            <div v-if="trail.teacher_notes" class="mt-2.5 p-3 rounded-2xl bg-primary/5 border border-primary/15 flex items-start gap-2.5">
              <span class="text-sm">👩‍🏫</span>
              <p class="text-xs text-text-muted leading-relaxed">
                <strong class="text-primary font-bold">Teacher Tati:</strong> {{ trail.teacher_notes }}
              </p>
            </div>
          </div>

          <!-- Progress Widget -->
          <div class="p-4 rounded-2xl bg-surface border border-border shadow-xs flex flex-col items-center justify-center shrink-0 min-w-[190px]">
            <span class="text-[0.65rem] font-bold uppercase tracking-wider text-text-subtle">Phase Progress</span>
            <div class="text-2xl font-black text-text my-1">
              {{ phaseProgress.completed }} <span class="text-text-muted text-base font-bold">/ {{ phaseProgress.total }}</span>
            </div>
            <div class="w-full bg-bg-secondary h-2 rounded-full overflow-hidden mt-1 border border-border">
              <div
                class="h-full rounded-full transition-all duration-500"
                :class="phaseProgress.percent === 100 ? 'bg-success' : 'bg-primary'"
                :style="{ width: `${phaseProgress.percent}%` }"
              ></div>
            </div>
            <span class="text-[0.65rem] font-bold text-text-muted mt-2">
              {{ phaseProgress.percent === 100 ? 'Boss Ready to Fight!' : `${phaseProgress.remaining} quests until Boss` }}
            </span>
          </div>
        </div>

        <!-- Phase Selector Pills (Phase 1, Phase 2...) -->
        <div v-if="trail.phases.length > 1" class="flex items-center gap-2 overflow-x-auto pb-1">
          <span class="text-[0.65rem] font-bold text-text-muted uppercase tracking-wider shrink-0 mr-1">Phases:</span>
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
            Phase {{ phase.number }}
          </button>
        </div>

        <!-- ============================================================= -->
        <!-- DUOLINGO WINDING PATH CONTAINER                               -->
        <!-- ============================================================= -->
        <div class="relative py-12 px-4 flex flex-col items-center justify-center bg-surface/40 border border-border/80 rounded-3xl overflow-hidden min-h-[500px]">
          <!-- Background Subtle Grid -->
          <div class="absolute inset-0 bg-[radial-gradient(#6366f1_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none"></div>

          <!-- Trail Nodes List -->
          <div class="flex flex-col items-center gap-14 relative z-10 w-full max-w-sm">
            <div
              v-for="(step, sIdx) in activePhase.steps"
              :key="step.id || sIdx"
              class="relative flex flex-col items-center"
              :style="{ transform: `translateX(${getNodeOffset(sIdx)}px)` }"
            >
              <!-- START Floating Speech Bubble Tooltip (Duolingo Style above current node) -->
              <div
                v-if="step.id === activeStepId && !step.is_completed"
                class="absolute -top-11 z-20 flex flex-col items-center animate-bounce pointer-events-none"
              >
                <div class="px-3 py-1 rounded-xl bg-primary text-white text-[0.7rem] font-black uppercase tracking-wider shadow-lg shadow-primary/30 flex items-center gap-1">
                  <Play class="w-3 h-3 fill-white" />
                  START
                </div>
                <div class="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-primary"></div>
              </div>

              <!-- Duolingo Circular 3D Button -->
              <button
                type="button"
                @click="handleNodeClick(step, sIdx)"
                class="w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-all duration-200 transform cursor-pointer active:translate-y-1 active:border-b-2 shadow-md"
                :class="[
                  step.is_completed
                    ? 'bg-emerald-500 border-b-[6px] border-b-emerald-700 text-white shadow-emerald-500/25 hover:scale-105'
                    : step.id === activeStepId
                    ? 'bg-primary border-b-[6px] border-b-[#3730a3] text-white ring-4 ring-primary/40 ring-offset-2 ring-offset-bg shadow-primary/30 hover:scale-105'
                    : 'bg-surface border border-border border-b-[6px] border-b-border/80 text-text-muted hover:border-primary/40',
                ]"
              >
                <!-- Inner Icon -->
                <component
                  :is="step.is_completed ? Check : getCategoryMeta(step.category).icon"
                  class="w-7 h-7 sm:w-8 sm:h-8"
                  :class="step.is_completed ? 'stroke-[3]' : ''"
                />
              </button>

              <!-- Node Label Below (English) -->
              <div class="mt-2 text-center max-w-[130px]">
                <span class="text-[0.7rem] font-bold text-text truncate block">
                  {{ step.title }}
                </span>
                <span class="text-[0.6rem] font-semibold uppercase text-text-muted">
                  {{ getCategoryMeta(step.category).label }}
                </span>
              </div>
            </div>

            <!-- Milestone / Treasure Chest Node in Between -->
            <div class="relative flex flex-col items-center my-2 opacity-80">
              <div class="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-500 shadow-xs">
                <Award class="w-6 h-6" />
              </div>
              <span class="text-[0.6rem] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400 mt-1">
                Milestone
              </span>
            </div>

            <!-- FINAL BOSS FIGHT NODE (Duolingo Style End of Unit Boss) -->
            <div class="relative flex flex-col items-center mt-4">
              <!-- Speech Bubble Tooltip for Boss -->
              <div
                v-if="activePhase.boss_fight?.is_unlocked && !activePhase.boss_fight?.is_completed"
                class="absolute -top-11 z-20 flex flex-col items-center animate-bounce pointer-events-none"
              >
                <div class="px-3 py-1 rounded-xl bg-amber-500 text-white text-[0.7rem] font-black uppercase tracking-wider shadow-lg shadow-amber-500/40 flex items-center gap-1">
                  <Swords class="w-3.5 h-3.5" />
                  TAKE EXAM
                </div>
                <div class="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-amber-500"></div>
              </div>

              <!-- Epic Boss Circular 3D Button -->
              <button
                type="button"
                @click="handleBossClick(activePhase.boss_fight)"
                class="w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center transition-all duration-300 transform cursor-pointer active:translate-y-1 active:border-b-2 shadow-xl"
                :class="[
                  activePhase.boss_fight?.is_completed
                    ? 'bg-success border-b-[8px] border-b-emerald-800 text-white shadow-success/30 hover:scale-105'
                    : activePhase.boss_fight?.is_unlocked
                    ? 'bg-gradient-to-b from-amber-400 to-amber-500 border-b-[8px] border-b-amber-700 text-white ring-4 ring-amber-400/40 ring-offset-2 ring-offset-bg shadow-amber-500/40 animate-pulse hover:scale-105'
                    : 'bg-surface border-2 border-border border-b-[8px] border-b-border text-text-muted opacity-80',
                ]"
              >
                <component
                  :is="activePhase.boss_fight?.is_completed ? Trophy : (activePhase.boss_fight?.is_unlocked ? Swords : Lock)"
                  class="w-9 h-9 sm:w-10 sm:h-10"
                />
              </button>

              <!-- Boss Label Below -->
              <div class="mt-2 text-center max-w-[160px]">
                <span class="text-xs font-black uppercase tracking-wider text-text block">
                  {{ activePhase.boss_fight?.title || 'Boss Fight: Phase Exam' }}
                </span>
                <span
                  class="text-[0.65rem] font-extrabold uppercase mt-0.5 inline-block px-2 py-0.2 rounded-full"
                  :class="activePhase.boss_fight?.is_completed ? 'bg-success/15 text-success' : (activePhase.boss_fight?.is_unlocked ? 'bg-amber-500/15 text-amber-500' : 'bg-surface text-text-muted border border-border')"
                >
                  {{ activePhase.boss_fight?.is_completed ? 'DEFEATED 🏆' : (activePhase.boss_fight?.is_unlocked ? 'UNLOCKED ⚔️' : 'LOCKED 🔒') }}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- =================================================================== -->
    <!-- TAB 2: WEEKLY GOALS & STREAK (ORIGINAL VIEW PRESERVED)               -->
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

      <!-- Filter Tabs -->
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
    </div>

    <!-- =================================================================== -->
    <!-- DUOLINGO NODE POPUP / DIALOG (IN ENGLISH)                           -->
    <!-- =================================================================== -->
    <div
      v-if="selectedNode"
      class="fixed inset-0 bg-black/60 z-[100] flex items-center justify-center p-4 backdrop-blur-xs animate-fade-in"
      @click.self="selectedNode = null"
    >
      <div class="bg-surface border border-border rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-5 text-center relative animate-zoom-in">
        <!-- Close Button -->
        <button
          type="button"
          @click="selectedNode = null"
          class="absolute right-4 top-4 p-1.5 rounded-xl text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
        >
          <X class="w-4 h-4" />
        </button>

        <!-- STEP POPUP -->
        <template v-if="selectedNode.type === 'step' && selectedNode.step">
          <!-- Icon Bubble -->
          <div
            class="w-16 h-16 rounded-full mx-auto flex items-center justify-center border-b-[4px] shadow-md"
            :class="[
              selectedNode.step.is_completed
                ? 'bg-emerald-500 border-b-emerald-700 text-white'
                : 'bg-primary border-b-[#3730a3] text-white',
            ]"
          >
            <component
              :is="selectedNode.step.is_completed ? Check : getCategoryMeta(selectedNode.step.category).icon"
              class="w-8 h-8"
            />
          </div>

          <div class="space-y-1">
            <span class="px-2.5 py-0.5 rounded-full text-[0.65rem] font-bold uppercase tracking-wider bg-bg-secondary border border-border text-text-muted">
              {{ getCategoryMeta(selectedNode.step.category).label }}
            </span>
            <h3 class="text-base font-black text-text mt-1">
              {{ selectedNode.step.title }}
            </h3>
            <p class="text-xs text-text-muted leading-relaxed">
              {{ selectedNode.step.description || 'Complete this exercise to progress toward the Boss Exam!' }}
            </p>
          </div>

          <!-- Action Button -->
          <button
            type="button"
            @click="handleStartActivity(selectedNode.step)"
            class="w-full py-3.5 px-6 rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg transition-all transform active:translate-y-1 active:border-b-2 cursor-pointer border-b-[5px]"
            :class="[
              selectedNode.step.is_completed
                ? 'bg-emerald-500 border-b-emerald-700 hover:bg-emerald-600 text-white shadow-emerald-500/25'
                : 'bg-primary border-b-[#3730a3] hover:bg-primary-hover text-white shadow-primary/25',
            ]"
          >
            {{ selectedNode.step.is_completed ? 'REVIEW ACTIVITY' : 'START QUEST ▶' }}
          </button>
        </template>

        <!-- BOSS FIGHT POPUP -->
        <template v-else-if="selectedNode.type === 'boss' && selectedNode.boss">
          <div
            class="w-20 h-20 rounded-full mx-auto flex items-center justify-center border-b-[6px] shadow-xl"
            :class="[
              selectedNode.boss.is_completed
                ? 'bg-success border-b-emerald-800 text-white shadow-success/30'
                : selectedNode.boss.is_unlocked
                ? 'bg-amber-500 border-b-amber-700 text-white shadow-amber-500/40 animate-pulse'
                : 'bg-surface border-2 border-border border-b-border text-text-muted',
            ]"
          >
            <component
              :is="selectedNode.boss.is_completed ? Trophy : (selectedNode.boss.is_unlocked ? Swords : Lock)"
              class="w-10 h-10"
            />
          </div>

          <div class="space-y-1.5">
            <span
              class="px-2.5 py-0.5 rounded-full text-[0.65rem] font-black uppercase tracking-wider"
              :class="selectedNode.boss.is_completed ? 'bg-success/15 text-success' : (selectedNode.boss.is_unlocked ? 'bg-amber-500/15 text-amber-500' : 'bg-surface text-text-muted border border-border')"
            >
              {{ selectedNode.boss.is_completed ? 'DEFEATED 🏆' : (selectedNode.boss.is_unlocked ? 'READY FOR BATTLE ⚔️' : 'LOCKED 🔒') }}
            </span>
            <h3 class="text-base font-black text-text">
              {{ selectedNode.boss.title || 'Boss Fight: Phase Exam' }}
            </h3>
            <p class="text-xs text-text-muted leading-relaxed">
              {{ selectedNode.boss.description || 'Custom evaluation exam based on the activities completed in this phase.' }}
            </p>
            <div class="text-[0.7rem] font-bold text-text-muted pt-1">
              Passing grade: <span class="text-amber-500">{{ selectedNode.boss.min_score || 7.0 }} / 10</span>
            </div>
          </div>

          <!-- Boss Action Button -->
          <button
            type="button"
            @click="handleStartBoss(selectedNode.boss)"
            :disabled="!selectedNode.boss.is_unlocked && !selectedNode.boss.is_completed"
            class="w-full py-3.5 px-6 rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg transition-all transform active:translate-y-1 active:border-b-2 cursor-pointer border-b-[5px] disabled:opacity-50 disabled:cursor-not-allowed"
            :class="[
              selectedNode.boss.is_completed
                ? 'bg-success border-b-emerald-800 text-white shadow-success/25'
                : selectedNode.boss.is_unlocked
                ? 'bg-amber-500 border-b-amber-700 hover:bg-amber-600 text-white shadow-amber-500/30'
                : 'bg-surface border-border text-text-muted',
            ]"
          >
            {{
              selectedNode.boss.is_completed
                ? 'VIEW EXAM RESULTS 🏆'
                : selectedNode.boss.is_unlocked
                ? 'ENTER BOSS BATTLE ⚔️'
                : 'COMPLETE ALL QUESTS TO UNLOCK'
            }}
          </button>
        </template>
      </div>
    </div>
  </div>
</template>
