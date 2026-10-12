<script setup lang="ts">
import { FILTER_OPTIONS, type FilterId } from '@/lib/catalog';

defineProps<{
  active: FilterId;
}>();

const emit = defineEmits<{
  (e: 'change', filter: FilterId): void;
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
      :class="['chip', active === option.id ? 'chip-active' : 'chip-inactive']"
      @click="emit('change', option.id)"
    >
      {{ option.label }}
    </button>
  </div>
</template>
