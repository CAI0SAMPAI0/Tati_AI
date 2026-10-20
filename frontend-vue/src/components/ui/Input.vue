<script setup lang="ts">
import { ref } from 'vue';
import { Eye, EyeOff } from 'lucide-vue-next';

const props = withDefaults(
  defineProps<{
    modelValue?: string | number;
    label?: string;
    type?: string;
    placeholder?: string;
    disabled?: boolean;
    error?: string;
    autoComplete?: string;
    id?: string;
  }>(),
  {
    modelValue: '',
    type: 'text',
    placeholder: '',
    disabled: false,
  }
);

defineEmits<{
  (e: 'update:modelValue', val: string): void;
}>();

const showPassword = ref(false);
</script>

<template>
  <div class="w-full text-left">
    <label v-if="label" class="block text-xs font-semibold text-text-muted mb-1.5">
      {{ label }}
    </label>
    <div class="relative flex items-center">
      <input
        :id="id"
        :type="type === 'password' ? (showPassword ? 'text' : 'password') : type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :autocomplete="autoComplete"
        @input="$emit('update:modelValue', ($event.target as HTMLInputElement).value)"
        class="w-full px-4 py-2.5 rounded-xl border border-border bg-input text-text text-sm placeholder:text-text-subtle focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all duration-150 disabled:opacity-50"
        :class="{ 'border-danger focus:border-danger focus:ring-danger/20': error, 'pr-10': type === 'password' }"
      />
      <button
        v-if="type === 'password'"
        type="button"
        @click="showPassword = !showPassword"
        class="absolute right-3 text-text-subtle hover:text-text transition-colors p-1"
      >
        <EyeOff v-if="showPassword" class="w-4 h-4" />
        <Eye v-else class="w-4 h-4" />
      </button>
    </div>
    <span v-if="error" class="block text-xs text-danger mt-1">
      {{ error }}
    </span>
  </div>
</template>
