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
  Calendar
} from 'lucide-react';
import { MainHeader } from '@/components/layout/main-header';
import { SidebarActivities } from '@/components/activities/sidebar-activities';
import { apiGet } from '@/lib/api/client';

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

export default function CompetitionsPage() {
  const { user } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
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
    <div className="min-h-screen bg-bg flex flex-col md:flex-row">
      <SidebarActivities isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 md:ml-[280px]">
        <MainHeader onToggleMenu={() => setSidebarOpen(true)} />

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
                   <div className="w-14 h-14 md:w-20 md:h-20 rounded-full border-4 border-slate-300 relative">
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-8 h-8 rounded-full bg-slate-300 flex items-center justify-center text-slate-800 font-bold text-xs shadow-sm">2</div>
                      <div className="w-full h-full rounded-full bg-bg-secondary overflow-hidden flex items-center justify-center text-xl">🥈</div>
                   </div>
                   <div className="text-center">
                     <p className="text-xs font-bold text-text truncate max-w-[80px] md:max-w-none">{currentRanking[1]?.name || currentRanking[1]?.username || '—'}</p>
                     <p className="text-[0.6rem] font-bold text-primary">{currentRanking[1]?.score || 0} pts</p>
                   </div>
                </div>

                <div className="flex flex-col items-center gap-4">
                   <div className="w-20 h-20 md:w-28 md:h-28 rounded-full border-4 border-yellow-400 relative shadow-glow shadow-yellow-400/25 scale-110">
                      <div className="absolute -top-4 left-1/2 -translate-x-1/2 w-10 h-10 rounded-full bg-yellow-400 flex items-center justify-center text-yellow-900 font-black">1</div>
                      <div className="w-full h-full rounded-full bg-bg-secondary overflow-hidden flex items-center justify-center text-4xl">🥇</div>
                   </div>
                   <div className="text-center">
                     <p className="text-sm font-black text-text truncate max-w-[100px] md:max-w-none">{currentRanking[0]?.name || currentRanking[0]?.username || '—'}</p>
                     <p className="text-[0.7rem] font-black text-primary uppercase tracking-widest">{currentRanking[0]?.score || 0} pts</p>
                   </div>
                </div>

                <div className="flex flex-col items-center gap-3">
                   <div className="w-12 h-12 md:w-16 md:h-16 rounded-full border-4 border-orange-400 relative">
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-7 h-7 rounded-full bg-orange-400 flex items-center justify-center text-orange-900 font-bold text-xs shadow-sm">3</div>
                      <div className="w-full h-full rounded-full bg-bg-secondary overflow-hidden flex items-center justify-center text-lg">🥉</div>
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
                                     {r.avatar_url ? <img src={r.avatar_url} alt="" className="w-full h-full object-cover" /> : (r.name || r.username || '?').charAt(0).toUpperCase()}
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
        </main>
      </div>
    </div>
  );
}
