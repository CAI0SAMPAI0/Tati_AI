'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Calendar, CheckCircle2, Circle, Target, Sparkles } from 'lucide-react';
import { apiGet } from '@/lib/api/client';

import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface WeeklyTopic {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'completed';
}

interface WeeklyPlanData {
  created_at: string;
  topics: WeeklyTopic[];
}

export function WeeklyPlan() {
  
  const { data: plan, error, isLoading } = useQuery<WeeklyPlanData>({
    queryKey: ['weekly-plan'],
    queryFn: () => apiGet<WeeklyPlanData>('/users/progress/weekly-plan'),
    refetchInterval: 60000,
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (error || isLoading || !plan || !plan.topics || plan.topics.length === 0) return null;

  const completedCount = plan.topics.filter(t => t.status === 'completed').length;
  const progressPercent = (completedCount / plan.topics.length) * 100;
  const isFullyCompleted = completedCount === plan.topics.length;

  return (
    <div className="mx-3 my-4 p-4 bg-surface border border-border/60 rounded-[1.5rem] shadow-sm hover:shadow-md transition-all duration-300 group/plan">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2.5">
          <div className="p-2 bg-primary/10 rounded-xl text-primary group-hover/plan:scale-110 transition-transform">
            <Target size={16} />
          </div>
          <div>
            <p className="text-[0.72rem] font-black text-text/80 uppercase tracking-[0.05em]">
              Weekly Goal
            </p>
            <p className="text-[0.6rem] font-medium text-text-muted">Your focus for today</p>
          </div>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-[0.8rem] font-black text-primary leading-none">
            {Math.round(progressPercent)}%
          </span>
          <span className="text-[0.55rem] font-bold text-text-muted uppercase tracking-tighter">
            {completedCount}/{plan.topics.length} Done
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-bg-secondary rounded-full overflow-hidden mb-5 p-0.5 border border-border/20">
        <motion.div 
          initial={{ width: 0 }}
          animate={{ width: `${progressPercent}%` }}
          className={cn(
            "h-full rounded-full transition-all duration-1000",
            isFullyCompleted 
              ? "bg-gradient-to-r from-success to-emerald-400" 
              : "bg-gradient-to-r from-primary to-accent"
          )}
        />
      </div>

      <div className="space-y-2">
        {plan.topics.map((topic) => (
          <div 
            key={topic.id}
            className={cn(
              "p-2 rounded-xl transition-all duration-200 border border-transparent",
              topic.status === 'completed' ? "bg-success/5" : "hover:bg-primary/5 cursor-pointer"
            )}
            onClick={() => setExpandedId(expandedId === topic.id ? null : topic.id)}
          >
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 shrink-0">
                {topic.status === 'completed' ? (
                  <CheckCircle2 size={14} className="text-success animate-in zoom-in" />
                ) : (
                  <Circle size={14} className="text-text-subtle" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-[0.75rem] font-bold leading-tight",
                  topic.status === 'completed' ? "text-success/80 line-through decoration-success/30" : "text-text"
                )}>
                  {topic.title}
                </p>
                <AnimatePresence>
                  {expandedId === topic.id && (
                    <motion.p 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="text-[0.68rem] text-text-muted mt-1.5 leading-relaxed italic border-l-2 border-primary/20 pl-2"
                    >
                      {topic.description}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
              {!isFullyCompleted && topic.status !== 'completed' && (
                <ChevronRight 
                  size={12} 
                  className={cn("text-text-subtle transition-transform mt-0.5", expandedId === topic.id && "rotate-90")} 
                />
              )}
            </div>
          </div>
        ))}
      </div>

      {isFullyCompleted && (
        <div className="mt-4 p-2 bg-success/10 border border-success/20 rounded-xl flex items-center gap-2 animate-in slide-in-from-bottom-2">
          <Sparkles size={14} className="text-success" />
          <p className="text-[0.65rem] font-bold text-success uppercase tracking-tighter">
            Parabéns! Plano Concluído.
          </p>
        </div>
      )}
    </div>
  );
}

