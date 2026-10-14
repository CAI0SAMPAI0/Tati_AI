<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue';
import { useRouter } from 'vue-router';
import {
  Menu,
  Mic,
  BookMarked,
  Check,
  Trophy,
  Bell,
  FileText,
} from 'lucide-vue-next';
import { ACCENTS, getStoredAccent, saveStoredAccent } from '@/constants/accents';
import { useAuthStore } from '@/stores/auth';

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
const authStore = useAuthStore();

const user = computed(() => authStore.user);
const currentStreak = computed(() => (user.value as any)?.streak || (user.value as any)?.streak_count || 3);
const isStreakActive = computed(() => currentStreak.value > 0);
const trophiesEarned = ref(16);
const totalTrophies = ref(50);

const currentAccent = ref(getStoredAccent());
const isAccentMenuOpen = ref(false);
const accentMenuRef = ref<HTMLDivElement | null>(null);

const isNotificationsOpen = ref(false);
const notifRef = ref<HTMLDivElement | null>(null);

const currentAccentObj = computed(() => {
  return ACCENTS.find((a) => a.id === currentAccent.value) || ACCENTS[0];
});

function handleSelectAccent(accId: string) {
  currentAccent.value = accId;
  saveStoredAccent(accId);
  isAccentMenuOpen.value = false;
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('tati_accent_changed', { detail: accId }));
  }
}

function handleClickOutside(e: MouseEvent) {
  if (accentMenuRef.value && !accentMenuRef.value.contains(e.target as Node)) {
    isAccentMenuOpen.value = false;
  }
  if (notifRef.value && !notifRef.value.contains(e.target as Node)) {
    isNotificationsOpen.value = false;
  }
}

async function fetchStreakAndNotifs() {
  if (!authStore.token) return;
  try {
    const res = await fetch('/users/streak', {
      headers: { Authorization: `Bearer ${authStore.token}` },
    });
    if (res.ok) {
      const data = await res.json();
      if (typeof data.trophies_earned === 'number') trophiesEarned.value = data.trophies_earned;
      if (typeof data.total_trophies === 'number') totalTrophies.value = data.total_trophies;
    }
  } catch (_) {}
}

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside);
  fetchStreakAndNotifs();
});

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside);
});
</script>

<template>
  <header class="h-14 flex items-center justify-between px-4 border-b border-border bg-bg shrink-0 z-30">
    <!-- Left: Menu toggle + Logo + Title -->
    <div class="flex items-center gap-3 overflow-hidden">
      <button
        type="button"
        aria-label="Abrir menu"
        class="p-1.5 rounded-md hover:bg-surface-hover text-text-muted cursor-pointer md:hidden"
        @click="emit('toggleSidebar')"
      >
        <Menu :size="20" />
      </button>

      <img
        alt="Taty's Hub"
        width="30"
        height="30"
        class="object-cover shrink-0 hidden md:inline-block rounded-full object-top border-[3px] border-purple-300/50 mb-0 mx-auto"
        src="/images/tati_logo.jpg"
      />

      <h1 class="text-[0.875rem] font-bold text-text truncate">
        {{ title || "Taty's Hub" }}
      </h1>
    </div>

    <!-- Right: Stats, Accent, Notifications, Activities, Voice -->
    <div class="flex items-center gap-1.5 sm:gap-2">
      <!-- Streak Pill -->
      <router-link
        to="/achievements"
        class="hidden md:flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-[#fff0dc9a] dark:bg-[#2E2519] text-white border border-border hover:border-primary/40 text-xs font-bold transition-all active:scale-95 shadow-xs"
        :title="`Streak: ${currentStreak} days (${isStreakActive ? 'Active' : 'Inactive'})`"
      >
        <div class="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center transition-transform hover:scale-110">
          <img
            src="/images/streak-active.svg"
            alt="Streak"
            class="w-4 h-4 sm:w-5 sm:h-5 object-contain"
          />
        </div>
        <span class="min-w-[1ch] inline-block text-[11px] sm:text-xs text-orange-500 font-bold">
          {{ currentStreak }}
        </span>
      </router-link>

      <!-- Trophies Pill -->
      <router-link
        to="/achievements"
        class="hidden md:flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-[#EAF0F3] dark:bg-[#1C2B35] border border-border hover:border-primary/40 text-xs font-bold transition-all active:scale-95 shadow-xs text-yellow-500"
        title="Achievements"
      >
        <Trophy :size="15" fill="currentColor" stroke="currentColor" :stroke-width="2" />
        <span class="text-text-muted font-medium text-[11px] sm:text-xs min-w-[2.5ch] inline-block">
          {{ trophiesEarned }}/{{ totalTrophies }}
        </span>
      </router-link>

      <!-- Accent Selector Dropdown -->
      <div ref="accentMenuRef" class="relative">
        <button
          type="button"
          class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-surface border border-border hover:border-primary/40 text-xs font-bold text-text transition-all active:scale-95 cursor-pointer shadow-xs"
          :title="`Teacher Tati Accent: ${currentAccentObj.label}`"
          @click="isAccentMenuOpen = !isAccentMenuOpen"
        >
          <span class="text-sm">{{ currentAccentObj.flag }}</span>
          <span class="hidden sm:inline text-[11px] font-bold text-text-muted">{{ currentAccentObj.shortLabel }}</span>
        </button>

        <!-- Dropdown Box -->
        <div
          v-if="isAccentMenuOpen"
          class="absolute right-0 top-full mt-2 w-52 bg-surface border border-border rounded-2xl shadow-xl p-1.5 z-50 animate-fade-in"
        >
          <div class="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted border-b border-border mb-1">
            Teacher Tati Accent
          </div>
          <div class="max-h-60 overflow-y-auto space-y-0.5 custom-scrollbar">
            <button
              v-for="acc in ACCENTS"
              :key="acc.id"
              type="button"
              class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all text-left cursor-pointer"
              :class="
                acc.id === currentAccent
                  ? 'bg-primary/15 text-primary font-bold'
                  : 'hover:bg-surface-hover text-text'
              "
              @click="handleSelectAccent(acc.id)"
            >
              <div class="flex items-center gap-2 truncate">
                <span>{{ acc.flag }}</span>
                <span class="truncate">{{ acc.label.replace(/^.*?\s/, '') }}</span>
              </div>
              <Check v-if="acc.id === currentAccent" :size="14" class="text-primary shrink-0" />
            </button>
          </div>
        </div>
      </div>

      <!-- Notifications Bell Button -->
      <div ref="notifRef" class="relative">
        <button
          type="button"
          aria-label="Notifications"
          title="Notifications"
          class="relative p-2 text-text-subtle hover:text-primary transition-colors rounded-lg hover:bg-surface-hover cursor-pointer"
          @click="isNotificationsOpen = !isNotificationsOpen"
        >
          <Bell :size="20" />
        </button>

        <div
          v-if="isNotificationsOpen"
          class="absolute right-0 top-full mt-2 w-72 bg-surface border border-border rounded-2xl shadow-xl p-3 z-50 animate-fade-in text-xs"
        >
          <div class="font-bold text-text border-b border-border pb-2 mb-2 flex items-center justify-between">
            <span>Notifications</span>
            <span class="text-[10px] text-text-muted">0 unread</span>
          </div>
          <p class="text-text-muted text-center py-4">No recent notifications</p>
        </div>
      </div>

      <!-- Contextual Chat Actions (Only when chat has started) -->
      <template v-if="hasChatStarted">
        <router-link
          to="/activities"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-surface hover:bg-surface-hover text-xs font-bold text-text transition shadow-xs"
          title="My Activities"
        >
          <BookMarked :size="14" class="text-primary" />
          <span class="hidden sm:inline">Activities</span>
        </router-link>

        <button
          v-if="showSummaryBtn"
          type="button"
          class="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-surface hover:bg-surface-hover text-xs font-bold text-text transition shadow-xs cursor-pointer"
          title="Pedagogical Summary"
          @click="emit('showSummary')"
        >
          <FileText :size="14" class="text-primary" />
          <span class="hidden sm:inline">Summary</span>
        </button>

        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-border bg-surface hover:bg-surface-hover text-xs font-bold text-text transition shadow-xs cursor-pointer"
          title="Voice Mode"
          @click="emit('switchToVoice')"
        >
          <Mic :size="14" class="text-primary" />
          <span class="hidden sm:inline">Voice Mode</span>
        </button>
      </template>
    </div>
  </header>
</template>
