/**
 * Calibration journey timeline — shows each round's outcome + summary.
 * Public-facing UX for the /accuracy dashboard.
 */

import type { CalibrationRound } from '@/lib/accuracy-dashboard-data';

const OUTCOME_STYLES: Record<CalibrationRound['outcome'], { label: string; color: string }> = {
  win: { label: 'Net Win', color: 'bg-teal-500/10 text-teal-400 border-teal-500/30' },
  regression: { label: 'Regressed', color: 'bg-amber-500/10 text-amber-400 border-amber-500/30' },
  wash: { label: 'Wash', color: 'bg-slate-500/10 text-slate-400 border-slate-500/30' },
  scaffolding: { label: 'Foundation', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30' },
  loss: { label: 'Null Result', color: 'bg-slate-700/30 text-slate-400 border-slate-600/40' },
};

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

export function CalibrationTimeline({ rounds }: { rounds: CalibrationRound[] }) {
  return (
    <ol className="space-y-4">
      {rounds.map((r) => {
        const style = OUTCOME_STYLES[r.outcome];
        return (
          <li
            key={r.round}
            className="relative rounded-lg border border-slate-700/50 bg-slate-900/30 p-5 transition-colors hover:border-slate-600"
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-full border border-slate-700 bg-slate-800 text-sm font-semibold text-slate-200">
                  {r.round}
                </div>
                <div>
                  <div className="font-semibold text-slate-100">{r.label}</div>
                  <div className="text-xs text-slate-500">{r.date}</div>
                </div>
              </div>
              <span
                className={`rounded-full border px-2.5 py-0.5 text-xs font-medium ${style.color}`}
              >
                {style.label}
              </span>
            </div>

            <p className="mt-3 text-sm text-slate-400">{r.summary}</p>

            <div className="mt-4 grid grid-cols-3 gap-2 text-xs">
              <div className="rounded border border-slate-700/50 bg-slate-950/40 p-2">
                <div className="text-slate-500">±25%</div>
                <div className="mt-0.5 font-mono text-sm text-slate-200">{pct(r.coreHit25)}</div>
              </div>
              <div className="rounded border border-slate-700/50 bg-slate-950/40 p-2">
                <div className="text-slate-500">±35%</div>
                <div className="mt-0.5 font-mono text-sm text-slate-200">{pct(r.coreHit35)}</div>
              </div>
              <div className="rounded border border-slate-700/50 bg-slate-950/40 p-2">
                <div className="text-slate-500">±50%</div>
                <div className="mt-0.5 font-mono text-sm text-slate-200">{pct(r.coreHit50)}</div>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
