'use client';

import { useState, useEffect } from 'react';

interface Dimension {
  name: string;
  contribution_pct: number;
  enabled: boolean;
}

export function DimensionExplorer() {
  const [baseline, setBaseline] = useState<number | null>(null);
  const [dimensions, setDimensions] = useState<Dimension[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch('/api/methodology/dimension-explorer', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({}),
    })
      .then((r) => r.json())
      .then((data) => {
        setBaseline(data.baseline);
        setDimensions(data.dimensions);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, []);

  const toggleDimension = (name: string) => {
    setDimensions((prev) =>
      prev.map((d) => (d.name === name ? { ...d, enabled: !d.enabled } : d)),
    );
  };

  if (loading) {
    return (
      <div className="my-8 rounded-xl border border-slate-800 bg-slate-900/40 p-6">
        <div className="animate-pulse space-y-3">
          <div className="h-4 w-48 rounded bg-slate-800" />
          <div className="h-32 rounded bg-slate-800/60" />
        </div>
      </div>
    );
  }

  if (!baseline) return null;

  const enabledPct = dimensions.filter((d) => d.enabled).reduce((s, d) => s + d.contribution_pct, 0);
  const adjustedValue = Math.round((baseline * enabledPct) / 100);
  const maxPct = Math.max(...dimensions.map((d) => d.contribution_pct));

  return (
    <div className="my-8 rounded-xl border border-slate-800 bg-slate-900/40 p-6">
      <div className="mb-4 flex items-baseline justify-between">
        <h3 className="text-sm font-semibold uppercase tracking-wider text-slate-400">
          Dimension Explorer
        </h3>
        <div className="text-right">
          <span className="text-xs text-slate-500">Reference asset value</span>
          <p className="text-2xl font-semibold tabular-nums text-slate-100">
            ${adjustedValue.toLocaleString()}M
            {enabledPct < 100 && (
              <span className="ml-2 text-sm text-slate-500">
                ({enabledPct}% of ${baseline.toLocaleString()}M)
              </span>
            )}
          </p>
        </div>
      </div>
      <p className="mb-6 text-xs text-slate-500">
        Reference: Phase 2 oncology mAb, $2B peak sales, racing competitive position.
        Toggle dimensions to see how each contributes to the final valuation.
      </p>

      <div className="space-y-2">
        {dimensions.map((d) => (
          <div key={d.name} className="flex items-center gap-3">
            {/* Toggle */}
            <button
              onClick={() => toggleDimension(d.name)}
              className={[
                'relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border transition-colors duration-200',
                d.enabled
                  ? 'border-teal-500/40 bg-teal-500/30'
                  : 'border-slate-700 bg-slate-800',
              ].join(' ')}
              role="switch"
              aria-checked={d.enabled}
              aria-label={`Toggle ${d.name}`}
            >
              <span
                className={[
                  'pointer-events-none inline-block h-4 w-4 rounded-full shadow transition-transform duration-200',
                  d.enabled ? 'translate-x-4 bg-teal-400' : 'translate-x-0 bg-slate-500',
                ].join(' ')}
              />
            </button>

            {/* Label */}
            <span
              className={[
                'w-44 shrink-0 text-xs',
                d.enabled ? 'text-slate-200' : 'text-slate-500',
              ].join(' ')}
            >
              {d.name}
            </span>

            {/* Bar */}
            <div className="flex-1">
              <div className="h-4 w-full rounded-full bg-slate-800">
                <div
                  className={[
                    'h-4 rounded-full transition-all duration-300',
                    d.enabled ? 'bg-teal-500/60' : 'bg-slate-700/40',
                  ].join(' ')}
                  style={{ width: `${(d.contribution_pct / maxPct) * 100}%` }}
                />
              </div>
            </div>

            {/* Percentage */}
            <span
              className={[
                'w-10 shrink-0 text-right text-xs tabular-nums',
                d.enabled ? 'text-teal-400' : 'text-slate-600',
              ].join(' ')}
            >
              {d.contribution_pct}%
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
