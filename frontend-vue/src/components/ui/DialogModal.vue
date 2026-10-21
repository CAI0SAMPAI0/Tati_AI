<script setup lang="ts">
import { X, AlertTriangle } from 'lucide-vue-next';

withDefaults(
  defineProps<{
    isOpen: boolean;
    title: string;
    description?: string;
    confirmText?: string;
    cancelText?: string;
    isDestructive?: boolean;
    isLoading?: boolean;
  }>(),
  {
    isOpen: false,
    confirmText: 'Confirmar',
    cancelText: 'Cancelar',
    isDestructive: false,
    isLoading: false,
  }
);

defineEmits<{
  (e: 'confirm'): void;
  (e: 'cancel'): void;
  (e: 'close'): void;
}>();
</script>

<template>
  <teleport to="body">
    <transition
      enter-active-class="transition duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div
        v-if="isOpen"
        class="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
        @click.self="$emit('close')"
      >
        <div
          class="relative w-full max-w-md bg-surface border border-border rounded-2xl shadow-2xl p-6 overflow-hidden animate-fade-in"
        >
          <div class="flex items-start justify-between gap-4 mb-4">
            <div class="flex items-center gap-3">
              <div
                v-if="isDestructive"
                class="w-10 h-10 rounded-full bg-danger/10 text-danger flex items-center justify-center flex-shrink-0"
              >
                <AlertTriangle class="w-5 h-5" />
              </div>
              <h3 class="text-lg font-bold text-text">
                {{ title }}
              </h3>
            </div>
            <button
              type="button"
              @click="$emit('close')"
              class="text-text-muted hover:text-text p-1 transition-colors rounded-lg"
            >
              <X class="w-5 h-5" />
            </button>
          </div>

          <p v-if="description" class="text-sm text-text-muted mb-6 leading-relaxed">
            {{ description }}
          </p>

          <slot />

          <div class="flex items-center justify-end gap-3 mt-6">
            <button
              type="button"
              @click="$emit('cancel')"
              class="px-4 py-2 rounded-xl text-sm font-semibold text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
            >
              {{ cancelText }}
            </button>
            <button
              type="button"
              :disabled="isLoading"
              @click="$emit('confirm')"
              class="px-5 py-2.5 rounded-xl text-sm font-bold text-white transition-all shadow-md active:scale-95 disabled:opacity-50"
              :class="isDestructive ? 'bg-danger hover:bg-danger/90' : 'bg-primary hover:bg-primary-hover shadow-glow'"
            >
              <span v-if="isLoading" class="inline-block animate-spin mr-2">⏳</span>
              {{ confirmText }}
            </button>
          </div>
        </div>
      </div>
    </transition>
  </teleport>
</template>

