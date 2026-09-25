/**
 * "Resolved outcomes" block for the public methodology page.
 *
 * Prints the live outcome ledger by source and window from an
 * AccuracySummary (lib/outcomes/statements getAccuracySummary). A cell prints
 * its rates only when `meaningful` (n ≥ minN); otherwise it prints
 * "n resolved so far; figures publish at N". Pure and server-renderable, so
 * the page passes the summary in and tests render it with fixtures.
 *
 * Typography and spacing mirror app/methodology/page.tsx (prose section,
 * not-prose tables, slate palette, dark-mode aware).
 */

import { WINDOW_LABELS, accuracyGate } from '@/lib/outcomes/admin-view';
import type { AccuracySummary } from '@/lib/outcomes/statements';

const TH = 'py-2 pr-4 text-right font-medium';
const TD = 'py-2 pr-4 text-right font-mono';

export function ResolvedOutcomesSection({ summary }: { summary: AccuracySummary }) {
  const computedAt = summary.computedAt ? summary.computedAt.slice(0, 10) : null;
  return (
    <div data-testid="resolved-outcomes">
      <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-200">Resolved outcomes (live ledger)</h3>
      <p className="text-slate-600 dark:text-slate-300">
        Every range the calculator prints, every deal brief and every Radar licensing call is recorded as a prediction with its inputs.
        When a deal for that licensor is later announced, or the client reports the signed terms, the prediction is scored against it:
        median absolute error on upfront and total value, the share of actuals inside the predicted band, whether a named buyer signed,
        and whether signing fell in the predicted window. Predictions younger than 30 days are never matched, so a calculation cannot be
        scored against the deal that prompted it. Figures for a cell publish once it holds {summary.minN} resolved outcomes.
      </p>
      {summary.sources.length === 0 ? (
        <p className="not-prose mt-4 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-4 py-3 text-sm text-slate-600 dark:text-slate-300">
          No predictions have resolved yet. The ledger began recording in September 2026; figures publish once a cell reaches {summary.minN} resolved outcomes.
        </p>
      ) : (
        <div className="not-prose mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wider text-slate-500 dark:text-slate-400">
                <th className="py-2 pr-4 font-medium">Source</th>
                <th className="py-2 pr-4 font-medium">Window</th>
                <th className={TH}>Resolved</th>
                <th className={TH}>Median error, upfront</th>
                <th className={TH}>Median error, total</th>
                <th className={TH}>In band, upfront</th>
                <th className={TH}>In band, total</th>
                <th className={TH}>Buyer named</th>
                <th className={TH}>In window</th>
              </tr>
            </thead>
            <tbody className="text-slate-700 dark:text-slate-300">
              {summary.sources.map((s) => s.windows.map((w, i) => {
                const c = accuracyGate(w, summary.minN);
                return (
                  <tr key={`${s.source}-${w.window}`} className="border-t border-slate-200 dark:border-slate-700">
                    <td className="py-2 pr-4 font-medium">{i === 0 ? s.label : ''}</td>
                    <td className="py-2 pr-4 text-slate-500 dark:text-slate-400">{WINDOW_LABELS[w.window]}</td>
                    <td className={TD}>{c.n}</td>
                    {c.meaningful ? (
                      <>
                        <td className={TD}>{c.medianErrorUpfront}</td>
                        <td className={TD}>{c.medianErrorTotal}</td>
                        <td className={TD}>{c.withinBandUpfront}</td>
                        <td className={TD}>{c.withinBandTotal}</td>
                        <td className={TD}>{c.buyerHitRate}</td>
                        <td className={TD}>{c.windowHitRate}</td>
                      </>
                    ) : (
                      <td colSpan={6} className="py-2 pr-4 text-right text-slate-500 dark:text-slate-400">{c.copy}</td>
                    )}
                  </tr>
                );
              }))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-slate-500 dark:text-slate-400">
        Median error is the median absolute percentage error of the predicted mid-point against the disclosed term. Window is by resolution date.
        Expired predictions (no deal within 180 days of the predicted window) count against the window rate only.
        {computedAt && <> Ledger last rolled up {computedAt}.</>}
      </p>
    </div>
  );
}
