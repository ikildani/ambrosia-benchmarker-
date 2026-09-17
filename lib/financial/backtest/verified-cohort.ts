/**
 * Verified-and-cited backtest cohort.
 *
 * The corpus backtest (deal-backtest.ts) runs against a snapshot file that
 * includes pending rows. This module scores the engine against the strictest
 * cohort the database can offer: rows a person marked verified, that carry a
 * citation (source URL, press release URL, or SEC filing id), that survived
 * dedupe (canonical), and that are not quarantined. The public methodology
 * page and the engine-backtest cron both read from here, so the number on
 * the page is the number the cron stores.
 *
 * Aggregation is unweighted and plain: a hit is |predicted - actual| /
 * actual within the band. No recency weighting, no holdout split. Small n
 * is reported as small n.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { ExtendedComparableDeal } from '@/data/comparable-deals-extended';
import { scoreExtendedDeals, type DealBacktestResult } from './deal-backtest';
import { ENGINE_VERSION } from '../calculation-version';

export const VERIFIED_COHORT_ID = 'verified_cited' as const;

/** Row shape we read from `deals`. */
export interface VerifiedDealRow {
  id: string;
  licensor_name: string | null;
  licensee_name: string | null;
  asset_name: string | null;
  modality: string | null;
  phase_at_signing: string | null;
  indication_category: string | null;
  indication_specific: string | null;
  territory: string | null;
  therapeutic_area: string | null;
  deal_type: string | null;
  upfront_usd: number | null;
  total_deal_value_usd: number | null;
  announced_date: string | null;
  source_url: string | null;
  press_release_url: string | null;
  source_filing_id: string | null;
}

/**
 * PostgREST filter for the cohort, applied together with verified=true:
 * not synthetic, canonical, not flagged or rejected, and carrying at least
 * one citation. Verified ⊂ sourced ⊂ tracked by construction.
 */
export const VERIFIED_COHORT_FILTER =
  'and(or(is_synthetic.is.null,is_synthetic.eq.false),or(is_canonical.is.null,is_canonical.eq.true),or(verification_status.is.null,verification_status.not.in.("flagged","rejected")),or(source_url.not.is.null,press_release_url.not.is.null,source_filing_id.not.is.null))';

export const VERIFIED_DEAL_COLUMNS =
  'id, licensor_name, licensee_name, asset_name, modality, phase_at_signing, indication_category, indication_specific, territory, therapeutic_area, deal_type, upfront_usd, total_deal_value_usd, announced_date, source_url, press_release_url, source_filing_id';

/** Deal-type labels in the database → the five the engine models. */
export function mapDealType(dt: string | null): ExtendedComparableDeal['dealType'] | null {
  if (!dt) return null;
  const s = dt.toLowerCase();
  if (s === 'license' || s === 'licensing') return 'licensing';
  if (s === 'co_development' || s === 'codevelopment') return 'codevelopment';
  if (s === 'collaboration') return 'collaboration';
  if (s === 'acquisition') return 'acquisition';
  if (s === 'option') return 'option';
  return null; // 'other', reformulation, unknown: not scored
}

/** Phase labels in the database → the engine's phase keys. */
export function mapPhase(p: string | null): string | null {
  if (!p) return null;
  switch (p) {
    case 'discovery': return 'discovery';
    case 'preclinical': return 'preclinical';
    case 'phase_1': case 'phase1': return 'phase1';
    case 'phase_1_2': case 'phase1_2': return 'phase1_2';
    case 'phase_2': case 'phase2': return 'phase2';
    case 'phase_2_3': case 'phase2_3': return 'phase2_3';
    case 'phase_3': case 'phase3': return 'phase3';
    case 'nda_filed': return 'nda_filed';
    case 'approved': return 'approved';
    default: return null; // 'unknown': not scored
  }
}

export type PhaseBucket = 'early' | 'mid' | 'late';

export function phaseBucket(phase: string): PhaseBucket {
  if (phase === 'discovery' || phase === 'preclinical' || phase === 'phase1' || phase === 'phase1_2') return 'early';
  if (phase === 'phase2' || phase === 'phase2_3') return 'mid';
  return 'late';
}

/** Convert database rows to the corpus deal shape. Rows the engine cannot model are dropped. */
export function rowsToExtendedDeals(rows: VerifiedDealRow[]): ExtendedComparableDeal[] {
  const out: ExtendedComparableDeal[] = [];
  for (const r of rows) {
    const dealType = mapDealType(r.deal_type);
    const phase = mapPhase(r.phase_at_signing);
    if (!dealType || !phase) continue;
    if (!r.licensor_name || !r.licensee_name || !r.therapeutic_area || !r.announced_date) continue;
    if (!r.upfront_usd || r.upfront_usd <= 0 || !r.total_deal_value_usd || r.total_deal_value_usd <= 0) continue;
    const year = new Date(r.announced_date).getFullYear();
    if (!Number.isFinite(year)) continue;
    out.push({
      id: `db_${r.id}`,
      year,
      licensor: r.licensor_name,
      licensee: r.licensee_name,
      modality: r.modality ?? 'other',
      phase,
      indication_category: r.indication_category ?? '',
      indication_specific: r.indication_specific ?? '',
      territory: r.territory ?? 'global',
      therapeuticArea: r.therapeutic_area,
      upfront: Math.round((r.upfront_usd / 1_000_000) * 10) / 10,
      totalDealValue: Math.round((r.total_deal_value_usd / 1_000_000) * 10) / 10,
      dealType,
      headline: `${r.asset_name ?? r.indication_specific ?? r.indication_category ?? ''} — ${r.licensor_name} to ${r.licensee_name}`,
      source: r.source_url ?? r.press_release_url ?? (r.source_filing_id ? `sec:${r.source_filing_id}` : ''),
      assetName: r.asset_name ?? undefined,
      verified: true,
    });
  }
  return out;
}

export interface MetricBand {
  n: number;
  /** Median of |error| / actual. */
  medianAbsErrorPct: number;
  /** Median signed error / actual; positive = engine predicts high. */
  medianSignedErrorPct: number;
  within35: number;
  within50: number;
}

export interface CohortBlock {
  n: number;
  upfront: MetricBand;
  totalDeal: MetricBand;
}

export interface VerifiedCohortReport {
  cohort: typeof VERIFIED_COHORT_ID;
  engineVersion: string;
  runAt: string;
  /** Rows that met the cohort definition in the database. */
  eligible: number;
  /** Rows the engine could model and score (has phase, deal type, upfront ≥ $20M, disclosed total). */
  scored: number;
  all: CohortBlock;
  /** Phase 2 / 2-3 / 3 licensing and co-development: where the rNPV method is designed to work. */
  coreScope: CohortBlock;
  byPhaseBucket: Record<PhaseBucket, CohortBlock>;
  /** Largest misses on upfront, for the page's honesty section. */
  worst: Array<{ id: string; licensor: string; licensee: string; year: number; phase: string; actualUpfront_M: number; predictedUpfront_M: number; errorPct: number }>;
}

function median(xs: number[]): number {
  if (xs.length === 0) return 0;
  const s = [...xs].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

function band(errs: number[]): MetricBand {
  const n = errs.length;
  if (n === 0) return { n: 0, medianAbsErrorPct: 0, medianSignedErrorPct: 0, within35: 0, within50: 0 };
  const abs = errs.map(Math.abs);
  return {
    n,
    medianAbsErrorPct: median(abs),
    medianSignedErrorPct: median(errs),
    within35: abs.filter(e => e <= 0.35).length / n,
    within50: abs.filter(e => e <= 0.50).length / n,
  };
}

function block(rows: DealBacktestResult[]): CohortBlock {
  return {
    n: rows.length,
    upfront: band(rows.map(r => r.upfrontErrorPct)),
    totalDeal: band(rows.filter(r => r.case.actualTotalDeal_M > 0).map(r => r.totalDealErrorPct)),
  };
}

const CORE_PHASES = new Set(['phase2', 'phase2_3', 'phase3']);
const CORE_TYPES = new Set(['licensing', 'codevelopment']);

/** Score a cohort of deals and aggregate. Pure; safe to unit test. */
export function buildVerifiedCohortReport(deals: ExtendedComparableDeal[], eligible = deals.length, now = new Date()): VerifiedCohortReport {
  const results = scoreExtendedDeals(deals);
  const core = results.filter(r => CORE_PHASES.has(r.case.phase) && CORE_TYPES.has(r.case.dealType));
  const buckets: Record<PhaseBucket, DealBacktestResult[]> = { early: [], mid: [], late: [] };
  for (const r of results) buckets[phaseBucket(r.case.phase)].push(r);
  const worst = [...results]
    .sort((a, b) => Math.abs(b.upfrontErrorPct) - Math.abs(a.upfrontErrorPct))
    .slice(0, 5)
    .map(r => ({
      id: r.case.id,
      licensor: r.case.licensor,
      licensee: r.case.licensee,
      year: r.case.year,
      phase: r.case.phase,
      actualUpfront_M: r.case.actualUpfront_M,
      predictedUpfront_M: r.predictedUpfront_M,
      errorPct: r.upfrontErrorPct,
    }));
  return {
    cohort: VERIFIED_COHORT_ID,
    engineVersion: ENGINE_VERSION,
    runAt: now.toISOString(),
    eligible,
    scored: results.length,
    all: block(results),
    coreScope: block(core),
    byPhaseBucket: { early: block(buckets.early), mid: block(buckets.mid), late: block(buckets.late) },
    worst,
  };
}

/** Pull the cohort from the database. Read-only. */
export async function fetchVerifiedCitedDeals(supabase: SupabaseClient): Promise<{ rows: VerifiedDealRow[]; deals: ExtendedComparableDeal[] }> {
  const { data, error } = await supabase
    .from('deals')
    .select(VERIFIED_DEAL_COLUMNS)
    .eq('verified', true)
    // One .or() only: PostgREST chaining replaces the previous .or() filter.
    .or(VERIFIED_COHORT_FILTER)
    .order('announced_date', { ascending: false })
    .limit(5000);
  if (error) throw new Error(`verified cohort query failed: ${error.message}`);
  const rows = (data ?? []) as unknown as VerifiedDealRow[];
  return { rows, deals: rowsToExtendedDeals(rows) };
}

/** Fetch and score in one call, for the cron and the stats route. */
export async function runVerifiedCohortBacktest(supabase: SupabaseClient): Promise<VerifiedCohortReport> {
  const { rows, deals } = await fetchVerifiedCitedDeals(supabase);
  return buildVerifiedCohortReport(deals, rows.length);
}
