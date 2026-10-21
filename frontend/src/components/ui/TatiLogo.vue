<script setup lang="ts">
withDefaults(
  defineProps<{
    size?: number;
    className?: string;
  }>(),
  {
    size: 40,
    className: '',
  }
);
</script>

<template>
  <div
    class="rounded-full overflow-hidden border border-border flex items-center justify-center bg-primary/10 flex-shrink-0"
    :style="{ width: `${size}px`, height: `${size}px` }"
    :class="className"
  >
    <img
      src="/images/tati_logo.jpg"
      alt="Teacher Tati Logo"
      class="w-full h-full object-cover object-top"
      @error="($event.target as HTMLImageElement).style.display = 'none'"
    />
  </div>
</template>

