'use client';

import { 
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer 
} from 'recharts';

const COLORS = ['#7c3aed', '#a855f7', '#c084fc', '#34d399', '#f59e0b'];

interface LevelDistributionChartProps {
  data: Array<{ name: string; label: string; value: number; percentage: number }>;
  onSliceClick: (name: string | null) => void;
}

export default function LevelDistributionChart({ data, onSliceClick }: LevelDistributionChartProps) {
  return (
    <div className="h-[300px] w-full relative">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            innerRadius={70}
            outerRadius={95}
            paddingAngle={8}
            dataKey="value"
            onClick={(data) => onSliceClick(data.name || null)}
            cursor="pointer"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="transparent" className="hover:opacity-80 transition-opacity outline-none" />
            ))}
          </Pie>
          <Tooltip 
            formatter={(value, name, props) => [`${value} (${props.payload.percentage}%)`, name]}
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: '16px', boxShadow: 'var(--shadow-lg)' }}
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
