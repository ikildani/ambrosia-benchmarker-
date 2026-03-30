'use client';

import { useState, useEffect } from 'react';
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, ReferenceLine } from 'recharts';

interface TrendDataPoint {
  year: string;
  value: number;
  n?: number;
}

interface TrendLineChartProps {
  data: TrendDataPoint[];
  yLabel?: string;
  color?: string;
  referenceLine?: { value: number; label: string };
  formatY?: (v: number) => string;
}

const CustomTooltip = ({ active, payload, label, formatY }: { active?: boolean; payload?: Array<{ value: number; payload: TrendDataPoint }>; label?: string; formatY?: (v: number) => string }) => {
  if (!active || !payload || !payload[0]) return null;
  const d = payload[0].payload;
  const fmt = formatY || ((v: number) => `${v.toFixed(1)}%`);
  return (
    <div className="bg-slate-900 text-white px-4 py-3 rounded-lg shadow-2xl text-sm border border-slate-700">
      <p className="font-bold text-white mb-1">{label}</p>
      <div className="flex justify-between gap-6">
        <span className="text-teal-400">Value</span>
        <span className="text-white tabular-nums font-bold">{fmt(d.value)}</span>
      </div>
      {d.n && (
        <div className="flex justify-between gap-6 mt-1">
          <span className="text-slate-400">Sample size</span>
          <span className="text-slate-300 tabular-nums">n={d.n}</span>
        </div>
      )}
    </div>
  );
};

export function TrendLineChart({ data, yLabel, color = '#0EA5A5', referenceLine, formatY }: TrendLineChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <div className="h-72 animate-pulse bg-slate-50 rounded-xl" />;

  const fmt = formatY || ((v: number) => `${v.toFixed(0)}%`);

  return (
    <div className="my-8 bg-white rounded-xl border border-slate-200 p-6">
      <div className="h-64 sm:h-72">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 20, left: 10, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis
              dataKey="year"
              tick={{ fill: '#475569', fontSize: 12, fontWeight: 500 }}
              axisLine={{ stroke: '#E2E8F0' }}
              tickLine={false}
            />
            <YAxis
              tick={{ fill: '#94A3B8', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={fmt}
              width={50}
              label={yLabel ? { value: yLabel, angle: -90, position: 'insideLeft', fill: '#94A3B8', fontSize: 11, dx: -5 } : undefined}
            />
            {referenceLine && (
              <ReferenceLine
                y={referenceLine.value}
                stroke="#ef4444"
                strokeDasharray="6 4"
                label={{ value: referenceLine.label, fill: '#ef4444', fontSize: 10, position: 'insideTopRight' }}
              />
            )}
            <Tooltip content={<CustomTooltip formatY={fmt} />} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              strokeWidth={3}
              dot={{ fill: color, strokeWidth: 2, stroke: '#fff', r: 5 }}
              activeDot={{ fill: color, strokeWidth: 3, stroke: '#fff', r: 7 }}
              animationDuration={1000}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] text-slate-400 mt-3 text-center tracking-wide">
        Source: Ambrosia Ventures | Deals with disclosed upfront + total value | SEC filings, FTC premerger filings
      </p>
    </div>
  );
}
