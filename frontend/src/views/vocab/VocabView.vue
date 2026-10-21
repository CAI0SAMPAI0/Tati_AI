<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  BookOpen,
  Brain,
  CheckCircle2,
  Download,
  Edit2,
  GraduationCap,
  Save,
  Search,
  Sparkles,
  Trash2,
  Volume2,
  X,
} from 'lucide-vue-next';
import { apiGet, apiPut, apiDelete } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { useTTS } from '@/composables/useTTS';
import { useToast } from '@/composables/useToast';
import Button from '@/components/ui/Button.vue';

interface VocabWord {
  id: string;
  term: string;
  translation?: string;
  example?: string;
  status: 'new' | 'learning' | 'learned';
}

interface VocabResponse {
  words: VocabWord[];
  total: number;
}

const router = useRouter();
const toast = useToast();
const { speak } = useTTS();

const words = ref<VocabWord[]>([]);
const dueCount = ref(0);
const isLoading = ref(true);
const searchTerm = ref('');
const filter = ref<'all' | 'learning' | 'learned' | 'new'>('all');

const editingId = ref<string | null>(null);
const editForm = ref<{ translation: string; example: string }>({ translation: '', example: '' });

async function loadVocabData() {
  isLoading.value = true;
  try {
    const [res, dueRes] = await Promise.all([
      apiGet<VocabResponse>(ENDPOINTS.VOCABULARY).catch(() => ({ words: [], total: 0 })),
      apiGet<any[]>('/users/vocabulary/due').catch(() => []),
    ]);

    words.value = res?.words || [
      { id: '1', term: 'Accomplish', translation: 'Realizar / Conquistar', example: 'She accomplished her goal of speaking fluent English.', status: 'learned' },
      { id: '2', term: 'Breakthrough', translation: 'Avanço importante', example: 'Scientists announced a major breakthrough.', status: 'learning' },
      { id: '3', term: 'Convenient', translation: 'Prático / Conveniente', example: 'It is very convenient to practice with an AI teacher.', status: 'learned' },
      { id: '4', term: 'Essential', translation: 'Essencial / Fundamental', example: 'Consistency is essential for language acquisition.', status: 'new' },
    ];
    dueCount.value = dueRes?.length || 0;
  } catch (err) {
    console.error('Error loading vocab:', err);
  } finally {
    isLoading.value = false;
  }
}

const filteredWords = computed(() => {
  return words.value.filter((w) => {
    const matchesSearch =
      w.term.toLowerCase().includes(searchTerm.value.toLowerCase()) ||
      (w.translation || '').toLowerCase().includes(searchTerm.value.toLowerCase());
    const matchesFilter = filter.value === 'all' || w.status === filter.value;
    return matchesSearch && matchesFilter;
  });
});

const stats = computed(() => ({
  total: words.value.length,
  learned: words.value.filter((w) => w.status === 'learned').length,
  learning: words.value.filter((w) => w.status === 'learning' || w.status === 'new').length,
}));

function startEditing(w: VocabWord) {
  editingId.value = w.id;
  editForm.value = {
    translation: w.translation || '',
    example: w.example || '',
  };
}

async function saveEdit(w: VocabWord) {
  try {
    await apiPut(`${ENDPOINTS.VOCABULARY}/${w.id}`, {
      ...w,
      translation: editForm.value.translation,
      example: editForm.value.example,
    });
    w.translation = editForm.value.translation;
    w.example = editForm.value.example;
    editingId.value = null;
    toast.success('Word updated!');
  } catch {
    toast.error('Error updating word.');
  }
}

async function handleDelete(id: string) {
  if (!confirm('Delete this word from your vocabulary bank?')) return;
  try {
    await apiDelete(`${ENDPOINTS.VOCABULARY}/${id}`);
    words.value = words.value.filter((w) => w.id !== id);
    toast.success('Word removed.');
  } catch {
    toast.error('Error deleting word.');
  }
}

function handleExport() {
  const csvContent =
    'data:text/csv;charset=utf-8,' +
    'Term,Translation,Example,Status\n' +
    words.value
      .map(
        (w) =>
          `"${w.term}","${w.translation || ''}","${w.example || ''}","${w.status}"`
      )
      .join('\n');
  const encoded = encodeURI(csvContent);
  const link = document.createElement('a');
  link.setAttribute('href', encoded);
  link.setAttribute('download', 'teacher_tati_vocabulary.csv');
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

onMounted(() => {
  loadVocabData();
});
</script>

<template>
  <div class="max-w-5xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in text-xs sm:text-sm">
    <!-- Top Header -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h1 class="font-display text-2xl sm:text-3xl font-extrabold text-text">My Vocabulary Bank</h1>
        <p class="text-xs text-text-muted mt-0.5">
          Words and idiomatic expressions saved during your conversations and activities.
        </p>
      </div>

      <button
        type="button"
        @click="handleExport"
        class="px-4 py-2 rounded-xl border border-border bg-surface hover:bg-surface-hover font-bold text-xs text-text flex items-center gap-1.5 transition-colors self-start sm:self-auto shadow-xs"
      >
        <Download class="w-3.5 h-3.5 text-primary" />
        <span>Export CSV</span>
      </button>
    </div>

    <!-- SRS Prompt Banner -->
    <div
      v-if="dueCount > 0"
      class="bg-gradient-to-r from-primary/10 via-purple-500/10 to-primary/5 border border-primary/20 rounded-2xl p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 shadow-sm"
    >
      <div class="flex items-center gap-3">
        <div class="w-10 h-10 rounded-xl bg-primary text-white flex items-center justify-center shrink-0 shadow-glow">
          <Brain class="w-5 h-5" />
        </div>
        <div>
          <h3 class="font-bold text-sm text-text">Spaced Repetition Review Due</h3>
          <p class="text-xs text-text-muted">
            You have <strong class="text-primary">{{ dueCount }} words</strong> ready for daily review to lock them in long-term memory.
          </p>
        </div>
      </div>

      <Button size="sm" @click="router.push('/vocab/review')">
        <Sparkles class="w-3.5 h-3.5 mr-1.5" />
        <span>Start Review Session</span>
      </Button>
    </div>

    <!-- Stats Bar -->
    <div class="grid grid-cols-3 gap-3">
      <div class="bg-surface border border-border rounded-xl p-3.5 text-center">
        <span class="text-[0.65rem] font-bold uppercase text-text-subtle tracking-wider block">Total Words</span>
        <span class="text-lg font-extrabold text-text mt-0.5 block">{{ stats.total }}</span>
      </div>
      <div class="bg-surface border border-border rounded-xl p-3.5 text-center">
        <span class="text-[0.65rem] font-bold uppercase text-text-subtle tracking-wider block">Mastered</span>
        <span class="text-lg font-extrabold text-emerald-500 mt-0.5 block">{{ stats.learned }}</span>
      </div>
      <div class="bg-surface border border-border rounded-xl p-3.5 text-center">
        <span class="text-[0.65rem] font-bold uppercase text-text-subtle tracking-wider block">Learning</span>
        <span class="text-lg font-extrabold text-amber-500 mt-0.5 block">{{ stats.learning }}</span>
      </div>
    </div>

    <!-- Search & Filters -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div class="relative flex-1 max-w-sm">
        <Search class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-subtle" />
        <input
          v-model="searchTerm"
          type="text"
          placeholder="Search vocabulary words or translations..."
          class="w-full pl-9 pr-3 py-2 bg-surface border border-border rounded-xl text-xs text-text outline-none focus:border-primary"
        />
      </div>

      <div class="flex items-center gap-1.5 overflow-x-auto">
        <button
          v-for="st in ['all', 'learning', 'learned', 'new']"
          :key="st"
          type="button"
          @click="filter = st as any"
          class="px-3 py-1.5 rounded-xl text-xs font-bold capitalize transition-all"
          :class="
            filter === st
              ? 'bg-primary text-white shadow-xs'
              : 'bg-surface hover:bg-surface-hover border border-border text-text-muted hover:text-text'
          "
        >
          {{ st }}
        </button>
      </div>
    </div>

    <!-- Words Grid -->
    <div v-if="isLoading" class="py-16 flex justify-center">
      <div class="w-8 h-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
    </div>

    <div v-else-if="filteredWords.length === 0" class="py-16 text-center text-text-muted bg-surface/40 border border-dashed border-border rounded-2xl">
      No vocabulary words match your search.
    </div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div
        v-for="w in filteredWords"
        :key="w.id"
        class="bg-surface border border-border rounded-2xl p-5 shadow-xs space-y-3 hover:border-primary/40 transition-colors flex flex-col justify-between"
      >
        <div class="space-y-2">
          <!-- Word Title & Actions -->
          <div class="flex items-center justify-between">
            <div class="flex items-center gap-2">
              <h3 class="font-display font-bold text-base text-text">{{ w.term }}</h3>
              <button
                type="button"
                @click="speak(w.term)"
                class="p-1 rounded-lg text-primary hover:bg-primary/10 transition-colors"
                title="Hear pronunciation"
              >
                <Volume2 class="w-4 h-4" />
              </button>
            </div>

            <span
              class="px-2 py-0.5 rounded-full text-[0.6rem] font-bold uppercase tracking-wider"
              :class="
                w.status === 'learned'
                  ? 'bg-emerald-500/10 text-emerald-500 border border-emerald-500/20'
                  : 'bg-amber-500/10 text-amber-500 border border-amber-500/20'
              "
            >
              {{ w.status }}
            </span>
          </div>

          <!-- Edit Mode -->
          <div v-if="editingId === w.id" class="space-y-2 pt-2">
            <input
              v-model="editForm.translation"
              type="text"
              placeholder="Translation..."
              class="w-full p-2 bg-input border border-border rounded-lg text-xs text-text outline-none focus:border-primary"
            />
            <textarea
              v-model="editForm.example"
              rows="2"
              placeholder="Example sentence..."
              class="w-full p-2 bg-input border border-border rounded-lg text-xs text-text outline-none focus:border-primary resize-y"
            ></textarea>
            <div class="flex justify-end gap-1.5 pt-1">
              <button
                type="button"
                @click="editingId = null"
                class="px-2.5 py-1 text-xs text-text-muted hover:bg-surface-hover rounded-lg"
              >
                Cancel
              </button>
              <button
                type="button"
                @click="saveEdit(w)"
                class="px-3 py-1 text-xs font-bold bg-primary text-white rounded-lg hover:bg-primary-hover flex items-center gap-1"
              >
                <Save class="w-3 h-3" /> Save
              </button>
            </div>
          </div>

          <!-- Normal Display Mode -->
          <div v-else class="space-y-1">
            <p class="text-xs font-semibold text-primary">
              {{ w.translation || 'No translation added.' }}
            </p>
            <p v-if="w.example" class="text-xs text-text-muted italic leading-relaxed">
              "{{ w.example }}"
            </p>
          </div>
        </div>

        <!-- Footer Actions -->
        <div v-if="editingId !== w.id" class="flex items-center justify-end gap-1.5 pt-2 border-t border-border/70 text-text-subtle">
          <button
            type="button"
            @click="startEditing(w)"
            class="p-1 hover:text-primary transition-colors"
            title="Edit"
          >
            <Edit2 class="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            @click="handleDelete(w.id)"
            class="p-1 hover:text-danger transition-colors"
            title="Delete"
          >
            <Trash2 class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>
  </div>
</template>
