<script setup lang="ts">
withDefaults(
  defineProps<{
    count?: number;
  }>(),
  {
    count: 6,
  }
);
</script>

<template>
  <div class="grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
    <article
      v-for="i in count"
      :key="i"
      class="card-surface flex h-full flex-col overflow-hidden"
    >
      <!-- Header shimmer -->
      <div class="flex items-center justify-between px-4 py-2.5">
        <div class="h-3 w-16 animate-pulse rounded-full bg-line/60" />
        <div class="h-3 w-12 animate-pulse rounded-full bg-line/60" />
      </div>

      <!-- Image placeholder -->
      <div class="mx-4 mt-4 aspect-[4/3] animate-pulse rounded-xl bg-line/40" />

      <!-- Text lines -->
      <div class="space-y-2 px-4 pb-4 pt-3">
        <div class="h-5 w-3/4 animate-pulse rounded bg-line/50" />
        <div class="h-3 w-full animate-pulse rounded bg-line/30" />
        <div class="h-3 w-2/3 animate-pulse rounded bg-line/30" />
      </div>

      <!-- Footer -->
      <div class="mt-auto flex items-center justify-between border-t border-line px-4 py-3">
        <div class="h-4 w-16 animate-pulse rounded bg-line/50" />
        <div class="h-8 w-24 animate-pulse rounded-xl bg-line/40" />
      </div>
    </article>
  </div>
</template>
