'use client';

import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import { CHART_COLORS, TA_CHART_COLORS } from '@/lib/chartTheme';
import { therapeuticAreaOptions } from '@/lib/calculations';

interface MedianUpfrontChartProps {
  data: Array<{ label: string; [ta: string]: string | number | null }>;
  selectedTA: string;
}

const taLabelMap: Record<string, string> = {};
therapeuticAreaOptions.forEach(o => { taLabelMap[o.value] = o.label; });

const fmt = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(1)}B` : `$${Math.round(v)}M`;

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-lg bg-slate-800 border border-slate-700 px-4 py-3 shadow-xl text-sm">
      <p className="font-medium text-white mb-2">{label}</p>
      {payload.filter(p => p.value != null && p.value > 0).map((p, i) => (
        <div key={i} className="flex items-center gap-2 text-slate-300">
          <div className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: p.color }} />
          <span className="flex-1">{taLabelMap[p.name] || p.name}</span>
          <span className="font-mono font-medium text-white">{fmt(p.value)}</span>
        </div>
      ))}
    </div>
  );
};

export default function MedianUpfrontChart({ data, selectedTA }: MedianUpfrontChartProps) {
  const activeTAs = selectedTA === 'all'
    ? ['oncology', 'neurology', 'immunology', 'metabolic', 'cardiovascular', 'infectiousDisease']
    : [selectedTA];

  return (
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-200 dark:border-slate-700 shadow-sm p-6">
      <h3 className="text-base font-semibold text-slate-900 dark:text-white mb-1">Median Upfront by TA</h3>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">Weighted median upfront payment ($M) per quarter</p>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 10, bottom: 5, left: 10 }}>
          <CartesianGrid strokeDasharray="3 3" stroke={CHART_COLORS.gridLine} vertical={false} />
          <XAxis dataKey="label" tick={{ fill: CHART_COLORS.axisLabel, fontSize: 11 }} axisLine={{ stroke: CHART_COLORS.axisLine }} tickLine={false} />
          <YAxis tick={{ fill: CHART_COLORS.axisLabel, fontSize: 11 }} axisLine={false} tickLine={false} width={50} tickFormatter={v => fmt(v)} />
          <Tooltip content={<CustomTooltip />} />
          {activeTAs.map(ta => (
            <Line key={ta} type="monotone" dataKey={ta} stroke={TA_CHART_COLORS[ta] || CHART_COLORS.teal500} strokeWidth={2} dot={{ r: 3 }} activeDot={{ r: 5 }} connectNulls name={ta} />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
