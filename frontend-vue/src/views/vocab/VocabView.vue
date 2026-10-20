<script setup lang="ts">
import { ref } from 'vue';
import { BookMarked, Volume2, Plus } from 'lucide-vue-next';
import { useTTS } from '@/composables/useTTS';

const { speak } = useTTS();

const vocabList = ref([
  { word: 'Accomplish', translation: 'Realizar / Conquistar', context: 'She accomplished her goal of speaking fluent English.' },
  { word: 'Breakthrough', translation: 'Avanço importante', context: 'Scientists announced a major breakthrough.' },
  { word: 'Convenient', translation: 'Prático / Conveniente', context: 'It is very convenient to practice with an AI teacher.' },
  { word: 'Essential', translation: 'Essencial / Fundamental', context: 'Consistency is essential for language acquisition.' },
]);
</script>

<template>
  <div class="max-w-4xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="font-display text-2xl font-extrabold text-text">My Vocabulary Bank</h1>
        <p class="text-xs sm:text-sm text-text-muted mt-0.5">
          Words and phrases saved during conversations and activities.
        </p>
      </div>
    </div>

    <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div
        v-for="(item, idx) in vocabList"
        :key="idx"
        class="bg-surface border border-border rounded-2xl p-5 shadow-sm space-y-2 hover:border-primary/40 transition-colors"
      >
        <div class="flex items-center justify-between">
          <h3 class="font-display font-bold text-base text-text">{{ item.word }}</h3>
          <button
            type="button"
            @click="speak(item.word)"
            class="p-1.5 rounded-lg text-primary hover:bg-primary/10 transition-colors"
            title="Hear pronunciation"
          >
            <Volume2 class="w-4 h-4" />
          </button>
        </div>
        <p class="text-xs font-semibold text-primary">{{ item.translation }}</p>
        <p class="text-xs text-text-muted italic">"{{ item.context }}"</p>
      </div>
    </div>
  </div>
</template>
