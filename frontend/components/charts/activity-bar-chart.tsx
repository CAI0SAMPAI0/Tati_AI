'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

interface ActivityBarChartProps {
  data: Array<{ name: string; messages: number }>;
  barSize?: number;
}

export default function ActivityBarChart({ data, barSize = 28 }: ActivityBarChartProps) {
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
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
          />
          <Tooltip
            cursor={{ fill: 'rgba(124, 58, 237, 0.08)' }}
            contentStyle={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
            }}
            formatter={(value: any) => [value, 'Messages']}
          />
          <Bar
            dataKey="messages"
            fill="#7c3aed"
            radius={[6, 6, 0, 0]}
            barSize={barSize}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
