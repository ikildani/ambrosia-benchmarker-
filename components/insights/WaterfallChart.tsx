'use client';

import { useState, useEffect } from 'react';

interface WaterfallDataPoint {
  phase: string;
  value: number;
  n: number;
}

interface WaterfallChartProps {
  data: WaterfallDataPoint[];
  title?: string;
}

const formatVal = (v: number) => {
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}B`;
  return `$${Math.round(v)}M`;
};

export function WaterfallChart({ data, title }: WaterfallChartProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);
  if (!mounted) return <div className="h-80 animate-pulse bg-slate-50 rounded-xl" />;

  const maxVal = Math.max(...data.map(d => d.value));

  // Calculate jumps between phases
  const jumps = data.map((d, i) => {
    if (i === 0) return null;
    const prev = data[i - 1].value;
    const mult = (d.value / prev).toFixed(1);
    return `${mult}x`;
  });

  return (
    <div className="my-8 bg-white rounded-xl border border-slate-200 p-6">
      {title && <h3 className="text-sm font-semibold text-slate-700 mb-6">{title}</h3>}
      <div className="flex items-end gap-1 sm:gap-3 h-72 px-2 sm:px-4 pt-8 pb-2">
        {data.map((d, i) => {
          const heightPct = (d.value / maxVal) * 100;
          const colors = [
            'from-slate-300 to-slate-400',
            'from-teal-300 to-teal-500',
            'from-teal-400 to-teal-600',
            'from-blue-400 to-blue-600',
            'from-blue-500 to-blue-700',
          ];
          const color = colors[Math.min(i, colors.length - 1)];

          return (
            <div key={i} className="flex-1 flex flex-col items-center relative">
              {/* Value label */}
              <div className="text-[11px] font-bold text-slate-700 tabular-nums mb-1 whitespace-nowrap">
                {formatVal(d.value)}
              </div>

              {/* Jump multiplier */}
              {jumps[i] && (
                <div className="absolute -top-1 left-1/2 -translate-x-1/2 -translate-y-full">
                  <span className="text-[9px] font-bold text-teal-600 bg-teal-50 px-1.5 py-0.5 rounded-full border border-teal-200">
                    {jumps[i]}
                  </span>
                </div>
              )}

              {/* Bar */}
              <div
                className={`w-full bg-gradient-to-t ${color} rounded-t-md transition-all duration-700 relative`}
                style={{ height: `${heightPct}%`, minHeight: '20px' }}
              >
                {/* Connector line to next bar */}
                {i < data.length - 1 && (
                  <div className="absolute top-0 right-0 w-full h-px border-t border-dashed border-slate-300" style={{ width: '200%', left: '50%' }} />
                )}
              </div>

              {/* Phase label */}
              <div className="mt-2 text-center">
                <div className="text-[11px] font-medium text-slate-600 leading-tight">{d.phase}</div>
                <div className="text-[9px] text-slate-400 tabular-nums">n={d.n}</div>
              </div>
            </div>
          );
        })}
      </div>

      <p className="text-[11px] text-slate-400 mt-4 text-center tracking-wide">
        Source: Ambrosia Ventures | Oncology median upfronts by phase (2020-2026) | n=1,223 deals with disclosed terms
      </p>
    </div>
  );
}
