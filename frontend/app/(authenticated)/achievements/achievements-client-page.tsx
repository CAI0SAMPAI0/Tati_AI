'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Trophy,
  Flame,
  Target,
  Clock,
  Coins,
  Star,
  Medal,
  Sparkles
} from 'lucide-react';
import { MainHeader } from '@/components/layout/main-header';
import { SidebarActivities } from '@/components/activities/sidebar-activities';
import { apiGet } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { ENDPOINTS } from '@/lib/api/endpoints';

interface DashboardStats {
  trophies_earned?: number;
  total_xp?: number;
  xp?: number;
}

interface StreakData {
  current_streak: number;
  longest_streak: number;
}

interface Medal {
  id: string;
  category: string;
  title: string;
  unlocked: boolean;
}

export default function AchievementsClientPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [filter, setFilter] = useState('all');

  const { data: stats } = useQuery<DashboardStats>({
    queryKey: ['achievements-stats'],
    queryFn: () => apiGet<DashboardStats>('/dashboard/stats/my'),
  });
  const { data: streak } = useQuery<StreakData>({
    queryKey: ['achievements-streak'],
    queryFn: () => apiGet<StreakData>(ENDPOINTS.STREAK),
  });
  const { data: medals } = useQuery<Medal[]>({
    queryKey: ['achievements-medals'],
    queryFn: () => apiGet<Medal[]>('/activities/achievements/my'),
  });

  const categories = [
    { id: 'all', icon: <Trophy size={16} />, label: 'All' },
    { id: 'questions', icon: <Target size={16} />, label: 'Questions' },
    { id: 'streak', icon: <Flame size={16} />, label: 'Streak' },
    { id: 'credits', icon: <Coins size={16} />, label: 'Credits' },
    { id: 'time', icon: <Clock size={16} />, label: 'Time' },
    { id: 'milestones', icon: <Star size={16} />, label: 'Milestones' },
  ];

  const categoryMap: Record<string, string[]> = {
    questions: ['question', 'questions', 'quiz', 'quizzes'],
    streak: ['streak'],
    credits: ['credit', 'credits', 'xp', 'score'],
    time: ['time', 'study_time', 'hours'],
    milestones: ['milestone', 'milestones', 'goal', 'goals'],
  };
  const filteredMedals = (medals || []).filter((m) => {
    if (filter === 'all') return true;
    const cat = String(m.category || '').toLowerCase();
    return (categoryMap[filter] || []).some((token) => cat.includes(token));
  });

  const trophyCount = medals ? medals.filter(m => m.unlocked).length : 0;
  const trophyProgress = (trophyCount / 50) * 100;

  return (
    <div className="min-h-screen bg-bg flex flex-col md:flex-row">
      <SidebarActivities isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="flex-1 flex flex-col min-w-0 md:ml-[280px]">
        <MainHeader onToggleMenu={() => setSidebarOpen(true)} />
        <main className="p-4 md:p-8 max-w-7xl w-full mx-auto space-y-8 animate-fade-in">
          <header>
            <h1 className="text-2xl md:text-3xl font-display font-bold text-text mb-2">My Achievements</h1>
            <p className="text-text-muted text-sm">Milestones achieved in your learning journey.</p>
          </header>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="bg-surface border border-border rounded-3xl p-6 flex flex-col md:flex-row items-center gap-8 group hover:border-primary/30 transition-all">
              <div className="relative">
                <div className="w-24 h-24 rounded-full bg-orange-500/10 flex items-center justify-center text-4xl shadow-glow shadow-orange-500/20">🔥</div>
                <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 px-3 py-1 bg-bg border border-border rounded-full text-[0.6rem] font-black text-text-muted uppercase tracking-widest whitespace-nowrap">
                  {(streak?.current_streak ?? 0) > 0 ? 'Active' : 'Inactive'}
                </div>
              </div>
              <div className="flex-1 text-center md:text-left">
                <div className="text-5xl font-black text-text leading-none mb-1">{streak?.current_streak || 0}</div>
                <p className="text-xs font-bold text-text-subtle uppercase tracking-widest">days streak</p>
                <div className="grid grid-cols-2 gap-4 mt-6">
                  <div>
                    <p className="text-[0.6rem] font-bold text-text-muted uppercase">Longest streak</p>
                    <p className="text-sm font-bold text-text">{streak?.longest_streak || 0} days</p>
                  </div>
                  <div>
                    <p className="text-[0.6rem] font-bold text-text-muted uppercase">Total XP</p>
                    <p className="text-sm font-bold text-text">{stats?.total_xp || stats?.xp || 0}</p>
                  </div>
                </div>
              </div>
            </div>

            {/* Trophy Progress Card */}
            <div className="bg-surface border border-border rounded-3xl p-6 space-y-6 group hover:border-primary/30 transition-all">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold uppercase tracking-widest text-text-subtle">Trophy Progress</h3>
                <div className="flex items-baseline gap-1">
                  <span className="text-2xl font-black text-primary">{trophyCount}</span>
                  <span className="text-xs font-bold text-text-muted">/50</span>
                </div>
              </div>
              <div className="space-y-2">
                <div className="w-full h-3 bg-bg border border-border rounded-full overflow-hidden p-0.5">
                  <div className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-1000" style={{ width: `${trophyProgress}%` }} />
                </div>
              </div>
              <div className="flex gap-2">
                {[1, 2, 3, 4].map((i) => (
                  <div key={i} className={cn('flex-1 h-8 rounded-lg flex items-center justify-center border border-border transition-all', trophyCount >= i * 12 ? 'bg-primary/10 border-primary/30 text-primary' : 'bg-bg-secondary opacity-30 grayscale')}>
                    <Medal size={16} />
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="space-y-6">
            <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-none">
              {categories.map((c) => (
                <button key={c.id} onClick={() => setFilter(c.id)} className={cn('flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border', filter === c.id ? 'bg-primary text-white border-primary shadow-glow' : 'bg-surface border-border text-text-muted hover:border-primary/40 hover:text-text')}>
                  {c.icon}
                  {c.label}
                </button>
              ))}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-4">
              {filteredMedals.map((m) => (
                <div key={m.id} className={cn('bg-surface border border-border rounded-2xl p-4 flex flex-col items-center justify-center text-center gap-3 group hover:-translate-y-1 transition-all', m.unlocked ? 'hover:border-primary/50' : 'opacity-40 grayscale')}>
                  <div className={cn('w-12 h-12 rounded-full flex items-center justify-center text-2xl relative', m.unlocked ? 'bg-primary/10 text-primary' : 'bg-bg-secondary')}>
                    {m.unlocked ? '🏆' : '🔒'}
                    {m.unlocked && <Sparkles className="absolute -top-1 -right-1 text-yellow-500 animate-pulse" size={14} />}
                  </div>
                  <div>
                    <p className="text-[0.7rem] font-bold text-text leading-tight mb-1">{m.title}</p>
                    <p className="text-[0.55rem] text-text-muted uppercase tracking-widest font-black">{m.category}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </main>
      </div>
    </div>
  );
}
