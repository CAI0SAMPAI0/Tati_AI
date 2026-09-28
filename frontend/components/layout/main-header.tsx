'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Menu, Trophy, Flame, CircleAlert, MessageSquareHeart, Bug } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useState } from 'react';

import { Button } from '@/components/ui/button';
import { useStreakAndTrophies } from '@/hooks/useStreakAndTrophies';
import { NotificationsDropdown } from './notifications-dropdown';
import { StudentFeedbackModal } from '@/components/feedback/student-feedback-modal';
import { DeveloperBugModal } from '@/components/feedback/developer-bug-modal';

import { DEFAULT_AVATAR_URL } from '@/lib/constants/user';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface MainHeaderProps {
  onToggleMenu?: () => void;
  hideStats?: boolean;
  hideStreakAndTrophies?: boolean;
}

export function MainHeader({ onToggleMenu, hideStats, hideStreakAndTrophies }: MainHeaderProps) {
  const pathname = usePathname();
  const isSettings = hideStats || hideStreakAndTrophies || pathname?.startsWith('/settings');
  const isActivities = pathname?.startsWith('/activities');
  const { user } = useAuth();
  const rawAvatar = user?.avatar_url || (user as any)?.profile?.avatar_url;
  const avatarUrl = (!rawAvatar || (rawAvatar.includes('/avatar/avatar_tati') && (user as any)?.role !== 'teacher'))
    ? DEFAULT_AVATAR_URL
    : rawAvatar;
  const [isFeedbackOpen, setIsFeedbackOpen] = useState(false);
  const [isBugOpen, setIsBugOpen] = useState(false);

  const { currentStreak, isStreakActive, trophiesEarned, totalTrophies } = useStreakAndTrophies();

  const isHubOnly = (user as any)?.is_hub_only;
  const shouldHideStreakAndTrophies = isHubOnly || isSettings;

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
        <Link
          href={isHubOnly ? "/activities/hub" : "/chat"}
          prefetch={true}
          className={cn(
            "flex items-center gap-2 font-display font-bold tracking-tight pl-2 hover:opacity-90 transition-opacity",
            isActivities ? "text-sm sm:text-base" : "text-base md:text-lg"
          )}
        >
          <span>Teacher <span className="text-primary">Taty</span></span>
        </Link>
      </div>

      <div className="flex items-center gap-2 md:gap-4">

        <div className="flex items-center gap-3 md:gap-5">
          {!shouldHideStreakAndTrophies && (
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

          <button
            type="button"
            onClick={() => setIsFeedbackOpen(true)}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold text-primary hover:bg-primary/10 transition-colors"
            title="Enviar Feedback para Teacher Tatiana"
          >
            <MessageSquareHeart size={17} />
            <span className="hidden xl:inline">Feedback Taty</span>
          </button>

          <button
            type="button"
            onClick={() => setIsBugOpen(true)}
            className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold text-red-400 hover:bg-red-500/10 transition-colors"
            title="Reportar problema ao programador"
          >
            <Bug size={16} />
            <span className="hidden xl:inline">Bug Report</span>
          </button>

          <NotificationsDropdown />

          <Link
            href="/profile"
            prefetch={true}
            className="hidden md:flex items-center gap-2 pl-2 border-l border-border hover:opacity-80 transition-opacity"
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

      <StudentFeedbackModal
        isOpen={isFeedbackOpen}
        onClose={() => setIsFeedbackOpen(false)}
        cefrLevel={(user as any)?.level || 'A1'}
      />

      <DeveloperBugModal
        isOpen={isBugOpen}
        onClose={() => setIsBugOpen(false)}
      />
    </header>
  );
}
