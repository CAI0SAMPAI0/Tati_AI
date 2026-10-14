<script setup lang="ts">
import { ref, computed, onMounted } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import {
  Menu,
  Trophy,
  MessageSquareHeart,
  Bug,
  Bell,
  CheckCheck,
  X,
} from 'lucide-vue-next';
import { useAuthStore } from '@/stores/auth';

const props = withDefaults(
  defineProps<{
    hideStats?: boolean;
    hideStreakAndTrophies?: boolean;
  }>(),
  {
    hideStats: false,
    hideStreakAndTrophies: false,
  }
);

const emit = defineEmits<{
  (e: 'toggleMenu'): void;
}>();

const route = useRoute();
const router = useRouter();
const authStore = useAuthStore();

const user = computed(() => authStore.user);
const currentStreak = computed(() => (user.value as any)?.streak || (user.value as any)?.streak_count || 0);
const isStreakActive = computed(() => currentStreak.value > 0);
const trophiesEarned = ref(12);
const totalTrophies = ref(50);

const isNotificationsOpen = ref(false);
const unreadCount = ref(0);
const notifications = ref<any[]>([]);

const avatarUrl = computed(() => {
  return (user.value as any)?.avatar_url || '/images/tati_logo.jpg';
});

const isHubOnly = computed(() => (user.value as any)?.is_hub_only);
const isSettings = computed(() => props.hideStats || props.hideStreakAndTrophies || route.path.startsWith('/settings'));
const shouldHideStreakAndTrophies = computed(() => isHubOnly.value || isSettings.value);

async function fetchStreakAndNotifications() {
  if (!authStore.token) return;
  try {
    const resStreak = await fetch('/users/streak', {
      headers: { Authorization: `Bearer ${authStore.token}` },
    });
    if (resStreak.ok) {
      const data = await resStreak.json();
      if (typeof data.trophies_earned === 'number') {
        trophiesEarned.value = data.trophies_earned;
      }
      if (typeof data.total_trophies === 'number') {
        totalTrophies.value = data.total_trophies;
      }
    }

    const resNotif = await fetch('/notifications', {
      headers: { Authorization: `Bearer ${authStore.token}` },
    });
    if (resNotif.ok) {
      const notifs = await resNotif.json();
      if (Array.isArray(notifs)) {
        notifications.value = notifs;
        unreadCount.value = notifs.filter((n) => !n.read).length;
      }
    }
  } catch (err) {
    // Non-blocking
  }
}

async function markAllNotificationsRead() {
  if (!authStore.token) return;
  try {
    await fetch('/notifications/read-all', {
      method: 'POST',
      headers: { Authorization: `Bearer ${authStore.token}` },
    });
    unreadCount.value = 0;
    notifications.value.forEach((n) => (n.read = true));
  } catch (_) {}
}

onMounted(() => {
  fetchStreakAndNotifications();
});
</script>

<template>
  <header class="h-16 flex items-center justify-between px-3 md:px-5 border-b border-line bg-surface sticky top-0 z-40">
    <!-- Left: Menu toggle & Brand -->
    <div class="flex items-center gap-3">
      <button
        type="button"
        aria-label="Abrir menu de navegação"
        class="p-2 rounded-lg hover:bg-bgSecondary text-muted md:hidden cursor-pointer"
        @click="emit('toggleMenu')"
      >
        <Menu :size="20" />
      </button>

      <router-link
        :to="isHubOnly ? '/activities/hub' : '/chat'"
        class="flex items-center gap-2 font-display font-bold tracking-tight pl-1 hover:opacity-90 transition-opacity text-base md:text-lg"
      >
        <span>Teacher <span class="text-primary">Taty</span></span>
      </router-link>
    </div>

    <!-- Right: Stats, Feedback, Notifications & Profile -->
    <div class="flex items-center gap-2 sm:gap-4">
      <div class="flex items-center gap-2.5 sm:gap-4">
        <!-- Streak & Trophies -->
        <template v-if="!shouldHideStreakAndTrophies">
          <!-- Streak -->
          <router-link
            to="/achievements"
            class="flex items-center gap-1.5 font-bold text-sm hover:opacity-80 transition-opacity"
            :title="`Streak: ${currentStreak} days (${isStreakActive ? 'Active' : 'Inactive'})`"
          >
            <div
              class="w-6 h-6 flex items-center justify-center transition-transform hover:scale-110"
              :class="{ 'opacity-40 grayscale': !isStreakActive }"
            >
              <img
                :src="isStreakActive ? '/images/streak-active.svg' : '/images/streak-inactive.svg'"
                alt="Streak"
                class="w-[18px] h-[22px] object-contain"
              />
            </div>
            <span
              class="min-w-[1ch] inline-block"
              :class="isStreakActive ? 'text-amber-500 font-bold' : 'text-muted font-medium'"
            >
              {{ currentStreak }}
            </span>
          </router-link>

          <!-- Trophies -->
          <router-link
            to="/achievements"
            class="flex items-center gap-1.5 text-yellow-500 font-bold text-sm hover:opacity-80 transition-opacity"
            title="Achievements"
          >
            <Trophy :size="18" class="fill-current" />
            <span class="text-muted font-medium min-w-[3ch] inline-block text-xs sm:text-sm">
              {{ trophiesEarned }}/{{ totalTrophies }}
            </span>
          </router-link>
        </template>

        <!-- Feedback Taty button -->
        <button
          type="button"
          class="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-primary hover:bg-primary/10 transition-colors cursor-pointer"
          title="Enviar Feedback para Teacher Tatiana"
          @click="router.push('/chat?topic=feedback')"
        >
          <MessageSquareHeart :size="17" />
          <span class="hidden xl:inline">Feedback Taty</span>
        </button>

        <!-- Notifications Bell -->
        <div class="relative">
          <button
            type="button"
            aria-label="Notificações"
            class="relative p-2 text-muted hover:text-primary transition-colors rounded-lg hover:bg-bgSecondary cursor-pointer"
            @click="isNotificationsOpen = !isNotificationsOpen"
          >
            <Bell :size="20" />
            <span
              v-if="unreadCount > 0"
              class="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-rose-500 rounded-full border-2 border-surface animate-pulse"
            />
          </button>

          <!-- Notifications Dropdown Box -->
          <div
            v-if="isNotificationsOpen"
            class="fixed sm:absolute left-4 right-4 sm:left-auto sm:right-0 top-16 sm:top-full mt-2 sm:w-80 max-w-[calc(100vw-2rem)] bg-surface border border-line rounded-2xl shadow-2xl z-[300] overflow-hidden"
          >
            <div class="flex items-center justify-between px-4 py-3 border-b border-line bg-surface">
              <span class="text-sm font-bold text-ink">
                Notifications
                <span
                  v-if="unreadCount > 0"
                  class="ml-1 text-[0.65rem] bg-primarySoft text-primary px-1.5 py-0.5 rounded-full font-bold"
                >
                  {{ unreadCount }}
                </span>
              </span>
              <button
                v-if="unreadCount > 0"
                type="button"
                class="text-xs text-primary font-semibold hover:underline flex items-center gap-1 cursor-pointer"
                @click="markAllNotificationsRead"
              >
                <CheckCheck :size="14" />
                Marcar lidas
              </button>
            </div>

            <!-- Notifications list -->
            <div class="max-h-72 overflow-y-auto divide-y divide-line/60">
              <div
                v-if="notifications.length === 0"
                class="p-6 text-center text-xs text-muted"
              >
                Nenhuma notificação nova no momento.
              </div>
              <div
                v-for="notif in notifications"
                :key="notif.id"
                class="p-3 text-xs flex gap-2.5 hover:bg-bgSecondary transition"
                :class="{ 'bg-primarySoft/30': !notif.read }"
              >
                <div class="flex-1 space-y-1">
                  <p class="font-bold text-ink">{{ notif.title || 'Aviso da Tati' }}</p>
                  <p class="text-muted leading-relaxed">{{ notif.message }}</p>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- User Profile Pill / Avatar -->
        <router-link
          to="/profile"
          class="flex items-center gap-2 pl-2 border-l border-line hover:opacity-80 transition-opacity"
        >
          <span class="hidden md:block text-xs font-semibold text-ink truncate max-w-[120px]">
            {{ user?.name || user?.username }}
          </span>
          <div class="w-8 h-8 rounded-full bg-primarySoft border border-primary/20 flex items-center justify-center text-[0.7rem] font-bold text-primary overflow-hidden">
            <img
              :src="avatarUrl"
              alt="Avatar"
              class="w-full h-full object-cover"
              @error="(e: any) => { e.currentTarget.src = '/images/tati_logo.jpg'; }"
            />
          </div>
        </router-link>
      </div>
    </div>
  </header>
</template>
