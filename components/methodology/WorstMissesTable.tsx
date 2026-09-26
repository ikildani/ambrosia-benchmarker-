import Link from 'next/link';
import { loadAccuracyData } from '@/lib/accuracy-dashboard-data';

/**
 * Largest errors in core scope for the engine methodology page.
 *
 * Reads the versioned backtest report (__tests__/backtest/baseline-errors.json)
 * through the same loader the /accuracy page uses, so the rows shown here are
 * the engine's own measured misses — never hand-picked cases. Earlier versions
 * hardcoded six M&A "failure cases" that were not in the backtest corpus.
 */
function signedPct(x: number): string {
  const v = Math.round(x * 100);
  return `${v > 0 ? '+' : ''}${v}%`;
}

const ROWS_SHOWN = 6;

export function WorstMissesTable() {
  const data = loadAccuracyData();
  if (!data) return null;

  const rows = data.worstMisses.slice(0, ROWS_SHOWN);
  if (rows.length === 0) return null;

  const runDate = new Date(data.runAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

  return (
    <div className="my-8">
      <h3 className="mb-4 text-sm font-semibold uppercase tracking-wider text-slate-400">
        Largest errors in core scope (Phase 2/3 licensing), from the {runDate} backtest.
      </h3>
      <div className="overflow-x-auto rounded-lg border border-slate-800">
        <table className="w-full text-sm">
          <thead className="bg-slate-900/50 text-xs uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3 text-left font-normal">Year</th>
              <th className="px-4 py-3 text-left font-normal">Licensor → Licensee</th>
              <th className="px-4 py-3 text-left font-normal">TA · phase · modality</th>
              <th className="px-4 py-3 text-right font-normal">Actual upfront</th>
              <th className="px-4 py-3 text-right font-normal">Predicted</th>
              <th className="px-4 py-3 text-right font-normal">Signed error</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-800/70">
            {rows.map((w) => (
              <tr key={w.id} className="text-slate-300">
                <td className="px-4 py-3 font-mono text-slate-400">{w.year}</td>
                <td className="px-4 py-3">
                  <div className="text-slate-200">{w.licensor}</div>
                  <div className="text-xs text-slate-500">→ {w.licensee}</div>
                </td>
                <td className="px-4 py-3 text-xs text-slate-400">
                  {w.therapeuticArea} · {w.phase} · {w.modality}
                </td>
                <td className="px-4 py-3 text-right font-mono text-slate-300">
                  ${w.actualUpfront_M}M
                </td>
                <td className="px-4 py-3 text-right font-mono text-slate-300">
                  ${w.predictedUpfront_M.toFixed(0)}M
                </td>
                <td className="px-4 py-3 text-right font-mono text-amber-400">
                  {signedPct(w.errorPct)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-slate-500">
        These are the engine&rsquo;s largest signed errors on disclosed upfronts. Most are overshoots on
        small ex-US or option-style deals; the undershoots are strategic premiums the rNPV frame cannot
        see. Full list on{' '}
        <Link href="/accuracy" className="text-teal-400 underline-offset-2 hover:underline">/accuracy</Link>.
      </p>
    </div>
  );
}
