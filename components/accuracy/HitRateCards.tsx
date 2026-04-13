/**
 * Hit rate cards for the accuracy dashboard — shows current vs target
 * with a visual progress bar.
 */

import type { BucketSummary } from '@/lib/accuracy-dashboard-data';

interface HitRateCardsProps {
  bucket: BucketSummary;
  targets: { hit25: number; hit35: number; hit50: number };
}

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

interface CardProps {
  label: string;
  actual: number;
  target: number;
  description: string;
}

function Card({ label, actual, target, description }: CardProps) {
  const progress = Math.min(1, actual / target);
  const bandColor =
    progress >= 0.9 ? 'bg-teal-500'
      : progress >= 0.5 ? 'bg-cyan-500'
      : progress >= 0.25 ? 'bg-amber-500'
      : 'bg-slate-600';

  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-5">
      <div className="mb-1 text-sm text-slate-500">{label}</div>
      <div className="flex items-baseline gap-3">
        <span className="font-mono text-3xl font-semibold text-slate-100">{pct(actual)}</span>
        <span className="text-xs text-slate-500">target {pct(target)}</span>
      </div>
      <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-slate-800">
        <div
          className={`h-full transition-all ${bandColor}`}
          style={{ width: `${Math.min(100, progress * 100)}%` }}
        />
      </div>
      <p className="mt-3 text-xs leading-relaxed text-slate-500">{description}</p>
    </div>
  );
}

export function HitRateCards({ bucket, targets }: HitRateCardsProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <Card
        label="Hit Rate ±25%"
        actual={bucket.hit25}
        target={targets.hit25}
        description="Share of predictions within 25% of actual disclosed upfront. The gold standard for commercial-grade deal modeling."
      />
      <Card
        label="Hit Rate ±35%"
        actual={bucket.hit35}
        target={targets.hit35}
        description="Academic convention for right-ballpark modeling. What investment committees typically accept as a primary anchor."
      />
      <Card
        label="Hit Rate ±50%"
        actual={bucket.hit50}
        target={targets.hit50}
        description="Wide-tolerance calibration. Useful as a directional sanity check; not precise enough to drive a final term sheet."
      />
    </div>
  );
}
