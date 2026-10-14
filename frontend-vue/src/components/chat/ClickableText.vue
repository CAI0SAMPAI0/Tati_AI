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
  (e: 'word-click', word: string, x: number, y: number): void;
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
  if (typeof window !== 'undefined') {
    window.addEventListener('tati_settings_changed', loadSettings);
    window.addEventListener('storage', loadSettings);
  }
});

onUnmounted(() => {
  if (typeof window !== 'undefined') {
    window.removeEventListener('tati_settings_changed', loadSettings);
    window.removeEventListener('storage', loadSettings);
  }
});

function splitIntoSentences(input: string): string[] {
  if (!input) return [];
  const regex = /(?<!\b(?:e\.g|i\.e|etc|vs|dr|mr|mrs|ms|prof|st|\d)\.)(?<=[.!?]["'”’»\)]*)\s+|\n+/i;
  return input
    .split(regex)
    .map((s) => s.trim())
    .filter(Boolean);
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
        emit('word-click', resolved, e.clientX, e.clientY);
        return;
      }
    }
  }

  if (target.classList.contains('clickable-word')) {
    const word = target.textContent?.trim();
    if (word && word.length > 1) {
      emit('word-click', word, e.clientX, e.clientY);
    }
  }
}

interface TextBlock {
  type: 'paragraph' | 'list-item';
  sentences?: string[];
  words?: string[];
  rawText?: string;
}

const blocks = computed<TextBlock[]>(() => {
  const text = props.content || '';
  if (!text) return [];

  const rawLines = text.split('\n');
  const result: TextBlock[] = [];

  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const isListItem = /^[*-]\s+/.test(trimmed) || /^\d+\.\s+/.test(trimmed);
    const contentText = isListItem ? trimmed.replace(/^[*-]\s+|^\d+\.\s+/, '') : trimmed;

    if (!wordTooltipEnabled.value) {
      result.push({
        type: isListItem ? 'list-item' : 'paragraph',
        rawText: contentText,
      });
    } else if (tooltipMode.value === 'sentence') {
      const sentences = splitIntoSentences(contentText);
      result.push({
        type: isListItem ? 'list-item' : 'paragraph',
        sentences: sentences.length > 0 ? sentences : [contentText],
      });
    } else {
      const words = contentText.split(/(\s+|[.,!?;:()])/).filter(Boolean);
      result.push({
        type: isListItem ? 'list-item' : 'paragraph',
        words,
      });
    }
  }

  return result;
});
</script>

<template>
  <div
    class="clickable-text-root text-[0.9375rem] leading-relaxed space-y-2 select-text"
    :class="className"
    @click="handleClick"
  >
    <!-- If disabled, show plain text -->
    <template v-if="!wordTooltipEnabled">
      <div v-for="(b, i) in blocks" :key="i" class="whitespace-pre-wrap">
        <span v-if="b.type === 'list-item'" class="mr-2 text-primary font-bold">•</span>
        <span>{{ b.rawText }}</span>
      </div>
    </template>

    <!-- Sentence mode -->
    <template v-else-if="tooltipMode === 'sentence'">
      <div
        v-for="(b, i) in blocks"
        :key="i"
        class="leading-relaxed"
        :class="b.type === 'list-item' ? 'pl-4 relative' : ''"
      >
        <span v-if="b.type === 'list-item'" class="absolute left-0 text-primary font-bold select-none">•</span>
        <template v-for="(s, sIdx) in b.sentences" :key="sIdx">
          <span
            :data-sentence="s"
            class="clickable-sentence cursor-pointer hover:bg-primary/10 hover:text-primary rounded px-0.5 transition-all"
          >
            {{ s }}
          </span>
          <span class="select-none"> </span>
        </template>
      </div>
    </template>

    <!-- Word mode -->
    <template v-else>
      <div
        v-for="(b, i) in blocks"
        :key="i"
        class="leading-relaxed"
        :class="b.type === 'list-item' ? 'pl-4 relative' : ''"
      >
        <span v-if="b.type === 'list-item'" class="absolute left-0 text-primary font-bold select-none">•</span>
        <template v-for="(w, wIdx) in b.words" :key="wIdx">
          <span
            v-if="/[a-zA-Z]/.test(w) && w.length > 1"
            class="clickable-word cursor-pointer hover:text-primary hover:underline transition-colors decoration-dotted"
          >
            {{ w }}
          </span>
          <span v-else>{{ w }}</span>
        </template>
      </div>
    </template>
  </div>
</template>
