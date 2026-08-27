'use client';

import { useState, useMemo } from 'react';
import { AreaChart, Area, XAxis, YAxis, ReferenceLine, ResponsiveContainer, Tooltip } from 'recharts';

interface ConfidenceBandEnhancedProps {
  percentiles: { p5: number; p25: number; p50: number; p75: number; p95: number };
  benchmarkRange?: { p25: number; median: number; p75: number };
  userValue: number;
  label: string;
  sampleSize?: number;
}

function generateDistribution(p5: number, p25: number, p50: number, p75: number, p95: number) {
  const points: { value: number; density: number }[] = [];
  const anchors = [
    { v: p5, d: 0.05 },
    { v: p25, d: 0.35 },
    { v: p50, d: 1.0 },
    { v: p75, d: 0.35 },
    { v: p95, d: 0.05 },
  ];

  const minV = p5 - (p25 - p5) * 0.3;
  const maxV = p95 + (p95 - p75) * 0.3;
  const steps = 60;
  const step = (maxV - minV) / steps;

  for (let i = 0; i <= steps; i++) {
    const v = minV + i * step;
    let density = 0;
    for (const a of anchors) {
      const sigma = (p75 - p25) * 0.4;
      const diff = v - a.v;
      density += a.d * Math.exp(-(diff * diff) / (2 * sigma * sigma));
    }
    points.push({ value: Math.round(v), density: Math.round(density * 1000) / 1000 });
  }

  const maxDensity = Math.max(...points.map(p => p.density));
  return points.map(p => ({ ...p, density: p.density / maxDensity }));
}

function formatM(val: number): string {
  if (val >= 1e9) return `$${(val / 1e9).toFixed(1)}B`;
  if (val >= 1e6) return `$${(val / 1e6).toFixed(0)}M`;
  if (val >= 1e3) return `$${(val / 1e3).toFixed(0)}K`;
  return `$${val}`;
}

function computePercentileRank(value: number, p5: number, p25: number, p50: number, p75: number, p95: number): number {
  const anchors = [
    { pct: 5, v: p5 },
    { pct: 25, v: p25 },
    { pct: 50, v: p50 },
    { pct: 75, v: p75 },
    { pct: 95, v: p95 },
  ];
  if (value <= p5) return 5;
  if (value >= p95) return 95;
  for (let i = 0; i < anchors.length - 1; i++) {
    if (value >= anchors[i].v && value <= anchors[i + 1].v) {
      const ratio = (value - anchors[i].v) / (anchors[i + 1].v - anchors[i].v);
      return Math.round(anchors[i].pct + ratio * (anchors[i + 1].pct - anchors[i].pct));
    }
  }
  return 50;
}

export default function ConfidenceBandEnhanced({
  percentiles, benchmarkRange, userValue, label, sampleSize,
}: ConfidenceBandEnhancedProps) {
  const [activeTab, setActiveTab] = useState<'distribution' | 'benchmark'>('distribution');

  const data = useMemo(
    () => generateDistribution(percentiles.p5, percentiles.p25, percentiles.p50, percentiles.p75, percentiles.p95),
    [percentiles],
  );

  const rank = computePercentileRank(userValue, percentiles.p5, percentiles.p25, percentiles.p50, percentiles.p75, percentiles.p95);

  const rankLabel = rank >= 75 ? 'Above most comparables' : rank >= 50 ? 'At market median' : rank >= 25 ? 'Below market median' : 'Conservative vs. comparables';
  const rankColor = rank >= 75 ? 'text-teal-500' : rank >= 50 ? 'text-cyan-500' : rank >= 25 ? 'text-amber-500' : 'text-slate-400';

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-900/50 p-5 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="text-sm font-semibold text-slate-200">Deal Value Distribution</h3>
          <p className="text-xs text-slate-500 mt-0.5">{label}</p>
        </div>
        {benchmarkRange && (
          <div className="flex gap-1 bg-slate-800 rounded-lg p-0.5">
            <button
              onClick={() => setActiveTab('distribution')}
              className={`text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors ${
                activeTab === 'distribution' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              Monte Carlo
            </button>
            <button
              onClick={() => setActiveTab('benchmark')}
              className={`text-[11px] font-medium px-2.5 py-1 rounded-md transition-colors ${
                activeTab === 'benchmark' ? 'bg-slate-700 text-white' : 'text-slate-400 hover:text-slate-300'
              }`}
            >
              Comparables
            </button>
          </div>
        )}
      </div>

      <div className="h-[240px] sm:h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 20, bottom: 20, left: 10 }}>
            <defs>
              <linearGradient id="distFill" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#0EA5A5" stopOpacity={0.25} />
                <stop offset="100%" stopColor="#0EA5A5" stopOpacity={0.03} />
              </linearGradient>
            </defs>
            <XAxis
              dataKey="value"
              tickFormatter={formatM}
              tick={{ fill: '#64748B', fontSize: 10 }}
              axisLine={{ stroke: '#334155' }}
              tickLine={false}
            />
            <YAxis hide />
            <Tooltip
              formatter={(val: number | undefined) => [`${((val ?? 0) * 100).toFixed(0)}%`, 'Density']}
              labelFormatter={(v: unknown) => formatM(Number(v))}
              contentStyle={{ background: '#1e293b', border: '1px solid #334155', borderRadius: '8px', fontSize: '11px' }}
              itemStyle={{ color: '#94A3B8' }}
              labelStyle={{ color: '#e2e8f0', fontWeight: 600 }}
            />
            <Area
              type="monotone"
              dataKey="density"
              stroke="#0EA5A5"
              strokeWidth={2}
              fill="url(#distFill)"
            />
            <ReferenceLine
              x={percentiles.p25}
              stroke="#334155"
              strokeDasharray="3 3"
              label={{ value: 'p25', position: 'top', fill: '#64748B', fontSize: 9 }}
            />
            <ReferenceLine
              x={percentiles.p50}
              stroke="#64748B"
              strokeDasharray="3 3"
              label={{ value: 'p50', position: 'top', fill: '#94A3B8', fontSize: 9 }}
            />
            <ReferenceLine
              x={percentiles.p75}
              stroke="#334155"
              strokeDasharray="3 3"
              label={{ value: 'p75', position: 'top', fill: '#64748B', fontSize: 9 }}
            />
            <ReferenceLine
              x={userValue}
              stroke="#E6A800"
              strokeWidth={2}
              label={{
                value: `Your asset: ${formatM(userValue)}`,
                position: 'insideTopRight',
                fill: '#E6A800',
                fontSize: 11,
                fontWeight: 600,
              }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-3">
        <div className="rounded-lg bg-slate-800/50 px-3 py-2 text-center">
          <div className={`text-lg font-bold ${rankColor}`}>
            {rank}<span className="text-xs font-normal">th</span>
          </div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Percentile</div>
        </div>
        <div className="rounded-lg bg-slate-800/50 px-3 py-2 text-center">
          <div className="text-sm font-bold text-slate-200">{formatM(percentiles.p50)}</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Market Median</div>
        </div>
        <div className="rounded-lg bg-slate-800/50 px-3 py-2 text-center">
          <div className="text-sm font-bold text-slate-200">{sampleSize || '—'}</div>
          <div className="text-[10px] font-medium uppercase tracking-wider text-slate-500">Sample Size</div>
        </div>
      </div>

      <p className={`mt-3 text-xs ${rankColor}`}>{rankLabel}</p>
    </div>
  );
}
