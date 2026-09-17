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
import { runFinancialModel } from '@/lib/financial/run-financial-model';
import { calculateDealTerms, type CalculationInput } from '@/lib/calculations';

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

describe('5. Monte Carlo is recentred on the engine and its P50 rule is meaningful', () => {
  it.each([phase2NSCLC, phase1GastricADCCodev, preclinicalCNS])('P50 equals the engine rNPV within 30% on %#', input => {
    const rnpv = calculateRNPV(input);
    const mc = runMonteCarlo({ rnpvInput: input, engineRNPV: rnpv.riskAdjustedNPV }, 42);
    expect(Number.isFinite(mc.samplerBaseline)).toBe(true);
    expect(mc.samplerEnvelope).toBeDefined();
    expect(mc.recentering).toBeDefined();
    expect(mc.recentering!.method).not.toBe('none');
    if (Math.abs(rnpv.riskAdjustedNPV) > 5) {
      const divergence = Math.abs(mc.percentiles.p50 - rnpv.riskAdjustedNPV) / Math.abs(rnpv.riskAdjustedNPV);
      expect(divergence).toBeLessThanOrEqual(0.30);
    }
    // Percentile ordering survives recentring.
    const p = mc.percentiles;
    expect(p.p10).toBeLessThanOrEqual(p.p50);
    expect(p.p50).toBeLessThanOrEqual(p.p90);
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
  });

  it('without an engine rNPV the sampler is left alone and only the envelope rule applies', () => {
    const rnpv = calculateRNPV(phase2NSCLC);
    const mc = runMonteCarlo({ rnpvInput: phase2NSCLC }, 42);
    expect(mc.recentering!.method).toBe('none');
    const criticalRules = checkCrossEngineConsistency(
      rnpv, mc, undefined,
      generateScenarioComparison(phase2NSCLC, rnpv, calculateRNPV),
      buildDealWaterfall(phase2NSCLC, rnpv), undefined,
    ).filter(v => v.severity === 'critical').map(v => v.rule);
    expect(criticalRules).not.toContain('consistency.main_vs_mc_p50');
    expect(criticalRules).not.toContain('consistency.mc_p50_outside_sampler_envelope');
  });

  it('a recentred distribution that drifts from the engine is caught', () => {
    const rnpv = calculateRNPV(phase2NSCLC);
    const mc = runMonteCarlo({ rnpvInput: phase2NSCLC, engineRNPV: rnpv.riskAdjustedNPV }, 42);
    const drifted = { ...mc, percentiles: { ...mc.percentiles, p50: rnpv.riskAdjustedNPV * 2 } };
    const rules = checkCrossEngineConsistency(
      rnpv, drifted, undefined,
      generateScenarioComparison(phase2NSCLC, rnpv, calculateRNPV),
      buildDealWaterfall(phase2NSCLC, rnpv), undefined,
    ).filter(v => v.severity === 'critical').map(v => v.rule);
    expect(rules).toContain('consistency.main_vs_mc_p50');
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

describe('7. the blended headline rests on the same comparables as the published range', () => {
  const calcInput = {
    therapeuticArea: 'oncology', phase: 'phase1', dealType: 'codevelopment', modality: 'adc', indication: 'gastric', territory: 'global',
    biomarker: 'unselected', lineOfTherapy: '2L', treatmentApproach: 'symptomatic', combinationPotential: 'some',
    competitivePosition: 'racing', dataQuality: 'promising',
    regulatoryDesignations: { breakthrough: false, fastTrack: false, orphan: false, prime: false },
  } as unknown as CalculationInput;

  it('uses the calibrated benchmark as the comparables method and lets it carry the blend before Phase 2', () => {
    const terms = calculateDealTerms(calcInput);
    const model = runFinancialModel(calcInput, terms);
    expect(model.ensemble.comparablesSource).toBe('benchmark');
    expect(model.ensemble.earlyPhasePrior).toBe(true);
    const comps = model.ensemble.methods.find(m => m.name === 'Comparable Transactions')!;
    expect(comps.value).toBeCloseTo(terms.terms.totalDealValue.median, 0);
    expect(comps.weight).toBeGreaterThanOrEqual(0.6);
    expect(model.monteCarlo.recentering?.method).not.toBe('none');
    if (Math.abs(model.rnpv.riskAdjustedNPV) > 5) {
      expect(Math.abs(model.monteCarlo.percentiles.p50 - model.rnpv.riskAdjustedNPV) / Math.abs(model.rnpv.riskAdjustedNPV)).toBeLessThanOrEqual(0.3);
    }
  });

  it('a user-curated comp set still takes precedence over the benchmark', () => {
    const terms = calculateDealTerms(calcInput);
    const custom = { ids: ['a', 'b', 'c', 'd'], upfront: { p25: 50, median: 80, p75: 120 }, totalValue: { p25: 500, median: 800, p75: 1200 }, n: 4, totalValuesM: [500, 700, 900, 1200] };
    const model = runFinancialModel(calcInput, terms, undefined, undefined, custom);
    expect(model.ensemble.comparablesSource).toBe('custom');
    expect(model.ensemble.customCompCount).toBe(4);
  });
});
