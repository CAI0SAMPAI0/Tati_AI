<script setup lang="ts">
import { ref, watch, nextTick, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { ClipboardCheck, ArrowRight, AudioLines, Mic, BookMarked } from 'lucide-vue-next';
import type { Message } from '@/api/types';
import MessageBubble from './MessageBubble.vue';
import WordTooltip from './WordTooltip.vue';
import TatiLogo from '../ui/TatiLogo.vue';

const props = defineProps<{
  messages: Message[];
  isStreaming?: boolean;
  streamingContent?: string;
  showLevelingCard?: boolean;
}>();

const emit = defineEmits<{
  (e: 'startLeveling'): void;
  (e: 'switchToVoice'): void;
  (e: 'editMessage', messageId: string, newContent: string): void;
}>();

const router = useRouter();
const containerRef = ref<HTMLDivElement | null>(null);
const bottomRef = ref<HTMLDivElement | null>(null);

const activeWord = ref<string | null>(null);
const tooltipPos = ref<{ x: number; y: number } | null>(null);

function handleWordClick(word: string, x: number, y: number) {
  activeWord.value = word;
  tooltipPos.value = { x, y };
}

function scrollToBottom(smooth = false) {
  nextTick(() => {
    if (bottomRef.value) {
      bottomRef.value.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto' });
    }
  });
}

watch(
  () => props.messages.length,
  () => {
    scrollToBottom(true);
  }
);

watch(
  () => props.isStreaming,
  () => {
    scrollToBottom(false);
  }
);

onMounted(() => {
  scrollToBottom(false);
});
</script>

<template>
  <div ref="containerRef" class="flex-1 overflow-y-auto p-4 space-y-5 scrollbar-thin">
    <!-- Welcome Hero if empty -->
    <div
      v-if="messages.length === 0 && !isStreaming"
      class="flex flex-col items-center justify-center py-8 md:py-12 text-center animate-fade-in max-w-2xl mx-auto px-4 w-full"
    >
      <div class="w-16 h-16 rounded-full border-[3px] border-primary/40 shadow-glow overflow-hidden mb-5 flex items-center justify-center">
        <TatiLogo :size="64" class="w-full h-full object-cover rounded-full" />
      </div>

      <header class="space-y-3 mb-8">
        <h1 class="font-editorial text-[32px] md:text-[36px] leading-tight text-primary font-normal">
          Welcome to Taty's Hub
        </h1>
        <p class="text-[15px] leading-relaxed text-text-muted max-w-md mx-auto">
          Your AI English learning hub. Let's practice together?
        </p>
      </header>

      <!-- CEFR Leveling Card -->
      <article
        v-if="showLevelingCard !== false"
        class="w-full md:max-w-xl xl:max-w-2xl h-auto rounded-2xl border border-border bg-surface p-6 text-left shadow-sm hover:border-primary/40 transition-all mb-6 mx-auto"
      >
        <div class="flex items-center justify-between mb-2">
          <div class="flex items-center gap-2">
            <span class="p-1.5 rounded-lg bg-primary/10 text-primary">
              <ClipboardCheck class="w-4 h-4" />
            </span>
            <h2 class="text-lg font-bold text-text">CEFR Leveling Test</h2>
          </div>
          <span class="text-[0.65rem] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
            NEW
          </span>
        </div>

        <p class="mt-2 text-sm leading-relaxed text-text-muted">
          Discover your exact English level (A1 to B2) in a quick conversational challenge with Taty's Hub. You'll receive your score and diagnostic report!
        </p>

        <button
          type="button"
          @click="emit('startLeveling')"
          class="mt-6 w-full rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-white hover:bg-primary-hover active:scale-[0.99] transition-all flex items-center justify-center gap-2 cursor-pointer shadow-sm shadow-primary/20"
        >
          <span>Start Leveling Challenge</span>
          <ArrowRight class="w-4 h-4" />
        </button>
      </article>

      <!-- Quick Action Pills -->
      <div class="flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          @click="router.push('/pronunciation')"
          class="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-xl text-xs text-text-muted hover:text-text hover:border-primary/40 transition-all cursor-pointer font-medium shadow-xs"
        >
          <AudioLines class="w-3.5 h-3.5 text-primary" />
          Pronunciation Practice
        </button>

        <button
          type="button"
          @click="emit('switchToVoice')"
          class="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-xl text-xs text-text-muted hover:text-text hover:border-primary/40 transition-all cursor-pointer font-medium shadow-xs"
        >
          <Mic class="w-3.5 h-3.5 text-primary" />
          Voice
        </button>

        <button
          type="button"
          @click="router.push('/activities')"
          class="inline-flex items-center gap-2 px-4 py-2 bg-surface border border-border rounded-xl text-xs text-text-muted hover:text-text hover:border-primary/40 transition-all cursor-pointer font-medium shadow-xs"
        >
          <BookMarked class="w-3.5 h-3.5 text-primary" />
          Activities
        </button>
      </div>
    </div>

    <!-- Messages list -->
    <div v-else class="space-y-4">
      <MessageBubble
        v-for="msg in messages"
        :key="msg.id"
        :message="msg"
        @word-click="handleWordClick"
        @edit="(id, content) => emit('editMessage', id, content)"
      />

      <!-- Streaming Message -->
      <MessageBubble
        v-if="isStreaming"
        :message="{
          id: 'streaming-temp',
          conversation_id: 'streaming',
          role: 'assistant',
          content: streamingContent || '',
          created_at: new Date().toISOString(),
        }"
        is-streaming
        @word-click="handleWordClick"
      />
    </div>

    <div ref="bottomRef" class="h-2"></div>

    <!-- Global Word Lookup Tooltip -->
    <WordTooltip
      :word="activeWord"
      :position="tooltipPos"
      @close="activeWord = null"
    />
  </div>
</template>

