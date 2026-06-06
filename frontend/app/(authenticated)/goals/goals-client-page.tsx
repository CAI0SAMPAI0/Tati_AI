'use client';

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useState, useMemo } from 'react';
import { apiGet, apiPost, apiDelete } from '@/lib/api/client';
import { ENDPOINTS } from '@/lib/api/endpoints';
import { MainHeader } from '@/components/layout/main-header';
import { SidebarActivities } from '@/components/activities/sidebar-activities';
import { Spinner } from '@/components/ui/spinner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { WeeklyPlanHeader } from '@/components/chat/weekly-plan-header';
import { fetchWeeklyPlan } from '@/lib/api/weekly-plan';

import { 
  Target, 
  Trash2, 
  Plus, 
  Clock, 
  MessageSquare, 
  Users, 
  Type, 
  CheckCircle2,
  Flame,
  X
} from 'lucide-react';
import toast from 'react-hot-toast';
import { motion, AnimatePresence } from 'framer-motion';
const MotionDiv = motion.div;
interface Goal {
  id: string;
  type: string;
  target: number;
  current: number;
  period: 'daily' | 'weekly';
  created_at: string;
  achieved: boolean;
  achieved_count: number;
}

interface GoalsResponse {
  goals: Goal[];
}

interface StreakData {
  current_streak: number;
  trophies_earned: number;
}

export default function GoalsClientPage() {
  
  const queryClient = useQueryClient();
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [formData, setFormData] = useState({ 
    type: 'daily_minutes', 
    target: 30, 
    period: 'daily' 
  });

  // Query goals
  const { data, isLoading, error } = useQuery<GoalsResponse>({
    queryKey: ['goals'],
    queryFn: () => apiGet<GoalsResponse>(ENDPOINTS.GOALS),
  });

  // Query weekly plan (AI-generated topics)
  const {
    data: weeklyPlan,
    isLoading: weeklyLoading,
    isError: weeklyError,
  } = useQuery({
    queryKey: ['weekly-plan'],
    queryFn: fetchWeeklyPlan,
    staleTime: 5 * 60 * 1000, // 5 min — o plano não muda a cada click
  });

  // Query streak for summary
  const { data: streakData } = useQuery<StreakData>({
    queryKey: ['streak'],
    queryFn: () => apiGet<StreakData>(ENDPOINTS.STREAK),
  });

  const goals = data?.goals || [];

  const summary = useMemo(() => {
    return {
      active: goals.filter(g => !g.achieved).length,
      completed: goals.filter(g => g.achieved).length,
      streak: streakData?.current_streak || 0
    };
  }, [goals, streakData]);

  // Mutations
  const createMutation = useMutation({
    mutationFn: (newGoal: any) => apiPost(ENDPOINTS.GOALS, newGoal),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      setIsModalOpen(false);
      toast.success('Saved successfully!');
    },
    onError: () => toast.error('Error. Please try again.'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => apiDelete(`${ENDPOINTS.GOALS}/${id}`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['goals'] });
      toast.success('Saved successfully!');
    },
  });

  const handleCreateGoal = () => {
    if (formData.target < 1) return;
    createMutation.mutate(formData);
  };

  const getIcon = (type: string) => {
    switch (type) {
      case 'daily_minutes': return <Clock size={20} />;
      case 'daily_messages': return <MessageSquare size={20} />;
      case 'weekly_conversations': return <Users size={20} />;
      case 'weekly_words': return <Type size={20} />;
      default: return <Target size={20} />;
    }
  };

  if (error) return (
    <div className="min-h-screen flex flex-col items-center justify-center bg-bg p-4 text-center">
      <h1 className="text-xl font-bold text-danger mb-2">Error loading goals</h1>
      <Button onClick={() => window.location.reload()}>Try again</Button>
    </div>
  );

  return (
    <div className="min-h-screen bg-bg flex flex-col md:flex-row">
      <SidebarActivities isOpen={sidebarOpen} onClose={() => setSidebarOpen(false)} />

      <div className="flex-1 flex flex-col min-w-0 md:ml-[280px]">
        <MainHeader onToggleMenu={() => setSidebarOpen(true)} />

        <main className="flex-1 p-4 md:p-8">
          {isLoading ? (
            <div className="flex min-h-[50vh] items-center justify-center">
              <Spinner size="lg" />
            </div>
          ) : (
            <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in duration-500">
              {/* Hero */}
              <div className="space-y-1">
                <h1 className="text-2xl md:text-3xl font-display font-bold text-text">
                  🎯 My Study Goals
                </h1>
                <p className="text-text-muted text-sm md:text-base">
                  Set and track your learning goals
                </p>
              </div>

              {/* Weekly AI Plan ─────────────────────────────────────────── */}
              <div>
                <h2 className="text-xl font-bold text-text mb-3">📅 This Week&apos;s Plan</h2>

                {weeklyLoading && (
                  <div className="p-5 bg-surface border border-border rounded-3xl animate-pulse flex gap-4 items-center">
                    <div className="w-10 h-10 rounded-full bg-bg-secondary shrink-0" />
                    <div className="flex-1 space-y-2">
                      <div className="h-3 w-24 bg-bg-secondary rounded" />
                      <div className="h-2 w-16 bg-bg-secondary rounded" />
                    </div>
                    <div className="flex gap-2">
                      {[1, 2, 3].map((i) => (
                        <div key={i} className="h-7 w-28 bg-bg-secondary rounded-full" />
                      ))}
                    </div>
                  </div>
                )}

                {!weeklyLoading && weeklyError && (
                  <div className="p-4 bg-danger/5 border border-danger/20 rounded-2xl text-sm text-danger">
                    Failed to load weekly plan. The backend may be starting up — try refreshing.
                  </div>
                )}

                {!weeklyLoading && !weeklyError && weeklyPlan && weeklyPlan.topics.length > 0 && (
                  <WeeklyPlanHeader topics={weeklyPlan.topics} />
                )}

                {!weeklyLoading && !weeklyError && weeklyPlan && weeklyPlan.topics.length === 0 && (
                  <div className="p-5 bg-surface border border-dashed border-border rounded-3xl text-center text-text-muted text-sm">
                    No weekly plan yet — it will be generated automatically on your next chat session.
                  </div>
                )}
              </div>

              {/* Summary */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <SummaryCard 
                  label="Active Goals" 
                  value={summary.active} 
                  icon={<Target className="text-primary" size={24} />}
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

              {/* Section Header */}
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-bold text-text">My Goals</h2>
                <Button onClick={() => setIsModalOpen(true)} className="gap-2">
                  <Plus size={18} />
                  New Goal
                </Button>
              </div>

              {/* List */}
              <div className="grid gap-4 pb-20 md:pb-8">
                <AnimatePresence mode="popLayout">
                  {goals.length > 0 ? (
                    goals.map((goal) => (
                      <MotionDiv
                        key={goal.id}
                        layout
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95 }}
                        className={`group p-5 bg-surface border rounded-2xl flex flex-col md:flex-row md:items-center gap-6 transition-all hover:border-primary/30 ${goal.achieved ? 'border-success/50 bg-success/5' : 'border-border shadow-sm hover:shadow-md'}`}
                      >
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 ${goal.achieved ? 'bg-success/20 text-success' : 'bg-primary/10 text-primary'}`}>
                          {getIcon(goal.type)}
                        </div>

                        <div className="flex-1 min-w-0 space-y-3">
                          <div className="flex items-center justify-between">
                            <h3 className="font-bold text-text truncate pr-4">
                              {{
                                daily_minutes: 'Minutes per day',
                                daily_messages: 'Messages per day',
                                weekly_conversations: 'Conversations per week',
                                weekly_words: 'New words per week'
                              }[goal.type] || goal.type}
                            </h3>
                            <span className="text-[0.65rem] font-bold uppercase tracking-widest px-2 py-0.5 rounded bg-surface-hover border border-border text-text-muted whitespace-nowrap">
                              {goal.period === 'daily' ? 'Daily' : 'Weekly'}
                            </span>
                          </div>

                          <div className="space-y-2">
                            <div className="h-2 bg-bg-secondary rounded-full overflow-hidden">
                              <MotionDiv 
                                initial={{ width: 0 }}
                                animate={{ width: `${Math.min(100, (goal.current / goal.target) * 100)}%` }}
                                className={`h-full rounded-full transition-all duration-1000 ${goal.achieved ? 'bg-success' : 'bg-primary shadow-[0_0_8px_rgba(var(--primary-rgb),0.5)]'}`}
                              />
                            </div>
                            <div className="flex justify-between text-xs font-medium">
                              <span className="text-text">
                                <span className={goal.achieved ? 'text-success font-bold' : 'text-primary'}>
                                  {goal.current}
                                </span> / {goal.target}
                              </span>
                              <span className="text-text-muted">
                                {Math.round((goal.current / goal.target) * 100)}%
                              </span>
                            </div>
                          </div>
                        </div>

                        <div className="flex items-center justify-end gap-2">
                          {goal.achieved && (
                            <div className="flex items-center gap-1 text-success text-[0.65rem] font-black uppercase tracking-widest mr-2 bg-success/10 px-2 py-1 rounded-md">
                              <CheckCircle2 size={12} />
                              <span>Done</span>
                            </div>
                          )}
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-9 w-9 text-text-subtle hover:text-danger hover:bg-danger/10"
                            onClick={() => {
                              if (confirm('Delete this goal?')) {
                                deleteMutation.mutate(goal.id);
                              }
                            }}
                          >
                            <Trash2 size={18} />
                          </Button>
                        </div>
                      </MotionDiv>
                    ))
                  ) : (
                    <div className="text-center py-16 bg-surface/50 border border-dashed border-border rounded-3xl space-y-4">
                      <div className="w-16 h-16 bg-bg-secondary rounded-full flex items-center justify-center mx-auto text-text-subtle">
                        <Target size={32} />
                      </div>
                      <p className="text-text-muted">{'No goals defined. Create your first goal!'}</p>
                      <Button variant="secondary" onClick={() => setIsModalOpen(true)}>
                        {'New Goal'}
                      </Button>
                    </div>
                  )}
                </AnimatePresence>
              </div>
            </div>
          )}
        </main>
      </div>

      {/* Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <MotionDiv 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-bg/80 backdrop-blur-sm"
            />
            <MotionDiv 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-surface border border-border rounded-3xl shadow-2xl overflow-hidden"
            >
              <div className="p-6 border-b border-border flex items-center justify-between">
                <h3 className="text-lg font-bold text-text">{'New Goal'}</h3>
                <button onClick={() => setIsModalOpen(false)} className="text-text-muted hover:text-text p-1 hover:bg-surface-hover rounded-full transition-colors">
                  <X size={24} />
                </button>
              </div>

              <div className="p-6 space-y-1">
                <Select
                  label={'Goal Type'}
                  value={formData.type}
                  onChange={(e) => setFormData({ ...formData, type: e.target.value })}
                  options={[
                    { value: 'daily_minutes', label: 'Minutes per day' },
                    { value: 'daily_messages', label: 'Messages per day' },
                    { value: 'weekly_conversations', label: 'Conversations per week' },
                    { value: 'weekly_words', label: 'New words per week' },
                  ]}
                />

                <div className="space-y-1.5 mb-4">
                  <label className="block text-[0.73rem] font-semibold text-text-muted uppercase tracking-wider">
                    {'Target (quantity)'}
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={formData.target}
                    onChange={(e) => setFormData({ ...formData, target: parseInt(e.target.value) })}
                    className="mb-0"
                  />
                </div>

                <Select
                  label={'Period'}
                  value={formData.period}
                  onChange={(e) => setFormData({ ...formData, period: e.target.value as 'daily' | 'weekly' })}
                  options={[
                    { value: 'daily', label: 'Daily' },
                    { value: 'weekly', label: 'Weekly' },
                  ]}
                />
              </div>

              <div className="p-6 bg-bg-secondary/50 flex gap-3">
                <Button variant="secondary" className="flex-1" onClick={() => setIsModalOpen(false)}>
                  {'Cancel'}
                </Button>
                <Button className="flex-1" onClick={handleCreateGoal} loading={createMutation.isPending}>
                  {'New Goal'}
                </Button>
              </div>
            </MotionDiv>
          </div>
        )}
      </AnimatePresence>
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
