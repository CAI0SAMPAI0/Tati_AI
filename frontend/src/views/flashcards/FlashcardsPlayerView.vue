<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
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
  X,
  HelpCircle,
  AlertTriangle,
} from 'lucide-vue-next';
import { apiGet, apiPost } from '@/api/client';
import { ACCENTS, getStoredAccent } from '@/constants/accents';
import { useAuth } from '@/composables/useAuth';
import { useToast } from '@/composables/useToast';
import Button from '@/components/ui/Button.vue';

interface Flashcard {
  id?: string;
  front: string;
  back?: string;
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

const route = useRoute();
const router = useRouter();
const toast = useToast();
const { accent, setAccent, updateUserData } = useAuth();

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
const imageError = ref(false);

const firstTryCorrect = ref<Set<string>>(new Set());
const retriedCards = ref<Set<string>>(new Set());
const retrySessionCount = ref(0);

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

function normalizeCard(raw: any, allRawCards: any[] = []): Flashcard {
  const frontRaw = String(raw?.front ?? raw?.word ?? raw?.term ?? raw?.question ?? '').trim();
  const front = capitalize(frontRaw);
  let back = String(raw?.back ?? raw?.definition ?? raw?.meaning ?? raw?.answer ?? '').trim();

  // If back is identical to front or contains the target word, NEVER use it as a clue (prevents spoiling the answer!)
  if (
    !back ||
    back.toLowerCase() === front.toLowerCase() ||
    (front.length >= 3 && back.toLowerCase().includes(front.toLowerCase()))
  ) {
    back = '';
  }

  let options: string[] = [];
  if (Array.isArray(raw?.options) && raw.options.length > 0) {
    options = raw.options.map((o: any) => capitalize(String(o).trim())).filter(Boolean);
  }

  if (front && !options.some((o) => o.toLowerCase() === front.toLowerCase())) {
    options.unshift(front);
  }

  if (options.length < 4 && allRawCards.length > 0) {
    for (const other of allRawCards) {
      const otherFrontRaw = String(other?.front ?? other?.word ?? other?.term ?? '').trim();
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

  const finalOptions = Array.from(new Set(options.map((o) => capitalize(o)))).slice(0, 4);
  const rawImage = raw?.image_url ?? raw?.imageUrl ?? raw?.image;
  const imageUrl = typeof rawImage === 'string' && rawImage.trim() ? rawImage.trim() : undefined;

  return {
    id: raw?.id ? String(raw.id) : undefined,
    front,
    back: back || undefined,
    options: finalOptions,
    image_url: imageUrl,
    explanation: raw?.explanation ?? raw?.description ?? undefined,
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
    const [deckData, subs] = await Promise.all([
      apiGet<Deck>(`/activities/modules/${deckId.value}`),
      apiGet<any[]>('/activities/submissions').catch(() => []),
    ]);

    deck.value = deckData;
    const raw = Array.isArray(deckData?.flashcards) ? deckData.flashcards : [];
    const normalized = raw.map((c, _, arr) => normalizeCard(c, arr)).filter((c) => c.front);

    initialCards.value = normalized;
    queue.value = [...normalized];
    currentIndex.value = 0;

    if (Array.isArray(subs)) {
      checkCompletionFromSubmissions(subs);
    }

    setupCurrentCard();
  } catch (err) {
    console.error('Error loading deck:', err);
    toast.error('Deck not found or failed to load.');
  } finally {
    isLoading.value = false;
  }
}

function setupCurrentCard() {
  if (!currentCard.value) return;
  imageError.value = false;
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

const currentCard = computed(() => queue.value[currentIndex.value]);
const isReviewCard = computed(() => currentIndex.value >= initialCards.value.length);
const totalInQueue = computed(() => queue.value.length);
const remainingInQueue = computed(() => Math.max(0, queue.value.length - currentIndex.value - 1));
const progressPct = computed(() => {
  if (totalInQueue.value === 0) return 0;
  return Math.min(100, Math.round(((currentIndex.value + 1) / totalInQueue.value) * 100));
});

const correctPercentage = computed(() => {
  if (!initialCards.value.length) return 0;
  return Math.round((firstTryCorrect.value.size / initialCards.value.length) * 100);
});

function playFeedbackSound(isCorrect: boolean) {
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;
    const ctx = new AudioContextClass();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);

    if (isCorrect) {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(523.25, ctx.currentTime);
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.08);
      gain.gain.setValueAtTime(0.12, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.3);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.3);
    } else {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, ctx.currentTime);
      osc.frequency.setValueAtTime(196, ctx.currentTime + 0.12);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.35);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + 0.35);
    }
  } catch {
    // Ignore audio context autoplay restrictions
  }
}

function handleSelectOption(chosen: string) {
  if (revealed.value || !currentCard.value) return;

  selectedOption.value = chosen;
  revealed.value = true;

  const isMatch = chosen.trim().toLowerCase() === currentCard.value.front.trim().toLowerCase();

  if (isMatch) {
    cardStatus.value = 'correct';
    playFeedbackSound(true);
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
    playFeedbackSound(false);
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
  playFeedbackSound(false);

  retriedCards.value.add(currentCard.value.front);
  retrySessionCount.value++;
  queue.value.push(currentCard.value);

  apiPost('/activities/flashcards/progress', {
    deck_id: deckId.value,
    card_front: currentCard.value.front,
    status: 'skipped',
  }).catch(() => {});
}

function handleNext() {
  if (currentIndex.value + 1 < queue.value.length) {
    currentIndex.value++;
    setupCurrentCard();
  } else {
    finishDeck();
  }
}

async function finishDeck() {
  finished.value = true;
  const total = initialCards.value.length;
  const wasAlreadyCompleted = isCompleted.value;
  const finalScore = total > 0 ? Math.round((firstTryCorrect.value.size / total) * 100) : 100;

  try {
    const res = await apiPost<{
      xp_earned?: number;
      new_total_xp?: number;
      streak_count?: number;
    }>('/activities/submissions', {
      activity_id: deckId.value,
      activity_type: 'flashcards',
      score: finalScore > 0 ? finalScore : 100,
      status: 'completed',
      metadata: {
        id: deckId.value,
        title: deck.value?.title || 'Flashcards Deck',
        deck_id: deckId.value,
        total_cards: total,
        score: finalScore,
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

    toast.info('Activity reverted to pending. Score reset.');
  } catch (err) {
    console.error('Error reverting flashcard deck to pending:', err);
    toast.error('Failed to revert status.');
  } finally {
    isReverting.value = false;
  }
}

function handleRestart() {
  queue.value = [...initialCards.value];
  firstTryCorrect.value.clear();
  retriedCards.value.clear();
  retrySessionCount.value = 0;
  currentIndex.value = 0;
  finished.value = false;
  setupCurrentCard();
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

function handleKeydown(e: KeyboardEvent) {
  if (finished.value || isLoading.value) return;

  const activeTag = (document.activeElement?.tagName || '').toLowerCase();
  if (activeTag === 'input' || activeTag === 'textarea' || activeTag === 'select') return;

  // Options 1, 2, 3, 4
  if (!revealed.value) {
    if (['1', '2', '3', '4'].includes(e.key)) {
      const idx = parseInt(e.key, 10) - 1;
      if (shuffledOptions.value[idx]) {
        e.preventDefault();
        handleSelectOption(shuffledOptions.value[idx]);
      }
    } else if (e.key.toLowerCase() === 's') {
      e.preventDefault();
      handleSkip();
    }
  } else {
    // Proceed on Enter or Space
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleNext();
    } else if (e.key.toLowerCase() === 'l' && currentCard.value) {
      e.preventDefault();
      handlePlayAudio(currentCard.value.front);
    }
  }
}

onMounted(() => {
  loadDeck();
  document.addEventListener('click', handleDocumentClick);
  window.addEventListener('keydown', handleKeydown);
});

onUnmounted(() => {
  document.removeEventListener('click', handleDocumentClick);
  window.removeEventListener('keydown', handleKeydown);
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
  <div class="min-h-screen bg-bg flex flex-col">
    <!-- Loading State -->
    <div v-if="isLoading" class="flex-1 flex flex-col items-center justify-center p-6 gap-3">
      <div class="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
      <p class="text-sm font-semibold text-text-muted">Loading deck...</p>
    </div>

    <!-- Empty Deck State -->
    <div
      v-else-if="!deck || initialCards.length === 0"
      class="flex-1 flex flex-col items-center justify-center p-6 text-center space-y-4"
    >
      <div class="w-16 h-16 rounded-2xl bg-surface border border-border flex items-center justify-center text-text-muted">
        <Sparkles class="w-8 h-8 opacity-40" />
      </div>
      <h2 class="text-xl font-bold text-text">No Flashcards Available</h2>
      <p class="text-sm text-text-muted max-w-sm">
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
          <p class="text-text-muted text-sm">{{ deck.title }} · {{ initialCards.length }} cards completed</p>
          <div class="flex items-center justify-center gap-4 mt-3">
            <span class="px-3 py-1 rounded-xl bg-primary/10 text-primary font-bold text-xs">
              Score: {{ correctPercentage }}% First Try
            </span>
            <span v-if="retrySessionCount > 0" class="px-3 py-1 rounded-xl bg-amber-500/10 text-amber-500 font-bold text-xs">
              {{ retrySessionCount }} Review Attempts
            </span>
          </div>

          <p v-if="lastXpEarned > 0" class="text-xs font-semibold text-emerald-500 mt-3">
            Activity completed! +{{ lastXpEarned }} XP earned 🎉
          </p>
          <p v-else-if="isCompleted" class="text-xs font-semibold text-emerald-500 mt-3">
            You completed all cards in this deck! 🎉
          </p>
          <p v-else class="text-xs font-semibold text-warning mt-3">
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
          <span class="text-xs text-text-muted font-bold shrink-0 flex items-center gap-1.5">
            <span v-if="isReviewCard" class="text-amber-500 font-extrabold flex items-center gap-0.5">
              🔁 Review
            </span>
            <span>Card {{ currentIndex + 1 }} of {{ totalInQueue }}</span>
          </span>
        </div>
      </div>

      <!-- Flashcard Surface & 4 Options -->
      <div class="w-full max-w-2xl space-y-5">
        <div class="text-center">
          <span
            class="px-3 py-1 rounded-full text-xs font-black bg-primary/10 text-primary border border-primary/20 uppercase tracking-wider"
          >
            Level {{ deck.level || 'All' }}
          </span>
          <h1 class="text-xl md:text-2xl font-black text-text mt-2">{{ deck.title }}</h1>
        </div>

        <!-- Question Prompt / Context Container -->
        <div class="bg-surface border-2 border-border rounded-3xl shadow-xl overflow-hidden">
          <!-- Illustration / Question Header (Never spoils the answer) -->
          <div class="p-6 md:p-8 text-center space-y-4 bg-gradient-to-b from-primary/5 to-transparent border-b border-border/50">
            <!-- If card has an image, the image is the visual clue -->
            <div v-if="currentCard?.image_url && !imageError" class="space-y-3">
              <span class="text-xs uppercase font-black text-primary tracking-widest block">
                Look at the image
              </span>
              <p class="text-xs text-text-muted font-medium">
                Choose the word or phrase that matches this image:
              </p>
              <div class="flex justify-center pt-1">
                <img
                  :src="currentCard.image_url"
                  alt="Context illustration"
                  @error="imageError = true"
                  class="max-h-56 md:max-h-64 max-w-full rounded-2xl object-contain border border-border/80 shadow-md bg-bg/50 select-none"
                />
              </div>
            </div>

            <!-- If card has NO image, but has a definition/translation (that does not reveal the answer) -->
            <div v-else-if="currentCard?.back" class="space-y-2 py-4">
              <span class="text-xs uppercase font-black text-primary tracking-widest block">
                Definition / Meaning
              </span>
              <h2 class="text-xl md:text-2xl font-bold text-text leading-tight max-w-xl mx-auto">
                {{ currentCard.back }}
              </h2>
              <p class="text-xs text-text-muted font-medium">
                Choose the correct English term:
              </p>
            </div>

            <!-- Fallback if no image and no distinct definition -->
            <div v-else class="flex flex-col items-center justify-center py-6 text-text-muted gap-2">
              <span class="text-xs uppercase font-black text-primary tracking-widest block">
                Challenge
              </span>
              <p class="text-sm font-semibold text-text">Choose the correct English term</p>
            </div>
          </div>

          <!-- 4 Multiple Choice Options (A, B, C, D) -->
          <div class="p-5 md:p-6 space-y-4">
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                v-for="(opt, idx) in shuffledOptions"
                :key="`${opt}-${idx}`"
                type="button"
                @click="handleSelectOption(opt)"
                :disabled="revealed"
                class="p-4 rounded-2xl font-bold text-sm md:text-base border-2 text-left transition-all flex items-center justify-between gap-3 cursor-pointer disabled:cursor-default"
                :class="
                  revealed
                    ? opt.trim().toLowerCase() === currentCard?.front.trim().toLowerCase()
                      ? 'bg-emerald-500/15 border-emerald-500 text-emerald-400 shadow-sm'
                      : selectedOption === opt
                      ? 'bg-rose-500/15 border-rose-500 text-rose-400'
                      : 'bg-bg/40 border-border/40 text-text-muted opacity-40'
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

            <!-- Bottom Actions: Skip (Before Reveal) -->
            <div v-if="!revealed" class="flex items-center justify-between pt-2">
              <button
                type="button"
                @click="handleSkip"
                class="px-4 py-2.5 rounded-xl text-xs font-bold bg-surface hover:bg-surface-hover border border-border text-text-muted transition-all flex items-center gap-2 cursor-pointer"
              >
                <HelpCircle class="w-3.5 h-3.5" /> Skip this card
              </button>
              <span class="text-xs text-text-muted font-medium">
                {{ remainingInQueue }} card{{ remainingInQueue === 1 ? '' : 's' }} remaining
              </span>
            </div>

            <!-- Revealed Feedback Banner & Proceed Controls -->
            <div v-else class="space-y-4 pt-2">
              <!-- Re-queue Alert for Mistakes -->
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

              <!-- Correct English Term Banner with TTS & 10 Accents -->
              <div
                class="bg-primary/10 border border-primary/25 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
              >
                <div class="min-w-0 flex-1">
                  <span class="text-[0.68rem] text-primary font-black uppercase tracking-wider block">
                    Correct English Term
                  </span>
                  <span class="text-xl md:text-2xl font-extrabold text-text mt-0.5 block truncate">
                    {{ currentCard?.front }}
                  </span>
                  <p v-if="currentCard?.explanation" class="text-xs text-text-muted mt-1.5 italic">
                    "{{ currentCard.explanation }}"
                  </p>
                </div>

                <div class="flex items-center gap-2 shrink-0">
                  <!-- 10 Accents Dropdown -->
                  <div class="relative" ref="accentMenuRef">
                    <button
                      type="button"
                      @click.stop="isAccentMenuOpen = !isAccentMenuOpen"
                      class="flex items-center gap-2 px-3 py-2 rounded-xl bg-surface hover:bg-surface-hover border border-border hover:border-primary/50 text-xs font-bold text-text transition-all cursor-pointer shadow-xs"
                    >
                      <span class="text-sm leading-none">{{ currentAccentObj.flag }}</span>
                      <span class="hidden sm:inline">{{ currentAccentObj.label }}</span>
                      <span class="sm:hidden">{{ currentAccentObj.shortLabel }}</span>
                      <ChevronDown
                        class="w-3.5 h-3.5 text-text-muted transition-transform duration-200"
                        :class="{ 'rotate-180': isAccentMenuOpen }"
                      />
                    </button>

                    <!-- Accents Dropdown Popover -->
                    <div
                      v-if="isAccentMenuOpen"
                      class="absolute right-0 bottom-full mb-2 w-64 bg-surface border border-border rounded-2xl shadow-2xl p-2 z-50 animate-in fade-in slide-in-from-bottom-2 duration-150"
                    >
                      <div class="px-2.5 py-1.5 text-[0.68rem] font-bold uppercase tracking-wider text-text-muted border-b border-border/50 mb-1">
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
                          <span class="flex items-center gap-2.5">
                            <span class="text-sm leading-none">{{ acc.flag }}</span>
                            <span>{{ acc.label }}</span>
                          </span>
                          <Check v-if="acc.id === selectedAccent" class="w-3.5 h-3.5 text-primary shrink-0" />
                        </button>
                      </div>
                    </div>
                  </div>

                  <!-- Listen Button -->
                  <button
                    type="button"
                    @click="currentCard && handlePlayAudio(currentCard.front)"
                    :disabled="isPlayingAudio || !currentCard"
                    class="px-4 py-2 rounded-xl bg-primary text-white hover:bg-primary-hover active:scale-95 transition-all shadow-glow flex items-center justify-center gap-1.5 text-xs font-bold shrink-0 cursor-pointer disabled:opacity-50"
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
                class="w-full py-4 rounded-2xl font-bold text-base bg-primary text-white hover:bg-primary-hover transition-all shadow-glow flex items-center justify-center gap-2 cursor-pointer"
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

<style scoped>
.custom-scrollbar::-webkit-scrollbar {
  width: 6px;
}
.custom-scrollbar::-webkit-scrollbar-track {
  background: transparent;
}
.custom-scrollbar::-webkit-scrollbar-thumb {
  background-color: var(--color-border);
  border-radius: 9999px;
}
</style>
