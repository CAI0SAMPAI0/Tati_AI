<script setup lang="ts">
import { Sparkles } from 'lucide-vue-next';
</script>

<template>
  <section class="relative overflow-hidden rounded-2xl border border-border bg-gradient-to-r from-primary/10 via-surface to-surface p-8 md:p-10 shadow-sm">
    <div class="relative z-10 max-w-2xl">
      <p class="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
        Taty's English Class
      </p>
      <div class="flex items-center gap-2 mb-4">
        <span class="text-xl font-black text-text">Teacher <span class="text-primary">Taty</span></span>
        <span class="rounded-full bg-primary/15 px-2 py-0.5 text-[10px] font-extrabold text-primary uppercase">
          English Class
        </span>
      </div>
      <h1 class="text-2xl md:text-3xl font-black text-text tracking-tight">
        Resources created by Taty's Materials
      </h1>
      <p class="mt-3 max-w-xl text-sm md:text-base leading-relaxed text-text-muted">
        E-books, planners and exercises to boost your English using Tati’s method.
      </p>
    </div>
    <div class="absolute right-6 top-1/2 hidden -translate-y-1/2 md:flex" aria-hidden="true">
      <div class="flex h-24 w-24 items-center justify-center rounded-2xl bg-surface/80 border border-border shadow-md">
        <Sparkles class="text-primary" :size="40" :stroke-width="1.5" />
      </div>
    </div>
  </section>
</template>
