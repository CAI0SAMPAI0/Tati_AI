'use client';

import { useState, useEffect, useRef } from 'react';
import { Bell, BellOff, Check, CheckCheck } from 'lucide-react';
import { apiGet, apiPost } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { cn } from '@/lib/utils';


interface Notification {
  id: string;
  category: string;
  title: string;
  body: string;
  created_at: string;
  is_read: boolean;
}

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

export function NotificationsDropdown() {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unread, setUnread] = useState(0);
  const [loading, setLoading] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);

  const fetchNotifications = async () => {
    try {
      // Backend retorna lista plana []
      const data = await apiGet<Notification[]>(ENDPOINTS.NOTIFICATIONS);
      const list = Array.isArray(data) ? data : [];
      setNotifications(list);
      setUnread(list.filter((n) => !n.is_read).length);
    } catch (e) {
      console.error('[Notifications] Fetch error:', e);
    }
  };

  // Load badge on mount and poll every 2 minutes
  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 2 * 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  const handleToggle = () => {
    setOpen((prev) => !prev);
    if (!open) {
      setLoading(true);
      fetchNotifications().finally(() => setLoading(false));
    }
  };

  const markRead = async (id: string) => {
    const notif = notifications.find((n) => n.id === id);
    if (!notif || notif.is_read) return;
    try {
      await apiPost(ENDPOINTS.NOTIFICATION_READ(id), {});
      setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
      setUnread((prev) => Math.max(0, prev - 1));
    } catch (e) {
      // fail silently
    }
  };

  const markAllRead = async () => {
    try {
      // Nota: O endpoint de marcar todas pode variar, mas por agora marcamos na UI
      // No backend antigo podia não existir, se falhar ao menos atualizamos a UI
      await apiPost(ENDPOINTS.NOTIFICATIONS_READ_ALL, {}).catch(() => null);
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })));
      setUnread(0);
    } catch (e) {
      // fail silently
    }
  };

  return (
    <div ref={wrapperRef} className="relative">
      <button
        onClick={handleToggle}
        className="relative p-2 text-text-subtle hover:text-primary transition-colors rounded-lg hover:bg-surface-hover"
        aria-label="Notifications"
      >
        <Bell size={20} />
        {unread > 0 && (
          <span className="absolute top-1.5 right-1.5 w-2.5 h-2.5 bg-danger rounded-full border-2 border-surface animate-pulse" />
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-80 bg-surface border border-border rounded-2xl shadow-2xl z-[200] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface">
            <span className="text-sm font-bold text-text">
              Notifications {unread > 0 && <span className="ml-1 text-[0.65rem] bg-primary/10 text-primary px-1.5 py-0.5 rounded-full font-black">{unread}</span>}
            </span>
            {unread > 0 && (
              <button
                onClick={markAllRead}
                className="flex items-center gap-1 text-[0.65rem] font-bold text-primary hover:text-primary/80 transition-colors"
              >
                <CheckCheck size={13} />
                Mark all as read
              </button>
            )}
          </div>

          {/* List */}
          <div className="max-h-80 overflow-y-auto custom-scrollbar">
            {loading ? (
              <div className="py-8 flex justify-center">
                <div className="w-5 h-5 rounded-full border-2 border-primary/20 border-t-primary animate-spin" />
              </div>
            ) : notifications.length === 0 ? (
              <div className="py-10 flex flex-col items-center gap-2 text-text-subtle">
                <BellOff size={28} className="opacity-40" />
                <p className="text-xs font-medium">No notifications</p>
              </div>
            ) : (
              notifications.map((n) => (
                <div
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={cn(
          'flex items-start gap-3 px-4 py-3 hover:bg-bg-secondary/50 cursor-pointer transition-colors border-b border-border/50 last:border-0',
          !n.is_read && 'bg-primary/5'
                  )}
                >
                  <div className="w-8 h-8 rounded-xl bg-bg-secondary flex items-center justify-center text-base shrink-0 mt-0.5">
                    {NOTIF_ICONS[n.category] || '🔔'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className={cn('text-xs font-bold text-text truncate', !n.is_read && 'text-primary')}>
                        {n.title}
                      </p>
                      {!n.is_read && (
                        <span className="w-1.5 h-1.5 rounded-full bg-primary shrink-0" />
                      )}
                    </div>
                    <p className="text-[0.65rem] text-text-muted leading-relaxed mt-0.5 line-clamp-2">
                      {n.body}
                    </p>
                    <p className="text-[0.6rem] text-text-subtle mt-1">{timeAgo(n.created_at)}</p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}
