'use client';

import { SidebarActivities } from '@/components/activities/sidebar-activities';
import { MainHeader } from '@/components/layout/main-header';
import { useSidebarState } from '@/hooks/useSidebarState';
import { apiGet } from '@/lib/api/client';
import { DEFAULT_AVATAR_URL } from '@/lib/constants/user';
import { useQuery } from '@tanstack/react-query';
import {
  BookOpen,
  Flame,
  MessageSquare,
  Mic,
  Sparkles,
  Zap,
  ArrowUp,
  Goal
} from 'lucide-react';
import { useState, useEffect } from 'react';

import { useAuth } from '@/hooks/useAuth';
import { CEFRLevel, CEFR_LABEL_MAP, CEFR_LEVELS } from '@/lib/constants/levels';
import { cn } from '@/lib/utils';
import { useSearchParams } from 'next/navigation';

interface RankingEntry {
  username: string;
  name?: string;
  score: number;
  level?: string;
  avatar_url?: string;
}

const MONTH_NAMES_EN: Record<number, string> = {
  1: 'January',
  2: 'February',
  3: 'March',
  4: 'April',
  5: 'May',
  6: 'June',
  7: 'July',
  8: 'August',
  9: 'September',
  10: 'October',
  11: 'November',
  12: 'December',
};

function getStudentAvatar(url?: string | null): string {
  if (!url || url.includes('/avatar/avatar_tati')) {
    return DEFAULT_AVATAR_URL;
  }
  return url;
}

export default function CompetitionsClientPage() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const { sidebarOpen, toggleSidebar: handleToggleSidebar, closeSidebar: handleCloseSidebar } = useSidebarState();
  const [rankingMode, setRankingMode] = useState<'global' | 'level'>('global');
  const [selectedLevelCat, setSelectedLevelLevelCat] = useState<CEFRLevel>('A1');

  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth() + 1; // 1-12

  // Previous month calculation
  const prevDate = new Date(currentYear, currentMonth - 2, 1);
  const prevYear = prevDate.getFullYear();
  const prevMonth = prevDate.getMonth() + 1;

  const cycleParam = searchParams.get('cycle');
  const monthParam = searchParams.get('month');

  const initialIsPrevious =
    cycleParam === 'previous' ||
    cycleParam === 'prev' ||
    (monthParam !== null && Number(monthParam) === prevMonth);

  const [selectedCycle, setSelectedCycle] = useState<'current' | 'previous'>(
    initialIsPrevious ? 'previous' : 'current'
  );

  const queryParams =
    selectedCycle === 'previous'
      ? `?year=${prevYear}&month=${prevMonth}`
      : '';

  const { data: globalRanking = [], isLoading: globalLoading } = useQuery<RankingEntry[]>({
    queryKey: ['competitions-global-ranking', selectedCycle, prevYear, prevMonth],
    queryFn: () => apiGet<RankingEntry[]>(`/users/progress/ranking/top15${queryParams}`),
    refetchInterval: selectedCycle === 'current' ? 60000 : false,
    placeholderData: (previousData) => previousData,
  });
  const { data: levelRankings, isLoading: levelLoading } = useQuery<Record<string, RankingEntry[]>>({
    queryKey: ['competitions-level-rankings', selectedCycle, prevYear, prevMonth],
    queryFn: () => apiGet<Record<string, RankingEntry[]>>(`/users/progress/ranking/by-level${queryParams}`),
    refetchInterval: selectedCycle === 'current' ? 60000 : false,
    placeholderData: (previousData) => previousData,
  });

  const currentRanking = rankingMode === 'global' ? globalRanking : (levelRankings?.[selectedLevelCat] || []);
  const isInitialLoading = (globalLoading && globalRanking.length === 0) || (levelLoading && !levelRankings);

  const [showScrollTop, setShowScrollTop] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 200);
    };
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-bg flex flex-col md:flex-row overflow-x-clip">
      <SidebarActivities isOpen={sidebarOpen} onClose={handleCloseSidebar} />

      <div className={cn("flex-1 flex flex-col min-w-0 transition-all duration-300", sidebarOpen ? "md:ml-[280px]" : "md:ml-0")}>
        <MainHeader onToggleMenu={handleToggleSidebar} />

        <main className="p-4 md:p-8 max-w-4xl w-full mx-auto space-y-8 animate-fade-in">
          <header className="flex flex-col md:flex-row md:items-center justify-between gap-6">
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold text-text mb-2">
                Competitions
              </h1>
              <p className="text-text-muted text-sm">
                See who the most engaged students are and climb the ranking!
              </p>
            </div>

            <div className="flex bg-surface border border-border p-1 rounded-xl shadow-sm">
              <button
                onClick={() => setRankingMode('global')}
                className={cn(
                  "px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all",
                  rankingMode === 'global' ? "bg-primary text-white shadow-glow" : "text-text-muted hover:text-text"
                )}
              >
                Global
              </button>
              <button
                onClick={() => setRankingMode('level')}
                className={cn(
                  "px-4 py-2 text-xs font-black uppercase tracking-widest rounded-lg transition-all",
                  rankingMode === 'level' ? "bg-primary text-white shadow-glow" : "text-text-muted hover:text-text"
                )}
              >
                By Level
              </button>
            </div>
          </header>

          {/* Cycle / Month Selector */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-2 bg-surface border border-border rounded-2xl shadow-sm">
            <div className="flex flex-wrap items-center gap-1.5">
              <button
                onClick={() => setSelectedCycle('current')}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all",
                  selectedCycle === 'current'
                    ? "bg-primary text-white shadow-sm"
                    : "text-text-muted hover:text-text hover:bg-bg-secondary"
                )}
              >
                <span className={cn("w-2 h-2 rounded-full", selectedCycle === 'current' ? "bg-emerald-300 animate-pulse" : "bg-text-subtle")} />
                <span>Current Cycle ({MONTH_NAMES_EN[currentMonth]} {currentYear})</span>
                <span className={cn("text-[0.6rem] px-1.5 py-0.5 rounded font-black uppercase tracking-wider", selectedCycle === 'current' ? "bg-white/20 text-white" : "bg-primary/10 text-primary")}>
                  Live
                </span>
              </button>

              <button
                onClick={() => setSelectedCycle('previous')}
                className={cn(
                  "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all",
                  selectedCycle === 'previous'
                    ? "bg-amber-500 text-white shadow-sm"
                    : "text-text-muted hover:text-text hover:bg-bg-secondary"
                )}
              >
                <span>🏆</span>
                <span>Previous Cycle ({MONTH_NAMES_EN[prevMonth]} {prevYear})</span>
                <span className={cn("text-[0.6rem] px-1.5 py-0.5 rounded font-black uppercase tracking-wider", selectedCycle === 'previous' ? "bg-white/20 text-white" : "bg-amber-500/10 text-amber-600 dark:text-amber-400")}>
                  Concluded
                </span>
              </button>
            </div>

            <div className="text-[0.7rem] text-text-muted px-2 font-medium">
              {selectedCycle === 'current' ? (
                <span>Live Ranking • Resets monthly</span>
              ) : (
                <span>Concluded Cycle • Final Results</span>
              )}
            </div>
          </div>

          {/* Concluded Cycle Banner */}
          {selectedCycle === 'previous' && (
            <div className="bg-gradient-to-r from-amber-500/15 via-amber-500/5 to-transparent border border-amber-500/30 rounded-3xl p-5 md:p-6 flex flex-col md:flex-row md:items-center justify-between gap-4 animate-in fade-in duration-300">
              <div className="flex items-start md:items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-amber-500/20 text-amber-500 flex items-center justify-center text-2xl shrink-0 shadow-sm">
                  🏆
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <h2 className="text-base md:text-lg font-bold text-text">
                      Final Official Results • {MONTH_NAMES_EN[prevMonth]} {prevYear}
                    </h2>
                    <span className="px-2.5 py-0.5 rounded-full text-[0.65rem] font-black uppercase tracking-wider bg-amber-500/20 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                      Concluded
                    </span>
                  </div>
                  <p className="text-xs md:text-sm text-text-muted mt-1 leading-relaxed">
                    This competition has officially ended. Below are the finalized scores and podium champions for {MONTH_NAMES_EN[prevMonth]}.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setSelectedCycle('current')}
                className="px-4 py-2.5 rounded-xl bg-primary text-white text-xs font-bold hover:bg-primary-hover transition-colors shadow-sm shrink-0 flex items-center justify-center gap-2"
              >
                <span>View Current Live Cycle</span>
              </button>
            </div>
          )}

          {/* New Cycle Notice */}
          {selectedCycle === 'current' && currentRanking.length <= 2 && (
            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs animate-in fade-in duration-300">
              <div className="flex items-center gap-2.5 text-text">
                <span className="text-base">🚀</span>
                <span>
                  The <strong>{MONTH_NAMES_EN[currentMonth]} {currentYear}</strong> cycle has just begun! Practice activities, voice conversations, or quizzes to climb the leaderboard.
                </span>
              </div>
              <button
                onClick={() => setSelectedCycle('previous')}
                className="text-primary hover:underline font-bold shrink-0 self-start sm:self-auto flex items-center gap-1 cursor-pointer"
              >
                <span>View {MONTH_NAMES_EN[prevMonth]} Winners</span>
                <span>→</span>
              </button>
            </div>
          )}

          {rankingMode === 'level' && (
            <div className="flex flex-wrap justify-center gap-2 animate-in fade-in slide-in-from-top-2 duration-500">
              {CEFR_LEVELS.map(cat => (
                <button
                  key={cat}
                  onClick={() => setSelectedLevelLevelCat(cat)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[0.6rem] font-black uppercase tracking-tighter border transition-all",
                    selectedLevelCat === cat
                      ? "bg-primary/10 border-primary text-primary shadow-sm"
                      : "bg-surface border-border text-text-muted hover:border-primary/30"
                  )}
                >
                  {CEFR_LABEL_MAP[cat] || cat}
                </button>
              ))}
            </div>
          )}

          <div className="bg-surface border border-border rounded-3xl overflow-hidden shadow-sm">
            <div className="grid grid-cols-3 p-6 md:p-10 bg-gradient-to-b from-primary/10 to-transparent items-end border-b border-border">
              <div className="flex flex-col items-center gap-3">
                <div className="w-14 h-14 md:w-20 md:h-20 rounded-full border-4 border-slate-300 relative bg-bg-secondary overflow-hidden">
                  <img
                    src={getStudentAvatar(currentRanking[1]?.avatar_url)}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR_URL; }}
                  />
                  <div className="absolute -top-1 -right-1 w-6 h-6 md:w-7 md:h-7 rounded-full bg-slate-200 border-2 border-slate-400 flex items-center justify-center text-slate-800 font-black text-xs shadow-sm">
                    2
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-text truncate max-w-[80px] md:max-w-none">{currentRanking[1]?.name || currentRanking[1]?.username || '—'}</p>
                  <p className="text-[0.6rem] font-bold text-primary">{currentRanking[1]?.score || 0} pts</p>
                </div>
              </div>

              <div className="flex flex-col items-center gap-4">
                <div className="w-20 h-20 md:w-28 md:h-28 rounded-full border-4 border-yellow-400 relative shadow-glow shadow-yellow-400/25 scale-110 bg-bg-secondary overflow-hidden">
                  <img
                    src={getStudentAvatar(currentRanking[0]?.avatar_url)}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR_URL; }}
                  />
                  <div className="absolute -top-1 -right-1 w-7 h-7 md:w-8 md:h-8 rounded-full bg-yellow-400 border-2 border-yellow-500 flex items-center justify-center text-yellow-950 font-black text-xs shadow-sm">
                    1
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-sm font-black text-text truncate max-w-[100px] md:max-w-none">{currentRanking[0]?.name || currentRanking[0]?.username || '—'}</p>
                  <p className="text-[0.7rem] font-black text-primary uppercase tracking-widest">{currentRanking[0]?.score || 0} pts</p>
                </div>
              </div>

              <div className="flex flex-col items-center gap-3">
                <div className="w-12 h-12 md:w-16 md:h-16 rounded-full border-4 border-orange-400 relative bg-bg-secondary overflow-hidden">
                  <img
                    src={getStudentAvatar(currentRanking[2]?.avatar_url)}
                    alt=""
                    className="w-full h-full object-cover"
                    onError={(e) => { e.currentTarget.src = DEFAULT_AVATAR_URL; }}
                  />
                  <div className="absolute -top-1 -right-1 w-6 h-6 md:w-7 md:h-7 rounded-full bg-orange-300 border-2 border-orange-500 flex items-center justify-center text-orange-950 font-black text-xs shadow-sm">
                    3
                  </div>
                </div>
                <div className="text-center">
                  <p className="text-xs font-bold text-text truncate max-w-[80px] md:max-w-none">{currentRanking[2]?.name || currentRanking[2]?.username || '—'}</p>
                  <p className="text-[0.6rem] font-bold text-primary">{currentRanking[2]?.score || 0} pts</p>
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead className="bg-bg-secondary/50 text-[0.6rem] font-black text-text-subtle uppercase tracking-widest">
                  <tr>
                    <th className="px-6 py-4 w-16 text-center">Pos</th>
                    <th className="px-6 py-4">Student</th>
                    <th className="px-6 py-4 text-right">Total Score</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {isInitialLoading ? Array(5).fill(0).map((_, i) => (
                    <tr key={i} className="animate-pulse">
                      <td colSpan={3} className="px-6 py-12" />
                    </tr>
                  )) : currentRanking.length > 0 ? currentRanking.map((r, i) => (
                    <tr key={r.username} className={cn(
                      "hover:bg-bg-secondary/30 transition-colors",
                      r.username === user?.username && "bg-primary/5 border-l-4 border-l-primary"
                    )}>
                      <td className="px-6 py-4 text-center font-bold text-text-muted">{i + 1}</td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary border border-primary/20 overflow-hidden shrink-0">
                            <img
                              src={getStudentAvatar(r.avatar_url)}
                              alt=""
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                e.currentTarget.src = DEFAULT_AVATAR_URL;
                              }}
                            />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-text truncate max-w-[150px] md:max-w-xs">{r.name || r.username} {r.username === user?.username && <span className="text-[0.6rem] ml-2 text-primary font-black uppercase tracking-tighter">(You)</span>}</p>
                            <p className="text-[0.65rem] text-text-muted uppercase font-bold tracking-wider">{r.level || '-'}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-right font-black text-text tabular-nums">{r.score}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={3} className="px-6 py-20 text-center text-text-muted text-sm italic">
                        {selectedCycle === 'previous'
                          ? 'No student participation records found for this previous cycle.'
                          : 'No students in this category yet. Be the first!'}
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* XP Scoring Guide Section */}
          <section className="bg-surface border border-border rounded-3xl p-6 md:p-8 space-y-6 shadow-sm">
            <div className="flex items-center justify-between border-b border-border pb-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary">
                  <Zap size={22} className="fill-primary/20" />
                </div>
                <div>
                  <h2 className="text-lg md:text-xl font-bold font-display text-text">
                    How to Earn Points & Climb the Ranking
                  </h2>
                  <p className="text-xs text-text-muted">
                    Every interaction with Taty's Hub earns you points towards the monthly competition.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl bg-bg-secondary/40 border border-border/80 flex flex-col justify-between gap-3 hover:border-primary/40 transition-all group">
                <div className="flex items-start justify-between gap-2">
                  <div className="w-9 h-9 rounded-xl bg-purple-500/10 border border-purple-500/20 text-purple-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Mic size={18} />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-black bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20">
                    +30 pts / message
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text mb-1">Voice Mode Conversation</h3>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Practice spoken English with Taty's Hub. Every spoken voice interaction awards 30 points.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-bg-secondary/40 border border-border/80 flex flex-col justify-between gap-3 hover:border-primary/40 transition-all group">
                <div className="flex items-start justify-between gap-2">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <MessageSquare size={18} />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-black bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    +15 pts / message
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text mb-1">Interactive Chat</h3>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Send messages, ask questions, and practice grammar corrections with Taty's Hub.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-bg-secondary/40 border border-border/80 flex flex-col justify-between gap-3 hover:border-primary/40 transition-all group">
                <div className="flex items-start justify-between gap-2">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Goal size={18} />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    +25 pts / day (1x)
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text mb-1">CEFR Leveling Challenge</h3>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Discover and update your proficiency level (A1 to B2). Awards 25 points once per day upon completion.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-bg-secondary/40 border border-border/80 flex flex-col justify-between gap-3 hover:border-primary/40 transition-all group">
                <div className="flex items-start justify-between gap-2">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Flame size={18} />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    Daily Streak
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text mb-1">Daily Streak</h3>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Log in and study daily to keep your learning streak active and unlock exclusive consistency trophies.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-bg-secondary/40 border border-border/80 flex flex-col justify-between gap-3 hover:border-primary/40 transition-all group">
                <div className="flex items-start justify-between gap-2">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Sparkles size={18} />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-black bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                    +25 pts / exercise done
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text mb-1">Simulations, Games, Music and News</h3>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Do the simulations, games, music and news to earn points.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-bg-secondary/40 border border-border/80 flex flex-col justify-between gap-3 hover:border-primary/40 transition-all group">
                <div className="flex items-start justify-between gap-2">
                  <div className="w-9 h-9 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <BookOpen size={18} />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-black bg-pink-500/15 text-pink-600 dark:text-pink-400 border border-pink-500/20">
                    +25 pts / exercise done
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text mb-1">Grammar, Listening, Reading and Flashcards</h3>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Do the lessons and flashcards to earn points.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>

      {showScrollTop && (
        <button
          onClick={scrollToTop}
          aria-label="Back to top"
          className="fixed bottom-6 right-6 z-50 p-3.5 rounded-full bg-primary text-white shadow-xl hover:bg-primary-hover hover:scale-110 active:scale-95 transition-all duration-200 border border-primary/20 cursor-pointer"
        >
          <ArrowUp size={20} className="stroke-[2.5]" />
        </button>
      )}
    </div>
  );
}
