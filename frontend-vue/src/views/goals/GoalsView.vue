<script setup lang="ts">
import { ref } from 'vue';
import { Target, CheckCircle2 } from 'lucide-vue-next';

const goals = ref([
  { title: 'Practice 15 minutes of English today', completed: true },
  { title: 'Learn 10 new vocabulary words', completed: false },
  { title: 'Complete 1 conversation on Chat with Taty', completed: true },
  { title: 'Record 2 pronunciation voice notes', completed: false },
]);
</script>

<template>
  <div class="max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
    <div>
      <h1 class="font-display text-2xl font-extrabold text-text">Weekly Goals</h1>
      <p class="text-xs sm:text-sm text-text-muted mt-0.5">
        Set your weekly learning rhythm and achieve fluent habits.
      </p>
    </div>

    <div class="space-y-3">
      <div
        v-for="(goal, idx) in goals"
        :key="idx"
        class="p-4 rounded-2xl bg-surface border border-border shadow-sm flex items-center justify-between"
      >
        <div class="flex items-center gap-3">
          <div
            class="w-6 h-6 rounded-full border flex items-center justify-center"
            :class="goal.completed ? 'bg-success text-white border-success' : 'border-border text-transparent'"
          >
            <CheckCircle2 class="w-4 h-4 fill-current" />
          </div>
          <span
            class="text-sm font-semibold"
            :class="goal.completed ? 'line-through text-text-muted' : 'text-text'"
          >
            {{ goal.title }}
          </span>
        </div>
      </div>
    </div>
  </div>
</template>
