/**
 * Accuracy rollup table for /admin/outcomes: source × window cells with n,
 * median APE (upfront / total), within-band rates, buyer hit, window hit and
 * value captured. Cells below MIN_N print counts only (accuracyGate).
 * Server-renderable (no hooks).
 */

import { WINDOW_LABELS, accuracyGate } from '@/lib/outcomes/admin-view';
import type { AccuracySummary } from '@/lib/outcomes/statements';

const TH = 'py-2 pr-3 text-right font-medium';

export function AccuracyRollupTable({ summary }: { summary: AccuracySummary }) {
  if (!summary.sources.length) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-8 text-center text-slate-400">
        No rollup cells yet. The nightly rollup writes accuracy_rollups once at least one outcome is accepted or one prediction has expired.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-slate-700/60 bg-slate-900/30">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left text-[10px] uppercase tracking-wider text-slate-500">
            <th className="py-2 pl-4 pr-3 font-medium">Source</th>
            <th className="py-2 pr-3 font-medium">Window</th>
            <th className={TH}>n</th>
            <th className={TH}>Median err upfront</th>
            <th className={TH}>Median err total</th>
            <th className={TH}>In band upfront</th>
            <th className={TH}>In band total</th>
            <th className={TH}>Buyer hit</th>
            <th className={TH}>Window hit</th>
            <th className={`${TH} pr-4`}>Value captured</th>
          </tr>
        </thead>
        <tbody className="text-slate-300">
          {summary.sources.map((s) => s.windows.map((w, i) => {
            const c = accuracyGate(w, summary.minN);
            return (
              <tr key={`${s.source}-${w.window}`} className="border-t border-slate-800">
                <td className="py-2 pl-4 pr-3 text-slate-200">{i === 0 ? s.label : ''}</td>
                <td className="py-2 pr-3 text-slate-400">{WINDOW_LABELS[w.window]}</td>
                <td className="py-2 pr-3 text-right font-mono text-slate-200">
                  {c.n}{c.expired && <span className="text-slate-500"> · {c.expired}</span>}
                </td>
                {c.meaningful ? (
                  <>
                    <td className="py-2 pr-3 text-right font-mono">{c.medianErrorUpfront}</td>
                    <td className="py-2 pr-3 text-right font-mono">{c.medianErrorTotal}</td>
                    <td className="py-2 pr-3 text-right font-mono">{c.withinBandUpfront}</td>
                    <td className="py-2 pr-3 text-right font-mono">{c.withinBandTotal}</td>
                    <td className="py-2 pr-3 text-right font-mono">{c.buyerHitRate}</td>
                    <td className="py-2 pr-3 text-right font-mono">{c.windowHitRate}</td>
                  </>
                ) : (
                  <td colSpan={6} className="py-2 pr-3 text-right text-slate-500">{c.copy}</td>
                )}
                <td className="py-2 pr-4 text-right font-mono text-teal-300">{c.valueCaptured}</td>
              </tr>
            );
          }))}
        </tbody>
      </table>
      <div className="border-t border-slate-800 px-4 py-2 text-[11px] text-slate-500">
        Rates print at {summary.minN} or more accepted outcomes per cell. Window is by resolution date; expired predictions count against window hit only.
        {summary.computedAt && <span> Computed {summary.computedAt.slice(0, 16).replace('T', ' ')} UTC.</span>}
      </div>
    </div>
  );
}
