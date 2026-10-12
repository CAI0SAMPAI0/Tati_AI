<script setup lang="ts">
withDefaults(
  defineProps<{
    variant?: 'compact' | 'hero';
    subtitle?: string;
    className?: string;
  }>(),
  {
    variant: 'compact',
    className: '',
  }
);
</script>

<template>
  <span :class="['inline-flex flex-col', className]">
    <span
      lang="en"
      translate="no"
      class="notranslate font-script leading-none text-primary"
      :class="variant === 'hero' ? 'text-3xl md:text-4xl' : 'text-2xl'"
    >
      Taty's
    </span>
    <span
      lang="en"
      translate="no"
      class="notranslate font-display font-extrabold uppercase tracking-[0.12em] text-ink"
      :class="variant === 'hero' ? 'text-sm md:text-base' : 'text-[10px]'"
    >
      {{ subtitle ?? (variant === 'hero' ? 'English Class' : 'Materials') }}
    </span>
  </span>
</template>
