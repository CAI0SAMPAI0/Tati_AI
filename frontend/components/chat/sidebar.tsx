'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  Plus,
  LayoutDashboard,
  Settings,
  BookOpen,
  Trash2,
  LogOut,
  X,
  ChevronRight,
  Target,
} from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { usePrefetch } from '@/hooks/usePrefetch';

import { cn, isStaff, canAccessDashboard } from '@/lib/utils';
import { levelLabel } from '@/lib/constants/levels';
import { ConversationList } from './conversation-list';

import { apiGet, apiDelete } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { AccessControl } from '@/lib/api/types';

interface SidebarProps {
  currentConvId: string | null;
  onSelectConv: (id: string, title: string) => void;
  onNewChat: () => void;
  onStartLeveling?: () => void;
  isOpen: boolean;
  onClose: () => void;
}

import { DEFAULT_AVATAR_URL } from '@/lib/constants/user';

export function Sidebar({
  currentConvId,
  onSelectConv,
  onNewChat,
  onStartLeveling,
  isOpen,
  onClose,
}: SidebarProps) {
  const { user, logout } = useAuth();
  const avatarUrl = user?.avatar_url || (user as any)?.profile?.avatar_url || DEFAULT_AVATAR_URL;
  
  const router = useRouter();
  const queryClient = useQueryClient();
  const { prefetch } = usePrefetch();

  // SRS Check
  const { data: dueVocab = [] } = useQuery<any[]>({
    queryKey: ['due-vocab'],
    queryFn: () => apiGet<any[]>('/users/vocabulary/due'),
    refetchInterval: 60000,
  });

  const { data: access } = useQuery({
    queryKey: ['access-control'],
    queryFn: () => apiGet<AccessControl>(ENDPOINTS.ACCESS_CONTROL),
    staleTime: 60_000,
  });
  const { data: subStatus } = useQuery({
    queryKey: ['payments-status'],
    queryFn: () => apiGet<{ status?: string }>(ENDPOINTS.PAYMENTS_STATUS),
    staleTime: 60_000,
  });

  const showDashboard = canAccessDashboard(user, access);
  const showActivities = isStaff(user) || access?.can_access_activities || access?.free_mode;

  const isPremium = subStatus?.status === 'active' || isStaff(user);

  const handleDeleteAll = async () => {
    if (!confirm('⚠️ Delete ALL conversations?')) return;
    try {
      const convs = await apiGet<any[]>(ENDPOINTS.CONVERSATIONS);
      await Promise.all(convs.map((c) => apiDelete(`${ENDPOINTS.CONVERSATIONS}/${c.id}`)));
      await queryClient.invalidateQueries({ queryKey: ['conversations'] });
      onNewChat();
    } catch (err) {
      console.error('Error deleting all conversations:', err);
    }
  };

  return (
    <>
      {/* Overlay for mobile */}
      <div
        className={cn(
          'fixed inset-0 bg-black/60 backdrop-blur-[2px] z-[60] transition-opacity md:hidden',
          isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'
        )}
        onClick={onClose}
      />

      <aside
        className={cn(
          'fixed inset-y-0 left-0 w-[280px] bg-bg-secondary border-r border-border z-[70] flex flex-col transition-transform duration-300',
          isOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between p-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-7 h-7 rounded-lg overflow-hidden bg-primary/20 flex items-center justify-center text-primary">
              <Image src="/images/tati_logo.jpg" alt="Tati" width={28} height={28} className="w-full h-full object-cover"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = 'none';
                  (e.target as HTMLImageElement).nextElementSibling?.classList.remove('hidden');
                }}
              />
              <span className="hidden text-xs font-bold">T</span>
            </div>
            <span className="font-display text-[0.9rem] font-bold tracking-tight">
              Teacher Tati
            </span>
          </div>
          <button
            aria-label="Fechar menu"
            onClick={onClose}
            className="p-1.5 rounded-md hover:bg-surface-hover text-text-muted md:hidden"
          >
            <X size={18} />
          </button>
        </div>

        {/* User Card */}
        <Link
          href="/profile"
          className="mx-3 mb-3 p-2.5 bg-surface border border-border rounded-lg flex items-center gap-3 hover:bg-primary/10 hover:border-primary/30 transition-all group"
        >
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-primary to-[hsl(270,60%,32%)] flex items-center justify-center text-[0.7rem] font-bold text-white shrink-0 overflow-hidden">
            <img
              src={avatarUrl}
              alt="Avatar"
              className="w-full h-full object-cover"
              onError={(e) => {
                e.currentTarget.src = DEFAULT_AVATAR_URL;
              }}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[0.82rem] font-semibold truncate leading-none mb-1">
              {user?.name || user?.username}
            </div>
            <div className="flex items-center gap-1.5">
              <span className="text-[0.68rem] text-text-muted truncate">
                {user?.level ? levelLabel(user.level) : 'Student'}
              </span>
              {isPremium && (
                <span className="px-1.5 py-0.5 rounded-full bg-primary/15 text-primary text-[0.6rem] font-bold border border-primary/30">
                  Premium
                </span>
              )}
            </div>
          </div>
          <ChevronRight size={12} className="text-text-subtle group-hover:text-primary transition-colors" />    
        </Link>

        {/* New Chat Button */}
        <button
          onClick={onNewChat}
          className="mx-3 mb-1.5 flex items-center gap-2.5 px-3.5 py-2.5 bg-primary/15 border border-primary/30 rounded-lg text-primary text-[0.85rem] font-bold hover:bg-primary/25 hover:border-primary transition-all active:translate-y-[1px]"
        >
          <Plus size={16} strokeWidth={2.5} />
          <span>{'New conversation'}</span>
        </button>

        {/* Leveling Test Button */}
        {onStartLeveling && (
          <button
            onClick={onStartLeveling}
            className="mx-3 mb-2 flex items-center gap-2.5 px-3.5 py-2 bg-gradient-to-r from-purple-500/10 via-primary/15 to-purple-500/10 border border-primary/40 rounded-lg text-primary text-[0.82rem] font-bold hover:bg-primary/25 hover:border-primary transition-all active:translate-y-[1px] shadow-sm"
            title="Start your CEFR English Leveling Challenge"
          >
            <Target size={15} className="text-primary shrink-0" strokeWidth={2.2} />
            <span className="truncate">🎯 Leveling Assessment</span>
          </button>
        )}

        <div className="h-px bg-border mx-3 my-2 shrink-0" />

        {/* Scrollable middle section */}
        <div className="flex-1 overflow-y-auto custom-scrollbar flex flex-col min-h-0">
          <div className="flex-1">
            <ConversationList currentId={currentConvId} onSelect={onSelectConv} />
          </div>
        </div>

        {/* Footer */}
        <div className="mt-auto border-t border-border p-3 flex items-center gap-1.5">
          {showDashboard && (
            <Link
              href="/dashboard"
              prefetch={true}
              onMouseEnter={() => prefetch('dashboard')}
              className="p-2 rounded-lg border border-border text-text-muted hover:bg-primary/10 hover:text-primary hover:border-primary/50 transition-all"
              title="Dashboard"
            >
              <LayoutDashboard size={18} />
            </Link>
          )}
          <Link
            href="/settings"
            onMouseEnter={() => prefetch('settings')}
            className="p-2 rounded-lg border border-border text-text-muted hover:bg-primary/10 hover:text-primary hover:border-primary/50 transition-all"
            title="Settings"
          >
            <Settings size={18} />
          </Link>
          {showActivities && (
            <Link
              href="/activities"
              prefetch={true}
              onMouseEnter={() => prefetch('activities')}
              className="p-2 rounded-lg border border-border text-text-muted hover:bg-primary/10 hover:text-primary hover:border-primary/50 transition-all"
              title="My Activities"
            >
              <BookOpen size={18} />
            </Link>
          )}
          <div className="flex-1" />
          <button
            aria-label='Apagar todas as conversas'
            onClick={handleDeleteAll}
            className="p-2 rounded-lg border border-border text-text-muted hover:bg-danger/10 hover:text-danger hover:border-danger/50 transition-all"
            title="Delete all"
          >
            <Trash2 size={18} />
          </button>
          <button
            aria-label='Sair da conta'
            onClick={logout}
            className="p-2 rounded-lg border border-border text-text-muted hover:bg-danger/10 hover:text-danger hover:border-danger/50 transition-all"
            title="Sign out"
          >
            <LogOut size={18} />
          </button>
        </div>
      </aside>
    </>
  );
}
