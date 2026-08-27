'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend } from 'recharts';
import { CHART_COLORS, SERIES_COLORS } from '@/lib/chartTheme';
import { formatModality } from '@/lib/config/modality-display';

interface ModalityMixChartProps {
  data: Array<{ label: string; [modality: string]: string | number }>;
  topModalities: string[];
}

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-slate-800 border border-slate-700 px-4 py-3 shadow-xl text-sm max-w-xs">
      <p className="font-medium text-white mb-2">{label}</p>
      {payload.filter(p => p.value > 0).map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-slate-300">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: p.color }} />
          <span className="flex-1 truncate">{formatModality(p.name)}</span>
          <span className="font-mono font-medium text-white">{p.value}</span>
        </div>
      ))}
    </div>
  );
};

export default function ModalityMixChart({ data, topModalities }: ModalityMixChartProps) {
  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">Modality Mix</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Top modalities by deal volume per quarter</p>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.gridLine} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: CHART_COLORS.axisLabel, fontSize: 11 }} axisLine={{ stroke: CHART_COLORS.axisLine }} tickLine={false} />
          <YAxis tick={{ fill: CHART_COLORS.axisLabel, fontSize: 11 }} axisLine={false} tickLine={false} width={32} />
          <Tooltip content={<CustomTooltip />} />
          <Legend wrapperStyle={{ fontSize: 11 }} formatter={v => formatModality(v)} />
          {topModalities.map((mod, i) => (
            <Bar key={mod} dataKey={mod} stackId="mod" fill={SERIES_COLORS[i % SERIES_COLORS.length]} name={mod} />
          ))}
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
