'use client';

import { useMemo } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, Legend, CartesianGrid } from 'recharts';

interface FluencyEvolutionChartProps {
  pronunciation: Array<{ date: string; score: number }>;
  cefr: Array<{ date: string; level: string; score: number }>;
}

export default function FluencyEvolutionChart({ pronunciation, cefr }: FluencyEvolutionChartProps) {
  const chartData = useMemo(() => {
    const map: Record<string, { name: string; pronunciation?: number; cefr?: number }> = {};

    pronunciation.forEach(p => {
      const parts = p.date.split('-');
      const label = parts.length >= 3 ? `${parts[2]}/${parts[1]}` : p.date;
      map[p.date] = { name: label, pronunciation: p.score };
    });

    cefr.forEach(c => {
      const parts = c.date.split('-');
      const label = parts.length >= 3 ? `${parts[2]}/${parts[1]}` : c.date;
      const existing = map[c.date];
      map[c.date] = {
        name: label,
        pronunciation: existing?.pronunciation,
        cefr: c.score
      };
    });

    return Object.keys(map)
      .sort()
      .map(key => map[key]);
  }, [pronunciation, cefr]);

  return (
    <div className="h-[240px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={chartData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.2} vertical={false} />
          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            fontSize={11}
            tick={{ fill: 'var(--text-subtle)' }}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            fontSize={11}
            tick={{ fill: 'var(--text-subtle)' }}
            domain={[0, 100]}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
            }}
            labelStyle={{ color: 'var(--text)', fontWeight: 'bold' }}
          />
          <Legend
            verticalAlign="top"
            height={36}
            iconType="circle"
            formatter={(value) => <span className="text-xs font-bold text-text-muted capitalize">{value}</span>}
          />
          <Line
            type="monotone"
            dataKey="pronunciation"
            stroke="#10b981"
            strokeWidth={3}
            dot={{ r: 4, strokeWidth: 1 }}
            activeDot={{ r: 6 }}
            name="pronunciation"
          />
          <Line
            type="monotone"
            dataKey="cefr"
            stroke="#7c3aed"
            strokeWidth={3}
            dot={{ r: 4, strokeWidth: 1 }}
            activeDot={{ r: 6 }}
            name="CEFR performance"
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
