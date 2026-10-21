<script setup lang="ts">
import type { Component } from 'vue';

defineProps<{
  icon: Component;
  value: string | number;
  label: string;
  trend?: string;
  trendUp?: boolean;
  highlight?: boolean;
}>();
</script>

<template>
  <div
    class="bg-surface border border-border rounded-2xl transition-all hover:border-primary/40 p-4 sm:p-5 flex flex-col justify-between gap-4 h-full w-full min-w-0"
    :class="{ 'bg-primary/5 border-primary/30 ring-1 ring-primary/20': highlight }"
  >
    <!-- Top Row: Icon & Trend Badge -->
    <div class="flex items-center justify-between w-full gap-2 shrink-0">
      <div
        class="w-10 h-10 rounded-xl flex items-center justify-center shrink-0"
        :class="highlight ? 'bg-primary text-white' : 'bg-primary/10 text-primary'"
      >
        <component :is="icon" class="w-5 h-5" />
      </div>

      <div
        v-if="trend"
        class="text-[0.65rem] font-bold px-2.5 py-1 rounded-full border shrink-0"
        :class="
          trendUp
            ? 'bg-success/10 text-success border-success/20'
            : 'bg-text-muted/10 text-text-muted border-border'
        "
      >
        {{ trend }}
      </div>
    </div>

    <!-- Bottom Section: Value & Label -->
    <div class="min-w-0 flex-1 flex flex-col justify-end mt-2">
      <div class="text-2xl sm:text-3xl font-black text-text leading-none mb-1.5">
        {{ value }}
      </div>
      <div class="text-[0.65rem] sm:text-[0.7rem] font-bold text-text-subtle uppercase tracking-wider leading-tight">
        {{ label }}
      </div>
    </div>
  </div>
</template>

