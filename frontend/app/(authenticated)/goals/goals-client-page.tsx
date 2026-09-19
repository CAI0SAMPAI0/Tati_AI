'use client';

import { useQuery } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { apiGet } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { MainHeader } from '@/components/layout/main-header';
import { SidebarActivities } from '@/components/activities/sidebar-activities';
import { useSidebarState } from '@/hooks/useSidebarState';
import { cn } from '@/lib/utils';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';

import {
  Clock,
  MessageSquare,
  Users,
  Type,
  CheckCircle2,
  Flame,
  Sparkles,
  Award,
  BookOpen,
  Headphones,
  Gamepad2,
  ListFilter
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
const MotionDiv = motion.div;


function GoalIcon({ className = "w-5 h-5", size = 20, inverted = false }: { className?: string; size?: number; inverted?: boolean }) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn(inverted ? "text-white" : "text-primary", className)}
    >
      <path d="M12 13V2l8 4-8 4" />
      <path d="M20.561 10.222a9 9 0 1 1-12.55-5.29" />
      <path d="M8.002 9.997a5 5 0 1 0 8.9 2.02" />
    </svg>
  );
}

interface Goal {
  id: string;
  type: string;
  title?: string;
  description?: string;
  target: number;
  progress?: number;
  current?: number;
  period: 'daily' | 'weekly';
  is_completed?: boolean;
  achieved?: boolean;
}

interface StreakData {
  current_streak: number;
  trophies_earned: number;
}

export default function GoalsClientPage() {
  const { sidebarOpen, toggleSidebar: handleToggleSidebar, closeSidebar: handleCloseSidebar } = useSidebarState();
  const [filterTab, setFilterTab] = useState<'todo' | 'completed' | 'all'>('todo');

  // Query goals (returns system activity goals)
  const { data, isLoading, error } = useQuery<any>({
    queryKey: ['goals'],
    queryFn: () => apiGet<any>(ENDPOINTS.GOALS),
  });

  // Query streak for summary
  const { data: streakData } = useQuery<StreakData>({
    queryKey: ['streak'],
    queryFn: () => apiGet<StreakData>(ENDPOINTS.STREAK),
  });

  const goals: Goal[] = useMemo(() => {
    if (!data) return [];
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.goals)) return data.goals;
    return [];
  }, [data]);

  const summary = useMemo(() => {
    return {
      active: goals.filter(g => !(g.is_completed ?? g.achieved ?? ((g.progress ?? g.current ?? 0) >= g.target))).length,
      completed: goals.filter(g => g.is_completed ?? g.achieved ?? ((g.progress ?? g.current ?? 0) >= g.target)).length,
      streak: streakData?.current_streak || 0
    };
  }, [goals, streakData]);

  const filteredGoals = useMemo(() => {
    return goals.filter((goal) => {
      const current = goal.progress ?? goal.current ?? 0;
      const isDone = goal.is_completed ?? goal.achieved ?? (current >= goal.target);
      if (filterTab === 'todo') return !isDone;
      if (filterTab === 'completed') return isDone;
      return true;
    });
  }, [goals, filterTab]);

  const getIcon = (type: string) => {
    switch (type) {
      case 'grammar':
        return <Type size={20} />;
      case 'vocabulary':
      case 'vocab_practice':
        return <BookOpen size={20} />;
      case 'listening':
        return <Headphones size={20} />;
      case 'reading':
        return <BookOpen size={20} />;
      case 'flashcards':
        return <Sparkles size={20} />;
      case 'simulations':
      case 'weekly_simulations':
        return <Award size={20} />;
      case 'games':
        return <Gamepad2 size={20} />;
      case 'daily_messages':
        return <MessageSquare size={20} />;
      case 'weekly_streak':
        return <Flame size={20} />;
      case 'daily_minutes':
        return <Clock size={20} />;
      case 'weekly_conversations':
        return <Users size={20} />;
      default:
        return <GoalIcon className="w-5 h-5 text-primary" />;
    }
  };

  const getGoalTitle = (goal: Goal) => {
    if (goal.title) return goal.title;
    switch (goal.type) {
      case 'grammar': return 'Grammar Practice';
      case 'vocabulary': return 'Vocabulary Expansion';
      case 'listening': return 'Listening & Podcasts';
      case 'reading': return 'Reading Comprehension';
      case 'flashcards': return 'Flashcards Mastery';
      case 'simulations': return 'Real-World Simulations';
      case 'games': return 'Learning Games';
      case 'daily_messages': return 'Daily AI Conversation';
      case 'weekly_streak': return 'Weekly Consistency';
      default: return goal.type;
    }
  };

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg p-4 text-center">
      <h1 className="text-xl font-bold text-danger mb-2">Error loading goals</h1>
      <Button onClick={() => window.location.reload()}>Try again</Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-bg flex flex-col md:flex-row overflow-x-hidden">
      <SidebarActivities isOpen={sidebarOpen} onClose={handleCloseSidebar} />

      <div className={cn("flex-1 flex flex-col min-w-0 transition-all duration-300", sidebarOpen ? "md:ml-[280px]" : "md:ml-0")}>
        <MainHeader onToggleMenu={handleToggleSidebar} />

        <main className="flex-1 p-4 md:p-8">
          {isLoading ? (
            <div className="flex min-h-[50vh] items-center justify-center">
              <Spinner size="lg" />
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
              {/* Hero */}
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                  <GoalIcon className="w-7 h-7" />
                </div>
                <div>
                  <h1 className="text-2xl md:text-3xl font-display font-bold text-text">
                    My Study Goals
                  </h1>
                  <p className="text-text-muted text-sm md:text-base">
                    Track your learning objectives and activity progress automatically
                  </p>
                </div>
              </div>

              {/* Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <SummaryCard
                  label="To Do"
                  value={summary.active}
                  icon={<GoalIcon className="w-6 h-6" />}
                  color="bg-primary/10"
                />
                <SummaryCard
                  label="Completed"
                  value={summary.completed}
                  icon={<CheckCircle2 className="text-success" size={24} />}
                  color="bg-success/10"
                />
                <SummaryCard
                  label="Current Streak"
                  value={`${summary.streak} days`}
                  icon={<Flame className="text-orange-500" size={24} fill="currentColor" />}
                  color="bg-orange-500/10"
                />
              </div>

              {/* Filter Tabs & Section Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-border pb-4">
                <div>
                  <h2 className="text-xl font-bold text-text">Activity Goals</h2>
                  <p className="text-xs text-text-muted mt-0.5">Completed activities, simulations and practice sessions automatically update your goals.</p>
                </div>

                {/* Filter Tabs: To Do vs Completed vs All */}
                <div className="flex gap-1.5 p-1 bg-surface border border-border rounded-2xl shrink-0">
                  <button
                    onClick={() => setFilterTab('todo')}
                    className={cn(
                      "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
                      filterTab === 'todo'
                        ? "bg-primary text-white shadow-glow"
                        : "text-text-muted hover:text-text hover:bg-surface-hover"
                    )}
                  >
                    <GoalIcon className="w-4 h-4" inverted={filterTab === 'todo'} />
                    <span>To Do ({summary.active})</span>
                  </button>

                  <button
                    onClick={() => setFilterTab('completed')}
                    className={cn(
                      "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
                      filterTab === 'completed'
                        ? "bg-success text-white shadow-glow"
                        : "text-text-muted hover:text-text hover:bg-surface-hover"
                    )}
                  >
                    <CheckCircle2 size={15} />
                    <span>Completed ({summary.completed})</span>
                  </button>

                  <button
                    onClick={() => setFilterTab('all')}
                    className={cn(
                      "flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer",
                      filterTab === 'all'
                        ? "bg-bg-secondary text-text font-black border border-border"
                        : "text-text-muted hover:text-text hover:bg-surface-hover"
                    )}
                  >
                    <ListFilter size={15} />
                    <span>All ({goals.length})</span>
                  </button>
                </div>
              </div>

              {/* List */}
              <div className="grid gap-4 pb-20 md:pb-8">
                <AnimatePresence mode="popLayout">
                  {filteredGoals.length > 0 ? (
                    filteredGoals.map((goal) => {
                      const current = goal.progress ?? goal.current ?? 0;
                      const isDone = goal.is_completed ?? goal.achieved ?? (current >= goal.target);
                      const percentage = Math.min(100, Math.round((current / (goal.target || 1)) * 100));

                      return (
                        <MotionDiv
                          key={goal.id || goal.type}
                          layout
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, scale: 0.95 }}
                          className={cn(
                            "group p-5 bg-surface border rounded-2xl flex flex-col md:flex-row md:items-center gap-6 transition-all hover:border-primary/30",
                            isDone ? 'border-success/50 bg-success/5' : 'border-border shadow-sm hover:shadow-md'
                          )}
                        >
                          <div className={cn(
                            "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                            isDone ? 'bg-success/20 text-success' : 'bg-primary/10 text-primary'
                          )}>
                            {getIcon(goal.type)}
                          </div>

                          <div className="flex-1 min-w-0 space-y-3">
                            <div className="flex items-center justify-between">
                              <div>
                                <h3 className="font-bold text-text truncate pr-4">
                                  {getGoalTitle(goal)}
                                </h3>
                                {goal.description && (
                                  <p className="text-xs text-text-muted mt-0.5">{goal.description}</p>
                                )}
                              </div>
                              <span className="text-[0.65rem] font-bold uppercase tracking-widest px-2.5 py-1 rounded-full bg-surface-hover border border-border text-text-muted whitespace-nowrap">
                                {goal.period === 'daily' ? 'Daily' : 'Weekly'}
                              </span>
                            </div>

                            <div className="space-y-2">
                              <div className="h-2 bg-bg-secondary rounded-full overflow-hidden">
                                <MotionDiv
                                  initial={{ width: 0 }}
                                  animate={{ width: `${percentage}%` }}
                                  className={cn(
                                    "h-full rounded-full transition-all duration-1000",
                                    isDone ? 'bg-success' : 'bg-primary shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)]'
                                  )}
                                />
                              </div>
                              <div className="flex justify-between text-xs font-medium">
                                <span className="text-text">
                                  <span className={isDone ? 'text-success font-bold' : 'text-primary'}>
                                    {current}
                                  </span> / {goal.target}
                                </span>
                                <span className="text-text-muted">
                                  {percentage}%
                                </span>
                              </div>
                            </div>
                          </div>

                          <div className="flex items-center justify-end">
                            {isDone && (
                              <div className="flex items-center gap-1.5 text-success text-xs font-bold uppercase tracking-wider bg-success/10 px-3 py-1.5 rounded-xl border border-success/20">
                                <CheckCircle2 size={14} />
                                <span>Completed</span>
                              </div>
                            )}
                          </div>
                        </MotionDiv>
                      );
                    })
                  ) : (
                    <div className="text-center py-16 bg-surface/50 border border-dashed border-border rounded-3xl space-y-4">
                      <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary">
                        <GoalIcon className="w-8 h-8 text-primary" size={32} />
                      </div>
                      <p className="text-text-muted">
                        {filterTab === 'completed'
                          ? 'No completed goals yet. Complete system activities to see them here!'
                          : 'No goals found in this view.'}
                      </p>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon, color }: { label: string; value: string | number; icon: React.ReactNode; color: string }) {
  return (
    <div className="p-5 bg-surface border border-border rounded-2xl flex items-center gap-4 transition-all hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-1">
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${color}`}>
        {icon}
      </div>
      <div>
        <p className="text-[0.7rem] font-bold text-text-muted uppercase tracking-wider mb-0.5 leading-none">{label}</p>
        <p className="text-xl font-display font-bold text-text">{value}</p>
      </div>
    </div>
  );
}
