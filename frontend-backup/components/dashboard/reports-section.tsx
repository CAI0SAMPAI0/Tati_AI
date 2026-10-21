'use client';
import { useState } from 'react';
import dynamic from 'next/dynamic';
import { useQuery } from '@tanstack/react-query';
import { apiGet } from '@/lib/api/client';
import { Spinner } from '@/components/ui/spinner';
import { cn } from '@/lib/utils/index';
import { levelLabel, normalizeLevel } from '@/lib/constants/levels';

const COLORS = ['#7c3aed', '#a855f7', '#c084fc', '#34d399', '#f59e0b'];

const AdminActivityChart = dynamic(() => import('@/components/charts/admin-activity-chart'), {
  ssr: false,
  loading: () => <div className="h-[300px] w-full bg-bg-secondary rounded-2xl animate-pulse" />
});

const LevelDistributionChart = dynamic(() => import('@/components/charts/level-distribution-chart'), {
  ssr: false,
  loading: () => <div className="h-[300px] w-full bg-bg-secondary rounded-2xl animate-pulse" />
});

interface ReportsPayload {
  weekly_activity?: number[];
  level_distribution?: Record<string, number>;
}

export function ReportsSection() {
  
  const [selectedLevel, setSelectedLevel] = useState<string | null>(null);

  const { data: reportData, isLoading } = useQuery<ReportsPayload>({
    queryKey: ['admin-reports-overview'],
    queryFn: () => apiGet<ReportsPayload>('/dashboard/reports/overview'),
  });
  const { data: students } = useQuery<any[]>({
    queryKey: ['admin-students'],
    queryFn: () => apiGet<any[]>('/dashboard/students'),
  });

  if (isLoading) return <div className="py-20 flex justify-center"><Spinner /></div>;

  const weeklyActivity = (reportData?.weekly_activity || [0,0,0,0,0,0,0]).map((val: number, idx: number) => ({
    name: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'][idx] || `D${idx + 1}`,
    messages: val
  }));

  const totalStudents = Object.values(reportData?.level_distribution || {}).reduce((a, b) => a + b, 0);

  const levelDist = Object.entries(reportData?.level_distribution || {}).map(([name, value]) => ({
    name,
    label: levelLabel(name),
    value,
    percentage: totalStudents > 0 ? Math.round((value / totalStudents) * 100) : 0
  })).filter(i => (i.value as number) > 0);

  const filteredStudents = students?.filter(s => normalizeLevel(s.level) === selectedLevel) || [];

  return (
    <div className="space-y-8 animate-fade-in">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Atividade Semanal */}
        <div className="bg-surface border border-border p-6 rounded-3xl shadow-sm">
          <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
            <div className="w-1.5 h-6 bg-primary rounded-full" />
            {'Weekly activity'}
          </h3>
          <div className="h-[300px] w-full">
            <AdminActivityChart data={weeklyActivity} />
          </div>
        </div>

        {/* Distribuição de Níveis */}
        <div className="bg-surface border border-border p-6 rounded-3xl shadow-sm">
          <h3 className="font-bold text-lg mb-6 flex items-center gap-2">
            <div className="w-1.5 h-6 bg-primary rounded-full" />
            {'Level distribution'}
          </h3>
          <div className="h-[300px] w-full relative">
            <LevelDistributionChart data={levelDist} onSliceClick={(name) => setSelectedLevel(name)} />
            <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-3xl font-black text-text">{totalStudents}</span>
                <span className="text-[0.65rem] font-bold text-text-muted uppercase tracking-widest">{'Students'}</span>
            </div>
          </div>
          
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
             {levelDist.map((lv, idx) => (
               <button 
                key={lv.name}
                onClick={() => setSelectedLevel(lv.name)}
                className={cn(
                  "p-2 rounded-xl border transition-all text-left group",
                  selectedLevel === lv.name ? "bg-primary/10 border-primary/40 ring-1 ring-primary/20" : "bg-bg-secondary/50 border-border hover:border-primary/30"
                )}
               >
                  <div className="flex items-center gap-2 mb-1">
                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                    <span className="text-[0.65rem] font-bold text-text-muted uppercase truncate">{lv.label}</span>
                  </div>
                  <div className="flex items-baseline gap-1">
                    <span className="text-sm font-bold text-text">{lv.value}</span>
                    <span className="text-[0.65rem] text-text-subtle">({lv.percentage}%)</span>
                  </div>
               </button>
             ))}
          </div>
        </div>
      </div>

      {/* Alunos por Nível Selecionado */}
      {selectedLevel && (
        <div className="bg-surface border border-border rounded-3xl overflow-hidden shadow-sm animate-fade-in">
           <div className="p-5 border-b border-border flex items-center justify-between bg-bg-secondary/30">
              <h4 className="font-bold text-text flex items-center gap-2">
                 <span className="text-primary">{selectedLevel}</span> — {filteredStudents.length} {'Students'}
              </h4>
              <button 
                onClick={() => setSelectedLevel(null)}
                className="text-xs font-bold text-primary hover:underline"
              >
                {'Close'}
              </button>
           </div>
           <div className="p-2 overflow-x-auto">
              <table className="w-full text-left">
                <thead className="text-[0.6rem] font-bold text-text-muted uppercase tracking-widest border-b border-border">
                  <tr>
                    <th className="px-4 py-3">{'Student'}</th>
                    <th className="px-4 py-3">{'Last active'}</th>
                    <th className="px-4 py-3 text-right">{'Msgs'}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/50 text-xs">
                  {filteredStudents.length > 0 ? filteredStudents.map((s) => (
                    <tr key={s.username} className="hover:bg-bg-secondary/20 transition-colors">
                      <td className="px-4 py-3">
                         <div className="flex items-center gap-2">
                            <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[0.6rem] font-bold text-primary">
                               {s.username.charAt(0).toUpperCase()}
                            </div>
                            <span className="text-xs font-semibold">{s.name || s.username}</span>
                         </div>
                      </td>
                      <td className="px-4 py-3 text-[0.7rem] text-text-muted">{s.last_active?.split('T')[0]}</td>
                      <td className="px-4 py-3 text-right text-xs font-bold">{s.total_messages}</td>
                    </tr>
                  )) : (
                    <tr>
                      <td colSpan={3} className="px-4 py-10 text-center text-xs text-text-muted italic">{'No students found.'}</td>
                    </tr>
                  )}
                </tbody>
              </table>
           </div>
        </div>
      )}
    </div>
  );
}
