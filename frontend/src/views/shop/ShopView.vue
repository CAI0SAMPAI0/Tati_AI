<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { Sparkles, Snowflake, Zap, Lock, Coins, ShieldCheck, Loader2 } from 'lucide-vue-next';
import { apiGet, apiPost } from '@/api/client';
import { useToast } from '@/composables/useToast';
import SidebarActivities from '@/components/layout/SidebarActivities.vue';
import MainHeader from '@/components/layout/MainHeader.vue';

interface XpData {
  xp?: number;
  level?: string;
}

interface StreakData {
  current_streak: number;
  longest_streak: number;
  streak_freeze_count?: number;
  freeze_count?: number;
}

const toast = useToast();
const sidebarOpen = ref(false);
const isPurchasing = ref(false);
const xpLoading = ref(true);

const xpData = ref<XpData | null>(null);
const streakData = ref<StreakData | null>(null);

async function loadData() {
  xpLoading.value = true;
  try {
    const [xpRes, streakRes] = await Promise.all([
      apiGet<XpData>('/dashboard/stats/my').catch(() => ({ xp: 120, level: 'B2' })),
      apiGet<StreakData>('/users/streak').catch(() => ({ current_streak: 5, longest_streak: 10, streak_freeze_count: 1 })),
    ]);
    xpData.value = xpRes;
    streakData.value = streakRes;
  } catch (err) {
    console.error('Error loading shop data:', err);
  } finally {
    xpLoading.value = false;
  }
}

onMounted(() => {
  loadData();
});

async function handlePurchaseFreeze() {
  isPurchasing.value = true;
  try {
    await apiPost('/users/streak/purchase-freeze', {});
    toast.success('Streak Freeze acquired! 🧊 Your streak is now protected.');
    await loadData();
  } catch (err: any) {
    console.error('Purchase error:', err);
    toast.error(err?.data?.detail || err?.message || 'Error processing purchase. Please try again.');
  } finally {
    isPurchasing.value = false;
  }
}

const userXp = () => xpData.value?.xp ?? 0;
const freezeCount = () => streakData.value?.streak_freeze_count ?? streakData.value?.freeze_count ?? 0;
const canBuyFreeze = () => userXp() >= 150 && freezeCount() < 3;
</script>

<template>
  <div class="min-h-screen bg-bg flex flex-col md:flex-row overflow-x-hidden text-text">
    <SidebarActivities :is-open="sidebarOpen" @close="sidebarOpen = false" />

    <div :class="['flex-1 flex flex-col min-w-0 transition-all duration-300 relative min-h-screen', sidebarOpen ? 'md:ml-[280px]' : 'md:ml-0']">
      <MainHeader :on-toggle-menu="() => sidebarOpen = !sidebarOpen" />

      <main class="flex-1 p-4 md:p-8 max-w-7xl w-full mx-auto space-y-8">
        <!-- Top Title and Balance Card -->
        <div class="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h2 class="text-3xl font-black text-text tracking-tight">Rewards Shop</h2>
            <p class="text-xs text-text-muted mt-1">
              Spend your accumulated points to buy items that help you learn and keep your streaks.
            </p>
          </div>

          <div class="bg-surface border border-border rounded-2xl p-4 flex items-center gap-3 shrink-0 shadow-sm">
            <div class="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-500">
              <Zap :size="20" class="fill-amber-500 animate-pulse" />
            </div>
            <div>
              <p class="text-[10px] font-bold text-text-muted uppercase tracking-wider">Your Balance</p>
              <p v-if="xpLoading" class="h-5 w-16 bg-bgSecondary rounded animate-pulse mt-1" />
              <p v-else class="text-lg font-black text-text tabular-nums">
                {{ userXp().toLocaleString() }} <span class="text-text-muted text-xs font-bold">pts</span>
              </p>
            </div>
          </div>
        </div>

        <!-- Shop Items Grid -->
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <!-- Item 1: Streak Freeze -->
          <div class="rounded-2xl border border-border bg-surface p-6 shadow-xs flex flex-col justify-between space-y-4">
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <div class="w-12 h-12 rounded-2xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center">
                  <Snowflake :size="24" />
                </div>
                <span class="rounded-full bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 px-3 py-1 text-[11px] font-bold">
                  {{ freezeCount() }}/3 owned
                </span>
              </div>

              <div>
                <h3 class="font-bold text-text text-base">Streak Freeze</h3>
                <p class="text-xs text-text-muted mt-1 leading-relaxed">
                  Protect your streak if you miss a day of practice. Activates automatically.
                </p>
              </div>
            </div>

            <div class="pt-4 border-t border-border/60 flex items-center justify-between">
              <div class="flex items-center gap-1 font-black text-amber-500 text-sm">
                <Zap :size="16" class="fill-amber-500" />
                <span>150 pts</span>
              </div>

              <button
                type="button"
                :disabled="!canBuyFreeze() || isPurchasing"
                @click="handlePurchaseFreeze"
                class="rounded-xl bg-primary px-4 py-2 text-xs font-bold text-white shadow-xs hover:opacity-90 disabled:opacity-40 transition-opacity flex items-center gap-1.5 cursor-pointer"
              >
                <Loader2 v-if="isPurchasing" class="animate-spin" :size="14" />
                <span>{{ freezeCount() >= 3 ? 'Max Reached' : 'Buy Item' }}</span>
              </button>
            </div>
          </div>

          <!-- Item 2: Double Points Boost -->
          <div class="rounded-2xl border border-border bg-surface p-6 shadow-xs flex flex-col justify-between space-y-4 opacity-90">
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <div class="w-12 h-12 rounded-2xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                  <Sparkles :size="24" />
                </div>
                <span class="rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 px-3 py-1 text-[11px] font-bold">
                  Active in Competitions
                </span>
              </div>

              <div>
                <h3 class="font-bold text-text text-base">Double XP Boost (24h)</h3>
                <p class="text-xs text-text-muted mt-1 leading-relaxed">
                  Earn 2x XP for all conversation practices and completed activities for the next 24 hours.
                </p>
              </div>
            </div>

            <div class="pt-4 border-t border-border/60 flex items-center justify-between">
              <div class="flex items-center gap-1 font-black text-amber-500 text-sm">
                <Zap :size="16" class="fill-amber-500" />
                <span>300 pts</span>
              </div>

              <button
                type="button"
                disabled
                class="rounded-xl bg-bgSecondary border border-border px-4 py-2 text-xs font-bold text-text-muted cursor-not-allowed"
              >
                Unlocked at Level B1
              </button>
            </div>
          </div>

          <!-- Item 3: Custom Avatar Badge -->
          <div class="rounded-2xl border border-border bg-surface p-6 shadow-xs flex flex-col justify-between space-y-4 opacity-90">
            <div class="space-y-3">
              <div class="flex items-center justify-between">
                <div class="w-12 h-12 rounded-2xl bg-indigo-500/10 text-indigo-500 flex items-center justify-center">
                  <ShieldCheck :size="24" />
                </div>
                <span class="rounded-full bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 px-3 py-1 text-[11px] font-bold">
                  Profile Flair
                </span>
              </div>

              <div>
                <h3 class="font-bold text-text text-base">Master Scholar Badge</h3>
                <p class="text-xs text-text-muted mt-1 leading-relaxed">
                  Special golden badge displayed next to your username on the global competitions leaderboard.
                </p>
              </div>
            </div>

            <div class="pt-4 border-t border-border/60 flex items-center justify-between">
              <div class="flex items-center gap-1 font-black text-amber-500 text-sm">
                <Zap :size="16" class="fill-amber-500" />
                <span>500 pts</span>
              </div>

              <button
                type="button"
                disabled
                class="rounded-xl bg-bgSecondary border border-border px-4 py-2 text-xs font-bold text-text-muted cursor-not-allowed"
              >
                Unlocked at Level B2
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  </div>
</template>
