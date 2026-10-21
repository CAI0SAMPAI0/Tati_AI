<script setup lang="ts">
import { FILTER_OPTIONS, type FilterId } from '@/types/catalog';

defineProps<{
  active: FilterId;
}>();

const emit = defineEmits<{
  (e: 'update:active', value: FilterId): void;
}>();
</script>

<template>
  <div class="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar materiais">
    <button
      v-for="option in FILTER_OPTIONS"
      :key="option.id"
      type="button"
      role="tab"
      :aria-selected="active === option.id"
      @click="emit('update:active', option.id)"
      :class="[
        'px-4 py-1.5 rounded-full text-xs font-bold transition-all',
        active === option.id
          ? 'bg-primary text-white shadow-sm shadow-primary/30'
          : 'bg-surface border border-border text-text-muted hover:text-text hover:border-text-muted/40'
      ]"
    >
      {{ option.label }}
    </button>
  </div>
</template>
