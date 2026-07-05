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
      
      const unreadNudges = list.filter(n => !n.is_read && n.category === 'nudge');

      if (initialLoadDone.current) {
        // Check for new notifications to show toast
        const newNotifs = list.filter(n => !n.is_read && !lastNotifIds.current.has(n.id));
        newNotifs.forEach(n => {
          let shown = false;
          // Toast AI generations or general notifications
          if (n.category === 'new_activity' || n.category === 'correction' || n.category === 'ai_generation') {
             toast.success(`${n.title}: ${n.body}`, { duration: 6000 });
             shown = true;
          } else if (n.category === 'nudge') {
             toast(`${n.title}: ${n.body}`, { icon: '🍎', duration: 8000 });
             shown = true;
          } else if (n.category !== 'reminder') {
             toast(`${n.title}: ${n.body}`, { icon: '🔔', duration: 5000 });
             shown = true;
          }
          if (shown) {
            apiPost(ENDPOINTS.NOTIFICATION_READ(n.id), {}).catch(() => null);
            n.is_read = true;
          }
        });
      } else {
        // Show unread nudges on initial load so the user sees them at the top of the screen immediately
        unreadNudges.forEach(n => {
          toast(`${n.title}: ${n.body}`, { icon: '🍎', duration: 8000 });
          apiPost(ENDPOINTS.NOTIFICATION_READ(n.id), {}).catch(() => null);
          n.is_read = true;
        });
      }

      setNotifications(list);
      setUnreadCount(list.filter((n) => !n.is_read).length);

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

  const pushAttemptedRef = useRef(false);

  const subscribeToPush = useCallback(async () => {
    if (typeof window === 'undefined' || pushAttemptedRef.current) return;
    pushAttemptedRef.current = true;

    if (process.env.NODE_ENV !== 'production') return;

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
          return;
        }

        await PushNotifications.addListener('registration', async (token: any) => {
          try {
            await apiPost('/notifications/subscribe', {
              endpoint: `fcm:${token.value}`,
              keys: { p256dh: 'fcm', auth: 'fcm' },
              user_agent: 'Capacitor Android'
            });
            // FCM token registered
          } catch (apiErr) {
            console.error('[Push] Failed to save FCM token on server:', apiErr);
          }
        });

        await PushNotifications.addListener('registrationError', (error: any) => {
          console.error('[Push] Registration error:', error);
        });

        await PushNotifications.addListener('pushNotificationReceived', (notification: any) => {
          toast.success(`${notification.title}: ${notification.body}`, { duration: 5000 });
        });

        await PushNotifications.addListener('pushNotificationActionPerformed', async (action: any) => {
          const { actionId, notification } = action;
          try {
            await apiPost('/notifications/actions', {
              action: actionId,
              notification_id: notification.id || null,
              category: notification.data?.click_action || null,
              data: notification.data || null,
            });
          } catch (apiErr) {
            console.error('[Push] Failed to report action click to backend:', apiErr);
          }
          if (actionId === 'study_now') {
            window.location.href = '/activities';
          } else if (actionId === 'postpone') {
            toast.success("Lembrete de estudos adiado por 1 hora!");
          }
        });

        await PushNotifications.register();
        return;
      }
    } catch {
      if (pushAttemptedRef.current) return;
    }

    if (
      !('serviceWorker' in navigator) ||
      !('PushManager' in window) ||
      !('Notification' in window)
    ) {
      return;
    }

    let permission = window.Notification.permission;
    if (permission === 'default') {
      permission = await window.Notification.requestPermission();
    }
    if (permission !== 'granted') return;

    try {
      const registration = await navigator.serviceWorker.ready;

      const existingSub = await registration.pushManager.getSubscription();
      if (existingSub) {
        const subJson = existingSub.toJSON();
        if (subJson.endpoint) {
          try {
            await apiPost('/notifications/subscribe', {
              endpoint: subJson.endpoint,
              keys: {
                p256dh: subJson.keys?.p256dh || '',
                auth: subJson.keys?.auth || '',
              },
              user_agent: navigator.userAgent,
            });
          } catch {
          }
        }
        return;
      }

      const keyData = await apiGet<{ public_key: string }>('/notifications/vapid-key');
      if (!keyData || !keyData.public_key) {
        console.error('[Push] Failed to retrieve VAPID key from backend.');
        return;
      }

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

      const subscription = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: convertVapidKey(keyData.public_key),
      });

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
        console.log('[Push] User subscribed to push notifications!');
      }
    } catch (err: any) {
      console.warn('[Push] Subscription failed:', err);
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
