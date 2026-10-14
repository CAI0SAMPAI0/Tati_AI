<script setup lang="ts">
import { computed } from 'vue';
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
} from 'lucide-vue-next';

export interface ActivityItem {
  id: string;
  slug?: string;
  title: string;
  description?: string;
  artist?: string;
  image?: string;
  url?: string;
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
  loading?: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
  (e: 'toggle-done', activity: ActivityItem): void;
}>();

const router = useRouter();

const sourceName = computed(() => {
  if (!props.activity) return 'Online Exercise';
  if (props.activity.source) return props.activity.source;
  const url = props.activity.url || '';
  if (url.includes('test-english')) return 'test-english.com';
  if (url.includes('liveworksheets')) return 'liveworksheets.com';
  if (url.includes('lingoclip')) return 'LingoClip';
  return 'Online Exercise';
});

const targetUrl = computed(() => {
  if (!props.activity) return '#';
  if (props.activity.url) return props.activity.url;
  const src = sourceName.value;
  if (src.includes('liveworksheets')) {
    return `https://www.liveworksheets.com/worksheet/en/esl-grammar/${props.activity.id || props.activity.slug || ''}`;
  }
  return `https://test-english.com/grammar-points/${(props.activity.level || 'a1').toLowerCase()}/${props.activity.slug || ''}`;
});

function handleOpenActivity() {
  if (!props.activity) return;
  if (props.activity.route) {
    router.push(props.activity.route);
    emit('close');
  } else {
    window.open(targetUrl.value, '_blank', 'noopener,noreferrer');
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="isOpen && activity"
      class="fixed inset-0 flex items-center justify-center p-4 animate-fade-in z-[9999]"
      @click="emit('close')"
    >
      <!-- Dim overlay -->
      <div class="absolute inset-0 bg-black/75 dark:bg-black/85" />

      <!-- Modal card -->
      <div
        class="bg-surface border border-line rounded-3xl max-w-xl w-full max-h-[90vh] flex flex-col shadow-2xl relative overflow-hidden transform-gpu z-10"
        @click.stop
      >
        <!-- Header - Fixed -->
        <div class="p-6 pb-4 border-b border-line shrink-0 relative bg-bg/50">
          <!-- Close button -->
          <button
            type="button"
            aria-label="Close"
            class="absolute top-5 right-5 p-2 rounded-full text-muted hover:text-ink hover:bg-surface transition-colors cursor-pointer"
            @click="emit('close')"
          >
            <X :size="20" />
          </button>

          <!-- Header Badges -->
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
            <span class="text-xs font-semibold bg-bg text-muted px-2.5 py-1 rounded-full border border-line">
              {{ sourceName }}
            </span>
            <span
              v-if="isDone"
              class="flex items-center gap-1 text-xs font-bold bg-emerald-500/15 text-emerald-600 border border-emerald-500/30 px-3 py-1 rounded-full uppercase"
            >
              <CheckCircle2 :size="14" /> Completed
            </span>
            <span
              v-else
              class="flex items-center gap-1 text-xs font-bold bg-amber-500/15 text-amber-600 border border-amber-500/30 px-3 py-1 rounded-full uppercase"
            >
              <Clock :size="14" /> Pending
            </span>
          </div>

          <!-- Title & Artist -->
          <div class="mt-3">
            <h2 class="text-lg sm:text-xl font-bold text-ink leading-snug">
              {{ activity.title }}
            </h2>
            <p v-if="activity.artist" class="text-sm font-medium text-muted mt-0.5">
              {{ activity.artist }}
            </p>
          </div>
        </div>

        <!-- Scrollable Content -->
        <div class="p-6 overflow-y-auto space-y-5">
          <!-- Image Preview -->
          <div
            v-if="activity.image"
            class="h-36 sm:h-44 rounded-2xl overflow-hidden bg-bgSecondary border border-line/60 shrink-0"
          >
            <img
              :src="activity.image"
              :alt="activity.title"
              class="w-full h-full object-cover"
            />
          </div>

          <!-- If activity has game modes (Musics) -->
          <div v-if="activity.modes" class="space-y-2.5">
            <span class="text-xs font-bold text-muted uppercase tracking-wider">
              Game Modes:
            </span>
            <div class="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <a
                :href="activity.modes.choice || `https://lingoclip.app/lyrics/${activity.id}?mode=mc&level=b1#game/level`"
                target="_blank"
                rel="noopener noreferrer"
                class="flex flex-col items-center justify-center p-3 rounded-2xl bg-bg hover:bg-primary/5 hover:border-primary/40 border border-line transition-all text-center group shadow-xs"
              >
                <div class="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                  <CheckSquare :size="16" />
                </div>
                <span class="text-xs font-bold text-ink group-hover:text-primary">Multiple Choice</span>
                <span class="text-[0.65rem] text-muted mt-0.5">Quiz mode</span>
              </a>

              <a
                :href="activity.modes.typing || `https://lingoclip.app/lyrics/${activity.id}?mode=tp&level=b1#game/level`"
                target="_blank"
                rel="noopener noreferrer"
                class="flex flex-col items-center justify-center p-3 rounded-2xl bg-bg hover:bg-primary/5 hover:border-primary/40 border border-line transition-all text-center group shadow-xs"
              >
                <div class="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                  <Keyboard :size="16" />
                </div>
                <span class="text-xs font-bold text-ink group-hover:text-primary">Typing</span>
                <span class="text-[0.65rem] text-muted mt-0.5">Fill in the blanks</span>
              </a>

              <a
                :href="activity.modes.karaoke || `https://lingoclip.app/lyrics/${activity.id}#game`"
                target="_blank"
                rel="noopener noreferrer"
                class="flex flex-col items-center justify-center p-3 rounded-2xl bg-bg hover:bg-primary/5 hover:border-primary/40 border border-line transition-all text-center group shadow-xs"
              >
                <div class="w-8 h-8 rounded-xl bg-primary/10 text-primary flex items-center justify-center mb-1.5 group-hover:scale-110 transition-transform">
                  <Mic :size="16" />
                </div>
                <span class="text-xs font-bold text-ink group-hover:text-primary">Karaoke</span>
                <span class="text-[0.65rem] text-muted mt-0.5">Sem nível (Cantar)</span>
              </a>
            </div>
          </div>

          <!-- Status Callout Banner -->
          <div
            v-if="isDone"
            class="p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-2xl flex items-start gap-3"
          >
            <CheckCircle2 class="text-emerald-600 shrink-0 mt-0.5" :size="20" />
            <div>
              <p class="text-sm font-bold text-emerald-600">Activity Completed! (+25 XP)</p>
              <p class="text-xs text-muted mt-0.5">
                You have recorded completion for this exercise. To re-try or reset to pending, use the button below.
              </p>
            </div>
          </div>

          <div
            v-else
            class="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-start gap-3"
          >
            <AlertCircle class="text-amber-600 shrink-0 mt-0.5" :size="20" />
            <div>
              <p class="text-sm font-bold text-amber-600">Status: Pending</p>
              <p class="text-xs text-muted mt-0.5">
                <template v-if="activity.modes">
                  Choose one of the game modes above, practice on <strong>LingoClip</strong>, and then click <strong>2. Mark as Completed (+25 XP)</strong> to earn XP and maintain your streak!
                </template>
                <template v-else>
                  To mark this activity as <strong>Completed</strong>, click <strong>1. Open on {{ sourceName }}</strong>, finish the exercise on the website, and then click <strong>2. Mark as Completed (+25 XP)</strong>.
                </template>
              </p>
            </div>
          </div>
        </div>

        <!-- Action Buttons - Fixed at bottom -->
        <div class="p-5 border-t border-line bg-surface shrink-0 flex flex-col sm:flex-row gap-3">
          <button
            type="button"
            class="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-2xl bg-bg hover:bg-bgSecondary border border-line text-ink font-bold text-sm transition-all shadow-xs group cursor-pointer"
            @click="handleOpenActivity"
          >
            <ExternalLink :size="18" class="text-primary group-hover:scale-110 transition-transform" />
            <span>{{ activity.route ? '1. Open Activity' : `1. Open on ${sourceName}` }}</span>
          </button>

          <button
            type="button"
            :disabled="loading"
            class="flex-1 flex items-center justify-center gap-2 py-3 px-5 rounded-2xl font-bold text-sm transition-all shadow-md cursor-pointer"
            :class="
              isDone
                ? 'bg-bgSecondary text-muted hover:bg-amber-500/20 hover:text-amber-600 border border-line'
                : 'bg-emerald-600 hover:bg-emerald-700 text-white shadow-emerald-500/20'
            "
            @click="emit('toggle-done', activity)"
          >
            <RefreshCw v-if="loading" :size="18" class="animate-spin" />
            <template v-else-if="isDone">
              <Clock :size="18" />
              <span>Revert to Pending</span>
            </template>
            <template v-else>
              <CheckCircle2 :size="18" />
              <span>2. Mark as Completed (+25 XP)</span>
            </template>
          </button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
