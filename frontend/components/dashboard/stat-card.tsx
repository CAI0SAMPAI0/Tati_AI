'use client';

import { cn } from '@/lib/utils';

interface StatCardProps {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  trend?: string;
  trendUp?: boolean;
  highlight?: boolean;
}

export function StatCard({ icon, value, label, trend, trendUp, highlight }: StatCardProps) {
  return (
    <div className={cn(
      "bg-surface border border-border p-5 rounded-2xl flex items-center gap-4 transition-all hover:border-primary/40",
      highlight && "bg-primary/5 border-primary/30 ring-1 ring-primary/20"
    )}>
      <div className={cn(
        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
        highlight ? "bg-primary text-white" : "bg-primary/10 text-primary"
      )}>
        {icon}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-2xl font-bold text-text truncate leading-none mb-1">
          {value}
        </div>
        <div className="text-[0.7rem] font-bold text-text-subtle uppercase tracking-wider">
          {label}
        </div>
      </div>
      {trend && (
        <div className={cn(
          "text-[0.65rem] font-bold px-2 py-1 rounded-full border",
          trendUp ? "bg-success/10 text-success border-success/20" : "bg-text-muted/10 text-text-muted border-border"
        )}>
          {trend}
        </div>
      )}
    </div>
  );
}
