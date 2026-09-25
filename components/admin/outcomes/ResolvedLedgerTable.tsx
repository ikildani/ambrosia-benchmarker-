/**
 * Resolved ledger table for /admin/outcomes: accepted outcomes, newest first.
 * Predicted vs actual upfront and total, APE, within-band, buyer hit,
 * matched_by; client-reported rows add first offer / our ask / value captured.
 * Server-renderable (no hooks).
 */

import type { LedgerView } from '@/lib/outcomes/admin-view';

const MATCHED_TONE: Record<LedgerView['matchedBy'], string> = {
  auto: 'border-slate-600 bg-slate-800/60 text-slate-300',
  manual: 'border-teal-500/40 bg-teal-500/15 text-teal-300',
  client: 'border-amber-500/40 bg-amber-500/15 text-amber-300',
};

function Cell({ label, predicted, actual, ape, band }: { label: string; predicted: string; actual: string; ape: string; band: string }) {
  return (
    <div className="font-mono text-xs">
      <div className="text-[10px] uppercase tracking-wider text-slate-500">{label}</div>
      <div className="text-slate-200">{actual}</div>
      <div className="text-slate-500">pred {predicted}</div>
      <div className="text-slate-400">err {ape} · band {band}</div>
    </div>
  );
}

export function ResolvedLedgerTable({ rows }: { rows: LedgerView[] }) {
  if (!rows.length) {
    return (
      <div className="rounded-lg border border-slate-700 bg-slate-900/30 p-8 text-center text-slate-400">
        No accepted outcomes yet. Rows appear when the resolver matches a deal at 0.80 or above, a queued match is accepted, or a client reports signed terms.
      </div>
    );
  }
  return (
    <div className="space-y-3">
      {rows.map((r) => (
        <div key={r.id} className="rounded-lg border border-slate-700/60 bg-slate-900/30 p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span className="font-semibold text-slate-100">{r.licensor} → {r.licensee}</span>
            <span className="rounded-full bg-slate-700/50 px-2 py-0.5 text-xs text-slate-300">signed {r.signedDate}</span>
            <span className={`rounded-md border px-2 py-0.5 text-[11px] ${MATCHED_TONE[r.matchedBy]}`}>{r.matchedByLabel}</span>
            <span className="text-xs text-slate-500">{r.sourceLabel} · resolved {r.resolvedAt}{r.confidence !== '—' ? ` · score ${r.confidence}` : ''}</span>
            {r.sourceUrl && (
              <a href={r.sourceUrl} target="_blank" rel="noreferrer noopener" className="ml-auto rounded-md border border-slate-600 bg-slate-800/50 px-2.5 py-1 text-[11px] text-slate-200 hover:bg-slate-800">
                {r.sourceHost ?? 'source'} ↗
              </a>
            )}
          </div>
          <div className="mt-1 text-xs text-slate-400">
            {r.asset && <span className="text-slate-300">{r.asset} · </span>}
            <span>{r.indication}</span>
            {' · '}
            <span>{r.phase}</span>
          </div>
          <div className="mt-3 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Cell label="Upfront" predicted={r.predictedUpfront} actual={r.actualUpfront} ape={r.apeUpfront} band={r.withinBandUpfront} />
            <Cell label="Total" predicted={r.predictedTotal} actual={r.actualTotal} ape={r.apeTotal} band={r.withinBandTotal} />
            <div className="font-mono text-xs">
              <div className="text-[10px] uppercase tracking-wider text-slate-500">Buyer · window</div>
              <div className="text-slate-200">named buyer {r.buyerHit}</div>
              <div className="text-slate-400">in window {r.windowHit}</div>
            </div>
            {r.client ? (
              <div className="font-mono text-xs">
                <div className="text-[10px] uppercase tracking-wider text-amber-400/80">Client-reported</div>
                <div className="text-slate-400">first offer {r.client.firstOfferUpfront} / {r.client.firstOfferTotal}</div>
                <div className="text-slate-400">our ask {r.client.ourAskUpfront} / {r.client.ourAskTotal}</div>
                <div className="text-teal-300">value captured {r.client.valueCaptured}</div>
              </div>
            ) : (
              <div className="font-mono text-xs text-slate-600">
                <div className="text-[10px] uppercase tracking-wider text-slate-600">Client-reported</div>
                <div>not reported</div>
              </div>
            )}
          </div>
          {(r.notes || r.reviewedBy) && (
            <div className="mt-2 text-[11px] text-slate-500">
              {r.reviewedBy && <span>reviewed by {r.reviewedBy}</span>}
              {r.notes && <span className="italic">{r.reviewedBy ? ' · ' : ''}{r.notes}</span>}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
