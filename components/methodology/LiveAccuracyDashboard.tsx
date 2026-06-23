const METRICS = [
  {
    label: 'Core Scope Hit Rate',
    sublabel: 'Phase 2/3 licensing',
    value: '78%',
    accent: 'text-emerald-400',
    border: 'border-emerald-500/20',
  },
  {
    label: 'Full Scope Hit Rate',
    sublabel: 'All deals',
    value: '65%',
    accent: 'text-teal-400',
    border: 'border-teal-500/20',
  },
  {
    label: 'Mean Absolute Error',
    sublabel: 'Across all deal types',
    value: '±22%',
    accent: 'text-amber-400',
    border: 'border-amber-500/20',
  },
  {
    label: 'Backtest Deals',
    sublabel: '2017-2026 corpus',
    value: '251',
    accent: 'text-slate-200',
    border: 'border-slate-700',
  },
];

export function LiveAccuracyDashboard() {
  return (
    <div className="my-8">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
        Engine Accuracy Snapshot
      </h3>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {METRICS.map((m) => (
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
        Representative values from latest calibration round. Production v2 will read live from backtest results.
      </p>
    </div>
  );
}
