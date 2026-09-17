'use client';

/**
 * Calibration chart for the licensing-intent model (client component; recharts
 * needs the DOM). One accent series (observed licensing rate per predicted
 * bin) against the neutral identity line. Text uses ink tokens, never the
 * series colour; a legend and a tooltip are always present.
 */

import { ResponsiveContainer, ComposedChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ReferenceLine } from 'recharts';

export interface CalibrationPoint {
  bin: string;
  predicted: number;
  observed: number;
  n: number;
}

interface Props {
  bins: CalibrationPoint[];
}

function pct(v: number): string {
  return `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`;
}

export function CalibrationChart({ bins }: Props) {
  const points = bins.filter(b => b.n > 0).map(b => ({ ...b, ideal: b.predicted }));
  if (points.length === 0) {
    return <p className="text-sm text-neutral-500 dark:text-slate-400">No calibration data yet.</p>;
  }
  return (
    <div className="h-72 w-full" role="img" aria-label="Calibration: observed licensing rate against predicted probability, by decile of prediction">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={points} margin={{ top: 12, right: 16, bottom: 8, left: 0 }}>
          <CartesianGrid stroke="currentColor" strokeOpacity={0.12} vertical={false} />
          <XAxis
            dataKey="predicted"
            type="number"
            domain={[0, 'auto']}
            tickFormatter={pct}
            tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.7 }}
            axisLine={{ stroke: 'currentColor', strokeOpacity: 0.2 }}
            tickLine={false}
            label={{ value: 'Predicted probability (bin mean)', position: 'insideBottom', offset: -2, fontSize: 11, fill: 'currentColor', opacity: 0.7 }}
          />
          <YAxis
            type="number"
            domain={[0, 'auto']}
            tickFormatter={pct}
            tick={{ fontSize: 11, fill: 'currentColor', opacity: 0.7 }}
            axisLine={false}
            tickLine={false}
            width={44}
          />
          <Tooltip
            formatter={(value: number | string | undefined, name: string | undefined) => [typeof value === 'number' ? pct(value) : String(value ?? ''), name === 'observed' ? 'Observed rate' : 'Predicted']}
            labelFormatter={(label) => `Predicted ${typeof label === 'number' ? pct(label) : String(label ?? '')}`}
            contentStyle={{ fontSize: 12, borderRadius: 6, background: 'rgba(15, 23, 42, 0.92)', border: 'none', color: '#f8fafc' }}
            itemStyle={{ color: '#f8fafc' }}
            cursor={{ stroke: 'currentColor', strokeOpacity: 0.25 }}
          />
          <Legend wrapperStyle={{ fontSize: 11 }} formatter={(v: string) => (v === 'observed' ? 'Observed licensing rate' : 'Perfect calibration')} />
          <ReferenceLine segment={[{ x: 0, y: 0 }, { x: Math.max(...points.map(p => p.predicted), 0.05), y: Math.max(...points.map(p => p.predicted), 0.05) }]} stroke="currentColor" strokeOpacity={0.35} strokeDasharray="4 4" ifOverflow="extendDomain" />
          <Line type="monotone" dataKey="ideal" name="ideal" stroke="currentColor" strokeOpacity={0.35} strokeDasharray="4 4" dot={false} legendType="plainline" isAnimationActive={false} />
          <Line type="monotone" dataKey="observed" name="observed" stroke="#d97706" strokeWidth={2} dot={{ r: 4, strokeWidth: 2, stroke: '#d97706', fill: 'white' }} activeDot={{ r: 6 }} isAnimationActive={false} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
