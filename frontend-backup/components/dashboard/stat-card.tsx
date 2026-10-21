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
      "bg-surface border border-border rounded-2xl transition-all hover:border-primary/40",
      "p-4 sm:p-5",
      "flex flex-col justify-between gap-4 h-full w-full min-w-0",
      highlight && "bg-primary/5 border-primary/30 ring-1 ring-primary/20"
    )}>
      {/* Top Row: Icon & Trend Badge */}
      <div className="flex items-center justify-between w-full gap-2 shrink-0">
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center shrink-0",
          highlight ? "bg-primary text-white" : "bg-primary/10 text-primary"
        )}>
          <span className="[&>svg]:w-5 [&>svg]:h-5">
            {icon}
          </span>
        </div>

        {trend && (
          <div className={cn(
            "text-[0.65rem] font-bold px-2.5 py-1 rounded-full border shrink-0",
            trendUp
              ? "bg-success/10 text-success border-success/20"
              : "bg-text-muted/10 text-text-muted border-border"
          )}>
            {trend}
          </div>
        )}
      </div>

      {/* Bottom Section: Value & Label */}
      <div className="min-w-0 flex-1 flex flex-col justify-end mt-2">
        <div className="text-2xl sm:text-3xl font-black text-text leading-none mb-1.5">
          {value}
        </div>
        <div className="text-[0.65rem] sm:text-[0.7rem] font-bold text-text-subtle uppercase tracking-wider leading-tight">
          {label}
        </div>
      </div>
    </div>
  );
}