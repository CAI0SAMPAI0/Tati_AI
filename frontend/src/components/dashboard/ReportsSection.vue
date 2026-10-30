<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  Users,
  Activity,
  X,
  ChevronLeft,
  ChevronRight,
  Calendar,
  RotateCcw,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-vue-next';
import { apiGet } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { levelLabel, normalizeLevel } from '@/constants/levels';
import LevelDistributionChart from '@/components/charts/LevelDistributionChart.vue';
import ActivityBarChart, { MODALITY_CONFIG } from '@/components/charts/ActivityBarChart.vue';

interface ReportsPayload {
  weekly_activity?: number[];
  level_distribution?: Record<string, number>;
}

interface WeeklyActivityDay {
  day: string;
  grammar: number;
  reading: number;
  listening: number;
  pronunciation: number;
  speaking: number;
  vocabulary: number;
  flashcards: number;
  games: number;
  musics: number;
  news: number;
  exam: number;
  other: number;
}

interface WeeklyComparison {
  active_students_prev: number;
  total_activities_prev: number;
  diff_students: number;
  diff_activities: number;
  diff_students_pct?: number | null;
  diff_activities_pct?: number | null;
}

interface WeeklyActivityResponse {
  week_offset: number;
  start_date: string;
  end_date: string;
  date_label: string;
  is_current_week: boolean;
  active_students: number;
  total_activities: number;
  comparison?: WeeklyComparison | null;
  weekly_activity: WeeklyActivityDay[];
}

const reportData = ref<ReportsPayload | null>(null);
const weeklyActivityData = ref<WeeklyActivityResponse | null>(null);
const students = ref<any[]>([]);
const selectedLevel = ref<string | null>(null);
const isLoading = ref(true);
const isFetchingWeekly = ref(false);
const currentWeekOffset = ref(0);

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const COLORS = ['#7c3aed', '#a855f7', '#c084fc', '#34d399', '#f59e0b', '#3b82f6'];

const weeklyActivityChartData = computed(() => {
  if (weeklyActivityData.value?.weekly_activity?.length) {
    return weeklyActivityData.value.weekly_activity;
  }
  return DAYS.map((day) => ({
    day,
    grammar: 0,
    reading: 0,
    listening: 0,
    pronunciation: 0,
    speaking: 0,
    vocabulary: 0,
    flashcards: 0,
    games: 0,
    musics: 0,
    news: 0,
    exam: 0,
    other: 0,
  }));
});

const activeStudentsCount = computed(() => weeklyActivityData.value?.active_students ?? 0);
const totalActivitiesCount = computed(() => weeklyActivityData.value?.total_activities ?? 0);
const comparison = computed(() => weeklyActivityData.value?.comparison ?? null);

const activeModalitiesInView = computed(() => {
  if (!weeklyActivityData.value?.weekly_activity) return MODALITY_CONFIG;
  const counts: Record<string, number> = {};
  for (const day of weeklyActivityData.value.weekly_activity) {
    for (const mod of MODALITY_CONFIG) {
      counts[mod.key] = (counts[mod.key] || 0) + (Number((day as any)[mod.key]) || 0);
    }
  }
  const active = MODALITY_CONFIG.filter((m) => (counts[m.key] || 0) > 0);
  return active.length > 0 ? active : MODALITY_CONFIG;
});

const totalStudents = computed(() => {
  const dist = reportData.value?.level_distribution || {};
  return Object.values(dist).reduce((a, b) => a + b, 0);
});

const levelDist = computed(() => {
  const dist = reportData.value?.level_distribution || {};
  const tot = totalStudents.value;
  return Object.entries(dist)
    .map(([name, value], idx) => ({
      name,
      label: levelLabel ? levelLabel(name) : `Level ${name}`,
      value: value as number,
      percentage: tot > 0 ? Math.round(((value as number) / tot) * 100) : 0,
      color: COLORS[idx % COLORS.length],
    }))
    .filter((i) => i.value > 0);
});

const filteredStudents = computed(() => {
  if (!selectedLevel.value) return [];
  const target = normalizeLevel(selectedLevel.value);
  return students.value.filter((s) => normalizeLevel(s.level) === target);
});

async function fetchWeeklyActivity(offset: number = currentWeekOffset.value) {
  isFetchingWeekly.value = true;
  try {
    const res = await apiGet<WeeklyActivityResponse>(
      `${ENDPOINTS.DASHBOARD_WEEKLY_ACTIVITY}?week_offset=${offset}`
    );
    if (res) {
      weeklyActivityData.value = res;
      currentWeekOffset.value = res.week_offset;
    }
  } catch (err) {
    console.error('Error fetching weekly activity:', err);
  } finally {
    isFetchingWeekly.value = false;
  }
}

function navigateWeek(delta: number) {
  const target = Math.max(0, currentWeekOffset.value + delta);
  if (target !== currentWeekOffset.value) {
    fetchWeeklyActivity(target);
  }
}

async function loadReports() {
  isLoading.value = true;
  try {
    const [repRes, stdRes, weeklyRes] = await Promise.allSettled([
      apiGet<ReportsPayload>('/dashboard/reports/overview'),
      apiGet<any[]>('/dashboard/students'),
      apiGet<WeeklyActivityResponse>(`${ENDPOINTS.DASHBOARD_WEEKLY_ACTIVITY}?week_offset=0`),
    ]);

    if (repRes.status === 'fulfilled' && repRes.value) {
      reportData.value = repRes.value;
    }
    if (stdRes.status === 'fulfilled' && stdRes.value) {
      students.value = Array.isArray(stdRes.value) ? stdRes.value : [];
    }
    if (weeklyRes.status === 'fulfilled' && weeklyRes.value) {
      weeklyActivityData.value = weeklyRes.value;
      currentWeekOffset.value = weeklyRes.value.week_offset;
    }
  } catch (err) {
    console.error('Error loading reports overview:', err);
  } finally {
    isLoading.value = false;
  }
}

function handleSliceClick(name: string | null) {
  selectedLevel.value = name;
}

onMounted(() => {
  loadReports();
});
</script>

<template>
  <div class="space-y-8 animate-fade-in text-text">
    <!-- Top Grid: Weekly Activity & Level Distribution Pie/Donut -->
    <div class="grid grid-cols-1 lg:grid-cols-2 gap-8">
      <!-- 1. Weekly Activity Chart -->
      <div class="bg-surface border border-border p-6 rounded-3xl shadow-xs flex flex-col justify-between">
        <div>
          <!-- Header with Title & KPI Badges -->
          <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-4">
            <h3 class="font-bold text-lg flex items-center gap-2">
              <div class="w-1.5 h-6 bg-primary rounded-full" />
              <span>Weekly activity</span>
            </h3>

            <!-- KPI Badges (Active Students & Total Activities + Comparativo) -->
            <div class="flex items-center gap-2.5">
              <!-- Active Students Badge -->
              <div
                class="flex flex-col px-3 py-1.5 rounded-2xl bg-primary/10 border border-primary/20 min-w-[110px]"
                title="Active students who performed activities in this period"
              >
                <div class="flex items-center gap-1.5">
                  <Users class="w-3.5 h-3.5 text-primary" />
                  <span class="text-[11px] font-semibold text-text-muted">Active:</span>
                  <span class="text-sm font-black text-primary">{{ activeStudentsCount }}</span>
                </div>
                <!-- Comparative indicator -->
                <div
                  v-if="comparison"
                  class="flex items-center gap-0.5 text-[10px] font-bold mt-0.5"
                  :class="comparison.diff_students >= 0 ? 'text-emerald-500' : 'text-rose-500'"
                >
                  <ArrowUpRight v-if="comparison.diff_students > 0" class="w-3 h-3 shrink-0" />
                  <ArrowDownRight v-else-if="comparison.diff_students < 0" class="w-3 h-3 shrink-0" />
                  <span v-else class="text-text-muted">=</span>
                  <span>
                    {{ comparison.diff_students > 0 ? '+' : '' }}{{ comparison.diff_students }}
                    vs prev
                    <span v-if="typeof comparison.diff_students_pct === 'number'" class="opacity-90">
                      ({{ comparison.diff_students_pct > 0 ? '+' : '' }}{{ comparison.diff_students_pct }}%)
                    </span>
                  </span>
                </div>
              </div>

              <!-- Total Activities Badge -->
              <div
                class="flex flex-col px-3 py-1.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 min-w-[120px]"
                title="Total activities completed in this period across all modalities"
              >
                <div class="flex items-center gap-1.5">
                  <Activity class="w-3.5 h-3.5 text-emerald-500" />
                  <span class="text-[11px] font-semibold text-text-muted">Activities:</span>
                  <span class="text-sm font-black text-text">{{ totalActivitiesCount }}</span>
                </div>
                <!-- Comparative indicator -->
                <div
                  v-if="comparison"
                  class="flex items-center gap-0.5 text-[10px] font-bold mt-0.5"
                  :class="comparison.diff_activities >= 0 ? 'text-emerald-500' : 'text-rose-500'"
                >
                  <ArrowUpRight v-if="comparison.diff_activities > 0" class="w-3 h-3 shrink-0" />
                  <ArrowDownRight v-else-if="comparison.diff_activities < 0" class="w-3 h-3 shrink-0" />
                  <span v-else class="text-text-muted">=</span>
                  <span>
                    {{ comparison.diff_activities > 0 ? '+' : '' }}{{ comparison.diff_activities }}
                    vs prev
                    <span v-if="typeof comparison.diff_activities_pct === 'number'" class="opacity-90">
                      ({{ comparison.diff_activities_pct > 0 ? '+' : '' }}{{ comparison.diff_activities_pct }}%)
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </div>

          <!-- Week Navigation Bar (Comparativo de Semanas) -->
          <div class="flex items-center justify-between border-y border-border/60 py-2.5 mb-4">
            <div class="flex items-center gap-2">
              <button
                type="button"
                @click="navigateWeek(1)"
                :disabled="isFetchingWeekly"
                class="p-1.5 rounded-xl border border-border hover:bg-bg-secondary text-text-muted hover:text-text transition-all cursor-pointer flex items-center gap-1 text-xs font-semibold"
                title="Previous week"
              >
                <ChevronLeft class="w-4 h-4" />
                <span class="hidden sm:inline">Prev week</span>
              </button>

              <div class="flex items-center gap-2 px-3 py-1 rounded-xl bg-bg-secondary/70 border border-border">
                <Calendar class="w-3.5 h-3.5 text-primary" />
                <span class="text-xs font-bold text-text">{{ weeklyActivityData?.date_label || '...' }}</span>
                <span
                  v-if="currentWeekOffset === 0"
                  class="px-1.5 py-0.5 rounded text-[9px] font-black bg-primary/10 text-primary uppercase tracking-wider"
                >
                  This Week
                </span>
                <span
                  v-else
                  class="px-1.5 py-0.5 rounded text-[9px] font-black bg-bg-secondary text-text-muted uppercase tracking-wider"
                >
                  -{{ currentWeekOffset }}w
                </span>
              </div>

              <button
                type="button"
                :disabled="currentWeekOffset === 0 || isFetchingWeekly"
                @click="navigateWeek(-1)"
                class="p-1.5 rounded-xl border border-border text-text-muted hover:text-text transition-all flex items-center gap-1 text-xs font-semibold"
                :class="currentWeekOffset === 0 ? 'opacity-30 cursor-not-allowed' : 'hover:bg-bg-secondary cursor-pointer'"
                title="Next week"
              >
                <span class="hidden sm:inline">Next week</span>
                <ChevronRight class="w-4 h-4" />
              </button>
            </div>

            <!-- Quick Return to Current Week -->
            <button
              v-if="currentWeekOffset > 0"
              type="button"
              @click="navigateWeek(-currentWeekOffset)"
              class="text-xs font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
            >
              <RotateCcw class="w-3 h-3" />
              <span>Current week</span>
            </button>
          </div>

          <!-- Modality Legend (Mostra as modalidades ativas no período) -->
          <div class="flex flex-wrap items-center gap-x-3.5 gap-y-2 mb-4 text-xs">
            <div
              v-for="mod in activeModalitiesInView"
              :key="mod.key"
              class="flex items-center gap-1.5"
            >
              <span
                class="w-2.5 h-2.5 rounded-full shrink-0"
                :style="{ backgroundColor: mod.color }"
              />
              <span class="text-text-muted font-medium text-[11px]">{{ mod.label }}</span>
            </div>
          </div>

          <!-- Stacked Bar Chart with Tooltip Below -->
          <div class="min-h-[350px] w-full relative pt-2">
            <ActivityBarChart
              :data="weeklyActivityChartData"
              :bar-size="32"
              tooltip-position="bottom"
            />
          </div>
        </div>
      </div>

      <!-- 2. Level Distribution Pie/Donut Chart -->
      <div class="bg-surface border border-border p-6 rounded-3xl shadow-xs flex flex-col justify-between">
        <div>
          <h3 class="font-bold text-lg mb-6 flex items-center gap-2">
            <div class="w-1.5 h-6 bg-primary rounded-full" />
            <span>Level distribution</span>
          </h3>

          <div class="h-[280px] w-full relative flex items-center justify-center">
            <LevelDistributionChart
              :data="levelDist.length > 0 ? levelDist : [
                { name: 'A1', label: 'Beginner', value: 1, percentage: 25, color: COLORS[0] },
                { name: 'A2', label: 'Elementary', value: 1, percentage: 25, color: COLORS[1] },
                { name: 'B1', label: 'Intermediate', value: 1, percentage: 25, color: COLORS[2] },
                { name: 'B2', label: 'Upper Intermediate', value: 1, percentage: 25, color: COLORS[3] },
              ]"
              :selected-level="selectedLevel"
              @slice-click="handleSliceClick"
            />
          </div>
        </div>

        <!-- Level pills / buttons -->
        <div class="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
          <button
            v-for="(lv, idx) in levelDist"
            :key="lv.name"
            type="button"
            @click="selectedLevel = selectedLevel === lv.name ? null : lv.name"
            class="p-2.5 rounded-xl border transition-all text-left group cursor-pointer"
            :class="selectedLevel === lv.name
              ? 'bg-primary/10 border-primary/40 ring-1 ring-primary/20 shadow-xs'
              : 'bg-bg-secondary/50 border-border hover:border-primary/30'
            "
          >
            <div class="flex items-center gap-2 mb-1">
              <div
                class="w-2 h-2 rounded-full shrink-0"
                :style="{ backgroundColor: lv.color || COLORS[idx % COLORS.length] }"
              />
              <span class="text-[0.65rem] font-bold text-text-muted uppercase truncate">{{ lv.label }}</span>
            </div>
            <div class="flex items-baseline gap-1">
              <span class="text-sm font-bold text-text">{{ lv.value }}</span>
              <span class="text-[0.65rem] text-text-subtle">({{ lv.percentage }}%)</span>
            </div>
          </button>
        </div>
      </div>
    </div>

    <!-- 3. Alunos por Nível Selecionado Table (Modal or Expanding Panel) -->
    <div
      v-if="selectedLevel"
      class="bg-surface border border-border rounded-3xl overflow-hidden shadow-xs animate-fade-in"
    >
      <div class="p-5 border-b border-border flex items-center justify-between bg-bg-secondary/30">
        <h4 class="font-bold text-text flex items-center gap-2 text-sm">
          <span class="text-primary font-black">{{ selectedLevel }}</span>
          <span>— {{ filteredStudents.length }} Students</span>
        </h4>
        <button
          type="button"
          @click="selectedLevel = null"
          class="text-xs font-bold text-primary hover:underline cursor-pointer flex items-center gap-1"
        >
          <X class="w-3.5 h-3.5" />
          <span>Close</span>
        </button>
      </div>

      <div class="p-2 overflow-x-auto">
        <table class="w-full text-left border-collapse text-xs">
          <thead class="text-[0.6rem] font-bold text-text-muted uppercase tracking-widest border-b border-border">
            <tr>
              <th class="px-4 py-3">Student</th>
              <th class="px-4 py-3">Last active</th>
              <th class="px-4 py-3 text-right">Msgs</th>
            </tr>
          </thead>
          <tbody class="divide-y divide-border/50">
            <tr
              v-for="s in filteredStudents"
              :key="s.username"
              class="hover:bg-bg-secondary/20 transition-colors"
            >
              <td class="px-4 py-3">
                <div class="flex items-center gap-2.5">
                  <div
                    class="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[0.6rem] font-bold text-primary overflow-hidden shrink-0"
                  >
                    <img
                      v-if="s.avatar_url && s.avatar_url !== '/images/default-avatar.png'"
                      :src="s.avatar_url"
                      alt=""
                      class="w-full h-full object-cover rounded-full"
                    />
                    <span v-else>{{ (s.name || s.username || '?').charAt(0).toUpperCase() }}</span>
                  </div>
                  <span class="text-xs font-semibold text-text">{{ s.name || s.username }}</span>
                </div>
              </td>
              <td class="px-4 py-3 text-[0.7rem] text-text-muted">
                {{ s.last_active?.split('T')[0] || '—' }}
              </td>
              <td class="px-4 py-3 text-right text-xs font-bold text-text">
                {{ s.messages_count || s.total_messages || s.msgs || 0 }}
              </td>
            </tr>
            <tr v-if="filteredStudents.length === 0">
              <td colSpan="3" class="px-4 py-10 text-center text-xs text-text-muted italic">
                No students enrolled in this level yet.
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
