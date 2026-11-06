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
  MessageSquare,
  Loader2,
  FileCheck,
  Dumbbell,
  Gift,
  Package,
} from 'lucide-vue-next';
import { apiGet, apiPost } from '@/api/client';
import { useToast } from '@/composables/useToast';

const router = useRouter();
const toast = useToast();

// Main Tab: Learning Trail or Weekly Goals
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
const isLoadingTrail = ref(true);

const goals = ref<Goal[]>([]);
const streakData = ref<StreakData | null>(null);
const filterTab = ref<'todo' | 'completed' | 'all'>('todo');
const isLoadingGoals = ref(true);
const isTogglingStep = ref(false);

// Node Modal for Popup
const selectedNode = ref<{
  type: 'step' | 'exam';
  phase: TrailPhase;
  step?: TrailStep;
  boss?: BossFight;
  index?: number;
} | null>(null);

// Checkpoint Chest Modal
const selectedChest = ref<{
  phase: TrailPhase;
  isUnlocked: boolean;
} | null>(null);

// Duolingo Snake Trail Node Item
interface TrailNodeItem {
  type: 'step' | 'chest' | 'exam';
  id: string;
  x: number;
  y: number;
  step?: TrailStep;
  boss?: BossFight;
  isCompleted?: boolean;
  isUnlocked?: boolean;
  isActive?: boolean;
  title: string;
  category?: string;
  stepIndex?: number;
}

// Duolingo S-curve Layout Constants (generous spacing & system theme)
const S_OFFSETS = [0, -55, -90, -50, 30, 90, 50, 0, -55, -90, -50, 30, 90, 0];
const NODE_SPACING_Y = 145; // Generous vertical spacing to prevent clipping
const START_Y = 80;         // Clean top breathing room
const CONTAINER_WIDTH = 440;
const CENTER_X = CONTAINER_WIDTH / 2; // 220

function getPhaseNodes(phase: TrailPhase): TrailNodeItem[] {
  const items: TrailNodeItem[] = [];
  const steps = phase.steps || [];
  const allStepsDone = steps.length > 0 && steps.every((s) => s.is_completed);

  steps.forEach((step, idx) => {
    const isActive =
      phase.status === 'active' &&
      step.id === activeStepId.value &&
      !step.is_completed;

    items.push({
      type: 'step',
      id: step.id || `step-${idx}`,
      x: 0,
      y: 0,
      step,
      isCompleted: !!step.is_completed,
      isUnlocked: phase.status !== 'locked',
      isActive,
      title: step.title,
      category: step.category,
      stepIndex: idx,
    });

    // Milestone Checkpoint Chest (inserted midway if >= 4 steps)
    if (steps.length >= 4 && idx === 2) {
      const priorStepsDone = steps.slice(0, 3).every((s) => s.is_completed);
      items.push({
        type: 'chest',
        id: `${phase.id}-chest`,
        x: 0,
        y: 0,
        isCompleted: priorStepsDone,
        isUnlocked: priorStepsDone && phase.status !== 'locked',
        title: `Phase ${phase.number} Checkpoint Chest`,
      });
    }
  });

  // Final node: Phase Exam
  const examUnlocked =
    phase.status !== 'locked' &&
    (!!phase.boss_fight?.is_unlocked || allStepsDone);

  items.push({
    type: 'exam',
    id: `${phase.id}-exam`,
    x: 0,
    y: 0,
    boss: phase.boss_fight,
    isCompleted: !!phase.boss_fight?.is_completed,
    isUnlocked: examUnlocked,
    title: `Phase ${phase.number} Exam`,
  });

  // Compute (x, y) coordinates
  items.forEach((item, idx) => {
    item.x = CENTER_X + S_OFFSETS[idx % S_OFFSETS.length];
    item.y = START_Y + idx * NODE_SPACING_Y;
  });

  return items;
}

function getContainerHeight(items: TrailNodeItem[]): number {
  if (!items || items.length === 0) return 460;
  return START_Y + (items.length - 1) * NODE_SPACING_Y + 115;
}

function getPhasePathD(items: TrailNodeItem[]): string {
  if (!items || items.length < 2) return '';
  let d = `M ${items[0].x} ${items[0].y}`;
  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1];
    const curr = items[i];
    const midY = (prev.y + curr.y) / 2;
    d += ` C ${prev.x} ${midY}, ${curr.x} ${midY}, ${curr.x} ${curr.y}`;
  }
  return d;
}

function getCompletedPathD(items: TrailNodeItem[]): string {
  if (!items || items.length < 2) return '';
  let d = '';
  for (let i = 1; i < items.length; i++) {
    const prev = items[i - 1];
    const curr = items[i];
    if (prev.isCompleted) {
      const midY = (prev.y + curr.y) / 2;
      if (!d) d = `M ${prev.x} ${prev.y}`;
      d += ` C ${prev.x} ${midY}, ${curr.x} ${midY}, ${curr.x} ${curr.y}`;
    }
  }
  return d;
}

function handleChestClick(phase: TrailPhase, isUnlocked: boolean) {
  if (phase.status === 'locked') {
    toast.error(`Phase ${phase.number} is locked! Complete earlier phases to unlock.`);
    return;
  }
  selectedChest.value = { phase, isUnlocked };
}

// Category Icons & Metadata (strictly English)
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

// Active Phase & Active Step for floating START indicator
const activePhase = computed<TrailPhase | null>(() => {
  if (!trail.value?.phases || trail.value.phases.length === 0) return null;
  return trail.value.phases.find((p) => p.status === 'active') || trail.value.phases[0];
});

const activeStepId = computed(() => {
  if (!activePhase.value?.steps) return null;
  const firstPending = activePhase.value.steps.find((s) => !s.is_completed);
  return firstPending ? firstPending.id : null;
});

function getPhaseProgress(phase: TrailPhase) {
  const steps = phase.steps || [];
  const completed = steps.filter((s) => s.is_completed).length;
  const total = steps.length;
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0;
  const remaining = Math.max(0, total - completed);
  return { completed, total, percent, remaining };
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

function handleNodeClick(phase: TrailPhase, step: TrailStep, index: number) {
  if (phase.status === 'locked') {
    toast.error(`Phase ${phase.number} is locked. Complete Phase ${phase.number - 1} and pass its Exam to unlock!`);
    return;
  }
  selectedNode.value = { type: 'step', phase, step, index };
}

function handleExamClick(phase: TrailPhase) {
  if (phase.status === 'locked') {
    toast.error(`Phase ${phase.number} is locked. Complete previous phases to unlock!`);
    return;
  }
  selectedNode.value = { type: 'exam', phase, boss: phase.boss_fight };
}

function handleStartActivity(step: TrailStep) {
  let targetRoute = (step.route || '').trim();

  if (step.category === 'simulations') {
    selectedNode.value = null;
    router.push('/voice');
    return;
  }

  // Direct HTTP link (test-english, lingo, etc.) -> open immediately in new tab
  if (targetRoute.startsWith('http://') || targetRoute.startsWith('https://')) {
    window.open(targetRoute, '_blank');
    return;
  }

  // If not http, generate direct test-english url from category and title
  const cat = ['grammar', 'vocabulary', 'reading', 'listening'].includes(step.category)
    ? step.category
    : 'grammar';
  const cleanSlug = step.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const directUrl = `https://test-english.com/${cat}/${cleanSlug}/`;
  window.open(directUrl, '_blank');
}

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
    // Caso a API falhe
    step.is_completed = previousStatus;
    step.progress = previousProgress;
    console.error('Error updating activity status:', err);
    toast.error('Could not update activity status. Please try again.');
  } finally {
    isTogglingStep.value = false;
  }
}

function handleStartExam(boss?: BossFight) {
  selectedNode.value = null;
  if (!boss?.is_unlocked && !boss?.is_completed) {
    toast.error('Complete all quests in this phase to unlock the Exam!');
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
            Learning Trail & Goals
          </h1>
          <p class="text-text-muted text-xs md:text-sm mt-0.5">
            Advance along the path, complete your teacher's quests, and take the Phase Exam!
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
    <!-- TAB 1: CONTINUOUS VERTICAL STACK OF ALL PHASES (SNAKE PATH)         -->
    <!-- =================================================================== -->
    <div v-if="activeMainTab === 'trail'" class="space-y-12">
      <!-- Loading Trail -->
      <div v-if="isLoadingTrail" class="py-24 text-center bg-surface border border-border rounded-3xl">
        <div class="w-10 h-10 border-4 border-primary/20 border-t-primary rounded-full animate-spin mx-auto mb-3"></div>
        <p class="text-xs font-bold text-text-muted">Loading your learning trail...</p>
      </div>

      <div v-else-if="trail && trail.phases && trail.phases.length > 0" class="space-y-14">
        <!-- Render Every Phase Vertically Stacked -->
        <div
          v-for="(phase, pIdx) in trail.phases"
          :key="phase.id || pIdx"
          class="space-y-6"
        >
          <!-- Phase Banner Header -->
          <div
            class="rounded-3xl border border-border bg-gradient-to-br from-surface via-surface to-bg-secondary p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6 transition-all"
            :class="phase.status === 'locked' ? 'opacity-70 grayscale-[20%]' : ''"
          >
            <div class="space-y-2 max-w-lg">
              <div class="flex items-center gap-2.5">
                <span
                  class="px-2.5 py-1 rounded-lg text-[0.7rem] font-black uppercase tracking-wider shadow-xs"
                  :class="phase.status === 'locked' ? 'bg-muted text-text-muted' : 'bg-primary text-white'"
                >
                  Phase {{ phase.number }}
                </span>
                <span class="px-2.5 py-1 rounded-lg text-[0.7rem] font-extrabold uppercase tracking-wider bg-primary/10 text-primary border border-primary/20">
                  Level {{ trail.level || 'B1' }}
                </span>
                <span
                  class="px-2.5 py-1 rounded-lg text-[0.7rem] font-bold uppercase tracking-wider flex items-center gap-1"
                  :class="{
                    'bg-success/15 text-success border border-success/30': phase.status === 'completed',
                    'bg-amber-500/15 text-amber-500 border border-amber-500/30': phase.status === 'active',
                    'bg-muted/15 text-text-muted border border-border': phase.status === 'locked',
                  }"
                >
                  <component
                    :is="phase.status === 'completed' ? CheckCircle2 : phase.status === 'active' ? Play : Lock"
                    class="w-3 h-3"
                  />
                  {{ phase.status === 'completed' ? 'COMPLETED' : phase.status === 'active' ? 'IN PROGRESS' : 'LOCKED' }}
                </span>
              </div>

              <h2 class="text-xl md:text-2xl font-display font-black text-text">
                {{ phase.title }}
              </h2>
              <p class="text-xs md:text-sm text-text-muted leading-relaxed">
                {{ phase.description }}
              </p>

              <!-- Teacher Note (Clean Lucide icon, NO emoji) -->
              <div v-if="trail.teacher_notes && phase.status === 'active'" class="mt-2.5 p-3 rounded-2xl bg-primary/5 border border-primary/15 flex items-start gap-2.5">
                <MessageSquare class="w-4 h-4 text-primary shrink-0 mt-0.5" />
                <p class="text-xs text-text-muted leading-relaxed">
                  <strong class="text-primary font-bold">Teacher Tati:</strong> {{ trail.teacher_notes }}
                </p>
              </div>
            </div>

            <!-- Progress Widget -->
            <div class="p-4 rounded-2xl bg-surface border border-border shadow-xs flex flex-col items-center justify-center shrink-0 min-w-[190px]">
              <span class="text-[0.65rem] font-bold uppercase tracking-wider text-text-subtle">Phase Progress</span>
              <div class="text-2xl font-black text-text my-1">
                {{ getPhaseProgress(phase).completed }}
                <span class="text-text-muted text-base font-bold">/ {{ getPhaseProgress(phase).total }}</span>
              </div>
              <div class="w-full bg-bg-secondary h-2 rounded-full overflow-hidden mt-1 border border-border">
                <div
                  class="h-full rounded-full transition-all duration-500"
                  :class="getPhaseProgress(phase).percent === 100 ? 'bg-success' : 'bg-primary'"
                  :style="{ width: `${getPhaseProgress(phase).percent}%` }"
                ></div>
              </div>
              <span class="text-[0.65rem] font-bold text-text-muted mt-2">
                {{
                  phase.status === 'locked'
                    ? 'Phase Locked'
                    : getPhaseProgress(phase).percent === 100
                    ? 'Exam Ready!'
                    : `${getPhaseProgress(phase).remaining} quests until Exam`
                }}
              </span>
            </div>
          </div>

          <!-- Duolingo Winding Snake Path for this Phase -->
          <div
            class="relative py-14 px-6 sm:px-12 flex flex-col items-center justify-center bg-surface/40 border border-border/80 rounded-3xl overflow-visible min-h-[520px]"
            :class="phase.status === 'locked' ? 'opacity-75' : ''"
          >
            <!-- Background Subtle Grid Pattern -->
            <div class="absolute inset-0 bg-[radial-gradient(#825e8a_1px,transparent_1px)] [background-size:24px_24px] opacity-10 pointer-events-none rounded-3xl"></div>

            <!-- Path Container (Locked to 440px width with generous breathing room) -->
            <div
              class="relative w-[440px] max-w-full mx-auto"
              :style="{ height: getContainerHeight(getPhaseNodes(phase)) + 'px' }"
            >
              <!-- SVG Curving Snake Track -->
              <svg
                class="absolute inset-0 w-[440px] h-full pointer-events-none"
                :viewBox="`0 0 440 ${getContainerHeight(getPhaseNodes(phase))}`"
                fill="none"
              >
                <!-- Base Track Curve -->
                <path
                  :d="getPhasePathD(getPhaseNodes(phase))"
                  fill="none"
                  class="stroke-border/70 dark:stroke-border/40"
                  stroke-width="18"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <!-- Inner Track Bevel Depth -->
                <path
                  :d="getPhasePathD(getPhaseNodes(phase))"
                  fill="none"
                  class="stroke-surface-hover/80"
                  stroke-width="9"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
                <!-- Completed Progress Track Curve (System Brand Primary) -->
                <path
                  v-if="getCompletedPathD(getPhaseNodes(phase))"
                  :d="getCompletedPathD(getPhaseNodes(phase))"
                  fill="none"
                  class="stroke-primary/85 transition-all duration-700"
                  stroke-width="11"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                />
              </svg>

              <!-- Mascot 1 (Right Side - Teacher Tati Avatar) -->
              <div
                v-if="getPhaseNodes(phase).length >= 3"
                class="absolute pointer-events-none flex flex-col items-center z-10 sm:flex"
                style="top: 140px; right: -25px;"
              >
                <div class="mb-2 px-3 py-1.5 bg-surface border border-primary/25 rounded-2xl shadow-md text-xs font-semibold text-text flex items-center gap-1.5 animate-bounce">
                  <span class="text-primary font-black">Teacher Tati:</span>
                  <span>Keep going!</span>
                </div>
                <div class="relative w-18 h-18 sm:w-20 sm:h-20 rounded-full p-1 bg-surface border-2 border-primary/40 shadow-lg shadow-primary/10">
                  <img
                    src="/avatar/avatar_tati_normal.webp"
                    alt="Teacher Tatiana"
                    class="w-full h-full rounded-full object-cover"
                  />
                  <div class="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs shadow-xs font-black">
                    ★
                  </div>
                </div>
              </div>

              <!-- Mascot 2 (Left Side - Teacher Tati Listening Avatar) -->
              <div
                v-if="getPhaseNodes(phase).length >= 5"
                class="absolute pointer-events-none flex flex-col items-center z-10 sm:flex"
                style="top: 560px; left: -25px;"
              >
                <div class="mb-2 px-3 py-1.5 bg-surface border border-primary/25 rounded-2xl shadow-md text-xs font-semibold text-text flex items-center gap-1.5 animate-bounce">
                  <span class="text-primary font-black">Teacher Tati:</span>
                  <span>You're doing great! 🎧</span>
                </div>
                <div class="relative w-18 h-18 sm:w-20 sm:h-20 rounded-full p-1 bg-surface border-2 border-primary/40 shadow-lg shadow-primary/10">
                  <img
                    src="/avatar/avatar_tati_ouvindo.webp"
                    alt="Teacher Tatiana"
                    class="w-full h-full rounded-full object-cover"
                  />
                  <div class="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-primary text-white flex items-center justify-center text-xs shadow-xs font-black">
                    🎧
                  </div>
                </div>
              </div>

              <!-- Interactive Nodes Placed Along the Winding Path -->
              <div
                v-for="item in getPhaseNodes(phase)"
                :key="item.id"
                class="absolute -translate-x-1/2 -translate-y-1/2 flex flex-col items-center z-20"
                :style="{ left: item.x + 'px', top: item.y + 'px' }"
              >
                <!-- 1. ACTIVITY STEP NODE -->
                <template v-if="item.type === 'step' && item.step">
                  <!-- Floating START Speech Bubble Tooltip for active step -->
                  <div
                    v-if="item.isActive"
                    class="absolute -top-11 z-30 flex flex-col items-center animate-bounce pointer-events-none"
                  >
                    <div class="px-3.5 py-1 rounded-xl bg-surface border-2 border-primary/40 text-primary text-[0.7rem] font-black uppercase tracking-wider shadow-lg shadow-primary/15 flex items-center gap-1.5">
                      <Play class="w-3 h-3 fill-primary text-primary" />
                      START
                    </div>
                    <div class="w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[6px] border-t-primary/40"></div>
                  </div>

                  <!-- Generous Pulsing Ring for Active Node (Never cut off) -->
                  <div
                    v-if="item.isActive"
                    class="absolute -inset-2.5 rounded-full ring-4 ring-primary/30 ring-offset-4 ring-offset-surface animate-pulse pointer-events-none"
                  ></div>

                  <!-- Trilha de Aprendizado 3D Button (System Primary Palette) -->
                  <button
                    type="button"
                    @click="handleNodeClick(phase, item.step, item.stepIndex || 0)"
                    :class="[
                      phase.status === 'locked'
                        ? 'w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-all duration-200 transform shadow-md bg-surface border border-border border-b-[6px] border-b-border/80 text-text-muted opacity-50 cursor-not-allowed'
                        : item.isCompleted
                        ? 'w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-all duration-200 transform cursor-pointer active:translate-y-1 active:border-b-2 shadow-md bg-emerald-500 border-b-[6px] border-b-emerald-700 text-white shadow-emerald-500/25 hover:scale-105'
                        : item.isActive
                        ? 'w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-all duration-200 transform cursor-pointer active:translate-y-1 active:border-b-2 shadow-lg bg-primary border-b-[6px] border-b-[#63456b] text-white shadow-primary/30 hover:scale-105'
                        : 'w-16 h-16 sm:w-20 sm:h-20 rounded-full flex items-center justify-center transition-all duration-200 transform cursor-pointer active:translate-y-1 active:border-b-2 shadow-md bg-surface border border-border border-b-[6px] border-b-border/80 text-text hover:border-primary/40 hover:scale-105',
                    ]"
                  >
                    <component
                      :is="phase.status === 'locked' ? Lock : item.isCompleted ? Check : item.isActive ? Star : getCategoryMeta(item.category || '').icon"
                      class="w-7 h-7 sm:w-8 sm:h-8"
                      :class="item.isCompleted ? 'stroke-[3.5]' : item.isActive ? 'fill-white' : ''"
                    />
                  </button>

                  <!-- Node Label Below (English) -->
                  <div class="mt-2 text-center max-w-[130px] pointer-events-none">
                    <span class="text-[0.7rem] font-bold text-text truncate block leading-tight">
                      {{ item.title }}
                    </span>
                    <span class="text-[0.6rem] font-bold uppercase text-text-muted tracking-wider">
                      {{ getCategoryMeta(item.category || '').label }}
                    </span>
                  </div>
                </template>

                <!-- 2. CHECKPOINT TREASURE CHEST NODE -->
                <template v-else-if="item.type === 'chest'">
                  <div class="relative flex flex-col items-center">
                    <button
                      type="button"
                      @click="handleChestClick(phase, !!item.isUnlocked)"
                      :class="[
                        item.isUnlocked
                          ? 'w-18 h-15 sm:w-20 sm:h-16 rounded-2xl flex flex-col items-center justify-center transition-all duration-200 transform cursor-pointer active:translate-y-1 shadow-lg bg-gradient-to-b from-amber-400 to-amber-600 border-2 border-amber-300 border-b-[6px] border-b-amber-800 text-white hover:scale-110'
                          : 'w-18 h-15 sm:w-20 sm:h-16 rounded-2xl flex flex-col items-center justify-center transition-all duration-200 transform shadow-md bg-surface border border-border border-b-[6px] border-b-border/80 text-text-muted opacity-60 cursor-not-allowed',
                      ]"
                    >
                      <Package class="w-7 h-7 drop-shadow-xs" />
                      <span class="text-[0.55rem] font-black uppercase tracking-wider" :class="item.isUnlocked ? 'text-amber-100' : 'text-text-muted'">
                        {{ item.isUnlocked ? 'BONUS' : 'LOCKED' }}
                      </span>
                    </button>

                    <!-- Chest Label Below -->
                    <div class="mt-1 text-center max-w-[120px] pointer-events-none">
                      <span class="text-[0.65rem] font-black uppercase tracking-wider text-amber-600 dark:text-amber-400 block">
                        Checkpoint
                      </span>
                    </div>
                  </div>
                </template>

                <!-- 3. PHASE EXAM 3D BUTTON (NO emojis, strictly English) -->
                <template v-else-if="item.type === 'exam'">
                  <div class="relative flex flex-col items-center mt-2">
                    <!-- Speech Bubble Tooltip for Exam -->
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

                    <!-- Exam 3D Button -->
                    <button
                      type="button"
                      @click="handleExamClick(phase)"
                      :class="[
                        phase.status === 'locked' || (!item.isUnlocked && !item.isCompleted)
                          ? 'w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center transition-all duration-300 transform shadow-md bg-surface border-2 border-border border-b-[8px] border-b-border text-text-muted opacity-60 cursor-not-allowed'
                          : item.isCompleted
                          ? 'w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center transition-all duration-300 transform cursor-pointer active:translate-y-1 active:border-b-2 shadow-xl bg-success border-b-[8px] border-b-emerald-800 text-white shadow-success/30 hover:scale-105'
                          : 'w-20 h-20 sm:w-24 sm:h-24 rounded-full flex items-center justify-center transition-all duration-300 transform cursor-pointer active:translate-y-1 active:border-b-2 shadow-xl bg-gradient-to-b from-primary to-primary-hover border-b-[8px] border-b-[#63456b] text-white ring-4 ring-primary/30 ring-offset-2 ring-offset-bg shadow-primary/30 animate-pulse hover:scale-105',
                      ]"
                    >
                      <component
                        :is="phase.status === 'locked' || (!item.isUnlocked && !item.isCompleted) ? Lock : item.isCompleted ? Trophy : Award"
                        class="w-9 h-9 sm:w-10 sm:h-10"
                      />
                    </button>

                    <!-- Exam Label Below -->
                    <div class="mt-2 text-center max-w-[150px] pointer-events-none">
                      <span class="text-xs font-black uppercase tracking-wider text-text block">
                        Phase {{ phase.number }} Exam
                      </span>
                      <span
                        class="text-[0.65rem] font-extrabold uppercase mt-0.5 inline-block px-2 py-0.2 rounded-full"
                        :class="
                          item.isCompleted
                            ? 'bg-success/15 text-success'
                            : item.isUnlocked
                            ? 'bg-primary/15 text-primary border border-primary/25'
                            : 'bg-surface text-text-muted border border-border'
                        "
                      >
                        {{ item.isCompleted ? 'PASSED' : item.isUnlocked ? 'UNLOCKED' : 'LOCKED' }}
                      </span>
                    </div>
                  </div>
                </template>
              </div>
            </div>
          </div>

          <!-- Visual Connector to Next Phase -->
          <div v-if="pIdx < trail.phases.length - 1" class="flex flex-col items-center justify-center my-6">
            <div class="w-1 h-8 bg-border rounded-full border-dashed"></div>
            <div class="text-[0.65rem] font-bold text-text-muted uppercase tracking-wider my-1">Next Phase</div>
            <div class="w-1 h-8 bg-border rounded-full border-dashed"></div>
          </div>
        </div>
      </div>
    </div>

    <!-- =================================================================== -->
    <!-- TAB 2: WEEKLY GOALS & STREAK (PRESERVED VIEW)                       -->
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
    <!-- NODE POPUP / DIALOG (IN ENGLISH, DIRECT ACTIVITY & COMPLETION SYNC) -->
    <!-- =================================================================== -->
    <Teleport to="body">
      <div
        v-if="selectedNode"
        class="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto"
        @click.self="selectedNode = null"
      >
        <div class="relative w-full max-w-sm bg-surface border border-border rounded-3xl p-6 shadow-2xl space-y-5 text-center mx-auto my-auto animate-in fade-in zoom-in-95 duration-150">
          <!-- Close Button -->
          <button
            type="button"
            @click="selectedNode = null"
            class="absolute right-4 top-4 p-1.5 rounded-xl text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <X class="w-4 h-4" />
          </button>

          <!-- 1. STEP POPUP -->
          <template v-if="selectedNode.type === 'step' && selectedNode.step">
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

            <div class="space-y-1.5">
              <span class="px-2.5 py-0.5 rounded-full text-[0.65rem] font-bold uppercase tracking-wider bg-bg-secondary border border-border text-text-muted">
                {{ getCategoryMeta(selectedNode.step.category).label }}
              </span>
              <h3 class="text-base font-black text-text mt-1 leading-snug">
                {{ selectedNode.step.title }}
              </h3>
              <p class="text-xs text-text-muted leading-relaxed">
                {{ selectedNode.step.description || 'Complete this exercise to progress toward the Phase Exam!' }}
              </p>
            </div>

            <!-- Action Buttons: Direct Open + Mark Done -->
            <div class="space-y-2 pt-1">
              <button
                type="button"
                @click="handleStartActivity(selectedNode.step)"
                class="w-full py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all transform active:translate-y-1 cursor-pointer flex items-center justify-center gap-1.5 bg-primary hover:bg-primary-hover text-white"
              >
                <ExternalLink class="w-4 h-4" />
                {{ selectedNode.step.is_completed ? 'Review Activity' : 'Open Activity' }}
              </button>

              <button
                type="button"
                @click="handleToggleStepCompletion(selectedNode.phase, selectedNode.step)"
                :disabled="isTogglingStep"
                class="w-full py-2.5 px-4 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center justify-center gap-1.5"
                :class="
                  selectedNode.step.is_completed
                    ? 'bg-surface hover:bg-surface-hover text-text-muted border-border'
                    : 'bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 font-bold'
                "
              >
                <Loader2 v-if="isTogglingStep" class="w-4 h-4 animate-spin" />
                <component :is="selectedNode.step.is_completed ? RotateCcw : CheckCircle2" v-else class="w-4 h-4" />
                {{ selectedNode.step.is_completed ? 'Mark as Incomplete' : 'Mark as Completed' }}
              </button>
            </div>
          </template>

          <!-- 2. EXAM POPUP -->
          <template v-else-if="selectedNode.type === 'exam' && selectedNode.boss">
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
                :is="selectedNode.boss.is_completed ? Trophy : selectedNode.boss.is_unlocked ? Award : Lock"
                class="w-10 h-10"
              />
            </div>

            <div class="space-y-1.5">
              <span
                class="px-2.5 py-0.5 rounded-full text-[0.65rem] font-black uppercase tracking-wider"
                :class="
                  selectedNode.boss.is_completed
                    ? 'bg-success/15 text-success'
                    : selectedNode.boss.is_unlocked
                    ? 'bg-amber-500/15 text-amber-500'
                    : 'bg-surface text-text-muted border border-border'
                "
              >
                {{ selectedNode.boss.is_completed ? 'PASSED' : selectedNode.boss.is_unlocked ? 'READY' : 'LOCKED' }}
              </span>
              <h3 class="text-base font-black text-text">
                Phase {{ selectedNode.phase.number }} Exam
              </h3>
              <p class="text-xs text-text-muted leading-relaxed">
                {{ selectedNode.boss.description || 'Comprehensive evaluation based on the activities completed in this phase.' }}
              </p>
              <div class="text-[0.7rem] font-bold text-text-muted pt-1">
                Passing grade: <span class="text-amber-500">{{ selectedNode.boss.min_score || 7.0 }} / 10</span>
              </div>
            </div>

            <!-- Exam Action Button -->
            <button
              type="button"
              @click="handleStartExam(selectedNode.boss)"
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
                  ? 'Review Exam Results'
                  : selectedNode.boss.is_unlocked
                  ? 'Start Phase Exam'
                  : 'Complete all quests to unlock'
              }}
            </button>
          </template>
        </div>
      </div>
    </Teleport>

    <!-- =================================================================== -->
    <!-- CHECKPOINT CHEST POPUP MODAL                                        -->
    <!-- =================================================================== -->
    <Teleport to="body">
      <div
        v-if="selectedChest"
        class="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm overflow-y-auto"
        @click.self="selectedChest = null"
      >
        <div class="relative w-full max-w-sm bg-surface border border-border rounded-3xl p-6 shadow-2xl space-y-4 text-center mx-auto my-auto animate-in fade-in zoom-in-95 duration-150">
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
              {{ selectedChest.isUnlocked ? 'BONUS UNLOCKED' : 'CHECKPOINT LOCKED' }}
            </span>
            <h3 class="text-base font-black text-text">
              Phase {{ selectedChest.phase.number }} Checkpoint Chest
            </h3>
            <p class="text-xs text-text-muted leading-relaxed">
              {{
                selectedChest.isUnlocked
                  ? 'Great dedication! You reached the phase midpoint. +50 Bonus XP awarded toward your weekly goals and streak!'
                  : 'Complete the previous quests in this phase to open this checkpoint treasure chest!'
              }}
            </p>
          </div>

          <button
            type="button"
            @click="selectedChest = null"
            class="w-full py-3 px-4 rounded-xl text-xs font-black uppercase tracking-wider shadow-sm transition-all cursor-pointer bg-primary hover:bg-primary-hover text-white"
          >
            {{ selectedChest.isUnlocked ? 'Claim & Continue' : 'Got It' }}
          </button>
        </div>
      </div>
    </Teleport>
  </div>
</template>
