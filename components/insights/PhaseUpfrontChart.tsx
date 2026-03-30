'use client';

import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, LabelList } from 'recharts';
import { useState, useEffect } from 'react';

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
  return `$${Math.round(value)}M`;
};

const formatShort = (value: number) => {
  if (value >= 1000) return `${(value / 1000).toFixed(1)}B`;
  return `${Math.round(value)}M`;
};

const CustomTooltip = ({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number; name: string; payload: PhaseDataPoint }>; label?: string }) => {
  if (!active || !payload || !payload[0]) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-slate-900 text-white px-4 py-3 rounded-lg shadow-2xl text-sm border border-slate-700">
      <p className="font-bold text-white mb-2">{label}</p>
      <div className="space-y-1">
        <div className="flex justify-between gap-6">
          <span className="text-slate-400">Low</span>
          <span className="text-slate-200 tabular-nums font-medium">{formatValue(d.low)}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-teal-400 font-semibold">Median</span>
          <span className="text-white tabular-nums font-bold">{formatValue(d.median)}</span>
        </div>
        <div className="flex justify-between gap-6">
          <span className="text-slate-400">High</span>
          <span className="text-slate-200 tabular-nums font-medium">{formatValue(d.high)}</span>
        </div>
      </div>
    </div>
  );
};

const CustomBarLabel = (props: { x?: number; y?: number; width?: number; value?: number }) => {
  const { x = 0, y = 0, width = 0, value = 0 } = props;
  if (!value) return null;
  return (
    <text
      x={x + width / 2}
      y={y - 8}
      fill="#334155"
      textAnchor="middle"
      fontSize={11}
      fontWeight={600}
      fontFamily="Inter, system-ui, sans-serif"
    >
      ${formatShort(value)}
    </text>
  );
};

export function PhaseUpfrontChart({ data, title, yLabel = 'Median Upfront ($M)', accentPhase }: PhaseUpfrontChartProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    // SSR placeholder — prevents hydration mismatch and shows something before JS loads
    return (
      <div className="my-8 bg-white rounded-xl border border-slate-200 p-6">
        {title && <h3 className="text-sm font-semibold text-slate-700 mb-4">{title}</h3>}
        <div className="h-64 sm:h-72 flex items-center justify-center">
          <div className="text-sm text-slate-400">Loading chart...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="my-8 bg-white rounded-xl border border-slate-200 p-6">
      {title && <h3 className="text-sm font-semibold text-slate-700 mb-4">{title}</h3>}
      <div className="h-64 sm:h-80">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 24, right: 10, left: 10, bottom: 5 }}>
            <defs>
              <linearGradient id="barGradientTeal" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0EA5A5" stopOpacity={0.95} />
                <stop offset="100%" stopColor="#0d9488" stopOpacity={0.85} />
              </linearGradient>
              <linearGradient id="barGradientBlue" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2563eb" stopOpacity={1} />
                <stop offset="100%" stopColor="#1d4ed8" stopOpacity={0.9} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="phase"
              tick={{ fill: '#475569', fontSize: 12, fontWeight: 500 }}
              axisLine={{ stroke: '#E2E8F0' }}
              tickLine={false}
              dy={4}
            />
            <YAxis
              tick={{ fill: '#94A3B8', fontSize: 11 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={formatValue}
              width={65}
              label={{
                value: yLabel,
                angle: -90,
                position: 'insideLeft',
                fill: '#94A3B8',
                fontSize: 11,
                dx: -5,
                fontFamily: 'Inter, system-ui, sans-serif',
              }}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(148,163,184,0.08)' }} />
            <Bar dataKey="median" radius={[6, 6, 0, 0]} maxBarSize={52} animationDuration={800}>
              <LabelList dataKey="median" content={<CustomBarLabel />} />
              {data.map((entry, i) => (
                <Cell
                  key={i}
                  fill={entry.highlight || entry.phase === accentPhase ? 'url(#barGradientBlue)' : 'url(#barGradientTeal)'}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
      <p className="text-[11px] text-slate-400 mt-3 text-center tracking-wide">
        Source: Ambrosia Ventures | 2,500+ verified transactions (2020-2026) | SEC filings, FTC premerger filings, press releases
      </p>
    </div>
  );
}
