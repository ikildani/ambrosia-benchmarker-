/**
 * Slice heat-map table — accuracy by TA / phase / modality. Sparse-light
 * color coding so users can scan for systematic biases.
 */

import type { SliceRow } from '@/lib/accuracy-dashboard-data';

function pct(x: number): string {
  return `${(x * 100).toFixed(1)}%`;
}

function signedPct(x: number): string {
  const sign = x >= 0 ? '+' : '';
  return `${sign}${(x * 100).toFixed(0)}%`;
}

function hitColor(rate: number): string {
  if (rate >= 0.50) return 'text-teal-400';
  if (rate >= 0.25) return 'text-cyan-400';
  if (rate >= 0.10) return 'text-slate-300';
  return 'text-slate-500';
}

function biasColor(signedPct: number): string {
  const abs = Math.abs(signedPct);
  if (abs <= 0.15) return 'text-teal-400';
  if (abs <= 0.40) return 'text-slate-300';
  if (abs <= 1.00) return 'text-amber-400';
  return 'text-red-400';
}

export function SliceTable({ rows, dimension }: { rows: SliceRow[]; dimension: string }) {
  if (rows.length === 0) {
    return <p className="text-sm text-slate-500">No slices with ≥2 deals.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full border-separate border-spacing-0 text-sm">
        <thead>
          <tr className="text-left text-xs uppercase tracking-wider text-slate-500">
            <th className="border-b border-slate-800 pb-2 pr-4 font-normal">{dimension}</th>
            <th className="border-b border-slate-800 pb-2 pr-4 text-right font-normal">n</th>
            <th className="border-b border-slate-800 pb-2 pr-4 text-right font-normal">±25%</th>
            <th className="border-b border-slate-800 pb-2 pr-4 text-right font-normal">±35%</th>
            <th className="border-b border-slate-800 pb-2 pr-4 text-right font-normal">Mean signed err</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr
              key={r.label}
              className="text-slate-200 transition-colors hover:bg-slate-900/40"
            >
              <td className="border-b border-slate-800/50 py-2.5 pr-4 capitalize">
                {r.label.replace(/_/g, ' ')}
              </td>
              <td className="border-b border-slate-800/50 py-2.5 pr-4 text-right font-mono text-slate-400">
                {r.n}
              </td>
              <td
                className={`border-b border-slate-800/50 py-2.5 pr-4 text-right font-mono ${hitColor(r.hitRate25)}`}
              >
                {pct(r.hitRate25)}
              </td>
              <td
                className={`border-b border-slate-800/50 py-2.5 pr-4 text-right font-mono ${hitColor(r.hitRate35)}`}
              >
                {pct(r.hitRate35)}
              </td>
              <td
                className={`border-b border-slate-800/50 py-2.5 pr-4 text-right font-mono ${biasColor(r.meanSignedErrorPct)}`}
              >
                {signedPct(r.meanSignedErrorPct)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
