<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue';
import { Bell, BellOff, CheckCheck } from 'lucide-vue-next';
import { useNotificationStore, type AppNotification } from '@/stores/notifications';

const notifStore = useNotificationStore();
const isOpen = ref(false);
const dropdownRef = ref<HTMLDivElement | null>(null);

const NOTIF_ICONS: Record<string, string> = {
  correction: '✏️',
  new_activity: '📚',
  reminder: '⏰',
  ranking: '🏆',
  streak: '🔥',
  streak_reminder: '🔥',
  streak_broken: '💔',
  streak_milestone: '🏅',
  welcome: '👋',
  report: '📊',
  retention: '🍎',
  trophy: '🏆',
  ai_generation: '✨',
  general: '🔔',
};

function timeAgo(dateStr: string): string {
  if (!dateStr) return '';
  const diff = Date.now() - new Date(dateStr).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(dateStr).toLocaleDateString('en-US');
}

function handleToggle() {
  isOpen.value = !isOpen.value;
  if (isOpen.value) {
    notifStore.fetchNotifications();
  }
}

function handleClickOutside(event: MouseEvent) {
  if (dropdownRef.value && !dropdownRef.value.contains(event.target as Node)) {
    isOpen.value = false;
  }
}

let pollInterval: any = null;

onMounted(() => {
  document.addEventListener('mousedown', handleClickOutside);
  notifStore.fetchNotifications();
  pollInterval = setInterval(() => {
    notifStore.fetchNotifications();
  }, 45000);
});

onUnmounted(() => {
  document.removeEventListener('mousedown', handleClickOutside);
  if (pollInterval) clearInterval(pollInterval);
});
</script>

<template>
  <div ref="dropdownRef" class="relative">
    <button
      type="button"
      @click="handleToggle"
      class="relative p-2 text-text-subtle hover:text-primary transition-colors rounded-xl hover:bg-surface-hover cursor-pointer"
      aria-label="Notifications"
      title="Notificações"
    >
      <Bell class="w-5 h-5" />
      <span
        v-if="notifStore.unreadCount > 0"
        class="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-surface animate-pulse"
      />
    </button>

    <!-- Dropdown Panel -->
    <div
      v-if="isOpen"
      class="fixed sm:absolute left-4 right-4 sm:left-auto sm:right-0 top-16 sm:top-full mt-2 sm:w-80 max-w-[calc(100vw-2rem)] bg-surface border border-border rounded-2xl shadow-2xl z-[300] overflow-hidden animate-in fade-in zoom-in-95 duration-150"
    >
      <!-- Header -->
      <div class="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
        <span class="text-sm font-bold text-text flex items-center gap-1.5">
          Notifications
          <span
            v-if="notifStore.unreadCount > 0"
            class="text-[0.65rem] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-black"
          >
            {{ notifStore.unreadCount }}
          </span>
        </span>
        <button
          v-if="notifStore.unreadCount > 0"
          type="button"
          @click="notifStore.markAllRead()"
          class="flex items-center gap-1 text-[0.65rem] font-bold text-primary hover:text-primary/80 transition-colors cursor-pointer"
        >
          <CheckCheck class="w-3.5 h-3.5" />
          Mark all as read
        </button>
      </div>

      <!-- List -->
      <div class="max-h-80 overflow-y-auto custom-scrollbar">
        <div v-if="notifStore.isLoading && notifStore.notifications.length === 0" class="py-8 flex justify-center">
          <div class="w-5 h-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
        </div>

        <div
          v-else-if="notifStore.notifications.length === 0"
          class="py-10 flex flex-col items-center gap-2 text-text-subtle"
        >
          <BellOff class="w-7 h-7 opacity-40" />
          <p class="text-xs font-medium">No notifications</p>
        </div>

        <div
          v-for="n in notifStore.notifications"
          :key="n.id"
          @click="notifStore.markRead(n.id)"
          class="flex items-start gap-3 px-4 py-3 hover:bg-bg-secondary/50 cursor-pointer transition-colors border-b border-border/50 last:border-0"
          :class="{ 'bg-primary/5': !n.is_read }"
        >
          <div class="w-8 h-8 rounded-xl bg-bg-secondary flex items-center justify-center text-base shrink-0 mt-0.5">
            {{ NOTIF_ICONS[n.category] || '🔔' }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center justify-between gap-2">
              <p
                class="text-xs font-bold truncate"
                :class="!n.is_read ? 'text-primary' : 'text-text'"
              >
                {{ n.title }}
              </p>
              <span v-if="!n.is_read" class="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
            </div>
            <p class="text-[0.68rem] text-text-muted leading-relaxed mt-0.5 line-clamp-2">
              {{ n.body }}
            </p>
            <p class="text-[0.6rem] text-text-subtle mt-1">
              {{ timeAgo(n.created_at) }}
            </p>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
