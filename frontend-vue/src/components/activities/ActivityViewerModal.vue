<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import {
  ExternalLink,
  CheckCircle2,
  Clock,
  X,
  AlertCircle,
  RefreshCw,
  CheckSquare,
  Keyboard,
  Mic,
  MessageSquareHeart,
  Bug,
} from 'lucide-vue-next';
import StudentFeedbackModal from '@/components/feedback/StudentFeedbackModal.vue';
import DeveloperBugModal from '@/components/feedback/DeveloperBugModal.vue';

interface ActivityItem {
  id: string;
  slug?: string;
  title: string;
  artist?: string;
  image?: string;
  url: string;
  wordwall_url?: string;
  route?: string;
  level?: string;
  category?: string;
  genre?: string;
  source?: string;
  modes?: {
    choice: string;
    typing: string;
    karaoke: string;
  };
}

const props = defineProps<{
  isOpen: boolean;
  activity: ActivityItem | null;
  isDone: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'markDone', activity: ActivityItem): void;
  (e: 'markPending', activity: ActivityItem): void;
}>();

const router = useRouter();
const loading = ref(false);
const isFeedbackOpen = ref(false);
const isBugOpen = ref(false);

const sourceName = computed(() => {
  if (!props.activity) return 'Online Exercise';
  if (props.activity.source) return props.activity.source;
  const rawUrl = props.activity.url || props.activity.wordwall_url || '';
  if (rawUrl.includes('wordwall.net')) return 'WordWall';
  if (rawUrl.includes('test-english')) return 'test-english.com';
  if (rawUrl.includes('liveworksheets')) return 'liveworksheets.com';
  return 'Online Exercise';
});

const targetUrl = computed(() => {
  if (!props.activity) return '';
  const direct = props.activity.url || props.activity.wordwall_url;
  if (direct && direct.trim()) return direct;
  if (sourceName.value.includes('liveworksheets')) {
    return `https://www.liveworksheets.com/worksheet/en/esl-grammar/${props.activity.id || props.activity.slug || ''}`;
  }
  return `https://test-english.com/grammar-points/${(props.activity.level || 'a1').toLowerCase()}/${props.activity.slug || ''}`;
});

async function handleToggleDone() {
  if (!props.activity) return;
  loading.value = true;
  try {
    if (props.isDone) {
      emit('markPending', props.activity);
    } else {
      emit('markDone', props.activity);
    }
  } finally {
    loading.value = false;
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen && activity"
      class="fixed inset-0 z-[99999] flex items-center justify-center p-4 animate-in fade-in duration-200"
      @click="emit('close')"
    >
      <div class="fixed inset-0 bg-black/75 dark:bg-black/85 pointer-events-none" />

      <div
        class="bg-surface border border-border rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden transform-gpu animate-in zoom-in-95 duration-200 z-10"
        @click.stop
      >
        <!-- Header -->
        <div class="p-6 pb-4 border-b border-border/40 shrink-0 relative">
          <button
            type="button"
            @click="emit('close')"
            aria-label="Close"
            class="absolute top-5 right-5 p-2 rounded-full text-text-subtle hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
          >
            <X class="w-5 h-5" />
          </button>

          <!-- Badges -->
          <div class="flex items-center gap-2 flex-wrap pr-10">
            <span
              v-if="activity.level"
              class="text-xs font-black bg-primary/10 text-primary px-2.5 py-1 rounded-full uppercase"
            >
              {{ activity.level }}
            </span>
            <span
              v-if="activity.genre"
              class="text-xs font-semibold bg-primary/10 text-primary px-2.5 py-1 rounded-full border border-primary/20"
            >
              {{ activity.genre }}
            </span>
            <span class="text-xs font-semibold bg-bg text-text-muted px-2.5 py-1 rounded-full border border-border">
              {{ sourceName }}
            </span>
            <span
              v-if="isDone"
              class="flex items-center gap-1 text-xs font-bold bg-success/15 text-success border border-success/30 px-3 py-1 rounded-full uppercase"
            >
              <CheckCircle2 class="w-3.5 h-3.5" /> Completed
            </span>
            <span
              v-else
              class="flex items-center gap-1 text-xs font-bold bg-warning/15 text-warning border border-warning/30 px-3 py-1 rounded-full uppercase"
            >
              <Clock class="w-3.5 h-3.5" /> Pending
            </span>
          </div>

          <div class="mt-3">
            <h2 class="text-lg sm:text-xl font-bold text-text leading-snug">{{ activity.title }}</h2>
            <p v-if="activity.artist" class="text-sm font-medium text-text-muted mt-0.5">
              {{ activity.artist }}
            </p>
          </div>
        </div>

        <!-- Scrollable Content -->
        <div class="p-6 overflow-y-auto space-y-5 custom-scrollbar">
          <!-- Image Preview -->
          <div
            v-if="activity.image"
            class="h-36 sm:h-44 rounded-2xl overflow-hidden bg-bg-secondary border border-border/50 shrink-0"
          >
            <img :src="activity.image" :alt="activity.title" class="w-full h-full object-cover" />
          </div>

          <!-- Musics Game Modes -->
          <div v-if="activity.modes" class="space-y-2.5">
            <span class="text-xs font-bold text-text-subtle uppercase tracking-wider">
              Game Modes:
            </span>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <a
                :href="activity.modes.choice || `https://lingoclip.app/lyrics/${activity.id}?mode=mc&level=b1#game/level`"
                target="_blank"
                rel="noopener noreferrer"
                class="flex flex-col items-center justify-center p-3 rounded-2xl bg-bg hover:bg-primary/5 hover:border-primary/40 border border-border transition-all text-center group shadow-xs"
              >
                <div class="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                  <CheckSquare class="w-4 h-4" />
                </div>
                <span class="text-xs font-bold text-text group-hover:text-primary">Multiple Choice</span>
                <span class="text-[0.65rem] text-text-muted mt-0.5">Quiz mode</span>
              </a>

              <a
                :href="activity.modes.typing || `https://lingoclip.app/lyrics/${activity.id}?mode=tp&level=b1#game/level`"
                target="_blank"
                rel="noopener noreferrer"
                class="flex flex-col items-center justify-center p-3 rounded-2xl bg-bg hover:bg-primary/5 hover:border-primary/40 border border-border transition-all text-center group shadow-xs"
              >
                <div class="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                  <Keyboard class="w-4 h-4" />
                </div>
                <span class="text-xs font-bold text-text group-hover:text-primary">Typing</span>
                <span class="text-[0.65rem] text-text-muted mt-0.5">Fill in the blanks</span>
              </a>

              <a
                :href="activity.modes.karaoke || `https://lingoclip.app/lyrics/${activity.id}#game`"
                target="_blank"
                rel="noopener noreferrer"
                class="flex flex-col items-center justify-center p-3 rounded-2xl bg-bg hover:bg-primary/5 hover:border-primary/40 border border-border transition-all text-center group shadow-xs"
              >
                <div class="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                  <Mic class="w-4 h-4" />
                </div>
                <span class="text-xs font-bold text-text group-hover:text-primary">Karaoke</span>
                <span class="text-[0.65rem] text-text-muted mt-0.5">Sing along</span>
              </a>
            </div>
          </div>

          <!-- Status Callout -->
          <div v-if="isDone" class="p-4 bg-success/10 border border-success/20 rounded-2xl flex items-start gap-3">
            <CheckCircle2 class="text-success shrink-0 mt-0.5 w-5 h-5" />
            <div>
              <p class="text-sm font-bold text-success">Activity Completed! (+25 XP)</p>
              <p class="text-xs text-text-muted mt-0.5">
                You have recorded completion for this exercise.
              </p>
            </div>
          </div>

          <div v-else class="p-4 bg-warning/10 border border-warning/20 rounded-2xl flex items-start gap-3">
            <AlertCircle class="text-warning shrink-0 mt-0.5 w-5 h-5" />
            <div>
              <p class="text-sm font-bold text-warning">Status: Pending</p>
              <p class="text-xs text-text-muted mt-0.5">
                <template v-if="activity.modes">
                  Choose one of the game modes above, practice, and then click <strong>2. Mark as Completed (+25 XP)</strong>!
                </template>
                <template v-else>
                  Click <strong>1. Open Activity</strong>, complete the exercise, and click <strong>2. Mark as Completed (+25 XP)</strong>.
                </template>
              </p>
            </div>
          </div>
        </div>

        <!-- Action Buttons -->
        <div class="p-5 border-t border-border/50 bg-surface shrink-0 flex flex-col sm:flex-row gap-3">
          <button
            v-if="activity.route"
            type="button"
            @click="
              router.push(activity.route!);
              emit('close');
            "
            class="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-bg hover:bg-surface-hover border border-border text-text font-bold text-sm transition-all shadow-xs cursor-pointer group"
          >
            <ExternalLink class="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
            <span>1. Open Activity</span>
          </button>
          <a
            v-else
            :href="targetUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-bg hover:bg-surface-hover border border-border text-text font-bold text-sm transition-all shadow-xs cursor-pointer group text-center"
          >
            <ExternalLink class="w-4 h-4 text-primary group-hover:scale-110 transition-transform" />
            <span>1. Open on {{ sourceName }}</span>
          </a>

          <button
            type="button"
            @click="handleToggleDone"
            :disabled="loading"
            class="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-2xl font-bold text-sm transition-all shadow-md cursor-pointer"
            :class="
              isDone
                ? 'bg-surface text-text-muted hover:bg-warning/20 hover:text-warning border border-border'
                : 'bg-success text-white hover:bg-success/90 shadow-success/20'
            "
          >
            <RefreshCw v-if="loading" class="w-4 h-4 animate-spin" />
            <template v-else-if="isDone">
              <Clock class="w-4 h-4" />
              <span>Revert to Pending</span>
            </template>
            <template v-else>
              <CheckCircle2 class="w-4 h-4" />
              <span>2. Mark as Completed (+25 XP)</span>
            </template>
          </button>
        </div>

        <!-- Feedback & Bug report links -->
        <div class="flex items-center justify-center gap-6 px-6 py-3 border-t border-border/50 text-xs text-text-muted bg-surface/60">
          <button
            type="button"
            @click="isFeedbackOpen = true"
            class="hover:text-primary transition-colors flex items-center gap-1.5 cursor-pointer font-medium"
          >
            <MessageSquareHeart class="w-3.5 h-3.5 text-primary" />
            <span>Send feedback to Tatiana</span>
          </button>
          <button
            type="button"
            @click="isBugOpen = true"
            class="hover:text-red-400 transition-colors flex items-center gap-1.5 cursor-pointer font-medium"
          >
            <Bug class="w-3.5 h-3.5 text-red-400" />
            <span>Report issue</span>
          </button>
        </div>
      </div>

      <StudentFeedbackModal
        :is-open="isFeedbackOpen"
        :default-area="activity?.category || 'general'"
        :activity-id="activity?.id || ''"
        :activity-title="activity?.title || ''"
        :cefr-level="activity?.level || 'A1'"
        @close="isFeedbackOpen = false"
      />

      <DeveloperBugModal
        :is-open="isBugOpen"
        @close="isBugOpen = false"
      />
    </div>
  </Teleport>
</template>
