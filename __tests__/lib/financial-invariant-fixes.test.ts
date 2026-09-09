/**
 * Regression tests for the Sep 2026 invariant review.
 *
 * Reproduced on real user programs (gastric Ph1 ADC codev, gastric Ph2 SM,
 * MASH Ph3 GLP-1, preclinical schizophrenia SM, NSCLC Ph2 SM control):
 *   1. rNPV-implied upfront collapsed to ~$0 or negative before Phase 2
 *   2. waterfall never reconciled to the engine for licensing / acquisition
 *   3. scenario time-to-market deltas tripped base-run timeline rules
 *   4. codev overlay used |rNPV|, so bear > base when rNPV went negative
 *   5. MC P50 was compared to a different model and fired on every run
 *   6. every run sent its own Sentry critical
 */
import { calculateRNPV } from '@/lib/financial/rnpv-engine';
import { buildDealWaterfall, generateScenarioComparison } from '@/lib/financial/institutional-upgrades';
import { runMonteCarlo } from '@/lib/financial/monte-carlo';
import {
  checkRNPVInvariants,
  checkScenarioInvariants,
  assertInvariants,
  resetInvariantReporting,
} from '@/lib/financial/invariants';
import { checkCrossEngineConsistency } from '@/lib/financial/consistency-checks';
import type { RNPVInput } from '@/lib/financial/types';

jest.mock('@/lib/sentry-client', () => ({ captureClientError: jest.fn() }));
// eslint-disable-next-line @typescript-eslint/no-require-imports
const { captureClientError } = require('@/lib/sentry-client') as { captureClientError: jest.Mock };

const designations = { breakthrough: false, fastTrack: false, orphan: false, prime: false };

const preclinicalCNS: RNPVInput = {
  phase: 'preclinical' as never,
  therapeuticArea: 'neurology' as never,
  modality: 'smallMolecule' as never,
  indication: 'schizophrenia',
  territory: 'global',
  peakSalesEstimate: { low: 3000, median: 7000, high: 14000 },
  competitivePosition: 'racing',
  dataQuality: 'promising',
  regulatoryDesignations: designations,
  dealType: 'licensing',
};

const phase1GastricADCCodev: RNPVInput = {
  phase: 'phase1' as never,
  therapeuticArea: 'oncology' as never,
  modality: 'adc' as never,
  indication: 'gastric',
  territory: 'global',
  peakSalesEstimate: { low: 1000, median: 2500, high: 5000 },
  competitivePosition: 'racing',
  dataQuality: 'promising',
  regulatoryDesignations: designations,
  dealType: 'codevelopment',
};

const phase2NSCLC: RNPVInput = {
  phase: 'phase2' as never,
  therapeuticArea: 'oncology' as never,
  modality: 'smallMolecule' as never,
  indication: 'lung_nsclc',
  territory: 'global',
  peakSalesEstimate: { low: 3000, median: 6000, high: 12000 },
  competitivePosition: 'racing',
  dataQuality: 'promising',
  regulatoryDesignations: designations,
  dealType: 'licensing',
};

describe('1. early-phase market floor and non-negative clamp', () => {
  it('floors a preclinical implied upfront at the comp low instead of publishing a negative number', () => {
    const r = calculateRNPV({
      ...preclinicalCNS,
      benchmarkUpfront: { low: 22, median: 81, high: 149 },
      benchmarkDealValue: { low: 644, median: 1839, high: 3030 },
    });
    expect(r.impliedDealValue.upfront.low).toBeGreaterThanOrEqual(22);
    expect(r.impliedDealValue.upfront.median).toBeGreaterThanOrEqual(r.impliedDealValue.upfront.low);
    expect(r.impliedDealValue.upfront.high).toBeGreaterThanOrEqual(r.impliedDealValue.upfront.median);
    expect(r.impliedDealValue.totalDeal.low).toBeGreaterThanOrEqual(r.impliedDealValue.upfront.low);
    // When the floor binds on the median the method defers to the comp
    // shape instead of publishing a flat single-point range.
    expect(r.impliedDealValue.upfront.high).toBeGreaterThan(r.impliedDealValue.upfront.low);
  });

  it('uses a conservative phase minimum when no comps are supplied', () => {
    const r = calculateRNPV({ ...phase1GastricADCCodev, dealType: 'licensing' });
    expect(r.impliedDealValue.upfront.low).toBeGreaterThanOrEqual(25);
  });

  it('never publishes a negative implied deal value at any phase', () => {
    const r = calculateRNPV({
      ...preclinicalCNS,
      peakSalesEstimate: { low: 50, median: 100, high: 200 },
    });
    expect(r.riskAdjustedNPV).toBeLessThan(0); // the case that used to go negative
    expect(r.impliedDealValue.upfront.low).toBeGreaterThanOrEqual(0);
    expect(r.impliedDealValue.totalDeal.low).toBeGreaterThanOrEqual(0);
  });
});

describe('2. waterfall reconciles to the engine for licensing and acquisition', () => {
  it.each(['licensing', 'acquisition'] as const)('%s waterfall median equals engine implied total', dealType => {
    const input = { ...phase2NSCLC, dealType };
    const rnpv = calculateRNPV(input);
    const wf = buildDealWaterfall(input, rnpv);
    expect(Math.abs(wf.totalDealValue.median - rnpv.impliedDealValue.totalDeal.median)).toBeLessThanOrEqual(0.5);
    const rule = checkCrossEngineConsistency(
      rnpv,
      runMonteCarlo({ rnpvInput: input }, 42),
      undefined,
      generateScenarioComparison(input, rnpv, calculateRNPV),
      wf,
      undefined,
    ).find(v => v.rule === 'consistency.deal_waterfall_vs_rnpv');
    expect(rule).toBeUndefined();
  });
});

describe('3. scenario time-to-market deltas do not trip base-run timeline rules', () => {
  it('a +4y compound delay on a preclinical asset is not duplication', () => {
    const input = { ...preclinicalCNS, timeToMarketAdjustment: 4 };
    const r = calculateRNPV(input);
    const rules = checkRNPVInvariants(r, input).map(v => v.rule);
    expect(rules).not.toContain('rnpv.years_to_market_phase_ceiling');
    expect(rules).not.toContain('rnpv.phase_transitions_sum_mismatch');
  });

  it('still catches a genuine timeline overrun with no adjustment', () => {
    const r = calculateRNPV(preclinicalCNS);
    const tampered = { ...r, yearsToMarket: 30 };
    const rules = checkRNPVInvariants(tampered, preclinicalCNS).map(v => v.rule);
    expect(rules).toContain('rnpv.years_to_market_phase_ceiling');
  });
});

describe('4. codev headline is monotonic in rNPV', () => {
  it('bear case implied deal is never above base', () => {
    const base = calculateRNPV(phase1GastricADCCodev);
    const bear = calculateRNPV({
      ...phase1GastricADCCodev,
      peakSalesEstimate: { low: 500, median: 1250, high: 2500 },
      posMultiplier: 0.7,
    });
    expect(bear.riskAdjustedNPV).toBeLessThanOrEqual(base.riskAdjustedNPV);
    expect(bear.impliedDealValue.totalDeal.median).toBeLessThanOrEqual(base.impliedDealValue.totalDeal.median + 0.5);
    const rules = checkScenarioInvariants(
      generateScenarioComparison(phase1GastricADCCodev, base, calculateRNPV),
    ).map(v => v.rule);
    expect(rules).not.toContain('scenario.bear_deal_above_base');
  });
});

describe('5. Monte Carlo P50 is measured against the sampler envelope', () => {
  it.each([phase2NSCLC, phase1GastricADCCodev, preclinicalCNS])('no critical P50 rule on %#', input => {
    const rnpv = calculateRNPV(input);
    const mc = runMonteCarlo({ rnpvInput: input }, 42);
    expect(Number.isFinite(mc.samplerBaseline)).toBe(true);
    expect(mc.samplerEnvelope).toBeDefined();
    const violations = checkCrossEngineConsistency(
      rnpv,
      mc,
      undefined,
      generateScenarioComparison(input, rnpv, calculateRNPV),
      buildDealWaterfall(input, rnpv),
      undefined,
    );
    const criticalRules = violations.filter(v => v.severity === 'critical').map(v => v.rule);
    expect(criticalRules).not.toContain('consistency.main_vs_mc_p50');
    expect(criticalRules).not.toContain('consistency.mc_p50_outside_sampler_envelope');
    expect(criticalRules).not.toContain('consistency.mc_p50_vs_sampler_baseline');
    // Model divergence is still visible, as a warning.
    const info = violations.find(v => v.rule === 'consistency.main_vs_mc_p50');
    if (info) expect(info.severity).toBe('warning');
  });
});

describe('6. Sentry receives each (context, rule-set) once', () => {
  beforeEach(() => {
    resetInvariantReporting();
    captureClientError.mockClear();
  });

  it('repeats of the same critical set are not re-captured', () => {
    const violations = [{ severity: 'critical' as const, rule: 'x.rule', message: 'm', context: {} }];
    assertInvariants(violations, { context: 'test-ctx' });
    assertInvariants(violations, { context: 'test-ctx' });
    assertInvariants(violations, { context: 'test-ctx' });
    expect(captureClientError).toHaveBeenCalledTimes(1);
  });

  it('a different rule set or context is captured again', () => {
    assertInvariants([{ severity: 'critical' as const, rule: 'a', message: 'm', context: {} }], { context: 'c1' });
    assertInvariants([{ severity: 'critical' as const, rule: 'b', message: 'm', context: {} }], { context: 'c1' });
    assertInvariants([{ severity: 'critical' as const, rule: 'a', message: 'm', context: {} }], { context: 'c2' });
    expect(captureClientError).toHaveBeenCalledTimes(3);
  });
});
