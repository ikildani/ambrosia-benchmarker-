import Link from 'next/link';
import { loadAccuracyData } from '@/lib/accuracy-dashboard-data';

/**
 * Engine accuracy snapshot for the methodology page.
 *
 * Reads the versioned backtest report (__tests__/backtest/baseline-errors.json)
 * through the same loader the /accuracy page uses, so this panel can never
 * disagree with the published numbers. Earlier versions hardcoded
 * "representative" values that were far better than the measured ones; that
 * is exactly the kind of claim an institutional user will check.
 */
function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

function signedPct(x: number): string {
  const v = Math.round(x * 100);
  return `${v > 0 ? '+' : ''}${v}%`;
}

export function LiveAccuracyDashboard() {
  const data = loadAccuracyData();

  if (!data) {
    return (
      <div className="my-8 rounded-lg border border-slate-700 bg-slate-900/40 px-4 py-4 text-sm text-slate-400">
        Calibration in progress — the backtest report has not been generated for this build.
      </div>
    );
  }

  const core = data.coreScope;
  const test = data.holdout?.test;
  const runDate = new Date(data.runAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  const metrics = [
    {
      label: 'Core scope, within ±50%',
      sublabel: `Phase 2/3 licensing · n=${core.n}`,
      value: pct(core.hit50),
      accent: 'text-emerald-400',
      border: 'border-emerald-500/20',
    },
    {
      label: 'Core scope, within ±25%',
      sublabel: 'Point estimate vs. disclosed upfront',
      value: pct(core.hit25),
      accent: 'text-teal-400',
      border: 'border-teal-500/20',
    },
    {
      label: 'Median signed error',
      sublabel: 'Negative = engine undershoots',
      value: signedPct(core.medianSignedErrorPct),
      accent: 'text-amber-400',
      border: 'border-amber-500/20',
    },
    {
      label: test ? 'Held-out test, within ±50%' : 'Full scope deals',
      sublabel: test ? `20% never seen in tuning · n=${test.n}` : `All segments · n=${data.fullScope.n}`,
      value: test ? pct(test.hit50) : String(data.fullScope.n),
      accent: 'text-slate-200',
      border: 'border-slate-700',
    },
  ];

  return (
    <div className="my-8">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
        Engine Accuracy Snapshot
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {metrics.map((m) => (
          <div
            key={m.label}
            className={`rounded-lg border ${m.border} bg-slate-900/40 px-4 py-4`}
          >
            <p className={`text-2xl font-semibold tabular-nums ${m.accent}`}>{m.value}</p>
            <p className="mt-1 text-xs font-medium text-slate-300">{m.label}</p>
            <p className="text-xs text-slate-500">{m.sublabel}</p>
          </div>
        ))}
      </div>
      <p className="mt-3 text-xs text-slate-500">
        Measured on the {runDate} backtest against real disclosed deals. Hit rates are recency-weighted.
        Full breakdown by therapeutic area, phase and modality on the{' '}
        <Link href="/accuracy" className="text-teal-400 underline-offset-2 hover:underline">accuracy page</Link>.
      </p>
    </div>
  );
}
