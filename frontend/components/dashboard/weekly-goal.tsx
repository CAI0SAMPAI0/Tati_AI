'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Target,
  CheckCircle2,
  BookOpen,
  Headphones,
  FileText,
  Music,
  Sparkles,
  Award,
  Gamepad2,
  Flame,
  ArrowRight,
} from 'lucide-react';
import { apiGet } from '@/lib/api/client';
import { Spinner } from '@/components/ui/spinner';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

interface CategoryGoal {
  name: string;
  target: number;
  progress: number;
  is_completed: boolean;
}

interface WeeklyGoalData {
  week_start?: string;
  week_key?: string;
  total_categories: number;
  completed_categories: number;
  is_completed: boolean;
  multiplier: number;
  bonus_applied: boolean;
  categories: {
    grammar?: CategoryGoal;
    vocabulary?: CategoryGoal;
    listening?: CategoryGoal;
    reading?: CategoryGoal;
    music?: CategoryGoal;
    flashcards?: CategoryGoal;
    simulations?: CategoryGoal;
    games?: CategoryGoal;
  };
}

const CATEGORY_ICONS: Record<string, React.ReactNode> = {
  grammar: <BookOpen size={16} />,
  vocabulary: <Sparkles size={16} />,
  listening: <Headphones size={16} />,
  reading: <FileText size={16} />,
  music: <Music size={16} />,
  flashcards: <Sparkles size={16} />,
  simulations: <Award size={16} />,
  games: <Gamepad2 size={16} />,
};

const CATEGORY_TABS: Record<string, string> = {
  grammar: 'grammar',
  vocabulary: 'vocabulary',
  listening: 'listenings',
  reading: 'reading',
  music: 'musics',
  flashcards: 'flashcards',
  simulations: 'simulations',
  games: 'games',
};

export function WeeklyGoal() {
  const router = useRouter();
  const { data, isLoading } = useQuery<WeeklyGoalData>({
    queryKey: ['weekly-goal'],
    queryFn: () => apiGet('/activities/weekly-goal'),
  });

  if (isLoading) {
    return (
      <div className="p-8 flex justify-center">
        <Spinner />
      </div>
    );
  }

  if (!data) return null;

  const total = data.total_categories || 8;
  const completed = data.completed_categories || 0;
  const isDone = data.is_completed || completed >= total;
  const percentage = Math.min(100, Math.round((completed / total) * 100));

  const categories = Object.entries(data.categories || {});

  return (
    <div className="bg-surface border border-border p-6 rounded-3xl mb-8 animate-in fade-in zoom-in duration-500 shadow-sm hover:shadow-md transition-shadow">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-primary/10 text-primary rounded-2xl border border-primary/20">
            <Target size={24} />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <h3 className="text-lg font-black text-text">Objetivo da Semana</h3>
              {isDone ? (
                <span className="flex items-center gap-1 text-[0.68rem] font-bold uppercase tracking-wider bg-success/15 text-success px-2.5 py-0.5 rounded-full border border-success/30">
                  <CheckCircle2 size={12} />
                  Concluído
                </span>
              ) : (
                <span className="text-[0.68rem] font-bold uppercase tracking-wider bg-primary/10 text-primary px-2.5 py-0.5 rounded-full border border-primary/20">
                  {completed}/{total} Categorias
                </span>
              )}
            </div>
            <p className="text-xs text-text-muted font-medium mt-0.5">
              Complete pelo menos 1 atividade de cada uma das 8 categorias obrigatórias
            </p>
          </div>
        </div>

        {/* Bonus Badge */}
        {isDone ? (
          <div className="flex items-center gap-2 px-3 py-1.5 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-500 text-xs font-bold shrink-0 animate-pulse">
            <Flame size={16} className="fill-amber-500" />
            <span>🔥 Multiplicador 2x XP Ativo!</span>
          </div>
        ) : (
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-2xl bg-bg-secondary border border-border text-text-muted text-xs font-medium shrink-0">
            <Flame size={15} className="text-orange-400" />
            <span>Conclua todas para desbloquear 2x XP</span>
          </div>
        )}
      </div>

      {/* Progress Bar */}
      <div className="mb-6 space-y-1.5">
        <div className="h-2.5 bg-bg-secondary rounded-full overflow-hidden">
          <div
            style={{ width: `${percentage}%` }}
            className={cn(
              "h-full rounded-full transition-all duration-1000",
              isDone ? "bg-success shadow-[0_0_10px_rgba(34,197,94,0.5)]" : "bg-primary shadow-[0_0_8px_rgba(var(--primary-rgb),0.4)]"
            )}
          />
        </div>
        <div className="flex justify-between text-xs text-text-muted font-medium">
          <span>{completed} de {total} categorias concluídas</span>
          <span>{percentage}%</span>
        </div>
      </div>

      {/* 8 Categories Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {categories.map(([key, cat]) => {
          const isCatDone = cat.is_completed || cat.progress >= cat.target;
          return (
            <div
              key={key}
              onClick={() => {
                const tab = CATEGORY_TABS[key] || 'grammar';
                try {
                  localStorage.setItem('tati_last_activity_tab', tab);
                } catch (_) {}
                router.push('/activities');
              }}
              className={cn(
                "p-3 rounded-2xl border transition-all cursor-pointer flex flex-col justify-between group",
                isCatDone
                  ? "bg-success/5 border-success/30 hover:border-success/60 text-text"
                  : "bg-bg-secondary/60 border-border hover:border-primary/40 hover:bg-primary/5 text-text"
              )}
            >
              <div className="flex items-center justify-between mb-2">
                <div className={cn(
                  "p-1.5 rounded-xl",
                  isCatDone ? "bg-success/20 text-success" : "bg-primary/10 text-primary group-hover:scale-110 transition-transform"
                )}>
                  {CATEGORY_ICONS[key] || <BookOpen size={16} />}
                </div>
                {isCatDone ? (
                  <CheckCircle2 size={16} className="text-success shrink-0" />
                ) : (
                  <span className="text-[0.65rem] font-mono font-bold text-text-muted">0/1</span>
                )}
              </div>
              <div>
                <p className="text-xs font-bold truncate">{cat.name || key}</p>
                <p className={cn(
                  "text-[0.65rem] font-medium truncate mt-0.5",
                  isCatDone ? "text-success font-semibold" : "text-text-muted"
                )}>
                  {isCatDone ? "Concluído" : "Pendente"}
                </p>
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-4 pt-4 border-t border-border/50 flex justify-end">
        <button
          onClick={() => router.push('/goals')}
          className="flex items-center gap-1.5 text-xs font-bold text-primary hover:underline cursor-pointer"
        >
          <span>Ver todas as metas</span>
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}
