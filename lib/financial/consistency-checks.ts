/**
 * Cross-Engine Consistency Checks — Layer 2 of the 5-layer bug detection system
 *
 * Runs after the full financial orchestrator. Asserts that independent engines
 * AGREE on shared numbers. This catches bugs where one engine drifts from the
 * others (e.g., a tornado baseline that no longer matches the main rNPV).
 *
 * Philosophy: every engine is allowed to have its own internal bug. But if two
 * engines that should produce the same number produce different numbers, at
 * least one is wrong — and that's a finding worth surfacing to Sentry.
 */

import type {
  RNPVResult,
  MonteCarloResult,
  ScenarioComparisonResult,
  DealWaterfall,
} from './types';
import type { InvariantViolation } from './invariants';

function v(
  severity: InvariantViolation['severity'],
  rule: string,
  message: string,
  context: Record<string, unknown>,
): InvariantViolation {
  return { severity, rule, message, context };
}

/**
 * Run cross-engine consistency checks.
 *
 * All args are the outputs of the individual engines in the orchestrator.
 * Returns an empty array if every engine agrees with the others within tolerance.
 *
 * @param rnpv            Main rNPV result (the canonical reference)
 * @param monteCarlo      Monte Carlo simulation result
 * @param tornadoBaseline Baseline rNPV that the tornado engine used (may be undefined if tornado skipped)
 * @param scenarios       Bear/base/bull scenario comparison
 * @param dealWaterfall   Deal waterfall breakdown
 * @param buyerGenericMedian Generic-buyer median deal value from the buyer-specific engine (optional)
 */
export function checkCrossEngineConsistency(
  rnpv: RNPVResult,
  monteCarlo: MonteCarloResult,
  tornadoBaseline: number | undefined,
  scenarios: ScenarioComparisonResult,
  dealWaterfall: DealWaterfall,
  buyerGenericMedian?: number,
): InvariantViolation[] {
  const out: InvariantViolation[] = [];

  const mainRnpv = rnpv.riskAdjustedNPV;
  const mainDealMedian = rnpv.impliedDealValue?.totalDeal?.median;

  // 1. CRITICAL: Main rNPV within 15% of MC P50
  const mcP50 = monteCarlo.percentiles?.p50;
  if (Number.isFinite(mainRnpv) && Number.isFinite(mcP50) && Math.abs(mainRnpv) > 5) {
    const divergence = Math.abs(mainRnpv - mcP50) / Math.abs(mainRnpv);
    // 15% tolerance is strict; preclinical/early-stage MC can diverge more due to
    // lognormal right-skew, so we allow 30% at the outer band but still warn.
    const threshold = 0.15;
    if (divergence > 0.30) {
      out.push(
        v('critical', 'consistency.main_vs_mc_p50',
          `Main rNPV $${mainRnpv.toFixed(0)}M diverges from MC P50 $${mcP50.toFixed(0)}M by ${(divergence * 100).toFixed(0)}% (tolerance: 30%).`,
          { mainRnpv, mcP50, divergence }),
      );
    } else if (divergence > threshold) {
      out.push(
        v('warning', 'consistency.main_vs_mc_p50_soft',
          `Main rNPV $${mainRnpv.toFixed(0)}M diverges from MC P50 $${mcP50.toFixed(0)}M by ${(divergence * 100).toFixed(0)}% (soft tolerance: 15%).`,
          { mainRnpv, mcP50, divergence }),
      );
    }
  }

  // 2. CRITICAL: Tornado baseline rNPV must equal main engine rNPV (within 1%)
  if (tornadoBaseline != null && Number.isFinite(tornadoBaseline) && Number.isFinite(mainRnpv)) {
    const diff = Math.abs(tornadoBaseline - mainRnpv);
    const tol = Math.max(1, Math.abs(mainRnpv) * 0.01);
    if (diff > tol) {
      out.push(
        v('critical', 'consistency.tornado_baseline',
          `Tornado baseline $${tornadoBaseline.toFixed(0)}M != main rNPV $${mainRnpv.toFixed(0)}M (|diff|=${diff.toFixed(1)}, tol=${tol.toFixed(1)}).`,
          { tornadoBaseline, mainRnpv, diff, tolerance: tol }),
      );
    }
  }

  // 3. CRITICAL: Deal waterfall total deal median must equal rNPV impliedDealValue.totalDeal.median
  if (dealWaterfall?.totalDealValue?.median != null && mainDealMedian != null) {
    const waterfallMedian = dealWaterfall.totalDealValue.median;
    const diff = Math.abs(waterfallMedian - mainDealMedian);
    const tol = Math.max(2, Math.abs(mainDealMedian) * 0.05);
    if (diff > tol) {
      out.push(
        v('critical', 'consistency.deal_waterfall_vs_rnpv',
          `Deal waterfall total deal median $${waterfallMedian.toFixed(0)}M != rNPV impliedDealValue median $${mainDealMedian.toFixed(0)}M (|diff|=${diff.toFixed(1)}, tol=${tol.toFixed(1)}).`,
          { waterfallMedian, mainDealMedian, diff, tolerance: tol }),
      );
    }
  }

  // 4. CRITICAL: Scenario base case rNPV must equal main engine rNPV (within 5%)
  const baseCase = scenarios?.base?.rnpv;
  if (baseCase != null && Number.isFinite(baseCase) && Number.isFinite(mainRnpv) && Math.abs(mainRnpv) > 5) {
    const divergence = Math.abs(baseCase - mainRnpv) / Math.abs(mainRnpv);
    if (divergence > 0.05) {
      out.push(
        v('critical', 'consistency.scenario_base_vs_main',
          `Scenario base rNPV $${baseCase.toFixed(0)}M diverges from main rNPV $${mainRnpv.toFixed(0)}M by ${(divergence * 100).toFixed(0)}% (tolerance: 5%).`,
          { baseCase, mainRnpv, divergence }),
      );
    }
  }

  // 5. WARNING: Buyer-specific generic value ≈ deal waterfall median
  if (buyerGenericMedian != null && dealWaterfall?.totalDealValue?.median != null) {
    const waterfallMedian = dealWaterfall.totalDealValue.median;
    const diff = Math.abs(buyerGenericMedian - waterfallMedian);
    const tol = Math.max(5, Math.abs(waterfallMedian) * 0.15);
    if (diff > tol) {
      out.push(
        v('warning', 'consistency.buyer_generic_vs_waterfall',
          `Buyer-specific generic median $${buyerGenericMedian.toFixed(0)}M != deal waterfall median $${waterfallMedian.toFixed(0)}M by more than 15%.`,
          { buyerGenericMedian, waterfallMedian, diff }),
      );
    }
  }

  return out;
}

/** Compatibility shim: some callers pass a full tornado result array. */
export function checkCrossEngineConsistencyFromTornado(
  rnpv: RNPVResult,
  monteCarlo: MonteCarloResult,
  tornado: unknown,
  scenarios: ScenarioComparisonResult,
  dealWaterfall: DealWaterfall,
  buyerGenericMedian?: number,
): InvariantViolation[] {
  // The tornado engine computes its own baseline internally; we don't see it
  // from the outside. Pass undefined so the baseline check is skipped unless
  // a caller explicitly provides it.
  void tornado;
  return checkCrossEngineConsistency(
    rnpv,
    monteCarlo,
    undefined,
    scenarios,
    dealWaterfall,
    buyerGenericMedian,
  );
}
