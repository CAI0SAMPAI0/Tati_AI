'use client';

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Calendar, CheckCircle2, Circle, Target, Sparkles, Podcast, Play, FileText, LayoutGrid, ChevronDown } from 'lucide-react';
import { fetchWeeklyPlan, WeeklyTopic } from '@/lib/api/weekly-plan';
import { apiGet } from '@/lib/api/client';
import { useRouter } from 'next/navigation';

import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';

interface WeeklyPlanData {
  created_at: string;
  topics: WeeklyTopic[];
}

export function WeeklyPlan() {
  const router = useRouter();
  
  const { data: plan, error, isLoading } = useQuery<WeeklyPlanData>({
    queryKey: ['weekly-plan-v2'],
    queryFn: fetchWeeklyPlan,
    staleTime: 5 * 60 * 1000,
  });
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<string>('all');
  const [isCollapsed, setIsCollapsed] = useState(true);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsCollapsed(localStorage.getItem('tati_weekly_goal_collapsed') === 'true');
    }
  }, []);

  const toggleCollapse = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('tati_weekly_goal_collapsed', String(next));
      return next;
    });
  };

  if (error || isLoading || !plan || !plan.topics || plan.topics.length === 0) return null;

  const CATEGORIES = [
    { id: 'all', label: 'All', icon: <LayoutGrid size={12} /> },
    { id: 'quiz', label: 'Quizzes', icon: <FileText size={12} />, prefix: 'quiz-' },
    { id: 'aiex', label: 'AI', icon: <Sparkles size={12} />, prefix: 'aiex-' },
    { id: 'sim', label: 'Sims', icon: <Play size={12} />, prefix: 'sim-' },
    { id: 'pod', label: 'Pods', icon: <Podcast size={12} />, prefix: 'pod-' },
  ];

  const filteredTopics = activeCategory === 'all' 
    ? plan.topics 
    : plan.topics.filter(t => {
        const cat = CATEGORIES.find(c => c.id === activeCategory);
        return cat?.prefix ? t.id.startsWith(cat.prefix) : true;
      });

  const completedCount = plan.topics.filter(t => t.status === 'completed').length;
  const progressPercent = (completedCount / plan.topics.length) * 100;
  const isFullyCompleted = completedCount === plan.topics.length;

  return (
    <div className="mx-3 my-4 p-4 bg-surface border border-border/60 rounded-[1.5rem] shadow-sm hover:shadow-md transition-all duration-300 group/plan">
      <div 
        className="flex items-center justify-between mb-3 cursor-pointer hover:opacity-90 select-none"
        onClick={toggleCollapse}
      >
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
        <div className="flex items-center gap-2">
          <div className="flex flex-col items-end">
            <span className="text-[0.8rem] font-black text-primary leading-none">
              {Math.round(progressPercent)}%
            </span>
            <span className="text-[0.55rem] font-bold text-text-muted uppercase tracking-tighter">
              {completedCount}/{plan.topics.length}
            </span>
          </div>
          <ChevronDown 
            size={16} 
            className={cn("text-text-muted transition-transform duration-300", isCollapsed ? "rotate-0" : "rotate-180")} 
          />
        </div>
      </div>

      {/* Progress Bar */}
      <div className="h-2 bg-bg-secondary rounded-full overflow-hidden mb-4 p-0.5 border border-border/20">
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

      <AnimatePresence initial={false}>
        {!isCollapsed && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            {/* Category Tabs */}
            <div className="flex items-center gap-1 overflow-x-auto pb-3 mb-1 no-scrollbar">
        {CATEGORIES.map(cat => {
          const count = cat.id === 'all' 
            ? plan.topics.length 
            : plan.topics.filter(t => t.id.startsWith(cat.prefix!)).length;
          
          if (count === 0 && cat.id !== 'all') return null;

          return (
            <button
              key={cat.id}
              onClick={() => setActiveCategory(cat.id)}
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-lg text-[0.6rem] font-bold transition-all shrink-0 border",
                activeCategory === cat.id 
                  ? "bg-primary text-white border-primary shadow-sm" 
                  : "bg-surface text-text-muted border-border hover:border-primary/30"
              )}
            >
              {cat.icon}
              {cat.label}
              <span className={cn(
                "ml-1 opacity-60",
                activeCategory === cat.id ? "text-white" : "text-primary"
              )}>
                {count}
              </span>
            </button>
          );
        })}
      </div>

      <div className="space-y-1.5 max-h-[280px] overflow-y-auto pr-1 custom-scrollbar">
        {filteredTopics.map((topic) => (
          <div 
            key={topic.id}
            className={cn(
              "p-2 rounded-xl transition-all duration-200 border border-transparent",
              topic.status === 'completed' ? "bg-success/5" : "hover:bg-primary/5 cursor-pointer"
            )}
            onClick={() => {
              if (topic.redirect_url) {
                router.push(topic.redirect_url);
              } else {
                setExpandedId(expandedId === topic.id ? null : topic.id);
              }
            }}
          >
            <div className="flex items-start gap-2.5">
              <div className="mt-0.5 shrink-0">
                {topic.status === 'completed' ? (
                  <CheckCircle2 size={13} className="text-success animate-in zoom-in" />
                ) : (
                  <Circle size={13} className="text-text-subtle" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "text-[0.72rem] font-bold leading-tight truncate",
                  topic.status === 'completed' ? "text-success/80 line-through decoration-success/30" : "text-text"
                )}>
                  {topic.title}
                </p>
                <AnimatePresence mode="wait">
                  {expandedId === topic.id && (
                    <motion.p 
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="text-[0.65rem] text-text-muted mt-1.5 leading-relaxed italic border-l-2 border-primary/20 pl-2"
                    >
                      {topic.description}
                    </motion.p>
                  )}
                </AnimatePresence>
              </div>
              {!isFullyCompleted && topic.status !== 'completed' && (
                <ChevronRight 
                  size={10} 
                  className={cn("text-text-subtle transition-transform mt-0.5", expandedId === topic.id && "rotate-90")} 
                />
              )}
            </div>
          </div>
        ))}

        {filteredTopics.length === 0 && (
          <div className="py-8 text-center text-text-muted text-[0.65rem]">
            No items in this category.
          </div>
        )}
      </div>

      {isFullyCompleted && (
        <div className="mt-4 p-2 bg-success/10 border border-success/20 rounded-xl flex items-center gap-2 animate-in slide-in-from-bottom-2">
          <Sparkles size={14} className="text-success" />
          <p className="text-[0.65rem] font-bold text-success uppercase tracking-tighter">
            Parabéns! Plano Concluído.
          </p>
        </div>
      )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

