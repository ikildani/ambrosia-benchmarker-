'use client';

/**
 * ComparableDealsPanel — shows the closest real disclosed deals for the
 * candidate asset profile. Core directional-context surface: BD users
 * anchor negotiations on real comparable outcomes, not model predictions.
 *
 * Ranks deals by composite similarity (TA + phase + modality + structure
 * + recency). Shows licensor/licensee, year, upfront, total, indication,
 * and a source link when available so the user can verify.
 *
 * Directional-positioning principle: the calculator is a benchmark tool,
 * not a prediction engine. Surface real deals prominently; let the user
 * form their own view from the comps.
 */

import { useMemo } from 'react';
import { getClosestComparables, type ComparableDealForUI } from '@/lib/peer-benchmark';
import type { DealStructure } from '@/lib/financial/deal-structure-classifier';

interface Props {
  therapeuticArea?: string;
  phase?: string;
  modality?: string;
  dealType?: string;
  territory?: string;
  dealStructure?: DealStructure;
  candidateUpfront_M?: number;
  candidateTotalDeal_M?: number;
  /** How many deals to show. Default 6. */
  limit?: number;
}

function fmtM(n: number): string {
  if (n >= 1000) return `$${(n / 1000).toFixed(1)}B`;
  return `$${Math.round(n)}M`;
}

function phaseLabel(p: string): string {
  const map: Record<string, string> = {
    preclinical: 'Preclinical',
    phase1: 'Phase 1',
    phase1_2: 'Phase 1/2',
    phase2: 'Phase 2',
    phase2_3: 'Phase 2/3',
    phase3: 'Phase 3',
    approved: 'Approved',
  };
  return map[p] ?? p;
}

function dealTypeLabel(dt: string): string {
  const map: Record<string, string> = {
    licensing: 'License',
    license: 'License',
    codevelopment: 'Co-dev',
    co_development: 'Co-dev',
    collaboration: 'Collab',
    acquisition: 'Acquisition',
    option: 'Option',
  };
  return map[dt] ?? dt;
}

function modalityLabel(m: string): string {
  return m.replace(/_/g, ' ').replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase()).trim();
}

function matchBadgeStyle(score: number): string {
  if (score >= 0.75) return 'bg-teal-500/15 text-teal-300 border-teal-500/30';
  if (score >= 0.50) return 'bg-cyan-500/15 text-cyan-300 border-cyan-500/30';
  if (score >= 0.30) return 'bg-slate-700/40 text-slate-300 border-slate-600/40';
  return 'bg-slate-800/40 text-slate-400 border-slate-700/40';
}

function matchLabel(score: number): string {
  if (score >= 0.75) return 'Very close match';
  if (score >= 0.50) return 'Close match';
  if (score >= 0.30) return 'Directional match';
  return 'Loose match';
}

function matchStars(score: number): { count: number; color: string } {
  if (score >= 0.80) return { count: 3, color: 'text-teal-400' };
  if (score >= 0.60) return { count: 2, color: 'text-cyan-400' };
  return { count: 1, color: 'text-slate-400' };
}

function StarBadge({ score }: { score: number }) {
  const { count, color } = matchStars(score);
  return (
    <span className={`inline-flex items-center gap-0.5 ${color}`} aria-label={`${count} star match`}>
      {Array.from({ length: 3 }, (_, i) => (
        <span key={i} className={i < count ? '' : 'opacity-20'}>&#9733;</span>
      ))}
    </span>
  );
}

export function ComparableDealsPanel(props: Props) {
  const comparables: ComparableDealForUI[] = useMemo(
    () =>
      getClosestComparables({
        therapeuticArea: props.therapeuticArea,
        phase: props.phase,
        modality: props.modality,
        dealType: props.dealType,
        territory: props.territory,
        dealStructure: props.dealStructure,
        candidateUpfront_M: props.candidateUpfront_M,
        candidateTotalDeal_M: props.candidateTotalDeal_M,
        limit: props.limit ?? 6,
      }),
    [
      props.therapeuticArea,
      props.phase,
      props.modality,
      props.dealType,
      props.territory,
      props.dealStructure,
      props.candidateUpfront_M,
      props.candidateTotalDeal_M,
      props.limit,
    ],
  );

  if (!comparables.length) {
    return (
      <div className="rounded-lg border border-slate-700/50 bg-slate-900/30 p-4">
        <div className="text-xs uppercase tracking-wider text-slate-500">
          Comparable disclosed deals
        </div>
        <p className="mt-2 text-sm text-slate-400">
          No matching deals in the current corpus. Try broadening phase or
          modality to see directional comparables.
        </p>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-slate-700/50 bg-slate-900/40 p-4">
      <div className="mb-3 flex items-baseline justify-between gap-2">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-slate-400">
            Comparable Disclosed Deals
          </div>
          <div className="mt-0.5 text-xs text-slate-500">
            Real transactions ranked by match on TA, phase, modality, structure, recency.
            Anchor your negotiation on these — not a model point estimate.
          </div>
        </div>
        <div className="text-[10px] font-mono text-slate-500 whitespace-nowrap">
          {comparables.length} shown
        </div>
      </div>

      <div className="space-y-2">
        {comparables.map((d, i) => (
          <div
            key={`${d.licensor}-${d.licensee}-${d.year}-${i}`}
            className="rounded-md border border-slate-700/40 bg-slate-800/40 p-3 hover:bg-slate-800/60 transition-colors"
          >
            <div className="flex flex-wrap items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2 text-sm">
                  <span className="font-semibold text-white">
                    {d.licensor}
                  </span>
                  <span className="text-slate-500">→</span>
                  <span className="font-semibold text-white">
                    {d.licensee}
                  </span>
                  <span className="text-xs text-slate-500">· {d.year}</span>
                  <StarBadge score={d.matchScore} />
                </div>
                <div className="mt-0.5 text-xs text-slate-400">
                  {phaseLabel(d.phase)} · {modalityLabel(d.modality)} ·{' '}
                  {dealTypeLabel(d.dealType)}
                  {d.indication && ` · ${d.indication}`}
                </div>
                {d.headline && (
                  <div className="mt-1 text-xs text-slate-500 line-clamp-1">
                    {d.headline}
                  </div>
                )}
              </div>

              <div className="flex-shrink-0 text-right">
                <div className="font-mono text-sm font-semibold text-slate-100">
                  {fmtM(d.upfrontM)}{' '}
                  <span className="text-slate-500 font-normal">upfront</span>
                </div>
                <div className="font-mono text-[11px] text-slate-400">
                  {fmtM(d.totalDealValueM)} total
                </div>
              </div>
            </div>

            <div className="mt-2 flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-700/30">
              <div className="flex items-center gap-2">
                <span
                  className={`rounded-full border px-2 py-0.5 text-[10px] font-medium ${matchBadgeStyle(d.matchScore)}`}
                >
                  {matchLabel(d.matchScore)}
                </span>
                <span className="text-[10px] text-slate-500">
                  {d.matchReason}
                </span>
              </div>
              {d.sourceUrl && (
                <a
                  href={d.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 whitespace-nowrap transition-colors"
                >
                  <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  Source
                </a>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-3 pt-3 border-t border-slate-700/30 text-[11px] leading-relaxed text-slate-500">
        <span className="font-semibold text-slate-400">Directional benchmark:</span>{' '}
        your deal&apos;s actual value falls within the 25th–75th percentile of
        similar disclosed comparables. Ranges are wide by nature — biopharma deal
        upfronts genuinely span $20M to $1B+ within any TA segment. This is a
        decision-support tool, not a forecast — for deal-specific predictive
        modeling, see AlaricAI.
      </div>
    </div>
  );
}
