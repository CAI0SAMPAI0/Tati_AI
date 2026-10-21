'use client';

import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface ActivityBarChartProps {
  data: Array<{ name: string; messages: number }>;
  barSize?: number;
}

export default function ActivityBarChart({ data, barSize = 28 }: ActivityBarChartProps) {
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        {/* Adicionado margin left negativa para colar os números do eixo Y na esquerda */}
        <BarChart data={data} margin={{ top: 10, right: 4, left: -25, bottom: 0 }}>

          {/* Linhas de Grade Horizontais usando sua borda global */}
          <CartesianGrid
            stroke="var(--border)"
            vertical={false}
            strokeDasharray="4 4"
          />

          <XAxis
            dataKey="name"
            axisLine={false}
            tickLine={false}
            fontSize={11}
            fontWeight={500}
            tick={{ fill: 'var(--text-muted)' }}
            dy={8}
          />
          <YAxis
            axisLine={false}
            tickLine={false}
            fontSize={11}
            tick={{ fill: 'var(--text-subtle)' }}
          />
          <Tooltip
            /* O cursor de seleção agora usa a cor da sua borda global */
            cursor={{ fill: 'var(--border)', opacity: 0.2 }}
            contentStyle={{
              background: 'var(--surface)',
              border: '1px solid var(--border)',
              borderRadius: '12px',
              boxShadow: 'var(--shadow-md)',
              padding: '8px 12px',
            }}
            /* Força a cor do texto de dentro do tooltip a seguir o tema global */
            itemStyle={{ color: 'var(--text)', fontSize: '12px', fontWeight: 'bold' }}
            labelStyle={{ color: 'var(--text-muted)', fontSize: '11px', marginBottom: '2px' }}
            formatter={(value: any) => [value, 'Messages']}
          />
          <Bar
            dataKey="messages"
            /* Segue a cor primária dinâmica do seu CSS global */
            fill="var(--primary)"
            radius={[6, 6, 0, 0]}
            barSize={barSize}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
