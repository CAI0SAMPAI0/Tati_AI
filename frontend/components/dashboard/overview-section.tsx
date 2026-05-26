'use client';

import { Users, MessageSquare, Zap, ShoppingBag, ChevronRight } from 'lucide-react';
import { StatCard } from './stat-card';
import { formatTime } from '@/lib/utils';

interface OverviewSectionProps {
  stats: any;
  students: any[];
  difficulties: any;
  onSeeAllStudents: () => void;
}

export function OverviewSection({ stats, students, difficulties, onSeeAllStudents }: OverviewSectionProps) {
  return (
    <div className="space-y-8">
      {/* ── Stat Cards ── */}
      {/*
        ✏️ CORREÇÃO PRINCIPAL:
        - mobile:  2 colunas (grid-cols-2)
        - md:      ainda 2 colunas — sidebar existe aqui e rouba espaço
        - lg:      4 colunas (lg:grid-cols-4) — só quando tem espaço real
        - gap menor no mobile, maior no desktop
      */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 lg:gap-6">
        {/* Tati AI */}
        <StatCard
          icon={<Users size={24} />}
          value={stats?.total_students ?? '—'}
          label="Students (Tati AI)"
          trend="↑ Active"
          trendUp
        />
        <StatCard
          icon={<MessageSquare size={24} />}
          value={stats?.total_messages ?? '—'}
          label="Messages Today"
        />

        {/* Hub */}
        <StatCard
          icon={<ShoppingBag size={24} />}
          value={stats?.total_buyers ?? '—'}
          label="Buyers (Hub)"
          trend="Hub clients"
          trendUp
        />
        <StatCard
          icon={<Zap size={24} />}
          value={stats?.active_today ?? '—'}
          label="Active Today"
          highlight
          trend="Today"
          trendUp
        />
      </div>

      {/* ── Divisor visual entre produtos ── */}
      {/*
        ✏️ empilha no mobile (grid-cols-1), lado a lado no md+
      */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-primary/5 border border-primary/15">
          <Users size={15} className="text-primary shrink-0" />
          <span className="text-xs font-semibold text-primary">
            Tati AI — English learning app (role: student / staff)
          </span>
        </div>
        <div className="flex items-center gap-3 px-4 py-2.5 rounded-xl bg-success/5 border border-success/15">
          <ShoppingBag size={15} className="text-success shrink-0" />
          <span className="text-xs font-semibold text-success">
            Hub Premium — Material store (role: buyer)
          </span>
        </div>
      </div>

      {/* ── Tabelas ── */}
      {/*
        ✏️ empilha no mobile e md (col-1), lado a lado só no lg+
        No range 768–1023px com sidebar, duas colunas de tabela ficam apertadas demais
      */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recent Students */}
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-border flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Users size={16} className="text-primary" />
              <h3 className="font-bold text-text">Recent Students</h3>
              <span className="text-[0.6rem] font-bold px-1.5 py-0.5 rounded-full bg-primary/10 text-primary uppercase tracking-wider">
                Tati AI
              </span>
            </div>
            <button
              onClick={onSeeAllStudents}
              className="text-xs font-bold text-primary hover:underline flex items-center gap-1"
            >
              See all <ChevronRight size={14} />
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead className="bg-bg-secondary/50 text-[0.65rem] font-bold text-text-subtle uppercase tracking-widest">
                <tr>
                  <th className="px-5 py-3">Student</th>
                  <th className="px-5 py-3">Level</th>
                  <th className="px-5 py-3">Last active</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {students?.slice(0, 5).map((s) => (
                  <tr key={s.username} className="hover:bg-bg-secondary/30 transition-colors">
                    <td className="px-5 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-[0.7rem] font-bold text-primary shrink-0">
                          {s.avatar_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={s.avatar_url} alt="" className="w-full h-full rounded-full object-cover" />
                          ) : (s.name || s.username || '?').charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="text-sm font-semibold truncate text-text">{s.name || s.username}</div>
                          <div className="text-[0.65rem] text-text-muted truncate">@{s.username}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-5 py-3">
                      <span className="text-[0.65rem] font-bold px-2 py-0.5 rounded-full bg-surface-hover border border-border text-text-subtle">
                        {s.level || '—'}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-xs text-text-muted">
                      {s.last_active ? formatTime(s.last_active) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Class Difficulty Alerts */}
        <div className="bg-surface border border-border rounded-2xl overflow-hidden">
          <div className="p-5 border-b border-border">
            <h3 className="font-bold text-text">Class Difficulty Alerts</h3>
          </div>
          <div className="max-h-[300px] overflow-y-auto custom-scrollbar">
            <table className="w-full text-left border-collapse">
              <thead className="bg-surface text-[0.65rem] font-bold text-text-subtle uppercase tracking-widest sticky top-0 z-10 border-b border-border shadow-sm">
                <tr>
                  <th className="px-5 py-3">🧑‍🎓 Student</th>
                  <th className="px-5 py-3">⚠️ Spotlight</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {difficulties?.alerts?.length > 0 ? difficulties.alerts.map((a: any) => (
                  <tr key={a.username} className="hover:bg-bg-secondary/30 transition-colors">
                    <td className="px-5 py-3 text-sm font-medium text-text">@{a.username}</td>
                    <td className="px-5 py-3">
                      <span className="text-xs font-medium text-warning">
                        {a.current_difficulty}
                      </span>
                    </td>
                  </tr>
                )) : (
                  <tr>
                    <td colSpan={2} className="px-5 py-10 text-center text-sm text-text-muted">
                      No students with registered difficulties.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}