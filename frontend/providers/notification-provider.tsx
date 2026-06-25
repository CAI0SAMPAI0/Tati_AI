'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  useMemo,
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
    if (typeof window === 'undefined') return;

    try {
      const { Capacitor } = await import('@capacitor/core');
      const isNative = Capacitor.isNativePlatform();

      if (isNative) {
        const PushNotifications = (window as any).Capacitor.Plugins.PushNotifications;
        
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === 'prompt') {
          permStatus = await PushNotifications.requestPermissions();
        }
        if (permStatus.receive !== 'granted') {
          console.log('[Push] Capacitor native permission denied.');
          toast.error("Permissão de notificação negada no aparelho.");
          return;
        }

        await PushNotifications.addListener('registration', async (token: any) => {
          console.log('[Push] Capacitor FCM token:', token.value);
          try {
            await apiPost('/notifications/subscribe', {
              endpoint: `fcm:${token.value}`,
              keys: {
                p256dh: 'fcm',
                auth: 'fcm'
              },
              user_agent: 'Capacitor Android'
            });
            console.log('[Push] FCM token registered successfully!');
            toast.success("Notificações Push nativas ativadas! 🔔");
          } catch (apiErr) {
            console.error('[Push] Failed to save FCM token on server:', apiErr);
          }
        });

        await PushNotifications.addListener('registrationError', (error: any) => {
          console.error('[Push] Registration error:', error);
          toast.error("Falha ao registrar token de push nativo.");
        });

        await PushNotifications.addListener('pushNotificationReceived', (notification: any) => {
          console.log('[Push] Foreground native push:', notification);
          toast.success(`${notification.title}: ${notification.body}`, { duration: 5000 });
        });

        await PushNotifications.addListener('pushNotificationActionPerformed', async (action: any) => {
          console.log('[Push] Action performed:', action);
          const { actionId, notification } = action;
          
          try {
            await apiPost('/notifications/actions', {
              action: actionId,
              notification_id: notification.id || null,
              category: notification.data?.click_action || null,
              data: notification.data || null,
            });
            console.log(`[Push] Action '${actionId}' successfully processed on backend.`);
          } catch (apiErr) {
            console.error('[Push] Failed to report action click to backend:', apiErr);
          }

          if (actionId === 'study_now') {
            window.location.href = '/activities';
          } else if (actionId === 'postpone') {
            toast.success("Lembrete de estudos adiado por 1 hora!");
          }
        });

        await PushNotifications.createChannel({
          id: 'fcm_default_channel',
          name: 'Notificações',
          importance: 4,
          visibility: 1,
        });

        await PushNotifications.register();

        return;
      }
    } catch (capacitorErr) {
      console.error('[Push] Capacitor init failed, falling back to Web Push:', capacitorErr);
    }

    if (
      !('serviceWorker' in navigator) ||
      !('PushManager' in window)
    ) {
      console.log('[Push] Push notifications not supported on this device/browser.');
      return;
    }

    try {
      if (typeof window === 'undefined' || !('Notification' in window)) {
        console.log('[Push] Notification API not supported on this browser.');
        return;
      }

      // 1. Verifica ou solicita permissão de notificação
      let permission = window.Notification.permission;
      if (permission === 'default') {
        permission = await window.Notification.requestPermission();
      }
      if (permission !== 'granted') {
        console.log('[Push] Notification permission denied or not granted.');
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
      }
    } catch (err: any) {
      console.warn('[Push] Subscription failed (possibly blocked by browser/private mode/VPN):', err);
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

    // Atrasa o fetch inicial 3s para não competir com o render crítico da página
    const initialTimer = setTimeout(() => {
      fetchNotifications(true);
      subscribeToPush();
    }, 3000);

    // Poll a cada 15s, mas pausa quando a aba está em background
    let interval: ReturnType<typeof setInterval> | null = null;

    const startPolling = () => {
      if (interval) return;
      interval = setInterval(() => {
        if (document.visibilityState === 'visible') {
          fetchNotifications(false);
        }
      }, 30 * 1000);
    };

    const stopPolling = () => {
      if (interval) {
        clearInterval(interval);
        interval = null;
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        // Recarrega imediatamente ao voltar para a aba
        fetchNotifications(false);
        startPolling();
      } else {
        stopPolling();
      }
    };

    document.addEventListener('visibilitychange', handleVisibility);
    startPolling();

    return () => {
      clearTimeout(initialTimer);
      stopPolling();
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [token, user, fetchNotifications, subscribeToPush]);


  const markRead = useCallback(async (id: string) => {
    const notif = notifications.find((n) => n.id === id);
    if (!notif || notif.is_read) return;
    try {
      await apiPost(ENDPOINTS.NOTIFICATION_READ(id), {});
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (e) {
      // fail silently
    }
  }, [notifications]);

  const markAllRead = useCallback(async () => {
    try {
      await apiPost(ENDPOINTS.NOTIFICATIONS_READ_ALL, {}).catch(() => null);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnreadCount(0);
    } catch (e) {
      // fail silently
    }
  }, []);

  const refresh = useCallback(async () => {
    await fetchNotifications(false);
  }, [fetchNotifications]);

  const value = useMemo(
    () => ({ notifications, unreadCount, loading, markRead, markAllRead, refresh }),
    [notifications, unreadCount, loading, markRead, markAllRead, refresh]
  );

  return (
    <NotificationContext.Provider value={value}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
