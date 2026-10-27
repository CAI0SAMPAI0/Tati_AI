<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  ArrowLeft,
  ArrowRight,
  Volume2,
  RotateCcw,
  Sparkles,
  Trophy,
  Clock,
  CheckCircle2,
  ImageOff,
  ChevronDown,
  Check,
} from 'lucide-vue-next';
import { apiGet, apiPost } from '@/api/client';
import { ACCENTS, getStoredAccent } from '@/constants/accents';
import { useAuth } from '@/composables/useAuth';
import { useToast } from '@/composables/useToast';
import Button from '@/components/ui/Button.vue';

interface Flashcard {
  id?: string;
  front: string;
  image_url?: string;
}

interface Deck {
  id: string;
  title: string;
  description: string;
  level?: string;
  flashcards: any[];
}

const route = useRoute();
const router = useRouter();
const toast = useToast();
const { accent, setAccent, updateUserData } = useAuth();

const deckId = computed(() => route.params.id as string);

const deck = ref<Deck | null>(null);
const isLoading = ref(true);
const cards = ref<Flashcard[]>([]);
const currentIndex = ref(0);
const isFlipped = ref(false);
const skipFlipTransition = ref(false);
const imageError = ref(false);
const finished = ref(false);

const isCompleted = ref(false);
const isReverting = ref(false);
const lastXpEarned = ref(0);

const selectedAccent = ref(accent.value || getStoredAccent());
const isAccentMenuOpen = ref(false);
const accentMenuRef = ref<HTMLElement | null>(null);
const isPlayingAudio = ref(false);
const activeAudio = ref<HTMLAudioElement | null>(null);

const currentAccentObj = computed(
  () => ACCENTS.find((a) => a.id === selectedAccent.value) || ACCENTS[0]
);

function selectAccentOption(accentId: string) {
  selectedAccent.value = accentId;
  setAccent(accentId);
  isAccentMenuOpen.value = false;
}

function handleDocumentClick(e: MouseEvent) {
  if (
    isAccentMenuOpen.value &&
    accentMenuRef.value &&
    !accentMenuRef.value.contains(e.target as Node)
  ) {
    isAccentMenuOpen.value = false;
  }
}

function capitalize(str: string): string {
  if (!str) return '';
  const trimmed = str.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

// Normaliza apenas a palavra/frase da frente e a URL real da imagem do verso
function normalizeCard(raw: any): Flashcard {
  const frontRaw = String(raw?.front ?? raw?.word ?? raw?.term ?? '').trim();
  const rawImage = raw?.image_url ?? raw?.imageUrl ?? raw?.image;
  const imageUrl = typeof rawImage === 'string' && rawImage.trim() ? rawImage.trim() : undefined;

  return {
    id: raw?.id ? String(raw.id) : undefined,
    front: capitalize(frontRaw),
    image_url: imageUrl,
  };
}

function checkCompletionFromSubmissions(subs: any[]) {
  const targetUrl = `/flashcards/${deckId.value}`;
  isCompleted.value = subs.some((sub: any) => {
    const isDoneScore = sub.score !== undefined ? sub.score > 0 : true;
    const statusNotPending = sub.status !== 'pending' && sub.metadata?.status !== 'pending';
    if (!isDoneScore || !statusNotPending) return false;
    return (
      sub.activity_id === deckId.value ||
      sub.module_id === deckId.value ||
      sub.metadata?.id === deckId.value ||
      sub.metadata?.deck_id === deckId.value ||
      sub.metadata?.url === targetUrl
    );
  });
}

async function loadDeck() {
  if (!deckId.value) return;
  isLoading.value = true;
  try {
    const [data, subs] = await Promise.all([
      apiGet<Deck>(`/activities/modules/${deckId.value}`),
      apiGet<any[]>('/activities/submissions/my').catch(() => []),
    ]);
    deck.value = data;
    const raw = Array.isArray(data?.flashcards) ? data.flashcards : [];
    cards.value = raw.map((c) => normalizeCard(c)).filter((c) => c.front);
    currentIndex.value = 0;
    isFlipped.value = false;
    imageError.value = false;
    finished.value = false;
    checkCompletionFromSubmissions(Array.isArray(subs) ? subs : []);
  } catch (err) {
    console.error('Error loading deck:', err);
    toast.error('Deck not found or failed to load.');
  } finally {
    isLoading.value = false;
  }
}

const currentCard = computed(() => cards.value[currentIndex.value]);
const totalCards = computed(() => cards.value.length);
const progressPct = computed(() =>
  totalCards.value > 0 ? ((currentIndex.value + 1) / totalCards.value) * 100 : 0
);

function toggleFlip() {
  skipFlipTransition.value = false;
  isFlipped.value = !isFlipped.value;
}

// Alterna o índice sem exibir a imagem do próximo card durante o retorno da rotação 3D
function goToCardIndex(nextIdx: number) {
  skipFlipTransition.value = true;
  isFlipped.value = false;
  imageError.value = false;
  currentIndex.value = nextIdx;
  if (typeof window !== 'undefined') {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        skipFlipTransition.value = false;
      });
    });
  }
}

function handlePrev() {
  if (currentIndex.value > 0) {
    goToCardIndex(currentIndex.value - 1);
  }
}

function handleNext() {
  if (currentCard.value) {
    apiPost('/activities/flashcards/progress', {
      deck_id: deckId.value,
      card_front: currentCard.value.front,
      status: 'correct',
    }).catch(() => {});
  }

  if (currentIndex.value + 1 < totalCards.value) {
    goToCardIndex(currentIndex.value + 1);
  } else {
    finishDeck();
  }
}

async function finishDeck() {
  finished.value = true;
  const total = totalCards.value;
  const wasAlreadyCompleted = isCompleted.value;

  try {
    const res = await apiPost<{
      xp_earned?: number;
      new_total_xp?: number;
      streak_count?: number;
    }>('/activities/submissions', {
      activity_id: deckId.value,
      activity_type: 'flashcards',
      score: 100,
      status: 'completed',
      metadata: {
        id: deckId.value,
        title: deck.value?.title || 'Flashcards Deck',
        deck_id: deckId.value,
        total_cards: total,
        status: 'done',
        category: 'flashcards',
        url: `/flashcards/${deckId.value}`,
      },
    });

    const earned = !wasAlreadyCompleted ? (res?.xp_earned ?? 25) : 0;
    lastXpEarned.value = earned > 0 ? earned : 0;
    isCompleted.value = true;

    if (res?.new_total_xp !== undefined) {
      updateUserData({
        xp: res.new_total_xp,
        ...(res.streak_count !== undefined ? { streak: res.streak_count } : {}),
      });
    }

    if (lastXpEarned.value > 0) {
      toast.success(`Activity completed! +${lastXpEarned.value} XP 🎉`);
    }
  } catch (err) {
    console.error('Error submitting deck completion:', err);
  }
}

async function handleRevertToPending() {
  if (!isCompleted.value || isReverting.value) return;
  isReverting.value = true;
  try {
    const res = await apiPost<{
      xp_earned?: number;
      new_total_xp?: number;
      streak_count?: number;
    }>('/activities/submissions', {
      activity_id: deckId.value,
      activity_type: 'flashcards',
      score: 0,
      status: 'pending',
      metadata: {
        id: deckId.value,
        title: deck.value?.title || 'Flashcards Deck',
        deck_id: deckId.value,
        status: 'pending',
        category: 'flashcards',
        url: `/flashcards/${deckId.value}`,
      },
    });

    isCompleted.value = false;
    lastXpEarned.value = 0;

    if (res?.new_total_xp !== undefined) {
      updateUserData({
        xp: res.new_total_xp,
        ...(res.streak_count !== undefined ? { streak: res.streak_count } : {}),
      });
    }

    toast.success('Activity reverted to pending and score removed.');
  } catch (err) {
    console.error('Error reverting deck to pending:', err);
    toast.error('Error reverting activity.');
  } finally {
    isReverting.value = false;
  }
}

async function handlePlayAudio(text: string) {
  if (activeAudio.value) {
    activeAudio.value.pause();
    activeAudio.value = null;
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }

  isPlayingAudio.value = true;
  try {
    const res = await apiPost<{ audio?: string; audio_b64?: string }>('/chat/tts', {
      text,
      accent: selectedAccent.value,
    });
    const b64 = res?.audio_b64 || res?.audio;
    if (b64) {
      const audio = new Audio(`data:audio/mp3;base64,${b64}`);
      activeAudio.value = audio;
      audio.onended = () => {
        isPlayingAudio.value = false;
        activeAudio.value = null;
      };
      audio.onerror = () => {
        isPlayingAudio.value = false;
        activeAudio.value = null;
      };
      await audio.play();
      return;
    }
  } catch {
    if ('speechSynthesis' in window) {
      const u = new SpeechSynthesisUtterance(text);
      u.lang = selectedAccent.value;
      u.onend = () => {
        isPlayingAudio.value = false;
      };
      u.onerror = () => {
        isPlayingAudio.value = false;
      };
      window.speechSynthesis.speak(u);
      return;
    }
  }
  isPlayingAudio.value = false;
}

function handleRestart() {
  skipFlipTransition.value = true;
  currentIndex.value = 0;
  isFlipped.value = false;
  imageError.value = false;
  finished.value = false;
  lastXpEarned.value = 0;
  if (typeof window !== 'undefined') {
    window.requestAnimationFrame(() => {
      skipFlipTransition.value = false;
    });
  }
}

onMounted(() => {
  document.addEventListener('click', handleDocumentClick);
  loadDeck();
});

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick);
  if (activeAudio.value) {
    activeAudio.value.pause();
    activeAudio.value = null;
  }
  if ('speechSynthesis' in window) {
    window.speechSynthesis.cancel();
  }
});
</script>

<template>
  <div class="min-h-screen bg-bg text-text flex flex-col">
    <!-- Loading State -->
    <div v-if="isLoading" class="min-h-screen flex items-center justify-center">
      <div class="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
    </div>

    <!-- Empty / Not Found -->
    <div
      v-else-if="!deck || cards.length === 0"
      class="min-h-screen flex flex-col items-center justify-center space-y-4 p-8 text-center"
    >
      <Sparkles class="w-12 h-12 text-primary/40 animate-pulse" />
      <h2 class="text-xl font-bold">Deck not found or empty</h2>
      <p class="text-xs text-text-muted max-w-sm">
        This deck does not have any active cards configured yet.
      </p>
      <Button @click="router.push('/activities')">Back to Activities</Button>
    </div>

    <!-- Completion / Summary Screen -->
    <div
      v-else-if="finished"
      class="flex-1 flex flex-col items-center justify-center p-6 animate-fade-in"
    >
      <div
        class="w-full max-w-lg bg-surface border border-border rounded-3xl p-8 md:p-10 text-center space-y-6 shadow-xl"
      >
        <div
          class="w-24 h-24 rounded-full flex items-center justify-center mx-auto text-3xl font-black bg-emerald-500/15 text-emerald-500 border-2 border-emerald-500/30"
        >
          <Trophy class="w-12 h-12 text-emerald-500" />
        </div>

        <div>
          <h2 class="text-2xl font-bold text-text mb-1">All Flashcards Mastered!</h2>
          <p class="text-text-muted text-sm">{{ deck.title }} · {{ totalCards }} cards completed</p>
          <p v-if="lastXpEarned > 0" class="text-xs font-semibold text-emerald-500 mt-1">
            Activity completed! +{{ lastXpEarned }} XP earned 🎉
          </p>
          <p v-else-if="isCompleted" class="text-xs font-semibold text-emerald-500 mt-1">
            You reviewed all cards in this deck! 🎉
          </p>
          <p v-else class="text-xs font-semibold text-warning mt-1">
            Status: Pending (score removed — complete the deck again to earn XP)
          </p>
        </div>

        <!-- Action Buttons -->
        <div class="flex flex-col gap-3 pt-2">
          <div class="flex flex-col sm:flex-row gap-3">
            <Button variant="secondary" class="flex-1" @click="handleRestart">
              <RotateCcw class="w-4 h-4 mr-2" /> Practice Again
            </Button>
            <Button class="flex-1" @click="router.push('/activities')">
              Activities
              <ArrowRight class="w-4 h-4 ml-2" />
            </Button>
          </div>

          <button
            v-if="isCompleted"
            type="button"
            @click="handleRevertToPending"
            :disabled="isReverting"
            class="w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-2xl text-xs font-bold bg-surface text-text-muted hover:bg-warning/15 hover:text-warning border border-border hover:border-warning/30 transition-all cursor-pointer disabled:opacity-50"
          >
            <Clock class="w-4 h-4" />
            <span>{{ isReverting ? 'Reverting...' : 'Revert to Pending' }}</span>
          </button>
        </div>
      </div>
    </div>

    <!-- Active Flashcard Playing Session -->
    <main v-else class="flex-1 flex flex-col items-center p-4 md:p-8 animate-fade-in">
      <!-- Top Bar: Back, Completion Status & Progress -->
      <div class="w-full max-w-2xl mb-6 space-y-3">
        <div class="flex items-center justify-between gap-3 flex-wrap">
          <button
            type="button"
            @click="router.push('/activities')"
            class="flex items-center gap-2 text-text-muted hover:text-text transition-colors text-sm font-medium cursor-pointer"
          >
            <ArrowLeft class="w-4 h-4" /> Back to Activities
          </button>

          <div v-if="isCompleted" class="flex items-center gap-2">
            <span
              class="flex items-center gap-1 text-xs font-bold bg-success/15 text-success border border-success/30 px-2.5 py-1 rounded-full uppercase"
            >
              <CheckCircle2 class="w-3.5 h-3.5" /> Completed
            </span>
            <button
              type="button"
              @click="handleRevertToPending"
              :disabled="isReverting"
              class="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-surface text-text-muted hover:bg-warning/15 hover:text-warning border border-border hover:border-warning/30 transition-all cursor-pointer disabled:opacity-50"
            >
              <Clock class="w-3.5 h-3.5" />
              <span>{{ isReverting ? 'Reverting...' : 'Revert to Pending' }}</span>
            </button>
          </div>
        </div>

        <div class="flex items-center gap-3">
          <div class="flex-1 h-2 bg-border rounded-full overflow-hidden">
            <div
              class="h-full bg-primary rounded-full transition-all duration-300"
              :style="{ width: `${progressPct}%` }"
            ></div>
          </div>
          <span class="text-xs text-text-muted font-bold shrink-0">
            {{ currentIndex + 1 }} / {{ totalCards }}
          </span>
        </div>
      </div>

      <!-- Flashcard Surface & Controls -->
      <div class="w-full max-w-2xl space-y-5">
        <div class="text-center">
          <span
            class="px-3 py-1 rounded-full text-xs font-black bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider"
          >
            Level {{ deck.level || 'All' }}
          </span>
          <h1 class="text-2xl font-bold text-text mt-2">{{ deck.title }}</h1>
        </div>

        <!-- 3D Flip Card (Bottom-to-Top on Click) -->
        <div class="flashcard-perspective w-full">
          <button
            type="button"
            @click="toggleFlip"
            :aria-label="isFlipped ? 'Flip card back to word' : 'Flip card to image'"
            class="flashcard-inner w-full min-h-[340px] md:min-h-[380px] relative cursor-pointer focus:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded-3xl block text-left"
            :class="{
              'is-flipped': isFlipped,
              'no-flip-transition': skipFlipTransition,
            }"
          >
            <!-- FRONT: Word or Phrase Only -->
            <div
              class="flashcard-face bg-surface border-2 border-border hover:border-primary/40 rounded-3xl shadow-xl p-8 md:p-12 flex items-center justify-center text-center transition-colors"
            >
              <h2
                class="text-2xl md:text-4xl font-extrabold text-text leading-tight max-w-xl mx-auto select-none"
              >
                {{ currentCard?.front }}
              </h2>
            </div>

            <!-- BACK: Corresponding Image Only -->
            <div
              class="flashcard-face flashcard-face-back bg-surface border-2 border-border hover:border-primary/40 rounded-3xl shadow-xl p-6 md:p-8 flex items-center justify-center transition-colors overflow-hidden"
            >
              <img
                v-if="currentCard?.image_url && !imageError"
                :src="currentCard.image_url"
                alt=""
                @error="imageError = true"
                class="w-full h-full max-h-72 md:max-h-80 rounded-2xl object-contain mx-auto select-none pointer-events-none"
              />
              <div
                v-else
                class="flex flex-col items-center justify-center py-12 text-text-muted gap-2"
              >
                <ImageOff class="w-10 h-10 opacity-40" />
                <span class="text-xs font-semibold">Image unavailable</span>
              </div>
            </div>
          </button>
        </div>

        <!-- Audio Controls Bar: 10 Accents Dropdown + Listen Button -->
        <div
          class="bg-surface border border-border rounded-2xl p-3.5 flex items-center justify-between gap-3 shadow-sm"
        >
          <div class="relative" ref="accentMenuRef">
            <button
              type="button"
              @click.stop="isAccentMenuOpen = !isAccentMenuOpen"
              class="flex items-center gap-2 px-3.5 py-2.5 rounded-xl bg-bg hover:bg-surface-hover border border-border hover:border-primary/50 text-xs font-bold text-text transition-all cursor-pointer shadow-xs"
            >
              <span class="text-base leading-none">{{ currentAccentObj.flag }}</span>
              <span>{{ currentAccentObj.label.replace(/^.*?\s/, '') }}</span>
              <ChevronDown
                class="w-3.5 h-3.5 text-text-muted transition-transform duration-200"
                :class="{ 'rotate-180': isAccentMenuOpen }"
              />
            </button>

            <div
              v-if="isAccentMenuOpen"
              class="absolute left-0 bottom-full mb-2 w-60 bg-surface border border-border rounded-2xl shadow-2xl p-1.5 z-50 animate-fade-in"
            >
              <div
                class="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted border-b border-border mb-1"
              >
                Pronunciation Accent ({{ ACCENTS.length }})
              </div>
              <div class="max-h-60 overflow-y-auto space-y-0.5 custom-scrollbar">
                <button
                  v-for="acc in ACCENTS"
                  :key="acc.id"
                  type="button"
                  @click.stop="selectAccentOption(acc.id)"
                  class="w-full flex items-center justify-between px-2.5 py-2 rounded-xl text-xs font-medium transition-all text-left cursor-pointer"
                  :class="
                    acc.id === selectedAccent
                      ? 'bg-primary/15 text-primary font-bold'
                      : 'hover:bg-bg text-text'
                  "
                >
                  <div class="flex items-center gap-2 truncate">
                    <span class="text-sm">{{ acc.flag }}</span>
                    <div class="min-w-0">
                      <span class="block truncate">{{ acc.label.replace(/^.*?\s/, '') }}</span>
                      <span class="block text-[10px] text-text-muted truncate">{{ acc.desc }}</span>
                    </div>
                  </div>
                  <Check v-if="acc.id === selectedAccent" class="w-3.5 h-3.5 text-primary shrink-0" />
                </button>
              </div>
            </div>
          </div>

          <button
            type="button"
            @click="currentCard && handlePlayAudio(currentCard.front)"
            :disabled="isPlayingAudio || !currentCard"
            class="px-5 py-2.5 rounded-xl bg-primary text-white hover:bg-primary-hover active:scale-95 transition-all shadow-glow flex items-center justify-center gap-2 text-xs font-bold shrink-0 cursor-pointer disabled:opacity-50"
          >
            <Volume2 class="w-4 h-4" :class="{ 'animate-pulse': isPlayingAudio }" />
            <span>{{ isPlayingAudio ? 'Playing...' : 'Listen' }}</span>
          </button>
        </div>

        <!-- Navigation Buttons: Previous & Next / Finish -->
        <div class="grid grid-cols-2 gap-3">
          <button
            type="button"
            @click="handlePrev"
            :disabled="currentIndex === 0"
            class="w-full py-4 rounded-2xl font-bold text-sm md:text-base bg-surface hover:bg-surface-hover border border-border text-text transition-all flex items-center justify-center gap-2 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
          >
            <ArrowLeft class="w-4 h-4" />
            <span>Previous</span>
          </button>

          <button
            type="button"
            @click="handleNext"
            class="w-full py-4 rounded-2xl font-bold text-sm md:text-base bg-primary text-white hover:bg-primary-hover transition-all shadow-glow flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>{{ currentIndex === totalCards - 1 ? 'Finish Deck' : 'Next Card' }}</span>
            <ArrowRight class="w-4 h-4" />
          </button>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.flashcard-perspective {
  perspective: 1200px;
}

.flashcard-inner {
  transform-style: preserve-3d;
  transition: transform 0.55s cubic-bezier(0.4, 0.2, 0.2, 1);
}

.flashcard-inner.no-flip-transition {
  transition: none !important;
}

/* Rotação no eixo X positivo move a borda inferior para cima em direção ao usuário */
.flashcard-inner.is-flipped {
  transform: rotateX(180deg);
}

.flashcard-face {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.flashcard-face-back {
  transform: rotateX(180deg);
}
</style>

<style scoped>
.flashcard-perspective {
  perspective: 1200px;
}

.flashcard-inner {
  transform-style: preserve-3d;
  transition: transform 0.55s cubic-bezier(0.4, 0.2, 0.2, 1);
}

.flashcard-inner.no-flip-transition {
  transition: none !important;
}

/* Rotação no eixo X positivo move a borda inferior para cima em direção ao usuário */
.flashcard-inner.is-flipped {
  transform: rotateX(180deg);
}

.flashcard-face {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
}

.flashcard-face-back {
  transform: rotateX(180deg);
}
</style>

