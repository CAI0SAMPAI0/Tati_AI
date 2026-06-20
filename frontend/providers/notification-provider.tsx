'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useRef,
  type ReactNode,
} from 'react';
import { apiGet, apiPost } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { useAuth } from '@/providers/auth-provider';
import toast from 'react-hot-toast';

export interface AppNotification {
  id: string;
  category: string;
  title: string;
  body: string;
  created_at: string;
  is_read: boolean;
}

interface NotificationState {
  notifications: AppNotification[];
  unreadCount: number;
  loading: boolean;
  markRead: (id: string) => Promise<void>;
  markAllRead: () => Promise<void>;
  refresh: () => Promise<void>;
}

const NotificationContext = createContext<NotificationState>({
  notifications: [],
  unreadCount: 0,
  loading: false,
  markRead: async () => {},
  markAllRead: async () => {},
  refresh: async () => {},
});

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { token, user } = useAuth();
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loading, setLoading] = useState(false);
  
  const lastNotifIds = useRef<Set<string>>(new Set());
  const initialLoadDone = useRef(false);

  const fetchNotifications = useCallback(async (isInitial = false) => {
    if (!token || !user) return;
    try {
      if (isInitial) setLoading(true);
      const data = await apiGet<AppNotification[]>(ENDPOINTS.NOTIFICATIONS);
      const list = Array.isArray(data) ? data : [];
      
      setNotifications(list);
      setUnreadCount(list.filter((n) => !n.is_read).length);

      if (initialLoadDone.current) {
        // Check for new notifications to show toast
        const newNotifs = list.filter(n => !n.is_read && !lastNotifIds.current.has(n.id));
        newNotifs.forEach(n => {
          // Toast AI generations or general notifications
          if (n.category === 'new_activity' || n.category === 'correction' || n.category === 'ai_generation') {
             toast.success(`${n.title}: ${n.body}`, { duration: 6000 });
          } else if (n.category !== 'reminder') {
             toast(`${n.title}: ${n.body}`, { icon: '🔔', duration: 5000 });
          }
        });
      }

      // Update seen IDs
      const currentIds = new Set(list.map(n => n.id));
      lastNotifIds.current = currentIds;
      initialLoadDone.current = true;
    } catch (e) {
      console.error('[Notifications] Fetch error:', e);
    } finally {
      if (isInitial) setLoading(false);
    }
  }, [token, user]);

  const subscribeToPush = useCallback(async () => {
    if (
      typeof window === 'undefined' ||
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)
    ) {
      console.log('[Push] Push notifications not supported on this device/browser.');
      return;
    }

    try {
      // 1. Verifica ou solicita permissão de notificação
      let permission = Notification.permission;
      if (permission === 'default') {
        permission = await Notification.requestPermission();
      }
      if (permission !== 'granted') {
        console.log('[Push] Notification permission denied.');
        toast.error("Permissão de notificação negada no navegador.");
        return;
      }

      // 2. Aguarda o service worker ficar pronto
      const registration = await navigator.serviceWorker.ready;

      // 3. Busca a chave VAPID pública do backend
      const keyData = await apiGet<{ public_key: string }>('/notifications/vapid-key');
      if (!keyData || !keyData.public_key) {
        console.error('[Push] Failed to retrieve VAPID key from backend.');
        toast.error("Erro ao buscar chave pública do servidor.");
        return;
      }

      // 4. Converte a chave VAPID para Uint8Array
      const convertVapidKey = (base64String: string) => {
        const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
        const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
        const rawData = window.atob(base64);
        const outputArray = new Uint8Array(rawData.length);
        for (let i = 0; i < rawData.length; ++i) {
          outputArray[i] = rawData.charCodeAt(i);
        }
        return outputArray;
      };

      const applicationServerKey = convertVapidKey(keyData.public_key);

      // 5. Inscreve o usuário no PushManager
      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey,
      });

      // 6. Envia a inscrição para o backend salvar
      const subJson = subscription.toJSON();
      if (subJson.endpoint && subJson.keys?.p256dh && subJson.keys?.auth) {
        await apiPost('/notifications/subscribe', {
          endpoint: subJson.endpoint,
          keys: {
            p256dh: subJson.keys.p256dh,
            auth: subJson.keys.auth,
          },
          user_agent: navigator.userAgent,
        });
        console.log('[Push] User successfully subscribed to push notifications!');
        toast.success("Notificações Push ativadas com sucesso! 🔔");
      }
    } catch (err: any) {
      console.error('[Push] Subscription failed:', err);
      toast.error(`Falha ao ativar Push: ${err?.message || err}`);
    }
  }, []);

  useEffect(() => {
    if (!token || !user) {
      setNotifications([]);
      setUnreadCount(0);
      lastNotifIds.current.clear();
      initialLoadDone.current = false;
      return;
    }

    fetchNotifications(true);
    subscribeToPush();
    // Poll every 15 seconds for quick feedback on AI generation
    const interval = setInterval(() => fetchNotifications(false), 15 * 1000);
    return () => clearInterval(interval);
  }, [token, user, fetchNotifications, subscribeToPush]);

  const markRead = async (id: string) => {
    const notif = notifications.find((n) => n.id === id);
    if (!notif || notif.is_read) return;
    try {
      await apiPost(ENDPOINTS.NOTIFICATION_READ(id), {});
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      // fail silently
    }
  };

  const markAllRead = async () => {
    try {
      await apiPost(ENDPOINTS.NOTIFICATIONS_READ_ALL, {}).catch(() => null);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (e) {
      // fail silently
    }
  };

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        loading,
        markRead,
        markAllRead,
        refresh: () => fetchNotifications(false),
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
