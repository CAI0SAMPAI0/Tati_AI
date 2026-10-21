<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  ArrowLeft,
  Volume2,
  RotateCcw,
  Check,
  X,
  HelpCircle,
  Sparkles,
  ArrowRight,
  RefreshCw,
  AlertTriangle,
  Trophy,
} from 'lucide-vue-next';
import { apiGet, apiPost } from '@/api/client';
import { useAuth } from '@/composables/useAuth';
import { useToast } from '@/composables/useToast';
import Button from '@/components/ui/Button.vue';

interface Flashcard {
  id?: string;
  front: string;
  back: string;
  options?: string[];
  image_url?: string;
  explanation?: string;
}

interface Deck {
  id: string;
  title: string;
  description: string;
  level?: string;
  flashcards: any[];
}

type CardStatus = 'correct' | 'wrong' | 'unknown' | null;

const OPTION_LETTERS = ['A', 'B', 'C', 'D'];

const ACCENTS = [
  { id: 'en-US', label: '🇺🇸 American', shortLabel: 'US' },
  { id: 'en-GB', label: '🇬🇧 British', shortLabel: 'UK' },
  { id: 'en-AU', label: '🇦🇺 Australian', shortLabel: 'AU' },
  { id: 'en-CA', label: '🇨🇦 Canadian', shortLabel: 'CA' },
];

const route = useRoute();
const router = useRouter();
const toast = useToast();
const { user, accent } = useAuth();

const deckId = computed(() => route.params.id as string);

const deck = ref<Deck | null>(null);
const isLoading = ref(true);
const queue = ref<Flashcard[]>([]);
const initialCards = ref<Flashcard[]>([]);
const currentIndex = ref(0);
const selectedOption = ref<string | null>(null);
const revealed = ref(false);
const cardStatus = ref<CardStatus>(null);
const shuffledOptions = ref<string[]>([]);
const finished = ref(false);

const firstTryCorrect = ref<Set<string>>(new Set());
const retriedCards = ref<Set<string>>(new Set());
const retrySessionCount = ref(0);

const selectedAccent = ref(accent.value || 'en-US');
const isPlayingAudio = ref(false);
const activeAudio = ref<HTMLAudioElement | null>(null);

function capitalize(str: string): string {
  if (!str) return '';
  const trimmed = str.trim();
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1);
}

function normalizeCard(raw: any, allRawCards: any[] = []): Flashcard {
  const vals = Object.values(raw) as string[];
  const frontRaw = String(raw.front ?? raw.word ?? raw.term ?? raw.question ?? vals[0] ?? '').trim();
  const front = capitalize(frontRaw);
  const back = String(raw.back ?? raw.definition ?? raw.meaning ?? raw.answer ?? vals[1] ?? '').trim();

  let options: string[] = [];
  if (Array.isArray(raw.options) && raw.options.length > 0) {
    options = raw.options.map((o: any) => capitalize(String(o).trim())).filter(Boolean);
  }

  if (front && !options.some((o) => o.toLowerCase() === front.toLowerCase())) {
    options.unshift(front);
  }

  if (options.length < 4 && allRawCards.length > 0) {
    for (const other of allRawCards) {
      const otherFrontRaw = String(other.front ?? other.word ?? other.term ?? '').trim();
      const otherFront = capitalize(otherFrontRaw);
      if (
        otherFront &&
        otherFront.toLowerCase() !== front.toLowerCase() &&
        !options.some((o) => o.toLowerCase() === otherFront.toLowerCase())
      ) {
        options.push(otherFront);
      }
      if (options.length >= 4) break;
    }
  }

  const fallbackWords = ['Vocabulary', 'Expression', 'Grammar', 'Meaning', 'Concept', 'Practice'];
  for (const w of fallbackWords) {
    if (options.length >= 4) break;
    if (
      !options.some((o) => o.toLowerCase() === w.toLowerCase()) &&
      w.toLowerCase() !== front.toLowerCase()
    ) {
      options.push(w);
    }
  }

  // Ensure ALL options are capitalized and deduplicated
  const finalOptions = Array.from(new Set(options.map((o) => capitalize(o)))).slice(0, 4);

  return {
    id: raw.id ? String(raw.id) : undefined,
    front,
    back,
    options: finalOptions,
    image_url: raw.image_url ?? raw.imageUrl ?? raw.image ?? undefined,
    explanation: raw.explanation ?? raw.description ?? undefined,
  };
}

async function loadDeck() {
  if (!deckId.value) return;
  isLoading.value = true;
  try {
    const data = await apiGet<Deck>(`/activities/modules/${deckId.value}`);
    deck.value = data;
    const raw = Array.isArray(data?.flashcards) ? data.flashcards : [];
    const normalized = raw.map((c, _, arr) => normalizeCard(c, arr)).filter((c) => c.front);
    initialCards.value = normalized;
    queue.value = [...normalized];
    currentIndex.value = 0;
    setupCurrentCard();
  } catch (err) {
    console.error('Error loading deck:', err);
    toast.error('Deck not found or failed to load.');
  } finally {
    isLoading.value = false;
  }
}

const currentCard = computed(() => queue.value[currentIndex.value]);
const isReviewCard = computed(() => currentIndex.value >= initialCards.value.length);
const totalInQueue = computed(() => queue.value.length);
const progressPct = computed(() =>
  totalInQueue.value > 0 ? (currentIndex.value / totalInQueue.value) * 100 : 0
);
const remainingInQueue = computed(() => totalInQueue.value - currentIndex.value);

function setupCurrentCard() {
  if (!currentCard.value) return;
  const opts = [...(currentCard.value.options || [currentCard.value.front])].map((o) => capitalize(o));
  for (let i = opts.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [opts[i], opts[j]] = [opts[j], opts[i]];
  }
  shuffledOptions.value = opts;
  selectedOption.value = null;
  revealed.value = false;
  cardStatus.value = null;
}

watch(currentIndex, () => {
  setupCurrentCard();
});

function handleSelectOption(chosen: string) {
  if (revealed.value || !currentCard.value) return;

  selectedOption.value = chosen;
  revealed.value = true;

  const isMatch = chosen.trim().toLowerCase() === currentCard.value.front.trim().toLowerCase();

  if (isMatch) {
    cardStatus.value = 'correct';
    if (!retriedCards.value.has(currentCard.value.front)) {
      firstTryCorrect.value.add(currentCard.value.front);
    }
    apiPost('/activities/flashcards/progress', {
      deck_id: deckId.value,
      card_front: currentCard.value.front,
      status: 'correct',
    }).catch(() => {});
  } else {
    cardStatus.value = 'wrong';
    retriedCards.value.add(currentCard.value.front);
    retrySessionCount.value++;
    queue.value.push(currentCard.value);
    apiPost('/activities/flashcards/progress', {
      deck_id: deckId.value,
      card_front: currentCard.value.front,
      status: 'wrong',
    }).catch(() => {});
  }
}

function handleSkip() {
  if (revealed.value || !currentCard.value) return;

  selectedOption.value = null;
  cardStatus.value = 'unknown';
  revealed.value = true;
  retriedCards.value.add(currentCard.value.front);
  retrySessionCount.value++;
  queue.value.push(currentCard.value);

  apiPost('/activities/flashcards/progress', {
    deck_id: deckId.value,
    card_front: currentCard.value.front,
    status: 'unknown',
  }).catch(() => {});
}

function handleNext() {
  if (currentIndex.value + 1 < queue.value.length) {
    currentIndex.value++;
  } else {
    finishDeck();
  }
}

function finishDeck() {
  finished.value = true;
  const total = initialCards.value.length;
  const cleanCorrect = firstTryCorrect.value.size;
  const retrySuccess = total - cleanCorrect;
  const weightedScore = Math.round(((cleanCorrect * 1.0 + retrySuccess * 0.7) / total) * 100);

  apiPost('/activities/submissions', {
    activity_id: deckId.value,
    activity_type: 'flashcards',
    score: weightedScore,
    status: 'completed',
    metadata: {
      title: deck.value?.title || 'Flashcards Deck',
      deck_id: deckId.value,
      total_cards: total,
      first_try_correct: cleanCorrect,
      retry_success: retrySuccess,
      total_retries: retrySessionCount.value,
      category: 'flashcards',
      url: `/flashcards/${deckId.value}`,
    },
  }).catch(() => {});
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
    // Fallback native speech synthesis
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
  queue.value = [...initialCards.value];
  currentIndex.value = 0;
  selectedOption.value = null;
  revealed.value = false;
  cardStatus.value = null;
  finished.value = false;
  firstTryCorrect.value.clear();
  retriedCards.value.clear();
  retrySessionCount.value = 0;
  setupCurrentCard();
}

onMounted(() => {
  loadDeck();
});

onUnmounted(() => {
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
      v-else-if="!deck || initialCards.length === 0"
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
      <div class="w-full max-w-lg bg-surface border border-border rounded-3xl p-8 md:p-10 text-center space-y-6 shadow-xl">
        <div class="w-24 h-24 rounded-full flex items-center justify-center mx-auto text-3xl font-black bg-emerald-500/15 text-emerald-500 border-2 border-emerald-500/30">
          <Trophy class="w-12 h-12 text-emerald-500" />
        </div>

        <div>
          <h2 class="text-2xl font-bold text-text mb-1">All Flashcards Mastered!</h2>
          <p class="text-text-muted text-sm">{{ deck.title }} · {{ initialCards.length }} cards completed</p>
          <p class="text-xs font-semibold text-emerald-500 mt-1">
            You reviewed and mastered all cards in this deck! 🎉
          </p>
        </div>

        <!-- Performance Breakdown Grid -->
        <div class="grid grid-cols-3 gap-2.5 text-center">
          <div class="bg-emerald-500/10 border border-emerald-500/20 rounded-2xl p-3">
            <div class="text-xl font-bold text-emerald-500">{{ firstTryCorrect.size }}</div>
            <div class="text-[0.68rem] text-emerald-500/80 font-bold mt-0.5">First Try</div>
          </div>
          <div class="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-3">
            <div class="text-xl font-bold text-amber-500">{{ initialCards.length - firstTryCorrect.size }}</div>
            <div class="text-[0.68rem] text-amber-500/80 font-bold mt-0.5">After Review</div>
          </div>
          <div class="bg-primary/10 border border-primary/20 rounded-2xl p-3">
            <div class="text-xl font-bold text-primary">{{ retrySessionCount }}</div>
            <div class="text-[0.68rem] text-primary/80 font-bold mt-0.5">Total Retries</div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="flex flex-col sm:flex-row gap-3 pt-2">
          <Button variant="secondary" class="flex-1" @click="handleRestart">
            <RotateCcw class="w-4 h-4 mr-2" /> Practice Again
          </Button>
          <Button class="flex-1" @click="router.push('/activities')">
            Activities <ArrowRight class="w-4 h-4 ml-2" />
          </Button>
        </div>
      </div>
    </div>

    <!-- Active Flashcard Playing Session -->
    <main v-else class="flex-1 flex flex-col items-center p-4 md:p-8 animate-fade-in">
      <!-- Top Bar: Back & Progress -->
      <div class="w-full max-w-2xl mb-6 space-y-3">
        <div class="flex items-center justify-between">
          <button
            type="button"
            @click="router.push('/activities')"
            class="flex items-center gap-2 text-text-muted hover:text-text transition-colors text-sm font-medium"
          >
            <ArrowLeft class="w-4 h-4" /> Back to Activities
          </button>

          <span
            v-if="isReviewCard"
            class="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-amber-500/15 text-amber-400 border border-amber-500/30 animate-pulse"
          >
            <RefreshCw class="w-3.5 h-3.5" /> Reviewing pending cards
          </span>
        </div>

        <div class="flex items-center gap-3">
          <div class="flex-1 h-2 bg-border rounded-full overflow-hidden">
            <div
              class="h-full bg-primary rounded-full transition-all duration-300"
              :style="{ width: `${progressPct}%` }"
            ></div>
          </div>
          <span class="text-xs text-text-muted font-bold shrink-0">
            {{ currentIndex + 1 }} / {{ totalInQueue }}
          </span>
        </div>
      </div>

      <!-- Flashcard Surface -->
      <div class="w-full max-w-2xl space-y-5">
        <div class="text-center">
          <span class="px-3 py-1 rounded-full text-xs font-black bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider">
            Level {{ deck.level || 'All' }}
          </span>
          <h1 class="text-2xl font-bold text-text mt-2">{{ deck.title }}</h1>
          <p class="text-xs text-text-muted mt-1">
            Choose the correct English option for the definition shown
          </p>
        </div>

        <div
          class="bg-surface border-2 rounded-3xl overflow-hidden shadow-xl transition-all duration-300"
          :class="
            revealed
              ? cardStatus === 'correct'
                ? 'border-emerald-500/60 ring-2 ring-emerald-500/20'
                : 'border-rose-500/60 ring-2 ring-rose-500/20'
              : 'border-border'
          "
        >
          <!-- Meaning / Clue Header -->
          <div class="p-6 md:p-8 text-center space-y-3 bg-gradient-to-b from-primary/5 to-transparent border-b border-border/50">
            <span class="text-xs uppercase font-black text-primary tracking-widest block">
              Definition / Meaning
            </span>
            <h2 class="text-xl md:text-2xl font-bold text-text leading-tight max-w-xl mx-auto">
              {{ currentCard?.back || currentCard?.front }}
            </h2>

            <div v-if="currentCard?.image_url" class="flex justify-center pt-2">
              <img
                :src="currentCard.image_url"
                alt="Context illustration"
                class="w-24 h-24 md:w-28 md:h-28 rounded-2xl object-cover border border-border/80 shadow-md"
              />
            </div>
          </div>

          <!-- 4 Multiple Choice Options -->
          <div class="p-5 md:p-6 space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                v-for="(opt, idx) in shuffledOptions"
                :key="`${opt}-${idx}`"
                type="button"
                @click="handleSelectOption(opt)"
                :disabled="revealed"
                class="p-4 rounded-2xl font-bold text-sm md:text-base border-2 text-left transition-all flex items-center justify-between gap-3"
                :class="
                  revealed
                    ? opt.trim().toLowerCase() === currentCard?.front.trim().toLowerCase()
                      ? 'bg-emerald-500/15 border-emerald-500/80 text-emerald-400 shadow-sm'
                      : selectedOption === opt
                      ? 'bg-rose-500/15 border-rose-500/80 text-rose-400'
                      : 'bg-bg/40 border-border/40 text-text-muted opacity-50'
                    : 'bg-bg hover:bg-surface-hover border-border text-text hover:border-primary/50'
                "
              >
                <div class="flex items-center gap-3 min-w-0">
                  <span
                    class="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black shrink-0 border transition-colors"
                    :class="
                      revealed && opt.trim().toLowerCase() === currentCard?.front.trim().toLowerCase()
                        ? 'bg-emerald-500 text-white border-emerald-400'
                        : revealed && selectedOption === opt
                        ? 'bg-rose-500 text-white border-rose-400'
                        : 'bg-surface text-text-muted border-border'
                    "
                  >
                    {{ OPTION_LETTERS[idx] || idx + 1 }}
                  </span>
                  <span class="truncate">{{ opt }}</span>
                </div>

                <Check
                  v-if="revealed && opt.trim().toLowerCase() === currentCard?.front.trim().toLowerCase()"
                  class="w-4 h-4 text-emerald-400 shrink-0"
                />
                <X
                  v-else-if="revealed && selectedOption === opt"
                  class="w-4 h-4 text-rose-400 shrink-0"
                />
              </button>
            </div>

            <!-- Bottom Actions -->
            <div v-if="!revealed" class="flex items-center justify-between pt-2">
              <button
                type="button"
                @click="handleSkip"
                class="px-4 py-2.5 rounded-xl text-xs font-bold bg-surface hover:bg-surface-hover border border-border text-text-muted transition-all flex items-center gap-2"
              >
                <HelpCircle class="w-3.5 h-3.5" /> Skip this card
              </button>
              <span class="text-xs text-text-muted font-medium">
                {{ remainingInQueue }} card{{ remainingInQueue > 1 ? 's' : '' }} remaining
              </span>
            </div>

            <!-- Revealed Feedback -->
            <div v-else class="space-y-4 pt-2">
              <div
                v-if="cardStatus !== 'correct'"
                class="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 flex items-center gap-3"
              >
                <AlertTriangle class="w-4 h-4 text-amber-400 shrink-0" />
                <p class="text-xs text-amber-300 font-semibold leading-relaxed">
                  {{
                    cardStatus === 'wrong'
                      ? "Incorrect answer! This card will return for you to review before finishing."
                      : "Card skipped! It will return before the end of the activity for you to try again."
                  }}
                </p>
              </div>

              <!-- Correct English Term Card -->
              <div class="bg-primary/10 border border-primary/25 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div class="min-w-0 flex-1">
                  <span class="text-[0.68rem] text-primary font-black uppercase tracking-wider block">
                    Correct English Term
                  </span>
                  <span class="text-xl md:text-2xl font-extrabold text-text mt-0.5 block truncate">
                    {{ currentCard.front }}
                  </span>
                  <p v-if="currentCard.explanation" class="text-xs text-text-muted mt-1.5 italic">
                    "{{ currentCard.explanation }}"
                  </p>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                  <select
                    v-model="selectedAccent"
                    class="bg-surface border border-border/80 rounded-xl px-3 py-2 text-xs font-bold text-text hover:border-primary/50 focus:outline-none focus:border-primary cursor-pointer transition-colors shadow-sm"
                  >
                    <option v-for="acc in ACCENTS" :key="acc.id" :value="acc.id">
                      {{ acc.label }}
                    </option>
                  </select>

                  <button
                    type="button"
                    @click="handlePlayAudio(currentCard.front)"
                    :disabled="isPlayingAudio"
                    class="px-4 py-2 rounded-xl bg-primary text-white hover:scale-105 active:scale-95 transition-all shadow-glow flex items-center justify-center gap-2 text-xs font-bold shrink-0"
                  >
                    <Volume2 class="w-3.5 h-3.5" :class="{ 'animate-pulse': isPlayingAudio }" />
                    <span>{{ isPlayingAudio ? 'Playing...' : 'Listen' }}</span>
                  </button>
                </div>
              </div>

              <!-- Proceed Next Button -->
              <button
                type="button"
                @click="handleNext"
                class="w-full py-4 rounded-2xl font-bold text-base bg-primary text-white hover:bg-primary-hover transition-all shadow-glow flex items-center justify-center gap-2"
              >
                <span>{{ currentIndex === queue.length - 1 ? 'Finish Deck' : 'Next Card' }}</span>
                <ArrowRight class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  </div>
</template>
