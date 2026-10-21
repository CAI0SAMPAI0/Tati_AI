'use client';

import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer
} from 'recharts';

interface AdminActivityChartProps {
  data: Array<{ name: string; messages: number }>;
}

export default function AdminActivityChart({ data }: AdminActivityChartProps) {
  return (
    <div className="h-[300px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        {/* Calibragem de margens e alinhamento do eixo Y */}
        <BarChart data={data} margin={{ top: 10, right: 4, left: -25, bottom: 0 }}>

          {/* Corrigido: Substituído rgba estático pelo seu token global --border */}
          <CartesianGrid
            strokeDasharray="4 4"
            vertical={false}
            stroke="var(--border)"
          />

          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            fontSize={12}
            fontWeight={500}
            tick={{ fill: 'var(--text-muted)' }}
            dy={8}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            fontSize={12}
            tick={{ fill: 'var(--text-subtle)' }}
          />
          <Tooltip
            cursor={{ fill: 'var(--border)', opacity: 0.2 }}
            contentStyle={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '16px',
              boxShadow: 'var(--shadow-lg)',
              padding: '10px 14px'
            }}
            itemStyle={{ color: 'var(--text)', fontSize: '12px', fontWeight: 'bold' }}
            labelStyle={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '2px' }}
            formatter={(value: any) => [value, 'Messages']}
          />
          <Bar
            dataKey="messages"
            /* Segue a cor primária dinâmica do seu CSS global */
            fill="var(--primary)"
            radius={[8, 8, 0, 0]}
            barSize={32}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
