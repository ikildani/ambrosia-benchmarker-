'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface PhaseDataPoint {
  phase: string;
  low: number;
  median: number;
  high: number;
  highlight?: boolean;
}

interface PhaseUpfrontChartProps {
  data: PhaseDataPoint[];
  title?: string;
  yLabel?: string;
  accentPhase?: string;
}

const formatValue = (value: number) => {
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}B`;
  return `$${value}M`;
};

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string }>; label?: string }) => {
  if (!active || !payload) return null;
  return (
    <div className="bg-slate-900 text-white px-4 py-3 rounded-lg shadow-xl text-sm">
      <p className="font-semibold mb-1">{label}</p>
      {payload.map((entry, i) => (
        <p key={i} className="text-slate-300">
          {entry.name === 'median' ? 'Median' : entry.name === 'low' ? 'Low' : 'High'}: {formatValue(entry.value)}
        </p>
      ))}
    </div>
  );
};

export function PhaseUpfrontChart({ data, title, yLabel = 'Median Upfront ($M)', accentPhase }: PhaseUpfrontChartProps) {
  return (
    <div className="my-8 bg-white rounded-xl border border-slate-200 p-6">
      {title && <h3 className="text-sm font-semibold text-slate-700 mb-4">{title}</h3>}
      <div className="h-64 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
            <XAxis
              dataKey="phase"
              tick={{ fill: '#64748B', fontSize: 11 }}
              axisLine={{ stroke: '#E2E8F0' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#64748B', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatValue}
              label={{ value: yLabel, angle: -90, position: 'insideLeft', fill: '#94A3B8', fontSize: 11, dx: -5 }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.1)' }} />
            <Bar dataKey="median" radius={[4, 4, 0, 0]} maxBarSize={48}>
              {data.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.highlight || entry.phase === accentPhase ? '#2563eb' : '#0EA5A5'}
                  opacity={entry.highlight || entry.phase === accentPhase ? 1 : 0.75}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-xs text-slate-400 mt-2 text-center">
        Source: Ambrosia Ventures analysis of 2,600+ biopharma licensing transactions (2020–2026)
      </p>
    </div>
  );
}
