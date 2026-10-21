<script setup lang="ts">
interface Option {
  value: string;
  label: string;
}

withDefaults(
  defineProps<{
    modelValue: string;
    label?: string;
    options: Option[];
    disabled?: boolean;
  }>(),
  {
    disabled: false,
  }
);

defineEmits<{
  (e: 'update:modelValue', val: string): void;
}>();
</script>

<template>
  <div class="w-full text-left">
    <label v-if="label" class="block text-xs font-semibold text-text-muted mb-1.5">
      {{ label }}
    </label>
    <div class="relative">
      <select
        :value="modelValue"
        :disabled="disabled"
        @change="$emit('update:modelValue', ($event.target as HTMLSelectElement).value)"
        class="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-text text-sm focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-150 disabled:opacity-50 appearance-none cursor-pointer"
      >
        <option v-for="opt in options" :key="opt.value" :value="opt.value">
          {{ opt.label }}
        </option>
      </select>
      <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-3 text-text-muted">
        <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 9l-7 7-7-7"></path>
        </svg>
      </div>
    </div>
  </div>
</template>

