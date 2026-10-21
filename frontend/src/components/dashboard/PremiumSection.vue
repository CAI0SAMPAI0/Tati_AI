<script setup lang="ts">
import { ref, onMounted } from 'vue';
import {
  Plus,
  PenLine,
  Eye,
  EyeOff,
  Trash2,
  Zap,
  FileText,
  Video,
  UploadCloud,
  DollarSign,
  ShoppingBag,
  Users,
  Check,
  X,
} from 'lucide-vue-next';
import { apiGet, apiPost, apiPut, apiDelete, apiUpload } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { useToast } from '@/composables/useToast';
import DialogModal from '@/components/ui/DialogModal.vue';
import Button from '@/components/ui/Button.vue';
import Input from '@/components/ui/Input.vue';

interface PremiumContent {
  id: string;
  title: string;
  description: string;
  price?: number;
  price_students: number;
  price_buyers: number;
  type: 'pdf' | 'link' | 'article' | 'video';
  category?: string;
  content_source: string;
  thumbnail_url?: string;
  emoji?: string;
  is_active: boolean;
  created_at?: string;
}

const EMPTY_FORM: Partial<PremiumContent> = {
  title: '',
  description: '',
  price_students: 0,
  price_buyers: 0,
  type: 'pdf',
  category: 'books',
  content_source: '',
  thumbnail_url: '',
  emoji: '✨',
  is_active: true,
};

const toast = useToast();
const contents = ref<PremiumContent[]>([]);
const isLoading = ref(true);

const isModalOpen = ref(false);
const isSaving = ref(false);
const isUploading = ref(false);
const editingContent = ref<PremiumContent | null>(null);
const formData = ref<Partial<PremiumContent>>({ ...EMPTY_FORM });
const fileInputRef = ref<HTMLInputElement | null>(null);

async function loadContents() {
  isLoading.value = true;
  try {
    const data = await apiGet<PremiumContent[]>(ENDPOINTS.ADMIN_PREMIUM);
    contents.value = data || [];
  } catch (err) {
    console.error('Error fetching admin premium items:', err);
  } finally {
    isLoading.value = false;
  }
}

function openModal(item?: PremiumContent) {
  if (item) {
    editingContent.value = item;
    formData.value = { ...item };
  } else {
    editingContent.value = null;
    formData.value = { ...EMPTY_FORM };
  }
  isModalOpen.value = true;
}

async function handleFileUpload(e: Event) {
  const target = e.target as HTMLInputElement;
  const file = target.files?.[0];
  if (!file) return;

  isUploading.value = true;
  try {
    const form = new FormData();
    form.append('file', file);
    const res = await apiUpload<{ file_path: string }>(ENDPOINTS.ADMIN_PREMIUM_UPLOAD, form);
    if (res?.file_path) {
      formData.value.content_source = res.file_path;
      toast.success('File uploaded successfully!');
    }
  } catch {
    toast.error('Failed to upload file.');
  } finally {
    isUploading.value = false;
  }
}

async function handleSave() {
  if (!formData.value.title || !formData.value.content_source) {
    toast.error('Please enter a title and content source.');
    return;
  }

  isSaving.value = true;
  try {
    if (editingContent.value) {
      await apiPut(`${ENDPOINTS.ADMIN_PREMIUM}/${editingContent.value.id}`, formData.value);
      toast.success('Material updated successfully!');
    } else {
      await apiPost(ENDPOINTS.ADMIN_PREMIUM, formData.value);
      toast.success('Material created successfully!');
    }
    isModalOpen.value = false;
    loadContents();
  } catch {
    toast.error('Failed to save material.');
  } finally {
    isSaving.value = false;
  }
}

async function handleDelete(id: string) {
  if (!confirm('Are you sure you want to delete this material?')) return;
  try {
    await apiDelete(`${ENDPOINTS.ADMIN_PREMIUM}/${id}`);
    toast.success('Material deleted.');
    loadContents();
  } catch {
    toast.error('Failed to delete material.');
  }
}

async function handleToggleActive(item: PremiumContent) {
  try {
    await apiPut(`${ENDPOINTS.ADMIN_PREMIUM}/${item.id}`, {
      ...item,
      is_active: !item.is_active,
    });
    item.is_active = !item.is_active;
    toast.success(`Material is now ${item.is_active ? 'active' : 'hidden'}.`);
  } catch {
    toast.error('Failed to update visibility.');
  }
}

onMounted(() => {
  loadContents();
});
</script>

<template>
  <div class="space-y-6 animate-fade-in text-xs">
    <!-- Header row -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div>
        <h3 class="font-bold text-text text-base">Taty's Materials Store & Digital Products</h3>
        <p class="text-xs text-text-muted mt-0.5">
          Manage digital catalog, student and buyer pricing, protected PDFs and download packages.
        </p>
      </div>

      <Button size="sm" @click="openModal()">
        <Plus class="w-4 h-4 mr-1.5" />
        <span>Add Material</span>
      </Button>
    </div>

    <!-- Loading State -->
    <div v-if="isLoading" class="py-16 flex justify-center">
      <div class="w-8 h-8 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
    </div>

    <!-- Items Grid / Table -->
    <div v-else-if="contents.length === 0" class="p-12 text-center bg-surface border border-dashed border-border rounded-2xl">
      <Zap class="w-10 h-10 text-primary/30 mx-auto mb-3" />
      <p class="font-bold text-text">No digital materials registered yet.</p>
      <p class="text-xs text-text-muted mt-1">Click "Add Material" to create your first digital book or activity.</p>
    </div>

    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="item in contents"
        :key="item.id"
        class="bg-surface border border-border rounded-2xl p-5 space-y-4 hover:border-primary/40 transition-all flex flex-col justify-between"
      >
        <div class="space-y-3">
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2 min-w-0">
              <span class="text-2xl shrink-0">{{ item.emoji || '📘' }}</span>
              <div class="min-w-0">
                <h4 class="font-bold text-sm text-text truncate">{{ item.title }}</h4>
                <span class="text-[0.65rem] font-bold text-primary uppercase tracking-wider block">
                  {{ item.category || item.type }}
                </span>
              </div>
            </div>

            <button
              type="button"
              @click="handleToggleActive(item)"
              class="p-1.5 rounded-lg border border-border hover:bg-surface-hover text-text-muted transition-colors shrink-0"
              :title="item.is_active ? 'Visible to students' : 'Hidden'"
            >
              <Eye v-if="item.is_active" class="w-4 h-4 text-emerald-500" />
              <EyeOff v-else class="w-4 h-4 text-text-subtle" />
            </button>
          </div>

          <p class="text-xs text-text-muted line-clamp-2 leading-relaxed">
            {{ item.description || 'No description provided.' }}
          </p>

          <!-- Dual Price Chips -->
          <div class="grid grid-cols-2 gap-2 pt-2 border-t border-border/80">
            <div class="p-2 rounded-xl bg-primary/5 border border-primary/10">
              <span class="text-[0.6rem] font-bold text-primary uppercase block">Student Price</span>
              <span class="text-xs font-extrabold text-text">
                {{ item.price_students > 0 ? `R$ ${item.price_students.toFixed(2)}` : 'Free (Grátis)' }}
              </span>
            </div>
            <div class="p-2 rounded-xl bg-success/5 border border-success/10">
              <span class="text-[0.6rem] font-bold text-success uppercase block">Buyer Price</span>
              <span class="text-xs font-extrabold text-text">
                {{ item.price_buyers > 0 ? `R$ ${item.price_buyers.toFixed(2)}` : 'Free' }}
              </span>
            </div>
          </div>
        </div>

        <!-- Action Row -->
        <div class="flex items-center justify-end gap-2 pt-3 border-t border-border">
          <button
            type="button"
            @click="openModal(item)"
            class="px-3 py-1.5 rounded-lg border border-border hover:bg-surface-hover font-bold text-xs text-text flex items-center gap-1.5 transition-colors"
          >
            <PenLine class="w-3.5 h-3.5" />
            <span>Edit</span>
          </button>
          <button
            type="button"
            @click="handleDelete(item.id)"
            class="p-1.5 rounded-lg border border-danger/20 text-danger hover:bg-danger/10 transition-colors"
          >
            <Trash2 class="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </div>

    <!-- Add / Edit Modal -->
    <DialogModal
      :is-open="isModalOpen"
      :title="editingContent ? 'Edit Digital Material' : 'Add New Digital Material'"
      @close="isModalOpen = false"
    >
      <form @submit.prevent="handleSave" class="space-y-4">
        <div class="grid grid-cols-4 gap-3">
          <div class="col-span-3">
            <Input v-model="formData.title" label="Title" placeholder="e.g. English Grammar in Use Vol 1" required />
          </div>
          <div>
            <Input v-model="formData.emoji" label="Emoji" placeholder="📘" />
          </div>
        </div>

        <div>
          <label class="text-xs font-bold text-text-muted block mb-1.5">Description</label>
          <textarea
            v-model="formData.description"
            rows="2"
            placeholder="Detailed description of the material..."
            class="w-full p-2.5 bg-input border border-border rounded-xl text-xs text-text outline-none focus:border-primary transition-all resize-y"
          ></textarea>
        </div>

        <div class="grid grid-cols-2 gap-3">
          <div>
            <label class="text-xs font-bold text-text-muted block mb-1.5">Category</label>
            <select
              v-model="formData.category"
              class="w-full p-2.5 bg-input border border-border rounded-xl text-xs text-text outline-none focus:border-primary cursor-pointer"
            >
              <option value="books">Books & E-books</option>
              <option value="activities">Activities & Worksheets</option>
              <option value="games">Interactive Games</option>
              <option value="other">Other Materials</option>
            </select>
          </div>
          <div>
            <label class="text-xs font-bold text-text-muted block mb-1.5">Format Type</label>
            <select
              v-model="formData.type"
              class="w-full p-2.5 bg-input border border-border rounded-xl text-xs text-text outline-none focus:border-primary cursor-pointer"
            >
              <option value="pdf">Protected PDF</option>
              <option value="video">Video</option>
              <option value="article">Article</option>
              <option value="link">External Link</option>
            </select>
          </div>
        </div>

        <!-- Dual Pricing Inputs -->
        <div class="grid grid-cols-2 gap-3">
          <Input
            v-model.number="formData.price_students"
            type="number"
            step="0.01"
            label="Price for Students (R$)"
            placeholder="0.00"
          />
          <Input
            v-model.number="formData.price_buyers"
            type="number"
            step="0.01"
            label="Price for Buyers (R$)"
            placeholder="29.90"
          />
        </div>

        <!-- File Upload / Content Source -->
        <div class="space-y-1.5">
          <label class="text-xs font-bold text-text-muted block">Content Source / File Path</label>
          <div class="flex gap-2">
            <input
              v-model="formData.content_source"
              type="text"
              placeholder="/media/materials/book.pdf or URL"
              class="flex-1 p-2.5 bg-input border border-border rounded-xl text-xs text-text outline-none focus:border-primary"
            />
            <button
              type="button"
              @click="fileInputRef?.click()"
              class="px-3 py-2 bg-surface hover:bg-surface-hover border border-border rounded-xl text-xs font-bold flex items-center gap-1.5"
            >
              <UploadCloud class="w-4 h-4 text-primary" />
              <span>Upload</span>
            </button>
            <input
              ref="fileInputRef"
              type="file"
              accept=".pdf,.zip,.mp4"
              class="hidden"
              @change="handleFileUpload"
            />
          </div>
        </div>

        <div class="flex items-center gap-2 pt-2">
          <input
            v-model="formData.is_active"
            type="checkbox"
            id="is_active_cb"
            class="rounded border-border text-primary focus:ring-primary"
          />
          <label for="is_active_cb" class="text-xs font-bold text-text cursor-pointer">
            Publish and make visible in catalog
          </label>
        </div>

        <!-- Modal Actions -->
        <div class="flex justify-end gap-2 pt-4 border-t border-border">
          <Button variant="secondary" @click="isModalOpen = false">Cancel</Button>
          <Button type="submit" :loading="isSaving">Save Material</Button>
        </div>
      </form>
    </DialogModal>
  </div>
</template>
