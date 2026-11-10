<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  Upload,
  FileText,
  CheckCircle2,
  AlertCircle,
  BookOpen,
  Trash2,
  Sparkles,
  Layers,
  Search,
  Play,
  Clock,
  Calendar,
  RotateCw,
  Plus,
  Clapperboard,
  Eye,
  EyeOff,
  X,
  Image as ImageIcon,
  ChevronRight,
  ChevronLeft,
  ChevronDown,
  ChevronUp,
  Settings,
  Info,
  PenLine,
  Check,
} from 'lucide-vue-next';
import { apiGet, apiPost, apiDelete, apiPut, apiPatch, apiUpload } from '@/api/client';
import { LEVEL_OPTIONS } from '@/constants/levels';
import { useToast } from '@/composables/useToast';
import { useBodyScrollLock } from '@/composables/useBodyScrollLock';

interface CefrReference {
  id: string;
  filename: string;
  cefr_level?: string;
  level?: string;
  file_type: string;
  file_size: number;
  chunks_indexed?: number;
  total_chunks?: number;
  storage_url?: string;
}

interface ScheduleRow {
  id: string;
  active: boolean;
  time: string;
  weekdays: string[];
  types?: string[];
  limit: number;
  created_at?: string;
  last_run_at?: string;
}

const WEEKDAYS_OPTIONS = [
  { value: 'mon', label: 'Mon' },
  { value: 'tue', label: 'Tue' },
  { value: 'wed', label: 'Wed' },
  { value: 'thu', label: 'Thu' },
  { value: 'fri', label: 'Fri' },
  { value: 'sat', label: 'Sat' },
  { value: 'sun', label: 'Sun' },
];

const CEFR_LEVELS = ['All', 'A1', 'A2', 'B1', 'B2', 'C1', 'C2'];

const detectLevelFromFilename = (filename: string, fallback = 'A1'): string => {
  const match = filename.match(/(?:^|[\s_\-.()[\]])([A-C][1-2])(?:$|[\s_\-.()[\]])/i);
  return match ? match[1].toUpperCase() : fallback;
};

const formatBytes = (bytes?: number) => {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

const route = useRoute();
const router = useRouter();
const toast = useToast();

// Main Tab Navigation: Configure & Generate vs AI Generated Curator
const activeMainTab = ref<'configure' | 'curator'>(
  route.query.subtab === 'curator' ? 'curator' : 'configure'
);

// Phase 1: Upload state
const defaultLevel = ref('A1');
const selectedFiles = ref<{ file: File; level: string }[]>([]);
const isUploading = ref(false);
const uploadStatus = ref<{ success: boolean; message: string } | null>(null);

// Phase 2: RAG References state
const references = ref<CefrReference[]>([]);
const loadingReferences = ref(true);
const filterLevel = ref('All');
const searchQuery = ref('');
const selectedRefIds = ref<string[]>([]);

// Phase 3: Content Generation state
const cefrTitle = ref('');
const genTopic = ref('');
const genCardCount = ref(10);
const simulationCount = ref(1);
const isGeneratingFlashcards = ref(false);
const isGeneratingSimulations = ref(false);
const extractingTopics = ref(false);
const extractedTopics = ref<any[]>([]);
const showTopicSelector = ref(false);
const expandedTopicIdx = ref<number | null>(null);
const selectedSubtopics = ref<string[]>([]);
const manualTopicContext = ref<{ topic: string; items: string[] } | null>(null);

function getTopicTitle(t: any): string {
  if (typeof t === 'string') return t;
  return t?.topic || t?.title || 'Topic';
}

function getTopicItems(t: any): string[] {
  if (!t || typeof t === 'string') return [];
  const raw = Array.isArray(t.items) ? t.items : Array.isArray(t.subtopics) ? t.subtopics : [];
  return raw.map((w: any) => String(w || '').trim()).filter(Boolean);
}

function handleToggleExpandTopic(idx: number, t: any) {
  const items = getTopicItems(t);
  if (items.length === 0) {
    const title = getTopicTitle(t);
    cefrTitle.value = title;
    genTopic.value = title;
    manualTopicContext.value = null;
    showTopicSelector.value = false;
    return;
  }
  if (expandedTopicIdx.value === idx) {
    expandedTopicIdx.value = null;
    selectedSubtopics.value = [];
  } else {
    expandedTopicIdx.value = idx;
    selectedSubtopics.value = [...items];
  }
}

function toggleSubtopicWord(word: string) {
  if (selectedSubtopics.value.includes(word)) {
    selectedSubtopics.value = selectedSubtopics.value.filter((w) => w !== word);
  } else {
    selectedSubtopics.value.push(word);
  }
}

function selectAllSubtopics(items: string[]) {
  selectedSubtopics.value = [...items];
}

function clearSelectedSubtopics() {
  selectedSubtopics.value = [];
}

function applyTopicWithWords(t: any, words: string[]) {
  const title = getTopicTitle(t);
  const cleanWords = words.map((w) => w.trim()).filter(Boolean);
  cefrTitle.value = title;
  if (cleanWords.length > 0) {
    genTopic.value = `${title}: ${cleanWords.join(', ')}`;
    manualTopicContext.value = { topic: title, items: cleanWords };
    genCardCount.value = Math.min(25, Math.max(5, cleanWords.length));
  } else {
    genTopic.value = title;
    manualTopicContext.value = null;
  }
  showTopicSelector.value = false;
  expandedTopicIdx.value = null;
}

// Phase 4: Cron Schedules state
const schedules = ref<ScheduleRow[]>([]);
const loadingSchedules = ref(false);
const scheduleActive = ref(true);
const scheduleWeekdays = ref<string[]>(['mon', 'wed', 'fri']);
const scheduleTime = ref('06:00');
const scheduleLimit = ref(10);
const savingSchedule = ref(false);
const runningScheduleId = ref<string | null>(null);

// Phase 5: Curator state
const generatedFlashcards = ref<any[]>([]);
const generatedSimulations = ref<any[]>([]);
const loadingGenerated = ref(false);
const activeCuratorTab = ref<'flashcards' | 'simulations'>(
  route.query.curatortab === 'simulations' ? 'simulations' : 'flashcards'
);
const curatorLevelFilter = ref('All');
const curatorStatusFilter = ref<'All' | 'Drafts' | 'Published'>('Drafts');
const selectedCuratorIds = ref<string[]>([]);
const isBulkProcessing = ref(false);

watch([activeMainTab, activeCuratorTab], ([mainTab, curatorTab]) => {
  router.replace({
    query: {
      ...route.query,
      tab: 'cefr',
      subtab: mainTab,
      curatortab: curatorTab,
    },
  });
});

// Edit Modal State
const isEditModalOpen = ref(false);
useBodyScrollLock(isEditModalOpen);
const editingItem = ref<any>(null);
const editingType = ref<'flashcard' | 'simulation' | null>(null);
const editForm = ref<any>({});
const isSavingEdit = ref(false);
const activeEditStep = ref<1 | 2>(1);

// Filtered References
const filteredReferences = computed(() => {
  return references.value.filter((r) => {
    const itemLevel = (r.cefr_level || r.level || '').toUpperCase();
    const matchesLevel = filterLevel.value === 'All' || itemLevel === filterLevel.value.toUpperCase();
    const matchesSearch = !searchQuery.value.trim() || r.filename.toLowerCase().includes(searchQuery.value.toLowerCase());
    return matchesLevel && matchesSearch;
  });
});

const allFilteredSelected = computed(() => {
  if (filteredReferences.value.length === 0) return false;
  return filteredReferences.value.every((r) => selectedRefIds.value.includes(r.id));
});

function handleSelectAllToggle() {
  if (allFilteredSelected.value) {
    const filteredIds = new Set(filteredReferences.value.map((r) => r.id));
    selectedRefIds.value = selectedRefIds.value.filter((id) => !filteredIds.has(id));
  } else {
    const current = new Set(selectedRefIds.value);
    filteredReferences.value.forEach((r) => current.add(r.id));
    selectedRefIds.value = Array.from(current);
  }
}

function toggleSelectReference(id: string) {
  if (selectedRefIds.value.includes(id)) {
    selectedRefIds.value = selectedRefIds.value.filter((i) => i !== id);
  } else {
    selectedRefIds.value.push(id);
  }
}

// Grouped Flashcards (separated by level, topic AND published status so Drafts and Published never clobber each other)
const groupedFlashcards = computed(() => {
  const groups: Record<
    string,
    { level: string; topic: string; is_published: boolean; cards: any[]; id: string; deckId: string }
  > = {};
  generatedFlashcards.value.forEach((card) => {
    const lvl = (card.level || 'A1').toUpperCase();
    const topic = card.topic || 'General Practice';
    const isPub = Boolean(card.is_published);
    const slug = topic.replace(/[^a-zA-Z0-9]/g, '_').toLowerCase();
    const key = `${lvl}_${topic}_${isPub ? 'pub' : 'draft'}`;
    if (!groups[key]) {
      groups[key] = {
        id: `cefr_fc_${lvl.toLowerCase()}_${slug}_${isPub ? 'pub' : 'draft'}`,
        deckId: `cefr_fc_${lvl.toLowerCase()}_${slug}${isPub ? '' : '__draft'}`,
        level: lvl,
        topic,
        is_published: isPub,
        cards: [],
      };
    }
    groups[key].cards.push(card);
  });
  return Object.values(groups);
});

const activeGroupedFlashcards = computed(() => {
  return groupedFlashcards.value.filter((group) => {
    const matchLevel = curatorLevelFilter.value === 'All' || group.level.toUpperCase() === curatorLevelFilter.value.toUpperCase();
    const matchStatus =
      curatorStatusFilter.value === 'All' ||
      (curatorStatusFilter.value === 'Drafts' && !group.is_published) ||
      (curatorStatusFilter.value === 'Published' && group.is_published);
    return matchLevel && matchStatus;
  });
});

const activeFlashcardCardsCount = computed(() => {
  return activeGroupedFlashcards.value.reduce((acc, g) => acc + g.cards.length, 0);
});

const activeSimulations = computed(() => {
  return generatedSimulations.value.filter((sim) => {
    const matchLevel = curatorLevelFilter.value === 'All' || (sim.level || '').toUpperCase() === curatorLevelFilter.value.toUpperCase();
    const matchStatus =
      curatorStatusFilter.value === 'All' ||
      (curatorStatusFilter.value === 'Drafts' && !sim.is_published) ||
      (curatorStatusFilter.value === 'Published' && sim.is_published);
    return matchLevel && matchStatus;
  });
});

const draftFlashcardsCount = computed(() => generatedFlashcards.value.filter((f) => !f.is_published).length);
const draftFlashcardDecksCount = computed(() => groupedFlashcards.value.filter((g) => !g.is_published).length);
const draftSimulationsCount = computed(() => generatedSimulations.value.filter((s) => !s.is_published).length);

const totalDraftsCount = computed(() => {
  return draftFlashcardsCount.value + draftSimulationsCount.value;
});

// API Calls
async function fetchReferences() {
  loadingReferences.value = true;
  try {
    const res = await apiGet<{ success: boolean; references: any[] }>(`/cefr/admin/references?_t=${Date.now()}`);
    if (res && res.references) {
      references.value = res.references;
    }
  } catch (err) {
    console.error('Error fetching references:', err);
  } finally {
    loadingReferences.value = false;
  }
}

async function fetchSchedules() {
  loadingSchedules.value = true;
  try {
    const res = await apiGet<{ success: boolean; schedules: any[] }>('/cefr/admin/schedules');
    if (res && res.schedules) {
      schedules.value = res.schedules;
    }
  } catch (err) {
    console.error('Error fetching schedules:', err);
  } finally {
    loadingSchedules.value = false;
  }
}

async function fetchGeneratedContent(silent = false) {
  if (!silent) loadingGenerated.value = true;
  try {
    const res = await apiGet<{ success: boolean; flashcards?: any[]; simulations?: any[] }>(`/cefr/admin/all?_t=${Date.now()}`);
    if (res) {
      generatedFlashcards.value = res.flashcards || [];
      generatedSimulations.value = res.simulations || [];
    }
  } catch (err) {
    console.error('Error fetching generated content:', err);
  } finally {
    if (!silent) loadingGenerated.value = false;
  }
}

// Upload Handling
function handleFileChange(e: Event) {
  const target = e.target as HTMLInputElement;
  if (!target.files) return;
  const filesArray = Array.from(target.files);

  if (selectedFiles.value.length + filesArray.length > 10) {
    toast.error('Only 10 files can be uploaded at a time.');
    return;
  }

  const validFiles = filesArray.filter((f) => {
    const ext = f.name.split('.').pop()?.toLowerCase();
    return ext && ['pdf', 'docx', 'txt'].includes(ext);
  });

  if (validFiles.length !== filesArray.length) {
    toast.error('Some files were ignored. Only PDF, DOCX and TXT are accepted.');
  }

  const newItems = validFiles.map((f) => ({
    file: f,
    level: detectLevelFromFilename(f.name, defaultLevel.value),
  }));

  selectedFiles.value = [...selectedFiles.value, ...newItems];
}

function handleRemoveSelectedFile(idx: number) {
  selectedFiles.value.splice(idx, 1);
}

async function handleUpload() {
  if (selectedFiles.value.length === 0) return;
  isUploading.value = true;
  uploadStatus.value = null;

  let successCount = 0;
  for (const item of selectedFiles.value) {
    const formData = new FormData();
    formData.append('file', item.file);
    try {
      await apiUpload(`/cefr/admin/upload-material?level=${item.level}`, formData);
      successCount++;
    } catch (err) {
      console.error(`Error uploading ${item.file.name}:`, err);
    }
  }

  isUploading.value = false;
  if (successCount > 0) {
    uploadStatus.value = {
      success: true,
      message: `${successCount} of ${selectedFiles.value.length} files successfully processed and indexed to database!`,
    };
    selectedFiles.value = [];
    toast.success('CEFR reference materials uploaded and indexed.');
    await fetchReferences();
  } else {
    uploadStatus.value = {
      success: false,
      message: 'Failed to upload files. Please try again.',
    };
    toast.error('Failed to upload materials.');
  }
}

async function handleUpdateReferenceLevel(id: string, newLevel: string) {
  try {
    await apiPatch(`/cefr/admin/references/${id}`, { cefr_level: newLevel });
    const target = references.value.find((r) => r.id === id);
    if (target) {
      target.cefr_level = newLevel;
    }
    toast.success('Level updated.');
  } catch {
    toast.error('Error updating level.');
  }
}

async function handleDeleteReference(id: string) {
  if (!confirm('Are you sure you want to delete this reference file?')) return;
  try {
    await apiDelete(`/cefr/admin/references/${id}`);
    toast.success('Reference deleted.');
    await fetchReferences();
  } catch {
    toast.error('Error deleting reference.');
  }
}

// Content Generation
async function handleExtractTopics() {
  if (selectedRefIds.value.length === 0) {
    toast.error('Please select at least one reference file from the library below.');
    return;
  }
  extractingTopics.value = true;
  try {
    const params = selectedRefIds.value.map((id) => `reference_ids=${id}`).join('&');
    const res = await apiGet<any>(`/cefr/admin/extract-topics?${params}`);
    if (res && res.topics && res.topics.length > 0) {
      extractedTopics.value = res.topics;
      expandedTopicIdx.value = null;
      selectedSubtopics.value = [];
      showTopicSelector.value = true;
      toast.success(`Found ${res.topics.length} topics from selected materials!`);
    } else {
      toast.error('No topics found in selected materials.');
    }
  } catch (err: any) {
    toast.error(err?.message || 'Error extracting topics.');
  } finally {
    extractingTopics.value = false;
  }
}

async function handleGenerateFlashcards() {
  if (!genTopic.value.trim()) {
    toast.error('Please provide a topic or situation prompt.');
    return;
  }
  isGeneratingFlashcards.value = true;
  const effectiveTitle = cefrTitle.value.trim() || manualTopicContext.value?.topic || undefined;
  const payload: any = {
    level: defaultLevel.value,
    topic: genTopic.value.trim(),
    count: genCardCount.value,
  };
  if (effectiveTitle) payload.title = effectiveTitle;
  if (selectedRefIds.value.length > 0) payload.reference_ids = selectedRefIds.value;
  if (manualTopicContext.value?.items?.length) payload.items = manualTopicContext.value.items;

  try {
    const query = new URLSearchParams({
      level: defaultLevel.value,
      topic: genTopic.value.trim(),
      count: String(genCardCount.value),
    }).toString();
    await apiPost(`/cefr/admin/generate-flashcards?${query}`, payload);
    toast.success('Flashcards generated! Check AI Curator tab.');
    await fetchGeneratedContent(true);
    activeMainTab.value = 'curator';
    activeCuratorTab.value = 'flashcards';
  } catch (err: any) {
    toast.error(err?.message || 'Error generating flashcards.');
  } finally {
    isGeneratingFlashcards.value = false;
  }
}

async function handleGenerateSimulations() {
  if (!genTopic.value.trim()) {
    toast.error('Please provide a topic or situation prompt.');
    return;
  }
  isGeneratingSimulations.value = true;
  const effectiveTitle = cefrTitle.value.trim() || manualTopicContext.value?.topic || undefined;
  const payload: any = {
    level: defaultLevel.value,
    topic: genTopic.value.trim(),
    count: simulationCount.value,
  };
  if (effectiveTitle) payload.title = effectiveTitle;
  if (selectedRefIds.value.length > 0) payload.reference_ids = selectedRefIds.value;
  if (manualTopicContext.value?.items?.length) payload.items = manualTopicContext.value.items;

  try {
    const query = new URLSearchParams({
      level: defaultLevel.value,
      topic: genTopic.value.trim(),
      count: String(simulationCount.value),
    }).toString();
    await apiPost(`/cefr/admin/generate-simulations?${query}`, payload);
    toast.success('Simulation generated! Check AI Curator tab.');
    await fetchGeneratedContent(true);
    activeMainTab.value = 'curator';
    activeCuratorTab.value = 'simulations';
  } catch (err: any) {
    toast.error(err?.message || 'Error generating simulations.');
  } finally {
    isGeneratingSimulations.value = false;
  }
}

// Schedules
async function handleSaveSchedule() {
  if (scheduleWeekdays.value.length === 0) {
    toast.error('Please select at least one weekday.');
    return;
  }
  savingSchedule.value = true;
  try {
    const body = {
      active: scheduleActive.value,
      weekdays: scheduleWeekdays.value,
      time: scheduleTime.value,
      limit: scheduleLimit.value,
      types: ['flashcards', 'simulations'],
    };
    await apiPost('/cefr/admin/schedules', body);
    toast.success('Schedule saved successfully.');
    await fetchSchedules();
  } catch (err: any) {
    toast.error(err?.message || 'Error saving schedule.');
  } finally {
    savingSchedule.value = false;
  }
}

async function handleToggleSchedule(s: ScheduleRow) {
  try {
    await apiPut(`/cefr/admin/schedules/${s.id}`, { active: !s.active });
    s.active = !s.active;
    toast.success(s.active ? 'Schedule activated.' : 'Schedule paused.');
  } catch {
    toast.error('Error toggling schedule.');
  }
}

async function handleRunScheduleNow(id: string) {
  runningScheduleId.value = id;
  try {
    await apiPost(`/cefr/admin/schedules/${id}/run-now`, {});
    toast.success('Schedule triggered successfully.');
    await fetchGeneratedContent(true);
  } catch (err: any) {
    toast.error(err?.message || 'Failed to trigger schedule.');
  } finally {
    runningScheduleId.value = null;
  }
}

async function handleDeleteSchedule(id: string) {
  if (!confirm('Are you sure you want to delete this schedule?')) return;
  try {
    await apiDelete(`/cefr/admin/schedules/${id}`);
    toast.success('Schedule deleted.');
    await fetchSchedules();
  } catch {
    toast.error('Error deleting schedule.');
  }
}

// Curator Actions
function handlePlayFlashcardGroup(group: any) {
  const fromUrl = encodeURIComponent('/dashboard?tab=cefr&subtab=curator&curatortab=flashcards');
  router.push(`/flashcards/${group.deckId}?from=${fromUrl}`);
}

async function handleTogglePublishGroup(group: any) {
  try {
    await apiPut(
      `/cefr/admin/flashcards/group?level=${group.level}&topic=${encodeURIComponent(group.topic)}&is_published=${!group.is_published}&current_is_published=${group.is_published}`,
      null
    );
    toast.success(!group.is_published ? 'Flashcard deck published!' : 'Flashcard deck moved to drafts.');
    await fetchGeneratedContent(true);
  } catch {
    toast.error('Error updating status.');
  }
}

async function handleDeleteGroup(group: any) {
  if (!confirm(`Delete flashcard deck "${group.topic}" (${group.cards.length} cards)?`)) return;
  try {
    await apiDelete(
      `/cefr/admin/flashcards/group?level=${group.level}&topic=${encodeURIComponent(group.topic)}&current_is_published=${group.is_published}`
    );
    toast.success('Deck deleted.');
    await fetchGeneratedContent(true);
  } catch {
    toast.error('Error deleting deck.');
  }
}

async function handleTogglePublishSingleCard(card: any) {
  try {
    await apiPut(`/cefr/admin/flashcards/${card.id}`, { is_published: !card.is_published });
    toast.success(!card.is_published ? 'Card published!' : 'Card moved to drafts.');
    await fetchGeneratedContent(true);
  } catch {
    toast.error('Error updating card.');
  }
}

async function handleDeleteSingleCard(card: any) {
  if (!confirm(`Delete card "${card.front}"?`)) return;
  try {
    await apiDelete(`/cefr/admin/flashcards/${card.id}`);
    toast.success('Card deleted.');
    await fetchGeneratedContent(true);
  } catch {
    toast.error('Error deleting card.');
  }
}

function handleOpenEditFlashcardGroup(group: any) {
  editingType.value = 'flashcard';
  editingItem.value = group;
  activeEditStep.value = 1;
  editForm.value = {
    old_level: group.level,
    old_topic: group.topic,
    old_is_published: group.is_published,
    level: group.level,
    topic: group.topic,
    is_published: group.is_published,
    cards: group.cards.map((c: any) => ({
      id: c.id,
      front: c.front || '',
      back: c.back || '',
      image_url: c.image_url || '',
      explanation: c.explanation || '',
      options: Array.isArray(c.options) && c.options.length === 4 ? [...c.options] : [c.front || '', '', '', ''],
    })),
  };
  isEditModalOpen.value = true;
}

function handleAddCardToEditForm() {
  if (!Array.isArray(editForm.value.cards)) {
    editForm.value.cards = [];
  }
  editForm.value.cards.push({
    front: '',
    back: '',
    image_url: '',
    explanation: '',
    options: ['', '', '', ''],
  });
}

function handleRemoveCardFromEditForm(idx: number) {
  editForm.value.cards.splice(idx, 1);
}

function handleOpenEditSimulation(sim: any) {
  editingType.value = 'simulation';
  editingItem.value = sim;
  editForm.value = {
    id: sim.id,
    topic: sim.topic || sim.name || '',
    level: sim.level || 'A1',
    scenario: sim.scenario || '',
    goal: sim.goal || '',
    is_published: Boolean(sim.is_published),
  };
  isEditModalOpen.value = true;
}

async function handleSaveEditModal() {
  isSavingEdit.value = true;
  try {
    if (editingType.value === 'flashcard') {
      const validCards = (editForm.value.cards || []).filter((c: any) => String(c.front || '').trim());
      if (validCards.length === 0) {
        toast.error('At least one card with front text is required.');
        isSavingEdit.value = false;
        return;
      }
      await apiPost('/cefr/admin/flashcards/group/save', {
        old_level: editForm.value.old_level,
        old_topic: editForm.value.old_topic,
        old_is_published: editForm.value.old_is_published,
        new_level: editForm.value.level,
        new_topic: editForm.value.topic,
        is_published: editForm.value.is_published,
        cards: validCards.map((c: any) => ({
          ...c,
          options: Array.isArray(c.options) ? c.options.map((o: any) => String(o || '').trim()).filter(Boolean) : [],
        })),
      });
      toast.success('Flashcard deck saved!');
    } else if (editingType.value === 'simulation') {
      await apiPut(`/cefr/admin/simulations/${editForm.value.id}`, {
        topic: editForm.value.topic,
        level: editForm.value.level,
        scenario: editForm.value.scenario,
        goal: editForm.value.goal,
        is_published: editForm.value.is_published,
      });
      toast.success('Simulation updated!');
    }
    isEditModalOpen.value = false;
    await fetchGeneratedContent(true);
  } catch (err: any) {
    toast.error(err?.message || 'Error saving changes.');
  } finally {
    isSavingEdit.value = false;
  }
}

async function handleTogglePublishSim(sim: any) {
  try {
    await apiPut(`/cefr/admin/simulations/${sim.id}`, { is_published: !sim.is_published });
    toast.success(!sim.is_published ? 'Simulation published!' : 'Simulation moved to drafts.');
    await fetchGeneratedContent(true);
  } catch {
    toast.error('Error updating status.');
  }
}

async function handleDeleteSim(id: string) {
  if (!confirm('Delete this simulation?')) return;
  try {
    await apiDelete(`/cefr/admin/simulations/${id}`);
    toast.success('Simulation deleted.');
    await fetchGeneratedContent(true);
  } catch {
    toast.error('Error deleting simulation.');
  }
}

// Bulk Curator
async function handleBulkPublish() {
  if (selectedCuratorIds.value.length === 0) return;
  isBulkProcessing.value = true;
  try {
    if (activeCuratorTab.value === 'flashcards') {
      const groups = activeGroupedFlashcards.value.filter((g) => selectedCuratorIds.value.includes(g.id));
      await Promise.all(
        groups.map((g) =>
          apiPut(
            `/cefr/admin/flashcards/group?level=${g.level}&topic=${encodeURIComponent(g.topic)}&is_published=true&current_is_published=${g.is_published}`,
            null
          )
        )
      );
    } else {
      await Promise.all(
        selectedCuratorIds.value.map((id) => apiPut(`/cefr/admin/simulations/${id}`, { is_published: true }))
      );
    }
    toast.success(`${selectedCuratorIds.value.length} items published!`);
    selectedCuratorIds.value = [];
    await fetchGeneratedContent(true);
  } catch {
    toast.error('Error publishing items.');
  } finally {
    isBulkProcessing.value = false;
  }
}

async function handleBulkDraft() {
  if (selectedCuratorIds.value.length === 0) return;
  isBulkProcessing.value = true;
  try {
    if (activeCuratorTab.value === 'flashcards') {
      const groups = activeGroupedFlashcards.value.filter((g) => selectedCuratorIds.value.includes(g.id));
      await Promise.all(
        groups.map((g) =>
          apiPut(
            `/cefr/admin/flashcards/group?level=${g.level}&topic=${encodeURIComponent(g.topic)}&is_published=false&current_is_published=${g.is_published}`,
            null
          )
        )
      );
    } else {
      await Promise.all(
        selectedCuratorIds.value.map((id) => apiPut(`/cefr/admin/simulations/${id}`, { is_published: false }))
      );
    }
    toast.success(`${selectedCuratorIds.value.length} items moved to drafts.`);
    selectedCuratorIds.value = [];
    await fetchGeneratedContent(true);
  } catch {
    toast.error('Error moving items to draft.');
  } finally {
    isBulkProcessing.value = false;
  }
}

async function handleBulkDelete() {
  if (selectedCuratorIds.value.length === 0) return;
  if (!confirm(`Delete ${selectedCuratorIds.value.length} selected item(s)?`)) return;
  isBulkProcessing.value = true;
  try {
    if (activeCuratorTab.value === 'flashcards') {
      const groups = activeGroupedFlashcards.value.filter((g) => selectedCuratorIds.value.includes(g.id));
      await Promise.all(
        groups.map((g) =>
          apiDelete(
            `/cefr/admin/flashcards/group?level=${g.level}&topic=${encodeURIComponent(g.topic)}&current_is_published=${g.is_published}`
          )
        )
      );
    } else {
      await Promise.all(selectedCuratorIds.value.map((id) => apiDelete(`/cefr/admin/simulations/${id}`)));
    }
    toast.success(`${selectedCuratorIds.value.length} items deleted.`);
    selectedCuratorIds.value = [];
    await fetchGeneratedContent(true);
  } catch {
    toast.error('Error deleting items.');
  } finally {
    isBulkProcessing.value = false;
  }
}

// Simulation Play Launch
async function handleLaunchSimulation(sim: any) {
  const fromUrl = encodeURIComponent('/dashboard?tab=cefr&subtab=curator&curatortab=simulations');
  try {
    const res = await apiPost<any>('/chat/conversations', {
      title: `Simulation: ${sim.topic || 'Practice'}`,
      is_simulation: true,
      simulation_id: sim.id,
      system_prompt: sim.scenario || '',
    });
    const convId = res?.id || res?.conversation_id;
    if (convId) {
      router.push(`/voice?conv_id=${convId}&simulation_id=${sim.id}&from=${fromUrl}`);
    } else {
      router.push(`/voice?simulation_id=${sim.id}&from=${fromUrl}`);
    }
  } catch {
    router.push(`/voice?simulation_id=${sim.id}&from=${fromUrl}`);
  }
}

onMounted(() => {
  fetchReferences();
  fetchSchedules();
  fetchGeneratedContent();
});
</script>

<template>
  <div class="space-y-8 max-w-7xl animate-fade-in text-text">
    <!-- TOP LEVEL MAIN TABS -->
    <div class="flex border-b border-border gap-6 mb-6">
      <button type="button" @click="activeMainTab = 'configure'"
        class="flex items-center gap-2 pb-4 text-sm font-bold border-b-2 transition-all cursor-pointer" :class="activeMainTab === 'configure'
            ? 'border-primary text-primary'
            : 'border-transparent text-text-muted hover:text-text hover:border-border'
          ">
        <Settings class="w-4 h-4" />
        <span>Configure & Generate</span>
      </button>

      <button type="button" @click="activeMainTab = 'curator'"
        class="flex items-center gap-2 pb-4 text-sm font-bold border-b-2 transition-all cursor-pointer relative" :class="activeMainTab === 'curator'
            ? 'border-primary text-primary'
            : 'border-transparent text-text-muted hover:text-text hover:border-border'
          ">
        <Layers class="w-4 h-4" />
        <span>AI Generated Curator</span>
        <span v-if="totalDraftsCount > 0"
          class="ml-1.5 px-2 py-0.5 text-[10px] font-bold bg-amber-500 text-white rounded-full shadow-xs">
          {{ totalDraftsCount }}
        </span>
      </button>
    </div>

    <!-- TAB 1: CONFIGURE & GENERATE -->
    <div v-if="activeMainTab === 'configure'" class="space-y-8 animate-in fade-in duration-200">
      <!-- 1. MULTIPLE UPLOAD CARD -->
      <div class="bg-surface border border-border p-6 rounded-3xl shadow-xs">
        <h2 class="text-lg font-bold text-text mb-1.5 flex items-center gap-2.5">
          <Upload class="w-5 h-5 text-primary" />
          <span>Import CEFR Reference Sources</span>
        </h2>
        <p class="text-xs text-text-muted mb-6">
          Add source pedagogical materials. The AI will process and use the content as context for generation.
        </p>

        <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div class="space-y-2">
            <label class="text-xs font-bold text-text">Suggested Level (Default)</label>
            <select v-model="defaultLevel"
              class="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-xs text-text focus:border-primary outline-none transition-all cursor-pointer font-medium">
              <option v-for="opt in LEVEL_OPTIONS" :key="opt.value" :value="opt.value">
                {{ opt.label }}
              </option>
            </select>
          </div>

          <div class="space-y-2 md:col-span-2">
            <label class="text-xs font-bold text-text">Files (PDF, DOCX, TXT)</label>
            <div class="flex flex-col gap-4">
              <div
                class="relative border-2 border-dashed border-border hover:border-primary/50 transition-all rounded-2xl p-6 flex flex-col items-center justify-center bg-surface-hover/40 cursor-pointer">
                <input type="file" multiple accept=".pdf,.docx,.txt" @change="handleFileChange"
                  class="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10" />
                <Upload class="text-text-muted mb-2 w-7 h-7" />
                <p class="text-xs font-bold text-text">Drag & drop or click to select</p>
                <p class="text-[0.7rem] text-text-muted mt-1">
                  Maximum of 10 files per upload. Formats: PDF, DOCX and TXT.
                </p>
              </div>

              <!-- Selected Files List -->
              <div v-if="selectedFiles.length > 0"
                class="space-y-2 max-h-48 overflow-y-auto border border-border p-3 rounded-2xl bg-bg/50 custom-scrollbar">
                <div
                  class="flex justify-between items-center text-xs font-bold text-text-muted pb-2 border-b border-border">
                  <span>Selected Files ({{ selectedFiles.length }})</span>
                  <button type="button" @click="selectedFiles = []" class="text-danger hover:underline cursor-pointer">
                    Clear All
                  </button>
                </div>
                <div v-for="(item, idx) in selectedFiles" :key="idx"
                  class="flex justify-between items-center text-xs p-2 bg-surface rounded-xl border border-border gap-2">
                  <div class="flex items-center gap-2 truncate flex-1 min-w-0">
                    <FileText class="w-4 h-4 text-primary shrink-0" />
                    <span class="truncate font-medium text-text">{{ item.file.name }}</span>
                    <span class="text-text-muted shrink-0 text-[0.7rem]">({{ formatBytes(item.file.size) }})</span>
                  </div>
                  <div class="flex items-center gap-2 shrink-0">
                    <select v-model="item.level"
                      class="px-2 py-1 text-xs font-bold rounded-lg border border-border bg-bg text-text outline-none cursor-pointer">
                      <option v-for="opt in LEVEL_OPTIONS" :key="opt.value" :value="opt.value">
                        {{ opt.value }}
                      </option>
                    </select>
                    <button type="button" @click="handleRemoveSelectedFile(idx)"
                      class="text-text-muted hover:text-danger p-1 transition-colors cursor-pointer">
                      <X class="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div class="flex justify-end">
                <button type="button" @click="handleUpload" :disabled="selectedFiles.length === 0 || isUploading"
                  class="px-6 py-2.5 bg-primary text-white rounded-xl font-bold text-xs disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 hover:bg-primary-hover shadow-xs transition-all cursor-pointer">
                  <RotateCw v-if="isUploading" class="w-4 h-4 animate-spin" />
                  <Upload v-else class="w-4 h-4" />
                  <span>{{ isUploading ? 'Indexing to Database...' : `Upload and Process (${selectedFiles.length})`
                    }}</span>
                </button>
              </div>
            </div>
          </div>
        </div>

        <div v-if="uploadStatus" class="mt-4 p-4 rounded-xl flex items-center gap-3 text-xs font-semibold border"
          :class="uploadStatus.success
              ? 'bg-success/10 text-success border-success/20'
              : 'bg-danger/10 text-danger border-danger/20'
            ">
          <CheckCircle2 v-if="uploadStatus.success" class="w-4 h-4 shrink-0" />
          <AlertCircle v-else class="w-4 h-4 shrink-0" />
          <span>{{ uploadStatus.message }}</span>
        </div>
      </div>

      <!-- 2. AVAILABLE REFERENCE SOURCES (RAG LIBRARY) -->
      <div class="bg-surface border border-border p-6 rounded-3xl shadow-xs">
        <h2 class="text-lg font-bold text-text mb-1.5 flex items-center gap-2.5">
          <Layers class="w-5 h-5 text-primary" />
          <span>Available Reference Sources</span>
        </h2>
        <p class="text-xs text-text-muted mb-6">
          These files are indexed in the vector database. Select the materials you want to use as context to guide
          generation.
        </p>

        <div v-if="loadingReferences" class="flex justify-center py-12">
          <RotateCw class="w-7 h-7 text-primary animate-spin" />
        </div>

        <div v-else-if="references.length === 0"
          class="text-center py-12 text-text-muted border border-dashed border-border rounded-2xl">
          <Info class="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p class="text-xs font-medium">No reference materials registered at the moment.</p>
        </div>

        <div v-else class="space-y-4">
          <!-- Toolbar: Filter Pills & Search -->
          <div class="flex flex-wrap items-center justify-between gap-4 p-3 bg-bg rounded-2xl border border-border">
            <div class="flex flex-wrap items-center gap-3">
              <span class="text-[0.7rem] font-bold text-text-muted uppercase tracking-wider">Level:</span>
              <div class="flex gap-1.5 flex-wrap">
                <button v-for="lvl in CEFR_LEVELS" :key="lvl" type="button" @click="filterLevel = lvl"
                  class="px-3 py-1.5 rounded-xl text-xs font-bold transition-all border flex items-center gap-1.5 cursor-pointer"
                  :class="filterLevel === lvl
                      ? 'bg-primary text-white border-primary shadow-xs'
                      : 'bg-surface text-text-muted border-border hover:border-primary/40'
                    ">
                  <span>{{ lvl }}</span>
                  <span class="text-[10px] px-1.5 py-0.2 rounded-full font-bold"
                    :class="filterLevel === lvl ? 'bg-white/20 text-white' : 'bg-bg text-text-muted border border-border'">
                    {{
                      lvl === 'All'
                        ? references.length
                        : references.filter((r) => (r.cefr_level || r.level || '').toUpperCase() === lvl).length
                    }}
                  </span>
                </button>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <div class="relative">
                <Search class="w-3.5 h-3.5 absolute left-3 top-1/2 -translate-y-1/2 text-text-muted" />
                <input v-model="searchQuery" type="text" placeholder="Search file name..."
                  class="pl-8 pr-7 py-1.5 bg-surface border border-border rounded-xl text-xs text-text placeholder:text-text-muted outline-none focus:border-primary transition-all w-44 sm:w-56" />
              </div>

              <button type="button" @click="handleSelectAllToggle"
                class="px-3 py-1.5 bg-surface border border-border hover:border-primary/40 text-text rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs">
                {{ allFilteredSelected ? 'Deselect All' : 'Select All Filtered' }}
              </button>
            </div>
          </div>

          <!-- Table of Files -->
          <div class="overflow-x-auto border border-border rounded-2xl">
            <table class="w-full text-left border-collapse text-xs">
              <thead>
                <tr class="bg-bg border-b border-border text-[0.7rem] font-bold text-text-muted uppercase">
                  <th class="p-3 w-10 text-center">Use</th>
                  <th class="p-3">File Name</th>
                  <th class="p-3 w-28">CEFR Level</th>
                  <th class="p-3 w-20">Type</th>
                  <th class="p-3 w-24">Size</th>
                  <th class="p-3 w-24 text-center">Chunks</th>
                  <th class="p-3 w-16 text-center">Actions</th>
                </tr>
              </thead>
              <tbody class="divide-y divide-border">
                <tr v-for="ref in filteredReferences" :key="ref.id" class="hover:bg-surface-hover/50 transition-colors">
                  <td class="p-3 text-center">
                    <input type="checkbox" :checked="selectedRefIds.includes(ref.id)"
                      @change="toggleSelectReference(ref.id)" class="h-4 w-4 rounded accent-primary cursor-pointer" />
                  </td>
                  <td class="p-3 font-medium text-text max-w-xs truncate" :title="ref.filename">
                    {{ ref.filename }}
                  </td>
                  <td class="p-3">
                    <select :value="ref.cefr_level || ref.level"
                      @change="handleUpdateReferenceLevel(ref.id, ($event.target as HTMLSelectElement).value)"
                      class="px-2 py-0.5 text-xs font-bold rounded-lg border border-border bg-bg text-text cursor-pointer outline-none">
                      <option v-for="lvl in ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']" :key="lvl" :value="lvl">
                        {{ lvl }}
                      </option>
                    </select>
                  </td>
                  <td class="p-3">
                    <span
                      class="px-2 py-0.5 text-[0.65rem] font-bold rounded-md uppercase border border-border bg-bg-secondary text-text-muted">
                      {{ ref.file_type || 'PDF' }}
                    </span>
                  </td>
                  <td class="p-3 text-text-muted">
                    {{ formatBytes(ref.file_size) }}
                  </td>
                  <td class="p-3 text-center font-bold text-text">
                    {{ ref.chunks_indexed ?? ref.total_chunks ?? 0 }}
                  </td>
                  <td class="p-3 text-center">
                    <button type="button" @click="handleDeleteReference(ref.id)"
                      class="text-text-muted hover:text-danger p-1 rounded-lg transition-colors cursor-pointer"
                      title="Delete reference">
                      <Trash2 class="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- 3. CONTENT GENERATION CARD -->
      <div class="bg-surface border border-border p-6 rounded-3xl shadow-xs">
        <h2 class="text-lg font-bold text-text mb-1.5 flex items-center gap-2.5">
          <BookOpen class="w-5 h-5 text-primary" />
          <span>Generate Content from References</span>
        </h2>
        <p class="text-xs text-text-muted mb-6">
          Create new study materials based on the selected level and references checked above.
        </p>

        <div class="grid grid-cols-1 md:grid-cols-2 gap-6 mb-4">
          <div class="space-y-2">
            <label class="text-xs font-bold text-text">Content Title (Optional)</label>
            <input v-model="cefrTitle" type="text" placeholder="e.g. At the Supermarket (If empty, prompt will be used)"
              class="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-xs text-text outline-none focus:border-primary transition-all font-medium" />
          </div>

          <div class="space-y-2">
            <label class="text-xs font-bold text-text">Topic / Situation (Prompt for AI)</label>
            <input v-model="genTopic" type="text"
              placeholder="e.g. Shopping at the supermarket and talking to a cashier"
              class="w-full bg-bg border border-border rounded-xl px-4 py-2.5 text-xs text-text outline-none focus:border-primary transition-all font-medium" />
          </div>
        </div>

        <!-- Active Subtopics Context Badge -->
        <div v-if="manualTopicContext && manualTopicContext.items.length > 0"
          class="mb-6 p-3 rounded-2xl bg-primary/10 border border-primary/25 flex items-center justify-between gap-3 text-xs">
          <div class="flex items-center gap-2 min-w-0">
            <Sparkles class="w-4 h-4 text-primary shrink-0" />
            <div class="truncate">
              <span class="font-bold text-primary">{{ manualTopicContext.topic }}</span>
              <span class="text-text-muted ml-1.5">
                ({{ manualTopicContext.items.length }} selected subtopics/words: {{ manualTopicContext.items.slice(0, 8).join(', ') }}{{ manualTopicContext.items.length > 8 ? '...' : '' }})
              </span>
            </div>
          </div>
          <button type="button" @click="manualTopicContext = null"
            class="text-text-muted hover:text-danger p-1 rounded-lg transition-colors cursor-pointer shrink-0"
            title="Clear subtopic filter">
            <X class="w-4 h-4" />
          </button>
        </div>

        <div v-if="selectedRefIds.length > 0" class="mb-6 space-y-3">
          <div
            class="p-3 bg-primary/10 border border-primary/20 rounded-xl text-xs font-semibold text-primary flex items-center gap-2">
            <Info class="w-4 h-4 shrink-0" />
            <span>Active context filter: The AI will strictly use the {{ selectedRefIds.length }} selected reference
              materials.</span>
          </div>

          <button type="button" @click="handleExtractTopics" :disabled="extractingTopics"
            class="px-4 py-2 bg-surface border border-border hover:border-primary/40 rounded-xl text-xs font-bold text-primary flex items-center gap-2 transition-all cursor-pointer shadow-xs">
            <RotateCw v-if="extractingTopics" class="w-3.5 h-3.5 animate-spin" />
            <Sparkles v-else class="w-3.5 h-3.5" />
            <span>{{ extractingTopics ? 'Extracting All Topics & Subtopics...' : 'Extract Topics from Files' }}</span>
          </button>
        </div>

        <!-- Extracted Topics & Subtopics Selector -->
        <div v-if="showTopicSelector && extractedTopics.length > 0"
          class="mb-6 p-4 bg-bg border border-border rounded-2xl space-y-3">
          <div class="flex items-center justify-between">
            <div>
              <h3 class="text-xs font-bold text-text flex items-center gap-2">
                <Sparkles class="w-3.5 h-3.5 text-primary" />
                <span>Extracted Topics ({{ extractedTopics.length }})</span>
              </h3>
              <p class="text-[0.68rem] text-text-muted mt-0.5">
                Click a topic to view and select its related words/subtopics from the reference material.
              </p>
            </div>
            <button type="button" @click="showTopicSelector = false"
              class="text-text-muted hover:text-text cursor-pointer p-1">
              <X class="w-4 h-4" />
            </button>
          </div>

          <div class="grid grid-cols-1 md:grid-cols-2 gap-2.5 max-h-[28rem] overflow-y-auto pr-1 custom-scrollbar">
            <div v-for="(t, idx) in extractedTopics" :key="idx"
              class="rounded-xl border transition-all text-xs overflow-hidden"
              :class="expandedTopicIdx === idx ? 'border-primary bg-surface col-span-1 md:col-span-2 shadow-sm' : 'border-border bg-surface hover:border-primary/50'">
              <!-- Topic Header Row -->
              <div class="p-3 flex items-start justify-between gap-2 cursor-pointer"
                @click="handleToggleExpandTopic(idx, t)">
                <div class="min-w-0 flex-1">
                  <div class="flex items-center gap-2 flex-wrap">
                    <span class="font-bold text-text">{{ getTopicTitle(t) }}</span>
                    <span v-if="getTopicItems(t).length > 0"
                      class="px-2 py-0.5 rounded-full text-[0.65rem] font-bold bg-primary/10 text-primary border border-primary/20">
                      {{ getTopicItems(t).length }} subtopics
                    </span>
                  </div>
                  <div v-if="getTopicItems(t).length > 0 && expandedTopicIdx !== idx"
                    class="text-[0.68rem] text-text-muted line-clamp-2 mt-1 leading-relaxed">
                    {{ getTopicItems(t).join(', ') }}
                  </div>
                </div>

                <div class="flex items-center gap-1.5 shrink-0">
                  <button type="button"
                    @click.stop="applyTopicWithWords(t, getTopicItems(t))"
                    class="px-2.5 py-1 rounded-lg bg-primary/10 hover:bg-primary text-primary hover:text-white text-[0.68rem] font-bold transition-colors cursor-pointer">
                    Use All
                  </button>
                  <ChevronUp v-if="expandedTopicIdx === idx" class="w-4 h-4 text-primary" />
                  <ChevronDown v-else class="w-4 h-4 text-text-muted" />
                </div>
              </div>

              <!-- Expanded Subtopics / Words Selection Panel -->
              <div v-if="expandedTopicIdx === idx && getTopicItems(t).length > 0"
                class="px-3 pb-3 pt-2 border-t border-border/70 bg-bg/50 space-y-3">
                <div class="flex flex-wrap items-center justify-between gap-2">
                  <span class="text-[0.7rem] font-bold text-text-muted">
                    Select specific words/subtopics ({{ selectedSubtopics.length }} of {{ getTopicItems(t).length }} selected):
                  </span>
                  <div class="flex items-center gap-2">
                    <button type="button" @click="selectAllSubtopics(getTopicItems(t))"
                      class="text-[0.68rem] font-bold text-primary hover:underline cursor-pointer">
                      Select All
                    </button>
                    <span class="text-border">•</span>
                    <button type="button" @click="clearSelectedSubtopics()"
                      class="text-[0.68rem] font-bold text-text-muted hover:text-danger hover:underline cursor-pointer">
                      Clear
                    </button>
                  </div>
                </div>

                <div class="flex flex-wrap gap-1.5 max-h-48 overflow-y-auto p-1 custom-scrollbar">
                  <button v-for="word in getTopicItems(t)" :key="word" type="button"
                    @click="toggleSubtopicWord(word)"
                    class="px-2.5 py-1 rounded-lg text-[0.7rem] font-semibold border transition-all flex items-center gap-1 cursor-pointer"
                    :class="selectedSubtopics.includes(word)
                      ? 'bg-primary text-white border-primary shadow-2xs'
                      : 'bg-surface text-text border-border hover:border-primary/40'">
                    <Check v-if="selectedSubtopics.includes(word)" class="w-3 h-3" />
                    <span>{{ word }}</span>
                  </button>
                </div>

                <div class="flex items-center justify-end gap-2 pt-1">
                  <button type="button"
                    @click="applyTopicWithWords(t, [])"
                    class="px-3 py-1.5 rounded-xl border border-border bg-surface hover:bg-surface-hover text-text text-xs font-bold cursor-pointer">
                    Topic Title Only
                  </button>
                  <button type="button"
                    :disabled="selectedSubtopics.length === 0"
                    @click="applyTopicWithWords(t, selectedSubtopics)"
                    class="px-3.5 py-1.5 rounded-xl bg-primary text-white hover:bg-primary-hover text-xs font-bold disabled:opacity-40 cursor-pointer shadow-xs">
                    Use Selected Words ({{ selectedSubtopics.length }})
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div class="flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-border">
          <div class="flex items-center gap-3">
            <span class="text-xs font-bold text-text">Cards Count:</span>
            <select v-model="genCardCount"
              class="px-3 py-1.5 rounded-xl bg-bg border border-border text-xs font-bold text-text outline-none cursor-pointer">
              <option :value="5">5 Cards</option>
              <option :value="10">10 Cards</option>
              <option :value="15">15 Cards</option>
              <option :value="20">20 Cards</option>
              <option :value="25">25 Cards</option>
              <option
                v-if="manualTopicContext && ![5, 10, 15, 20, 25].includes(Math.min(25, Math.max(5, manualTopicContext.items.length)))"
                :value="Math.min(25, Math.max(5, manualTopicContext.items.length))">
                {{ Math.min(25, Math.max(5, manualTopicContext.items.length)) }} Cards (Selected Words)
              </option>
            </select>
          </div>

          <div class="flex items-center gap-3">
            <button type="button" @click="handleGenerateFlashcards" :disabled="isGeneratingFlashcards"
              class="px-5 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover shadow-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50">
              <RotateCw v-if="isGeneratingFlashcards" class="w-4 h-4 animate-spin" />
              <BookOpen v-else class="w-4 h-4" />
              <span>{{ isGeneratingFlashcards ? 'Generating Flashcards...' : 'Generate Flashcards' }}</span>
            </button>

            <button type="button" @click="handleGenerateSimulations" :disabled="isGeneratingSimulations"
              class="px-5 py-2.5 rounded-xl border border-border bg-surface hover:bg-surface-hover text-text text-xs font-bold shadow-xs flex items-center gap-2 transition-all cursor-pointer disabled:opacity-50">
              <RotateCw v-if="isGeneratingSimulations" class="w-4 h-4 animate-spin" />
              <Clapperboard v-else class="w-4 h-4 text-primary" />
              <span>{{ isGeneratingSimulations ? 'Generating...' : 'Generate Simulation' }}</span>
            </button>
          </div>
        </div>
      </div>

      <!-- 4. CRON SCHEDULES CARD -->
      <div class="bg-surface border border-border p-6 rounded-3xl shadow-xs">
        <h2 class="text-lg font-bold text-text mb-1.5 flex items-center gap-2.5">
          <Calendar class="w-5 h-5 text-primary" />
          <span>Automated Activity Generation (Cron Schedules)</span>
        </h2>
        <p class="text-xs text-text-muted mb-6">
          Schedule autonomous weekly generation pipelines driven by reference source documents.
        </p>

        <!-- Create Schedule Row -->
        <div class="p-4 bg-bg rounded-2xl border border-border mb-6 grid grid-cols-1 md:grid-cols-4 gap-4 items-center">
          <div>
            <label class="block text-[0.7rem] font-bold text-text-muted uppercase mb-1.5">Weekdays</label>
            <div class="flex gap-1 flex-wrap">
              <button v-for="d in WEEKDAYS_OPTIONS" :key="d.value" type="button" @click="
                scheduleWeekdays.includes(d.value)
                  ? (scheduleWeekdays = scheduleWeekdays.filter((w) => w !== d.value))
                  : scheduleWeekdays.push(d.value)
                " class="w-7 h-7 rounded-lg text-xs font-bold border transition-all cursor-pointer" :class="scheduleWeekdays.includes(d.value)
                    ? 'bg-primary text-white border-primary shadow-xs'
                    : 'bg-surface border-border text-text-muted hover:border-primary/30'
                  ">
                {{ d.label[0] }}
              </button>
            </div>
          </div>

          <div>
            <label class="block text-[0.7rem] font-bold text-text-muted uppercase mb-1.5">Time (UTC)</label>
            <input v-model="scheduleTime" type="time"
              class="w-full px-3 py-1.5 rounded-xl bg-surface border border-border text-xs font-bold text-text outline-none focus:border-primary" />
          </div>

          <div>
            <label class="block text-[0.7rem] font-bold text-text-muted uppercase mb-1.5">Items Limit</label>
            <select v-model="scheduleLimit"
              class="w-full px-3 py-1.5 rounded-xl bg-surface border border-border text-xs font-bold text-text outline-none focus:border-primary cursor-pointer">
              <option :value="5">5 items</option>
              <option :value="10">10 items</option>
              <option :value="15">15 items</option>
            </select>
          </div>

          <div class="flex items-end justify-end pt-2 md:pt-0">
            <button type="button" @click="handleSaveSchedule" :disabled="savingSchedule"
              class="w-full py-2 bg-primary text-white rounded-xl text-xs font-bold hover:bg-primary-hover shadow-xs flex items-center justify-center gap-1.5 transition-all cursor-pointer disabled:opacity-50">
              <Plus class="w-4 h-4" />
              <span>Save Schedule</span>
            </button>
          </div>
        </div>

        <!-- Existing Schedules List -->
        <div v-if="schedules.length === 0" class="text-center py-6 text-text-muted text-xs">
          No automated cron schedules created yet.
        </div>
        <div v-else class="space-y-2">
          <div v-for="s in schedules" :key="s.id"
            class="flex items-center justify-between p-3.5 bg-bg/50 border border-border rounded-2xl text-xs">
            <div class="flex items-center gap-3">
              <span class="w-2.5 h-2.5 rounded-full" :class="s.active ? 'bg-success' : 'bg-text-muted'" />
              <div>
                <div class="font-bold text-text flex items-center gap-2">
                  <Clock class="w-3.5 h-3.5 text-primary" />
                  <span>{{ s.time || '06:00' }}</span>
                  <span class="text-text-muted font-normal">•</span>
                  <span class="text-text-muted uppercase">{{ (s.weekdays || []).join(', ') }}</span>
                </div>
                <p class="text-[0.7rem] text-text-muted mt-0.5">
                  Limit: {{ s.limit || 10 }} items • Flashcards & Simulations
                </p>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <button type="button" @click="handleRunScheduleNow(s.id)" :disabled="runningScheduleId === s.id"
                class="px-2.5 py-1 rounded-lg border border-border text-xs font-bold text-primary hover:bg-primary/10 flex items-center gap-1 transition-all cursor-pointer">
                <RotateCw class="w-3 h-3" :class="runningScheduleId === s.id ? 'animate-spin' : ''" />
                <span>Run Now</span>
              </button>

              <button type="button" @click="handleToggleSchedule(s)"
                class="px-2.5 py-1 rounded-lg text-xs font-bold transition-all cursor-pointer border" :class="s.active
                    ? 'border-success/30 text-success bg-success/10'
                    : 'border-border text-text-muted bg-surface'
                  ">
                {{ s.active ? 'Active' : 'Paused' }}
              </button>

              <button type="button" @click="handleDeleteSchedule(s.id)"
                class="p-1.5 rounded-lg text-text-muted hover:text-danger hover:bg-danger/10 transition-colors cursor-pointer">
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- TAB 2: AI GENERATED CURATOR -->
    <div v-else class="space-y-6 animate-in fade-in duration-200">
      <!-- Curator Sub-navigation & Filters -->
      <div
        class="flex flex-wrap items-center justify-between gap-4 p-4 bg-surface border border-border rounded-3xl shadow-xs">
        <div class="flex items-center gap-2 flex-wrap">
          <button type="button" @click="activeCuratorTab = 'flashcards'; selectedCuratorIds = [];"
            class="px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center gap-1.5" :class="activeCuratorTab === 'flashcards'
                ? 'bg-primary text-white border-primary shadow-xs'
                : 'bg-surface text-text border-border hover:bg-surface-hover'
              ">
            <BookOpen class="w-3.5 h-3.5" />
            <span>Flashcards ({{ activeGroupedFlashcards.length }} decks · {{ activeFlashcardCardsCount }} cards)</span>
          </button>

          <button type="button" @click="activeCuratorTab = 'simulations'; selectedCuratorIds = [];"
            class="px-4 py-2 rounded-xl text-xs font-bold transition-all border cursor-pointer flex items-center gap-1.5" :class="activeCuratorTab === 'simulations'
                ? 'bg-primary text-white border-primary shadow-xs'
                : 'bg-surface text-text border-border hover:bg-surface-hover'
              ">
            <Clapperboard class="w-3.5 h-3.5" />
            <span>Simulations ({{ activeSimulations.length }})</span>
          </button>
        </div>

        <!-- Level and Status Filters -->
        <div class="flex items-center gap-3 flex-wrap">
          <div class="flex items-center gap-1 bg-bg p-1 rounded-xl border border-border text-xs font-bold">
            <button v-for="st in ['Drafts', 'Published', 'All'] as const" :key="st" type="button"
              @click="curatorStatusFilter = st; selectedCuratorIds = [];" class="px-2.5 py-1 rounded-lg transition-all cursor-pointer"
              :class="curatorStatusFilter === st ? 'bg-surface text-primary shadow-xs' : 'text-text-muted'">
              {{ st }}
            </button>
          </div>

          <div class="flex items-center gap-1 bg-bg p-1 rounded-xl border border-border text-xs font-bold">
            <button v-for="lvl in CEFR_LEVELS" :key="lvl" type="button" @click="curatorLevelFilter = lvl; selectedCuratorIds = [];"
              class="px-2 py-1 rounded-lg transition-all cursor-pointer"
              :class="curatorLevelFilter === lvl ? 'bg-surface text-primary shadow-xs' : 'text-text-muted'">
              {{ lvl }}
            </button>
          </div>
        </div>
      </div>

      <!-- Bulk Action Bar -->
      <div v-if="selectedCuratorIds.length > 0"
        class="bg-primary/10 border border-primary/30 rounded-2xl p-4 flex flex-wrap items-center justify-between gap-3 animate-in fade-in duration-200">
        <div class="flex items-center gap-2">
          <span class="bg-primary text-white text-xs font-bold px-2.5 py-1 rounded-lg">
            {{ selectedCuratorIds.length }} selected
          </span>
          <span class="text-xs text-text-muted">
            of {{ (activeCuratorTab === 'flashcards' ? activeGroupedFlashcards : activeSimulations).length }} items
          </span>
        </div>

        <div class="flex items-center gap-2">
          <button type="button" @click="handleBulkPublish" :disabled="isBulkProcessing"
            class="px-3.5 py-1.5 bg-success text-white hover:bg-success/90 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50">
            <CheckCircle2 class="w-3.5 h-3.5" />
            <span>Publish Selected</span>
          </button>

          <button type="button" @click="handleBulkDraft" :disabled="isBulkProcessing"
            class="px-3.5 py-1.5 bg-warning text-white hover:bg-warning/90 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50">
            <EyeOff class="w-3.5 h-3.5" />
            <span>Move to Draft</span>
          </button>

          <button type="button" @click="handleBulkDelete" :disabled="isBulkProcessing"
            class="px-3.5 py-1.5 bg-danger text-white hover:bg-danger/90 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer disabled:opacity-50">
            <Trash2 class="w-3.5 h-3.5" />
            <span>Delete Selected</span>
          </button>
        </div>
      </div>

      <!-- FLASHCARDS CURATOR LIST -->
      <div v-if="activeCuratorTab === 'flashcards'" class="space-y-4">
        <div v-if="activeGroupedFlashcards.length === 0"
          class="text-center py-16 text-text-muted bg-surface border border-border rounded-3xl">
          <BookOpen class="w-10 h-10 mx-auto mb-2 opacity-40 text-primary" />
          <p class="text-xs font-bold text-text">No flashcard decks found</p>
          <p class="text-[0.7rem] text-text-muted mt-1">Try changing your level/status filters or generate new cards in
            Configure & Generate.</p>
        </div>

        <div v-for="group in activeGroupedFlashcards" :key="group.id"
          class="bg-surface border border-border rounded-3xl p-5 shadow-xs space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <input type="checkbox" :checked="selectedCuratorIds.includes(group.id)" @change="
                selectedCuratorIds.includes(group.id)
                  ? (selectedCuratorIds = selectedCuratorIds.filter((id) => id !== group.id))
                  : selectedCuratorIds.push(group.id)
                " class="w-4 h-4 rounded accent-primary cursor-pointer" />
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="font-bold text-sm text-text">{{ group.topic }}</h3>
                  <span
                    class="px-2 py-0.5 rounded-full text-[0.65rem] font-bold border border-primary/20 bg-primary/10 text-primary">
                    {{ group.level }}
                  </span>
                  <span class="px-2 py-0.5 rounded-full text-[0.65rem] font-bold border" :class="group.is_published
                      ? 'border-success/30 bg-success/10 text-success'
                      : 'border-warning/30 bg-warning/10 text-warning'
                    ">
                    {{ group.is_published ? 'Published' : 'Draft' }}
                  </span>
                </div>
                <p class="text-xs text-text-muted mt-0.5">{{ group.cards.length }} cards in deck</p>
              </div>
            </div>

            <div class="flex items-center gap-1.5">
              <button type="button" @click="handlePlayFlashcardGroup(group)"
                class="px-3 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Test / Study this flashcard deck">
                <Play class="w-3.5 h-3.5 fill-current" />
                <span>Study Deck</span>
              </button>

              <button type="button" @click="handleOpenEditFlashcardGroup(group)"
                class="p-2 rounded-xl border border-border text-text-muted hover:text-primary hover:bg-surface-hover transition-colors cursor-pointer"
                title="Edit deck & cards">
                <PenLine class="w-4 h-4 text-primary" />
              </button>

              <button type="button" @click="handleTogglePublishGroup(group)"
                class="p-2 rounded-xl border border-border text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
                :title="group.is_published ? 'Move deck to drafts' : 'Publish deck to students'">
                <EyeOff v-if="group.is_published" class="w-4 h-4 text-warning" />
                <Eye v-else class="w-4 h-4 text-success" />
              </button>

              <button type="button" @click="handleDeleteGroup(group)"
                class="p-2 rounded-xl border border-border text-text-muted hover:text-danger hover:bg-surface-hover transition-colors cursor-pointer"
                title="Delete deck">
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>

          <!-- Full Cards List in Deck -->
          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-3 border-t border-border/60">
            <div v-for="card in group.cards" :key="card.id"
              class="p-3 rounded-xl bg-bg/50 border border-border/80 hover:border-primary/40 transition-all flex items-center justify-between gap-2.5 group/card">
              <div class="flex items-center gap-2.5 min-w-0 flex-1">
                <div v-if="card.image_url"
                  class="w-11 h-11 rounded-lg overflow-hidden shrink-0 border border-border bg-surface">
                  <img :src="card.image_url" alt="" class="w-full h-full object-cover" referrerpolicy="no-referrer" />
                </div>
                <div v-else
                  class="w-11 h-11 rounded-lg shrink-0 border border-border bg-surface flex items-center justify-center text-text-muted">
                  <ImageIcon class="w-4 h-4 opacity-50" />
                </div>
                <div class="min-w-0 flex-1">
                  <div class="font-bold text-xs text-text truncate" :title="card.front">{{ card.front }}</div>
                  <div v-if="card.back || card.explanation" class="text-[0.68rem] text-text-muted truncate mt-0.5" :title="card.back || card.explanation">
                    {{ card.back || card.explanation }}
                  </div>
                </div>
              </div>

              <div class="flex items-center gap-1 shrink-0 opacity-80 group-hover/card:opacity-100 transition-opacity">
                <button type="button" @click="handleTogglePublishSingleCard(card)"
                  class="p-1.5 rounded-lg border border-border bg-surface text-text-muted hover:text-text transition-colors cursor-pointer"
                  :title="card.is_published ? 'Move card to drafts' : 'Publish card'">
                  <EyeOff v-if="card.is_published" class="w-3.5 h-3.5 text-warning" />
                  <Eye v-else class="w-3.5 h-3.5 text-success" />
                </button>
                <button type="button" @click="handleDeleteSingleCard(card)"
                  class="p-1.5 rounded-lg border border-border bg-surface text-text-muted hover:text-danger transition-colors cursor-pointer"
                  title="Delete card">
                  <Trash2 class="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- SIMULATIONS CURATOR LIST -->
      <div v-if="activeCuratorTab === 'simulations'" class="space-y-4">
        <div v-if="activeSimulations.length === 0"
          class="text-center py-16 text-text-muted bg-surface border border-border rounded-3xl">
          <Clapperboard class="w-10 h-10 mx-auto mb-2 opacity-40 text-primary" />
          <p class="text-xs font-bold text-text">No simulation scenarios found</p>
          <p class="text-[0.7rem] text-text-muted mt-1">Try changing your level/status filters or generate new scenarios
            in Configure & Generate.</p>
        </div>

        <div v-for="sim in activeSimulations" :key="sim.id"
          class="bg-surface border border-border rounded-3xl p-5 shadow-xs space-y-4">
          <div class="flex flex-wrap items-center justify-between gap-3">
            <div class="flex items-center gap-3">
              <input type="checkbox" :checked="selectedCuratorIds.includes(sim.id)" @change="
                selectedCuratorIds.includes(sim.id)
                  ? (selectedCuratorIds = selectedCuratorIds.filter((id) => id !== sim.id))
                  : selectedCuratorIds.push(sim.id)
                " class="w-4 h-4 rounded accent-primary cursor-pointer" />
              <div>
                <div class="flex items-center gap-2 flex-wrap">
                  <span class="text-xl">🎭</span>
                  <h3 class="font-bold text-sm text-text">{{ sim.topic || sim.name }}</h3>
                  <span
                    class="px-2 py-0.5 rounded-full text-[0.65rem] font-bold border border-primary/20 bg-primary/10 text-primary">
                    {{ sim.level || 'A1' }}
                  </span>
                  <span class="px-2 py-0.5 rounded-full text-[0.65rem] font-bold border" :class="sim.is_published
                      ? 'border-success/30 bg-success/10 text-success'
                      : 'border-warning/30 bg-warning/10 text-warning'
                    ">
                    {{ sim.is_published ? 'Published' : 'Draft' }}
                  </span>
                </div>
              </div>
            </div>

            <div class="flex items-center gap-2">
              <button type="button" @click="handleLaunchSimulation(sim)"
                class="px-3 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer">
                <Play class="w-3.5 h-3.5 fill-current" />
                <span>Test Voice</span>
              </button>

              <button type="button" @click="handleOpenEditSimulation(sim)"
                class="p-2 rounded-xl border border-border text-text-muted hover:text-primary hover:bg-surface-hover transition-colors cursor-pointer"
                title="Edit simulation">
                <PenLine class="w-4 h-4 text-primary" />
              </button>

              <button type="button" @click="handleTogglePublishSim(sim)"
                class="p-2 rounded-xl border border-border text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
                :title="sim.is_published ? 'Move to drafts' : 'Publish simulation'">
                <EyeOff v-if="sim.is_published" class="w-4 h-4 text-warning" />
                <Eye v-else class="w-4 h-4 text-success" />
              </button>

              <button type="button" @click="handleDeleteSim(sim.id)"
                class="p-2 rounded-xl border border-border text-text-muted hover:text-danger hover:bg-surface-hover transition-colors cursor-pointer">
                <Trash2 class="w-4 h-4" />
              </button>
            </div>
          </div>

          <p class="text-xs text-text-muted leading-relaxed">{{ sim.scenario }}</p>

          <div v-if="sim.goal" class="p-3 bg-bg/50 rounded-2xl border border-border/80 text-xs">
            <span class="font-bold text-text">Pedagogical Goal: </span>
            <span class="text-text-muted">{{ sim.goal }}</span>
          </div>
        </div>
      </div>
    </div>

    <!-- EDIT MODAL FOR FLASHCARD DECKS & SIMULATIONS -->
    <Teleport to="body">
      <div v-if="isEditModalOpen"
        class="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200"
        @click.self="isEditModalOpen = false">
        <div
          class="bg-surface border border-border rounded-3xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200"
          @click.stop>
          <!-- Modal Header -->
          <div class="p-6 border-b border-border flex items-center justify-between">
            <div class="flex items-center gap-3">
              <div class="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center font-bold">
                <BookOpen v-if="editingType === 'flashcard'" class="w-5 h-5" />
                <Clapperboard v-else class="w-5 h-5" />
              </div>
              <div>
                <h3 class="font-bold text-base text-text">
                  {{ editingType === 'flashcard' ? 'Edit CEFR Flashcard Deck' : 'Edit CEFR Simulation' }}
                </h3>
                <p class="text-xs text-text-muted">
                  {{ editingType === 'flashcard' ? `Step ${activeEditStep} of 2` : 'Configure scenario details and goals' }}
                </p>
              </div>
            </div>

            <button type="button" @click="isEditModalOpen = false"
              class="p-2 rounded-xl text-text-muted hover:bg-surface-hover transition-colors cursor-pointer">
              <X class="w-5 h-5" />
            </button>
          </div>

          <!-- Modal Body: Flashcard Deck -->
          <div v-if="editingType === 'flashcard'" class="flex-1 overflow-y-auto p-6 space-y-5 custom-scrollbar">
            <div v-if="activeEditStep === 1" class="space-y-4">
              <div>
                <label class="block text-xs font-bold text-text mb-1.5">Deck Topic / Title *</label>
                <input v-model="editForm.topic" type="text"
                  class="w-full px-4 py-2.5 rounded-xl bg-bg border border-border text-xs text-text outline-none focus:border-primary" />
              </div>

              <div>
                <label class="block text-xs font-bold text-text mb-1.5">CEFR Level</label>
                <select v-model="editForm.level"
                  class="w-full px-4 py-2.5 rounded-xl bg-bg border border-border text-xs text-text outline-none focus:border-primary cursor-pointer font-bold">
                  <option v-for="lvl in ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']" :key="lvl" :value="lvl">
                    {{ lvl }}
                  </option>
                </select>
              </div>

              <label class="flex items-center gap-2.5 text-xs font-bold text-text cursor-pointer pt-2">
                <input v-model="editForm.is_published" type="checkbox" class="rounded accent-primary w-4 h-4" />
                <span>Publish deck to students</span>
              </label>
            </div>

            <div v-else class="space-y-4">
              <div class="flex items-center justify-between">
                <span class="text-xs font-bold text-text">Cards in Deck ({{ (editForm.cards || []).length }})</span>
                <button type="button" @click="handleAddCardToEditForm"
                  class="px-3 py-1.5 rounded-xl bg-primary/10 text-primary hover:bg-primary/20 text-xs font-bold flex items-center gap-1 cursor-pointer">
                  <Plus class="w-3.5 h-3.5" />
                  <span>Add Card</span>
                </button>
              </div>

              <div v-for="(c, idx) in editForm.cards" :key="idx"
                class="p-4 rounded-2xl bg-bg border border-border space-y-3">
                <div class="flex items-center justify-between">
                  <span class="text-xs font-bold text-primary">Card #{{ Number(idx) + 1 }}</span>
                  <button type="button" @click="handleRemoveCardFromEditForm(Number(idx))"
                    class="text-text-muted hover:text-danger p-1 cursor-pointer">
                    <Trash2 class="w-4 h-4" />
                  </button>
                </div>

                <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <label class="block text-[0.7rem] font-bold text-text-muted mb-1">Front (Target Word/Phrase) *</label>
                    <input v-model="c.front" type="text"
                      class="w-full px-3 py-2 rounded-xl bg-surface border border-border text-xs text-text outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label class="block text-[0.7rem] font-bold text-text-muted mb-1">Image URL</label>
                    <input v-model="c.image_url" type="text" placeholder="https://..."
                      class="w-full px-3 py-2 rounded-xl bg-surface border border-border text-xs text-text outline-none focus:border-primary" />
                  </div>
                </div>

                <div>
                  <label class="block text-[0.7rem] font-bold text-text-muted mb-1">Clue / Explanation (Back)</label>
                  <input v-model="c.back" type="text"
                    class="w-full px-3 py-2 rounded-xl bg-surface border border-border text-xs text-text outline-none focus:border-primary" />
                </div>
              </div>
            </div>
          </div>

          <!-- Modal Body: Simulation -->
          <div v-else-if="editingType === 'simulation'" class="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar">
            <div>
              <label class="block text-xs font-bold text-text mb-1.5">Scenario Topic *</label>
              <input v-model="editForm.topic" type="text"
                class="w-full px-4 py-2.5 rounded-xl bg-bg border border-border text-xs text-text outline-none focus:border-primary" />
            </div>

            <div>
              <label class="block text-xs font-bold text-text mb-1.5">CEFR Level</label>
              <select v-model="editForm.level"
                class="w-full px-4 py-2.5 rounded-xl bg-bg border border-border text-xs text-text outline-none focus:border-primary cursor-pointer font-bold">
                <option v-for="lvl in ['A1', 'A2', 'B1', 'B2', 'C1', 'C2']" :key="lvl" :value="lvl">
                  {{ lvl }}
                </option>
              </select>
            </div>

            <div>
              <label class="block text-xs font-bold text-text mb-1.5">Scenario Description / System Prompt</label>
              <textarea v-model="editForm.scenario" rows="4"
                class="w-full px-4 py-2.5 rounded-xl bg-bg border border-border text-xs text-text outline-none focus:border-primary custom-scrollbar" />
            </div>

            <div>
              <label class="block text-xs font-bold text-text mb-1.5">Pedagogical Goal</label>
              <textarea v-model="editForm.goal" rows="2"
                class="w-full px-4 py-2.5 rounded-xl bg-bg border border-border text-xs text-text outline-none focus:border-primary custom-scrollbar" />
            </div>

            <label class="flex items-center gap-2.5 text-xs font-bold text-text cursor-pointer pt-2">
              <input v-model="editForm.is_published" type="checkbox" class="rounded accent-primary w-4 h-4" />
              <span>Publish simulation to students</span>
            </label>
          </div>

          <!-- Modal Footer -->
          <div class="p-4 px-6 border-t border-border flex items-center justify-between gap-2 bg-surface">
            <div>
              <button v-if="editingType === 'flashcard' && activeEditStep === 2" type="button"
                @click="activeEditStep = 1"
                class="px-4 py-2 rounded-xl border border-border text-xs font-bold text-text hover:bg-surface-hover flex items-center gap-1 cursor-pointer">
                <ChevronLeft class="w-4 h-4" />
                <span>Previous</span>
              </button>
            </div>

            <div class="flex items-center gap-2">
              <button type="button" @click="isEditModalOpen = false"
                class="px-4 py-2 rounded-xl border border-border text-xs font-bold text-text hover:bg-surface-hover cursor-pointer">
                Cancel
              </button>

              <button v-if="editingType === 'flashcard' && activeEditStep === 1" type="button"
                @click="activeEditStep = 2"
                class="px-5 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover flex items-center gap-1 cursor-pointer">
                <span>Next: Edit Cards</span>
                <ChevronRight class="w-4 h-4" />
              </button>

              <button v-else type="button" @click="handleSaveEditModal" :disabled="isSavingEdit"
                class="px-6 py-2 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover flex items-center gap-1.5 cursor-pointer disabled:opacity-50">
                <CheckCircle2 class="w-4 h-4" />
                <span>{{ isSavingEdit ? 'Saving...' : 'Save Changes' }}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
