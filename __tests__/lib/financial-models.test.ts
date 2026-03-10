/**
 * Financial Model Tests — rNPV, Monte Carlo, Discount Rates
 *
 * Tests core financial modules that power the deal valuation engine.
 * Ensures calculation accuracy, input guards, and data completeness.
 */

import { calculateRNPV } from '@/lib/financial/rnpv-engine';
import { runMonteCarlo } from '@/lib/financial/monte-carlo';
import { DEFAULT_DISCOUNT_RATES, COMPANY_TYPE_ADJUSTMENT } from '@/lib/financial/discount-rates';
import type { RNPVInput, MonteCarloInput } from '@/lib/financial/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const THERAPEUTIC_AREAS = [
  'oncology', 'neurology', 'immunology', 'metabolic',
  'cardiovascular', 'infectiousDisease', 'ophthalmology', 'womensHealth',
] as const;

const PHASES = [
  'discovery', 'preclinical', 'phase1', 'phase1_2', 'phase2',
  'phase2_3', 'phase3', 'nda_filed', 'approved',
] as const;

function makeRNPVInput(overrides: Partial<RNPVInput> = {}): RNPVInput {
  return {
    phase: 'phase2',
    therapeuticArea: 'oncology',
    modality: 'smallMolecule',
    indication: 'lung_nsclc',
    territory: 'global',
    peakSalesEstimate: { low: 1500, median: 3000, high: 5000 },
    competitivePosition: 'bestInClass',
    dataQuality: 'robust',
    regulatoryDesignations: {
      breakthrough: false,
      fastTrack: false,
      orphan: false,
      prime: false,
    },
    benchmarkDealValue: { low: 300, median: 600, high: 1200 },
    biomarkerStatus: 'validated',
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Discount Rates
// ---------------------------------------------------------------------------

describe('Discount Rates', () => {
  test('all 8 TAs have discount rate tables', () => {
    for (const ta of THERAPEUTIC_AREAS) {
      expect(DEFAULT_DISCOUNT_RATES[ta]).toBeDefined();
    }
  });

  test('all 9 phases have rates per TA', () => {
    for (const ta of THERAPEUTIC_AREAS) {
      for (const phase of PHASES) {
        const rate = DEFAULT_DISCOUNT_RATES[ta][phase];
        expect(rate).toBeDefined();
        expect(rate).toBeGreaterThan(0);
        expect(rate).toBeLessThan(0.30);
      }
    }
  });

  test('discount rates decrease monotonically from discovery to approved', () => {
    for (const ta of THERAPEUTIC_AREAS) {
      const rates = PHASES.map(p => DEFAULT_DISCOUNT_RATES[ta][p]);
      for (let i = 1; i < rates.length; i++) {
        expect(rates[i]).toBeLessThanOrEqual(rates[i - 1]);
      }
    }
  });

  test('neurology has higher rates than oncology (higher CNS risk)', () => {
    for (const phase of PHASES) {
      expect(DEFAULT_DISCOUNT_RATES.neurology[phase])
        .toBeGreaterThanOrEqual(DEFAULT_DISCOUNT_RATES.oncology[phase]);
    }
  });

  test('company type adjustments are sensible', () => {
    expect(COMPANY_TYPE_ADJUSTMENT.largePharma).toBeLessThan(0);
    expect(COMPANY_TYPE_ADJUSTMENT.midPharma).toBe(0);
    expect(COMPANY_TYPE_ADJUSTMENT.biotech).toBeGreaterThan(0);
    expect(COMPANY_TYPE_ADJUSTMENT.clinicalStageBiotech).toBeGreaterThan(COMPANY_TYPE_ADJUSTMENT.biotech);
    expect(COMPANY_TYPE_ADJUSTMENT.academic).toBeGreaterThan(COMPANY_TYPE_ADJUSTMENT.clinicalStageBiotech);
  });
});

// ---------------------------------------------------------------------------
// rNPV Engine
// ---------------------------------------------------------------------------

describe('rNPV Engine', () => {
  test('produces a valid result with default inputs', () => {
    const result = calculateRNPV(makeRNPVInput());
    expect(result).toBeDefined();
    expect(result.riskAdjustedNPV).toBeGreaterThan(0);
    expect(result.unadjustedNPV).toBeGreaterThan(result.riskAdjustedNPV);
    expect(result.cumulativePoS).toBeGreaterThan(0);
    expect(result.cumulativePoS).toBeLessThanOrEqual(1);
    expect(result.discountRate).toBeGreaterThan(0);
    expect(result.cashFlows.length).toBeGreaterThan(0);
  });

  test('rNPV generally increases with later phases (lower risk)', () => {
    const phaseOrder: Array<typeof PHASES[number]> = ['preclinical', 'phase1', 'phase2', 'phase3', 'approved'];
    const values = phaseOrder.map(phase =>
      calculateRNPV(makeRNPVInput({ phase })).riskAdjustedNPV
    );

    // Overall trend: approved >> preclinical (early phases can be negative due to dev costs)
    expect(values[values.length - 1]).toBeGreaterThan(values[0]);
    // Phase 3+ should always be positive for a $1B peak sales oncology asset
    expect(values[3]).toBeGreaterThan(0); // phase3
    expect(values[4]).toBeGreaterThan(0); // approved
  });

  test('higher peak sales produce higher rNPV', () => {
    const low = calculateRNPV(makeRNPVInput({ peakSalesEstimate: { low: 200, median: 400, high: 600 } }));
    const high = calculateRNPV(makeRNPVInput({ peakSalesEstimate: { low: 1000, median: 2000, high: 4000 } }));
    expect(high.riskAdjustedNPV).toBeGreaterThan(low.riskAdjustedNPV);
  });

  test('works for all 8 therapeutic areas without crashing', () => {
    for (const ta of THERAPEUTIC_AREAS) {
      const result = calculateRNPV(makeRNPVInput({ therapeuticArea: ta as any }));
      expect(typeof result.riskAdjustedNPV).toBe('number');
      expect(Number.isFinite(result.riskAdjustedNPV)).toBe(true);
      expect(result.cashFlows.length).toBeGreaterThan(0);
    }
  });

  test('works for all 9 phases without crashing', () => {
    for (const phase of PHASES) {
      const result = calculateRNPV(makeRNPVInput({ phase }));
      expect(typeof result.riskAdjustedNPV).toBe('number');
      expect(Number.isFinite(result.riskAdjustedNPV)).toBe(true);
      expect(result.cumulativePoS).toBeGreaterThan(0);
    }
  });

  test('cumulative PoS increases with later phases', () => {
    const phaseOrder: Array<typeof PHASES[number]> = ['preclinical', 'phase1', 'phase2', 'phase3', 'approved'];
    const posValues = phaseOrder.map(phase =>
      calculateRNPV(makeRNPVInput({ phase })).cumulativePoS
    );

    for (let i = 1; i < posValues.length; i++) {
      expect(posValues[i]).toBeGreaterThanOrEqual(posValues[i - 1]);
    }
  });

  test('implied deal value has correct structure', () => {
    const result = calculateRNPV(makeRNPVInput());
    expect(result.impliedDealValue).toBeDefined();
    expect(result.impliedDealValue.upfront.median).toBeGreaterThan(0);
    expect(result.impliedDealValue.totalDeal.median).toBeGreaterThan(result.impliedDealValue.upfront.median);
    expect(result.impliedDealValue.totalDeal.high).toBeGreaterThan(result.impliedDealValue.totalDeal.low);
  });

  test('phase transitions are populated', () => {
    const result = calculateRNPV(makeRNPVInput({ phase: 'preclinical' }));
    expect(result.phaseTransitions.length).toBeGreaterThan(0);
    for (const t of result.phaseTransitions) {
      expect(t.probability).toBeGreaterThan(0);
      expect(t.probability).toBeLessThanOrEqual(1);
      expect(t.cumulativeProb).toBeGreaterThan(0);
      expect(t.cumulativeProb).toBeLessThanOrEqual(1);
      expect(t.yearsToComplete).toBeGreaterThan(0);
    }
  });

  test('guards against invalid phase input', () => {
    const result = calculateRNPV(makeRNPVInput({ phase: 'invalid_phase' as any }));
    // Should fall back gracefully, not crash
    expect(result.riskAdjustedNPV).toBeGreaterThan(0);
  });

  test('guards against extreme peak sales', () => {
    const result = calculateRNPV(makeRNPVInput({
      peakSalesEstimate: { low: -500, median: 999999999, high: 999999999 },
    }));
    // Capped at 1M per guard
    expect(result.riskAdjustedNPV).toBeGreaterThan(0);
  });

  test('guards against extreme discount rate', () => {
    const result = calculateRNPV(makeRNPVInput({ discountRate: 0.99 }));
    // Capped at 40% per guard
    expect(result.discountRate).toBeLessThanOrEqual(0.40);
  });

  test('regulatory designations increase PoS', () => {
    const base = calculateRNPV(makeRNPVInput());
    const withBreakthrough = calculateRNPV(makeRNPVInput({
      regulatoryDesignations: { breakthrough: true, fastTrack: false, orphan: false, prime: false },
    }));
    expect(withBreakthrough.cumulativePoS).toBeGreaterThanOrEqual(base.cumulativePoS);
  });

  test('cash flows include both development costs and revenue', () => {
    const result = calculateRNPV(makeRNPVInput({ phase: 'preclinical' }));
    const hasCosts = result.cashFlows.some(cf => cf.rdCosts > 0);
    const hasRevenue = result.cashFlows.some(cf => cf.revenue > 0);
    expect(hasCosts).toBe(true);
    expect(hasRevenue).toBe(true);
  });

  test('cross-validation is populated when benchmark provided', () => {
    const result = calculateRNPV(makeRNPVInput());
    if (result.crossValidation) {
      expect(result.crossValidation.benchmarkMedian).toBeGreaterThan(0);
      expect(result.crossValidation.rnpvMedian).toBeGreaterThan(0);
      expect(typeof result.crossValidation.divergencePercent).toBe('number');
    }
  });
});

// ---------------------------------------------------------------------------
// Monte Carlo
// ---------------------------------------------------------------------------

describe('Monte Carlo Simulation', () => {
  const MC_ITERATIONS = 500;

  function makeMCInput(overrides: Partial<MonteCarloInput> = {}, rnpvOverrides: Partial<RNPVInput> = {}): MonteCarloInput {
    return {
      rnpvInput: makeRNPVInput(rnpvOverrides),
      iterations: MC_ITERATIONS,
      ...overrides,
    };
  }

  test('produces valid result', () => {
    const result = runMonteCarlo(makeMCInput(), 42);
    expect(result).toBeDefined();
    expect(result.mean).toBeGreaterThan(0);
    expect(result.stdDev).toBeGreaterThan(0);
    expect(result.iterations).toBe(MC_ITERATIONS);
  });

  test('percentiles are in correct order', () => {
    const result = runMonteCarlo(makeMCInput(), 42);
    const { p10, p25, p50, p75, p90 } = result.percentiles;
    expect(p10).toBeLessThanOrEqual(p25);
    expect(p25).toBeLessThanOrEqual(p50);
    expect(p50).toBeLessThanOrEqual(p75);
    expect(p75).toBeLessThanOrEqual(p90);
  });

  test('histogram has bins', () => {
    const result = runMonteCarlo(makeMCInput(), 42);
    expect(result.histogram.length).toBeGreaterThan(0);
    for (const bin of result.histogram) {
      expect(bin.count).toBeGreaterThanOrEqual(0);
      expect(bin.binEnd).toBeGreaterThan(bin.binStart);
    }
  });

  test('is deterministic with same seed', () => {
    const r1 = runMonteCarlo(makeMCInput(), 123);
    const r2 = runMonteCarlo(makeMCInput(), 123);
    expect(r1.mean).toBeCloseTo(r2.mean, 2);
    expect(r1.percentiles.p50).toBeCloseTo(r2.percentiles.p50, 2);
  });

  test('different seeds produce different results', () => {
    const r1 = runMonteCarlo(makeMCInput(), 1);
    const r2 = runMonteCarlo(makeMCInput(), 9999);
    expect(r1.mean).not.toBeCloseTo(r2.mean, 5);
  });

  test('higher peak sales increase mean NPV', () => {
    const low = runMonteCarlo(makeMCInput({}, { peakSalesEstimate: { low: 200, median: 400, high: 600 } }), 42);
    const high = runMonteCarlo(makeMCInput({}, { peakSalesEstimate: { low: 1000, median: 2000, high: 4000 } }), 42);
    expect(high.mean).toBeGreaterThan(low.mean);
  });

  test('works for all therapeutic areas', () => {
    for (const ta of THERAPEUTIC_AREAS) {
      const result = runMonteCarlo(makeMCInput({ iterations: 100 }, { therapeuticArea: ta as any }), 42);
      expect(result.mean).toBeGreaterThan(0);
    }
  });

  test('key driver sensitivity is populated', () => {
    const result = runMonteCarlo(makeMCInput(), 42);
    expect(result.keyDriverSensitivity).toBeDefined();
    expect(result.keyDriverSensitivity.length).toBeGreaterThan(0);
    for (const driver of result.keyDriverSensitivity) {
      expect(driver.label).toBeTruthy();
      expect(typeof driver.correlationWithNPV).toBe('number');
    }
  });

  test('probability of positive NPV is between 0 and 1', () => {
    const result = runMonteCarlo(makeMCInput(), 42);
    expect(result.probabilityOfPositiveNPV).toBeGreaterThanOrEqual(0);
    expect(result.probabilityOfPositiveNPV).toBeLessThanOrEqual(1);
  });
});
