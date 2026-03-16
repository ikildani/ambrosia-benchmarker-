'use client';

import { useMemo } from 'react';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  ReferenceLine,
  Cell,
  ResponsiveContainer,
  Tooltip,
  LabelList,
} from 'recharts';

export interface TornadoSensitivity {
  factor: string;
  lowValue: number;  // Deal value ($M) when factor is at low end
  highValue: number; // Deal value ($M) when factor is at high end
  lowLabel: string;  // e.g. "PoS 25%"
  highLabel: string; // e.g. "PoS 75%"
}

export interface TornadoChartProps {
  baseValue: number; // Base case deal value in $M
  sensitivities: TornadoSensitivity[];
}

interface ChartDatum {
  factor: string;
  downside: number;   // negative delta from base (rendered left)
  upside: number;     // positive delta from base (rendered right)
  lowAbsolute: number;
  highAbsolute: number;
  lowLabel: string;
  highLabel: string;
  totalSpread: number;
}

// Custom label renderer for bar ends
function BarEndLabel({ x, y, width, height, value, datum, side }: {
  x?: number; y?: number; width?: number; height?: number; value?: number;
  datum: ChartDatum; side: 'low' | 'high';
}) {
  if (!x || !y || !width || !height) return null;
  const absVal = side === 'low' ? datum.lowAbsolute : datum.highAbsolute;
  const label = side === 'low' ? datum.lowLabel : datum.highLabel;
  const isLeft = side === 'low';
  const textX = isLeft ? x - 6 : x + width + 6;
  const textAnchor = isLeft ? 'end' : 'start';

  return (
    <g>
      <text
        x={textX}
        y={y + height / 2 - 6}
        textAnchor={textAnchor}
        fill="#64748b"
        fontSize={11}
        fontFamily="ui-monospace, SFMono-Regular, monospace"
      >
        ${absVal.toFixed(0)}M
      </text>
      <text
        x={textX}
        y={y + height / 2 + 8}
        textAnchor={textAnchor}
        fill="#94a3b8"
        fontSize={9}
      >
        {label}
      </text>
    </g>
  );
}

// Custom tooltip
function TornadoTooltip({ active, payload }: { active?: boolean; payload?: Array<{ payload: ChartDatum }> }) {
  if (!active || !payload || payload.length === 0) return null;
  const datum = payload[0].payload;
  return (
    <div className="bg-white dark:bg-slate-800 border border-neutral-200 dark:border-slate-600 rounded-lg p-3 shadow-lg text-xs">
      <p className="font-semibold text-neutral-800 dark:text-white mb-1">{datum.factor}</p>
      <div className="space-y-0.5 font-mono">
        <p className="text-red-600 dark:text-red-400">
          {datum.lowLabel}: ${datum.lowAbsolute.toFixed(0)}M
        </p>
        <p className="text-teal-600 dark:text-teal-400">
          {datum.highLabel}: ${datum.highAbsolute.toFixed(0)}M
        </p>
      </div>
      <p className="mt-1 text-neutral-500 dark:text-slate-400">
        Spread: ${datum.totalSpread.toFixed(0)}M
      </p>
    </div>
  );
}

export default function TornadoChart({ baseValue, sensitivities }: TornadoChartProps) {
  const chartData = useMemo<ChartDatum[]>(() => {
    return sensitivities
      .map((s) => {
        const lowDelta = s.lowValue - baseValue;
        const highDelta = s.highValue - baseValue;
        // downside is the negative direction, upside is positive
        const downside = Math.min(lowDelta, highDelta);
        const upside = Math.max(lowDelta, highDelta);
        return {
          factor: s.factor,
          downside,
          upside,
          lowAbsolute: s.lowValue,
          highAbsolute: s.highValue,
          lowLabel: s.lowLabel,
          highLabel: s.highLabel,
          totalSpread: Math.abs(upside - downside),
        };
      })
      .sort((a, b) => b.totalSpread - a.totalSpread);
  }, [sensitivities, baseValue]);

  if (chartData.length === 0) return null;

  // Compute max extent for symmetric axis
  const maxExtent = Math.max(
    ...chartData.map((d) => Math.max(Math.abs(d.downside), Math.abs(d.upside)))
  );
  const domainPadding = maxExtent * 0.35; // extra space for labels

  return (
    <div className="mt-6 sm:mt-8">
      <div className="border border-neutral-200 dark:border-slate-600 rounded-xl overflow-hidden bg-white dark:bg-slate-800 shadow-sm">
        {/* Header */}
        <div className="px-4 py-3 bg-neutral-50 dark:bg-slate-700/50 border-b border-neutral-200 dark:border-slate-600">
          <h3 className="text-sm font-semibold text-neutral-800 dark:text-slate-200">
            Sensitivity Impact (Tornado Chart)
          </h3>
          <p className="text-xs text-neutral-500 dark:text-slate-400 mt-0.5">
            Dollar impact on deal value when each factor is varied, base: <span className="font-mono font-semibold">${baseValue.toFixed(0)}M</span>
          </p>
        </div>

        {/* Chart */}
        <div className="p-3 sm:p-4">
          <ResponsiveContainer width="100%" height={chartData.length * 56 + 32}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 8, right: 100, left: 8, bottom: 8 }}
              barGap={0}
              barCategoryGap="20%"
            >
              <XAxis
                type="number"
                domain={[-(maxExtent + domainPadding), maxExtent + domainPadding]}
                tickFormatter={(v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(0)}M`}
                tick={{ fontSize: 10, fill: '#94a3b8', fontFamily: 'ui-monospace, SFMono-Regular, monospace' }}
                axisLine={{ stroke: '#e2e8f0' }}
                tickLine={false}
              />
              <YAxis
                type="category"
                dataKey="factor"
                width={140}
                tick={{ fontSize: 11, fill: '#64748b' }}
                axisLine={false}
                tickLine={false}
              />
              <Tooltip content={<TornadoTooltip />} cursor={false} />
              <ReferenceLine
                x={0}
                stroke="#475569"
                strokeWidth={1.5}
                strokeDasharray="4 2"
                label={{ value: 'Base', position: 'top', fontSize: 10, fill: '#475569' }}
              />

              {/* Downside bars (red/amber, extend left) */}
              <Bar dataKey="downside" stackId="impact" barSize={24} radius={[4, 0, 0, 4]}>
                {chartData.map((entry, idx) => (
                  <Cell key={`down-${idx}`} fill={entry.downside < -maxExtent * 0.3 ? '#ef4444' : '#f59e0b'} fillOpacity={0.8} />
                ))}
              </Bar>

              {/* Upside bars (teal/green, extend right) */}
              <Bar dataKey="upside" stackId="impact" barSize={24} radius={[0, 4, 4, 0]}>
                {chartData.map((entry, idx) => (
                  <Cell key={`up-${idx}`} fill={entry.upside > maxExtent * 0.3 ? '#10b981' : '#14b8a6'} fillOpacity={0.8} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>

          {/* Legend */}
          <div className="flex items-center justify-center gap-4 mt-2 text-xs text-neutral-500 dark:text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-amber-500/80 inline-block" />
              Downside
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded-sm bg-teal-500/80 inline-block" />
              Upside
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-4 h-0 border-t-2 border-dashed border-slate-500 inline-block" />
              Base Case
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
