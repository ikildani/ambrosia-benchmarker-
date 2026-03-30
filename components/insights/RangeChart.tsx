'use client';

import { useState, useEffect } from 'react';

interface RangeDataPoint {
  label: string;
  p25: number;
  median: number;
  p75: number;
  n: number;
  highlight?: boolean;
}

interface RangeChartProps {
  data: RangeDataPoint[];
  title?: string;
  valuePrefix?: string;
  valueSuffix?: string;
}

const formatVal = (v: number, prefix = '$', suffix = 'M') => {
  if (v >= 1000) return `${prefix}${(v / 1000).toFixed(1)}B`;
  return `${prefix}${Math.round(v)}${suffix}`;
};

export function RangeChart({ data, title, valuePrefix = '$', valueSuffix = 'M' }: RangeChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <div className="h-80 animate-pulse bg-slate-50 rounded-xl" />;

  const maxVal = Math.max(...data.map(d => d.p75)) * 1.15;

  return (
    <div className="my-8 bg-white rounded-xl border border-slate-200 p-6">
      {title && <h3 className="text-sm font-semibold text-slate-700 mb-6">{title}</h3>}
      <div className="space-y-4">
        {data.map((d, i) => {
          const p25Pct = (d.p25 / maxVal) * 100;
          const medPct = (d.median / maxVal) * 100;
          const p75Pct = (d.p75 / maxVal) * 100;

          return (
            <div key={i} className="group">
              <div className="flex items-center gap-3 mb-1.5">
                <div className="w-28 text-right">
                  <span className={`text-xs font-medium ${d.highlight ? 'text-blue-700' : 'text-slate-600'}`}>
                    {d.label}
                  </span>
                </div>
                <div className="flex-1 relative h-8">
                  {/* P25-P75 range bar */}
                  <div
                    className={`absolute top-1 h-6 rounded ${d.highlight ? 'bg-blue-100 border border-blue-200' : 'bg-teal-50 border border-teal-100'}`}
                    style={{ left: `${p25Pct}%`, width: `${p75Pct - p25Pct}%` }}
                  />
                  {/* P25 tick */}
                  <div
                    className={`absolute top-0 w-0.5 h-8 ${d.highlight ? 'bg-blue-300' : 'bg-teal-300'}`}
                    style={{ left: `${p25Pct}%` }}
                  />
                  {/* P75 tick */}
                  <div
                    className={`absolute top-0 w-0.5 h-8 ${d.highlight ? 'bg-blue-300' : 'bg-teal-300'}`}
                    style={{ left: `${p75Pct}%` }}
                  />
                  {/* Median dot */}
                  <div
                    className={`absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full border-2 border-white shadow-md ${d.highlight ? 'bg-blue-600' : 'bg-teal-600'}`}
                    style={{ left: `${medPct}%`, marginLeft: '-6px' }}
                  />
                  {/* Median label */}
                  <div
                    className="absolute -top-5 text-[10px] font-bold text-slate-700 tabular-nums"
                    style={{ left: `${medPct}%`, transform: 'translateX(-50%)' }}
                  >
                    {formatVal(d.median, valuePrefix, valueSuffix)}
                  </div>
                </div>
                <div className="w-14 text-right">
                  <span className="text-[10px] text-slate-400 tabular-nums">n={d.n}</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Legend */}
      <div className="flex items-center justify-center gap-6 mt-6 pt-4 border-t border-slate-100">
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <div className="w-8 h-3 bg-teal-50 border border-teal-100 rounded" />
          <span>Interquartile range (P25-P75)</span>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-slate-400">
          <div className="w-3 h-3 bg-teal-600 rounded-full" />
          <span>Median</span>
        </div>
      </div>
      <p className="text-[11px] text-slate-400 mt-3 text-center tracking-wide">
        Source: Ambrosia Ventures | Phase 2 deals with disclosed upfronts (2020-2026) | SEC filings, FTC premerger filings
      </p>
    </div>
  );
}
