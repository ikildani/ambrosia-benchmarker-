'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowTopRightOnSquareIcon } from '@heroicons/react/24/outline';
import type { PredictedTerms as Terms, CompRow, AssetBrief } from './types';
import { SectionCard, Pill, ExternalLink, EmptyState, btnSecondary, btnGhost } from './ui';
import { fmtM, fmtRoyalty, fmtPhaseDb, sourceLabel, fmtDate } from './format';
import { calculatorHref } from './calculator-link';

function relaxationLabel(r: string | null | undefined): { text: string; tone: 'emerald' | 'amber' | 'rose' } {
  if (!r || r === 'none') return { text: 'Exact: TA + modality + phase', tone: 'emerald' };
  if (r === 'modality_only') return { text: 'Widened to modality', tone: 'amber' };
  if (r === 'ta_only') return { text: 'Widened to therapeutic area', tone: 'rose' };
  return { text: r.replace(/_/g, ' '), tone: 'amber' };
}

function matchBadge(score: number): { label: string; tone: 'emerald' | 'amber' | 'neutral' } {
  if (score >= 0.8) return { label: 'Exact', tone: 'emerald' };
  if (score >= 0.55) return { label: 'Strong', tone: 'amber' };
  return { label: 'Related', tone: 'neutral' };
}

type SortKey = 'relevance' | 'year' | 'upfront' | 'total';

export function PredictedTerms({ terms, asset }: { terms: Terms; asset: AssetBrief['asset'] }) {
  const [sort, setSort] = useState<SortKey>('relevance');
  const [showAll, setShowAll] = useState(false);
  const th = terms.thesis;
  const relax = relaxationLabel(terms.relaxation);
  const calcHref = calculatorHref(asset);

  const comps = useMemo(() => {
    const rows = [...terms.comps];
    rows.sort((a, b) => {
      if (sort === 'year') return (b.year ?? 0) - (a.year ?? 0);
      if (sort === 'upfront') return (b.upfront_m ?? -1) - (a.upfront_m ?? -1);
      if (sort === 'total') return (b.total_deal_value_m ?? -1) - (a.total_deal_value_m ?? -1);
      return b.match_score - a.match_score;
    });
    return showAll ? rows : rows.slice(0, 8);
  }, [terms.comps, sort, showAll]);

  const hasTerms = !terms.insufficient && th && th.predicted_upfront_mid != null;

  return (
    <SectionCard
      id="terms"
      title="Predicted terms"
      meta={
        <span className="inline-flex flex-wrap items-center gap-1.5">
          <span>n = {terms.n}</span>
          <span>· {terms.verified_n} verified</span>
          <Pill tone={relax.tone} title="How far the comparable pool had to be widened to reach the minimum">{relax.text}</Pill>
          {th?.terms_basis && <Pill title="Basis of the predicted terms">{th.terms_basis.replace(/_/g, ' ')}</Pill>}
        </span>
      }
    >
      {hasTerms && th ? (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <TermStat label="Upfront" low={th.predicted_upfront_low} mid={th.predicted_upfront_mid} high={th.predicted_upfront_high} fmt={fmtM} />
          <TermStat label="Total value" low={th.predicted_total_low} mid={th.predicted_total_mid} high={th.predicted_total_high} fmt={fmtM} />
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Royalty</p>
            <p className="mt-0.5 font-mono text-xl tabular-nums text-neutral-900 dark:text-neutral-50">{fmtRoyalty(th.predicted_royalty_low, th.predicted_royalty_high)}</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">median {th.predicted_royalty_mid != null ? `${Number(th.predicted_royalty_mid).toFixed(1)}%` : '—'}</p>
          </div>
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Confidence</p>
            <p className="mt-0.5 font-mono text-xl tabular-nums text-neutral-900 dark:text-neutral-50">{th.thesis_confidence}%</p>
            <p className="text-xs text-neutral-500 dark:text-neutral-400">
              dispersion IQR/median {th.comp_dispersion != null ? th.comp_dispersion.toFixed(2) : '—'}
              {th.generated_at && <> · {fmtDate(th.generated_at)}</>}
            </p>
          </div>
        </div>
      ) : (
        <div className="rounded-md border border-neutral-300 bg-neutral-50 px-4 py-3 text-sm text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800/50 dark:text-neutral-200">
          <p className="font-medium">Insufficient comparables for a defensible range.</p>
          <p className="mt-1 text-xs text-neutral-600 dark:text-neutral-300">
            {terms.n} comparable{terms.n === 1 ? '' : 's'} found; {terms.min_comps} are required before terms are predicted. No numbers are shown rather than a range that would not survive committee scrutiny.
            {terms.excluded_approved_ma > 0 && <> {terms.excluded_approved_ma} approved-stage M&amp;A deal{terms.excluded_approved_ma === 1 ? '' : 's'} excluded as pre-approval mismatches.</>}
          </p>
        </div>
      )}

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-200 pt-4 dark:border-neutral-800">
        <div className="text-xs text-neutral-600 dark:text-neutral-300">
          <span className="font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Comps median</span>{' '}
          <span className="font-mono tabular-nums">{fmtM(terms.comps_median_upfront_m)}</span> upfront · <span className="font-mono tabular-nums">{fmtM(terms.comps_median_total_m)}</span> total
          {th?.calculator_upfront_mid != null && (
            <span className="ml-3 border-l border-neutral-300 pl-3 dark:border-neutral-700">
              <span className="font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Calculator for this profile</span>{' '}
              <span className="font-mono tabular-nums">{fmtM(th.calculator_upfront_mid)}</span> upfront
              {th.calculator_total_mid != null && <> · <span className="font-mono tabular-nums">{fmtM(th.calculator_total_mid)}</span> total</>}
            </span>
          )}
        </div>
        <Link href={calcHref} className={btnSecondary}>
          Open in calculator <ArrowTopRightOnSquareIcon className="h-3.5 w-3.5" aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">Comparable transactions</h3>
          <label className="text-xs text-neutral-600 dark:text-neutral-300">
            Sort{' '}
            <select value={sort} onChange={e => setSort(e.target.value as SortKey)} className="rounded-md border border-neutral-300 bg-white px-2 py-1 text-xs dark:border-neutral-700 dark:bg-neutral-900">
              <option value="relevance">Relevance</option>
              <option value="year">Newest</option>
              <option value="upfront">Upfront</option>
              <option value="total">Total value</option>
            </select>
          </label>
        </div>
        {terms.comps.length === 0 ? (
          <div className="mt-3"><EmptyState title="No comparable transactions" detail="The calculator comps engine returned nothing for this TA, modality and phase." /></div>
        ) : (
          <div className="mt-2 overflow-x-auto">
            <table className="w-full min-w-[820px] text-xs">
              <caption className="sr-only">Comparable licensing deals with sources</caption>
              <thead>
                <tr className="border-b border-neutral-200 text-left text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:border-neutral-700 dark:text-neutral-400">
                  <th scope="col" className="py-2 pr-3">Year</th>
                  <th scope="col" className="min-w-[200px] py-2 pr-3">Parties</th>
                  <th scope="col" className="py-2 pr-3">Asset</th>
                  <th scope="col" className="py-2 pr-3">Phase</th>
                  <th scope="col" className="py-2 pr-3 text-right">Upfront</th>
                  <th scope="col" className="py-2 pr-3 text-right">Total</th>
                  <th scope="col" className="py-2 pr-3 text-right">Royalty</th>
                  <th scope="col" className="py-2 pr-3 text-center">Match</th>
                  <th scope="col" className="py-2 pr-3 text-center">Verified</th>
                  <th scope="col" className="py-2 text-center">Source</th>
                </tr>
              </thead>
              <tbody>
                {comps.map(c => <CompTr key={c.id} c={c} median={terms.comps_median_upfront_m} />)}
              </tbody>
            </table>
            {terms.comps.length > 8 && (
              <button type="button" onClick={() => setShowAll(v => !v)} className={`${btnGhost} mt-2`}>
                {showAll ? 'Show fewer' : `Show all ${terms.comps.length}`}
              </button>
            )}
          </div>
        )}
      </div>
    </SectionCard>
  );
}

function TermStat({ label, low, mid, high, fmt }: { label: string; low: number | null; mid: number | null; high: number | null; fmt: (v: number | null) => string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">{label}</p>
      <p className="mt-0.5 font-mono text-xl tabular-nums text-neutral-900 dark:text-neutral-50">{fmt(mid)}</p>
      <p className="font-mono text-xs tabular-nums text-neutral-500 dark:text-neutral-400">P25 {fmt(low)} · P75 {fmt(high)}</p>
    </div>
  );
}

function CompTr({ c, median }: { c: CompRow; median: number | null }) {
  const badge = matchBadge(c.match_score);
  const tone = (v: number | null) => v == null || median == null ? 'text-neutral-500 dark:text-neutral-400' : v >= median * 1.15 ? 'text-emerald-700 dark:text-emerald-400' : v <= median * 0.85 ? 'text-amber-700 dark:text-amber-400' : 'text-neutral-800 dark:text-neutral-200';
  return (
    <tr className="border-b border-neutral-100 dark:border-neutral-800/70" title={c.relevance_reasons.join(' · ') || undefined}>
      <td className="py-2 pr-3 font-mono tabular-nums text-neutral-600 dark:text-neutral-300">{c.year ?? (c.announced_date ? c.announced_date.slice(0, 4) : '—')}</td>
      <td className="py-2 pr-3"><span className="font-medium text-neutral-900 dark:text-neutral-100">{c.licensor_name || '?'}</span><span className="mx-1 text-neutral-400">→</span><span className="text-neutral-700 dark:text-neutral-300">{c.licensee_name || '?'}</span></td>
      <td className="max-w-[160px] truncate py-2 pr-3 text-neutral-600 dark:text-neutral-300">{c.asset_name || '—'}</td>
      <td className="py-2 pr-3 text-neutral-600 dark:text-neutral-300">{fmtPhaseDb(c.phase_at_signing)}</td>
      <td className={`py-2 pr-3 text-right font-mono tabular-nums ${tone(c.upfront_m)}`}>{fmtM(c.upfront_m)}</td>
      <td className="py-2 pr-3 text-right font-mono tabular-nums text-neutral-800 dark:text-neutral-200">{fmtM(c.total_deal_value_m)}</td>
      <td className="py-2 pr-3 text-right font-mono tabular-nums text-neutral-600 dark:text-neutral-300">{fmtRoyalty(c.royalty_low_pct, c.royalty_high_pct)}</td>
      <td className="py-2 pr-3 text-center"><Pill tone={badge.tone}>{badge.label}</Pill></td>
      <td className="py-2 pr-3 text-center text-neutral-600 dark:text-neutral-300">{c.verification_status === 'verified' ? 'Yes' : c.verification_status ? c.verification_status.replace(/_/g, ' ') : '—'}</td>
      <td className="py-2 text-center">
        {c.source_url && c.url_status !== 'dead'
          ? <ExternalLink href={c.source_url}>{sourceLabel(c.source_type)}</ExternalLink>
          : <span className={`text-neutral-500 dark:text-neutral-400 ${c.url_status === 'dead' ? 'line-through' : ''}`} title={c.url_status === 'dead' ? 'Source no longer available' : undefined}>{sourceLabel(c.source_type)}</span>}
      </td>
    </tr>
  );
}
