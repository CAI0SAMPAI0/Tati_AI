'use client';

import Link from 'next/link';
import { Menu, Trophy, Flame, CircleAlert } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

import { Button } from '@/components/ui/button';
import { useStreakAndTrophies } from '@/hooks/useStreakAndTrophies';
import { NotificationsDropdown } from './notifications-dropdown';

import { DEFAULT_AVATAR_URL } from '@/lib/constants/user';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface MainHeaderProps {
  onToggleMenu?: () => void;
}

export function MainHeader({ onToggleMenu }: MainHeaderProps) {
  const { user } = useAuth();
  const avatarUrl = user?.avatar_url || (user as any)?.profile?.avatar_url || DEFAULT_AVATAR_URL;

  const { currentStreak, isStreakActive, trophiesEarned, totalTrophies } = useStreakAndTrophies();

  const isHubOnly = (user as any)?.is_hub_only;

  return (
    <header className="h-16 flex items-center justify-between px-1 border-b border-border bg-bg sticky top-0 z-50">
      <div className="flex items-center gap-3">
        {onToggleMenu && (
          <button
            onClick={onToggleMenu}
            className="p-2 rounded-md hover:bg-surface-hover text-text-muted"
          >
            <Menu size={20} />
          </button>
        )}
        <Link href={isHubOnly ? "/activities/hub" : "/chat"} prefetch={true} className="font-display text-lg font-bold tracking-tight pl-2">
          Teacher <span className="text-primary">Taty</span>
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
                <Link
                  href="/achievements"
                  prefetch={true}
                  className="flex items-center gap-1.5 font-bold text-sm hover:opacity-80 transition-opacity"
                  title={`Streak: ${currentStreak} days (${isStreakActive ? 'Active' : 'Inactive'})`}
                >
                  <div className={cn(
                    "w-6 h-6 flex items-center justify-center transition-transform hover:scale-110",
                    !isStreakActive && "opacity-40 grayscale"
                  )}>
                    <Image
                      src={isStreakActive ? "/images/streak-active.svg" : "/images/streak-inactive.svg"}
                      alt="Streak"
                      width={18}
                      height={22}
                      className="object-contain"
                    />
                  </div>
                  <span className={cn(
                    "min-w-[1ch] inline-block",
                    isStreakActive ? "text-orange-500 font-bold" : "text-text-muted font-medium"
                  )}>
                    {currentStreak}
                  </span>
                </Link>

                <Link
                  href="/achievements"
                  prefetch={true}
                  className="flex items-center gap-1.5 text-yellow-500 font-bold text-sm hover:opacity-80 transition-opacity"
                  title="Achievements"
                >
                  <Trophy size={18} fill="currentColor" />
                  <span className="text-text-muted font-medium min-w-[4ch] inline-block">
                    {trophiesEarned}/{totalTrophies}
                  </span>
                </Link>
              </>
            )}

          <NotificationsDropdown />

          <Link
            href="/profile"
            prefetch={true}
            className="flex items-center gap-2 pl-2 border-l border-border hover:opacity-80 transition-opacity"
          >
            <span className="hidden md:block text-xs font-semibold text-text truncate max-w-[100px]">
              {user?.name || user?.username}
            </span>
            <div className="w-8 h-8 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[0.7rem] font-bold text-primary overflow-hidden">
              <img
                src={avatarUrl}
                alt="Avatar"
                className="w-full h-full object-cover"
                onError={(e) => {
                  e.currentTarget.src = DEFAULT_AVATAR_URL;
                }}
              />
            </div>
          </Link>
        </div>
      </div>
    </header>
  );
}
