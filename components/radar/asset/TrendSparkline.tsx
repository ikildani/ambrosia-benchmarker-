'use client';

import { useId, useMemo } from 'react';
import type { TrendPoint } from './types';

/**
 * Inline SVG sparkline (no chart library on the critical path). The series
 * is also exposed as an accessible description so screen readers get the
 * first/last values and the range.
 */
export function TrendSparkline({ points, width = 220, height = 48, days = 90 }: { points: TrendPoint[]; width?: number; height?: number; days?: number }) {
  const id = useId();
  const data = useMemo(() => {
    const cutoff = new Date();
    cutoff.setUTCDate(cutoff.getUTCDate() - days);
    return points.filter(p => new Date(p.date) >= cutoff);
  }, [points, days]);

  if (data.length < 2) {
    return <p className="text-xs text-neutral-500 dark:text-neutral-400">Not enough snapshots for a {days}-day trend.</p>;
  }
  const min = Math.min(...data.map(p => p.score));
  const max = Math.max(...data.map(p => p.score));
  const span = Math.max(1, max - min);
  const pad = 4;
  const xs = (i: number) => pad + (i / (data.length - 1)) * (width - pad * 2);
  const ys = (v: number) => height - pad - ((v - min) / span) * (height - pad * 2);
  const d = data.map((p, i) => `${i === 0 ? 'M' : 'L'}${xs(i).toFixed(1)},${ys(p.score).toFixed(1)}`).join(' ');
  const last = data[data.length - 1];
  const first = data[0];
  const rising = last.score >= first.score;

  return (
    <figure className="m-0">
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} role="img" aria-labelledby={`${id}-t`} aria-describedby={`${id}-d`} className="max-w-full">
        <title id={`${id}-t`}>Licensing intent, last {days} days</title>
        <desc id={`${id}-d`}>From {first.score} on {first.date} to {last.score} on {last.date}; range {min} to {max}.</desc>
        <path d={d} fill="none" stroke={rising ? '#059669' : '#b45309'} strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" className="dark:opacity-90" />
        <circle cx={xs(data.length - 1)} cy={ys(last.score)} r={2.5} fill={rising ? '#059669' : '#b45309'} />
      </svg>
      <figcaption className="mt-1 flex justify-between text-[10px] text-neutral-500 dark:text-neutral-400">
        <span>{first.date}</span><span>{last.date}</span>
      </figcaption>
    </figure>
  );
}
