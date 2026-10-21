<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import { Menu, Trophy, Check, BookMarked, FileText, Mic, MessageSquareHeart, Bug } from 'lucide-vue-next';
import { ACCENTS, getStoredAccent, saveStoredAccent } from '@/constants/accents';
import { useAuth } from '@/composables/useAuth';
import { useStreakAndTrophies } from '@/composables/useStreakAndTrophies';
import { useToast } from '@/composables/useToast';
import { apiPut } from '@/api/client';
import TatiLogo from '../ui/TatiLogo.vue';
import NotificationsDropdown from '../layout/NotificationsDropdown.vue';
import StudentFeedbackModal from '../feedback/StudentFeedbackModal.vue';
import DeveloperBugModal from '../feedback/DeveloperBugModal.vue';

const props = withDefaults(
  defineProps<{
    title?: string;
    hasChatStarted?: boolean;
    showSummaryBtn?: boolean;
  }>(),
  {
    title: "Taty's Hub",
    hasChatStarted: false,
    showSummaryBtn: false,
  }
);

const emit = defineEmits<{
  (e: 'toggleSidebar'): void;
  (e: 'showSummary'): void;
  (e: 'switchToVoice'): void;
}>();

const router = useRouter();
const toast = useToast();
const { user, accent, setAccent } = useAuth();
const { currentStreak, isStreakActive, trophiesEarned, totalTrophies } = useStreakAndTrophies();

const isAccentMenuOpen = ref(false);
const accentMenuRef = ref<HTMLDivElement | null>(null);
const isFeedbackOpen = ref(false);
const isBugOpen = ref(false);

const currentAccentObj = computed(() => {
  return ACCENTS.find((a) => a.id === accent.value) || ACCENTS[0];
});

async function handleSelectAccent(accentId: string) {
  setAccent(accentId);
  isAccentMenuOpen.value = false;
  const acc = ACCENTS.find((a) => a.id === accentId);
  toast.success(`Voice accent changed to ${acc?.label || accentId}`);

  try {
    await apiPut('/profile', { preferred_accent: accentId, accent: accentId });
  } catch (e) {
    console.error('Failed to sync accent to profile:', e);
  }
}

function handleClickOutside(e: MouseEvent) {
  if (accentMenuRef.value && !accentMenuRef.value.contains(e.target as Node)) {
    isAccentMenuOpen.value = false;
  }
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside);
});

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside);
});
</script>

<template>
  <header class="h-14 flex items-center justify-between px-3 md:px-4 border-b border-border bg-bg shrink-0">
    <!-- Left: Hamburger Menu + Logo + Title -->
    <div class="flex items-center gap-2.5 sm:gap-3 overflow-hidden">
      <button
        aria-label="Abrir menu"
        type="button"
        @click="emit('toggleSidebar')"
        class="p-1.5 rounded-md hover:bg-surface-hover text-text-muted cursor-pointer transition-colors"
      >
        <Menu class="w-5 h-5" />
      </button>

      <TatiLogo
        :size="30"
        class="hidden md:inline-block rounded-full object-cover object-top shrink-0"
      />

      <h1 class="text-[0.875rem] font-bold text-text truncate">
        {{ title || "Taty's Hub" }}
      </h1>
    </div>

    <!-- Right: Streak + Trophies + Accent + Feedback + Notifications + Actions -->
    <div class="flex items-center gap-1.5 sm:gap-2">
      <!-- Streak -->
      <router-link
        to="/progress"
        class="hidden md:flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-[#fff0dc9a] dark:bg-[#2E2519] border border-border hover:border-primary/40 text-xs font-bold transition-all active:scale-95 shadow-xs"
        :title="`Streak: ${currentStreak} days (${currentStreak > 0 && isStreakActive ? 'Active' : 'Inactive'})`"
      >
        <div
          class="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center transition-transform hover:scale-110"
          :class="{ 'opacity-40 grayscale': !isStreakActive }"
        >
          <img
            :src="isStreakActive ? '/images/streak-active.svg' : '/images/streak-inactive.svg'"
            alt="Streak"
            class="w-4 h-5 object-contain"
          />
        </div>
        <span
          class="min-w-[1ch] inline-block text-[11px] sm:text-xs"
          :class="(currentStreak > 0 && isStreakActive) ? 'text-orange-500 font-bold' : 'text-text-muted font-medium'"
        >
          {{ currentStreak }}
        </span>
      </router-link>

      <!-- Trophies -->
      <router-link
        to="/achievements"
        class="hidden md:flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-[#EAF0F3] dark:bg-[#1C2B35] border border-border hover:border-primary/40 text-xs font-bold transition-all active:scale-95 shadow-xs text-yellow-500"
        title="Achievements"
      >
        <Trophy class="w-3.5 h-3.5 fill-current" />
        <span class="text-text-muted font-medium text-[11px] sm:text-xs min-w-[2.5ch] inline-block">
          {{ trophiesEarned }}/{{ totalTrophies }}
        </span>
      </router-link>

      <!-- Accent Selector -->
      <div class="relative" ref="accentMenuRef">
        <button
          type="button"
          @click="isAccentMenuOpen = !isAccentMenuOpen"
          :title="`Teacher Tati Accent: ${currentAccentObj.label}`"
          class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-surface border border-border hover:border-primary/40 text-xs font-bold text-text transition-all active:scale-95 cursor-pointer shadow-xs"
        >
          <span class="text-sm">{{ currentAccentObj.flag }}</span>
          <span class="hidden sm:inline text-[11px] font-bold text-text-muted">
            {{ currentAccentObj.shortLabel }}
          </span>
        </button>

        <!-- Dropdown Menu -->
        <div
          v-if="isAccentMenuOpen"
          class="absolute right-0 top-full mt-2 w-52 bg-surface border border-border rounded-2xl shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150"
        >
          <div class="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted border-b border-border mb-1">
            Teacher Tati Accent
          </div>
          <div class="max-h-60 overflow-y-auto space-y-0.5 custom-scrollbar">
            <button
              v-for="acc in ACCENTS"
              :key="acc.id"
              type="button"
              @click="handleSelectAccent(acc.id)"
              class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all text-left cursor-pointer"
              :class="
                acc.id === accent
                  ? 'bg-primary/10 text-primary font-bold'
                  : 'hover:bg-bg text-text'
              "
            >
              <div class="flex items-center gap-2 truncate">
                <span>{{ acc.flag }}</span>
                <span class="truncate">{{ acc.label.replace(/^.*?\s/, '') }}</span>
              </div>
              <Check v-if="acc.id === accent" class="w-3.5 h-3.5 text-primary shrink-0" />
            </button>
          </div>
        </div>
      </div>

      <!-- Feedback Taty Button -->
      <button
        type="button"
        @click="isFeedbackOpen = true"
        class="hidden sm:flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-primary hover:bg-primary/10 transition-colors cursor-pointer"
        title="Enviar feedback para Professora Tatiana"
      >
        <MessageSquareHeart class="w-3.5 h-3.5" />
        <span class="hidden xl:inline">Feedback Taty</span>
      </button>

      <!-- Bug Report Button -->
      <button
        type="button"
        @click="isBugOpen = true"
        class="hidden lg:flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
        title="Reportar problema ao desenvolvedor"
      >
        <Bug class="w-3.5 h-3.5" />
        <span class="hidden xl:inline">Bug</span>
      </button>

      <!-- Notifications Dropdown -->
      <NotificationsDropdown />

      <!-- Actions if chat started -->
      <template v-if="hasChatStarted">
        <button
          type="button"
          @click="router.push('/activities')"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface border border-border hover:bg-surface-hover text-xs font-bold text-text transition-all cursor-pointer"
          title="My Activities"
        >
          <BookMarked class="w-3.5 h-3.5 text-primary" />
          <span class="hidden sm:inline">Activities</span>
        </button>

        <button
          v-if="showSummaryBtn"
          type="button"
          @click="emit('showSummary')"
          class="hidden lg:flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface border border-border hover:bg-surface-hover text-xs font-bold text-text transition-all cursor-pointer"
          title="Summary"
        >
          <FileText class="w-3.5 h-3.5 text-primary" />
          <span class="hidden sm:inline">Summary</span>
        </button>

        <button
          type="button"
          @click="emit('switchToVoice')"
          class="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface border border-border hover:bg-surface-hover text-xs font-bold text-text transition-all cursor-pointer"
          title="Voice Mode"
        >
          <Mic class="w-3.5 h-3.5 text-primary" />
          <span class="hidden sm:inline">Voice</span>
        </button>
      </template>
    </div>

    <!-- Modals -->
    <StudentFeedbackModal
      :is-open="isFeedbackOpen"
      @close="isFeedbackOpen = false"
      :cefr-level="user?.level || 'A1'"
    />

    <DeveloperBugModal
      :is-open="isBugOpen"
      @close="isBugOpen = false"
    />
  </header>
</template>
