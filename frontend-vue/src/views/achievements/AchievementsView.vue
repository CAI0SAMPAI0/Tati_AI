<script setup lang="ts">
import { ref } from 'vue';
import { Trophy, Star, Award, CheckCircle2 } from 'lucide-vue-next';

const trophies = ref([
  { title: 'First Conversation', desc: 'Sent your first message to Teacher Tatiana', unlocked: true },
  { title: '3-Day Streak', desc: 'Practiced 3 days in a row without breaking streak', unlocked: true },
  { title: '7-Day Champion', desc: 'Practiced 7 days in a row', unlocked: false },
  { title: 'Pronunciation Ace', desc: 'Achieved 90%+ score on 5 speech exercises', unlocked: false },
  { title: 'Trimestral Exam Master', desc: 'Passed your first CEFR trimestral exam', unlocked: true },
]);
</script>

<template>
  <div class="max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
    <div>
      <h1 class="font-display text-2xl font-extrabold text-text">Badges & Achievements</h1>
      <p class="text-xs sm:text-sm text-text-muted mt-0.5">
        Unlock trophies as you build confidence and speak English naturally.
      </p>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div
        v-for="(t, idx) in trophies"
        :key="idx"
        class="p-5 rounded-2xl bg-surface border border-border shadow-sm flex items-center gap-4 transition-all"
        :class="{ 'opacity-50 grayscale': !t.unlocked }"
      >
        <div
          class="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
          :class="t.unlocked ? 'bg-yellow-500/15 text-yellow-500' : 'bg-border text-text-muted'"
        >
          <Trophy class="w-6 h-6 fill-current" />
        </div>
        <div class="flex-1 min-w-0">
          <h4 class="font-bold text-sm text-text truncate">{{ t.title }}</h4>
          <p class="text-xs text-text-muted mt-0.5">{{ t.desc }}</p>
        </div>
        <CheckCircle2 v-if="t.unlocked" class="w-5 h-5 text-success flex-shrink-0" />
      </div>
    </div>
  </div>
</template>
