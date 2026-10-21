<script setup lang="ts">
import { useToast } from '@/composables/useToast';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-vue-next';

const { toasts, remove } = useToast();
</script>

<template>
  <div class="fixed top-4 right-4 z-[99999999] flex flex-col gap-2 max-w-sm w-full pointer-events-none">
    <transition-group
      enter-active-class="transform ease-out duration-300 transition"
      enter-from-class="translate-y-[-10px] opacity-0 sm:translate-y-0 sm:translate-x-4"
      enter-to-class="translate-y-0 opacity-100 sm:translate-x-0"
      leave-active-class="transition ease-in duration-200"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0 scale-95"
    >
      <div
        v-for="toast in toasts"
        :key="toast.id"
        class="pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-xl shadow-lg border backdrop-blur-md transition-all"
        :class="{
          'bg-surface/95 border-success/30 text-success': toast.type === 'success',
          'bg-surface/95 border-danger/30 text-danger': toast.type === 'error',
          'bg-surface/95 border-border text-text': toast.type === 'info',
        }"
      >
        <div class="flex items-center gap-2.5">
          <CheckCircle2 v-if="toast.type === 'success'" class="w-5 h-5 flex-shrink-0 text-success" />
          <AlertCircle v-else-if="toast.type === 'error'" class="w-5 h-5 flex-shrink-0 text-danger" />
          <Info v-else class="w-5 h-5 flex-shrink-0 text-primary" />
          <span class="text-xs sm:text-sm font-semibold">{{ toast.text }}</span>
        </div>
        <button
          type="button"
          @click="remove(toast.id)"
          class="text-text-muted hover:text-text p-1 transition-colors"
        >
          <X class="w-4 h-4" />
        </button>
      </div>
    </transition-group>
  </div>
</template>

