<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import {
  Newspaper,
  Plus,
  Trash2,
  PenLine,
  Eye,
  EyeOff,
  ExternalLink,
  CheckSquare,
  Square,
  CheckCircle2,
  X,
  FileBox,
  Image as ImageIcon,
} from 'lucide-vue-next';
import { apiGet, apiPost, apiPut, apiDelete } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { LEVEL_FILTER_OPTIONS, normalizeLevel } from '@/constants/levels';
import { useToast } from '@/composables/useToast';
import { useBodyScrollLock } from '@/composables/useBodyScrollLock';

interface NewsRow {
  id: string;
  title: string;
  url: string;
  description: string;
  levels: string[];
  thumbnail_url?: string | null;
  is_published: boolean;
  created_at?: string;
}

const CEFR_LEVELS_LIST = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const toast = useToast();

const news = ref<NewsRow[]>([]);
const isLoading = ref(true);
const filterLevel = ref('all');
const selectedNewsIds = ref<string[]>([]);
const isBulkProcessing = ref(false);

const isModalOpen = ref(false);
useBodyScrollLock(isModalOpen);
const editingNews = ref<NewsRow | null>(null);
const isSaving = ref(false);

const formData = ref<{
  title: string;
  description: string;
  url: string;
  thumbnail_url?: string;
  levels: string[];
  is_published: boolean;
}>({
  title: '',
  description: '',
  url: '',
  thumbnail_url: '',
  levels: [],
  is_published: true,
});

const filteredNews = computed(() => {
  return news.value.filter((n) => {
    if (filterLevel.value === 'all') return true;
    const nLevels = (n.levels || []).map((l) => normalizeLevel(l));
    return nLevels.includes(normalizeLevel(filterLevel.value));
  });
});

async function loadNews() {
  isLoading.value = true;
  try {
    const res = await apiGet<any>(ENDPOINTS.ADMIN_NEWS || '/dashboard/news');
    news.value = Array.isArray(res) ? res : res?.data || res?.news || [];
  } catch (err) {
    console.error('Error loading news:', err);
  } finally {
    isLoading.value = false;
  }
}

function handleOpenNew() {
  editingNews.value = null;
  formData.value = {
    title: '',
    description: '',
    url: '',
    thumbnail_url: '',
    levels: ['B1'],
    is_published: true,
  };
  isModalOpen.value = true;
}

function handleOpenEdit(item: NewsRow) {
  editingNews.value = item;
  formData.value = {
    title: item.title,
    description: item.description || '',
    url: item.url || '',
    thumbnail_url: item.thumbnail_url || '',
    levels: [...(item.levels || ['B1'])],
    is_published: item.is_published ?? true,
  };
  isModalOpen.value = true;
}

function toggleLevel(lvl: string) {
  const current = formData.value.levels.map((l) => l.toUpperCase());
  const target = lvl.toUpperCase();
  if (current.includes(target)) {
    formData.value.levels = formData.value.levels.filter((l) => l.toUpperCase() !== target);
  } else {
    formData.value.levels.push(lvl);
  }
}

async function handleSave() {
  if (!formData.value.title.trim() || !formData.value.url.trim()) {
    toast.error('Title and Article URL are required.');
    return;
  }
  isSaving.value = true;
  try {
    const payload = {
      title: formData.value.title.trim(),
      description: formData.value.description.trim(),
      url: formData.value.url.trim(),
      thumbnail_url: formData.value.thumbnail_url?.trim() || null,
      levels: formData.value.levels,
      is_published: formData.value.is_published,
    };

    if (editingNews.value) {
      await apiPut(`${ENDPOINTS.ADMIN_NEWS || '/dashboard/news'}/${editingNews.value.id}`, payload);
      toast.success('News article updated successfully!');
    } else {
      await apiPost(ENDPOINTS.ADMIN_NEWS || '/dashboard/news', payload);
      toast.success('News article published successfully!');
    }
    isModalOpen.value = false;
    await loadNews();
  } catch (err: any) {
    toast.error(err?.message || 'Error saving news.');
  } finally {
    isSaving.value = false;
  }
}

async function handleTogglePublish(item: NewsRow) {
  try {
    await apiPut(`${ENDPOINTS.ADMIN_NEWS || '/dashboard/news'}/${item.id}`, {
      is_published: !item.is_published,
    });
    toast.success(item.is_published ? 'Article moved to drafts.' : 'Article published!');
    await loadNews();
  } catch {
    toast.error('Error changing article status.');
  }
}

async function handleDelete(id: string) {
  if (!confirm('Are you sure you want to delete this article?')) return;
  try {
    await apiDelete(`${ENDPOINTS.ADMIN_NEWS || '/dashboard/news'}/${id}`);
    toast.success('Article deleted.');
    await loadNews();
  } catch {
    toast.error('Error deleting article.');
  }
}

function handleSelectAll() {
  if (selectedNewsIds.value.length === filteredNews.value.length) {
    selectedNewsIds.value = [];
  } else {
    selectedNewsIds.value = filteredNews.value.map((n) => n.id);
  }
}

function toggleSelect(id: string) {
  if (selectedNewsIds.value.includes(id)) {
    selectedNewsIds.value = selectedNewsIds.value.filter((i) => i !== id);
  } else {
    selectedNewsIds.value.push(id);
  }
}

async function handleBulkPublish(publish: boolean) {
  if (selectedNewsIds.value.length === 0) return;
  isBulkProcessing.value = true;
  try {
    await Promise.all(
      selectedNewsIds.value.map((id) =>
        apiPut(`${ENDPOINTS.ADMIN_NEWS || '/dashboard/news'}/${id}`, { is_published: publish })
      )
    );
    toast.success(publish ? `${selectedNewsIds.value.length} articles published!` : `${selectedNewsIds.value.length} articles moved to drafts.`);
    selectedNewsIds.value = [];
    await loadNews();
  } catch {
    toast.error('Error updating articles.');
  } finally {
    isBulkProcessing.value = false;
  }
}

async function handleBulkDelete() {
  if (selectedNewsIds.value.length === 0) return;
  if (!confirm(`Delete ${selectedNewsIds.value.length} selected articles?`)) return;
  isBulkProcessing.value = true;
  try {
    await Promise.all(
      selectedNewsIds.value.map((id) => apiDelete(`${ENDPOINTS.ADMIN_NEWS || '/dashboard/news'}/${id}`))
    );
    toast.success(`${selectedNewsIds.value.length} articles deleted.`);
    selectedNewsIds.value = [];
    await loadNews();
  } catch {
    toast.error('Error deleting articles.');
  } finally {
    isBulkProcessing.value = false;
  }
}

onMounted(() => {
  loadNews();
});
</script>

<template>
  <div class="space-y-6 animate-fade-in text-text">
    <!-- Top Action Bar -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="flex items-center gap-3 flex-wrap">
        <h3 class="text-lg font-bold flex items-center gap-2">
          <Newspaper class="w-5 h-5 text-primary" />
          <span>Curated News & Reading Materials</span>
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
          v-if="filteredNews.length > 0"
          type="button"
          @click="handleSelectAll"
          class="flex items-center gap-1.5 text-xs font-bold text-text-muted hover:text-primary transition-all px-2.5 py-1.5 rounded-lg border border-border bg-surface cursor-pointer"
        >
          <CheckSquare v-if="selectedNewsIds.length === filteredNews.length" class="w-4 h-4 text-primary" />
          <Square v-else class="w-4 h-4" />
          <span>
            {{ selectedNewsIds.length === filteredNews.length ? 'Deselect All' : `Select All (${filteredNews.length})` }}
          </span>
        </button>
      </div>

      <button
        type="button"
        @click="handleOpenNew"
        class="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow-glow hover:bg-primary-hover active:scale-95 transition-all cursor-pointer self-start sm:self-auto"
      >
        <Plus class="w-4 h-4" />
        <span>Add Article</span>
      </button>
    </div>

    <!-- Bulk Action Bar -->
    <div
      v-if="selectedNewsIds.length > 0"
      class="bg-primary/10 border border-primary/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 animate-fade-in"
    >
      <div class="flex items-center gap-2">
        <span class="bg-primary text-white text-xs font-bold px-2.5 py-1 rounded-lg">
          {{ selectedNewsIds.length }} selected
        </span>
        <span class="text-xs text-text-muted">Bulk actions on curated articles</span>
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
      v-else-if="filteredNews.length === 0"
      class="p-12 text-center bg-surface border border-border rounded-3xl space-y-3"
    >
      <div class="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
        <FileBox class="w-6 h-6" />
      </div>
      <h4 class="font-bold text-base text-text">No articles found</h4>
      <p class="text-xs text-text-muted max-w-sm mx-auto">
        Add interesting news, podcast episodes, or articles for your students to read.
      </p>
    </div>

    <!-- News Cards Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="item in filteredNews"
        :key="item.id"
        class="bg-surface border border-border rounded-2xl p-5 flex flex-col justify-between group hover:border-primary/40 transition-all shadow-xs relative"
      >
        <div class="space-y-3">
          <!-- Card Header -->
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2">
              <button
                type="button"
                @click.stop="toggleSelect(item.id)"
                class="cursor-pointer text-text-muted hover:text-primary transition-colors"
              >
                <CheckSquare v-if="selectedNewsIds.includes(item.id)" class="w-4 h-4 text-primary" />
                <Square v-else class="w-4 h-4" />
              </button>
              <div class="flex items-center gap-1.5 flex-wrap">
                <span
                  v-for="lvl in (item.levels || ['All'])"
                  :key="lvl"
                  class="px-2 py-0.5 rounded-full text-[0.65rem] font-black uppercase tracking-wider bg-primary/10 text-primary"
                >
                  {{ lvl }}
                </span>
              </div>
            </div>

            <span
              class="px-2 py-0.5 rounded-full text-[0.65rem] font-bold"
              :class="item.is_published !== false ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'"
            >
              {{ item.is_published !== false ? 'Published' : 'Draft' }}
            </span>
          </div>

          <!-- Thumbnail preview if present -->
          <div v-if="item.thumbnail_url" class="h-28 w-full rounded-xl overflow-hidden bg-bg-secondary">
            <img :src="item.thumbnail_url" alt="" class="w-full h-full object-cover" />
          </div>

          <!-- Title & Description -->
          <div>
            <h4 class="font-bold text-sm text-text line-clamp-1 group-hover:text-primary transition-colors">
              {{ item.title }}
            </h4>
            <p class="text-xs text-text-muted line-clamp-2 mt-1 leading-relaxed">
              {{ item.description || 'Authentic reading material for English practice.' }}
            </p>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="flex items-center justify-between gap-2 pt-4 mt-4 border-t border-border">
          <a
            :href="item.url"
            target="_blank"
            rel="noopener noreferrer"
            class="px-3 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <ExternalLink class="w-3.5 h-3.5" />
            <span>Read Article</span>
          </a>

          <div class="flex items-center gap-1">
            <button
              type="button"
              @click="handleTogglePublish(item)"
              :title="item.is_published !== false ? 'Unpublish to draft' : 'Publish to students'"
              class="p-1.5 rounded-lg border border-border text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <EyeOff v-if="item.is_published !== false" class="w-4 h-4 text-warning" />
              <Eye v-else class="w-4 h-4 text-success" />
            </button>
            <button
              type="button"
              @click="handleOpenEdit(item)"
              title="Edit article"
              class="p-1.5 rounded-lg border border-border text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <PenLine class="w-4 h-4 text-primary" />
            </button>
            <button
              type="button"
              @click="handleDelete(item.id)"
              title="Delete article"
              class="p-1.5 rounded-lg border border-border text-text-muted hover:text-danger hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <Trash2 class="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </div>

    <!-- CREATE / EDIT MODAL -->
    <Teleport to="body">
      <div
        v-if="isModalOpen"
        class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
        @click.self="isModalOpen = false"
      >
        <div
          class="bg-surface border border-border rounded-3xl w-full max-w-xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
          @click.stop
        >
          <!-- Modal Top Header -->
          <div class="p-6 border-b border-border flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <Newspaper class="w-5 h-5" />
              </div>
              <div>
                <h3 class="font-bold text-base text-text">
                  {{ editingNews ? 'Edit News Article' : 'Publish News Article' }}
                </h3>
                <p class="text-xs text-text-muted">Curate authentic English reading content</p>
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

          <!-- Modal Body Content -->
          <div class="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
            <div>
              <label class="block text-xs font-bold text-text mb-1.5">Article Headline *</label>
              <input
                v-model="formData.title"
                type="text"
                placeholder="e.g. Breakthroughs in AI Technology & Future of Work"
                class="w-full px-4 py-2.5 rounded-xl bg-bg border border-border text-xs text-text outline-none focus:border-primary transition-all font-medium"
              />
            </div>

            <div>
              <label class="block text-xs font-bold text-text mb-1.5">Summary / Reading Guide</label>
              <textarea
                v-model="formData.description"
                rows="2"
                placeholder="Key takeaways and vocabulary to look out for while reading..."
                class="w-full px-4 py-2.5 rounded-xl bg-bg border border-border text-xs text-text outline-none focus:border-primary transition-all font-medium custom-scrollbar"
              />
            </div>

            <div>
              <label class="block text-xs font-bold text-text mb-1.5">Article Link URL *</label>
              <input
                v-model="formData.url"
                type="url"
                placeholder="https://bbc.com/news/... or https://theverge.com/..."
                class="w-full px-4 py-2.5 rounded-xl bg-bg border border-border text-xs text-text outline-none focus:border-primary transition-all font-mono"
              />
            </div>

            <div>
              <label class="block text-xs font-bold text-text mb-1.5">Thumbnail Image URL (Optional)</label>
              <input
                v-model="formData.thumbnail_url"
                type="url"
                placeholder="https://images.unsplash.com/... or article image"
                class="w-full px-4 py-2.5 rounded-xl bg-bg border border-border text-xs text-text outline-none focus:border-primary transition-all font-mono"
              />
            </div>

            <!-- Target CEFR Levels Selector -->
            <div>
              <label class="block text-xs font-bold text-text mb-2">Target CEFR Levels (Multi-select)</label>
              <div class="flex items-center gap-2 flex-wrap">
                <button
                  v-for="lvl in CEFR_LEVELS_LIST"
                  :key="lvl"
                  type="button"
                  @click="toggleLevel(lvl)"
                  class="px-3 py-1.5 rounded-xl text-xs font-bold border transition-all cursor-pointer"
                  :class="
                    formData.levels.includes(lvl)
                      ? 'bg-primary text-white border-primary shadow-xs'
                      : 'bg-bg-secondary/40 border-border text-text-muted hover:border-primary/40'
                  "
                >
                  {{ lvl }}
                </button>
              </div>
            </div>

            <label class="flex items-center gap-2.5 text-xs font-bold text-text cursor-pointer pt-2">
              <input v-model="formData.is_published" type="checkbox" class="rounded accent-primary w-4 h-4" />
              <span>Publish immediately to students Hub</span>
            </label>
          </div>

          <!-- Modal Bottom Actions -->
          <div class="p-4 px-6 border-t border-border flex items-center justify-end gap-2 bg-surface">
            <button
              type="button"
              @click="isModalOpen = false"
              class="px-4 py-2 rounded-xl border border-border text-xs font-bold text-text hover:bg-surface-hover cursor-pointer"
            >
              Cancel
            </button>

            <button
              type="button"
              @click="handleSave"
              :disabled="isSaving"
              class="px-6 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover shadow-xs flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
            >
              <CheckCircle2 class="w-4 h-4" />
              <span>{{ isSaving ? 'Saving...' : 'Save Article' }}</span>
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
