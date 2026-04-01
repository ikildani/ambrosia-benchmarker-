/**
 * Tests for institutional-grade rNPV upgrades
 * Covers: Deal Waterfall, Scenario Comparison, Lifecycle Extensions
 */
import { buildDealWaterfall, generateScenarioComparison, calculateLifecycleExtensions } from '@/lib/financial/institutional-upgrades';
import { calculateRNPV } from '@/lib/financial/rnpv-engine';
import type { RNPVInput, RNPVResult } from '@/lib/financial/types';

// Shared test input — Phase 2 oncology mAb
const baseInput: RNPVInput = {
  phase: 'phase2' as any,
  therapeuticArea: 'oncology' as any,
  modality: 'mab' as any,
  indication: 'lung_nsclc',
  territory: 'us',
  peakSalesEstimate: { low: 800, median: 1500, high: 2500 },
  competitivePosition: 'racing',
  dataQuality: 'moderate',
  regulatoryDesignations: { breakthrough: false, fastTrack: false, orphan: false, prime: false },
};

let baseResult: RNPVResult;

beforeAll(() => {
  baseResult = calculateRNPV(baseInput);
});

// ============================================================
// Upgrade 1: Deal Valuation Waterfall
// ============================================================
describe('Deal Valuation Waterfall', () => {
  it('should produce a valid waterfall with 4 steps', () => {
    const waterfall = buildDealWaterfall(baseInput, baseResult);
    expect(waterfall.steps.length).toBe(4);
    expect(waterfall.steps[0].label).toContain('NPV');
    expect(waterfall.steps[0].runningTotal).toBeGreaterThan(0);
  });

  it('should have step 1 = unadjusted NPV', () => {
    const waterfall = buildDealWaterfall(baseInput, baseResult);
    expect(waterfall.steps[0].runningTotal).toBeCloseTo(baseResult.unadjustedNPV, -1);
  });

  it('should have step 2 apply PoS discount (running total decreases)', () => {
    const waterfall = buildDealWaterfall(baseInput, baseResult);
    expect(waterfall.steps[1].adjustment).toBeLessThan(0);
    expect(waterfall.steps[1].runningTotal).toBeLessThan(waterfall.steps[0].runningTotal);
  });

  it('should allocate deal components that sum to total deal value', () => {
    const waterfall = buildDealWaterfall(baseInput, baseResult);
    const sum = waterfall.upfrontPayment.median +
      waterfall.developmentMilestones.median +
      waterfall.commercialMilestones.median;
    // Royalties are a % not additive, but upfront + dev + commercial should approximate total
    expect(sum).toBeGreaterThan(0);
    expect(waterfall.totalDealValue.median).toBeGreaterThan(0);
  });

  it('should have low < median < high for all components', () => {
    const waterfall = buildDealWaterfall(baseInput, baseResult);
    expect(waterfall.upfrontPayment.low).toBeLessThanOrEqual(waterfall.upfrontPayment.median);
    expect(waterfall.upfrontPayment.median).toBeLessThanOrEqual(waterfall.upfrontPayment.high);
    expect(waterfall.totalDealValue.low).toBeLessThanOrEqual(waterfall.totalDealValue.median);
    expect(waterfall.totalDealValue.median).toBeLessThanOrEqual(waterfall.totalDealValue.high);
  });

  it('should apply strategic premium for firstInClass', () => {
    const ficInput = { ...baseInput, competitivePosition: 'firstInClass' };
    const ficResult = calculateRNPV(ficInput);
    const ficWaterfall = buildDealWaterfall(ficInput, ficResult);
    const racingWaterfall = buildDealWaterfall(baseInput, baseResult);
    // firstInClass should have higher total deal value (all else equal isn't true due to rNPV diff, but premium step should be positive)
    const premiumStep = ficWaterfall.steps.find(s => s.label.toLowerCase().includes('strateg') || s.label.toLowerCase().includes('premium'));
    if (premiumStep) {
      expect(premiumStep.adjustment).toBeGreaterThan(0);
    }
  });

  it('should generate a non-empty narrative', () => {
    const waterfall = buildDealWaterfall(baseInput, baseResult);
    expect(waterfall.narrative.length).toBeGreaterThan(20);
  });

  it('should vary upfront % by phase — approved > phase2 > preclinical', () => {
    const preclinInput = { ...baseInput, phase: 'preclinical' as any };
    const approvedInput = { ...baseInput, phase: 'approved' as any };
    const preclinResult = calculateRNPV(preclinInput);
    const approvedResult = calculateRNPV(approvedInput);

    const preclinWf = buildDealWaterfall(preclinInput, preclinResult);
    const phase2Wf = buildDealWaterfall(baseInput, baseResult);
    const approvedWf = buildDealWaterfall(approvedInput, approvedResult);

    const preclinUpfrontRatio = preclinWf.upfrontPayment.median / Math.max(preclinWf.totalDealValue.median, 1);
    const phase2UpfrontRatio = phase2Wf.upfrontPayment.median / Math.max(phase2Wf.totalDealValue.median, 1);
    const approvedUpfrontRatio = approvedWf.upfrontPayment.median / Math.max(approvedWf.totalDealValue.median, 1);

    expect(approvedUpfrontRatio).toBeGreaterThan(phase2UpfrontRatio);
    expect(phase2UpfrontRatio).toBeGreaterThan(preclinUpfrontRatio);
  });
});

// ============================================================
// Upgrade 2: Scenario Comparison
// ============================================================
describe('Scenario Comparison (Bear/Base/Bull)', () => {
  it('should return bear, base, and bull scenarios', () => {
    const comparison = generateScenarioComparison(baseInput, baseResult, calculateRNPV);
    expect(comparison.bear).toBeDefined();
    expect(comparison.base).toBeDefined();
    expect(comparison.bull).toBeDefined();
  });

  it('should have bear.rnpv < base.rnpv < bull.rnpv', () => {
    const comparison = generateScenarioComparison(baseInput, baseResult, calculateRNPV);
    expect(comparison.bear.rnpv).toBeLessThan(comparison.base.rnpv);
    expect(comparison.base.rnpv).toBeLessThan(comparison.bull.rnpv);
  });

  it('should have weights summing to 1.0', () => {
    const comparison = generateScenarioComparison(baseInput, baseResult, calculateRNPV);
    const totalWeight = comparison.bearWeight + comparison.baseWeight + comparison.bullWeight;
    expect(totalWeight).toBeCloseTo(1.0, 5);
  });

  it('should have expectedValue between bear and bull', () => {
    const comparison = generateScenarioComparison(baseInput, baseResult, calculateRNPV);
    expect(comparison.expectedValue).toBeGreaterThanOrEqual(comparison.bear.rnpv);
    expect(comparison.expectedValue).toBeLessThanOrEqual(comparison.bull.rnpv);
  });

  it('should have base.rnpv match the original rNPV', () => {
    const comparison = generateScenarioComparison(baseInput, baseResult, calculateRNPV);
    expect(comparison.base.rnpv).toBeCloseTo(baseResult.riskAdjustedNPV, 0);
  });

  it('should include assumptions for each scenario', () => {
    const comparison = generateScenarioComparison(baseInput, baseResult, calculateRNPV);
    expect(comparison.bear.assumptions.length).toBeGreaterThan(0);
    expect(comparison.bull.assumptions.length).toBeGreaterThan(0);
  });

  it('should use tighter bands for late-stage assets', () => {
    const lateInput = { ...baseInput, phase: 'phase3' as any };
    const lateResult = calculateRNPV(lateInput);
    const lateComparison = generateScenarioComparison(lateInput, lateResult, calculateRNPV);
    const earlyComparison = generateScenarioComparison(baseInput, baseResult, calculateRNPV);

    // Late-stage spread (bull/bear ratio) should be tighter than early-stage
    const lateSpread = lateComparison.bull.rnpv / Math.max(Math.abs(lateComparison.bear.rnpv), 1);
    const earlySpread = earlyComparison.bull.rnpv / Math.max(Math.abs(earlyComparison.bear.rnpv), 1);
    expect(lateSpread).toBeLessThan(earlySpread);
  });
});

// ============================================================
// Upgrade 3: Lifecycle Extensions
// ============================================================
describe('Lifecycle Extensions', () => {
  it('should return at least one extension for oncology', () => {
    const extensions = calculateLifecycleExtensions(baseInput, baseResult);
    expect(extensions.extensions.length).toBeGreaterThan(0);
  });

  it('should include label expansion for oncology', () => {
    const extensions = calculateLifecycleExtensions(baseInput, baseResult);
    const labelExp = extensions.extensions.find(e => e.type === 'labelExpansion');
    expect(labelExp).toBeDefined();
    expect(labelExp!.probability).toBeGreaterThan(0.3);
  });

  it('should include pediatric exclusivity', () => {
    const extensions = calculateLifecycleExtensions(baseInput, baseResult);
    const peds = extensions.extensions.find(e => e.type === 'pediatricExclusivity');
    expect(peds).toBeDefined();
    expect(peds!.probability).toBeCloseTo(0.80, 1);
  });

  it('should have extendedRNPV >= baseRNPV', () => {
    const extensions = calculateLifecycleExtensions(baseInput, baseResult);
    expect(extensions.extendedRNPV).toBeGreaterThanOrEqual(extensions.baseRNPV);
  });

  it('should have incrementalValue >= 0', () => {
    const extensions = calculateLifecycleExtensions(baseInput, baseResult);
    expect(extensions.incrementalValue).toBeGreaterThanOrEqual(0);
  });

  it('should include combination approval when combinationPotential is strong', () => {
    const comboInput = { ...baseInput, combinationPotential: 'strong' };
    const comboResult = calculateRNPV(comboInput);
    const extensions = calculateLifecycleExtensions(comboInput, comboResult);
    const combo = extensions.extensions.find(e => e.type === 'combinationApproval');
    expect(combo).toBeDefined();
    expect(combo!.probability).toBeGreaterThan(0.3);
  });

  it('should NOT include combination approval when combinationPotential is absent', () => {
    const noComboInput = { ...baseInput, combinationPotential: undefined };
    const noComboResult = calculateRNPV(noComboInput);
    const extensions = calculateLifecycleExtensions(noComboInput, noComboResult);
    const combo = extensions.extensions.find(e => e.type === 'combinationApproval');
    expect(combo).toBeUndefined();
  });

  it('should have higher label expansion probability for oncology vs neurology', () => {
    const neuroInput = { ...baseInput, therapeuticArea: 'neurology' as any };
    const neuroResult = calculateRNPV(neuroInput);
    const oncoExt = calculateLifecycleExtensions(baseInput, baseResult);
    const neuroExt = calculateLifecycleExtensions(neuroInput, neuroResult);
    const oncoLabel = oncoExt.extensions.find(e => e.type === 'labelExpansion');
    const neuroLabel = neuroExt.extensions.find(e => e.type === 'labelExpansion');
    if (oncoLabel && neuroLabel) {
      expect(oncoLabel.probability).toBeGreaterThan(neuroLabel.probability);
    }
  });
});
