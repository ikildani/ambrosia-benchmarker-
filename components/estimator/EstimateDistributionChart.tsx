'use client';

import { AreaChart, Area, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip } from 'recharts';
import { CHART_COLORS } from '@/lib/chartTheme';

interface EstimateDistributionChartProps {
  p10: number;
  p25: number;
  p50: number;
  p75: number;
  p90: number;
  label?: string;
}

function generateDistribution(p10: number, p25: number, p50: number, p75: number, p90: number) {
  const points: { value: number; density: number }[] = [];
  const min = Math.max(0, p10 * 0.5);
  const max = p90 * 1.5;
  const step = (max - min) / 60;

  for (let v = min; v <= max; v += step) {
    let density = 0;
    const sigma = (p75 - p25) / 1.35;
    if (sigma > 0) {
      const z = (v - p50) / sigma;
      density = Math.exp(-0.5 * z * z);
    }
    points.push({ value: Math.round(v), density: Math.round(density * 100) });
  }
  return points;
}

const fmt = (v: number) => v >= 1000 ? `$${(v / 1000).toFixed(1)}B` : `$${Math.round(v)}M`;

export default function EstimateDistributionChart({ p10, p25, p50, p75, p90, label = 'Upfront' }: EstimateDistributionChartProps) {
  const data = generateDistribution(p10, p25, p50, p75, p90);

  return (
    <div>
      <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">{label} distribution</p>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={data} margin={{ top: 10, right: 20, bottom: 5, left: 10 }}>
          <defs>
            <linearGradient id="distFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={CHART_COLORS.teal500} stopOpacity={0.3} />
              <stop offset="95%" stopColor={CHART_COLORS.teal500} stopOpacity={0.02} />
            </linearGradient>
          </defs>
          <XAxis dataKey="value" tick={{ fill: CHART_COLORS.axisLabel, fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={v => fmt(v)} interval="preserveStartEnd" />
          <YAxis hide />
          <Tooltip
            content={() => null}
          />
          <Area type="monotone" dataKey="density" stroke={CHART_COLORS.teal500} strokeWidth={2} fill="url(#distFill)" />
          <ReferenceLine x={p25} stroke={CHART_COLORS.slate400} strokeDasharray="4 4" label={{ value: 'P25', position: 'top', fill: CHART_COLORS.axisLabel, fontSize: 10 }} />
          <ReferenceLine x={p50} stroke={CHART_COLORS.accent500} strokeWidth={2} label={{ value: 'Median', position: 'top', fill: CHART_COLORS.accent500, fontSize: 11, fontWeight: 600 }} />
          <ReferenceLine x={p75} stroke={CHART_COLORS.slate400} strokeDasharray="4 4" label={{ value: 'P75', position: 'top', fill: CHART_COLORS.axisLabel, fontSize: 10 }} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
