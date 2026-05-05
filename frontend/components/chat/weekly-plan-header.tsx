'use client';

import { CheckCircle2, Circle, Sparkles, Target } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';

interface WeeklyTopic {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'completed';
}

interface WeeklyPlanHeaderProps {
  topics: WeeklyTopic[];
}

export function WeeklyPlanHeader({ topics }: WeeklyPlanHeaderProps) {
  
  
  if (!topics || topics.length === 0) return null;

  const completedCount = topics.filter(t => t.status === 'completed').length;
  const progressPercent = (completedCount / topics.length) * 100;

  return (
    <div className="px-4 py-3 bg-surface/50 backdrop-blur-md border-b border-border animate-in fade-in slide-in-from-top-4 duration-500">
      <div className="max-w-4xl mx-auto flex flex-col md:flex-row items-center gap-4 md:gap-8">
        <div className="flex items-center gap-3 shrink-0">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
            <Target size={20} />
          </div>
          <div>
            <h4 className="text-[0.65rem] font-black uppercase tracking-widest text-text-subtle">
              {'Weekly Goal'}
            </h4>
            <div className="flex items-center gap-2">
              <div className="h-1.5 w-24 bg-bg-secondary rounded-full overflow-hidden">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  className="h-full bg-primary"
                />
              </div>
              <span className="text-[0.6rem] font-bold text-primary">
                {completedCount}/{topics.length}
              </span>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap justify-center md:justify-start gap-2 flex-1">
          {topics.map((topic) => (
            <div 
              key={topic.id}
              className={cn(
                "group relative flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-300",
                topic.status === 'completed' 
                  ? "bg-success/5 border-success/30 text-success shadow-sm shadow-success/10" 
                  : "bg-bg-secondary border-border text-text-muted hover:border-primary/30"
              )}
            >
              {topic.status === 'completed' ? (
                <CheckCircle2 size={14} className="animate-in zoom-in duration-500" />
              ) : (
                <Circle size={14} className="opacity-50" />
              )}
              <span className="text-[0.7rem] font-bold whitespace-nowrap">
                {topic.title}
              </span>

              {/* Tooltip on hover */}
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2 bg-text text-bg text-[0.6rem] rounded-lg opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50 shadow-xl">
                <p className="font-bold mb-1 uppercase tracking-tighter text-primary-light">
                  {topic.title}
                </p>
                <p className="opacity-80 leading-relaxed italic">
                  {topic.description || 'Practice this topic to complete the goal.'}
                </p>
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-text" />
              </div>
              
              {topic.status === 'completed' && (
                <Sparkles size={10} className="absolute -top-1 -right-1 text-warning animate-pulse" />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
