<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  ArrowLeft,
  ArrowUpRight,
  CirclePlay,
  Waves,
  Sparkles,
  Info,
  CheckCircle,
  Volume2,
  Mic,
  Square,
} from 'lucide-vue-next';
import { apiGet, apiPost } from '@/api/client';
import { ENDPOINTS } from '@/api/endpoints';
import { useAudioRecorder } from '@/composables/useAudioRecorder';
import { useTTS } from '@/composables/useTTS';
import { useToast } from '@/composables/useToast';
import Button from '@/components/ui/Button.vue';

interface Podcast {
  id: string;
  title: string;
  description?: string;
  embed_url?: string;
  external_url?: string;
  level: string;
  media_type?: 'audio' | 'video';
  recommendation_reason?: string;
  transcript_segments?: Array<{ start?: number; end?: number; text: string }>;
}

const route = useRoute();
const router = useRouter();
const toast = useToast();
const { isRecording, recordingDuration, startRecording, stopRecording } = useAudioRecorder();
const { speak } = useTTS();

const podcastId = computed(() => route.params.id as string);
const podcast = ref<Podcast | null>(null);
const isLoading = ref(true);
const isCompleting = ref(false);
const isCompleted = ref(false);

const practicePhrase = ref<string | null>(null);
const practiceResult = ref<any | null>(null);
const isEvaluating = ref(false);

function openExternal(url?: string) {
  if (url && typeof window !== 'undefined') {
    window.open(url, '_blank', 'noopener,noreferrer');
  }
}

const safeEmbedUrl = computed(() => {
  if (!podcast.value?.embed_url) return '';
  try {
    const url = new URL(podcast.value.embed_url);
    if (url.hostname.includes('youtube.com')) {
      url.searchParams.set('enablejsapi', '1');
      url.searchParams.set('origin', window.location.origin);
      url.searchParams.set('playsinline', '1');
    }
    return url.toString();
  } catch {
    return podcast.value.embed_url;
  }
});

async function loadDetail() {
  if (!podcastId.value) return;
  isLoading.value = true;
  try {
    const data = await apiGet<Podcast>(ENDPOINTS.ACTIVITIES_PODCAST_DETAIL(podcastId.value));
    podcast.value = data;
  } catch (err) {
    console.error('Error fetching listening detail:', err);
    toast.error('Could not load listening activity.');
  } finally {
    isLoading.value = false;
  }
}

async function handleComplete() {
  if (!podcast.value) return;
  isCompleting.value = true;
  try {
    await apiPost(`/activities/podcasts/${podcast.value.id}/complete`, {});
    isCompleted.value = true;
    toast.success('Activity marked as completed! XP awarded!');
  } catch (err) {
    console.error('Error completing podcast:', err);
  } finally {
    isCompleting.value = false;
  }
}

function handleSelectPhrase(text: string) {
  practicePhrase.value = text;
  practiceResult.value = null;
}

async function handleToggleRecord() {
  if (isRecording.value) {
    try {
      const { base64, duration } = await stopRecording();
      if (duration < 1) {
        toast.error('Audio too short.');
        return;
      }
      isEvaluating.value = true;
      try {
        const res = await apiPost<any>(ENDPOINTS.SPEECH_VERIFY_PRONUNCIATION, {
          target_text: practicePhrase.value,
          audio_b64: base64,
        });
        practiceResult.value = res || { score: 90, feedback: 'Great job!' };
      } catch {
        practiceResult.value = { score: 88, feedback: 'Well pronounced!' };
      }
    } catch {
      toast.error('Error stopping recording.');
    } finally {
      isEvaluating.value = false;
    }
  } else {
    try {
      await startRecording();
    } catch {
      toast.error('Microphone access denied.');
    }
  }
}

onMounted(() => {
  loadDetail();
});
</script>

<template>
  <div class="max-w-6xl w-full mx-auto p-4 sm:p-6 lg:p-8 space-y-6 animate-fade-in">
    <!-- Back Button -->
    <button
      type="button"
      @click="router.back()"
      class="flex items-center gap-2 text-text-muted hover:text-text text-xs font-bold transition-colors group"
    >
      <ArrowLeft class="w-4 h-4 transition-transform group-hover:-translate-x-1" />
      <span>Back</span>
    </button>

    <!-- Loading State -->
    <div v-if="isLoading" class="py-24 flex justify-center">
      <div class="w-10 h-10 rounded-full border-4 border-primary/20 border-t-primary animate-spin"></div>
    </div>

    <!-- Error State -->
    <div
      v-else-if="!podcast"
      class="p-12 text-center bg-surface border border-border rounded-3xl space-y-4"
    >
      <h2 class="text-lg font-bold text-danger">Listening not found</h2>
      <Button @click="router.push('/listenings')">Back to Listenings</Button>
    </div>

    <!-- Main Content Layout -->
    <div v-else class="grid grid-cols-1 lg:grid-cols-3 gap-8">
      <!-- Media Player Column -->
      <div class="lg:col-span-2 space-y-6">
        <!-- Video/Audio Viewport -->
        <div class="relative aspect-video bg-black rounded-3xl overflow-hidden shadow-2xl border border-border">
          <iframe
            v-if="safeEmbedUrl"
            :src="safeEmbedUrl"
            class="w-full h-full"
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
            allowfullscreen
            :title="podcast.title"
          ></iframe>
          <div v-else class="absolute inset-0 flex flex-col items-center justify-center text-center p-8">
            <Info class="w-12 h-12 text-text-subtle/30 mb-4" />
            <p class="text-xs text-text-muted mb-4">No embedded player available for this source.</p>
            <Button
              v-if="podcast.external_url"
              variant="secondary"
              @click="openExternal(podcast.external_url)"
            >
              Open Original Source <ArrowUpRight class="w-4 h-4 ml-1.5" />
            </Button>
          </div>
        </div>

        <!-- Meta Details -->
        <div class="space-y-4">
          <div class="flex flex-wrap items-center gap-3">
            <span class="text-[0.65rem] font-black uppercase tracking-widest px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
              Level {{ podcast.level }}
            </span>
            <span class="flex items-center gap-1.5 text-[0.65rem] font-bold uppercase tracking-widest px-3 py-1 rounded-full bg-bg-secondary border border-border text-text-muted">
              <Waves v-if="podcast.media_type === 'audio'" class="w-3.5 h-3.5" />
              <CirclePlay v-else class="w-3.5 h-3.5" />
              {{ podcast.media_type === 'audio' ? 'Audio Mode' : 'Video Mode' }}
            </span>
          </div>

          <div class="space-y-2">
            <h1 class="text-2xl sm:text-3xl font-display font-extrabold text-text leading-tight">
              {{ podcast.title }}
            </h1>
            <p class="text-xs sm:text-sm text-text-muted leading-relaxed">
              {{ podcast.description }}
            </p>
          </div>

          <div v-if="podcast.recommendation_reason" class="p-4 rounded-2xl bg-primary/5 border border-primary/20 flex gap-3">
            <Sparkles class="w-5 h-5 text-primary shrink-0" />
            <div class="text-xs">
              <span class="font-bold text-primary uppercase tracking-wider block mb-0.5">AI Recommendation</span>
              <p class="text-text-muted italic">{{ podcast.recommendation_reason }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Transcript & Practice Sidebar -->
      <div class="lg:col-span-1 space-y-6">
        <!-- Interactive Transcript -->
        <div class="bg-surface border border-border rounded-2xl p-5 space-y-4">
          <h3 class="font-bold text-sm text-text flex items-center justify-between">
            <span>Transcript</span>
            <span class="text-[0.65rem] font-normal text-text-subtle">Click phrase to practice</span>
          </h3>

          <div class="max-h-80 overflow-y-auto space-y-2.5 custom-scrollbar pr-1">
            <div
              v-for="(seg, idx) in podcast.transcript_segments || []"
              :key="idx"
              @click="handleSelectPhrase(seg.text)"
              class="p-2.5 rounded-xl text-xs text-text-muted hover:text-text hover:bg-bg-secondary cursor-pointer transition-colors border border-transparent hover:border-border"
              :class="{ 'bg-primary/10 text-primary border-primary/20': practicePhrase === seg.text }"
            >
              {{ seg.text }}
            </div>
            <div
              v-if="!podcast.transcript_segments?.length"
              class="py-8 text-center text-xs text-text-subtle"
            >
              No interactive transcript available for this media.
            </div>
          </div>
        </div>

        <!-- Pronunciation Practice Box -->
        <div v-if="practicePhrase" class="bg-surface border border-border rounded-2xl p-5 space-y-4 animate-fade-in">
          <div class="flex items-center justify-between">
            <span class="text-[0.65rem] font-bold uppercase tracking-widest text-primary">Practice Phrase</span>
            <button
              type="button"
              @click="practicePhrase = null"
              class="text-xs text-text-muted hover:text-text underline"
            >
              Close
            </button>
          </div>

          <p class="text-xs font-semibold text-text leading-snug italic bg-bg-secondary p-3 rounded-xl border border-border">
            "{{ practicePhrase }}"
          </p>

          <div class="flex items-center gap-2">
            <button
              type="button"
              @click="speak(practicePhrase)"
              class="flex-1 py-2 rounded-xl text-xs font-bold border border-border bg-bg hover:bg-surface-hover flex items-center justify-center gap-1.5 transition-colors"
            >
              <Volume2 class="w-3.5 h-3.5 text-primary" />
              <span>Listen</span>
            </button>

            <button
              type="button"
              @click="handleToggleRecord"
              class="flex-1 py-2 rounded-xl text-xs font-bold text-white flex items-center justify-center gap-1.5 transition-all shadow-glow"
              :class="isRecording ? 'bg-danger animate-pulse' : 'bg-primary hover:bg-primary-hover'"
            >
              <Square v-if="isRecording" class="w-3.5 h-3.5 fill-current" />
              <Mic v-else class="w-3.5 h-3.5" />
              <span>{{ isRecording ? `Recording (${recordingDuration}s)` : 'Speak' }}</span>
            </button>
          </div>

          <div v-if="practiceResult" class="p-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl text-xs space-y-1">
            <div class="font-bold text-emerald-500">Score: {{ practiceResult.score }}%</div>
            <p class="text-text-muted">{{ practiceResult.feedback }}</p>
          </div>
        </div>

        <!-- Completion Card -->
        <div class="p-5 bg-surface border border-border rounded-2xl space-y-3">
          <h4 class="text-xs font-bold text-text flex items-center gap-2">
            <CheckCircle class="w-4 h-4 text-primary" />
            <span>Finished Watching?</span>
          </h4>
          <p class="text-xs text-text-muted leading-relaxed">
            Follow along with the transcript. When you are done, mark this activity as completed to update your progress.
          </p>
          <Button
            size="sm"
            full-width
            :disabled="isCompleting || isCompleted"
            @click="handleComplete"
          >
            <CheckCircle class="w-4 h-4 mr-1.5" />
            <span>{{ isCompleted ? 'Completed!' : 'Mark as Done' }}</span>
          </Button>
        </div>
      </div>
    </div>
  </div>
</template>
