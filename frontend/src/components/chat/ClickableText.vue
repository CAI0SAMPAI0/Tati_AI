<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';

const props = withDefaults(
  defineProps<{
    content: string;
    isMarkdown?: boolean;
    className?: string;
  }>(),
  {
    isMarkdown: true,
    className: '',
  }
);

const emit = defineEmits<{
  (e: 'wordClick', word: string, x: number, y: number): void;
}>();

const tooltipMode = ref<'sentence' | 'word'>('sentence');
const wordTooltipEnabled = ref(true);

function loadSettings() {
  try {
    const raw = localStorage.getItem('tati_settings');
    if (raw) {
      const s = JSON.parse(raw);
      if (s.tooltipMode) {
        tooltipMode.value = s.tooltipMode;
      }
      if (typeof s.wordTooltip === 'boolean') {
        wordTooltipEnabled.value = s.wordTooltip;
      }
    }
  } catch (_) {}
}

onMounted(() => {
  loadSettings();
  window.addEventListener('tati_settings_changed', loadSettings);
  window.addEventListener('storage', loadSettings);
});

onUnmounted(() => {
  window.removeEventListener('tati_settings_changed', loadSettings);
  window.removeEventListener('storage', loadSettings);
});

function splitIntoSentences(input: string): string[] {
  if (!input) return [];
  const regex = /(?<!\b(?:e\.g|i\.e|etc|vs|dr|mr|mrs|ms|prof|st|\d)\.)(?<=[.!?]["'”’»\)]*)\s+|\n+/i;
  return input.split(regex).map((s) => s.trim()).filter(Boolean);
}

function formatSentenceForTranslation(sentenceText: string): string {
  let clean = sentenceText.trim();
  if (!clean) return '';
  if (
    (/^["'“‘]/.test(clean) && /["'”’]$/.test(clean)) ||
    (/^\(/.test(clean) && /\)$/.test(clean)) ||
    (/^\[/.test(clean) && /\]$/.test(clean))
  ) {
    clean = clean.slice(1, -1).trim();
  }
  return clean || sentenceText.trim();
}

function handleClick(e: MouseEvent) {
  if (!wordTooltipEnabled.value) return;
  const target = e.target as HTMLElement;

  if (tooltipMode.value === 'sentence') {
    const sentenceEl = target.closest('.clickable-sentence') as HTMLElement | null;
    if (sentenceEl) {
      const fullSentence = sentenceEl.getAttribute('data-sentence') || sentenceEl.textContent || '';
      const resolved = formatSentenceForTranslation(fullSentence);
      if (resolved && resolved.length > 1) {
        emit('wordClick', resolved, e.clientX, e.clientY);
        return;
      }
    }
  }

  const wordEl = target.closest('.clickable-word') as HTMLElement | null;
  if (wordEl) {
    const word = wordEl.textContent?.trim().replace(/^[^a-zA-Z0-9À-ÿ]+|[^a-zA-Z0-9À-ÿ]+$/g, '');
    if (word && word.length > 1) {
      emit('wordClick', word, e.clientX, e.clientY);
    }
  }
}

// Sentence segments computed
const sentenceSegments = computed(() => {
  if (!props.content) return [];
  return splitIntoSentences(props.content);
});

// Word tokens computed for word-by-word mode
const wordTokens = computed(() => {
  if (!props.content) return [];
  const parts = props.content.split(/(\s+|[.,!?;:()"]+)/);
  return parts.filter(Boolean).map((part) => {
    const isWord = /^[a-zA-Z0-9À-ÿ'-]+$/.test(part) && part.length > 1;
    return {
      text: part,
      isWord,
    };
  });
});
</script>

<template>
  <!-- If word tooltips are disabled, just display plain text -->
  <div v-if="!wordTooltipEnabled" class="whitespace-pre-wrap leading-relaxed" :class="className">
    {{ content }}
  </div>

  <!-- Sentence Mode: translates sentence up to period/punctuation -->
  <div
    v-else-if="tooltipMode === 'sentence'"
    class="whitespace-pre-wrap leading-relaxed inline"
    :class="className"
    @click="handleClick"
  >
    <template v-for="(sent, i) in sentenceSegments" :key="i">
      <span
        v-if="sent.trim()"
        :data-sentence="sent"
        class="clickable-sentence cursor-pointer hover:bg-primary/10 hover:text-primary rounded px-0.5 transition-all underline-offset-4 decoration-dotted"
      >{{ sent }} </span>
      <span v-else>{{ sent }} </span>
    </template>
  </div>

  <!-- Word Mode: translates word by word -->
  <div
    v-else
    class="whitespace-pre-wrap leading-relaxed inline"
    :class="className"
    @click="handleClick"
  >
    <template v-for="(token, idx) in wordTokens" :key="idx">
      <span
        v-if="token.isWord"
        class="clickable-word cursor-pointer hover:text-primary hover:underline transition-colors decoration-dotted underline-offset-4 rounded-xs px-0.5"
      >{{ token.text }}</span>
      <span v-else>{{ token.text }}</span>
    </template>
  </div>
</template>
