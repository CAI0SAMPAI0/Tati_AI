<script setup lang="ts">
import { ref, computed } from 'vue';
import { useRouter } from 'vue-router';
import { Menu, Trophy, Bug, MessageSquareHeart, Moon, Sun } from 'lucide-vue-next';
import { useAuth } from '@/composables/useAuth';
import { useStreakAndTrophies } from '@/composables/useStreakAndTrophies';
import { useThemeStore } from '@/stores/theme';
import { DEFAULT_AVATAR_URL } from '@/constants/user';
import DeveloperBugModal from '../feedback/DeveloperBugModal.vue';
import StudentFeedbackModal from '../feedback/StudentFeedbackModal.vue';
import NotificationsDropdown from './NotificationsDropdown.vue';

defineProps<{
  hideStats?: boolean;
}>();

const emit = defineEmits<{
  (e: 'toggleMenu'): void;
}>();

const router = useRouter();
const { user } = useAuth();
const themeStore = useThemeStore();
const { currentStreak, isStreakActive, trophiesEarned, totalTrophies } = useStreakAndTrophies();

const isBugOpen = ref(false);
const isFeedbackOpen = ref(false);

const avatarUrl = computed(() => {
  const raw = user.value?.avatar_url || (user.value as any)?.profile?.avatar_url;
  return (!raw || (raw.includes('/avatar/avatar_tati') && (user.value as any)?.role !== 'teacher'))
    ? DEFAULT_AVATAR_URL
    : raw;
});
</script>

<template>
  <header class="h-16 flex items-center justify-between px-3 md:px-5 border-b border-border bg-bg sticky top-0 z-40 transition-colors">
    <!-- Left: Hamburger + Title -->
    <div class="flex items-center gap-3">
      <button
        type="button"
        @click="emit('toggleMenu')"
        class="p-2 rounded-xl hover:bg-surface-hover text-text-muted transition-colors cursor-pointer"
        aria-label="Toggle Menu"
      >
        <Menu class="w-5 h-5" />
      </button>

      <router-link
        to="/chat"
        class="flex items-center gap-2 font-display font-bold tracking-tight text-base md:text-lg hover:opacity-90 transition-opacity"
      >
        <span>Teacher <span class="text-primary">Taty</span></span>
      </router-link>
    </div>

    <!-- Right: Stats + Actions + Notifications + Profile -->
    <div class="flex items-center gap-2 md:gap-3">
      <!-- Streak & Trophies -->
      <div v-if="!hideStats" class="flex items-center gap-2 md:gap-3">
        <router-link
          to="/progress"
          class="flex items-center gap-1.5 font-bold text-xs sm:text-sm hover:opacity-80 transition-opacity"
          :title="`Streak: ${currentStreak} days (${isStreakActive ? 'Active' : 'Inactive'})`"
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
            class="min-w-[1ch] inline-block text-xs sm:text-sm"
            :class="(currentStreak > 0 && isStreakActive) ? 'text-orange-500 font-bold' : 'text-text-muted font-medium'"
          >
            {{ currentStreak }}
          </span>
        </router-link>

        <router-link
          to="/achievements"
          class="flex items-center gap-1.5 text-yellow-500 font-bold text-xs sm:text-sm hover:opacity-80 transition-opacity"
          title="Achievements"
        >
          <Trophy class="w-4 h-4 fill-current" />
          <span class="text-text-muted font-medium text-xs sm:text-sm">
            {{ trophiesEarned }}/{{ totalTrophies }}
          </span>
        </router-link>
      </div>

      <!-- Feedback Taty Button -->
      <button
        type="button"
        @click="isFeedbackOpen = true"
        class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-primary hover:bg-primary/10 transition-colors cursor-pointer"
        title="Enviar feedback ou sugestão para a Professora Tatiana"
      >
        <MessageSquareHeart class="w-4 h-4" />
        <span class="hidden xl:inline">Feedback Taty</span>
      </button>

      <!-- Bug Report Button -->
      <button
        type="button"
        @click="isBugOpen = true"
        class="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/10 transition-colors cursor-pointer"
        title="Reportar problema ao desenvolvedor"
      >
        <Bug class="w-4 h-4" />
        <span class="hidden xl:inline">Bug Report</span>
      </button>

      <!-- Notifications Dropdown -->
      <NotificationsDropdown />

      <!-- Theme Switch -->
      <button
        type="button"
        @click="themeStore.toggleTheme"
        class="p-2 rounded-xl text-text-muted hover:text-text hover:bg-surface-hover transition-colors cursor-pointer"
        :title="themeStore.isDark ? 'Tema claro' : 'Tema escuro'"
      >
        <Sun v-if="themeStore.isDark" class="w-4 h-4 text-yellow-400" />
        <Moon v-else class="w-4 h-4 text-text-muted" />
      </button>

      <!-- Profile Avatar link -->
      <router-link
        to="/profile"
        class="hidden md:flex items-center gap-2 pl-2 border-l border-border hover:opacity-80 transition-opacity"
      >
        <span class="hidden md:block text-xs font-semibold text-text truncate max-w-[100px]">
          {{ user?.name || user?.username }}
        </span>
        <div class="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[0.7rem] font-bold text-primary overflow-hidden">
          <img
            :src="avatarUrl"
            alt="Avatar"
            class="w-full h-full object-cover"
            @error="(e: any) => { e.currentTarget.src = DEFAULT_AVATAR_URL; }"
          />
        </div>
      </router-link>
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
