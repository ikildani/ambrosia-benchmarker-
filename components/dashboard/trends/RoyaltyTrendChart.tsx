'use client';

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { CHART_COLORS } from '@/lib/chartTheme';

interface RoyaltyTrendChartProps {
  data: Array<{ label: string; royaltyLow: number; royaltyHigh: number }>;
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  const low = payload.find(p => p.name === 'royaltyLow')?.value ?? 0;
  const high = payload.find(p => p.name === 'royaltyHigh')?.value ?? 0;
  return (
    <div className="rounded-lg bg-slate-800 border border-slate-700 px-4 py-3 shadow-xl text-sm">
      <p className="font-medium text-white mb-1">{label}</p>
      <p className="text-slate-300">Royalty range: <span className="font-mono text-white">{low.toFixed(1)}% – {high.toFixed(1)}%</span></p>
    </div>
  );
};

export default function RoyaltyTrendChart({ data }: RoyaltyTrendChartProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">Royalty Rate Trends</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Average low–high royalty band over time</p>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.gridLine} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: CHART_COLORS.axisLabel, fontSize: 11 }} axisLine={{ stroke: CHART_COLORS.axisLine }} tickLine={false} />
          <YAxis tick={{ fill: CHART_COLORS.axisLabel, fontSize: 11 }} axisLine={false} tickLine={false} width={36} tickFormatter={v => `${v}%`} />
          <Tooltip content={<CustomTooltip />} />
          <Area type="monotone" dataKey="royaltyHigh" stroke={CHART_COLORS.teal500} fill={CHART_COLORS.teal500} fillOpacity={0.15} strokeWidth={2} name="royaltyHigh" />
          <Area type="monotone" dataKey="royaltyLow" stroke={CHART_COLORS.cyan500} fill={CHART_COLORS.cyan500} fillOpacity={0.1} strokeWidth={2} name="royaltyLow" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
