<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { LineChart, PieChart as PieIcon, Users, ChevronRight, X } from 'lucide-vue-next';
import { apiGet } from '@/api/client';
import { levelLabel, normalizeLevel } from '@/constants/levels';
import LevelDistributionChart from '@/components/charts/LevelDistributionChart.vue';
import ActivityBarChart from '@/components/charts/ActivityBarChart.vue';

interface ReportsPayload {
  weekly_activity?: number[];
  level_distribution?: Record<string, number>;
}

const reportData = ref<ReportsPayload | null>(null);
const students = ref<any[]>([]);
const selectedLevel = ref<string | null>(null);
const isLoading = ref(true);

const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const COLORS = ['#7c3aed', '#a855f7', '#c084fc', '#34d399', '#f59e0b', '#3b82f6'];

const weeklyActivity = computed(() => {
  const arr = reportData.value?.weekly_activity || [0, 0, 0, 0, 0, 0, 0];
  return arr.map((val, idx) => ({
    name: DAYS[idx] || `D${idx + 1}`,
    messages: val,
  }));
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

async function loadReports() {
  isLoading.value = true;
  try {
    const [repRes, stdRes] = await Promise.allSettled([
      apiGet<ReportsPayload>('/dashboard/reports/overview'),
      apiGet<any[]>('/dashboard/students'),
    ]);

    if (repRes.status === 'fulfilled' && repRes.value) {
      reportData.value = repRes.value;
    }
    if (stdRes.status === 'fulfilled' && stdRes.value) {
      students.value = Array.isArray(stdRes.value) ? stdRes.value : [];
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
      <div class="bg-surface border border-border p-6 rounded-3xl shadow-xs">
        <h3 class="font-bold text-lg mb-6 flex items-center gap-2">
          <div class="w-1.5 h-6 bg-primary rounded-full" />
          <span>Weekly activity</span>
        </h3>
        <div class="h-[280px] w-full flex items-center justify-center">
          <ActivityBarChart :data="weeklyActivity" :bar-size="32" />
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
            :class="
              selectedLevel === lv.name
                ? 'bg-primary/10 border-primary/40 ring-1 ring-primary/20 shadow-xs'
                : 'bg-bg-secondary/50 border-border hover:border-primary/30'
            "
          >
            <div class="flex items-center gap-2 mb-1">
              <div class="w-2 h-2 rounded-full shrink-0" :style="{ backgroundColor: lv.color || COLORS[idx % COLORS.length] }" />
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
                  <div class="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[0.6rem] font-bold text-primary overflow-hidden shrink-0">
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
