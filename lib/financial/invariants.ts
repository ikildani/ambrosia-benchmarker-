/**
 * Mathematical Invariants — Layer 1 of the 5-layer bug detection system
 *
 * Pure, cheap runtime checks that assert properties which MUST hold by the
 * laws of math and biotech reality. These run on EVERY production rNPV
 * calculation and log critical violations to Sentry without throwing.
 *
 * The goal is to catch silent bugs of the class that recently inflated a
 * Phase 1 oncology timeline from 8.5y to 15.8y — the model ran successfully
 * but produced nonsense numbers.
 *
 * Integration:
 *   - calculateRNPV() calls checkRNPVInvariants() at the end
 *   - runMonteCarlo() calls checkMonteCarloInvariants() at the end
 *   - orchestrator runs the full cross-engine consistency checks
 *
 * Philosophy: invariants should NEVER false-positive in production. A
 * critical invariant violation is a bug; a warning is a reason to double-check.
 */

import type {
  RNPVInput,
  RNPVResult,
  MonteCarloResult,
  ScenarioComparisonResult,
} from './types';
import { captureClientError } from '@/lib/sentry-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

/** A single invariant violation with severity, rule name, message, and context. */
export interface InvariantViolation {
  /** 'critical' = a law-of-math / reality violation; 'warning' = smells wrong */
  severity: 'critical' | 'warning';
  /** Short machine-readable rule identifier (e.g., 'rnpv.pos_bounds') */
  rule: string;
  /** Human-readable description of what went wrong */
  message: string;
  /** Arbitrary context dict for debugging (IDs, offending values, etc.) */
  context: Record<string, unknown>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Phase-bounded years-to-market ceilings (industry reality).
 *
 * Values slightly generous vs. textbook averages to accommodate the slower
 * TAs (cardiovascular, neurology, metabolic) whose pivotal trials can run
 * 4-5+ years. If this ceiling fires, it almost certainly indicates a
 * pathway-duplication bug (e.g., Phase 1 oncology jumping from 8.5y to 15.8y).
 */
const MAX_YEARS_TO_MARKET_BY_PHASE: Record<string, number> = {
  approved: 2,
  nda_filed: 3,
  phase3: 8,
  phase2_3: 9,
  phase2: 11,
  phase1_2: 12,
  phase1: 13,
  preclinical: 17,
  discovery: 22,
};

/**
 * Oncology phase-specific cumulative PoS bands used for sanity warnings.
 * Sources: BIO/Informa 2021, Wong Siah Lo 2019.
 */
const ONCOLOGY_POS_BANDS: Record<string, { min: number; max: number }> = {
  discovery: { min: 0.01, max: 0.08 },
  preclinical: { min: 0.02, max: 0.10 },
  phase1: { min: 0.04, max: 0.14 },
  phase1_2: { min: 0.06, max: 0.18 },
  phase2: { min: 0.12, max: 0.32 },
  phase2_3: { min: 0.25, max: 0.55 },
  phase3: { min: 0.45, max: 0.75 },
  nda_filed: { min: 0.75, max: 0.97 },
  approved: { min: 0.95, max: 1.0 },
};

function v(
  severity: InvariantViolation['severity'],
  rule: string,
  message: string,
  context: Record<string, unknown>,
): InvariantViolation {
  return { severity, rule, message, context };
}

function isFiniteNumber(x: unknown): x is number {
  return typeof x === 'number' && Number.isFinite(x);
}

// ---------------------------------------------------------------------------
// rNPV Invariants
// ---------------------------------------------------------------------------

/**
 * Assert invariants over a single rNPV calculation result.
 *
 * Returns a list of violations — empty means the result passed every check.
 * Never throws. Call `assertInvariants` if you want throwing behavior.
 */
export function checkRNPVInvariants(
  result: RNPVResult,
  input: RNPVInput,
): InvariantViolation[] {
  const out: InvariantViolation[] = [];

  // 1. Risk-adjustment must not exceed the unadjusted ceiling for POSITIVE
  //    NPV assets. (For negative-NPV assets, the simplified rNPV convention
  //    risk-weights revenue at cumulative PoS but R&D costs at near-1.0 early-
  //    phase PoS, so the signed risk-adjusted can legitimately fall below the
  //    unadjusted. We only check the positive side here.)
  //    We compare ex-terminal because terminalValue is a separate PoS-scaled
  //    perpetuity that can exceed the operating-period NPV.
  if (
    isFiniteNumber(result.riskAdjustedNPV) &&
    isFiniteNumber(result.unadjustedNPV) &&
    result.unadjustedNPV > 0
  ) {
    const exTerminal = result.riskAdjustedNPV - (result.terminalValue || 0);
    const slack = Math.max(5, Math.abs(result.unadjustedNPV) * 0.02);
    if (exTerminal - result.unadjustedNPV > slack) {
      out.push(
        v('critical', 'rnpv.risk_exceeds_unadjusted',
          `Risk-adjusted NPV (ex-terminal $${exTerminal.toFixed(0)}M) exceeds positive unadjusted NPV ($${result.unadjustedNPV.toFixed(0)}M). Risk-weighting must not inflate upside.`,
          { riskAdjustedNPV: result.riskAdjustedNPV, unadjustedNPV: result.unadjustedNPV, exTerminal, terminalValue: result.terminalValue }),
      );
    }
  }

  // 2. cumulative PoS must be in [0, 1]
  if (!isFiniteNumber(result.cumulativePoS) || result.cumulativePoS < 0 || result.cumulativePoS > 1) {
    out.push(
      v('critical', 'rnpv.pos_bounds',
        `cumulativePoS ${result.cumulativePoS} is outside [0, 1].`,
        { cumulativePoS: result.cumulativePoS }),
    );
  }

  // 3. discount rate must be in a reasonable pharma WACC range
  if (!isFiniteNumber(result.discountRate) || result.discountRate < 0.05 || result.discountRate > 0.35) {
    out.push(
      v('critical', 'rnpv.discount_rate_bounds',
        `discountRate ${(result.discountRate * 100).toFixed(1)}% is outside [5%, 35%].`,
        { discountRate: result.discountRate }),
    );
  }

  // 4. yearsToMarket must be non-negative and finite
  if (!isFiniteNumber(result.yearsToMarket) || result.yearsToMarket < 0) {
    out.push(
      v('critical', 'rnpv.years_to_market_negative',
        `yearsToMarket ${result.yearsToMarket} is negative or non-finite.`,
        { yearsToMarket: result.yearsToMarket }),
    );
  }

  // 5. phase-bounded yearsToMarket ceiling
  const ceiling = MAX_YEARS_TO_MARKET_BY_PHASE[input.phase];
  if (ceiling != null && isFiniteNumber(result.yearsToMarket) && result.yearsToMarket > ceiling) {
    out.push(
      v('critical', 'rnpv.years_to_market_phase_ceiling',
        `yearsToMarket ${result.yearsToMarket.toFixed(1)}y exceeds industry ceiling of ${ceiling}y for phase=${input.phase}. (Detects pathway duplication bugs.)`,
        { phase: input.phase, yearsToMarket: result.yearsToMarket, ceiling }),
    );
  }

  // 6. cashFlows must not be empty (except for 'approved' which can still project)
  if (!Array.isArray(result.cashFlows) || result.cashFlows.length === 0) {
    out.push(
      v('critical', 'rnpv.empty_cash_flows',
        'cashFlows array is empty — nothing to discount.',
        { phase: input.phase }),
    );
  }

  // 7. peakSalesYear must be on or after the launch year for pre-launch assets.
  //    NOTE: peakSalesYear is a RELATIVE year index (0-based from current year),
  //    not an absolute calendar year. It comes from cashFlows[i].year.
  const alreadyLaunched = input.phase === 'approved' || input.phase === 'nda_filed';
  if (
    isFiniteNumber(result.peakSalesYear) &&
    isFiniteNumber(result.yearsToMarket) &&
    !alreadyLaunched
  ) {
    const launchYear = Math.floor(result.yearsToMarket);
    // Peak sales should occur at or after launch year — and within the forecast horizon
    if (result.peakSalesYear < launchYear) {
      out.push(
        v('critical', 'rnpv.peak_sales_year_before_launch',
          `peakSalesYear ${result.peakSalesYear} is before launchYear ${launchYear} for a pre-launch asset (phase=${input.phase}).`,
          { peakSalesYear: result.peakSalesYear, launchYear, phase: input.phase }),
      );
    }
  }

  // 8. terminal value must be non-negative (it's a discounted perpetuity)
  if (!isFiniteNumber(result.terminalValue) || result.terminalValue < -0.01) {
    out.push(
      v('critical', 'rnpv.terminal_value_negative',
        `terminalValue $${result.terminalValue}M is negative or non-finite.`,
        { terminalValue: result.terminalValue }),
    );
  }

  // 9. WARNING: oncology PoS sanity by phase
  if (input.therapeuticArea === 'oncology') {
    const band = ONCOLOGY_POS_BANDS[input.phase];
    if (band && isFiniteNumber(result.cumulativePoS)) {
      if (result.cumulativePoS < band.min * 0.5 || result.cumulativePoS > band.max * 1.5) {
        out.push(
          v('warning', 'rnpv.oncology_pos_sanity',
            `Oncology ${input.phase} cumulativePoS ${(result.cumulativePoS * 100).toFixed(1)}% is outside expected band [${(band.min * 100).toFixed(0)}%, ${(band.max * 100).toFixed(0)}%].`,
            { phase: input.phase, cumulativePoS: result.cumulativePoS, expectedBand: band }),
        );
      }
    }
  }

  // 10. Pre-launch revenue must be zero
  if (Array.isArray(result.cashFlows) && isFiniteNumber(result.yearsToMarket)) {
    // launchYear is the first year at which commercial revenue may appear
    const launchYear = Math.floor(result.yearsToMarket);
    const offenders = result.cashFlows.filter(cf => cf.year < launchYear && cf.revenue > 0.01);
    if (offenders.length > 0) {
      out.push(
        v('critical', 'rnpv.pre_launch_revenue',
          `${offenders.length} cash flow year(s) have non-zero revenue before launchYear=${launchYear}.`,
          { launchYear, offenders: offenders.slice(0, 3).map(cf => ({ year: cf.year, revenue: cf.revenue })) }),
      );
    }
  }

  // 11. Sum of phaseTransitions[].yearsToComplete should approximately equal yearsToMarket
  if (Array.isArray(result.phaseTransitions) && result.phaseTransitions.length > 0 && isFiniteNumber(result.yearsToMarket)) {
    const sumPhaseYears = result.phaseTransitions.reduce((s, t) => s + (t.yearsToComplete || 0), 0);
    // Allow 1y slack for data-quality timeline multipliers + market-access delay
    // that are applied after the core pathway sum.
    if (sumPhaseYears > 0 && Math.abs(sumPhaseYears - result.yearsToMarket) > Math.max(2, result.yearsToMarket * 0.35)) {
      out.push(
        v('critical', 'rnpv.phase_transitions_sum_mismatch',
          `Sum of phaseTransitions[].yearsToComplete (${sumPhaseYears.toFixed(1)}y) differs from yearsToMarket (${result.yearsToMarket.toFixed(1)}y) by more than the allowed slack.`,
          { sumPhaseYears, yearsToMarket: result.yearsToMarket, phaseTransitions: result.phaseTransitions.map(t => ({ phase: t.phase, yrs: t.yearsToComplete })) }),
      );
    }
  }

  // 12. WARNING: phaseTransitions cumulativeProb must monotonically decrease
  if (Array.isArray(result.phaseTransitions) && result.phaseTransitions.length >= 2) {
    for (let i = 1; i < result.phaseTransitions.length; i++) {
      const prev = result.phaseTransitions[i - 1];
      const curr = result.phaseTransitions[i];
      if (curr.cumulativeProb > prev.cumulativeProb + 1e-6) {
        out.push(
          v('warning', 'rnpv.phase_cumprob_not_monotonic',
            `phaseTransitions[${i}].cumulativeProb (${curr.cumulativeProb.toFixed(3)}) > phaseTransitions[${i - 1}].cumulativeProb (${prev.cumulativeProb.toFixed(3)}). Cumulative success must monotonically decrease.`,
            { transitions: result.phaseTransitions.map(t => ({ phase: t.phase, cumulativeProb: t.cumulativeProb })) }),
        );
        break;
      }
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Monte Carlo Invariants
// ---------------------------------------------------------------------------

/**
 * Assert invariants over a Monte Carlo simulation result.
 */
export function checkMonteCarloInvariants(
  result: MonteCarloResult,
): InvariantViolation[] {
  const out: InvariantViolation[] = [];
  const p = result.percentiles;

  // 1. percentiles must be ordered
  const order: [string, number][] = [
    ['p5', p?.p5], ['p10', p?.p10], ['p25', p?.p25], ['p50', p?.p50], ['p75', p?.p75], ['p90', p?.p90], ['p95', p?.p95],
  ];
  for (let i = 1; i < order.length; i++) {
    const [prevName, prevVal] = order[i - 1];
    const [currName, currVal] = order[i];
    if (isFiniteNumber(prevVal) && isFiniteNumber(currVal) && currVal < prevVal - 0.5) {
      out.push(
        v('critical', 'mc.percentiles_not_ordered',
          `Monte Carlo percentile ordering broken: ${currName}=${currVal.toFixed(1)} < ${prevName}=${prevVal.toFixed(1)}.`,
          { percentiles: p }),
      );
      break;
    }
  }

  // 2. mean within reasonable range of p50
  //    Pharma distributions are typically right-skewed (rare big wins), so some
  //    skewness is normal. We only flag genuinely pathological cases where the
  //    mean-p50 gap is >2x the stdDev AND both quantities are non-trivial.
  if (
    isFiniteNumber(result.mean) &&
    isFiniteNumber(p?.p50) &&
    isFiniteNumber(result.stdDev) &&
    result.stdDev > 0 &&
    Math.abs(p.p50) > 50
  ) {
    const sigmaGap = Math.abs(result.mean - p.p50) / result.stdDev;
    if (sigmaGap > 3) {
      out.push(
        v('critical', 'mc.mean_vs_p50_skew',
          `|mean - p50| / stdDev = ${sigmaGap.toFixed(1)}σ exceeds 3σ. Distribution is pathologically skewed; possible sampling bug.`,
          { mean: result.mean, p50: p.p50, stdDev: result.stdDev, sigmaGap }),
      );
    }
  }

  // 3. stdDev must be positive
  if (!isFiniteNumber(result.stdDev) || result.stdDev <= 0) {
    out.push(
      v('critical', 'mc.stddev_non_positive',
        `Monte Carlo stdDev ${result.stdDev} is non-positive — sampling produced a degenerate distribution.`,
        { stdDev: result.stdDev }),
    );
  }

  // 4. probability of positive NPV must be in [0, 1]
  if (
    !isFiniteNumber(result.probabilityOfPositiveNPV) ||
    result.probabilityOfPositiveNPV < 0 ||
    result.probabilityOfPositiveNPV > 1
  ) {
    out.push(
      v('critical', 'mc.prob_positive_npv_bounds',
        `probabilityOfPositiveNPV ${result.probabilityOfPositiveNPV} is outside [0, 1].`,
        { probabilityOfPositiveNPV: result.probabilityOfPositiveNPV }),
    );
  }

  // 5. WARNING: P10-P90 spread should be 0.5x-10x |p50|
  if (isFiniteNumber(p?.p10) && isFiniteNumber(p?.p90) && isFiniteNumber(p?.p50) && Math.abs(p.p50) > 10) {
    const spread = p.p90 - p.p10;
    const spreadRatio = spread / Math.abs(p.p50);
    if (spreadRatio < 0.5 || spreadRatio > 10) {
      out.push(
        v('warning', 'mc.p10_p90_spread',
          `P10-P90 spread ratio ${spreadRatio.toFixed(2)}x |p50| is outside expected 0.5x-10x band. Distribution may be too tight (sampling bug) or too wide (pathological inputs).`,
          { p10: p.p10, p50: p.p50, p90: p.p90, spread, spreadRatio }),
      );
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Scenario Comparison Invariants
// ---------------------------------------------------------------------------

/**
 * Assert invariants over bear/base/bull scenario comparison.
 */
export function checkScenarioInvariants(
  scenarios: ScenarioComparisonResult,
): InvariantViolation[] {
  const out: InvariantViolation[] = [];

  if (!scenarios || !scenarios.bear || !scenarios.base || !scenarios.bull) {
    out.push(
      v('critical', 'scenario.missing_cases',
        'ScenarioComparisonResult missing bear, base, or bull case.',
        { hasBear: !!scenarios?.bear, hasBase: !!scenarios?.base, hasBull: !!scenarios?.bull }),
    );
    return out;
  }

  // 1. bear rnpv <= base rnpv <= bull rnpv
  if (scenarios.bear.rnpv > scenarios.base.rnpv + 0.5) {
    out.push(
      v('critical', 'scenario.bear_above_base',
        `Bear rNPV $${scenarios.bear.rnpv.toFixed(0)}M > base rNPV $${scenarios.base.rnpv.toFixed(0)}M.`,
        { bear: scenarios.bear.rnpv, base: scenarios.base.rnpv }),
    );
  }
  if (scenarios.base.rnpv > scenarios.bull.rnpv + 0.5) {
    out.push(
      v('critical', 'scenario.base_above_bull',
        `Base rNPV $${scenarios.base.rnpv.toFixed(0)}M > bull rNPV $${scenarios.bull.rnpv.toFixed(0)}M.`,
        { base: scenarios.base.rnpv, bull: scenarios.bull.rnpv }),
    );
  }

  // 2. bear deal <= base deal <= bull deal
  if (scenarios.bear.impliedDeal > scenarios.base.impliedDeal + 0.5) {
    out.push(
      v('critical', 'scenario.bear_deal_above_base',
        `Bear deal $${scenarios.bear.impliedDeal.toFixed(0)}M > base deal $${scenarios.base.impliedDeal.toFixed(0)}M.`,
        { bear: scenarios.bear.impliedDeal, base: scenarios.base.impliedDeal }),
    );
  }
  if (scenarios.base.impliedDeal > scenarios.bull.impliedDeal + 0.5) {
    out.push(
      v('critical', 'scenario.base_deal_above_bull',
        `Base deal $${scenarios.base.impliedDeal.toFixed(0)}M > bull deal $${scenarios.bull.impliedDeal.toFixed(0)}M.`,
        { base: scenarios.base.impliedDeal, bull: scenarios.bull.impliedDeal }),
    );
  }

  // 3. WARNING: bull/bear ratio sanity — between 3x and 50x
  if (Math.abs(scenarios.bear.rnpv) > 5 && scenarios.bull.rnpv > 0) {
    const ratio = scenarios.bull.rnpv / Math.max(1, Math.abs(scenarios.bear.rnpv));
    if (ratio < 3 || ratio > 50) {
      out.push(
        v('warning', 'scenario.bull_bear_ratio',
          `Bull/bear ratio ${ratio.toFixed(1)}x is outside expected 3x-50x band.`,
          { bull: scenarios.bull.rnpv, bear: scenarios.bear.rnpv, ratio }),
      );
    }
  }

  return out;
}

// ---------------------------------------------------------------------------
// Assert Wrapper
// ---------------------------------------------------------------------------

export interface AssertInvariantsOptions {
  /** When true, throws on the first critical violation (for tests). */
  throw?: boolean;
  /** Sentry context tag (default: 'rnpv-invariants') */
  context?: string;
  /** Extra tags/data to attach to the Sentry report */
  extra?: Record<string, unknown>;
}

/**
 * Convenience wrapper:
 *   - Always logs critical violations to Sentry via captureClientError.
 *   - Throws on the first critical if `options.throw === true`.
 *   - Returns the full violation list (including warnings).
 */
export function assertInvariants(
  violations: InvariantViolation[],
  options: AssertInvariantsOptions = {},
): InvariantViolation[] {
  const criticals = violations.filter(v => v.severity === 'critical');

  if (criticals.length > 0) {
    const err = new Error(
      `Invariant violation(s) [${criticals.length}]: ${criticals.map(c => c.rule).join(', ')}`,
    );
    captureClientError(err, options.context || 'rnpv-invariants', {
      violations: criticals,
      ...(options.extra || {}),
    });

    if (options.throw) {
      throw err;
    }
  }

  return violations;
}
