<script setup lang="ts">
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  Brain,
  Sparkles,
  Volume2,
  Trophy,
  CheckCircle2,
  ArrowLeft,
} from 'lucide-vue-next';
import { apiGet, apiPost } from '@/api/client';
import { useTTS } from '@/composables/useTTS';
import { useToast } from '@/composables/useToast';
import Button from '@/components/ui/Button.vue';

interface VocabSRS {
  id: string;
  word: string;
  definition?: string;
  example_sentence?: string;
  next_review?: string;
}

const router = useRouter();
const toast = useToast();
const { speak, playBase64 } = useTTS();

const dueWords = ref<VocabSRS[]>([]);
const isLoading = ref(true);
const currentIndex = ref(0);
const showAnswer = ref(false);
const isFinished = ref(false);

async function loadDueWords() {
  isLoading.value = true;
  try {
    const data = await apiGet<VocabSRS[]>('/users/vocabulary/due');
    dueWords.value = data || [];
  } catch (err) {
    console.error('Error fetching due words:', err);
  } finally {
    isLoading.value = false;
  }
}

async function handleReview(score: number) {
  const current = dueWords.value[currentIndex.value];
  if (!current) return;

  try {
    await apiPost(`/users/vocabulary/review/${current.id}?quality_score=${score}`, {});

    if (currentIndex.value < dueWords.value.length - 1) {
      showAnswer.value = false;
      currentIndex.value++;
    } else {
      isFinished.value = true;
    }
  } catch (err) {
    toast.error('Error saving review score.');
  }
}

async function playAudio(text: string) {
  try {
    const res = await apiPost<{ audio?: string; audio_b64?: string }>('/chat/tts', { text });
    const b64 = res?.audio_b64 || res?.audio;
    if (b64) {
      await playBase64(b64);
    } else {
      await speak(text);
    }
  } catch {
    await speak(text);
  }
}

onMounted(() => {
  loadDueWords();
});
</script>

<template>
  <div class="max-w-2xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-8 animate-fade-in flex flex-col items-center">
    <!-- Header Back -->
    <div class="w-full flex items-center justify-between">
      <button
        type="button"
        @click="router.push('/vocab')"
        class="flex items-center gap-2 text-text-muted hover:text-text text-xs font-bold transition-colors"
      >
        <ArrowLeft class="w-4 h-4" />
        <span>Back to Vocabulary</span>
      </button>
    </div>

    <!-- Loading -->
    <div v-if="isLoading" class="py-24 flex justify-center">
      <div class="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
    </div>

    <!-- Active Review Session -->
    <div v-else-if="!isFinished && dueWords.length > 0" class="w-full space-y-8 text-center">
      <header class="space-y-2">
        <div class="inline-flex items-center gap-2 px-3 py-1 bg-primary/10 rounded-full text-primary text-[0.65rem] font-black uppercase tracking-widest">
          <Brain class="w-3 h-3" />
          <span>SRS Spaced Repetition</span>
        </div>
        <h1 class="text-3xl font-display font-extrabold text-text">Daily Review</h1>
        <p class="text-xs text-text-muted">
          Reviewing {{ currentIndex + 1 }} of {{ dueWords.length }} cards
        </p>
      </header>

      <!-- Flip Card Surface -->
      <div
        class="w-full min-h-[300px] bg-surface border-2 border-border rounded-3xl p-8 flex flex-col items-center justify-center text-center shadow-xl transition-all relative"
        :class="showAnswer ? 'border-primary/40 bg-primary/5' : ''"
      >
        <Sparkles class="w-8 h-8 text-primary/20 absolute top-6" />

        <h2 class="text-3xl sm:text-4xl font-display font-extrabold text-text mb-4 mt-4">
          {{ dueWords[currentIndex].word }}
        </h2>

        <button
          type="button"
          @click="playAudio(dueWords[currentIndex].word)"
          class="w-10 h-10 rounded-full bg-primary/10 hover:bg-primary/20 text-primary flex items-center justify-center transition-colors mb-4"
        >
          <Volume2 class="w-5 h-5" />
        </button>

        <!-- Revealed definition & example -->
        <div v-if="showAnswer" class="space-y-3 pt-3 border-t border-border/80 w-full animate-fade-in">
          <p class="text-lg font-bold text-primary">
            {{ dueWords[currentIndex].definition || 'No definition available' }}
          </p>
          <p v-if="dueWords[currentIndex].example_sentence" class="text-xs text-text-muted italic max-w-md mx-auto">
            "{{ dueWords[currentIndex].example_sentence }}"
          </p>
        </div>
      </div>

      <!-- Action Buttons -->
      <div class="w-full">
        <Button
          v-if="!showAnswer"
          size="lg"
          full-width
          class="py-4 text-base font-bold shadow-glow"
          @click="showAnswer = true"
        >
          Show Answer
        </Button>

        <div v-else class="grid grid-cols-5 gap-2 sm:gap-3">
          <button
            v-for="score in [1, 2, 3, 4, 5]"
            :key="score"
            type="button"
            @click="handleReview(score)"
            class="py-3 sm:py-4 rounded-xl border font-bold text-sm transition-all hover:scale-105 active:scale-95 flex flex-col items-center justify-center gap-0.5"
            :class="
              score <= 2
                ? 'bg-danger/10 border-danger/30 text-danger hover:bg-danger/20'
                : score === 3
                ? 'bg-warning/10 border-warning/30 text-warning hover:bg-warning/20'
                : 'bg-success/10 border-success/30 text-success hover:bg-success/20'
            "
          >
            <span class="text-base font-extrabold">{{ score }}</span>
            <span class="text-[0.6rem] font-bold uppercase tracking-wider">
              {{ score === 1 ? 'Hard' : score === 5 ? 'Easy' : 'Good' }}
            </span>
          </button>
        </div>
      </div>
    </div>

    <!-- Review Complete Screen -->
    <div
      v-else-if="isFinished"
      class="w-full bg-surface border border-border rounded-3xl p-10 text-center space-y-6 shadow-xl animate-fade-in"
    >
      <div class="w-20 h-20 bg-success/10 text-success rounded-full flex items-center justify-center mx-auto">
        <Trophy class="w-10 h-10" />
      </div>
      <h2 class="text-2xl sm:text-3xl font-display font-extrabold text-text">Review Complete!</h2>
      <p class="text-xs sm:text-sm text-text-muted max-w-md mx-auto">
        You've reviewed {{ dueWords.length }} vocabulary words today. Daily spaced repetition is the secret to fluent English.
      </p>
      <Button @click="router.push('/vocab')">Back to Vocabulary</Button>
    </div>

    <!-- All Caught Up -->
    <div
      v-else
      class="w-full bg-surface border border-border rounded-3xl p-10 text-center space-y-4 shadow-sm"
    >
      <CheckCircle2 class="w-12 h-12 text-success mx-auto" />
      <h2 class="text-xl font-bold text-text">You're all caught up!</h2>
      <p class="text-xs text-text-muted max-w-md mx-auto">
        No words are due for review right now. Keep chatting with Teacher Tati to learn new terms!
      </p>
      <Button variant="secondary" @click="router.push('/vocab')">Back to Vocabulary</Button>
    </div>
  </div>
</template>
