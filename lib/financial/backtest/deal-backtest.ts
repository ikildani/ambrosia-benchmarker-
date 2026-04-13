/**
 * Deal Backtest Runner (Tier: Option B foundation)
 *
 * Compares the rNPV engine's implied deal values against real disclosed
 * licensing / acquisition / co-development terms. Used by
 * `scripts/run-deal-backtest.ts` to produce baseline-errors.json and by
 * docs/calibration-*.md to generate the diagnostic heat map.
 *
 * Unlike `__tests__/lib/comparable-deals-backtest.test.ts` (which is a pass/
 * fail suite), this module is a programmatic tool — it returns the full
 * per-deal error table so the caller can:
 *   - cluster errors by TA / phase / modality / year
 *   - identify worst-predicted indications
 *   - track calibration progress round-by-round through Stage 7
 *
 * @module lib/financial/backtest/deal-backtest
 */

import { calculateRNPV } from '../rnpv-engine';
import type { RNPVInput, RNPVResult } from '../types';
import { EXTENDED_COMPARABLE_DEALS, type ExtendedComparableDeal } from '@/data/comparable-deals-extended';

// ---------------------------------------------------------------------------
// Per-deal result shape
// ---------------------------------------------------------------------------

export interface DealBacktestCase {
  /** Unique id for the deal in the source table. */
  id: string;
  /** Year deal was announced. */
  year: number;
  licensor: string;
  licensee: string;
  therapeuticArea: string;
  indication: string;
  modality: string;
  phase: string;
  dealType: string;
  territory: string;
  /** Actual upfront payment ($M). */
  actualUpfront_M: number;
  /** Actual total deal value ($M, biobucks). */
  actualTotalDeal_M: number;
  /** Peak sales assumption for the asset (analyst consensus at deal date). */
  peakSalesMedian_M: number;
}

export interface DealBacktestResult {
  case: DealBacktestCase;
  /** Model's predicted upfront ($M, median). */
  predictedUpfront_M: number;
  /** Model's predicted total deal ($M, median). */
  predictedTotalDeal_M: number;
  /** Signed error on upfront: (predicted - actual) / actual. */
  upfrontErrorPct: number;
  /** Signed error on total deal: (predicted - actual) / actual. */
  totalDealErrorPct: number;
  /** Absolute error on upfront ($M). */
  upfrontErrorAbs_M: number;
  /** Absolute error on total deal ($M). */
  totalDealErrorAbs_M: number;
  /** True when |upfrontErrorPct| ≤ threshold (defaults: 25% / 35% / 50%). */
  within25: boolean;
  within35: boolean;
  within50: boolean;
  /** Notes propagated from the source case. */
  notes?: string;
}

export interface DealBacktestSummary {
  totalDeals: number;
  /** % of deals within ±25 / ±35 / ±50% on upfront. */
  hitRate25: number;
  hitRate35: number;
  hitRate50: number;
  /** Mean absolute percentage error on upfront. */
  meanAbsErrorPct: number;
  /** Median signed error (positive = systematic overshoot). */
  medianSignedErrorPct: number;
  /** RMSE on upfront ($M). */
  rmseUpfront_M: number;
  /** Heat map: errors grouped by therapeutic area. */
  byTherapeuticArea: Record<string, BacktestSlice>;
  /** Heat map: errors grouped by phase. */
  byPhase: Record<string, BacktestSlice>;
  /** Heat map: errors grouped by modality. */
  byModality: Record<string, BacktestSlice>;
}

export interface BacktestSlice {
  /** Number of deals in slice. */
  n: number;
  /** Hit rate at ±25% for this slice. */
  hitRate25: number;
  /** Hit rate at ±35% for this slice. */
  hitRate35: number;
  /** Mean signed error (positive = overshoot). */
  meanSignedErrorPct: number;
  /** Mean absolute error. */
  meanAbsErrorPct: number;
}

// ---------------------------------------------------------------------------
// Case extraction
// ---------------------------------------------------------------------------

/**
 * Peak sales hint per TA — back-of-envelope analyst consensus. Used when the
 * source deal record doesn't carry an explicit peakSalesMedian. Indication-
 * specific overrides can be added later; for now these TA-level anchors are
 * good enough for the baseline run.
 */
const PEAK_SALES_BY_TA_M: Record<string, number> = {
  oncology: 2500,
  neurology: 1500,
  immunology: 3000,
  metabolic: 4000,
  cardiovascular: 2000,
  infectiousDisease: 1200,
  ophthalmology: 1000,
  womensHealth: 800,
  rareDisease: 600,
  hematology: 1500,
  dermatology: 1000,
  gastroenterology: 1500,
};

/**
 * Convert an ExtendedComparableDeal row into the backtest case shape the
 * runner consumes. Peak sales hint defaults to TA anchor when not in the row.
 */
function dealToCase(deal: ExtendedComparableDeal): DealBacktestCase {
  const peakSalesMedian_M = PEAK_SALES_BY_TA_M[deal.therapeuticArea] ?? 1500;
  return {
    id: deal.id,
    year: deal.year,
    licensor: deal.licensor,
    licensee: deal.licensee,
    therapeuticArea: deal.therapeuticArea,
    indication: deal.indication_specific || deal.indication_category,
    modality: deal.modality,
    phase: deal.phase,
    dealType: deal.dealType,
    territory: deal.territory,
    actualUpfront_M: deal.upfront,
    actualTotalDeal_M: deal.totalDealValue,
    peakSalesMedian_M,
  };
}

/**
 * Return all backtest cases suitable for the run — excludes deals missing
 * disclosed upfront or total value, and platform / multi-asset deals which
 * the single-asset rNPV engine cannot fairly price.
 */
export function getAllBacktestCases(): DealBacktestCase[] {
  return EXTENDED_COMPARABLE_DEALS
    .filter(d => d.upfront > 0 && d.totalDealValue > 0)
    .map(dealToCase);
}

// ---------------------------------------------------------------------------
// Running the engine
// ---------------------------------------------------------------------------

function buildInputForCase(c: DealBacktestCase): RNPVInput {
  // Allowed phases from calculateRNPV — keep mapping narrow so unexpected
  // phase labels land on phase2 rather than silently mispredicting.
  const phaseMap: Record<string, string> = {
    preclinical: 'preclinical',
    phase1: 'phase1',
    phase1_2: 'phase1_2',
    phase2: 'phase2',
    phase2_3: 'phase2_3',
    phase3: 'phase3',
    nda_filed: 'nda_filed',
    approved: 'approved',
  };
  const phase = phaseMap[c.phase] ?? 'phase2';

  return {
    therapeuticArea: c.therapeuticArea,
    indication: c.indication,
    modality: c.modality,
    phase: phase as RNPVInput['phase'],
    territory: (c.territory === 'global' || c.territory === 'us_only' || c.territory === 'ex_us')
      ? c.territory
      : 'global',
    dealType: c.dealType as RNPVInput['dealType'],
    peakSalesEstimate: {
      low: c.peakSalesMedian_M * 0.5,
      median: c.peakSalesMedian_M,
      high: c.peakSalesMedian_M * 1.5,
    },
    competitivePosition: 'racing',
    dataQuality: 'moderate',
    biomarkerStatus: 'unselected',
    regulatoryDesignations: {
      breakthrough: false,
      fastTrack: false,
      orphan: false,
      prime: false,
    },
  };
}

function scoreCase(c: DealBacktestCase): DealBacktestResult {
  const input = buildInputForCase(c);
  const result: RNPVResult = calculateRNPV(input);
  const predictedUpfront = result.impliedDealValue?.upfront?.median ?? 0;
  const predictedTotal = result.impliedDealValue?.totalDeal?.median ?? 0;

  const upfrontErrorAbs_M = predictedUpfront - c.actualUpfront_M;
  const totalDealErrorAbs_M = predictedTotal - c.actualTotalDeal_M;
  const upfrontErrorPct = c.actualUpfront_M > 0 ? upfrontErrorAbs_M / c.actualUpfront_M : 0;
  const totalDealErrorPct = c.actualTotalDeal_M > 0 ? totalDealErrorAbs_M / c.actualTotalDeal_M : 0;

  const absPct = Math.abs(upfrontErrorPct);
  return {
    case: c,
    predictedUpfront_M: Math.round(predictedUpfront * 10) / 10,
    predictedTotalDeal_M: Math.round(predictedTotal * 10) / 10,
    upfrontErrorPct,
    totalDealErrorPct,
    upfrontErrorAbs_M: Math.round(upfrontErrorAbs_M * 10) / 10,
    totalDealErrorAbs_M: Math.round(totalDealErrorAbs_M * 10) / 10,
    within25: absPct <= 0.25,
    within35: absPct <= 0.35,
    within50: absPct <= 0.50,
  };
}

// ---------------------------------------------------------------------------
// Aggregation
// ---------------------------------------------------------------------------

function summarizeSlice(rows: DealBacktestResult[]): BacktestSlice {
  const n = rows.length;
  if (n === 0) {
    return { n: 0, hitRate25: 0, hitRate35: 0, meanSignedErrorPct: 0, meanAbsErrorPct: 0 };
  }
  const hits25 = rows.filter(r => r.within25).length;
  const hits35 = rows.filter(r => r.within35).length;
  const signed = rows.reduce((s, r) => s + r.upfrontErrorPct, 0) / n;
  const abs = rows.reduce((s, r) => s + Math.abs(r.upfrontErrorPct), 0) / n;
  return {
    n,
    hitRate25: hits25 / n,
    hitRate35: hits35 / n,
    meanSignedErrorPct: signed,
    meanAbsErrorPct: abs,
  };
}

function groupBy<T, K extends string>(
  rows: T[],
  key: (r: T) => K,
): Record<K, T[]> {
  const out: Record<string, T[]> = {};
  for (const r of rows) {
    const k = key(r);
    if (!out[k]) out[k] = [];
    out[k].push(r);
  }
  return out as Record<K, T[]>;
}

export function summarize(rows: DealBacktestResult[]): DealBacktestSummary {
  const n = rows.length;
  if (n === 0) {
    return {
      totalDeals: 0,
      hitRate25: 0,
      hitRate35: 0,
      hitRate50: 0,
      meanAbsErrorPct: 0,
      medianSignedErrorPct: 0,
      rmseUpfront_M: 0,
      byTherapeuticArea: {},
      byPhase: {},
      byModality: {},
    };
  }

  const hits25 = rows.filter(r => r.within25).length;
  const hits35 = rows.filter(r => r.within35).length;
  const hits50 = rows.filter(r => r.within50).length;
  const meanAbs = rows.reduce((s, r) => s + Math.abs(r.upfrontErrorPct), 0) / n;
  const sortedSigned = rows.map(r => r.upfrontErrorPct).sort((a, b) => a - b);
  const mid = Math.floor(n / 2);
  const median = n % 2 === 0 ? (sortedSigned[mid - 1] + sortedSigned[mid]) / 2 : sortedSigned[mid];
  const sqSum = rows.reduce((s, r) => s + r.upfrontErrorAbs_M * r.upfrontErrorAbs_M, 0);
  const rmse = Math.sqrt(sqSum / n);

  const byTA = groupBy(rows, r => r.case.therapeuticArea);
  const byPhase = groupBy(rows, r => r.case.phase);
  const byModality = groupBy(rows, r => r.case.modality);

  const mapSlices = (groups: Record<string, DealBacktestResult[]>): Record<string, BacktestSlice> => {
    const out: Record<string, BacktestSlice> = {};
    for (const [k, v] of Object.entries(groups)) {
      out[k] = summarizeSlice(v);
    }
    return out;
  };

  return {
    totalDeals: n,
    hitRate25: hits25 / n,
    hitRate35: hits35 / n,
    hitRate50: hits50 / n,
    meanAbsErrorPct: meanAbs,
    medianSignedErrorPct: median,
    rmseUpfront_M: Math.round(rmse * 10) / 10,
    byTherapeuticArea: mapSlices(byTA),
    byPhase: mapSlices(byPhase),
    byModality: mapSlices(byModality),
  };
}

// ---------------------------------------------------------------------------
// Public entry point
// ---------------------------------------------------------------------------

export interface BacktestReport {
  runAt: string;
  featureFlags: Record<string, boolean>;
  summary: DealBacktestSummary;
  /** Ten worst-predicted deals by absolute upfront error percentage. */
  worstDeals: DealBacktestResult[];
  /** All per-deal results — useful for drilling into specific misses. */
  results: DealBacktestResult[];
}

/**
 * Run the full backtest against every available case. Caller can override
 * the case list if they want a subset (e.g., single TA for targeted calibration).
 */
export function runDealBacktest(
  cases: DealBacktestCase[] = getAllBacktestCases(),
): BacktestReport {
  const results = cases.map(scoreCase);
  const summary = summarize(results);
  const worstDeals = [...results]
    .sort((a, b) => Math.abs(b.upfrontErrorPct) - Math.abs(a.upfrontErrorPct))
    .slice(0, 10);

  return {
    runAt: new Date().toISOString(),
    featureFlags: {
      TIER2_TIME_WINDOWED_POS: process.env.TIER2_TIME_WINDOWED_POS === 'on',
      TIER2_COMBO_THERAPY: process.env.TIER2_COMBO_THERAPY === 'on',
      TIER2_GEO_DECOMP: process.env.TIER2_GEO_DECOMP === 'on',
      TIER4_RISK_DECOMP: process.env.TIER4_RISK_DECOMP === 'on',
      TIER4_MACRO: process.env.TIER4_MACRO === 'on',
      TIER4_SUBPOP: process.env.TIER4_SUBPOP === 'on',
      TIER4_PATENT_CLIFFS: process.env.TIER4_PATENT_CLIFFS === 'on',
    },
    summary,
    worstDeals,
    results,
  };
}
