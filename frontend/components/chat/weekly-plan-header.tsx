'use client';

import { CheckCircle2, Circle, Sparkles, Target, Play, Podcast, LayoutGrid } from 'lucide-react';
import { cn } from '@/lib/utils';
import { motion, AnimatePresence } from 'framer-motion';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

interface WeeklyTopic {
  id: string;
  title: string;
  description?: string;
  status: 'pending' | 'completed';
  redirect_url?: string;
}

interface WeeklyPlanHeaderProps {
  topics: WeeklyTopic[];
}

export function WeeklyPlanHeader({ topics }: WeeklyPlanHeaderProps) {
  const router = useRouter();
  const [activeCategory, setActiveCategory] = useState<string>('all');
  
  if (!topics || topics.length === 0) return null;

  const CATEGORIES = [
    { id: 'all', label: 'All', icon: <LayoutGrid size={14} /> },
    { id: 'aiex', label: 'AI', icon: <Sparkles size={14} />, prefix: 'aiex-' },
    { id: 'sim', label: 'Sims', icon: <Play size={14} />, prefix: 'sim-' },
    { id: 'pod', label: 'Listen', icon: <Podcast size={14} />, prefix: 'pod-' },
  ];

  const filteredTopics = activeCategory === 'all' 
    ? topics 
    : topics.filter(t => {
        const cat = CATEGORIES.find(c => c.id === activeCategory);
        return cat?.prefix ? t.id.startsWith(cat.prefix) : true;
      });

  const completedCount = topics.filter(t => t.status === 'completed').length;
  const progressPercent = (completedCount / topics.length) * 100;

  return (
    <div className="bg-surface/40 backdrop-blur-md border border-border/50 rounded-[2rem] p-4 md:p-6 mb-8 animate-in fade-in slide-in-from-top-4 duration-500 shadow-sm">
      <div className="flex flex-col lg:flex-row lg:items-center gap-6">
        <div className="flex items-center gap-4 shrink-0">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-inner">
            <Target size={24} />
          </div>
          <div>
            <h4 className="text-[0.7rem] font-black uppercase tracking-widest text-text-subtle mb-1">
              {'Weekly Goal'}
            </h4>
            <div className="flex items-center gap-3">
              <div className="h-2 w-32 bg-bg-secondary rounded-full overflow-hidden border border-border/20">
                <motion.div 
                  initial={{ width: 0 }}
                  animate={{ width: `${progressPercent}%` }}
                  className="h-full bg-gradient-to-r from-primary to-accent"
                />
              </div>
              <span className="text-[0.8rem] font-black text-primary">
                {Math.round(progressPercent)}%
              </span>
            </div>
          </div>
        </div>

        <div className="h-px lg:h-12 lg:w-px bg-border/50" />

        <div className="flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            {CATEGORIES.map(cat => {
              const count = cat.id === 'all' 
                ? topics.length 
                : topics.filter(t => t.id.startsWith(cat.prefix!)).length;
              
              if (count === 0 && cat.id !== 'all') return null;

              return (
                <button
                  key={cat.id}
                  onClick={() => setActiveCategory(cat.id)}
                  className={cn(
                    "flex items-center gap-2 px-3 py-1.5 rounded-xl text-[0.7rem] font-bold transition-all border shrink-0",
                    activeCategory === cat.id 
                      ? "bg-primary text-white border-primary shadow-md" 
                      : "bg-surface/60 text-text-muted border-border hover:border-primary/20"
                  )}
                >
                  {cat.icon}
                  {cat.label}
                  <span className={cn(
                    "ml-1 opacity-60 text-[0.6rem]",
                    activeCategory === cat.id ? "text-white" : "text-primary"
                  )}>
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap gap-2">
            <AnimatePresence mode="popLayout">
              {filteredTopics.slice(0, 12).map((topic) => (
                <motion.div 
                  key={topic.id}
                  layout
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className={cn(
                    "group relative flex items-center gap-2 px-3 py-1.5 rounded-full border transition-all duration-300",
                    topic.status === 'completed' 
                      ? "bg-success/5 border-success/30 text-success" 
                      : "bg-bg-secondary/40 border-border text-text-muted hover:border-primary/30 cursor-pointer active:scale-95"
                  )}
                  onClick={() => topic.redirect_url && router.push(topic.redirect_url)}
                >
                  {topic.status === 'completed' ? (
                    <CheckCircle2 size={13} className="text-success" />
                  ) : (
                    <Circle size={13} className="opacity-40" />
                  )}
                  <span className="text-[0.68rem] font-bold whitespace-nowrap">
                    {topic.title}
                  </span>

                  {/* Tooltip on hover */}
                  <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-48 p-2.5 bg-surface border border-border text-text text-[0.65rem] rounded-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-all z-50 shadow-2xl translate-y-1 group-hover:translate-y-0">
                    <p className="font-black mb-1 uppercase tracking-tighter text-primary">
                      {topic.title}
                    </p>
                    <p className="opacity-80 leading-relaxed italic">
                      {topic.description || 'Complete this task to reach your goal.'}
                    </p>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-border" />
                    <div className="absolute top-[calc(100%-1px)] left-1/2 -translate-x-1/2 border-8 border-transparent border-t-surface" />
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
            
            {filteredTopics.length > 12 && (
              <div className="flex items-center px-3 py-1.5 rounded-full bg-bg-secondary/20 border border-border text-text-subtle text-[0.6rem] font-bold">
                +{filteredTopics.length - 12} more
              </div>
            )}
            
            {filteredTopics.length === 0 && (
              <div className="text-[0.7rem] text-text-muted italic py-1">
                No items in this category yet.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
