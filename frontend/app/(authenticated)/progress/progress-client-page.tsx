'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { MessageSquare, BookOpen, CalendarDays, Type, Flame, Lightbulb, Download, Snowflake, ShoppingBag } from 'lucide-react';
import { MainHeader } from '@/components/layout/main-header';
import { SidebarActivities } from '@/components/activities/sidebar-activities';
import { apiGet, API_BASE } from '@/lib/api/client';
import { cn } from '@/lib/utils';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { Button } from '@/components/ui/button';
import toast from 'react-hot-toast';
import dynamic from 'next/dynamic';
import Link from 'next/link';

const ActivityBarChart = dynamic(() => import('@/components/charts/activity-bar-chart'), {
  ssr: false,
  loading: () => <div className="h-[220px] w-full bg-bg-secondary rounded-2xl animate-pulse" />
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface XpData {
  total_xp?: number;
  xp?: number;
  current_streak: number;
  longest_streak: number;
  level_progress?: number;
  level?: string;
}


interface StreakData {
  current_streak: number;
  longest_streak: number;
  streak_freeze_count?: number;
}

interface WeeklyReport {
  period: 'weekly';
  total_conversations: number;
  total_messages: number;
  study_days: number;
  unique_words_used: number;
  current_streak: number;
  messages_by_day: number[];
  days_of_week: string[];
}

interface MonthlyReport {
  period: 'monthly';
  total_conversations: number;
  total_messages: number;
  study_days: number;
  unique_words_used: number;
  current_streak: number;
  longest_streak: number;
  messages_by_week: number[];
}

type Period = 'weekly' | 'monthly';

// ─── Constants ────────────────────────────────────────────────────────────────

const TIPS = [
  'Practice at least 30 minutes a day for faster results.',
  'Maintain your daily streak to unlock special trophies.',
  'Use new words to expand your vocabulary.',
  'Complete quizzes to earn extra XP.',
  'Join the weekly leaderboard to stay motivated.',
];

const LEVEL_COLORS: Record<string, string> = {
  A1: 'from-green-500 to-emerald-400',
  A2: 'from-teal-500 to-green-400',
  B1: 'from-blue-500 to-cyan-400',
  B2: 'from-indigo-500 to-blue-400',
  C1: 'from-violet-500 to-indigo-400',
  C2: 'from-primary to-violet-400',
};

// ─── Skeleton helpers ─────────────────────────────────────────────────────────

function StatSkeleton() {
  return (
    <div className="animate-pulse bg-surface border border-border rounded-2xl p-5 flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-bg-secondary shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="h-2.5 bg-bg-secondary rounded w-1/2" />
        <div className="h-5 bg-bg-secondary rounded w-1/3" />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProgressClientPage() {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [period, setPeriod] = useState<Period>('weekly');
  const [isDownloading, setIsDownloading] = useState(false);

  const { data: xpData, isLoading: xpLoading } = useQuery<XpData>({
    queryKey: ['my-stats'],
    queryFn: () => apiGet<XpData>('/dashboard/stats/my'),
  });
  const { data: streakData, isLoading: streakLoading } = useQuery<StreakData>({
    queryKey: ['progress-streak'],
    queryFn: () => apiGet<StreakData>(ENDPOINTS.STREAK),
  });
  const { data: weeklyReport, isLoading: weeklyLoading } = useQuery<WeeklyReport>({
    queryKey: ['progress-weekly'],
    queryFn: () => apiGet<WeeklyReport>(`${ENDPOINTS.PROGRESS_WEEKLY}?lang=en-US`),
  });
  const { data: monthlyReport, isLoading: monthlyLoading } = useQuery<MonthlyReport>({
    queryKey: ['progress-monthly'],
    queryFn: () => apiGet<MonthlyReport>(`${ENDPOINTS.PROGRESS_MONTHLY}?lang=en-US`),
  });

  const reportLoading = period === 'weekly' ? weeklyLoading : monthlyLoading;

  // Derive stats from active period report
  const activeReport = period === 'weekly' ? weeklyReport : monthlyReport;

  const stats = activeReport
    ? {
      total_messages: activeReport.total_messages,
      total_conversations: activeReport.total_conversations,
      study_days: activeReport.study_days,
      unique_words_used: activeReport.unique_words_used,
    }
    : null;

  // Build chart data
  const chartData =
    period === 'weekly' && weeklyReport
      ? weeklyReport.messages_by_day.map((val, i) => ({
        name: weeklyReport.days_of_week[i] ?? `D${i + 1}`,
        messages: val,
      }))
      : period === 'monthly' && monthlyReport
        ? monthlyReport.messages_by_week.map((val, i) => ({
          name: `Wk ${i + 1}`,
          messages: val,
        }))
        : [];

  const handleDownloadReport = async () => {
    setIsDownloading(true);
    try {
      const token = localStorage.getItem('token');
      const url = `${API_BASE}/users/progress/report/download`;

      const response = await fetch(url, {
        headers: { 'Authorization': `Bearer ${token}` }
      });

      if (!response.ok) throw new Error('Download failed');

      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = downloadUrl;
      a.download = `TatiAI_Report_${new Date().toISOString().split('T')[0]}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(downloadUrl);
      toast.success('Report downloaded successfully!');
    } catch (err) {
      console.error(err);
      toast.error('Error downloading report. Please try again.');
    } finally {
      setIsDownloading(false);
    }
  };

  const levelGradient = (xpData?.level && LEVEL_COLORS[xpData.level as string]) || LEVEL_COLORS.A1;

  return (
    <div className="min-h-screen bg-bg flex flex-col md:flex-row">
      <SidebarActivities isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 md:ml-[280px]">
        <MainHeader onToggleMenu={() => setSidebarOpen(true)} />

        <main className="p-4 md:p-8 max-w-7xl w-full mx-auto space-y-8 animate-fade-in">

          {/* ── Header ── */}
          <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-display font-bold text-text mb-2">
                My Progress
              </h1>
              <p className="text-text-muted text-sm">
                Track your learning evolution
              </p>
            </div>

            <Button
              onClick={handleDownloadReport}
              disabled={isDownloading}
              className="gap-2 bg-primary/10 text-primary border border-primary/20 hover:bg-primary/20 rounded-2xl px-6 py-6 font-bold transition-all active:scale-[0.98]"
            >
              {isDownloading ? (
                <span className="animate-spin mr-2">⏳</span>
              ) : (
                <Download size={18} />
              )}
              Download PDF Report
            </Button>
          </header>

          {/* ── XP Progress Bar ── */}
          <div className="bg-surface border border-border rounded-3xl p-6 space-y-4 group hover:border-primary/30 transition-all">
            <div className="flex items-center justify-between flex-wrap gap-3">
              <div className="flex items-center gap-3">
                <div className={cn(
                  'w-10 h-10 rounded-xl flex items-center justify-center text-sm font-black text-white bg-gradient-to-br',
                  levelGradient,
                )}>
                  {'🏆'}
                </div>
                <div>
                  <p className="text-[0.65rem] font-bold text-text-subtle uppercase tracking-widest">
                    Current Level
                  </p>
                  <p className="text-base font-black text-text leading-tight">
                    {xpLoading ? (
                      <span className="inline-block w-16 h-4 bg-bg-secondary rounded animate-pulse" />
                    ) : (
                      xpData?.level || 'A1'
                    )}
                  </p>
                </div>
              </div>

              <div className="text-right">
                {xpLoading ? (
                  <div className="w-24 h-4 bg-bg-secondary rounded animate-pulse" />
                ) : (
                  <>
                    <span className="text-xl font-black text-primary tabular-nums">
                      {(xpData?.total_xp || xpData?.xp || 0).toLocaleString('en-US')}
                    </span>
                    <span className="text-xs font-bold text-text-muted ml-1">
                      XP
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Progress track */}
            <div className="space-y-1.5">
              <div className="w-full h-3 bg-bg border border-border rounded-full overflow-hidden p-0.5">
                <div
                  className={cn(
                    'h-full rounded-full transition-all duration-1000 bg-gradient-to-r',
                    levelGradient,
                  )}
                  style={{ width: `${xpData?.level_progress ?? 0}%` }}
                />
              </div>
              <div className="flex justify-between text-[0.6rem] font-bold text-text-subtle uppercase tracking-widest">
                <span>Keep learning!</span>
                <span>
                  {xpLoading ? '—' : `${(xpData?.total_xp || xpData?.xp || 0).toLocaleString('en-US')} Total XP`}
                </span>
              </div>
            </div>
          </div>

          {/* ── Period Tabs ── */}
          <div className="flex gap-2">
            {(['weekly', 'monthly'] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={cn(
                  'px-5 py-2 rounded-xl text-xs font-bold transition-all border',
                  period === p
                    ? 'bg-primary text-white border-primary shadow-glow'
                    : 'bg-surface border-border text-text-muted hover:border-primary/40 hover:text-text',
                )}
              >
                {p === 'weekly' ? 'Weekly' : 'Monthly'}
              </button>
            ))}
          </div>

          {/* ── Stats Grid ── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            {reportLoading || !stats ? (
              Array(4).fill(0).map((_, i) => <StatSkeleton key={i} />)
            ) : (
              <>
                <StatCard
                  icon={<MessageSquare size={20} />}
                  label="Messages"
                  value={stats.total_messages}
                  color="bg-violet-500/10 text-violet-500"
                />
                <StatCard
                  icon={<BookOpen size={20} />}
                  label="Conversations"
                  value={stats.total_conversations}
                  color="bg-blue-500/10 text-blue-500"
                />
                <StatCard
                  icon={<CalendarDays size={20} />}
                  label="Study Days"
                  value={stats.study_days}
                  color="bg-emerald-500/10 text-emerald-500"
                />
                <StatCard
                  icon={<Type size={20} />}
                  label="Unique Words"
                  value={stats.unique_words_used}
                  color="bg-amber-500/10 text-amber-500"
                />
              </>
            )}
          </div>

          {/* ── Chart + Streak ── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

            {/* Bar Chart */}
            <div className="bg-surface border border-border rounded-3xl p-6 space-y-6 group hover:border-primary/30 transition-all">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-primary rounded-full" />
                <h3 className="text-sm font-bold text-text">
                  {period === 'weekly' ? 'Weekly Activity' : 'Monthly Activity'}
                </h3>
              </div>

              {reportLoading ? (
                <div className="h-[220px] flex items-center justify-center">
                  <div className="w-full h-full bg-bg-secondary rounded-2xl animate-pulse" />
                </div>
              ) : chartData.length > 0 ? (
                <ActivityBarChart data={chartData} barSize={period === 'monthly' ? 40 : 28} />
              ) : (
                <div className="h-[220px] flex items-center justify-center text-text-muted text-sm">
                  No data available for this period.
                </div>
              )}
            </div>

            {/* Streak Card */}
            <div className="bg-surface border border-border rounded-3xl p-6 flex flex-col justify-center gap-6 group hover:border-primary/30 transition-all">
              <div className="flex items-center gap-3">
                <div className="w-1.5 h-6 bg-orange-500 rounded-full" />
                <h3 className="text-sm font-bold text-text">Study Streak</h3>
              </div>

              <div className="flex flex-col items-center gap-2 py-4">
                <div className="relative">
                  <div className="w-20 h-20 rounded-full bg-orange-500/10 flex items-center justify-center">
                    <Flame size={36} className="text-orange-500" fill="currentColor" />
                  </div>
                </div>

                {streakLoading ? (
                  <div className="w-20 h-10 bg-bg-secondary rounded-xl animate-pulse" />
                ) : (
                  <div className="flex flex-col items-center">
                    <div className="text-5xl font-black text-text leading-none tabular-nums">
                      {streakData?.current_streak ?? 0}
                    </div>
                    <p className="text-xs font-bold text-text-subtle uppercase tracking-widest mt-1">
                      consecutive days
                    </p>
                    {streakData?.streak_freeze_count && streakData.streak_freeze_count > 0 ? (
                      <div className="flex items-center gap-1.5 mt-3 text-xs font-bold text-cyan-500 bg-cyan-500/10 px-3 py-1 rounded-full border border-cyan-500/20" title="Streak Freeze Active">
                        <Snowflake size={14} className="animate-pulse" />
                        <span>{streakData.streak_freeze_count} Freeze Active</span>
                      </div>
                    ) : null}
                  </div>
                )}
              </div>

              <div className="border-t border-border pt-4 flex flex-col gap-3">
                <div className="flex items-center justify-between">
                  <p className="text-[0.65rem] font-bold text-text-muted uppercase tracking-widest">
                    Record
                  </p>
                  {streakLoading ? (
                    <div className="w-16 h-4 bg-bg-secondary rounded animate-pulse" />
                  ) : (
                    <div className="flex items-baseline gap-1">
                      <span className="text-xl font-black text-primary tabular-nums">
                        {streakData?.longest_streak ?? 0}
                      </span>
                      <span className="text-xs font-bold text-text-muted">days</span>
                    </div>
                  )}
                </div>

                <Link href="/shop" prefetch={true} className="w-full">
                  <Button variant="secondary" size="sm" className="w-full gap-1.5 text-xs font-bold border-dashed border-primary/40 hover:border-primary text-primary hover:bg-primary/5">
                    <ShoppingBag size={14} />
                    Visit Shop to Buy Freezes
                  </Button>
                </Link>
              </div>
            </div>
          </div>

          {/* ── Tips ── */}
          <div className="bg-surface border border-border rounded-3xl p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-yellow-500/10 flex items-center justify-center shrink-0">
                <Lightbulb size={18} className="text-yellow-500" />
              </div>
              <h3 className="text-sm font-bold text-text">Tips for Faster Growth</h3>
            </div>

            <ul className="space-y-3">
              {TIPS.map((tip, i) => (
                <li key={i} className="flex items-start gap-3">
                  <span className="mt-0.5 w-5 h-5 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center text-[0.6rem] font-black text-primary shrink-0">
                    {i + 1}
                  </span>
                  <p className="text-sm text-text-muted leading-relaxed">{tip}</p>
                </li>
              ))}
            </ul>
          </div>

        </main>
      </div>
    </div>
  );
}

// ─── Sub-components ────────────────────────────────────────────────────────────

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: number;
  color: string;
}

function StatCard({ icon, label, value, color }: StatCardProps) {
  return (
    <div className="bg-surface border border-border rounded-2xl p-5 flex items-center gap-4 transition-all hover:border-primary/30 hover:-translate-y-0.5 hover:shadow-lg hover:shadow-primary/5">
      <div className={cn('w-12 h-12 rounded-xl flex items-center justify-center shrink-0', color)}>
        {icon}
      </div>
      <div className="min-w-0">
        <p className="text-[0.65rem] font-bold text-text-muted uppercase tracking-wider mb-0.5 leading-none truncate">
          {label}
        </p>
        <p className="text-xl font-display font-bold text-text tabular-nums">
          {value.toLocaleString('en-US')}
        </p>
      </div>
    </div>
  );
}
