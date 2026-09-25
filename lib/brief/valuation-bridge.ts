/**
 * Valuation bridge — the football field behind the Brief's single ask.
 *
 * Takes every valuation method the engine produced (comps, rNPV, Monte Carlo,
 * scenarios, buyer-specific) and reconciles them to one ask, one floor and one
 * walk-away number. Every other page reads these; nothing recomputes them.
 *
 * Bases: bars carry `basis` so the page never mixes upfront and total values
 * on one axis. `rnpv`-basis bars (rNPV, Monte Carlo) are whole-asset values in
 * $M and are drawn on the total-value panel, visually distinguished by colour.
 *
 * Constants (list on the methodology page):
 *  - RNPV_FALLBACK_BAND = 0.25 — when no Monte Carlo run exists the rNPV bar
 *    spans ±25% of the point estimate.
 *  - WALK_AWAY_SHARE_OF_FLOOR = 0.80 — walk-away upfront is 80% of the floor
 *    unless the engine's defensive walk-away threshold is lower.
 */

import type { CalculationResult } from '@/lib/calculations';
import type { RNPVResult, MonteCarloResult, ScenarioResult } from '@/lib/financial/types';
import type { BuyerSpecificValuation } from '@/lib/financial/buyer-specific-valuation';
import type { PDFReportData } from '@/lib/report/types';
import type { ValuationBridge, BridgeBar, CompSet, CompStats } from './types';

export const RNPV_FALLBACK_BAND = 0.25;
export const WALK_AWAY_SHARE_OF_FLOOR = 0.8;

export interface ValuationBridgeInput {
  result: CalculationResult;
  rnpv?: RNPVResult;
  monteCarlo?: MonteCarloResult;
  scenarios?: ScenarioResult[];
  buyerValuations?: BuyerSpecificValuation[];
  compSet?: CompSet | null;
  defensive?: PDFReportData['defensiveAnalysis'];
  asOf: string;
}

/** Round a $M figure to a number an advisor would say out loud. */
export function roundSensible(value: number): number {
  if (!Number.isFinite(value)) return 0;
  const abs = Math.abs(value);
  const sign = value < 0 ? -1 : 1;
  let rounded: number;
  if (abs >= 1000) rounded = Math.round(abs / 50) * 50;
  else if (abs >= 100) rounded = Math.round(abs / 5) * 5;
  else if (abs >= 20) rounded = Math.round(abs);
  else if (abs >= 5) rounded = Math.round(abs * 2) / 2;
  else rounded = Math.round(abs * 10) / 10;
  return sign * rounded;
}

function median(values: number[]): number | null {
  const v = values.filter(Number.isFinite).sort((a, b) => a - b);
  if (v.length === 0) return null;
  const m = Math.floor(v.length / 2);
  return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
}

function pickStats(compSet: CompSet): CompStats {
  const ex = compSet.stats.exOutliers;
  return ex && ex.n > 0 ? ex : compSet.stats.all;
}

function barMid(bar: BridgeBar): number {
  return bar.mid ?? (bar.low + bar.high) / 2;
}

const METHOD_REASON: Record<BridgeBar['key'], string> = {
  comps_total: 'disclosed headline totals include milestones that are rarely paid in full',
  comps_upfront: 'it reflects cash paid at signing in comparable deals',
  rnpv: 'it is the risk-adjusted present value of the cash flows, not a headline',
  monte_carlo: 'it spans the simulated distribution of the risk-adjusted value',
  scenarios: 'it spans the bear-to-bull scenario envelope around the base case',
  buyer_implied: 'it adds each buyer’s strategic premium to the generic value',
  headline: 'it is the engine’s calibrated headline for this profile',
};

export function buildValuationBridge(input: ValuationBridgeInput): ValuationBridge {
  const { result, rnpv, monteCarlo, scenarios, buyerValuations, compSet, defensive, asOf } = input;
  const terms = result.terms;
  const bars: BridgeBar[] = [];

  // Comps (ex-outlier stats preferred)
  let compsTotalP25: number | null = null;
  let compsUpfrontP25: number | null = null;
  let compsTotalP50: number | null = null;
  let compsN = 0;
  if (compSet && compSet.stats) {
    const stats = pickStats(compSet);
    const exOut = stats === compSet.stats.exOutliers;
    compsN = stats.n;
    if (stats.total && stats.n > 0) {
      compsTotalP25 = stats.total.p25;
      compsTotalP50 = stats.total.p50;
      bars.push({
        key: 'comps_total',
        label: 'Comparable deals (total)',
        basis: 'total',
        low: stats.total.p25,
        mid: stats.total.p50,
        high: stats.total.p75,
        n: stats.n,
        note: `25th–75th percentile of disclosed totals${exOut ? ', outliers removed' : ''}`,
      });
    }
    if (stats.upfront && stats.n > 0) {
      compsUpfrontP25 = stats.upfront.p25;
      bars.push({
        key: 'comps_upfront',
        label: 'Comparable deals (upfront)',
        basis: 'upfront',
        low: stats.upfront.p25,
        mid: stats.upfront.p50,
        high: stats.upfront.p75,
        n: stats.n,
        note: `25th–75th percentile of disclosed upfronts${exOut ? ', outliers removed' : ''}`,
      });
    }
  }

  // rNPV
  if (rnpv && Number.isFinite(rnpv.riskAdjustedNPV)) {
    const mid = rnpv.riskAdjustedNPV;
    const hasMc = !!monteCarlo && Number.isFinite(monteCarlo.percentiles?.p10) && Number.isFinite(monteCarlo.percentiles?.p90);
    bars.push({
      key: 'rnpv',
      label: 'Risk-adjusted NPV',
      basis: 'rnpv',
      low: hasMc ? Math.min(monteCarlo!.percentiles.p10, mid) : mid * (1 - RNPV_FALLBACK_BAND),
      mid,
      high: hasMc ? Math.max(monteCarlo!.percentiles.p90, mid) : mid * (1 + RNPV_FALLBACK_BAND),
      note: hasMc
        ? `Point estimate with the simulated 10th–90th percentile band; cumulative PoS ${(rnpv.cumulativePoS * 100).toFixed(0)}%`
        : `Point estimate ±${RNPV_FALLBACK_BAND * 100}%; cumulative PoS ${(rnpv.cumulativePoS * 100).toFixed(0)}%`,
    });
  }

  // Monte Carlo
  if (monteCarlo && monteCarlo.percentiles) {
    const p = monteCarlo.percentiles;
    bars.push({
      key: 'monte_carlo',
      label: 'Monte Carlo',
      basis: 'rnpv',
      low: p.p10,
      mid: p.p50,
      high: p.p90,
      n: monteCarlo.iterations,
      note: `10th–90th percentile of ${monteCarlo.iterations.toLocaleString()} simulated outcomes`,
    });
  }

  // Scenarios
  if (scenarios && scenarios.length > 0) {
    const lows = scenarios.map(s => s.adjustedDealValue?.low).filter(Number.isFinite) as number[];
    const highs = scenarios.map(s => s.adjustedDealValue?.high).filter(Number.isFinite) as number[];
    if (lows.length && highs.length) {
      bars.push({
        key: 'scenarios',
        label: 'Scenario envelope',
        basis: 'total',
        low: Math.min(...lows),
        mid: terms.totalDealValue.median,
        high: Math.max(...highs),
        n: scenarios.length,
        note: 'Bear-case low to bull-case high across the scenario set; base case at the mid',
      });
    }
  }

  // Buyer-implied
  if (buyerValuations && buyerValuations.length > 0) {
    const valid = buyerValuations.filter(b => b.buyerSpecificDealValue && Number.isFinite(b.buyerSpecificDealValue.median));
    if (valid.length) {
      bars.push({
        key: 'buyer_implied',
        label: 'Buyer-specific value',
        basis: 'total',
        low: Math.min(...valid.map(b => b.buyerSpecificDealValue.low)),
        mid: median(valid.map(b => b.buyerSpecificDealValue.median)),
        high: Math.max(...valid.map(b => b.buyerSpecificDealValue.high)),
        n: valid.length,
        note: `Generic value plus each buyer’s strategic premium, across ${valid.length} buyer${valid.length === 1 ? '' : 's'}`,
      });
    }
  }

  // Headline (always)
  bars.push({
    key: 'headline',
    label: 'Headline (this brief)',
    basis: 'total',
    low: terms.totalDealValue.low,
    mid: terms.totalDealValue.median,
    high: terms.totalDealValue.high,
    note: 'Calibrated engine range for this profile; the ask is the mid',
  });

  // Ask, floor, walk-away — the single source of truth
  const ask = { totalM: terms.totalDealValue.median, upfrontM: terms.upfront.median };
  const floor = {
    totalM: compsTotalP25 != null ? Math.max(terms.totalDealValue.low, compsTotalP25) : terms.totalDealValue.low,
    upfrontM: compsUpfrontP25 != null ? Math.max(terms.upfront.low, compsUpfrontP25) : terms.upfront.low,
  };
  // Floor can never exceed the ask.
  floor.totalM = Math.min(floor.totalM, ask.totalM);
  floor.upfrontM = Math.min(floor.upfrontM, ask.upfrontM);

  const defensiveWalk = defensive?.walkAwayThreshold;
  const walkAwayUpfront = defensiveWalk != null && Number.isFinite(defensiveWalk) && defensiveWalk > 0 && defensiveWalk < floor.upfrontM
    ? defensiveWalk
    : roundSensible(floor.upfrontM * WALK_AWAY_SHARE_OF_FLOOR);

  const reconciliation = buildReconciliation(bars, ask, floor, compsTotalP50, compsN);

  return {
    asOf,
    bars,
    ask,
    floor,
    walkAway: { upfrontM: walkAwayUpfront },
    reconciliation,
  };
}

function fmt(v: number): string {
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}B`;
  return `$${Math.round(v)}M`;
}

function buildReconciliation(
  bars: BridgeBar[],
  ask: { totalM: number; upfrontM: number },
  floor: { totalM: number; upfrontM: number },
  compsTotalP50: number | null,
  compsN: number,
): string {
  const sentences: string[] = [];
  const askTotal = ask.totalM;

  if (compsTotalP50 != null && askTotal > 0) {
    const spread = (compsTotalP50 - askTotal) / askTotal;
    const dir = spread >= 0 ? 'above' : 'below';
    sentences.push(
      `Comparable deals put the median total at ${fmt(compsTotalP50)} (n = ${compsN}), ${Math.abs(spread * 100).toFixed(0)}% ${dir} the headline ask of ${fmt(askTotal)}.`,
    );
  } else {
    sentences.push(`No comparable set was available for this profile, so the ask rests on the engine headline of ${fmt(askTotal)} and the risk-adjusted value.`);
  }

  const ranked = bars
    .filter(b => b.basis !== 'upfront' && b.key !== 'headline')
    .map(b => ({ bar: b, mid: barMid(b) }))
    .sort((a, b) => b.mid - a.mid);
  if (ranked.length >= 2) {
    const hi = ranked[0];
    const lo = ranked[ranked.length - 1];
    sentences.push(
      `${hi.bar.label} is the highest method at ${fmt(hi.mid)} because ${METHOD_REASON[hi.bar.key]}; ${lo.bar.label.toLowerCase()} is the lowest at ${fmt(lo.mid)} because ${METHOD_REASON[lo.bar.key]}.`,
    );
  } else if (ranked.length === 1) {
    sentences.push(`The only independent method available is ${ranked[0].bar.label.toLowerCase()} at ${fmt(ranked[0].mid)}; ${METHOD_REASON[ranked[0].bar.key]}.`);
  }

  sentences.push(
    `The ask is set at the headline mid, ${fmt(askTotal)} total and ${fmt(ask.upfrontM)} upfront, with the floor at ${fmt(floor.totalM)} total and ${fmt(floor.upfrontM)} upfront (the greater of the headline low and the comps 25th percentile).`,
  );

  return sentences.join(' ');
}
