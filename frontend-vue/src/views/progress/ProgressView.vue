<script setup lang="ts">
import { ref } from 'vue';
import { TrendingUp, Flame, Trophy, Award, BookCheck } from 'lucide-vue-next';
import { useAuth } from '@/composables/useAuth';
import { useStreakAndTrophies } from '@/composables/useStreakAndTrophies';

const { user, userLevel } = useAuth();
const { currentStreak, trophiesEarned, totalTrophies } = useStreakAndTrophies();
</script>

<template>
  <div class="max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
    <div>
      <h1 class="font-display text-2xl font-extrabold text-text">Your Learning Progress</h1>
      <p class="text-xs sm:text-sm text-text-muted mt-0.5">
        Detailed breakdown of vocabulary, consistency, and CEFR mastery.
      </p>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <div class="p-6 rounded-2xl bg-surface border border-border shadow-sm text-center">
        <Flame class="w-8 h-8 text-orange-500 mx-auto mb-2" />
        <span class="text-xs font-bold text-text-muted">Current Streak</span>
        <p class="text-3xl font-extrabold text-text mt-1">{{ currentStreak }} Days</p>
      </div>

      <div class="p-6 rounded-2xl bg-surface border border-border shadow-sm text-center">
        <Trophy class="w-8 h-8 text-yellow-500 mx-auto mb-2" />
        <span class="text-xs font-bold text-text-muted">Trophies Earned</span>
        <p class="text-3xl font-extrabold text-text mt-1">{{ trophiesEarned }} / {{ totalTrophies }}</p>
      </div>

      <div class="p-6 rounded-2xl bg-surface border border-border shadow-sm text-center">
        <Award class="w-8 h-8 text-primary mx-auto mb-2" />
        <span class="text-xs font-bold text-text-muted">Target Level</span>
        <p class="text-3xl font-extrabold text-primary mt-1">{{ userLevel }}</p>
      </div>
    </div>
  </div>
</template>
