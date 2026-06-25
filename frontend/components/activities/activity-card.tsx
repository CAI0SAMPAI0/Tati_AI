'use client';

import React from 'react';
import { Play, CheckCircle2, CircleHelp, Headphones, FileText } from 'lucide-react';
import { cn } from '@/lib/utils';

const statusConfig = {
  new: { label: 'New', className: 'bg-primary/15 text-primary border-primary/30' },
  done: { label: 'Completed', className: 'bg-success/15 text-success border-success/30' },
  corrected: { label: 'Corrected', className: 'bg-info/15 text-info border-info/30' },
  pending: { label: 'Pending', className: 'bg-warning/15 text-warning border-warning/30' },
} as const;

const typeIcons = {
  quiz: <CircleHelp size={18} />,
  flashcard: <Play size={18} />,
  exercise: <FileText size={18} />,
  simulation: <Play size={18} />,
  podcast: <Headphones size={18} />,
} as const;

interface ActivityCardProps {
  title: string;
  description: string;
  type: 'quiz' | 'flashcard' | 'exercise' | 'simulation' | 'podcast';
  status?: 'new' | 'done' | 'corrected' | 'pending';
  meta?: Array<{ icon: React.ReactNode; label: string }>;
  onClick?: () => void;
  imageUrl?: string;
  emoji?: string;
  actionLabel?: string;
  isOutline?: boolean;
  score?: number;
}

export const ActivityCard = React.memo(function ActivityCard({
  title,
  description,
  type,
  status,
  meta,
  onClick,
  imageUrl,
  emoji,
  actionLabel,
  isOutline,
  score
}: ActivityCardProps) {

  return (
    <article 
      onClick={onClick}
      className="group bg-surface border border-border rounded-xl p-4 flex flex-col gap-3 hover:border-primary/50 transition-all cursor-pointer hover:-translate-y-1"
    >
      {imageUrl && (
        <div className="relative aspect-video rounded-lg overflow-hidden bg-bg-secondary mb-1">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={imageUrl} alt={title} className="w-full h-full object-cover transition-transform group-hover:scale-105" />
          <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
            <div className="w-12 h-12 rounded-full bg-primary text-white flex items-center justify-center shadow-glow">
              <Play fill="currentColor" size={24} className="ml-1" />
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-col gap-1.5">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-sm font-bold text-text leading-tight group-hover:text-primary transition-colors">
            {title}
          </h3>
          {status && (
            <div className="flex items-center gap-2">
              {score !== undefined && (
                <span className="text-[0.65rem] font-black text-primary bg-primary/10 px-1.5 py-0.5 rounded-lg shrink-0">
                  {score}/100
                </span>
              )}
              <span className={cn(
                "text-[0.65rem] font-bold px-2 py-0.5 rounded-full border shrink-0 uppercase tracking-wider",
                statusConfig[status].className
              )}>
                {statusConfig[status].label}
              </span>
            </div>
          )}
        </div>
        {emoji && (
          <div className="text-4xl py-1 animate-in zoom-in-50 duration-500 drop-shadow-sm">
            {emoji}
          </div>
        )}
      </div>

      <p className="text-[0.8rem] text-text-muted line-clamp-2 leading-relaxed">
        {description}
      </p>

      {meta && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-auto">
          {meta.map((item, idx) => (
            <div key={idx} className="flex items-center gap-1.5 text-[0.7rem] text-text-subtle font-medium">
              <span className="text-text-muted">{item.icon}</span>
              <span>{item.label}</span>
            </div>
          ))}
        </div>
      )}

      <button className={cn(
        "mt-2 w-full flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all",
        isOutline 
          ? "bg-transparent border border-border text-text-muted hover:bg-primary/10 hover:text-primary hover:border-primary/50"
          : "bg-primary text-white hover:bg-primary-hover shadow-sm"
      )}>
        <Play size={14} fill={isOutline ? "none" : "currentColor"} />
        {actionLabel || (status === 'done' ? 'Redo' : 'Start')}
      </button>
    </article>
  );
});
