'use client';

/**
 * "Deals like yours": the first thing on the results page.
 *
 * Leads with real, primary-sourced comparable deals from deals_verified
 * (GET /api/deals/verified-comps): what was actually paid (median and middle
 * half of upfronts), how many deals, and the closest deals with a link to the
 * filing or press release. The calculator's estimate follows as "Adjusted for
 * your program", with the factors that moved it, how far it sits from the
 * comparable median, and an honest High / Medium / Low confidence label.
 *
 * Free: summary, top 3 deals with sources, the confidence label.
 * Pro / report: the full list, CSV export, and the adjustment breakdown.
 */

import { useEffect, useMemo, useState } from 'react';
import { formatCurrency, formatRange, type CalculationInput, type CalculationResult } from '@/lib/calculations';
import {
  computeConfidence,
  describeSelection,
  estimateVsComps,
  topDrivers,
  phaseName,
  type CompRung,
  type CompsSummary,
  type ConfidenceResult,
  type VerifiedComp,
} from '@/lib/comps/verified-comps';

export interface VerifiedCompsResponse {
  summary: CompsSummary;
  comps: VerifiedComp[];
  totalComps: number;
  closeCount: number;
  rungIndex: number | null;
  rung: CompRung | null;
  relaxed: boolean;
  limited: boolean;
  headlineBasis?: 'all' | 'asset_purchases';
  assetPurchaseCount?: number;
  companyAcquisitionCount?: number;
  acquisitionNote?: string | null;
  confidenceCap?: ConfidenceResult['level'] | null;
}

export type VerifiedCompsState =
  | { status: 'loading' }
  | { status: 'error' }
  | { status: 'ready'; data: VerifiedCompsResponse };

/** Fetches the comp pool once per query. Shared by Results (confidence) and the panel. */
export function useVerifiedComps(inputs: Partial<CalculationInput> | undefined): VerifiedCompsState {
  const key = inputs
    ? [inputs.therapeuticArea, inputs.phase, inputs.modality, inputs.indication, inputs.dealType, inputs.territory].map(v => v ?? '').join('|')
    : '';
  const [state, setState] = useState<{ key: string; value: VerifiedCompsState }>({ key: '', value: { status: 'loading' } });

  useEffect(() => {
    if (!inputs?.therapeuticArea) return;
    const controller = new AbortController();
    const params = new URLSearchParams({
      therapeuticArea: inputs.therapeuticArea,
      phase: inputs.phase ?? '',
      modality: inputs.modality ?? '',
      indication: inputs.indication ?? '',
      dealType: inputs.dealType ?? 'licensing',
      territory: inputs.territory ?? 'global',
    });
    setState({ key, value: { status: 'loading' } });
    fetch(`/api/deals/verified-comps?${params}`, { signal: controller.signal })
      .then(res => (res.ok ? res.json() : Promise.reject(new Error(`verified-comps ${res.status}`))))
      .then((data: VerifiedCompsResponse) => {
        if (controller.signal.aborted) return;
        if (!data || !Array.isArray(data.comps) || !data.summary) throw new Error('bad payload');
        setState({ key, value: { status: 'ready', data } });
      })
      .catch(err => {
        if (controller.signal.aborted) return;
        console.warn('[DealsLikeYours] comparable deals unavailable:', err);
        setState({ key, value: { status: 'error' } });
      });
    return () => controller.abort();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return state.key === key ? state.value : { status: 'loading' };
}

/** Confidence for the whole page, or null until the comps have loaded. */
export function verifiedConfidence(state: VerifiedCompsState, result: CalculationResult): ConfidenceResult | null {
  if (state.status !== 'ready') return null;
  const b = result.drillDown?.upfront?.baseline;
  return computeConfidence(state.data.closeCount, b ? { source: b.source, sampleSize: b.sampleSize } : null, state.data.confidenceCap);
}

const CONFIDENCE_STYLE: Record<ConfidenceResult['level'], { label: string; cls: string; dot: string }> = {
  high: { label: 'High confidence', cls: 'border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300', dot: 'bg-emerald-400' },
  medium: { label: 'Medium confidence', cls: 'border-sky-500/40 bg-sky-500/10 text-sky-700 dark:text-sky-300', dot: 'bg-sky-400' },
  low: { label: 'Low confidence', cls: 'border-amber-500/40 bg-amber-500/10 text-amber-700 dark:text-amber-300', dot: 'bg-amber-400' },
};

const TERRITORY_SHORT: Record<string, string> = {
  global: 'Global', us: 'US', us_only: 'US', ex_us: 'Ex-US', china: 'China', greater_china: 'Greater China',
  japan: 'Japan', europe: 'Europe', regional: 'Regional', asia_pacific: 'Asia-Pacific', ex_china: 'Ex-China', us_eu: 'US + EU',
};

const ACQUISITION_KIND_LABEL: Record<string, string> = {
  asset: 'Asset purchase',
  company: 'Company acquisition',
  unknown: 'Acquisition, type not stated',
};

function territoryText(c: VerifiedComp): string | null {
  if (c.dealType && /acqui|merger/i.test(c.dealType)) return null;
  const t = (c.territory ?? '').trim();
  if (!t || t === 'other') return null;
  return TERRITORY_SHORT[t] ?? (t.length > 28 ? `${t.slice(0, 26)}…` : t);
}

function dealTypeText(dt: string | null, kind?: VerifiedComp['acquisitionKind']): string {
  if (kind) return ACQUISITION_KIND_LABEL[kind];
  const map: Record<string, string> = {
    license: 'License', licensing: 'License', acquisition: 'Acquisition', merger: 'Acquisition', option: 'Option',
    collaboration: 'Collaboration', co_development: 'Co-development', co_promotion: 'Co-promotion',
  };
  return dt ? (map[dt.toLowerCase()] ?? 'Deal') : 'Deal';
}

function royaltyText(c: VerifiedComp): string | null {
  const lo = c.royaltyLowPct;
  const hi = c.royaltyHighPct;
  if (lo == null && hi == null) return null;
  if (lo != null && hi != null && hi !== lo) return `${lo}–${hi}% royalty`;
  return `${lo ?? hi}% royalty`;
}

function exportCsv(comps: VerifiedComp[], filename: string) {
  const header = ['Licensor or seller', 'Licensee or buyer', 'Asset', 'Year', 'Phase', 'Deal type', 'Territory', 'Upfront ($M)', 'Total ($M)', 'Royalty low (%)', 'Royalty high (%)', 'Source', 'Source link'];
  const esc = (v: unknown) => {
    const s = v == null ? '' : String(v);
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  const lines = [header, ...comps.map(c => [
    c.licensor, c.licensee, c.asset, c.year, phaseName(c.phase), dealTypeText(c.dealType, c.acquisitionKind), c.territory,
    c.upfrontM, c.totalM, c.royaltyLowPct, c.royaltyHighPct, c.sourceLabel, c.sourceUrl,
  ])].map(row => row.map(esc).join(','));
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function CompRow({ c }: { c: VerifiedComp }) {
  const territory = territoryText(c);
  const royalty = royaltyText(c);
  return (
    <li className="rounded-xl border border-neutral-200 dark:border-slate-700/60 bg-white dark:bg-slate-800/50 p-3 sm:p-3.5">
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-neutral-900 dark:text-white break-words">
            {c.licensor} <span className="font-normal text-neutral-400 dark:text-slate-500">→</span> {c.licensee}
          </p>
          {c.asset && <p className="mt-0.5 text-xs text-neutral-600 dark:text-slate-300 break-words line-clamp-2">{c.asset}</p>}
          <p className="mt-1 text-[11px] text-neutral-500 dark:text-slate-400">
            {[String(c.year), phaseName(c.phase), dealTypeText(c.dealType, c.acquisitionKind), territory].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="flex sm:flex-col items-baseline sm:items-end gap-x-3 gap-y-0.5 sm:text-right flex-shrink-0">
          <p className="font-mono text-sm font-bold text-neutral-900 dark:text-white">
            {formatCurrency(c.upfrontM)} <span className="font-sans text-[11px] font-normal text-neutral-500 dark:text-slate-400">upfront</span>
          </p>
          {c.totalM != null && c.totalM > c.upfrontM && (
            <p className="font-mono text-xs text-neutral-600 dark:text-slate-300">{formatCurrency(c.totalM)} <span className="font-sans text-[11px] text-neutral-500 dark:text-slate-400">total</span></p>
          )}
          {royalty && <p className="text-[11px] text-neutral-500 dark:text-slate-400">{royalty}</p>}
        </div>
      </div>
      <div className="mt-2 pt-2 border-t border-neutral-100 dark:border-slate-700/40">
        <a
          href={c.sourceUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-full border border-teal-500/40 px-2.5 py-1 text-[11px] font-medium text-teal-700 dark:text-teal-300 hover:bg-teal-500/10 transition-colors"
          aria-label={`Open source: ${c.sourceLabel} for ${c.licensor} and ${c.licensee}`}
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
          {c.sourceLabel}
        </a>
      </div>
    </li>
  );
}

interface Props {
  state: VerifiedCompsState;
  result: CalculationResult;
  inputs?: Partial<CalculationInput>;
  /** Client-side full access (Pro, report, first free analysis): unlocks the adjustment breakdown. */
  hasFullAccess: boolean;
  onUpgrade?: () => void;
  upfrontLabel?: string;
}

const INITIAL_PRO_ROWS = 6;

export default function DealsLikeYours({ state, result, inputs, hasFullAccess, onUpgrade, upfrontLabel }: Props) {
  const [showAll, setShowAll] = useState(false);
  const confidence = verifiedConfidence(state, result);
  const data = state.status === 'ready' ? state.data : null;

  const description = useMemo(() => {
    if (!data || !inputs?.therapeuticArea) return null;
    return describeSelection(
      {
        therapeuticArea: inputs.therapeuticArea,
        phase: inputs.phase,
        modality: inputs.modality,
        indication: inputs.indication,
        dealType: inputs.dealType ?? 'licensing',
        territory: inputs.territory ?? 'global',
      },
      data.rungIndex,
      { modality: result.labels?.modality, indication: result.labels?.indication },
    );
  }, [data, inputs, result.labels]);

  const upfront = result.terms.upfront;
  const vs = estimateVsComps(upfront.median, data?.summary.medianUpfrontM ?? null, result.modifiers ?? []);
  const drivers = topDrivers(result.modifiers ?? [], 5);
  const isLow = confidence?.level === 'low';

  if (state.status === 'loading') {
    return (
      <section aria-label="Deals like yours" aria-busy="true" className="mb-4 sm:mb-6 rounded-2xl border border-neutral-200 dark:border-slate-700/60 bg-white dark:bg-slate-900/60 p-4 sm:p-6">
        <div className="h-3 w-32 rounded bg-neutral-200 dark:bg-slate-700 animate-pulse" />
        <div className="mt-4 h-8 w-48 rounded bg-neutral-200 dark:bg-slate-700 animate-pulse" />
        <div className="mt-4 space-y-2">
          {[0, 1, 2].map(i => <div key={i} className="h-16 rounded-xl bg-neutral-100 dark:bg-slate-800 animate-pulse" />)}
        </div>
      </section>
    );
  }

  // Acquisition queries with enough asset purchases: whole-company buyouts get their own group.
  const splitCompanies = data?.headlineBasis === 'asset_purchases';
  const mainComps = data ? (splitCompanies ? data.comps.filter(c => c.acquisitionKind !== 'company') : data.comps) : [];
  const companyComps = data && splitCompanies ? data.comps.filter(c => c.acquisitionKind === 'company') : [];
  const visible = data ? (data.limited ? mainComps : showAll ? mainComps : mainComps.slice(0, INITIAL_PRO_ROWS)) : [];
  const hiddenCompanies = data && splitCompanies && data.limited ? Math.max(0, (data.companyAcquisitionCount ?? 0) - companyComps.length) : 0;
  const hiddenForFree = data && data.limited ? Math.max(0, data.totalComps - data.comps.length) : 0;
  const s = data?.summary;
  const style = confidence ? CONFIDENCE_STYLE[confidence.level] : null;

  return (
    <section aria-label="Deals like yours" data-testid="deals-like-yours" className="mb-4 sm:mb-6 rounded-2xl border border-neutral-200 dark:border-slate-700/60 bg-white dark:bg-slate-900/60 overflow-hidden">
      <div className="p-4 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-teal-700 dark:text-teal-300">Deals like yours</h3>
            {description && <p className="mt-1 text-sm text-neutral-700 dark:text-slate-300">{description.shown}</p>}
          </div>
          {style && (
            <span className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold ${style.cls}`} data-testid="confidence-pill">
              <span className={`w-1.5 h-1.5 rounded-full ${style.dot}`} aria-hidden="true" />
              {style.label}
            </span>
          )}
        </div>

        {description?.relaxationNote && (
          <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
            {description.relaxationNote}
          </p>
        )}

        {state.status === 'error' && (
          <p className="mt-3 text-sm text-neutral-500 dark:text-slate-400">Comparable deals could not be loaded just now. The estimate below still applies; refresh to try again.</p>
        )}

        {data && s && s.n === 0 && (
          <p className="mt-3 text-sm text-neutral-600 dark:text-slate-300">
            No deals in this therapeutic area have a disclosed upfront and a public source yet, so there is nothing real to compare against. Treat the estimate below with caution.
          </p>
        )}

        {data && s && s.n > 0 && (
          <>
            <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <p className="text-[11px] uppercase tracking-wider text-neutral-500 dark:text-slate-400">{splitCompanies ? 'Median asset purchase price' : 'Median upfront paid'}</p>
                <p className="mt-0.5 font-mono text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-white" data-testid="comp-median">{formatCurrency(s.medianUpfrontM)}</p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-neutral-500 dark:text-slate-400">Middle half of deals</p>
                <p className="mt-1 font-mono text-sm sm:text-base font-semibold text-neutral-800 dark:text-slate-100">
                  {s.n >= 4 ? `${formatCurrency(s.p25UpfrontM)} – ${formatCurrency(s.p75UpfrontM)}` : '—'}
                </p>
              </div>
              <div>
                <p className="text-[11px] uppercase tracking-wider text-neutral-500 dark:text-slate-400">{splitCompanies ? 'Asset purchases' : 'Deals'}</p>
                <p className="mt-1 font-mono text-sm sm:text-base font-semibold text-neutral-800 dark:text-slate-100" data-testid="comp-n">{s.n}</p>
              </div>
              {s.medianTotalM != null && s.nTotal >= 3 && (
                <div>
                  <p className="text-[11px] uppercase tracking-wider text-neutral-500 dark:text-slate-400">Median total value</p>
                  <p className="mt-1 font-mono text-sm sm:text-base font-semibold text-neutral-800 dark:text-slate-100">{formatCurrency(s.medianTotalM)}</p>
                </div>
              )}
            </div>
            <p className="mt-2 text-[11px] text-neutral-500 dark:text-slate-400">
              What was actually paid, from each deal&apos;s filing or press release. Every deal below links to its source.
            </p>
            {data.acquisitionNote && (
              <p className={`mt-2 text-xs ${data.confidenceCap === 'low' ? 'rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-amber-800 dark:text-amber-200' : 'text-neutral-600 dark:text-slate-300'}`} data-testid="acquisition-note">
                {data.acquisitionNote}
              </p>
            )}

            <ul className="mt-4 space-y-2" data-testid="comp-list">
              {visible.map(c => <CompRow key={c.id} c={c} />)}
            </ul>

            {!data.limited && mainComps.length > INITIAL_PRO_ROWS && (
              <button
                type="button"
                onClick={() => setShowAll(v => !v)}
                className="mt-3 rounded-full border border-neutral-300 dark:border-slate-600 px-4 py-1.5 text-xs font-medium text-neutral-700 dark:text-slate-200 hover:bg-neutral-100 dark:hover:bg-slate-800 transition-colors"
              >
                {showAll ? 'Show fewer' : `Show all ${mainComps.length} deals`}
              </button>
            )}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {!data.limited && data.comps.length > 0 && (
                <button
                  type="button"
                  onClick={() => exportCsv(data.comps, `comparable-deals-${inputs?.therapeuticArea ?? 'deals'}-${inputs?.phase ?? ''}.csv`)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-teal-500/40 px-4 py-1.5 text-xs font-medium text-teal-700 dark:text-teal-300 hover:bg-teal-500/10 transition-colors"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" aria-hidden="true">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Export deals (CSV)
                </button>
              )}
            </div>

            {(companyComps.length > 0 || hiddenCompanies > 0) && (
              <div className="mt-5" data-testid="company-acquisitions">
                <h4 className="text-xs font-semibold text-neutral-700 dark:text-slate-200">Whole-company acquisitions</h4>
                <p className="mt-0.5 text-[11px] text-neutral-500 dark:text-slate-400">Usually priced well above an asset sale. Not included in the median above.</p>
                {companyComps.length > 0 && (
                  <ul className="mt-2 space-y-2 opacity-90">
                    {companyComps.map(c => <CompRow key={c.id} c={c} />)}
                  </ul>
                )}
                {hiddenCompanies > 0 && (
                  <p className="mt-2 text-[11px] text-neutral-500 dark:text-slate-400">{hiddenCompanies} whole-company {hiddenCompanies === 1 ? 'acquisition' : 'acquisitions'} in Pro.</p>
                )}
              </div>
            )}

            {hiddenForFree > 0 && (
              <div className="mt-3 rounded-xl border border-teal-500/30 bg-teal-500/5 p-3 sm:p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-sm text-neutral-700 dark:text-slate-200">
                  <span className="font-semibold">{hiddenForFree} more comparable {hiddenForFree === 1 ? 'deal' : 'deals'}</span>, each with its source, plus export and the full breakdown of the estimate.
                </p>
                <button
                  type="button"
                  onClick={onUpgrade}
                  className="self-start sm:self-auto whitespace-nowrap rounded-full bg-gradient-to-r from-teal-500 to-cyan-500 px-4 py-2 text-xs font-semibold text-white hover:from-teal-600 hover:to-cyan-600 transition-all"
                >
                  See all {data.totalComps} deals
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Adjusted for your program: the estimate, second and labeled */}
      <div className={`border-t border-neutral-200 dark:border-slate-700/60 p-4 sm:p-6 ${isLow ? 'bg-neutral-50 dark:bg-slate-900/30' : 'bg-neutral-50/60 dark:bg-slate-800/30'}`} data-testid="adjusted-estimate">
        <div className="flex flex-wrap items-baseline justify-between gap-2">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-neutral-600 dark:text-slate-300">Adjusted for your program</h3>
          <span className="text-[11px] text-neutral-500 dark:text-slate-400">{upfrontLabel || 'Upfront'} estimate</span>
        </div>

        <div className={`mt-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 ${isLow ? 'opacity-70' : ''}`}>
          <p className={`font-mono font-bold text-neutral-900 dark:text-white ${isLow ? 'text-base sm:text-lg' : 'text-xl sm:text-2xl'}`}>{formatRange(upfront)}</p>
          {hasFullAccess && <p className="text-xs text-neutral-500 dark:text-slate-400">midpoint {formatCurrency(upfront.median)}</p>}
        </div>

        {confidence && (
          <p className={`mt-2 text-xs ${isLow ? 'font-medium text-amber-800 dark:text-amber-200' : 'text-neutral-600 dark:text-slate-300'}`}>
            {isLow ? 'Low confidence. ' : ''}{confidence.reason}
          </p>
        )}

        {hasFullAccess ? (
          <>
            {vs.sentence && <p className="mt-2 text-sm text-neutral-800 dark:text-slate-100" data-testid="estimate-vs-comps">{vs.sentence}</p>}
            {drivers.length > 0 && (
              <div className="mt-3">
                <p className="text-[11px] uppercase tracking-wider text-neutral-500 dark:text-slate-400">What moved the estimate</p>
                <ul className="mt-1.5 flex flex-wrap gap-1.5">
                  {drivers.map(d => (
                    <li
                      key={d.name}
                      className={`rounded-full border px-2.5 py-1 text-[11px] font-medium ${d.pct > 0 ? 'border-emerald-500/30 text-emerald-700 dark:text-emerald-300' : 'border-rose-500/30 text-rose-700 dark:text-rose-300'}`}
                    >
                      {d.name} {d.pct > 0 ? '+' : ''}{d.pct}%
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </>
        ) : (
          <div className="mt-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 rounded-xl border border-dashed border-neutral-300 dark:border-slate-600 p-3">
            <p className="text-xs text-neutral-600 dark:text-slate-300">
              See how far this sits from the comparable median and which features of your program moved it.
            </p>
            <button
              type="button"
              onClick={onUpgrade}
              className="self-start sm:self-auto whitespace-nowrap rounded-full border border-teal-500/50 px-4 py-1.5 text-xs font-semibold text-teal-700 dark:text-teal-300 hover:bg-teal-500/10 transition-colors"
            >
              Unlock the breakdown
            </button>
          </div>
        )}
      </div>
    </section>
  );
}
