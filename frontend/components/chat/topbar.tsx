'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { Menu, FileText, Mic, BookMarked, Check, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { NotificationsDropdown } from '@/components/layout/notifications-dropdown';
import { ACCENTS, getStoredAccent, saveStoredAccent } from '@/lib/constants/accents';
import { useAuth } from '@/hooks/useAuth';
import { apiPut, apiGet } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { useQuery } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import { cn } from '@/lib/utils';

interface ChatTopbarProps {
  title: string;
  onToggleSidebar: () => void;
  onShowSummary: () => void;
  onSwitchToVoice: () => void;
  showSummaryBtn: boolean;
}

interface StreakData {
  current_streak: number;
  trophies_earned: number;
  total_trophies?: number;
}

const showActivities = true;

export function ChatTopbar({
  title,
  onToggleSidebar,
  onShowSummary,
  onSwitchToVoice,
  showSummaryBtn,
}: ChatTopbarProps) {
  const { user, updateProfile } = useAuth();
  const [currentAccent, setCurrentAccent] = useState<string>('en-US');
  const [isAccentMenuOpen, setIsAccentMenuOpen] = useState(false);
  const accentMenuRef = useRef<HTMLDivElement>(null);

  const { data: streakData } = useQuery<StreakData>({
    queryKey: ['streak-data'],
    queryFn: () => apiGet<StreakData>(ENDPOINTS.STREAK),
    refetchInterval: 60000,
  });

  const currentStreak = streakData?.current_streak ?? user?.streak ?? 0;
  const isStreakActive = currentStreak > 0;
  const trophiesEarned = streakData?.trophies_earned ?? 0;
  const totalTrophies = streakData?.total_trophies ?? 50;


  useEffect(() => {
    const userAccent = user?.preferred_accent || (user?.profile as any)?.preferred_accent || (user?.profile as any)?.accent;
    const stored = getStoredAccent();
    if (stored && stored !== 'en-US') {
      setCurrentAccent(stored);
    } else if (userAccent) {
      setCurrentAccent(userAccent);
      saveStoredAccent(userAccent);
    } else {
      setCurrentAccent(stored || 'en-US');
    }
  }, [user]);

  useEffect(() => {
    const handleAccentChange = (e: Event) => {
      const detail = (e as CustomEvent).detail;
      if (detail) {
        setCurrentAccent(detail);
      } else {
        setCurrentAccent(getStoredAccent());
      }
    };
    window.addEventListener('tati_accent_changed', handleAccentChange);
    window.addEventListener('storage', handleAccentChange);
    return () => {
      window.removeEventListener('tati_accent_changed', handleAccentChange);
      window.removeEventListener('storage', handleAccentChange);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (accentMenuRef.current && !accentMenuRef.current.contains(e.target as Node)) {
        setIsAccentMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelectAccent = async (accentId: string) => {
    setCurrentAccent(accentId);
    saveStoredAccent(accentId);
    setIsAccentMenuOpen(false);

    const accentObj = ACCENTS.find(a => a.id === accentId);
    toast.success(`Voice accent changed to ${accentObj?.label || accentId}`, { id: 'chat-accent-sync' });

    try {
      await apiPut('/profile', { preferred_accent: accentId, accent: accentId });
      if (user) {
        updateProfile({
          ...user,
          preferred_accent: accentId,
          profile: {
            ...user.profile,
            preferred_accent: accentId,
            accent: accentId,
          },
        });
      }
    } catch (e) {
      console.error('Failed to sync accent to profile from chat:', e);
    }
  };

  const currentAccentObj = ACCENTS.find(a => a.id === currentAccent) || ACCENTS[0];

  return (
    <header className="h-14 flex items-center justify-between px-4 border-b border-border bg-bg shrink-0">
      <div className="flex items-center gap-3 overflow-hidden">
        <button
          aria-label="Abrir menu"
          onClick={onToggleSidebar}
          className="p-1.5 rounded-md hover:bg-surface-hover text-text-muted cursor-pointer"
        >
          <Menu size={20} />
        </button>

        <h1 className="text-[0.875rem] font-bold text-text truncate">
          {title || "Taty's Hub"}
        </h1>
      </div>

      <div className="flex items-center gap-1.5 sm:gap-2">
        {/* Streak Flame */}
        <Link
          href="/achievements"
          prefetch={true}
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-surface border border-border hover:border-primary/40 text-xs font-bold transition-all active:scale-95 shadow-xs"
          title={`Streak: ${currentStreak} days (${isStreakActive ? 'Active' : 'Inactive'})`}
        >
          <div className={cn(
            "w-4 h-4 sm:w-5 sm:h-5 flex items-center justify-center transition-transform hover:scale-110",
            !isStreakActive && "opacity-40 grayscale"
          )}>
            <Image
              src={isStreakActive ? "/images/streak-active.svg" : "/images/streak-inactive.svg"}
              alt="Streak"
              width={16}
              height={20}
              className="object-contain"
            />
          </div>
          <span className={cn(
            "min-w-[1ch] inline-block text-[11px] sm:text-xs",
            isStreakActive ? "text-orange-500 font-bold" : "text-text-muted font-medium"
          )}>
            {currentStreak}
          </span>
        </Link>

        {/* Trophies */}
        <Link
          href="/achievements"
          prefetch={true}
          className="hidden md:flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-surface border border-border hover:border-primary/40 text-xs font-bold transition-all active:scale-95 shadow-xs text-yellow-500"
          title="Achievements"
        >
          <Trophy size={15} fill="currentColor" />
          <span className="text-text-muted font-medium text-[11px] sm:text-xs min-w-[3ch] inline-block">
            {trophiesEarned}/{totalTrophies}
          </span>
        </Link>


        {/* Accent Selector */}
        <div className="relative" ref={accentMenuRef}>
          <button
            type="button"
            onClick={() => setIsAccentMenuOpen(!isAccentMenuOpen)}
            title={`Teacher Tati Accent: ${currentAccentObj.label}`}
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-surface border border-border hover:border-primary/40 text-xs font-bold text-text transition-all active:scale-95 cursor-pointer shadow-xs"
          >
            <span className="text-sm">{currentAccentObj.flag}</span>
            <span className="hidden sm:inline text-[11px] font-bold text-text-muted">{currentAccentObj.shortLabel}</span>
          </button>

          {isAccentMenuOpen && (
            <div className="absolute right-0 top-full mt-2 w-52 bg-surface border border-border rounded-2xl shadow-xl p-1.5 z-50 animate-in fade-in zoom-in-95 duration-150">
              <div className="px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-wider text-text-muted border-b border-border mb-1">
                Teacher Tati Accent
              </div>
              <div className="max-h-60 overflow-y-auto space-y-0.5 scrollbar-thin">
                {ACCENTS.map((acc) => {
                  const isSelected = acc.id === currentAccent;
                  return (
                    <button
                      key={acc.id}
                      type="button"
                      onClick={() => handleSelectAccent(acc.id)}
                      className={cn(
                        "w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-medium transition-all text-left cursor-pointer",
                        isSelected
                          ? "bg-primary/10 text-primary font-bold"
                          : "hover:bg-bg text-text"
                      )}
                    >
                      <div className="flex items-center gap-2 truncate">
                        <span>{acc.flag}</span>
                        <span className="truncate">{acc.label.replace(/^.*?\s/, '')}</span>
                      </div>
                      {isSelected && <Check size={14} className="text-primary shrink-0" />}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>

        <NotificationsDropdown />

        {showActivities && (
          <Button
            variant="secondary"
            size="sm"
            title="My Activities"
            onClick={() => {
              window.location.href = '/activities';
            }}
            className="flex gap-1.5 px-3 py-1.5 h-auto text-xs font-bold"
          >
            <BookMarked size={14} className="text-primary" />
            <span className="hidden sm:inline">My Activities</span>
          </Button>
        )}

        {showSummaryBtn && (
          <Button
            variant="secondary"
            size="sm"
            onClick={onShowSummary}
            className="flex gap-1.5 px-3 py-1.5 h-auto text-xs font-bold"
            title="Summary"
          >
            <FileText size={14} className="text-primary" />
            <span className="hidden sm:inline">Summary</span>
          </Button>
        )}

        <Button
          variant="secondary"
          size="sm"
          onClick={onSwitchToVoice}
          className="flex gap-1.5 px-3 py-1.5 h-auto text-xs font-bold"
          title="Voice Mode"
        >
          <Mic size={14} className="text-primary" />
          <span className="hidden sm:inline">Voice Mode</span>
        </Button>
      </div>
    </header>
  );
}