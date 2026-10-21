import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import { apiGet, apiPost } from '@/api/client';
import { useAuthStore } from './auth';
import { useToast } from '@/composables/useToast';

export interface AppNotification {
  id: string;
  category: string;
  title: string;
  body: string;
  created_at: string;
  is_read: boolean;
}

const SEEN_NOTIFS_STORAGE_KEY = 'tati_seen_notification_ids';

function getStoredSeenIds(): Set<string> {
  if (typeof window === 'undefined') return new Set();
  try {
    const raw = sessionStorage.getItem(SEEN_NOTIFS_STORAGE_KEY);
    if (raw) {
      return new Set(JSON.parse(raw));
    }
  } catch {}
  return new Set();
}

function saveStoredSeenIds(ids: Set<string>) {
  if (typeof window === 'undefined') return;
  try {
    sessionStorage.setItem(SEEN_NOTIFS_STORAGE_KEY, JSON.stringify(Array.from(ids)));
  } catch {}
}

export const useNotificationStore = defineStore('notifications', () => {
  const notifications = ref<AppNotification[]>([]);
  const isLoading = ref(false);
  const authStore = useAuthStore();
  const toast = useToast();

  const seenNotifIds = getStoredSeenIds();
  let initialLoadDone = false;

  const unreadCount = computed(() => {
    return notifications.value.filter((n) => !n.is_read).length;
  });

  function alertNotification(n: AppNotification) {
    let displayTitle = n.title || '';
    let displayBody = n.body || '';
    const cat = (n.category || '').toLowerCase();

    // Normalização de troféus e conquistas
    if (
      cat === 'trophy' ||
      cat === 'achievements' ||
      displayTitle.toLowerCase().includes('trof') ||
      displayTitle.toLowerCase().includes('conquist')
    ) {
      if (displayTitle.includes('Parabéns! Você conquistou o') || displayTitle.includes('Parabens!')) {
        displayTitle = displayTitle
          .replace(/Parab[eé]ns!\s*Voc[eé]\s*conquistou\s*o/gi, 'Congratulations! You won')
          .replace(/º\s*Lugar\s*na\s*Competi[çc][ãa]o\s*Mensal!/gi, ' Place in the Monthly Competition!')
          .replace('1º Lugar', '1st Place')
          .replace('2º Lugar', '2nd Place')
          .replace('3º Lugar', '3rd Place');
      }
      if (displayTitle.includes('Novo troféu desbloqueado') || displayTitle.includes('Marco de ofensiva')) {
        displayTitle = '🏆 Trophy Unlocked!';
      }
      toast.success(`${displayTitle}: ${displayBody}`, 7000);
      return;
    }

    // Alertas de Ofensiva / Streak
    if (
      cat === 'streaks' ||
      cat === 'streak' ||
      cat === 'streak_reminder' ||
      cat === 'streak_broken' ||
      cat === 'streak_milestone' ||
      displayTitle.toLowerCase().includes('streak') ||
      displayTitle.toLowerCase().includes('ofensiva')
    ) {
      const icon = cat === 'streak_broken' ? '💔' : '🔥';
      toast.success(`${icon} ${displayTitle}: ${displayBody}`, 8000);
      return;
    }

    // Novas Atividades Didáticas
    if (cat === 'new_activity' || cat === 'activity' || cat === 'correction' || cat === 'ai_generation') {
      toast.info(`📚 ${displayTitle}: ${displayBody}`, 7000);
      return;
    }

    // Nudge / Lembretes de retenção
    if (cat === 'nudge' || cat === 'retention' || cat === 'inactivity_nudge') {
      toast.info(`🍎 ${displayTitle}: ${displayBody}`, 7000);
      return;
    }

    // Geral
    toast.info(`🔔 ${displayTitle}: ${displayBody}`, 5000);
  }

  async function fetchNotifications() {
    if (!authStore.isAuthenticated) return;
    try {
      isLoading.value = true;
      const res = await apiGet<AppNotification[]>('/notifications').catch(() => []);
      const rawList = Array.isArray(res) ? res : [];
      const uniqueMap = new Map<string, AppNotification>();
      rawList.forEach((n) => {
        if (n && n.id) uniqueMap.set(String(n.id), n);
      });
      const list = Array.from(uniqueMap.values());

      // Notifica o aluno visualmente com toast se for uma notificação nova não lida
      list.forEach((n) => {
        const idStr = String(n.id);
        if (!n.is_read && !seenNotifIds.has(idStr)) {
          seenNotifIds.add(idStr);
          alertNotification(n);
        }
      });
      saveStoredSeenIds(seenNotifIds);
      initialLoadDone = true;

      notifications.value = list;
    } catch (err) {
      console.debug('[Notifications] Error fetching notifications:', err);
    } finally {
      isLoading.value = false;
    }
  }

  async function markRead(id: string) {
    // Optimistic update
    const item = notifications.value.find((n) => String(n.id) === String(id));
    if (item && !item.is_read) {
      item.is_read = true;
    }
    try {
      await apiPost(`/notifications/${id}/read`, {});
    } catch (err) {
      console.debug('[Notifications] Error marking notification as read:', err);
    }
  }

  async function markAllRead() {
    // Optimistic update
    notifications.value.forEach((n) => {
      n.is_read = true;
    });
    try {
      await apiPost('/notifications/read-all', {});
    } catch (err) {
      console.debug('[Notifications] Error marking all notifications as read:', err);
    }
  }

  return {
    notifications,
    unreadCount,
    isLoading,
    fetchNotifications,
    markRead,
    markAllRead,
  };
});
