'use client';

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Sparkles, HelpCircle, Drama, Target } from 'lucide-react';
import { apiGet } from '@/lib/api/client';
import { Spinner } from '@/components/ui/spinner';
import { useRouter } from 'next/navigation';

interface WeeklyGoalData {
  quizzes: Array<{ id: string; title: string }>;
  ai_exercises: Array<{ exercise_id: string }>;
  simulations: Array<{ simulation_id: string }>;
}

export function WeeklyGoal() {
  const router = useRouter();
  const { data, isLoading } = useQuery<WeeklyGoalData>({
    queryKey: ['weekly-goal'],
    queryFn: () => apiGet('/activities/weekly-goal'),
  });

  if (isLoading) return <div className="p-8 flex justify-center"><Spinner /></div>;
  if (!data) return null;

  const totalTasks = (data.quizzes?.length || 0) + (data.simulations?.length || 0);

  if (totalTasks === 0) return null;

  return (
    <div className="bg-surface border border-border p-6 rounded-3xl mb-8 animate-in fade-in zoom-in duration-500">
      <div className="flex items-center gap-3 mb-6">
        <div className="p-2 bg-primary/10 text-primary rounded-xl">
          <Target size={24} />
        </div>
        <div>
          <h3 className="text-lg font-black text-text">Weekly Goals</h3>
          <p className="text-xs text-text-muted font-medium uppercase tracking-wider">
            {totalTasks} pending tasks to finish the week
          </p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {data.quizzes.length > 0 && (
          <div onClick={() => router.push('/activities')} className="p-4 bg-bg-secondary rounded-2xl cursor-pointer hover:bg-primary/5 transition-all">
            <HelpCircle className="text-warning mb-2" />
            <p className="text-sm font-bold">{data.quizzes.length} Quizzes</p>
          </div>
        )}

        {data.simulations.length > 0 && (
          <div onClick={() => router.push('/activities')} className="p-4 bg-bg-secondary rounded-2xl cursor-pointer hover:bg-primary/5 transition-all">
            <Drama className="text-success mb-2" />
            <p className="text-sm font-bold">{data.simulations.length} Simulations</p>
          </div>
        )}
      </div>
    </div>
  );
}
