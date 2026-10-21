<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  Clapperboard,
  Plus,
  Trash2,
  PenLine,
  Play,
  Eye,
  EyeOff,
  Sparkles,
  CheckSquare,
  Square,
  CheckCircle2,
  X,
  FileBox,
} from 'lucide-vue-next';
import { apiGet, apiPost, apiPut, apiDelete } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { LEVEL_FILTER_OPTIONS, normalizeLevel } from '@/constants/levels';
import { useToast } from '@/composables/useToast';
import { useBodyScrollLock } from '@/composables/useBodyScrollLock';

interface SimulationRow {
  id: string;
  name: string;
  description: string;
  difficulty: string;
  levels?: string[];
  is_published: boolean;
  system_prompt?: string;
  emoji?: string;
}

const CEFR_LEVELS_LIST = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const EMOJIS = ['🎭', '✈️', '☕', '💼', '🏥', '🏨', '🛍️', '🎓', '🍕', '🚗'];

const router = useRouter();
const toast = useToast();

const simulations = ref<SimulationRow[]>([]);
const isLoading = ref(true);
const filterLevel = ref('all');
const selectedSimIds = ref<string[]>([]);
const isBulkProcessing = ref(false);

const isModalOpen = ref(false);
useBodyScrollLock(isModalOpen);
const editingSim = ref<SimulationRow | null>(null);
const isSaving = ref(false);
const isGenerating = ref(false);

const formData = ref<{
  name: string;
  description: string;
  difficulty: string;
  levels: string[];
  system_prompt: string;
  emoji: string;
  is_published: boolean;
}>({
  name: '',
  description: '',
  difficulty: 'all',
  levels: [],
  system_prompt: '',
  emoji: '🎭',
  is_published: true,
});

const filteredSimulations = computed(() => {
  return simulations.value.filter((s) => {
    if (filterLevel.value === 'all') return true;
    const simLevels = (s.levels || (s.difficulty ? [s.difficulty] : [])).map((l) => normalizeLevel(l));
    return simLevels.includes(normalizeLevel(filterLevel.value));
  });
});

async function loadSimulations() {
  isLoading.value = true;
  try {
    const res = await apiGet<any>(ENDPOINTS.ADMIN_SIMULATIONS || '/dashboard/simulations');
    simulations.value = Array.isArray(res) ? res : res?.simulations || res?.data || [];
  } catch (err) {
    console.error('Error loading simulations:', err);
  } finally {
    isLoading.value = false;
  }
}

function handleOpenNew() {
  editingSim.value = null;
  formData.value = {
    name: '',
    description: '',
    difficulty: 'B1',
    levels: ['B1'],
    system_prompt: '',
    emoji: '🎭',
    is_published: true,
  };
  isModalOpen.value = true;
}

function handleOpenEdit(sim: SimulationRow) {
  editingSim.value = sim;
  formData.value = {
    name: sim.name,
    description: sim.description || '',
    difficulty: sim.difficulty || 'all',
    levels: sim.levels || (sim.difficulty ? [sim.difficulty] : ['B1']),
    system_prompt: sim.system_prompt || '',
    emoji: sim.emoji || '🎭',
    is_published: sim.is_published ?? true,
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

async function handleGenerateWithAI() {
  if (!formData.value.name.trim()) {
    toast.error('Please enter a scenario topic/name first.');
    return;
  }
  isGenerating.value = true;
  try {
    const res = await apiPost<any>(ENDPOINTS.ADMIN_SIMULATIONS || '/dashboard/simulations', {
      name: formData.value.name,
      description: formData.value.description,
      difficulty: formData.value.difficulty,
      levels: formData.value.levels,
      use_ai_generation: true,
      is_ai_generated: true,
    });
    toast.success('Simulation scenario generated with AI! 🎉');
    isModalOpen.value = false;
    await loadSimulations();
  } catch (err: any) {
    toast.error(err?.message || 'Error generating simulation with AI.');
  } finally {
    isGenerating.value = false;
  }
}

async function handleSave() {
  if (!formData.value.name.trim()) {
    toast.error('Please provide a simulation name.');
    return;
  }
  isSaving.value = true;
  try {
    const payload = {
      name: formData.value.name.trim(),
      description: formData.value.description.trim(),
      levels: formData.value.levels,
      difficulty: formData.value.levels[0] || 'all',
      system_prompt: formData.value.system_prompt.trim(),
      emoji: formData.value.emoji || '🎭',
      is_published: formData.value.is_published,
    };

    if (editingSim.value) {
      await apiPut(`${ENDPOINTS.ADMIN_SIMULATIONS || '/dashboard/simulations'}/${editingSim.value.id}`, payload);
      toast.success('Simulation updated!');
    } else {
      await apiPost(ENDPOINTS.ADMIN_SIMULATIONS || '/dashboard/simulations', payload);
      toast.success('Simulation created!');
    }
    isModalOpen.value = false;
    await loadSimulations();
  } catch (err: any) {
    toast.error(err?.message || 'Error saving simulation.');
  } finally {
    isSaving.value = false;
  }
}

async function handleStartSimulation(sim: SimulationRow) {
  try {
    toast.info('Starting simulation scenario...');
    const res = await apiPost<any>(ENDPOINTS.CONVERSATIONS, {
      title: `Simulation: ${sim.name}`,
      is_simulation: true,
      simulation_id: sim.id,
      system_prompt: sim.system_prompt,
    });
    const convId = (res as any)?.id || (res as any)?.data?.id;
    if (convId) {
      router.push(`/voice?conv_id=${convId}&simulation_id=${sim.id}`);
    } else {
      router.push(`/voice?simulation_id=${sim.id}`);
    }
  } catch (err) {
    console.error('Error starting simulation:', err);
    router.push(`/voice?simulation_id=${sim.id}`);
  }
}

async function handleTogglePublish(sim: SimulationRow) {
  try {
    await apiPut(`${ENDPOINTS.ADMIN_SIMULATIONS || '/dashboard/simulations'}/${sim.id}`, {
      is_published: !sim.is_published,
    });
    toast.success(sim.is_published ? 'Moved to drafts.' : 'Published to students!');
    await loadSimulations();
  } catch {
    toast.error('Error updating status.');
  }
}

async function handleDelete(id: string) {
  if (!confirm('Are you sure you want to delete this simulation?')) return;
  try {
    await apiDelete(`${ENDPOINTS.ADMIN_SIMULATIONS || '/dashboard/simulations'}/${id}`);
    toast.success('Simulation deleted.');
    await loadSimulations();
  } catch {
    toast.error('Error deleting simulation.');
  }
}

function handleSelectAll() {
  if (selectedSimIds.value.length === filteredSimulations.value.length) {
    selectedSimIds.value = [];
  } else {
    selectedSimIds.value = filteredSimulations.value.map((s) => s.id);
  }
}

function toggleSelect(id: string) {
  if (selectedSimIds.value.includes(id)) {
    selectedSimIds.value = selectedSimIds.value.filter((i) => i !== id);
  } else {
    selectedSimIds.value.push(id);
  }
}

async function handleBulkPublish(publish: boolean) {
  if (selectedSimIds.value.length === 0) return;
  isBulkProcessing.value = true;
  try {
    await Promise.all(
      selectedSimIds.value.map((id) =>
        apiPut(`${ENDPOINTS.ADMIN_SIMULATIONS || '/dashboard/simulations'}/${id}`, { is_published: publish })
      )
    );
    toast.success(publish ? `${selectedSimIds.value.length} simulations published!` : `${selectedSimIds.value.length} simulations moved to drafts.`);
    selectedSimIds.value = [];
    await loadSimulations();
  } catch {
    toast.error('Error updating simulations.');
  } finally {
    isBulkProcessing.value = false;
  }
}

async function handleBulkDelete() {
  if (selectedSimIds.value.length === 0) return;
  if (!confirm(`Delete ${selectedSimIds.value.length} selected simulations?`)) return;
  isBulkProcessing.value = true;
  try {
    await Promise.all(
      selectedSimIds.value.map((id) => apiDelete(`${ENDPOINTS.ADMIN_SIMULATIONS || '/dashboard/simulations'}/${id}`))
    );
    toast.success(`${selectedSimIds.value.length} simulations deleted.`);
    selectedSimIds.value = [];
    await loadSimulations();
  } catch {
    toast.error('Error deleting simulations.');
  } finally {
    isBulkProcessing.value = false;
  }
}

onMounted(() => {
  loadSimulations();
});
</script>

<template>
  <div class="space-y-6 animate-fade-in text-text">
    <!-- Top Action Bar -->
    <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
      <div class="flex items-center gap-3 flex-wrap">
        <h3 class="text-lg font-bold flex items-center gap-2">
          <Clapperboard class="w-5 h-5 text-primary" />
          <span>Simulations & Roleplay Scenarios</span>
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
          v-if="filteredSimulations.length > 0"
          type="button"
          @click="handleSelectAll"
          class="flex items-center gap-1.5 text-xs font-bold text-text-muted hover:text-primary transition-all px-2.5 py-1.5 rounded-lg border border-border bg-surface cursor-pointer"
        >
          <CheckSquare v-if="selectedSimIds.length === filteredSimulations.length" class="w-4 h-4 text-primary" />
          <Square v-else class="w-4 h-4" />
          <span>
            {{ selectedSimIds.length === filteredSimulations.length ? 'Deselect All' : `Select All (${filteredSimulations.length})` }}
          </span>
        </button>
      </div>

      <button
        type="button"
        @click="handleOpenNew"
        class="inline-flex items-center gap-1.5 px-4 py-2 bg-primary text-white text-xs font-bold rounded-xl shadow-glow hover:bg-primary-hover active:scale-95 transition-all cursor-pointer self-start sm:self-auto"
      >
        <Plus class="w-4 h-4" />
        <span>Create Simulation</span>
      </button>
    </div>

    <!-- Bulk Action Bar -->
    <div
      v-if="selectedSimIds.length > 0"
      class="bg-primary/10 border border-primary/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 animate-fade-in"
    >
      <div class="flex items-center gap-2">
        <span class="bg-primary text-white text-xs font-bold px-2.5 py-1 rounded-lg">
          {{ selectedSimIds.length }} selected
        </span>
        <span class="text-xs text-text-muted">Bulk actions on selected simulations</span>
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
      v-else-if="filteredSimulations.length === 0"
      class="p-12 text-center bg-surface border border-border rounded-3xl space-y-3"
    >
      <div class="w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
        <FileBox class="w-6 h-6" />
      </div>
      <h4 class="font-bold text-base text-text">No simulations found</h4>
      <p class="text-xs text-text-muted max-w-sm mx-auto">
        Create your first roleplay scenario with AI or customize your own dialogue.
      </p>
    </div>

    <!-- Simulation Cards Grid -->
    <div v-else class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
      <div
        v-for="sim in filteredSimulations"
        :key="sim.id"
        class="bg-surface border border-border rounded-2xl p-5 flex flex-col justify-between group hover:border-primary/40 transition-all shadow-xs relative"
      >
        <div class="space-y-3">
          <!-- Card Header -->
          <div class="flex items-start justify-between gap-2">
            <div class="flex items-center gap-2">
              <button
                type="button"
                @click.stop="toggleSelect(sim.id)"
                class="cursor-pointer text-text-muted hover:text-primary transition-colors"
              >
                <CheckSquare v-if="selectedSimIds.includes(sim.id)" class="w-4 h-4 text-primary" />
                <Square v-else class="w-4 h-4" />
              </button>
              <span class="text-2xl">{{ sim.emoji || '🎭' }}</span>
              <div class="flex items-center gap-1.5 flex-wrap">
                <span
                  v-for="lvl in (sim.levels || [sim.difficulty || 'A1'])"
                  :key="lvl"
                  class="px-2 py-0.5 rounded-full text-[0.65rem] font-black uppercase tracking-wider bg-primary/10 text-primary"
                >
                  {{ lvl }}
                </span>
              </div>
            </div>

            <span
              class="px-2 py-0.5 rounded-full text-[0.65rem] font-bold"
              :class="sim.is_published !== false ? 'bg-success/10 text-success' : 'bg-warning/10 text-warning'"
            >
              {{ sim.is_published !== false ? 'Published' : 'Draft' }}
            </span>
          </div>

          <!-- Name & Description -->
          <div>
            <h4 class="font-bold text-sm text-text line-clamp-1 group-hover:text-primary transition-colors">
              {{ sim.name }}
            </h4>
            <p class="text-xs text-text-muted line-clamp-2 mt-1 leading-relaxed">
              {{ sim.description || 'Interactive AI roleplay dialogue scenario.' }}
            </p>
          </div>
        </div>

        <!-- Footer Actions -->
        <div class="flex items-center justify-between gap-2 pt-4 mt-4 border-t border-border">
          <button
            type="button"
            @click="handleStartSimulation(sim)"
            class="px-3.5 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
          >
            <Play class="w-3.5 h-3.5 fill-current" />
            <span>Launch Simulation</span>
          </button>

          <div class="flex items-center gap-1">
            <button
              type="button"
              @click="handleTogglePublish(sim)"
              :title="sim.is_published !== false ? 'Unpublish to draft' : 'Publish to students'"
              class="p-1.5 rounded-lg border border-border text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <EyeOff v-if="sim.is_published !== false" class="w-4 h-4 text-warning" />
              <Eye v-else class="w-4 h-4 text-success" />
            </button>
            <button
              type="button"
              @click="handleOpenEdit(sim)"
              title="Edit scenario"
              class="p-1.5 rounded-lg border border-border text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
            >
              <PenLine class="w-4 h-4 text-primary" />
            </button>
            <button
              type="button"
              @click="handleDelete(sim.id)"
              title="Delete scenario"
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
              <Clapperboard class="w-5 h-5" />
            </div>
            <div>
              <h3 class="font-bold text-base text-text">
                {{ editingSim ? 'Edit Simulation Scenario' : 'Create Simulation Scenario' }}
              </h3>
              <p class="text-xs text-text-muted">Configure roleplay persona and pedagogical guidelines</p>
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
          <!-- Emoji Picker row -->
          <div>
            <label class="block text-xs font-bold text-text mb-1.5">Scenario Icon</label>
            <div class="flex items-center gap-2 flex-wrap">
              <button
                v-for="emo in EMOJIS"
                :key="emo"
                type="button"
                @click="formData.emoji = emo"
                class="w-9 h-9 rounded-xl text-lg flex items-center justify-center border transition-all cursor-pointer"
                :class="formData.emoji === emo ? 'bg-primary/10 border-primary ring-2 ring-primary/20 scale-110' : 'bg-bg-secondary/40 border-border hover:border-primary/30'"
              >
                {{ emo }}
              </button>
              <input
                v-model="formData.emoji"
                type="text"
                maxlength="2"
                class="w-10 h-9 rounded-xl text-center text-sm bg-surface border border-border"
                placeholder="Custom"
              />
            </div>
          </div>

          <!-- Scenario Name -->
          <div>
            <label class="block text-xs font-bold text-text mb-1.5">Scenario Name *</label>
            <input
              v-model="formData.name"
              type="text"
              placeholder="e.g. Job Interview at a Tech Company"
              class="w-full px-4 py-2.5 rounded-xl bg-bg border border-border text-xs text-text outline-none focus:border-primary transition-all font-medium"
            />
          </div>

          <!-- Description -->
          <div>
            <label class="block text-xs font-bold text-text mb-1.5">Description</label>
            <textarea
              v-model="formData.description"
              rows="2"
              placeholder="Brief context for the student before entering the simulation..."
              class="w-full px-4 py-2.5 rounded-xl bg-bg border border-border text-xs text-text outline-none focus:border-primary transition-all font-medium custom-scrollbar"
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

          <!-- System Prompt -->
          <div>
            <label class="block text-xs font-bold text-text mb-1.5">
              AI Pedagogical System Prompt (Instructions for Teacher Tatiana)
            </label>
            <textarea
              v-model="formData.system_prompt"
              rows="4"
              placeholder="You are interviewing the student for a Senior Software Engineer position. Start by greeting them and asking about their background..."
              class="w-full px-4 py-2.5 rounded-xl bg-bg border border-border text-xs text-text outline-none focus:border-primary transition-all font-mono custom-scrollbar"
            />
          </div>

          <!-- AI Generation Banner -->
          <div class="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex items-center justify-between gap-3">
            <div>
              <div class="flex items-center gap-1.5 text-xs font-bold text-primary">
                <Sparkles class="w-4 h-4" />
                <span>AI Prompt Auto-Craft</span>
              </div>
              <p class="text-[0.7rem] text-text-muted mt-0.5">Let Tatiana AI write the complete persona prompt based on the scenario name.</p>
            </div>

            <button
              type="button"
              @click="handleGenerateWithAI"
              :disabled="isGenerating || !formData.name.trim()"
              class="px-3.5 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover shadow-xs flex items-center gap-1 cursor-pointer disabled:opacity-50"
            >
              <Sparkles class="w-3.5 h-3.5" />
              <span>{{ isGenerating ? 'Crafting...' : 'Auto-Generate' }}</span>
            </button>
          </div>
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
            <span>{{ isSaving ? 'Saving...' : 'Save Simulation' }}</span>
          </button>
        </div>
      </div>
    </div>
    </Teleport>
  </div>
</template>
