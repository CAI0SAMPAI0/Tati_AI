'use client';

import Image from 'next/image';
import Link from 'next/link';
import { Menu, Trophy, Flame, CircleAlert } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

import { Button } from '@/components/ui/button';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { NotificationsDropdown } from './notifications-dropdown';

interface MainHeaderProps {
  onToggleMenu?: () => void;
}

interface StreakData {
  current_streak: number;
  trophies_earned: number;
  total_questions?: number;
  hours_saved?: number;
}

export function MainHeader({ onToggleMenu }: MainHeaderProps) {
  const { user } = useAuth();
  const avatarUrl = user?.avatar_url || (user as any)?.profile?.avatar_url || null;

  // Use TanStack Query to fetch streak and trophy data
  const { data: streakData } = useQuery<StreakData>({
    queryKey: ['streak-data'],
    queryFn: () => apiGet<StreakData>(ENDPOINTS.STREAK),
    refetchInterval: 60000,
  });

  const isHubOnly = (user as any)?.is_hub_only;

  return (
    <header className="h-16 flex items-center justify-between px-1 border-b border-border bg-bg sticky top-0 z-50">
      <div className="flex items-center gap-3">
        {onToggleMenu && (
          <button
            onClick={onToggleMenu}
            className="p-2 rounded-md hover:bg-surface-hover text-text-muted md:hidden"
          >
            <Menu size={20} />
          </button>
        )}
        <Link href={isHubOnly ? "/activities/hub" : "/chat"} className="font-display text-lg font-bold tracking-tight pl-2">
          Teacher <span className="text-primary">Tati</span>
        </Link>
      </div>

      <div className="flex items-center gap-2 md:gap-4">
        <div className="hidden sm:flex items-center gap-2">
          <Button variant="ghost" size="sm" className="gap-1.5 h-8 px-2.5">
            <span className="text-[0.65rem] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">
              Beta
            </span>
          </Button>
          {!isHubOnly && (
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-text-subtle" aria-label="Informações">
              <CircleAlert size={18} />
            </Button>
          )}
        </div>

        <div className="flex items-center gap-3 md:gap-5">
          {!isHubOnly && (
            <>
              <div className="flex items-center gap-1.5 text-orange-500 font-bold text-sm" title="Streak">
                <Flame size={18} fill="currentColor" />
                <span className="min-w-[1ch] inline-block">
                  {streakData?.current_streak ?? user?.streak ?? 0}
                </span>

              </div>

              <div className="flex items-center gap-1.5 text-yellow-500 font-bold text-sm" title="Achievements">
                <Trophy size={18} fill="currentColor" />
                <span className="text-text-muted font-medium min-w-[4ch] inline-block">
                  {streakData?.trophies_earned ?? 0}/50
                </span>
              </div>
            </>
          )}

          <NotificationsDropdown />

          <Link
            href="/profile"
            className="flex items-center gap-2 pl-2 border-l border-border hover:opacity-80 transition-opacity"
          >
            <span className="hidden md:block text-xs font-semibold text-text truncate max-w-[100px]">
              {user?.name || user?.username}
            </span>
            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[0.7rem] font-bold text-primary overflow-hidden">
              {avatarUrl ? (
                <Image src={avatarUrl} alt="Avatar" width={32} height={32} className="w-full h-full object-cover" />
              ) : (
                (user?.name || user?.username || '?').charAt(0).toUpperCase()
              )}
            </div>
          </Link>
        </div>
      </div>
    </header>
  );
}
