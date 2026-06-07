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
          if (n.category === 'new_activity' || n.category === 'correction') {
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

  useEffect(() => {
    if (!token || !user) {
      setNotifications([]);
      setUnreadCount(0);
      lastNotifIds.current.clear();
      initialLoadDone.current = false;
      return;
    }

    fetchNotifications(true);
    // Poll every 15 seconds for quick feedback on AI generation
    const interval = setInterval(() => fetchNotifications(false), 15 * 1000);
    return () => clearInterval(interval);
  }, [token, user, fetchNotifications]);

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
