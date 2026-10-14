<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue';
import { Trophy, Medal, Sparkles, Award, ArrowUp } from 'lucide-vue-next';
import StudentLayout from '@/components/layout/StudentLayout.vue';
import { useAuthStore } from '@/stores/auth';

interface RankingEntry {
  username: string;
  name?: string;
  score: number;
  level?: string;
  avatar_url?: string;
}

const authStore = useAuthStore();
const rankingMode = ref<'global' | 'level'>('global');
const selectedLevel = ref('B2');
const selectedCycle = ref<'current' | 'previous'>('current');
const isLoading = ref(true);

const now = new Date();
const currentMonthName = now.toLocaleString('en-US', { month: 'long' });
const currentYear = now.getFullYear();

const globalRanking = ref<RankingEntry[]>([
  { username: 'pedro_developer', name: 'Pedro S.', score: 1420, level: 'B2', avatar_url: '/images/tati_logo.jpg' },
  { username: 'programador', name: authStore.user?.username || 'Caio', score: 1150, level: 'B2', avatar_url: '/images/tati_logo.jpg' },
  { username: 'ana_english', name: 'Ana Beatriz', score: 980, level: 'B1', avatar_url: '/images/tati_logo.jpg' },
  { username: 'carlos_silva', name: 'Carlos E.', score: 870, level: 'A2', avatar_url: '/images/tati_logo.jpg' },
  { username: 'juliana_m', name: 'Juliana Mendes', score: 790, level: 'B2', avatar_url: '/images/tati_logo.jpg' },
  { username: 'marcos_lima', name: 'Marcos L.', score: 650, level: 'A1', avatar_url: '/images/tati_logo.jpg' },
  { username: 'fernanda_costa', name: 'Fernanda C.', score: 580, level: 'C1', avatar_url: '/images/tati_logo.jpg' },
]);

const levelRankings = ref<Record<string, RankingEntry[]>>({
  A1: [
    { username: 'marcos_lima', name: 'Marcos L.', score: 650, level: 'A1', avatar_url: '/images/tati_logo.jpg' },
    { username: 'beatriz_a1', name: 'Beatriz R.', score: 420, level: 'A1', avatar_url: '/images/tati_logo.jpg' },
  ],
  A2: [
    { username: 'carlos_silva', name: 'Carlos E.', score: 870, level: 'A2', avatar_url: '/images/tati_logo.jpg' },
  ],
  B1: [
    { username: 'ana_english', name: 'Ana Beatriz', score: 980, level: 'B1', avatar_url: '/images/tati_logo.jpg' },
  ],
  B2: [
    { username: 'pedro_developer', name: 'Pedro S.', score: 1420, level: 'B2', avatar_url: '/images/tati_logo.jpg' },
    { username: 'programador', name: authStore.user?.username || 'Caio', score: 1150, level: 'B2', avatar_url: '/images/tati_logo.jpg' },
    { username: 'juliana_m', name: 'Juliana Mendes', score: 790, level: 'B2', avatar_url: '/images/tati_logo.jpg' },
  ],
  C1: [
    { username: 'fernanda_costa', name: 'Fernanda C.', score: 580, level: 'C1', avatar_url: '/images/tati_logo.jpg' },
  ],
  C2: [],
});

const currentList = computed(() => {
  if (rankingMode.value === 'global') return globalRanking.value;
  return levelRankings.value[selectedLevel.value] || [];
});

const topThree = computed(() => currentList.value.slice(0, 3));
const restOfRanking = computed(() => currentList.value.slice(3));

function isCurrentUser(entry: RankingEntry) {
  return entry.username === authStore.user?.username;
}

async function fetchRanking() {
  if (!authStore.token) return;
  isLoading.value = true;
  try {
    const prevDate = new Date(currentYear, now.getMonth() - 1, 1);
    const prevYear = prevDate.getFullYear();
    const prevMonth = prevDate.getMonth() + 1;

    const queryParams =
      selectedCycle.value === 'previous'
        ? `?year=${prevYear}&month=${prevMonth}`
        : '';

    const headers = { Authorization: `Bearer ${authStore.token}` };

    const [resGlobal, resLevel] = await Promise.all([
      fetch(`/users/progress/ranking/top15${queryParams}`, { headers }),
      fetch(`/users/progress/ranking/by-level${queryParams}`, { headers }),
    ]);

    if (resGlobal.ok) {
      const data = await resGlobal.json();
      if (Array.isArray(data)) {
        globalRanking.value = data;
      }
    }

    if (resLevel.ok) {
      const dataLevel = await resLevel.json();
      if (typeof dataLevel === 'object' && dataLevel !== null) {
        levelRankings.value = dataLevel;
      }
    }
  } catch (_) {
  } finally {
    isLoading.value = false;
  }
}

watch(selectedCycle, () => {
  fetchRanking();
});

onMounted(() => {
  fetchRanking();
});
</script>

<template>
  <StudentLayout>
    <div class="max-w-4xl mx-auto space-y-8 animate-fade-in">
      <!-- Header -->
      <header class="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 class="text-2xl md:text-3xl font-display font-bold text-ink mb-1">
            Competitions
          </h1>
          <p class="text-muted text-sm">
            See who the most engaged students are and climb the ranking!
          </p>
        </div>

        <!-- Global vs By Level Toggle -->
        <div class="flex bg-surface border border-line p-1 rounded-xl shadow-xs self-start md:self-auto">
          <button
            type="button"
            class="px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition cursor-pointer"
            :class="rankingMode === 'global' ? 'bg-primary text-white shadow-xs' : 'text-muted hover:text-ink'"
            @click="rankingMode = 'global'"
          >
            Global
          </button>
          <button
            type="button"
            class="px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition cursor-pointer"
            :class="rankingMode === 'level' ? 'bg-primary text-white shadow-xs' : 'text-muted hover:text-ink'"
            @click="rankingMode = 'level'"
          >
            By Level
          </button>
        </div>
      </header>

      <!-- Cycle / Month Selector -->
      <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 bg-surface border border-line rounded-2xl shadow-xs">
        <div class="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            class="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
            :class="
              selectedCycle === 'current'
                ? 'bg-primary text-white shadow-xs'
                : 'text-muted hover:text-ink hover:bg-bgSecondary'
            "
            @click="selectedCycle = 'current'; fetchRanking();"
          >
            <span class="w-2 h-2 rounded-full" :class="selectedCycle === 'current' ? 'bg-emerald-300 animate-pulse' : 'bg-muted'" />
            <span>Current Cycle ({{ currentMonthName }} {{ currentYear }})</span>
            <span class="text-[0.6rem] px-1.5 py-0.5 rounded font-black uppercase tracking-wider" :class="selectedCycle === 'current' ? 'bg-white/20 text-white' : 'bg-primarySoft text-primary'">
              Live
            </span>
          </button>

          <button
            type="button"
            class="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
            :class="
              selectedCycle === 'previous'
                ? 'bg-amber-500 text-white shadow-xs'
                : 'text-muted hover:text-ink hover:bg-bgSecondary'
            "
            @click="selectedCycle = 'previous'; fetchRanking();"
          >
            <span>🏆</span>
            <span>Previous Month</span>
            <span class="text-[0.6rem] px-1.5 py-0.5 rounded font-black uppercase tracking-wider" :class="selectedCycle === 'previous' ? 'bg-white/20 text-white' : 'bg-amber-500/10 text-amber-600'">
              Concluded
            </span>
          </button>
        </div>

        <span class="text-[0.7rem] text-muted px-2 font-medium">
          {{ selectedCycle === 'current' ? 'Live Ranking · Resets monthly' : 'Concluded Cycle · Final Results' }}
        </span>
      </div>

      <!-- Level Pills (If By Level) -->
      <div v-if="rankingMode === 'level'" class="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
        <button
          v-for="lvl in ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']"
          :key="lvl"
          type="button"
          class="px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer"
          :class="
            selectedLevel === lvl
              ? 'bg-primary text-white shadow-xs'
              : 'bg-surface border border-line text-muted hover:text-ink'
          "
          @click="selectedLevel = lvl"
        >
          Level {{ lvl }}
        </button>
      </div>

      <!-- Top 3 Podium Cards -->
      <div v-if="topThree.length > 0" class="grid grid-cols-1 md:grid-cols-3 gap-4 pt-4">
        <!-- 2nd Place -->
        <div
          v-if="topThree[1]"
          class="order-2 md:order-1 bg-surface border border-line rounded-3xl p-6 flex flex-col items-center text-center gap-3 relative shadow-xs"
          :class="{ 'ring-2 ring-primary border-primary/50': isCurrentUser(topThree[1]) }"
        >
          <span class="text-2xl font-black text-slate-400">2º</span>
          <div class="w-16 h-16 rounded-full border-2 border-slate-300 overflow-hidden">
            <img :src="topThree[1].avatar_url || '/images/tati_logo.jpg'" alt="2nd" class="w-full h-full object-cover" />
          </div>
          <div>
            <h4 class="font-bold text-sm text-ink">{{ topThree[1].name || topThree[1].username }}</h4>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-bgSecondary text-muted">
              {{ topThree[1].level || 'B1' }}
            </span>
          </div>
          <p class="text-base font-black text-primary">{{ topThree[1].score }} pts</p>
        </div>

        <!-- 1st Place (Center / Gold) -->
        <div
          v-if="topThree[0]"
          class="order-1 md:order-2 bg-surface border-2 border-amber-500/40 rounded-3xl p-6 flex flex-col items-center text-center gap-3 relative shadow-md md:-translate-y-2 bg-gradient-to-b from-amber-500/5 to-transparent"
          :class="{ 'ring-2 ring-primary': isCurrentUser(topThree[0]) }"
        >
          <div class="flex items-center gap-1 text-amber-500 text-3xl font-black">
            <span>👑 1º</span>
          </div>
          <div class="w-20 h-20 rounded-full border-2 border-amber-400 overflow-hidden shadow-sm">
            <img :src="topThree[0].avatar_url || '/images/tati_logo.jpg'" alt="1st" class="w-full h-full object-cover" />
          </div>
          <div>
            <h4 class="font-bold text-base text-ink">{{ topThree[0].name || topThree[0].username }}</h4>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600">
              {{ topThree[0].level || 'B2' }}
            </span>
          </div>
          <p class="text-xl font-black text-amber-500">{{ topThree[0].score }} pts</p>
        </div>

        <!-- 3rd Place -->
        <div
          v-if="topThree[2]"
          class="order-3 bg-surface border border-line rounded-3xl p-6 flex flex-col items-center text-center gap-3 relative shadow-xs"
          :class="{ 'ring-2 ring-primary border-primary/50': isCurrentUser(topThree[2]) }"
        >
          <span class="text-2xl font-black text-amber-700">3º</span>
          <div class="w-16 h-16 rounded-full border-2 border-amber-700/50 overflow-hidden">
            <img :src="topThree[2].avatar_url || '/images/tati_logo.jpg'" alt="3rd" class="w-full h-full object-cover" />
          </div>
          <div>
            <h4 class="font-bold text-sm text-ink">{{ topThree[2].name || topThree[2].username }}</h4>
            <span class="text-[10px] font-bold px-2 py-0.5 rounded-full bg-bgSecondary text-muted">
              {{ topThree[2].level || 'A2' }}
            </span>
          </div>
          <p class="text-base font-black text-primary">{{ topThree[2].score }} pts</p>
        </div>
      </div>

      <!-- Rest of Ranking List -->
      <div class="bg-surface border border-line rounded-3xl p-4 sm:p-6 shadow-xs space-y-2">
        <h3 class="text-xs font-bold text-muted uppercase tracking-wider px-2 mb-3">
          Leaderboard Standing
        </h3>

        <div
          v-if="restOfRanking.length === 0 && topThree.length === 0"
          class="p-6 text-center text-sm text-muted"
        >
          Nenhum aluno classificado neste nível ainda.
        </div>

        <div
          v-for="(student, idx) in restOfRanking"
          :key="student.username"
          class="flex items-center justify-between p-3.5 rounded-2xl border transition"
          :class="
            isCurrentUser(student)
              ? 'bg-primarySoft border-primary/40 font-bold text-primary shadow-xs'
              : 'border-line/70 bg-bgSecondary/30 hover:bg-bgSecondary text-ink'
          "
        >
          <div class="flex items-center gap-3.5">
            <span class="w-6 font-black text-sm text-muted text-center">
              {{ idx + 4 }}º
            </span>
            <div class="w-9 h-9 rounded-full overflow-hidden border border-line shrink-0">
              <img :src="student.avatar_url || '/images/tati_logo.jpg'" alt="Avatar" class="w-full h-full object-cover" />
            </div>
            <div>
              <p class="text-xs sm:text-sm font-bold text-ink">
                {{ student.name || student.username }}
                <span v-if="isCurrentUser(student)" class="text-primary font-black ml-1">(You)</span>
              </p>
              <span class="text-[10px] font-semibold text-muted">
                Level {{ student.level || 'A1' }}
              </span>
            </div>
          </div>

          <div class="text-right">
            <span class="text-sm font-black text-primary">{{ student.score }}</span>
            <span class="text-xs font-semibold text-muted ml-1">pts</span>
          </div>
        </div>
      </div>
    </div>
  </StudentLayout>
</template>
