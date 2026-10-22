<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  X,
  User,
  CheckCircle,
  BarChart2,
  AlertCircle,
  Brain,
  Target,
  Clock,
  Trash2,
  Save,
  RefreshCw,
  Sparkles,
  Send,
  Flame,
} from 'lucide-vue-next';
import { apiGet, apiPut, apiPost, apiDelete } from '@/api/client';
import { CEFR_LEVELS, normalizeLevel } from '@/constants/levels';
import { DEFAULT_AVATAR_URL } from '@/constants/user';
import { useToast } from '@/composables/useToast';
import { useBodyScrollLock } from '@/composables/useBodyScrollLock';
import { formatDateTime, formatLastActive, isUserActiveNow } from '@/utils';

const props = defineProps<{
  isOpen: boolean;
  student: any;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'update'): void;
}>();

const toast = useToast();
useBodyScrollLock(computed(() => props.isOpen));

const activeTab = ref<'info' | 'progress' | 'analytics' | 'prompt' | 'insight' | 'interests'>('info');
const localStudent = ref<any>({});
const isDeleting = ref(false);
const isGenerating = ref(false);
const isAnalyzingInterests = ref(false);
const insight = ref<string | null>(null);
const interests = ref<any[]>([]);
const recommendations = ref<any[]>([]);
const promptText = ref('');
const analytics = ref<any>(null);
const isFetchingAnalytics = ref(false);
const nudgeMessage = ref('');
const isNudging = ref(false);
const activityProgress = ref<any>(null);
const isFetchingProgress = ref(false);
const pronunciationData = ref<any>(null);
const isFetchingPronunciation = ref(false);

// Submissions filter in Progress tab
const progressFilter = ref<'all' | 'grammar' | 'vocabulary' | 'listening' | 'reading' | 'simulations' | 'games' | 'news'>('all');
const visibleSubmissionsCount = ref(20);

watch(
  () => props.student,
  (std, oldStd) => {
    if (std) {
      const isDifferentStudent =
        !oldStd || std.username !== oldStd.username;
      localStudent.value = { ...std };
      if (isDifferentStudent) {
        promptText.value = std.custom_prompt || '';
        insight.value = null;
        interests.value = [];
        recommendations.value = [];
        analytics.value = null;
        activityProgress.value = null;
        nudgeMessage.value = `Hi ${std.name || std.username}! Teacher Tati here...`;
        if (activeTab.value === 'analytics') fetchAnalytics();
        else if (activeTab.value === 'progress') fetchActivityProgress();
      }
    }
  },
  { immediate: true },
);

watch(
  () => activeTab.value,
  (tab) => {
    if (
      tab === 'analytics' &&
      !analytics.value &&
      localStudent.value.username
    ) {
      fetchAnalytics();
    } else if (tab === 'progress' && localStudent.value.username) {
      if (!activityProgress.value) fetchActivityProgress();
      if (!pronunciationData.value) fetchPronunciationPractice();
    }
  },
);

async function handleUpdateLevel(lvl: string) {
  try {
    await apiPut(`/dashboard/students/${encodeURIComponent(localStudent.value.username)}`, {
      level: lvl,
    });
    localStudent.value.level = lvl;
    toast.success('Level updated successfully!');
    emit('update');
  } catch (err) {
    console.error('Error updating level:', err);
    toast.error('Failed to update level.');
  }
}

async function handleSavePrompt() {
  try {
    await apiPut(`/dashboard/students/${encodeURIComponent(localStudent.value.username)}`, {
      custom_prompt: promptText.value,
    });
    localStudent.value.custom_prompt = promptText.value;
    toast.success('Prompt saved! Takes effect on next message.');
    emit('update');
  } catch (err) {
    console.error('Error saving prompt:', err);
    toast.error('Failed to save prompt.');
  }
}

async function handleDelete() {
  if (!confirm(`Are you sure you want to delete student ${localStudent.value.username}? This action is irreversible.`)) return;
  isDeleting.value = true;
  try {
    await apiDelete(`/dashboard/students/${encodeURIComponent(localStudent.value.username)}`);
    toast.success('Student deleted successfully.');
    emit('update');
    emit('close');
  } catch (err) {
    console.error('Error deleting student:', err);
    toast.error('Error deleting student.');
  } finally {
    isDeleting.value = false;
  }
}

async function fetchAnalytics() {
  if (!localStudent.value.username) return;
  isFetchingAnalytics.value = true;
  try {
    const res = await apiGet<any>(`/dashboard/students/${encodeURIComponent(localStudent.value.username)}/analytics`);
    analytics.value = res;
  } catch (err) {
    console.error('Error fetching analytics:', err);
  } finally {
    isFetchingAnalytics.value = false;
  }
}


async function fetchPronunciationPractice() {
  if (!localStudent.value.username) return;
  isFetchingPronunciation.value = true;
  try {
    const res = await apiGet<any>(
      `/dashboard/students/${encodeURIComponent(localStudent.value.username)}/pronunciation-practice`
    );
    pronunciationData.value = res;
  } catch (err) {
    console.error('Error fetching pronunciation practice:', err);
  } finally {
    isFetchingPronunciation.value = false;
  }
}
async function fetchActivityProgress() {
  if (!localStudent.value.username) return;
  isFetchingProgress.value = true;
  try {
    const res = await apiGet<any>(`/dashboard/students/${encodeURIComponent(localStudent.value.username)}/activity-progress`);
    activityProgress.value = res;
  } catch (err) {
    console.error('Error fetching activity progress:', err);
  } finally {
    isFetchingProgress.value = false;
  }
}

async function handleGenerateInsight() {
  isGenerating.value = true;
  try {
    const res = await apiGet<{ insight: string }>(
      `/dashboard/students/${encodeURIComponent(localStudent.value.username)}/insight?lang=en-US`
    );
    insight.value = res.insight;
    toast.success('Insight generated successfully!');
  } catch (err) {
    console.error('Error generating insight:', err);
    toast.error('Error generating insight.');
  } finally {
    isGenerating.value = false;
  }
}

async function handleGenerateGrammarErrors() {
  isGenerating.value = true;
  try {
    const res = await apiGet<{ errors: any[] }>(
      `/dashboard/students/${encodeURIComponent(localStudent.value.username)}/grammar-errors?lang=en-US`
    );
    const errorList =
      res.errors?.map((e: any) => `${e.category}: ${e.count}x`).join('\n') ||
      'No grammar errors detected in the latest messages.';
    insight.value = `Grammar Errors\n\n${errorList}`;
    toast.success('Grammar errors analyzed!');
  } catch (err) {
    console.error('Error analyzing grammar errors:', err);
    toast.error('Error analyzing grammar errors.');
  } finally {
    isGenerating.value = false;
  }
}

async function handleFetchInterests() {
  isAnalyzingInterests.value = true;
  try {
    const res = await apiGet<{ interests: string[]; recommendations: any[] }>(
      `/dashboard/students/${encodeURIComponent(localStudent.value.username)}/recommendations?lang=en-US`
    );
    interests.value = res.interests || [];
    recommendations.value = res.recommendations || [];
    toast.success('Interests analyzed successfully!');
  } catch (err) {
    console.error('Error analyzing interests:', err);
    toast.error('Error analyzing interests.');
  } finally {
    isAnalyzingInterests.value = false;
  }
}

async function handleSendNudge() {
  if (!nudgeMessage.value.trim()) return;
  isNudging.value = true;
  try {
    await apiPost(`/dashboard/students/${encodeURIComponent(localStudent.value.username)}/nudge`, {
      message: nudgeMessage.value.trim(),
    });
    toast.success('Student nudged successfully!');
  } catch (err) {
    console.error('Error sending nudge:', err);
    toast.error('Failed to send nudge.');
  } finally {
    isNudging.value = false;
  }
}

function getHostFromUrl(rawUrl: string): string {
  if (!rawUrl) return '';
  if (rawUrl.includes('test-english.com')) return 'test-english.com';
  if (rawUrl.startsWith('http')) {
    try {
      return new URL(rawUrl).hostname;
    } catch {
      return rawUrl;
    }
  }
  return rawUrl;
}

const filteredSubmissions = computed(() => {
  const subs = activityProgress.value?.submissions || [];
  if (progressFilter.value === 'all') return subs;

  return subs.filter((s: any) => {
    const cat = String(s.category || s.activity_type || '').toLowerCase().trim();
    const title = String(s.title || '').toLowerCase();
    const url = String(s.url || '').toLowerCase();

    if (progressFilter.value === 'vocabulary') {
      return cat === 'vocab' || cat === 'vocabulary' || cat.includes('vocab') || title.includes('vocab') || url.includes('vocab');
    }
    if (progressFilter.value === 'listening') {
      return cat === 'listening' || cat === 'listenings' || cat === 'podcast' || cat === 'podcasts' || cat.includes('listen') || title.includes('listening');
    }
    if (progressFilter.value === 'simulations') {
      return cat === 'simulation' || cat === 'simulations' || cat.includes('simul') || title.includes('simulation');
    }
    if (progressFilter.value === 'games') {
      return cat === 'game' || cat === 'games' || cat.includes('game') || cat.includes('wordwall') || url.includes('wordwall');
    }
    if (progressFilter.value === 'news') {
      return cat === 'news' || cat === 'article' || cat === 'articles' || cat.includes('news') || title.includes('news');
    }
    if (progressFilter.value === 'grammar') {
      return cat === 'grammar' || cat.includes('gramm') || title.includes('grammar') || url.includes('grammar');
    }
    if (progressFilter.value === 'reading') {
      return cat === 'reading' || cat.includes('read') || title.includes('reading') || url.includes('reading');
    }
    return cat === progressFilter.value;
  });
});

const displayedSubmissions = computed(() => {
  return filteredSubmissions.value.slice(0, visibleSubmissionsCount.value);
});

const progressTabs = [
  { id: 'all', label: 'All' },
  { id: 'grammar', label: 'Grammar' },
  { id: 'vocabulary', label: 'Vocab' },
  { id: 'listening', label: 'Listening' },
  { id: 'reading', label: 'Reading' },
  { id: 'simulations', label: 'Simulations' },
  { id: 'games', label: 'Games' },
  { id: 'news', label: 'News' },
] as const;
</script>

<template>
  <Teleport to="body">
    <div v-if="isOpen && student"
      class="fixed inset-0 z-[99999] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200"
      @click="emit('close')">
      <div role="dialog" aria-modal="true"
        class="relative w-full max-w-2xl bg-surface border border-border rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh] mx-auto animate-in zoom-in-95 duration-200"
        @click.stop>
        <!-- Header -->
        <div class="px-6 py-4 border-b border-border bg-bg-secondary/40 flex items-center justify-between">
          <div class="flex items-center gap-3 min-w-0">
            <div
              class="w-10 h-10 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-primary font-bold overflow-hidden shrink-0">
              <img v-if="localStudent.avatar_url && localStudent.avatar_url !== DEFAULT_AVATAR_URL"
                :src="localStudent.avatar_url" alt="Avatar" class="w-full h-full object-cover"
                @error="(e: any) => { e.currentTarget.style.display = 'none'; }" />
              <span v-else>{{ (localStudent.name || localStudent.username || '?').charAt(0).toUpperCase() }}</span>
            </div>
            <div class="min-w-0">
              <h3 class="font-display font-bold text-base text-text truncate">
                {{ localStudent.name || localStudent.username }}
              </h3>
              <p class="text-xs text-text-muted truncate">@{{ localStudent.username }}</p>
            </div>
          </div>

          <button type="button" aria-label="Close modal" @click="emit('close')"
            class="p-1.5 rounded-lg text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer">
            <X class="w-5 h-5" />
          </button>
        </div>

        <!-- Navigation Tabs (6 Full Tabs) -->
        <div class="flex bg-bg-secondary p-1.5 border-b border-border overflow-x-auto no-scrollbar shrink-0 gap-1">
          <button type="button" @click="activeTab = 'info'"
            class="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap"
            :class="activeTab === 'info' ? 'bg-surface text-primary shadow-xs' : 'text-text-muted hover:text-text'">
            <User class="w-3.5 h-3.5" />
            <span>Profile</span>
          </button>

          <button type="button" @click="activeTab = 'progress'"
            class="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap"
            :class="activeTab === 'progress' ? 'bg-surface text-primary shadow-xs' : 'text-text-muted hover:text-text'">
            <CheckCircle class="w-3.5 h-3.5" />
            <span>Progress</span>
          </button>

          <button type="button" @click="activeTab = 'analytics'"
            class="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap"
            :class="activeTab === 'analytics' ? 'bg-surface text-primary shadow-xs' : 'text-text-muted hover:text-text'">
            <BarChart2 class="w-3.5 h-3.5" />
            <span>Analytics</span>
          </button>

          <button type="button" @click="activeTab = 'prompt'"
            class="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap"
            :class="activeTab === 'prompt' ? 'bg-surface text-primary shadow-xs' : 'text-text-muted hover:text-text'">
            <AlertCircle class="w-3.5 h-3.5" />
            <span>Prompt</span>
          </button>

          <button type="button" @click="activeTab = 'insight'"
            class="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap"
            :class="activeTab === 'insight' ? 'bg-surface text-primary shadow-xs' : 'text-text-muted hover:text-text'">
            <Brain class="w-3.5 h-3.5" />
            <span>Insight</span>
          </button>

          <button type="button" @click="activeTab = 'interests'"
            class="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all whitespace-nowrap"
            :class="activeTab === 'interests' ? 'bg-surface text-primary shadow-xs' : 'text-text-muted hover:text-text'">
            <Target class="w-3.5 h-3.5" />
            <span>Interests</span>
          </button>
        </div>

        <!-- Tab Content Area -->
        <div class="p-6 overflow-y-auto space-y-6 custom-scrollbar text-xs flex-1">
          <!-- 1. PROFILE TAB -->
          <div v-if="activeTab === 'info'" class="space-y-6 animate-fade-in">
            <!-- Student Banner -->
            <div class="flex items-center gap-4 p-4 bg-bg-secondary/50 rounded-2xl border border-border">
              <div
                class="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center text-xl font-bold text-primary overflow-hidden shrink-0">
                <img v-if="localStudent.avatar_url && localStudent.avatar_url !== DEFAULT_AVATAR_URL"
                  :src="localStudent.avatar_url" alt="" class="w-full h-full rounded-full object-cover"
                  @error="(e: any) => { e.currentTarget.style.display = 'none'; }" />
                <span v-else>{{ (localStudent.name || localStudent.username || '?').charAt(0).toUpperCase() }}</span>
              </div>
              <div class="min-w-0">
                <div class="flex items-center gap-2 flex-wrap">
                  <h3 class="font-bold text-base text-text">@{{ localStudent.username }}</h3>
                  <span v-if="localStudent.role === 'lead'"
                    class="px-2 py-0.5 rounded-full bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20 text-[0.65rem] font-bold">
                    Lead (CEFR)
                  </span>
                  <span v-else-if="localStudent.role === 'buyer'"
                    class="px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[0.65rem] font-bold">
                    Buyer
                  </span>
                  <span v-else
                    class="px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20 text-[0.65rem] font-bold">
                    Aluno
                  </span>
                </div>
                <p class="text-xs text-text-muted flex items-center gap-1 mt-1">
                  <Clock class="w-3.5 h-3.5" /> Joined: {{ formatDateTime(localStudent.created_at ||
                    localStudent.joined) }}
                </p>
                <p class="text-xs text-text-muted flex items-center gap-1.5 mt-0.5">
                  <Clock class="w-3.5 h-3.5" />
                  <span>Last active:</span>
                  <span v-if="isUserActiveNow(localStudent.last_active)"
                    class="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[0.65rem] font-bold bg-success/15 text-success border border-success/30">
                    <span class="w-1.5 h-1.5 rounded-full bg-success animate-pulse" />
                    Using now
                  </span>
                  <span v-else>{{ formatLastActive(localStudent.last_active) }}</span>
                </p>
              </div>
            </div>

            <!-- Metadata Stat Cards -->
            <div class="grid grid-cols-2 gap-3">
              <div class="p-3.5 bg-surface border border-border rounded-xl">
                <span class="text-[0.65rem] font-bold text-text-subtle uppercase tracking-wider block">Messages</span>
                <p class="text-base font-bold text-text mt-1">
                  {{ localStudent.total_messages || localStudent.messages_count || 0 }}
                </p>
              </div>
              <div class="p-3.5 bg-surface border border-border rounded-xl">
                <span class="text-[0.65rem] font-bold text-text-subtle uppercase tracking-wider block">Streak</span>
                <p class="text-base font-bold text-warning mt-1">
                   {{ localStudent.current_streak ?? localStudent.streak_count ?? 0 }} days
                </p>
              </div>
            </div>

            <!-- CEFR Level Selector Grid -->
            <div class="space-y-3">
              <label class="text-xs font-bold text-text-muted uppercase tracking-widest block">
                CEFR English Level
              </label>
              <div class="grid grid-cols-3 sm:grid-cols-6 gap-2">
                <button v-for="lvl in CEFR_LEVELS" :key="lvl" type="button" @click="handleUpdateLevel(lvl)"
                  class="px-3 py-2.5 rounded-xl text-xs font-bold border transition-all text-center" :class="normalizeLevel(localStudent.level) === lvl
                    ? 'bg-primary border-primary text-white shadow-xs'
                    : 'border-border bg-surface hover:border-primary/40 text-text'
                    ">
                  {{ lvl }}
                </button>
              </div>
            </div>

            <!-- Delete Student Button -->
            <div class="pt-4 border-t border-border">
              <button type="button" @click="handleDelete" :disabled="isDeleting"
                class="w-full py-2.5 px-4 rounded-xl border border-danger/30 text-danger hover:bg-danger/10 transition-colors font-bold flex items-center justify-center gap-2">
                <Trash2 class="w-4 h-4" />
                <span>{{ isDeleting ? 'Deleting student...' : 'Delete student' }}</span>
              </button>
            </div>
          </div>

          <!-- 2. PROGRESS TAB -->
          <div v-else-if="activeTab === 'progress'" class="space-y-5 animate-fade-in">
            <div v-if="isFetchingProgress" class="py-12 flex justify-center items-center">
              <RefreshCw class="w-6 h-6 animate-spin text-primary" />
            </div>

            <div v-else-if="!activityProgress" class="text-center py-10 text-text-muted">
              No activity progress data available for this student.
            </div>

            <div v-else class="space-y-5">
              <!-- Summary 8 Cards Grid -->
              <div class="grid grid-cols-4 gap-2">
                <div class="p-2.5 bg-surface border border-border rounded-xl">
                  <span
                    class="text-[0.6rem] font-bold text-text-subtle uppercase tracking-wider block truncate">Grammar</span>
                  <p class="text-base font-black text-text mt-0.5">{{ activityProgress.summary?.grammar || 0 }}</p>
                </div>
                <div class="p-2.5 bg-surface border border-border rounded-xl">
                  <span
                    class="text-[0.6rem] font-bold text-text-subtle uppercase tracking-wider block truncate">Vocab</span>
                  <p class="text-base font-black text-text mt-0.5">{{ activityProgress.summary?.vocabulary || 0 }}</p>
                </div>
                <div class="p-2.5 bg-surface border border-border rounded-xl">
                  <span
                    class="text-[0.6rem] font-bold text-text-subtle uppercase tracking-wider block truncate">Listening</span>
                  <p class="text-base font-black text-text mt-0.5">{{ activityProgress.summary?.listening || 0 }}</p>
                </div>
                <div class="p-2.5 bg-surface border border-border rounded-xl">
                  <span
                    class="text-[0.6rem] font-bold text-text-subtle uppercase tracking-wider block truncate">Reading</span>
                  <p class="text-base font-black text-text mt-0.5">{{ activityProgress.summary?.reading || 0 }}</p>
                </div>
                <div class="p-2.5 bg-surface border border-border rounded-xl">
                  <span
                    class="text-[0.6rem] font-bold text-text-subtle uppercase tracking-wider block truncate">Flashcards</span>
                  <p class="text-base font-black text-text mt-0.5">{{ activityProgress.summary?.flashcards || 0 }}</p>
                </div>
                <div class="p-2.5 bg-surface border border-border rounded-xl">
                  <span
                    class="text-[0.6rem] font-bold text-text-subtle uppercase tracking-wider block truncate">Simulations</span>
                  <p class="text-base font-black text-text mt-0.5">{{ activityProgress.summary?.simulations || 0 }}</p>
                </div>
                <div class="p-2.5 bg-surface border border-border rounded-xl">
                  <span
                    class="text-[0.6rem] font-bold text-text-subtle uppercase tracking-wider block truncate">Games</span>
                  <p class="text-base font-black text-text mt-0.5">{{ activityProgress.summary?.games || 0 }}</p>
                </div>
                <div class="p-2.5 bg-surface border border-border rounded-xl">
                  <span
                    class="text-[0.6rem] font-bold text-text-subtle uppercase tracking-wider block truncate">News</span>
                  <p class="text-base font-black text-text mt-0.5">{{ activityProgress.summary?.news || 0 }}</p>
                </div>
              </div>

              <!-- Submissions Filter & List -->
              <div class="space-y-3">
                <div class="flex items-center justify-between border-b border-border pb-2">
                  <h4 class="text-xs font-bold text-text-muted uppercase tracking-widest">
                    Completed Activities & Exercises
                  </h4>
                  <span class="text-[0.65rem] bg-primary/10 text-primary px-2 py-0.5 rounded-full font-bold">
                    {{ filteredSubmissions.length }} found
                  </span>
                </div>

                <!-- Filter tabs -->
                <div class="flex bg-bg-secondary p-1 rounded-xl overflow-x-auto no-scrollbar gap-1">
                  <button v-for="t in progressTabs" :key="t.id" type="button" @click="progressFilter = t.id"
                    class="px-2.5 py-1 rounded-lg text-[0.65rem] font-bold transition-all whitespace-nowrap"
                    :class="progressFilter === t.id ? 'bg-surface text-primary shadow-xs' : 'text-text-muted hover:text-text'">
                    {{ t.label }}
                  </button>
                </div>

                <!-- Submissions items list -->
                <div class="space-y-2 max-h-[220px] overflow-y-auto pr-1 custom-scrollbar">
                  <p v-if="displayedSubmissions.length === 0" class="text-center py-6 text-xs text-text-muted">
                    No completed items in this category.
                  </p>

                  <div v-for="s in displayedSubmissions" :key="s.id"
                    class="p-3 bg-bg-secondary/40 border border-border rounded-xl flex items-center justify-between text-xs hover:border-primary/30 transition-all">
                    <div class="flex items-center gap-2.5 min-w-0">
                      <span class="w-2 h-2 rounded-full bg-success shrink-0" />
                      <div class="min-w-0">
                        <p class="font-bold text-text truncate max-w-[260px]">
                          {{ s.title || 'Exercise' }}
                        </p>
                        <div class="flex items-center gap-1.5 mt-0.5 flex-wrap">
                          <span
                            class="px-1.5 py-0.2 bg-primary/10 text-primary rounded text-[0.55rem] font-bold uppercase tracking-wider">
                            {{ s.category || 'general' }}
                          </span>
                          <a v-if="s.url" :href="s.url" target="_blank" rel="noopener noreferrer"
                            class="text-[0.6rem] text-text-muted hover:text-primary hover:underline truncate max-w-[150px]">
                            {{ getHostFromUrl(s.url) }}
                          </a>
                        </div>
                      </div>
                    </div>

                    <div class="flex items-center gap-2 shrink-0 text-right">
                      <span v-if="s.score != null"
                        class="font-extrabold text-success bg-success/15 px-2 py-0.5 rounded text-[0.65rem]">
                        {{ s.score }}%
                      </span>
                      <span class="text-[0.6rem] text-text-muted capitalize">
                        {{ s.status }}
                      </span>
                    </div>
                  </div>

                  <button v-if="filteredSubmissions.length > visibleSubmissionsCount" type="button"
                    @click="visibleSubmissionsCount += 20"
                    class="w-full py-2 text-xs font-bold text-primary hover:bg-primary/5 rounded-xl border border-primary/20 transition-all cursor-pointer">
                    Load more (+{{ filteredSubmissions.length - visibleSubmissionsCount }})
                  </button>
                </div>
              </div>


              
              <!-- Pronunciation Practice Section -->
              <div class="space-y-3 pt-3 border-t border-border">
                <div class="flex items-center justify-between">
                  <div>
                    <h4 class="text-xs font-bold text-text uppercase tracking-widest flex items-center gap-1.5">
                      Pronunciation Practice
                    </h4>
                    <p class="text-[0.65rem] text-text-muted mt-0.5">
                      Total: {{ pronunciationData?.total_pronunciations || 0 }} sessions <span class="mx-1.5 opacity-50">|</span> {{ pronunciationData?.pronunciation_completed || 0 }} proficient (&gt;=70%)
                    </p>
                  </div>
                  <div v-if="pronunciationData?.last_practice_date" class="text-right">
                    <span class="text-[0.65rem] px-2 py-0.5 rounded-full bg-primary/10 text-primary font-bold">
                      Last practiced: {{ formatDateTime(pronunciationData.last_practice_date) }}
                    </span>
                  </div>
                </div>

                <div v-if="isFetchingPronunciation" class="py-4 text-center text-xs text-text-muted">
                  <RefreshCw class="w-4 h-4 animate-spin inline-block mr-1 text-primary" />
                  Loading pronunciation history...
                </div>

                <div
                  v-else-if="!pronunciationData?.pronunciation_list?.length"
                  class="p-4 rounded-xl border border-dashed border-border text-center text-xs text-text-muted"
                >
                  No pronunciation practice recorded yet.
                </div>

                <div v-else class="space-y-2 max-h-[250px] overflow-y-auto pr-1 custom-scrollbar">
                  <div
                    v-for="p in pronunciationData.pronunciation_list"
                    :key="p.id"
                    class="p-3 bg-bg-secondary/40 border border-border rounded-xl space-y-1.5 text-xs"
                  >
                    <div class="flex items-start justify-between gap-2">
                      <div class="min-w-0">
                        <span class="font-bold text-text truncate block max-w-[280px]">{{ p.target_phrase }}</span>
                        <span class="text-[0.62rem] text-text-muted flex items-center gap-1.5 mt-0.5">
                          <Clock class="w-3 h-3" /> Practiced on {{ formatDateTime(p.created_at) }}
                        </span>
                      </div>
                      <span
                        :class="[
                          'font-extrabold text-[0.65rem] px-2 py-0.5 rounded-full shrink-0',
                          p.score >= 80 ? 'bg-success/15 text-success' : p.score >= 60 ? 'bg-warning/15 text-warning' : 'bg-destructive/15 text-destructive'
                        ]"
                      >
                        {{ Math.round(p.score) }}%
                      </span>
                    </div>

                    <div v-if="p.spoken_phrase && p.spoken_phrase !== p.target_phrase" class="text-[0.7rem] text-text-muted">
                      Spoken: <span class="italic text-text">{{ p.spoken_phrase }}</span>
                    </div>

                    <div v-if="p.words_result?.length" class="flex flex-wrap gap-1 pt-0.5">
                      <span
                        v-for="(w, wIdx) in p.words_result"
                        :key="wIdx"
                        :class="[
                          'text-[0.65rem] px-1.5 py-0.2 rounded font-medium',
                          w.accuracy === 'correct' ? 'bg-success/10 text-success' : 'bg-destructive/15 text-destructive font-bold'
                        ]"
                        :title="w.tip || ''"
                      >
                        {{ w.word }}
                      </span>
                    </div>

                    <div class="text-[0.6rem] text-text-muted flex justify-between pt-1 border-t border-border/40">
                      <span>Mode: {{ p.mode || 'preset' }} ({{ p.accent || 'en-US' }})</span>
                      <span>{{ formatDateTime(p.created_at) }}</span>
                    </div>
                  </div>
                </div>
              </div>

              <!-- Flashcards Completed List -->
              <div v-if="activityProgress.flashcards?.length > 0" class="space-y-2">
                <h4 class="text-xs font-bold text-text-muted uppercase tracking-widest">
                  Flashcards Completed
                </h4>
                <div class="space-y-1.5 max-h-[140px] overflow-y-auto pr-1 custom-scrollbar">
                  <div v-for="(f, i) in activityProgress.flashcards" :key="f.id || i"
                    class="p-2.5 bg-bg-secondary/40 border border-border rounded-xl flex items-center justify-between text-xs">
                    <div class="flex items-center gap-2 min-w-0">
                      <span class="w-2 h-2 rounded-full bg-success shrink-0"></span>
                      <span class="font-bold text-text truncate">Card #{{ f.card_index != null ? f.card_index : (i + 1)
                      }}</span>
                    </div>
                    <span class="text-[0.6rem] text-success font-bold shrink-0">✓ Correct</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- 3. ANALYTICS TAB -->
          <div v-else-if="activeTab === 'analytics'" class="space-y-6 animate-fade-in">
            <div v-if="isFetchingAnalytics" class="py-12 flex justify-center items-center">
              <RefreshCw class="w-6 h-6 animate-spin text-primary" />
            </div>

            <div v-else-if="!analytics" class="text-center py-10 text-text-muted">
              No analytics data available.
            </div>

            <div v-else class="space-y-6">
              <!-- 3 Summary Cards -->
              <div class="grid grid-cols-3 gap-3">
                <div class="p-3.5 bg-surface border border-border rounded-xl">
                  <span class="text-[0.65rem] font-bold text-text-subtle uppercase tracking-wider block">Weekly
                    Study</span>
                  <p class="text-base font-bold text-text mt-0.5">
                    {{ analytics.summary?.total_study_minutes_weekly || 0 }} min
                  </p>
                  <span class="text-[0.6rem] text-text-muted">
                    Avg {{ analytics.summary?.avg_study_minutes_daily || 0 }}m/day
                  </span>
                </div>
                <div class="p-3.5 bg-surface border border-border rounded-xl">
                  <span
                    class="text-[0.65rem] font-bold text-text-subtle uppercase tracking-wider block">Interactions</span>
                  <p class="text-base font-bold text-text mt-0.5">
                    {{ analytics.summary?.total_messages_weekly || 0 }} msgs
                  </p>
                  <span class="text-[0.6rem] text-text-muted">This week</span>
                </div>
                <div class="p-3.5 bg-surface border border-border rounded-xl">
                  <span
                    class="text-[0.65rem] font-bold text-text-subtle uppercase tracking-wider block">Activities</span>
                  <p class="text-base font-bold text-text mt-0.5">
                    {{ analytics.summary?.total_activities_weekly || 0 }} done
                  </p>
                  <span class="text-[0.6rem] text-text-muted">Quizzes & Decks</span>
                </div>
              </div>

              <!-- 7-Day Study Time Bar Chart -->
              <div class="p-4 bg-surface border border-border rounded-2xl">
                <h4 class="text-xs font-bold text-text-muted uppercase tracking-widest mb-4 flex items-center gap-1.5">
                  <BarChart2 class="w-4 h-4 text-primary" /> Study Time (last 7 days)
                </h4>
                <div class="h-28 flex items-end gap-3 px-2 pt-2 border-b border-border pb-1">
                  <div v-for="(day, idx) in (analytics.study_time_chart || [])" :key="idx"
                    class="flex-1 flex flex-col items-center group relative h-full justify-end">
                    <!-- Tooltip -->
                    <div
                      class="absolute bottom-full mb-1 bg-black text-white text-[0.6rem] p-1.5 rounded opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-10 shadow-lg border border-border/30">
                      <span class="font-bold">{{ day.study_minutes }} min</span><br />
                      <span class="text-neutral-400">{{ day.messages_sent }} msgs</span>
                    </div>
                    <!-- Bar -->
                    <div class="w-full rounded-t-md transition-all duration-300"
                      :class="day.study_minutes > 0 ? 'bg-primary group-hover:bg-primary-hover' : 'bg-border/30'"
                      :style="{
                        height: `${Math.min(100, Math.max(8, ((day.study_minutes || 0) / Math.max(...(analytics.study_time_chart || []).map((d: any) => d.study_minutes || 0), 10)) * 100))}%`,
                      }" />
                    <!-- Label -->
                    <span class="text-[0.65rem] text-text-muted mt-1.5 font-bold uppercase tracking-wider">
                      {{ day.day_name }}
                    </span>
                  </div>
                </div>
              </div>

              <!-- Risk Status & WhatsApp Nudge Alert -->
              <div class="p-4 border rounded-2xl space-y-3"
                :class="localStudent.risk_level !== 'active' ? 'bg-warning/5 border-warning/20' : 'bg-primary/5 border-primary/10'">
                <div class="flex items-start gap-3">
                  <div class="p-2 rounded-lg shrink-0"
                    :class="localStudent.risk_level !== 'active' ? 'bg-warning/10 text-warning' : 'bg-primary/10 text-primary'">
                    <AlertCircle class="w-4 h-4" />
                  </div>
                  <div class="min-w-0 flex-1">
                    <h4 class="font-bold text-xs text-text">
                      {{ localStudent.risk_level !== 'active' ? `Inactive for ${localStudent.days_inactive || 0} days!`
                        : 'Engagement status is healthy' }}
                    </h4>
                    <p class="text-[0.7rem] text-text-muted mt-0.5">
                      {{ localStudent.risk_level !== 'active' ? 'Send a custom message directly to their chat to wake them up.' : 'Keep them motivated! You can send an encouraging message anytime.' }}
                    </p>
                  </div>
                </div>

                <div class="space-y-2 pt-1">
                  <textarea v-model="nudgeMessage" rows="3"
                    class="w-full p-2.5 bg-bg border border-border rounded-xl text-xs outline-none focus:border-primary resize-none text-text"
                    placeholder="Write a nudge message..."></textarea>
                  <button type="button" @click="handleSendNudge" :disabled="isNudging || !nudgeMessage.trim()"
                    class="w-full py-2 px-3 rounded-xl bg-primary text-white font-bold hover:bg-primary-hover active:scale-95 transition-all text-xs flex items-center justify-center gap-1.5 shadow-sm">
                    <RefreshCw v-if="isNudging" class="w-3.5 h-3.5 animate-spin" />
                    <Send v-else class="w-3.5 h-3.5" />
                    <span>Send Nudge</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          <!-- 4. PROMPT TAB -->
          <div v-else-if="activeTab === 'prompt'" class="space-y-4 animate-fade-in">
            <div class="p-4 bg-warning/5 border border-warning/20 rounded-2xl">
              <p class="text-xs text-warning leading-relaxed">
                Add extra instructions for Teacher Tati to follow <strong>only with this student</strong>.
              </p>
            </div>
            <textarea v-model="promptText" rows="6"
              placeholder="Ex: Foque em corrigir o uso de preposições e praticar perguntas de entrevista de emprego..."
              class="w-full p-4 bg-bg border border-border rounded-2xl text-xs outline-none focus:border-primary resize-none text-text font-mono"></textarea>
            <button type="button" @click="handleSavePrompt"
              class="w-full py-2.5 px-4 rounded-xl bg-primary text-white font-bold hover:bg-primary-hover active:scale-95 transition-all flex items-center justify-center gap-2 shadow-sm">
              <Save class="w-4 h-4" />
              <span>Save prompt</span>
            </button>
          </div>

          <!-- 5. INSIGHT TAB -->
          <div v-else-if="activeTab === 'insight'" class="space-y-4 animate-fade-in">
            <div
              class="p-5 bg-primary/5 border border-primary/15 rounded-2xl flex flex-col items-center text-center gap-4">
              <div class="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                <Sparkles class="w-6 h-6" />
              </div>
              <div>
                <h4 class="font-bold text-text text-sm">Generate AI Pedagogical Insight</h4>
                <p class="text-xs text-text-muted mt-1">
                  Click Generate Insight to analyze this student's history or Grammar Errors to see recurring mistakes.
                </p>
              </div>
              <div class="flex gap-2 w-full">
                <button type="button" @click="handleGenerateInsight" :disabled="isGenerating"
                  class="flex-1 py-2.5 px-4 rounded-xl bg-primary text-white font-bold hover:bg-primary-hover transition-all flex items-center justify-center gap-2 text-xs shadow-sm">
                  <RefreshCw v-if="isGenerating" class="w-4 h-4 animate-spin" />
                  <Brain v-else class="w-4 h-4" />
                  <span>{{ isGenerating ? 'Analyzing...' : 'Generate Insight' }}</span>
                </button>
                <button type="button" @click="handleGenerateGrammarErrors" :disabled="isGenerating"
                  class="py-2.5 px-4 rounded-xl border border-border bg-surface hover:bg-surface-hover text-text font-bold transition-all flex items-center justify-center gap-1.5 text-xs shadow-xs">
                  <span>Grammar Errors</span>
                </button>
              </div>
            </div>

            <!-- Display Insight -->
            <div v-if="insight" class="p-4 bg-surface border border-border rounded-2xl animate-fade-in">
              <h5 class="text-xs font-bold text-primary uppercase tracking-widest mb-2 flex items-center gap-2">
                <Brain class="w-3.5 h-3.5" /> AI Pedagogical Analysis
              </h5>
              <p class="text-xs text-text leading-relaxed whitespace-pre-wrap">{{ insight }}</p>
            </div>
          </div>

          <!-- 6. INTERESTS TAB -->
          <div v-else-if="activeTab === 'interests'" class="space-y-4 animate-fade-in">
            <div class="p-8 text-center border border-dashed border-border rounded-3xl space-y-3">
              <Target class="w-8 h-8 mx-auto text-text-subtle opacity-70" />
              <p class="text-xs text-text-muted max-w-sm mx-auto leading-relaxed">
                Teacher Tati will analyze student conversation history to map personal interests and generate
                personalized study recommendations.
              </p>
              <button type="button" @click="handleFetchInterests" :disabled="isAnalyzingInterests"
                class="py-2 px-4 rounded-xl border border-primary/30 bg-primary/10 hover:bg-primary/20 text-primary font-bold text-xs transition-all flex items-center justify-center gap-2 mx-auto">
                <RefreshCw v-if="isAnalyzingInterests" class="w-3.5 h-3.5 animate-spin" />
                <span>{{ isAnalyzingInterests ? 'Analyzing...' : 'Analyze Interests & Recommendations' }}</span>
              </button>
            </div>

            <!-- Interests Tags & Recommendations List -->
            <div v-if="interests.length > 0" class="space-y-4">
              <div class="space-y-2">
                <h4 class="text-xs font-bold text-text-muted uppercase tracking-widest">
                  Identified Hobbies & Interests
                </h4>
                <div class="flex flex-wrap gap-2">
                  <span v-for="(item, i) in interests" :key="i"
                    class="px-3 py-1 bg-primary/10 text-primary text-xs font-bold rounded-lg border border-primary/20">
                    {{ typeof item === 'string' ? item : item?.title || item?.topic || item?.name ||
                      JSON.stringify(item) }}
                  </span>
                </div>
              </div>

              <div v-if="recommendations.length > 0" class="space-y-2">
                <h4 class="text-xs font-bold text-text-muted uppercase tracking-widest">
                  Practical Recommendations
                </h4>
                <div v-for="(rec, i) in recommendations" :key="i"
                  class="p-3 bg-surface border border-border rounded-xl text-xs leading-relaxed">
                  <span class="font-bold text-primary mr-2">✦</span>
                  <span class="font-bold">{{ rec.type ? `[${rec.type}] ` : '' }}{{ rec.title || rec.recommendation ||
                    rec.topic || 'Recommendation' }}</span>
                  <span v-if="rec.description">: {{ rec.description }}</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>
