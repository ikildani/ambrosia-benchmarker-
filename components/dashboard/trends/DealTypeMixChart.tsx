'use client';

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { CHART_COLORS, SERIES_COLORS } from '@/lib/chartTheme';

interface DealTypeMixChartProps {
  data: Array<{ label: string; [dealType: string]: string | number }>;
}

const DEAL_TYPE_LABELS: Record<string, string> = {
  license: 'License', acquisition: 'Acquisition', collaboration: 'Collaboration',
  co_development: 'Co-Development', option: 'Option', other: 'Other',
};

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-slate-800 border border-slate-700 px-4 py-3 shadow-xl text-sm">
      <p className="font-medium text-white mb-2">{label}</p>
      {payload.filter(p => p.value > 0).map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-slate-300">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
          <span className="flex-1">{DEAL_TYPE_LABELS[p.name] || p.name}</span>
          <span className="font-mono font-medium text-white">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

const DEAL_TYPES = ['license', 'acquisition', 'collaboration', 'co_development', 'option', 'other'];

export default function DealTypeMixChart({ data }: DealTypeMixChartProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">Deal Type Mix</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">How deal structures are shifting over time</p>
      <ResponsiveContainer width="100%" height={280}>
        <AreaChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.gridLine} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: CHART_COLORS.axisLabel, fontSize: 11 }} axisLine={{ stroke: CHART_COLORS.axisLine }} tickLine={false} />
          <YAxis tick={{ fill: CHART_COLORS.axisLabel, fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11 }} formatter={v => DEAL_TYPE_LABELS[v] || v} />
          {DEAL_TYPES.map((dt, i) => (
            <Area key={dt} type="monotone" dataKey={dt} stackId="mix" stroke={SERIES_COLORS[i % SERIES_COLORS.length]} fill={SERIES_COLORS[i % SERIES_COLORS.length]} fillOpacity={0.6} name={dt} />
          ))}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
