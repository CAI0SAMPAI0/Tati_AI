<script setup lang="ts">
import { ref } from 'vue';
import { ClipboardCheck, X, MessageSquare, Mic, Sparkles } from 'lucide-vue-next';

const props = defineProps<{
  isOpen: boolean;
  loading?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'start', totalQuestions: number, mode: 'chat' | 'voice'): void;
}>();

const selectedCount = ref<number>(8);
const mode = ref<'chat' | 'voice'>('chat');

const options = [
  { count: 4, label: '4 Questions', time: '~3 mins', desc: 'Express • 1 question per level (A1, A2, B1, B2)' },
  { count: 8, label: '8 Questions', time: '~6 mins', desc: 'Quick • 2 questions per level (A1, A2, B1, B2)', recommended: true },
  { count: 12, label: '12 Questions', time: '~10 mins', desc: 'Standard • 3 questions per level (A1, A2, B1, B2)' },
  { count: 16, label: '16 Questions', time: '~15 mins', desc: 'Full • 4 questions per level (A1, A2, B1, B2)' },
  { count: 20, label: '20 Questions', time: '~20 mins', desc: 'In-depth • 5 questions per level (A1, A2, B1, B2)' },
];

function handleConfirm() {
  emit('start', selectedCount.value, mode.value);
}
</script>

<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
    @click="emit('close')"
  >
    <div
      class="relative w-full max-w-xl bg-surface border border-border/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] mx-auto animate-in zoom-in-95 duration-200"
      @click.stop
    >
      <!-- Header -->
      <div class="px-6 py-5 border-b border-border/60 bg-gradient-to-r from-primary/10 via-primary/5 to-transparent flex items-center justify-between">
        <div class="flex items-center gap-3">
          <div class="p-2 rounded-xl bg-primary text-white shadow-sm">
            <ClipboardCheck class="w-5 h-5" />
          </div>
          <div>
            <h3 class="font-display font-bold text-lg text-text">CEFR Leveling Assessment</h3>
            <p class="text-xs text-text-muted">Discover your accurate CEFR English level (A1 to B2)</p>
          </div>
        </div>

        <button
          type="button"
          @click="emit('close')"
          class="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
        >
          <X class="w-5 h-5" />
        </button>
      </div>

      <!-- Body -->
      <div class="p-6 overflow-y-auto space-y-5 custom-scrollbar">
        <!-- Mode selector: Chat or Voice -->
        <div>
          <label class="block text-xs font-bold text-text mb-2 uppercase tracking-wider">
            Assessment Mode
          </label>
          <div class="grid grid-cols-2 gap-3">
            <button
              type="button"
              @click="mode = 'chat'"
              class="flex items-center gap-3 p-3 rounded-xl border transition-all text-left"
              :class="
                mode === 'chat'
                  ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                  : 'border-border bg-surface text-text hover:bg-surface-hover'
              "
            >
              <MessageSquare class="w-5 h-5 shrink-0" />
              <div>
                <span class="block text-xs font-bold">Chat Mode</span>
                <span class="text-[0.68rem] text-text-muted">Type and read</span>
              </div>
            </button>

            <button
              type="button"
              @click="mode = 'voice'"
              class="flex items-center gap-3 p-3 rounded-xl border transition-all text-left"
              :class="
                mode === 'voice'
                  ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                  : 'border-border bg-surface text-text hover:bg-surface-hover'
              "
            >
              <Mic class="w-5 h-5 shrink-0" />
              <div>
                <span class="block text-xs font-bold">Voice Mode</span>
                <span class="text-[0.68rem] text-text-muted">Speak with Taty</span>
              </div>
            </button>
          </div>
        </div>

        <!-- Question Count Selector -->
        <div>
          <label class="block text-xs font-bold text-text mb-2 uppercase tracking-wider">
            Number of Questions
          </label>
          <div class="space-y-2">
            <button
              v-for="opt in options"
              :key="opt.count"
              type="button"
              @click="selectedCount = opt.count"
              class="w-full flex items-center justify-between p-3.5 rounded-xl border text-left transition-all"
              :class="
                selectedCount === opt.count
                  ? 'border-primary bg-primary/10 text-primary ring-1 ring-primary'
                  : 'border-border bg-surface text-text hover:bg-surface-hover'
              "
            >
              <div>
                <div class="flex items-center gap-2">
                  <span class="text-sm font-bold">{{ opt.label }}</span>
                  <span class="text-xs text-text-muted font-normal">({{ opt.time }})</span>
                  <span
                    v-if="opt.recommended"
                    class="px-1.5 py-0.5 rounded-md bg-primary text-white text-[0.6rem] font-bold"
                  >
                    Recommended
                  </span>
                </div>
                <p class="text-xs text-text-muted mt-0.5">{{ opt.desc }}</p>
              </div>
            </button>
          </div>
        </div>
      </div>

      <!-- Footer -->
      <div class="p-4 border-t border-border bg-surface flex items-center justify-end gap-3">
        <button
          type="button"
          @click="emit('close')"
          class="px-4 py-2 rounded-xl text-xs font-bold text-text-muted hover:text-text hover:bg-surface-hover transition-colors"
        >
          Cancel
        </button>
        <button
          type="button"
          @click="handleConfirm"
          :disabled="loading"
          class="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover shadow-sm active:scale-95 transition-all flex items-center gap-2 disabled:opacity-50"
        >
          <div v-if="loading" class="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
          <span>Start Assessment</span>
        </button>
      </div>
    </div>
  </div>
</template>

