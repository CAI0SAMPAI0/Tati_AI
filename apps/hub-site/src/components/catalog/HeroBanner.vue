<script setup lang="ts">
import { Sparkles } from 'lucide-vue-next';
import BrandMark from '@/components/BrandMark.vue';
</script>

<template>
  <section class="card-surface relative overflow-hidden bg-primarySoft p-8 md:p-10">
    <div class="relative z-10 max-w-2xl">
      <p class="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-primary">
        Taty's English Class
      </p>
      <BrandMark variant="hero" subtitle="English Class" class="mb-4" />
      <h1 class="font-display text-2xl font-bold text-ink md:text-3xl">
        Materiais criados por Taty's Materials
      </h1>
      <p class="mt-3 max-w-xl text-sm leading-relaxed text-muted md:text-base">
        E-books, planners e exercícios para acelerar seu inglês com o método da Tati.
      </p>
    </div>
    <div
      class="absolute right-6 top-1/2 hidden -translate-y-1/2 md:flex"
      aria-hidden="true"
    >
      <div class="flex h-24 w-24 items-center justify-center rounded-hub bg-surface shadow-sm">
        <Sparkles class="text-primary" :size="40" :stroke-width="1.5" />
      </div>
    </div>
  </section>
</template>
