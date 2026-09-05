'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { 
  Trophy, 
  ChevronRight,
  Menu,
  Medal,
  TrendingUp,
  Globe,
  Calendar,
  Mic,
  MessageSquare,
  Flame,
  Target,
  Sparkles,
  BookOpen,
  Headphones,
  Zap
} from 'lucide-react';
import { MainHeader } from '@/components/layout/main-header';
import { SidebarActivities } from '@/components/activities/sidebar-activities';
import { useSidebarState } from '@/hooks/useSidebarState';
import { apiGet } from '@/lib/api/client';
import { DEFAULT_AVATAR_URL } from '@/lib/constants/user';

import { useAuth } from '@/hooks/useAuth';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';
import { CEFRLevel, CEFR_LEVELS, CEFR_LABEL_MAP } from '@/lib/constants/levels';

interface RankingEntry {
  username: string;
  name?: string;
  score: number;
  level?: string;
  avatar_url?: string;
}

export default function CompetitionsClientPage() {
  const { user } = useAuth();
  const { sidebarOpen, toggleSidebar: handleToggleSidebar, closeSidebar: handleCloseSidebar } = useSidebarState();
  const [rankingMode, setRankingMode] = useState<'global' | 'level'>('global');
  const [selectedLevelCat, setSelectedLevelLevelCat] = useState<CEFRLevel>('A1');

  const { data: globalRanking = [], isLoading: globalLoading } = useQuery<RankingEntry[]>({
    queryKey: ['competitions-global-ranking'],
    queryFn: () => apiGet<RankingEntry[]>('/users/progress/ranking/top15'),
  });
  const { data: levelRankings, isLoading: levelLoading } = useQuery<Record<string, RankingEntry[]>>({
    queryKey: ['competitions-level-rankings'],
    queryFn: () => apiGet<Record<string, RankingEntry[]>>('/users/progress/ranking/by-level'),
  });

  const currentRanking = rankingMode === 'global' ? globalRanking : (levelRankings?.[selectedLevelCat] || []);
  const isLoading = globalLoading || levelLoading;

  return (
    <div className="min-h-screen bg-bg flex flex-col md:flex-row overflow-x-hidden">
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
                        src={currentRanking[1]?.avatar_url || DEFAULT_AVATAR_URL}
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
                        src={currentRanking[0]?.avatar_url || DEFAULT_AVATAR_URL}
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
                        src={currentRanking[2]?.avatar_url || DEFAULT_AVATAR_URL}
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
                      {isLoading ? Array(5).fill(0).map((_, i) => (
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
                                       src={r.avatar_url || DEFAULT_AVATAR_URL}
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
                            No students in this category yet. Be the first!
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
                    Every interaction with Teacher Tati earns you XP towards the monthly competition.
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
                    +10 XP / message
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text mb-1">Voice Mode Conversation</h3>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Practice spoken English with Teacher Tati. Every spoken voice response earns instant points.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-bg-secondary/40 border border-border/80 flex flex-col justify-between gap-3 hover:border-primary/40 transition-all group">
                <div className="flex items-start justify-between gap-2">
                  <div className="w-9 h-9 rounded-xl bg-blue-500/10 border border-blue-500/20 text-blue-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <MessageSquare size={18} />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-black bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/20">
                    +5 XP / message
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text mb-1">Interactive Chat</h3>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Send messages, ask questions, and practice grammar corrections in the chat with Teacher Tati.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-bg-secondary/40 border border-border/80 flex flex-col justify-between gap-3 hover:border-primary/40 transition-all group">
                <div className="flex items-start justify-between gap-2">
                  <div className="w-9 h-9 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Target size={18} />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-black bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    +50 XP / challenge
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text mb-1">CEFR Leveling Challenge</h3>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Test your proficiency from A1 to B2. Earn +10 XP per question answered plus 50 XP upon completion.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-bg-secondary/40 border border-border/80 flex flex-col justify-between gap-3 hover:border-primary/40 transition-all group">
                <div className="flex items-start justify-between gap-2">
                  <div className="w-9 h-9 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Flame size={18} />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-black bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                    +20 XP / day
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text mb-1">Daily Study Streak</h3>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Study consistently every single day. Daily practice awards streak retention bonus points.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-bg-secondary/40 border border-border/80 flex flex-col justify-between gap-3 hover:border-primary/40 transition-all group">
                <div className="flex items-start justify-between gap-2">
                  <div className="w-9 h-9 rounded-xl bg-indigo-500/10 border border-indigo-500/20 text-indigo-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Sparkles size={18} />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-black bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20">
                    +25 XP / scenario
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text mb-1">Real-World Simulations</h3>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Practice airports, job interviews, restaurants, and business meetings in realistic simulations.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-bg-secondary/40 border border-border/80 flex flex-col justify-between gap-3 hover:border-primary/40 transition-all group">
                <div className="flex items-start justify-between gap-2">
                  <div className="w-9 h-9 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <BookOpen size={18} />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-black bg-pink-500/15 text-pink-600 dark:text-pink-400 border border-pink-500/20">
                    +15 XP / review
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text mb-1">SRS Vocabulary Reviews</h3>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Review flashcards with spaced repetition and lock new vocabulary into long-term memory.
                  </p>
                </div>
              </div>

              <div className="p-4 rounded-2xl bg-bg-secondary/40 border border-border/80 flex flex-col justify-between gap-3 hover:border-primary/40 transition-all group">
                <div className="flex items-start justify-between gap-2">
                  <div className="w-9 h-9 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-500 flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform">
                    <Headphones size={18} />
                  </div>
                  <span className="px-2.5 py-1 rounded-full text-xs font-black bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20">
                    +20 XP / activity
                  </span>
                </div>
                <div>
                  <h3 className="text-sm font-bold text-text mb-1">Listening & Hub Materials</h3>
                  <p className="text-xs text-text-muted leading-relaxed">
                    Listen to pedagogical podcasts and study exclusive guided materials created by Teacher Tati.
                  </p>
                </div>
              </div>
            </div>
          </section>
        </main>
      </div>
    </div>
  );
}
