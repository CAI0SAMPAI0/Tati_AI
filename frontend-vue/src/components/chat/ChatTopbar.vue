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
  CheckCheck,
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
const trophiesEarned = ref(0);
const totalTrophies = ref(50);

const currentAccent = ref(getStoredAccent());
const isAccentMenuOpen = ref(false);
const accentMenuRef = ref<HTMLDivElement | null>(null);

const isNotificationsOpen = ref(false);
const unreadCount = ref(0);
const notifications = ref<any[]>([]);
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
  <header class="h-14 flex items-center justify-between px-4 border-b border-line bg-bg shrink-0 z-30">
    <!-- Left: Menu toggle + Logo + Title -->
    <div class="flex items-center gap-3 overflow-hidden">
      <button
        type="button"
        aria-label="Abrir menu"
        class="p-1.5 rounded-md hover:bg-bgSecondary text-muted cursor-pointer"
        @click="emit('toggleSidebar')"
      >
        <Menu :size="20" />
      </button>

      <div class="hidden md:inline-block w-[30px] h-[30px] rounded-full overflow-hidden border-[3px] border-purple-300/50 shrink-0">
        <img
          src="/images/tati_logo.jpg"
          alt="Taty's Hub"
          class="w-full h-full object-cover object-top"
        />
      </div>

      <h1 class="text-[0.875rem] font-bold text-ink truncate">
        {{ title || "Taty's Hub" }}
      </h1>
    </div>

    <!-- Right: Stats, Accent, Notifications, Activities, Voice -->
    <div class="flex items-center gap-1.5 sm:gap-2">
      <!-- Streak Pill -->
      <router-link
        to="/achievements"
        class="hidden md:flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-[#fff0dc9a] dark:bg-[#2E2519] text-ink border border-line hover:border-primary/40 text-xs font-bold transition-all active:scale-95 shadow-xs"
        :title="`Ofensiva: ${currentStreak} dias (${isStreakActive ? 'Ativa' : 'Inativa'})`"
      >
        <div
          class="w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center transition-transform hover:scale-110"
          :class="{ 'opacity-40 grayscale': !isStreakActive }"
        >
          <img
            :src="isStreakActive ? '/images/streak-active.svg' : '/images/streak-inactive.svg'"
            alt="Ofensiva"
            class="w-4 h-4 sm:w-5 sm:h-5 object-contain"
          />
        </div>
        <span
          class="min-w-[1ch] inline-block text-[11px] sm:text-xs font-bold"
          :class="isStreakActive ? 'text-orange-500' : 'text-muted'"
        >
          {{ currentStreak }}
        </span>
      </router-link>

      <!-- Trophies Pill -->
      <router-link
        to="/achievements"
        class="hidden md:flex items-center gap-1 sm:gap-1.5 px-2 py-1 sm:px-2.5 sm:py-1.5 rounded-xl bg-[#EAF0F3] dark:bg-[#1C2B35] border border-line hover:border-primary/40 text-xs font-bold transition-all active:scale-95 shadow-xs text-yellow-500"
        title="Conquistas e Troféus"
      >
        <Trophy :size="15" class="fill-current" />
        <span class="text-muted font-medium text-[11px] sm:text-xs min-w-[2.5ch] inline-block">
          {{ trophiesEarned }}/{{ totalTrophies }}
        </span>
      </router-link>

      <!-- Accent Selector Dropdown -->
      <div ref="accentMenuRef" class="relative">
        <button
          type="button"
          class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-surface border border-line hover:border-primary/40 text-xs font-bold text-ink transition-all active:scale-95 cursor-pointer shadow-xs"
          :title="`Sotaque da Teacher Tati: ${currentAccentObj.label}`"
          @click="isAccentMenuOpen = !isAccentMenuOpen"
        >
          <span class="text-sm">{{ currentAccentObj.flag }}</span>
          <span class="hidden sm:inline text-[11px] font-bold text-muted">{{ currentAccentObj.shortLabel }}</span>
        </button>

        <!-- Dropdown Box -->
        <div
          v-if="isAccentMenuOpen"
          class="absolute right-0 top-full mt-2 w-52 bg-surface border border-line rounded-2xl shadow-xl p-1.5 z-50 animate-fade-in"
        >
          <div class="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-muted border-b border-line mb-1">
            Sotaque da Teacher Tati
          </div>
          <div class="max-h-60 overflow-y-auto space-y-0.5 no-scrollbar">
            <button
              v-for="acc in ACCENTS"
              :key="acc.id"
              type="button"
              class="w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all text-left cursor-pointer"
              :class="
                acc.id === currentAccent
                  ? 'bg-primarySoft text-primary font-bold'
                  : 'hover:bg-bgSecondary text-ink'
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
          aria-label="Notificações"
          title="Notificações"
          class="p-2 rounded-xl border border-line bg-surface hover:bg-bgSecondary text-muted hover:text-ink transition shadow-xs cursor-pointer"
          @click="isNotificationsOpen = !isNotificationsOpen"
        >
          <Bell :size="16" />
        </button>

        <div
          v-if="isNotificationsOpen"
          class="absolute right-0 top-full mt-2 w-72 bg-surface border border-line rounded-2xl shadow-xl p-3 z-50 animate-fade-in text-xs"
        >
          <div class="font-bold text-ink border-b border-line pb-2 mb-2 flex items-center justify-between">
            <span>Notificações</span>
            <span class="text-[10px] text-muted">0 não lidas</span>
          </div>
          <p class="text-muted text-center py-4">Nenhuma notificação recente</p>
        </div>
      </div>

      <!-- Contextual Chat Actions (Only when chat has started) -->
      <template v-if="hasChatStarted">
        <!-- Activities Button -->
        <router-link
          to="/activities"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line bg-surface hover:bg-bgSecondary text-xs font-bold text-ink transition shadow-xs"
          title="Minhas Atividades"
        >
          <BookMarked :size="14" class="text-primary" />
          <span class="hidden sm:inline">Atividades</span>
        </router-link>

        <!-- Summary Button -->
        <button
          v-if="showSummaryBtn"
          type="button"
          class="hidden lg:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line bg-surface hover:bg-bgSecondary text-xs font-bold text-ink transition shadow-xs cursor-pointer"
          title="Resumo pedagógico da conversa"
          @click="emit('showSummary')"
        >
          <FileText :size="14" class="text-primary" />
          <span class="hidden sm:inline">Resumo</span>
        </button>

        <!-- Voice Button -->
        <button
          type="button"
          class="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-line bg-surface hover:bg-bgSecondary text-xs font-bold text-ink transition shadow-xs cursor-pointer"
          title="Modo de Voz"
          @click="emit('switchToVoice')"
        >
          <Mic :size="14" class="text-primary" />
          <span class="hidden sm:inline">Modo de Voz</span>
        </button>
      </template>
    </div>
  </header>
</template>
