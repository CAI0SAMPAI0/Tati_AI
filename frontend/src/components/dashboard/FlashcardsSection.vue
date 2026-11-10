<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  Layers,
  Plus,
  Trash2,
  PenLine,
  Eye,
  EyeOff,
  Play,
  FileBox,
  Sparkles,
  Image as ImageIcon,
  Upload,
  CheckSquare,
  Square,
  CheckCircle2,
  Compass,
  BookOpen,
  MessageSquare,
  GraduationCap,
  Award,
  Crown,
  ChevronRight,
  ChevronLeft,
  RotateCw,
  X,
  ExternalLink,
} from 'lucide-vue-next';
import { apiGet, apiPost, apiPut, apiDelete, apiUpload } from '@/api/client';
import { LEVEL_FILTER_OPTIONS, normalizeLevel } from '@/constants/levels';
import { useToast } from '@/composables/useToast';
import { useBodyScrollLock } from '@/composables/useBodyScrollLock';
import { peekActivityCache, setActivityCache, removeActivityCache, TTL_1_DAY_MS } from '@/utils/activityCache';
import { getSemanticDistractors } from '@/utils/flashcardDistractors';

export interface Flashcard {
  front: string;
  image_url?: string;
  back?: string;
  options?: string[];
  distractors?: [string, string, string];
}

export interface FlashcardDeck {
  id: string;
  title: string;
  description?: string;
  card_count?: number;
  level?: string;
  levels?: string[];
  is_published?: boolean;
  flashcards?: Flashcard[];
}

const CEFR_LEVELS_METADATA = [
  { code: 'A1', label: 'Beginner', desc: 'Basic phrases & everyday expressions', icon: Compass, color: 'text-emerald-500', bgColor: 'bg-emerald-500/10', borderColor: 'border-emerald-500/20' },
  { code: 'A2', label: 'Elementary', desc: 'Simple routine daily exchanges', icon: BookOpen, color: 'text-sky-500', bgColor: 'bg-sky-500/10', borderColor: 'border-sky-500/20' },
  { code: 'B1', label: 'Intermediate', desc: 'Work, travel & leisure topics', icon: MessageSquare, color: 'text-blue-500', bgColor: 'bg-blue-500/10', borderColor: 'border-blue-500/20' },
  { code: 'B2', label: 'Upper Intermediate', desc: 'Complex ideas & discussion', icon: GraduationCap, color: 'text-violet-500', bgColor: 'bg-violet-500/10', borderColor: 'border-violet-500/20' },
  { code: 'C1', label: 'Advanced', desc: 'Nuanced & fluent expression', icon: Award, color: 'text-purple-500', bgColor: 'bg-purple-500/10', borderColor: 'border-purple-500/20' },
  { code: 'C2', label: 'Mastery', desc: 'Near-native precision', icon: Crown, color: 'text-amber-500', bgColor: 'bg-amber-500/10', borderColor: 'border-amber-500/20' },
];

const router = useRouter();
const toast = useToast();

const decks = ref<FlashcardDeck[]>([]);
const isLoading = ref(true);
const filterLevel = ref('all');
const selectedDeckIds = ref<string[]>([]);
const isBulkProcessing = ref(false);

const isModalOpen = ref(false);
useBodyScrollLock(isModalOpen);
const editingDeck = ref<FlashcardDeck | null>(null);
const activeStep = ref<1 | 2>(1);
const isSaving = ref(false);
const isGenerating = ref(false);
const showAiGen = ref(false);

const formData = ref<{
  title: string;
  description: string;
  card_count: number;
  level: string;
  levels: string[];
  ai_theme: string;
  ai_with_images: boolean;
  flashcards: Flashcard[];
}>({
  title: '',
  description: '',
  card_count: 10,
  level: 'all',
  levels: [],
  ai_theme: '',
  ai_with_images: true,
  flashcards: [],
});

const filteredDecks = computed(() => {
  return decks.value.filter((d) => {
    if (filterLevel.value === 'all') return true;
    const target = filterLevel.value.trim().toUpperCase();
    const rawList = d.levels && d.levels.length > 0 ? d.levels : (d.level ? [d.level] : []);
    const upperList = rawList.map((l) => (l || '').trim().toUpperCase());
    return upperList.includes(target) || upperList.includes('ALL');
  });
});

const CACHE_DECKS_KEY = 'dashboard:flashcards_v1';

async function loadDecks(silent = false) {
  if (!silent) {
    const cached = peekActivityCache<FlashcardDeck[]>(CACHE_DECKS_KEY);
    if (cached && cached.length > 0) {
      decks.value = cached;
      isLoading.value = false;
    } else {
      isLoading.value = true;
    }
  }
  try {
    const res = await apiGet<any>('/dashboard/flashcards');
    const list = Array.isArray(res) ? res : res?.decks || res?.data || [];
    decks.value = list;
    setActivityCache(CACHE_DECKS_KEY, list, TTL_1_DAY_MS);
  } catch (err) {
    console.error('Error loading decks:', err);
  } finally {
    isLoading.value = false;
  }
}

function buildCardDistractors(
  rawCard: any,
  allRawCards: any[] = [],
  deckTitle: string = ''
): [string, string, string] {
  const front = String(rawCard?.front || '').trim();
  const rawList: string[] = Array.isArray(rawCard?.distractors)
    ? rawCard.distractors
    : Array.isArray(rawCard?.options)
      ? rawCard.options
      : [];

  const cleaned = rawList
    .map((o: any) => String(o || '').trim())
    .filter((o: string) => Boolean(o) && o.toLowerCase() !== front.toLowerCase());

  if (cleaned.length < 3 && front) {
    const otherWords = allRawCards
      .map((c: any) => String(c?.front || '').trim())
      .filter((w: string) => Boolean(w) && w.toLowerCase() !== front.toLowerCase());
    const generated = getSemanticDistractors(front, deckTitle, [...otherWords, ...cleaned]);
    for (const g of generated) {
      if (cleaned.length >= 3) break;
      if (!cleaned.some((x) => x.toLowerCase() === g.toLowerCase())) {
        cleaned.push(g);
      }
    }
  }

  return [cleaned[0] || '', cleaned[1] || '', cleaned[2] || ''];
}

function handleRegenerateCardDistractors(index: number) {
  const card = formData.value.flashcards[index];
  if (!card) return;
  const front = (card.front || '').trim();
  const currentDistractors = (card.distractors || []).filter(Boolean);
  const otherWords = formData.value.flashcards
    .map((c, idx) => (idx !== index ? (c.front || '').trim() : ''))
    .filter(Boolean);
  const fresh = getSemanticDistractors(
    front || formData.value.title || 'Vocabulary',
    formData.value.title || formData.value.ai_theme || '',
    [...otherWords, ...currentDistractors]
  );
  card.distractors = [fresh[0] || '', fresh[1] || '', fresh[2] || ''];
}

function handleCardFrontBlur(index: number) {
  const card = formData.value.flashcards[index];
  if (!card) return;
  const front = (card.front || '').trim();
  if (!front) return;
  const hasAllDistractors =
    Array.isArray(card.distractors) &&
    card.distractors.filter((d) => String(d || '').trim().length > 0).length === 3;
  if (!hasAllDistractors) {
    card.distractors = buildCardDistractors(
      card,
      formData.value.flashcards,
      formData.value.title || formData.value.ai_theme || ''
    );
  }
}

function handleOpenNew() {
  editingDeck.value = null;
  activeStep.value = 1;
  showAiGen.value = false;
  formData.value = {
    title: '',
    description: '',
    card_count: 10,
    level: 'all',
    levels: ['B1'],
    ai_theme: '',
    ai_with_images: true,
    flashcards: [
      { front: '', image_url: '', distractors: ['', '', ''] },
      { front: '', image_url: '', distractors: ['', '', ''] },
    ],
  };
  isModalOpen.value = true;
}

function handleOpenEdit(deck: FlashcardDeck) {
  editingDeck.value = deck;
  activeStep.value = 1;
  showAiGen.value = false;
  const rawCards = deck.flashcards || (deck as any).cards || [];
  formData.value = {
    title: deck.title,
    description: deck.description || '',
    card_count: deck.card_count || rawCards.length || 10,
    level: deck.level || 'all',
    levels: deck.levels || (deck.level ? [deck.level] : ['B1']),
    ai_theme: '',
    ai_with_images: true,
    flashcards: rawCards.map((c: any) => ({
      front: c.front || '',
      image_url: c.image_url || '',
      distractors: buildCardDistractors(c, rawCards, deck.title || ''),
      ...(c.back ? { back: c.back } : {}),
    })),
  };
  isModalOpen.value = true;
}

function handleToggleLevel(code: string) {
  const current = formData.value.levels.map((l) => l.toUpperCase());
  const target = code.toUpperCase();
  if (current.includes(target)) {
    formData.value.levels = formData.value.levels.filter((l) => l.toUpperCase() !== target);
  } else {
    formData.value.levels.push(code);
  }
}

function handleAddCard() {
  formData.value.flashcards.push({ front: '', image_url: '', distractors: ['', '', ''] });
}

function handleRemoveCard(index: number) {
  formData.value.flashcards.splice(index, 1);
}

async function handleGenerateAI() {
  if (!formData.value.ai_theme.trim()) {
    toast.error('Please enter a theme for AI generation.');
    return;
  }
  isGenerating.value = true;
  try {
    const res = await apiPost<any>('/dashboard/flashcards/generate-ai', {
      theme: formData.value.ai_theme,
      level: formData.value.levels[0] || 'B1',
      levels: formData.value.levels,
      count: formData.value.card_count,
      with_images: formData.value.ai_with_images,
    });
    const cards = (res as any)?.flashcards || (res as any)?.cards || (res as any)?.data || [];
    if (cards.length > 0) {
      formData.value.flashcards = cards.map((c: any) => ({
        front: c.front || '',
        image_url: c.image_url || '',
        distractors: buildCardDistractors(c, cards, formData.value.ai_theme),
      }));
      if (!formData.value.title) {
        formData.value.title = `Vocabulary: ${formData.value.ai_theme}`;
      }
      toast.success(`${cards.length} cards generated with AI! 🎉`);
      activeStep.value = 2; // Jump directly to cards review
    } else {
      toast.error('AI generated 0 cards. Please try another theme.');
    }
  } catch (err: any) {
    toast.error(err?.message || 'Error generating cards with AI.');
  } finally {
    isGenerating.value = false;
  }
}

async function handleUploadCardImage(index: number, event: Event) {
  const file = (event.target as HTMLInputElement).files?.[0];
  if (!file) return;

  const form = new FormData();
  form.append('file', file);
  try {
    const res = await apiUpload<any>('/dashboard/flashcards/upload-image', form);
    if ((res as any)?.url) {
      formData.value.flashcards[index].image_url = (res as any).url;
      toast.success('Card image uploaded.');
    }
  } catch {
    toast.error('Failed to upload image.');
  }
}

async function handleSaveDeck() {
  if (!formData.value.title.trim()) {
    toast.error('Please enter a title for the deck.');
    activeStep.value = 1;
    return;
  }

  const validCards = formData.value.flashcards
    .filter((c) => c.front.trim())
    .map((c) => {
      const front = c.front.trim();
      const distractors = buildCardDistractors(
        c,
        formData.value.flashcards,
        formData.value.title.trim()
      )
        .map((d) => d.trim())
        .filter((d) => Boolean(d) && d.toLowerCase() !== front.toLowerCase());
      const options = [front, ...distractors].slice(0, 4);
      return {
        front,
        image_url: c.image_url?.trim() || '',
        options,
        ...(c.back ? { back: c.back } : {}),
      };
    });
  if (validCards.length === 0) {
    toast.error('Deck must have at least one valid card (front word/phrase).');
    activeStep.value = 2;
    return;
  }

  isSaving.value = true;
  try {
    const payload = {
      title: formData.value.title.trim(),
      description: formData.value.description.trim(),
      level: formData.value.levels[0] || 'all',
      levels: formData.value.levels,
      card_count: validCards.length,
      flashcards: validCards,
      is_published: editingDeck.value ? Boolean(editingDeck.value.is_published) : false,
    };

    if (editingDeck.value) {
      await apiPut(`/dashboard/flashcards/${editingDeck.value.id}`, payload);
      removeActivityCache(`tati_flashcard_deck_${editingDeck.value.id}`);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(`tati_flashcard_progress_${editingDeck.value.id}`);
      }
      toast.success('Deck updated successfully!');
    } else {
      await apiPost('/dashboard/flashcards', payload);
      toast.success('Deck created in drafts!');
    }
    isModalOpen.value = false;
    await loadDecks();
  } catch (err: any) {
    toast.error(err?.message || 'Error saving deck.');
  } finally {
    isSaving.value = false;
  }
}

async function handleTogglePublish(deck: FlashcardDeck) {
  try {
    await apiPut(`/dashboard/flashcards/${encodeURIComponent(deck.id)}`, { is_published: !deck.is_published });
    toast.success(deck.is_published ? 'Deck moved to drafts.' : 'Deck published!');
    await loadDecks();
  } catch {
    toast.error('Error changing deck status.');
  }
}

async function handleDelete(id: string) {
  if (!confirm('Are you sure you want to delete this deck?')) return;
  try {
    await apiDelete(`/dashboard/flashcards/${encodeURIComponent(id)}`);
    toast.success('Deck deleted.');
    await loadDecks();
  } catch {
    toast.error('Failed to delete deck.');
  }
}

function handleSelectAll() {
  if (selectedDeckIds.value.length === filteredDecks.value.length) {
    selectedDeckIds.value = [];
  } else {
    selectedDeckIds.value = filteredDecks.value.map((d) => d.id);
  }
}

function toggleSelect(id: string) {
  if (selectedDeckIds.value.includes(id)) {
    selectedDeckIds.value = selectedDeckIds.value.filter((i) => i !== id);
  } else {
    selectedDeckIds.value.push(id);
  }
}

async function handleBulkPublish(publish: boolean) {
  if (selectedDeckIds.value.length === 0) return;
  isBulkProcessing.value = true;
  const ids = [...selectedDeckIds.value];
  try {
    try {
      await apiPost('/dashboard/flashcards/bulk', {
        deck_ids: ids,
        action: publish ? 'publish' : 'draft',
        is_published: publish,
      });
    } catch {
      for (const id of ids) {
        await apiPut(`/dashboard/flashcards/${encodeURIComponent(id)}`, { is_published: publish });
      }
    }
    toast.success(publish ? `${ids.length} decks published!` : `${ids.length} decks moved to drafts.`);
    selectedDeckIds.value = [];
    await loadDecks();
  } catch {
    toast.error('Error updating decks in bulk.');
  } finally {
    isBulkProcessing.value = false;
  }
}

async function handleBulkDelete() {
  if (selectedDeckIds.value.length === 0) return;
  if (!confirm(`Delete ${selectedDeckIds.value.length} selected decks?`)) return;
  isBulkProcessing.value = true;
  const ids = [...selectedDeckIds.value];
  try {
    try {
      await apiPost('/dashboard/flashcards/bulk', {
        deck_ids: ids,
        action: 'delete',
      });
    } catch {
      for (const id of ids) {
        await apiDelete(`/dashboard/flashcards/${encodeURIComponent(id)}`);
      }
    }
    toast.success(`${ids.length} decks deleted.`);
    selectedDeckIds.value = [];
    await loadDecks();
  } catch {
    toast.error('Error deleting decks in bulk.');
  } finally {
    isBulkProcessing.value = false;
  }
}

function handlePlayDeck(deck: FlashcardDeck) {
  const fromUrl = encodeURIComponent('/dashboard?tab=flashcards');
  router.push(`/flashcards/${deck.id}?from=${fromUrl}`);
}

function handleDashboardUpdated(event: any) {
  const data = event?.detail || event;
  if (!data?.section || data.section === 'flashcards' || data.section === 'cefr') {
    loadDecks(true);
  }
}

onMounted(() => {
  loadDecks();
  window.addEventListener('dashboard_updated', handleDashboardUpdated);
  window.addEventListener('dashboard-updated', handleDashboardUpdated);
});

onUnmounted(() => {
  window.removeEventListener('dashboard_updated', handleDashboardUpdated);
  window.removeEventListener('dashboard-updated', handleDashboardUpdated);
});
</script>

<template>
  <div class="space-y-6 animate-fade-in text-text">
    <!-- Top Action Bar -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="flex items-center gap-3 flex-wrap">
        <h3 class="text-lg font-bold flex items-center gap-2">
          <Layers class="w-5 h-5 text-primary" />
          <span>Flashcard Decks (SRS)</span>
        </h3>

        <!-- Level Filter Dropdown -->
        <select
          v-model="filterLevel"
          class="bg-surface border border-border rounded-xl px-3 py-1.5 text-xs font-bold outline-none focus:border-primary/50 transition-all text-text"
        >
          <option v-for="opt in LEVEL_FILTER_OPTIONS" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>

        <!-- Select All button -->
        <button
          v-if="filteredDecks.length > 0"
          type="button"
          @click="handleSelectAll"
          class="flex items-center gap-1.5 text-xs font-bold text-text-muted hover:text-primary transition-all px-2.5 py-1.5 rounded-lg border border-border bg-surface cursor-pointer"
        >
          <CheckSquare v-if="selectedDeckIds.length === filteredDecks.length" class="w-4 h-4 text-primary" />
          <Square v-else class="w-4 h-4" />
          <span>
            {{ selectedDeckIds.length === filteredDecks.length ? 'Deselect All' : `Select All (${filteredDecks.length})` }}
          </span>
        </button>
      </div>

      <button
        type="button"
        @click="handleOpenNew"
        class="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow-glow hover:bg-primary-hover active:scale-95 transition-all cursor-pointer self-start sm:self-auto"
      >
        <Plus class="w-4 h-4" />
        <span>Create Deck</span>
      </button>
    </div>

    <!-- Bulk Action Bar -->
    <div
      v-if="selectedDeckIds.length > 0"
      class="bg-primary/10 border border-primary/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 animate-fade-in"
    >
      <div class="flex items-center gap-2">
        <span class="bg-primary text-white text-xs font-bold px-2.5 py-1 rounded-lg">
          {{ selectedDeckIds.length }} selected
        </span>
        <span class="text-xs text-text-muted">Bulk actions on selected study decks</span>
      </div>

      <div class="flex items-center gap-2">
        <button
          type="button"
          @click="handleBulkPublish(true)"
          :disabled="isBulkProcessing"
          class="px-3 py-1.5 rounded-xl bg-success/10 text-success border border-success/30 hover:bg-success/20 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
        >
          <Eye class="w-3.5 h-3.5" />
          <span>Publish</span>
        </button>
        <button
          type="button"
          @click="handleBulkPublish(false)"
          :disabled="isBulkProcessing"
          class="px-3 py-1.5 rounded-xl bg-warning/10 text-warning border border-warning/30 hover:bg-warning/20 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
        >
          <EyeOff class="w-3.5 h-3.5" />
          <span>Move to Drafts</span>
        </button>
        <button
          type="button"
          @click="handleBulkDelete"
          :disabled="isBulkProcessing"
          class="px-3 py-1.5 rounded-xl bg-danger/10 text-danger border border-danger/30 hover:bg-danger/20 text-xs font-bold flex items-center gap-1 cursor-pointer transition-all"
        >
          <Trash2 class="w-3.5 h-3.5" />
          <span>Delete</span>
        </button>
      </div>
    </div>

    <!-- Loading Skeletons -->
    <div v-if="isLoading" class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div v-for="i in 6" :key="i" class="h-44 bg-surface border border-border rounded-2xl animate-pulse" />
    </div>

    <!-- Empty State -->
    <div
      v-else-if="filteredDecks.length === 0"
      class="p-12 text-center bg-surface border border-border rounded-3xl space-y-3"
    >
      <div class="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
        <FileBox class="w-6 h-6" />
      </div>
      <h4 class="font-bold text-base text-text">No flashcard decks found</h4>
      <p class="text-xs text-text-muted max-w-sm mx-auto">
        Create your first vocabulary deck with AI or by manually entering cards.
      </p>
    </div>

    <!-- Decks Cards Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="deck in filteredDecks"
        :key="deck.id"
        class="bg-surface border border-border rounded-2xl p-5 flex flex-col justify-between group hover:border-primary/40 transition-all shadow-xs relative"
      >
        <div class="space-y-3">
          <!-- Card Header -->
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2">
              <button
                type="button"
                @click.stop="toggleSelect(deck.id)"
                class="cursor-pointer text-text-muted hover:text-primary transition-colors"
              >
                <CheckSquare v-if="selectedDeckIds.includes(deck.id)" class="w-4 h-4 text-primary" />
                <Square v-else class="w-4 h-4" />
              </button>
              <div class="flex items-center gap-1.5 flex-wrap">
                <span
                  v-for="lvl in (deck.levels || [deck.level || 'A1'])"
                  :key="lvl"
                  class="px-2 py-0.5 rounded-full text-[0.65rem] font-black uppercase tracking-wider bg-primary/10 text-primary"
                >
                  {{ lvl }}
                </span>
                <span
                  class="px-2 py-0.5 rounded-full text-[0.65rem] font-bold"
                  :class="deck.is_published !== false ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'"
                >
                  {{ deck.is_published !== false ? 'Published' : 'Draft' }}
                </span>
              </div>
            </div>

            <span class="text-xs font-bold text-text-muted">
              {{ deck.card_count ?? (deck.flashcards?.length || 0) }} cards
            </span>
          </div>

          <!-- Title & Description -->
          <div>
            <h4 class="font-bold text-sm text-text line-clamp-1 group-hover:text-primary transition-colors">
              {{ deck.title }}
            </h4>
            <p class="text-xs text-text-muted line-clamp-2 mt-1 leading-relaxed">
              {{ deck.description || 'Vocabulary SRS practice deck.' }}
            </p>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="flex items-center justify-between gap-2 pt-4 mt-4 border-t border-border">
          <button
            type="button"
            @click="handlePlayDeck(deck)"
            class="px-3 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Play class="w-3.5 h-3.5 fill-current" />
            <span>Study</span>
          </button>

          <div class="flex items-center gap-1">
            <button
              type="button"
              @click="handleTogglePublish(deck)"
              :title="deck.is_published !== false ? 'Unpublish to draft' : 'Publish to students'"
              class="p-1.5 rounded-lg border border-border text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <EyeOff v-if="deck.is_published !== false" class="w-4 h-4 text-warning" />
              <Eye v-else class="w-4 h-4 text-success" />
            </button>
            <button
              type="button"
              @click="handleOpenEdit(deck)"
              title="Edit deck & cards"
              class="p-1.5 rounded-lg border border-border text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <PenLine class="w-4 h-4 text-primary" />
            </button>
            <button
              type="button"
              @click="handleDelete(deck.id)"
              title="Delete deck"
              class="p-1.5 rounded-lg border border-border text-text-muted hover:text-danger hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <Trash2 class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- 2-STEP CREATE / EDIT MODAL -->
    <Teleport to="body">
      <div
        v-if="isModalOpen"
        class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
        @click.self="isModalOpen = false"
      >
        <div
          class="bg-surface border border-border rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
          @click.stop
        >
        <!-- Modal Top Header -->
        <div class="p-6 border-b border-border flex items-center justify-between">
          <div class="flex items-center gap-3">
            <div class="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
              <Layers class="w-5 h-5" />
            </div>
            <div>
              <h3 class="font-bold text-base text-text">
                {{ editingDeck ? 'Edit Flashcard Deck' : 'Create Flashcard Deck' }}
              </h3>
              <p class="text-xs text-text-muted">
                {{ activeStep === 1 ? 'Step 1: Deck Information & Levels' : `Step 2: Edit Cards (${formData.flashcards.length})` }}
              </p>
            </div>
          </div>

          <button
            type="button"
            @click="isModalOpen = false"
            class="p-2 rounded-xl text-text-muted hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Step Switcher Pill Indicator -->
        <div class="px-6 pt-4 pb-2 flex gap-3 border-b border-border/40 bg-bg-secondary/30">
          <button
            type="button"
            @click="activeStep = 1"
            class="px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
            :class="activeStep === 1 ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text'"
          >
            1. Deck Info
          </button>
          <button
            type="button"
            @click="activeStep = 2"
            class="px-4 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer"
            :class="activeStep === 2 ? 'bg-primary text-white shadow-xs' : 'text-text-muted hover:text-text'"
          >
            2. Cards Editor ({{ formData.flashcards.length }})
          </button>
        </div>

        <!-- Modal Body Content -->
        <div class="flex-1 overflow-y-auto p-6 space-y-6 custom-scrollbar">
          <!-- STEP 1: DECK INFO -->
          <div v-if="activeStep === 1" class="space-y-5">
            <div>
              <label class="block text-xs font-bold text-text mb-1.5">Deck Title *</label>
              <input
                v-model="formData.title"
                type="text"
                placeholder="e.g. Airport Transit & Border Control Vocabulary"
                class="w-full px-4 py-2.5 rounded-xl bg-bg border border-border text-xs text-text outline-none focus:border-primary transition-all font-medium"
              />
            </div>

            <div>
              <label class="block text-xs font-bold text-text mb-1.5">Description</label>
              <textarea
                v-model="formData.description"
                rows="2"
                placeholder="Brief pedagogical summary of words included in this deck..."
                class="w-full px-4 py-2.5 rounded-xl bg-bg border border-border text-xs text-text outline-none focus:border-primary transition-all font-medium custom-scrollbar"
              />
            </div>

            <!-- Target CEFR Levels Selector -->
            <div>
              <label class="block text-xs font-bold text-text mb-2">Target CEFR Levels (Select all that apply)</label>
              <div class="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                <button
                  v-for="meta in CEFR_LEVELS_METADATA"
                  :key="meta.code"
                  type="button"
                  @click="handleToggleLevel(meta.code)"
                  class="p-2.5 rounded-xl border text-left transition-all cursor-pointer flex items-center gap-2.5"
                  :class="
                    formData.levels.includes(meta.code)
                      ? 'bg-primary/10 border-primary ring-1 ring-primary/30 shadow-xs'
                      : 'bg-bg-secondary/40 border-border hover:border-primary/30'
                  "
                >
                  <div
                    class="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 font-black text-xs"
                    :class="[meta.bgColor, meta.color]"
                  >
                    {{ meta.code }}
                  </div>
                  <div class="min-w-0">
                    <p class="text-xs font-bold text-text leading-none">{{ meta.label }}</p>
                    <p class="text-[0.65rem] text-text-muted truncate mt-0.5">{{ meta.desc }}</p>
                  </div>
                </button>
              </div>
            </div>

            <!-- AI Generation Accordion / Banner -->
            <div class="p-4 rounded-2xl bg-primary/5 border border-primary/20 space-y-3">
              <div class="flex items-center justify-between">
                <div class="flex items-center gap-2">
                  <Sparkles class="w-4 h-4 text-primary" />
                  <span class="text-xs font-bold text-primary">Generate Deck with Teacher Tatiana AI</span>
                </div>
                <button
                  type="button"
                  @click="showAiGen = !showAiGen"
                  class="text-xs font-bold text-primary hover:underline cursor-pointer"
                >
                  {{ showAiGen ? 'Hide AI Generator' : 'Open AI Generator' }}
                </button>
              </div>

              <div v-if="showAiGen" class="space-y-3 pt-2 border-t border-primary/15 animate-in fade-in">
                <div>
                  <label class="block text-[0.7rem] font-bold text-text-muted mb-1">Theme / Scenario Prompt</label>
                  <input
                    v-model="formData.ai_theme"
                    type="text"
                    placeholder="e.g. Job interview questions, Dining out, Hotel reservation"
                    class="w-full px-3 py-2 rounded-xl bg-surface border border-border text-xs text-text outline-none focus:border-primary"
                  />
                </div>

                <div class="flex items-center gap-4 flex-wrap">
                  <div class="flex items-center gap-2">
                    <label class="text-[0.7rem] font-bold text-text-muted">Count:</label>
                    <input
                      v-model.number="formData.card_count"
                      type="number"
                      min="5"
                      max="50"
                      class="w-16 px-2 py-1 rounded-lg bg-surface border border-border text-xs text-center font-bold"
                    />
                  </div>

                  <span class="text-xs font-medium text-text-muted">
                    Word/phrase front + contextual image back
                  </span>

                  <button
                    type="button"
                    @click="handleGenerateAI"
                    :disabled="isGenerating"
                    class="ml-auto px-4 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Sparkles class="w-3.5 h-3.5" />
                    <span>{{ isGenerating ? 'Generating with AI...' : 'Generate Cards' }}</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- STEP 2: CARDS EDITOR -->
          <div v-else-if="activeStep === 2" class="space-y-4">
            <div class="flex items-center justify-between">
              <span class="text-xs font-bold text-text">Cards in this deck ({{ formData.flashcards.length }})</span>
              <button
                type="button"
                @click="handleAddCard"
                class="px-3 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold flex items-center gap-1 cursor-pointer transition-colors"
              >
                <Plus class="w-3.5 h-3.5" />
                <span>Add Card</span>
              </button>
            </div>

            <div class="space-y-3">
              <div
                v-for="(card, idx) in formData.flashcards"
                :key="idx"
                class="p-4 rounded-2xl bg-bg-secondary/40 border border-border space-y-3 relative group"
              >
                <div class="flex items-center justify-between">
                  <span class="text-[0.65rem] font-bold uppercase tracking-wider text-text-muted">
                    Card #{{ idx + 1 }}
                  </span>
                  <button
                    type="button"
                    @click="handleRemoveCard(idx)"
                    class="p-1 rounded-md text-text-muted hover:text-danger transition-colors cursor-pointer"
                  >
                    <Trash2 class="w-3.5 h-3.5" />
                  </button>
                </div>

                <div class="space-y-3">
                  <div>
                    <label class="block text-[0.65rem] font-bold text-success uppercase mb-1">
                      ✓ Correct Answer (Front — English Word / Phrase) *
                    </label>
                    <input
                      v-model="card.front"
                      type="text"
                      placeholder="e.g. Departure Gate"
                      @blur="handleCardFrontBlur(idx)"
                      class="w-full px-3 py-2 rounded-xl bg-surface border border-success/40 text-xs text-text outline-none focus:border-success font-semibold"
                    />
                  </div>

                  <!-- 3 Incorrect Options (Distractors) -->
                  <div v-if="card.distractors" class="p-3 rounded-xl bg-surface/60 border border-border/80 space-y-2">
                    <div class="flex items-center justify-between gap-2">
                      <label class="block text-[0.65rem] font-bold text-danger uppercase">
                        ✕ Incorrect Answers (3 Quiz Distractors — Edit or Replace AI Choices)
                      </label>
                      <button
                        type="button"
                        @click="handleRegenerateCardDistractors(idx)"
                        class="text-[0.65rem] font-bold text-primary hover:underline flex items-center gap-1 cursor-pointer"
                        title="Generate 3 different incorrect options"
                      >
                        <RotateCw class="w-3 h-3" />
                        <span>Swap AI Options</span>
                      </button>
                    </div>
                    <div class="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <input
                        v-model="card.distractors[0]"
                        type="text"
                        placeholder="Wrong answer 1"
                        class="w-full px-3 py-1.5 rounded-lg bg-bg border border-border text-xs text-text outline-none focus:border-primary"
                      />
                      <input
                        v-model="card.distractors[1]"
                        type="text"
                        placeholder="Wrong answer 2"
                        class="w-full px-3 py-1.5 rounded-lg bg-bg border border-border text-xs text-text outline-none focus:border-primary"
                      />
                      <input
                        v-model="card.distractors[2]"
                        type="text"
                        placeholder="Wrong answer 3"
                        class="w-full px-3 py-1.5 rounded-lg bg-bg border border-border text-xs text-text outline-none focus:border-primary"
                      />
                    </div>
                  </div>

                  <div>
                    <label class="block text-[0.65rem] font-bold text-text-muted uppercase mb-1">
                      Back (Image URL or Upload) (Optional)
                    </label>
                    <div class="flex items-center gap-3">
                      <ImageIcon class="w-4 h-4 text-text-subtle shrink-0" />
                      <input
                        v-model="card.image_url"
                        type="text"
                        placeholder="Image URL (https://...)"
                        class="flex-1 px-3 py-2 rounded-xl bg-surface border border-border text-xs text-text outline-none focus:border-primary"
                      />
                      <label class="px-3 py-2 rounded-xl border border-border bg-surface hover:bg-surface-hover text-text text-xs font-bold flex items-center gap-1.5 cursor-pointer shrink-0">
                        <Upload class="w-3.5 h-3.5" />
                        <span>Upload</span>
                        <input type="file" accept="image/*" class="hidden" @change="handleUploadCardImage(idx, $event)" />
                      </label>
                    </div>
                  </div>
                </div>

                <!-- Image Preview Thumbnail -->
                <div
                  v-if="card.image_url"
                  class="relative group mt-2 w-28 h-20 rounded-xl overflow-hidden border border-border bg-bg-secondary/40 flex items-center justify-center shrink-0 shadow-xs"
                >
                  <img
                    :src="card.image_url"
                    alt="Card preview"
                    class="w-full h-full object-cover"
                    @error="(e: any) => { e.currentTarget.style.display = 'none'; }"
                    referrerpolicy="no-referrer"
                  />
                  <button
                    type="button"
                    @click="card.image_url = ''"
                    title="Remove image"
                    class="absolute top-1 right-1 p-1 rounded-md bg-black/60 text-white hover:bg-danger transition-colors cursor-pointer"
                  >
                    <X class="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>

            <button
              type="button"
              @click="handleAddCard"
              class="w-full py-3 rounded-2xl border border-dashed border-border hover:border-primary text-text-muted hover:text-primary text-xs font-bold transition-all flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus class="w-4 h-4" />
              <span>Add Another Card</span>
            </button>
          </div>
        </div>

        <!-- Modal Bottom Actions -->
        <div class="p-4 px-6 border-t border-border flex items-center justify-between bg-surface">
          <div>
            <button
              v-if="activeStep === 2"
              type="button"
              @click="activeStep = 1"
              class="px-4 py-2 rounded-xl border border-border text-xs font-bold text-text hover:bg-surface-hover flex items-center gap-1.5 cursor-pointer"
            >
              <ChevronLeft class="w-4 h-4" />
              <span>Back to Info</span>
            </button>
          </div>

          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="isModalOpen = false"
              class="px-4 py-2 rounded-xl border border-border text-xs font-bold text-text hover:bg-surface-hover cursor-pointer"
            >
              Cancel
            </button>

            <button
              v-if="activeStep === 1"
              type="button"
              @click="activeStep = 2"
              class="px-5 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover shadow-xs flex items-center gap-1.5 cursor-pointer"
            >
              <span>Next: Edit Cards</span>
              <ChevronRight class="w-4 h-4" />
            </button>

            <button
              v-else
              type="button"
              @click="handleSaveDeck"
              :disabled="isSaving"
              class="px-6 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 class="w-4 h-4" />
              <span>{{ isSaving ? 'Saving Deck...' : 'Save Deck' }}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
  </div>
</template>
