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
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="name" axisLine={false} tickLine={false} fontSize={12} tick={{ fill: 'var(--text-subtle)' }} />
          <YAxis axisLine={false} tickLine={false} fontSize={12} tick={{ fill: 'var(--text-subtle)' }} />
          <Tooltip 
            cursor={{ fill: 'rgba(124, 58, 237, 0.1)' }}
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow-lg)' }}
          />
          <Bar dataKey="messages" fill="#7c3aed" radius={[8, 8, 0, 0]} barSize={32} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
