'use client';

import type { IntelRow, AcquirerRow, ThesisRow } from './types';
import { SectionCard, Pill, EmptyState } from './ui';
import { INTEL_LABELS, GAP_LABELS, fmtM, fmtDate } from './format';

export function Landscape({ intel, acquirers, thesis }: { intel: IntelRow[]; acquirers: AcquirerRow[]; thesis: ThesisRow | null }) {
  const named = intel.filter(i => i.competitor_name);
  const byType = new Map<string, IntelRow[]>();
  for (const i of intel) byType.set(i.intel_type, [...(byType.get(i.intel_type) ?? []), i]);

  return (
    <>
      <SectionCard id="landscape" title="Competitive landscape" meta={<span>{intel.length} active signal{intel.length === 1 ? '' : 's'}</span>}>
        {intel.length === 0 ? (
          <EmptyState title="No competitive signals detected" detail="Trial crowding, competitor deals, patent and publication overlap are scanned daily." />
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">By signal type</h3>
              <ul className="mt-2 space-y-1.5">
                {Array.from(byType.entries()).map(([type, rows]) => {
                  const max = Math.max(...rows.map(r => r.intensity));
                  return (
                    <li key={type} className="flex items-center gap-3 text-sm">
                      <span className="w-40 shrink-0 text-neutral-700 dark:text-neutral-300">{INTEL_LABELS[type] ?? type.replace(/_/g, ' ')}</span>
                      <div className="h-2 flex-1 rounded-sm bg-neutral-200 dark:bg-neutral-800" aria-hidden="true"><div className="h-2 rounded-sm bg-neutral-600 dark:bg-neutral-400" style={{ width: `${Math.max(2, Math.min(100, max))}%` }} /></div>
                      <span className="w-10 text-right font-mono text-xs tabular-nums text-neutral-600 dark:text-neutral-300">{Math.round(max)}</span>
                      <span className="sr-only">intensity {Math.round(max)} of 100, {rows.length} signal{rows.length === 1 ? '' : 's'}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
            <div>
              <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Named competitors</h3>
              {named.length === 0 ? <p className="mt-2 text-xs text-neutral-500 dark:text-neutral-400">No named competitor on any signal.</p> : (
                <ul className="mt-2 space-y-2">
                  {named.slice(0, 8).map(i => (
                    <li key={i.id} className="text-xs">
                      <span className="font-medium text-neutral-900 dark:text-neutral-100">{i.competitor_name}</span>
                      <span className="ml-1.5 text-neutral-500 dark:text-neutral-400">{INTEL_LABELS[i.intel_type] ?? i.intel_type.replace(/_/g, ' ')} · {Math.round(i.intensity)}{i.detected_at ? ` · ${fmtDate(i.detected_at)}` : ''}</span>
                      {i.evidence_text && <p className="mt-0.5 line-clamp-2 text-neutral-600 dark:text-neutral-300">{i.evidence_text}</p>}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </SectionCard>

      <SectionCard id="acquirers" title="Proposed acquirers" meta={<span>{acquirers.length} generated{thesis?.likely_acquirers?.length ? ` · ${thesis.likely_acquirers.length} from comps` : ''}</span>}>
        {acquirers.length === 0 && (!thesis || thesis.likely_acquirers.length === 0) ? (
          <EmptyState title="No acquirer proposals yet" detail="The deal creator matches portfolio gaps nightly; proposals appear with rationale, drivers and risks." />
        ) : (
          <div className="space-y-3">
            {acquirers.slice(0, 6).map(a => (
              <article key={a.id} className="rounded-md border border-neutral-200 p-3 dark:border-neutral-800" aria-labelledby={`acq-${a.id}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div>
                    <h3 id={`acq-${a.id}`} className="text-sm font-semibold text-neutral-900 dark:text-neutral-50">{a.acquirer_name}</h3>
                    <div className="mt-1 flex flex-wrap gap-1.5">
                      {a.gap_type && <Pill tone="sky">{GAP_LABELS[a.gap_type] ?? a.gap_type.replace(/_/g, ' ')}</Pill>}
                      {a.status !== 'proposed' && <Pill>{a.status}</Pill>}
                    </div>
                  </div>
                  <dl className="flex gap-4 text-right">
                    <div><dt className="text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Opportunity</dt><dd className="font-mono text-sm tabular-nums text-neutral-900 dark:text-neutral-100">{Math.round(a.opportunity_score)}</dd></div>
                    <div><dt className="text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Fit</dt><dd className="font-mono text-sm tabular-nums text-neutral-900 dark:text-neutral-100">{Math.round(a.strategic_fit_score)}</dd></div>
                    <div><dt className="text-[10px] uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Timing</dt><dd className="font-mono text-sm tabular-nums text-neutral-900 dark:text-neutral-100">{Math.round(a.timing_score)}</dd></div>
                  </dl>
                </div>
                <p className="mt-2 text-sm text-neutral-700 dark:text-neutral-300">{a.rationale}</p>
                {a.gap_detail && <p className="mt-1 text-xs text-neutral-500 dark:text-neutral-400">{a.gap_detail}</p>}
                <div className="mt-2 grid gap-2 text-xs sm:grid-cols-2">
                  {a.strategic_drivers.length > 0 && <div><p className="font-semibold text-neutral-600 dark:text-neutral-300">Drivers</p><ul className="mt-0.5 list-disc pl-4 text-neutral-600 dark:text-neutral-300">{a.strategic_drivers.slice(0, 4).map((d, i) => <li key={i}>{d}</li>)}</ul></div>}
                  {a.risk_factors.length > 0 && <div><p className="font-semibold text-neutral-600 dark:text-neutral-300">Risks</p><ul className="mt-0.5 list-disc pl-4 text-neutral-600 dark:text-neutral-300">{a.risk_factors.slice(0, 4).map((d, i) => <li key={i}>{d}</li>)}</ul></div>}
                </div>
                {(a.predicted_upfront_mid != null || a.predicted_total_mid != null) && (
                  <p className="mt-2 font-mono text-xs tabular-nums text-neutral-500 dark:text-neutral-400">Buyer-adjusted midpoint: {fmtM(a.predicted_upfront_mid)} upfront · {fmtM(a.predicted_total_mid)} total · confidence {a.confidence}%</p>
                )}
              </article>
            ))}
            {thesis && thesis.likely_acquirers.length > 0 && (
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Most active licensees in the comp set: {thesis.likely_acquirers.slice(0, 5).map(l => `${l.name}${l.dealCount ? ` (${l.dealCount})` : ''}`).join(', ')}.
              </p>
            )}
          </div>
        )}
      </SectionCard>
    </>
  );
}
