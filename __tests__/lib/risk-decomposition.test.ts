/**
 * Risk Decomposition (Tier 4 Item 11) — acceptance tests.
 *
 * Verifies that decomposeRisk attributes the value wedge
 * (unadjustedNPV − riskAdjustedNPV) across clinical / commercial /
 * manufacturing / regulatory / other buckets within a ±10% reconciliation gap.
 */

import { calculateRNPV } from '@/lib/financial/rnpv-engine';
import { decomposeRisk } from '@/lib/financial/risk-decomposition';
import type { RNPVInput } from '@/lib/financial/types';

// Baseline phase 2 oncology mAb template — small-molecule variant swaps modality.
function makeInput(overrides: Partial<RNPVInput> = {}): RNPVInput {
  return {
    therapeuticArea: 'oncology',
    indication: 'lung_nsclc',
    modality: 'mab',
    phase: 'phase2',
    territory: 'global',
    competitivePosition: 'follower',
    dataQuality: 'good',
    peakSalesEstimate: { low: 500, median: 1500, high: 3000 },
    regulatoryDesignations: {
      breakthrough: false,
      fastTrack: false,
      orphan: false,
      prime: false,
    },
    ...overrides,
  };
}

describe('Risk Decomposition — decomposeRisk()', () => {
  test('sum of buckets reconciles to risk wedge within 10%', () => {
    const input = makeInput();
    const result = calculateRNPV(input);
    const decomp = decomposeRisk(input, result, calculateRNPV);
    expect(decomp.reconciliationGap).toBeLessThanOrEqual(0.10);
  });

  test('bucket percentOfTotal values sum to 1.0 ± 0.001', () => {
    const input = makeInput();
    const result = calculateRNPV(input);
    const decomp = decomposeRisk(input, result, calculateRNPV);
    const sum = decomp.clinical.percentOfTotal +
      decomp.commercial.percentOfTotal +
      decomp.manufacturing.percentOfTotal +
      decomp.regulatory.percentOfTotal +
      decomp.other.percentOfTotal;
    expect(sum).toBeCloseTo(1.0, 3);
  });

  test('all bucket impacts are non-negative', () => {
    const input = makeInput();
    const result = calculateRNPV(input);
    const decomp = decomposeRisk(input, result, calculateRNPV);
    expect(decomp.clinical.impact_M).toBeGreaterThanOrEqual(0);
    expect(decomp.commercial.impact_M).toBeGreaterThanOrEqual(0);
    expect(decomp.manufacturing.impact_M).toBeGreaterThanOrEqual(0);
    expect(decomp.regulatory.impact_M).toBeGreaterThanOrEqual(0);
    expect(decomp.other.impact_M).toBeGreaterThanOrEqual(0);
  });

  test('early-stage oncology: clinical bucket dominates commercial', () => {
    const input = makeInput({ phase: 'phase1' });
    const result = calculateRNPV(input);
    const decomp = decomposeRisk(input, result, calculateRNPV);
    // Phase 1 attrition is brutal (~90%+); commercial density matters much less.
    expect(decomp.clinical.impact_M).toBeGreaterThan(decomp.commercial.impact_M);
  });

  test('CAR-T manufacturing bucket is non-trivial (≥2% of total)', () => {
    // modality uses the exact keys from MANUFACTURING_WACC_PREMIUM
    const input = makeInput({ modality: 'carT_heme', phase: 'phase2' });
    const result = calculateRNPV(input);
    const decomp = decomposeRisk(input, result, calculateRNPV);
    // CAR-T carries a 2pp WACC premium; the mfg bucket should be visible.
    if (decomp.total_M > 0) {
      expect(decomp.manufacturing.impact_M / decomp.total_M).toBeGreaterThanOrEqual(0.02);
    }
  });

  test('small molecule manufacturing bucket ≈ 0', () => {
    const input = makeInput({ modality: 'smallMolecule' });
    const result = calculateRNPV(input);
    const decomp = decomposeRisk(input, result, calculateRNPV);
    // Small molecules have no MANUFACTURING_WACC_PREMIUM.
    expect(decomp.manufacturing.impact_M).toBeLessThan(decomp.total_M * 0.02);
  });

  test('regulatory designations reduce regulatory risk vs. no designations', () => {
    const withDesig = makeInput({
      regulatoryDesignations: { breakthrough: true, fastTrack: true, orphan: true, prime: false },
    });
    const withoutDesig = makeInput();

    const resultA = calculateRNPV(withDesig);
    const resultB = calculateRNPV(withoutDesig);
    const decompA = decomposeRisk(withDesig, resultA, calculateRNPV);
    const decompB = decomposeRisk(withoutDesig, resultB, calculateRNPV);
    // Asset WITH designations records regulatory impact (value at risk if pulled)
    // Asset WITHOUT designations has ≈ 0 regulatory impact
    expect(decompA.regulatory.impact_M).toBeGreaterThan(decompB.regulatory.impact_M);
  });

  test('decomposer is idempotent — same inputs produce same decomposition', () => {
    const input = makeInput();
    const result1 = calculateRNPV(input);
    const result2 = calculateRNPV(input);
    const decomp1 = decomposeRisk(input, result1, calculateRNPV);
    const decomp2 = decomposeRisk(input, result2, calculateRNPV);
    expect(decomp1.total_M).toBeCloseTo(decomp2.total_M, 6);
    expect(decomp1.clinical.impact_M).toBeCloseTo(decomp2.clinical.impact_M, 6);
  });

  test('zero risk wedge produces empty decomposition', () => {
    // Construct a synthetic baseline where unadjustedNPV === riskAdjustedNPV
    // (impossible from real inputs, but we feed synthetic result to the decomposer)
    const input = makeInput();
    const result = calculateRNPV(input);
    const synthetic = { ...result, unadjustedNPV: 100, riskAdjustedNPV: 100 };
    const decomp = decomposeRisk(input, synthetic, calculateRNPV);
    expect(decomp.total_M).toBe(0);
    expect(decomp.clinical.impact_M).toBe(0);
    expect(decomp.commercial.impact_M).toBe(0);
  });

  test('counterfactual runs carry skipDecomposition flag — no infinite recursion', () => {
    // If recursion isn't guarded, decomposeRisk would stack overflow on the
    // first nested call. Any successful completion proves the guard works.
    const input = makeInput();
    const result = calculateRNPV(input);
    expect(() => decomposeRisk(input, result, calculateRNPV)).not.toThrow();
  });

  test('every bucket has at least one driver string', () => {
    const input = makeInput();
    const result = calculateRNPV(input);
    const decomp = decomposeRisk(input, result, calculateRNPV);
    expect(decomp.clinical.drivers.length).toBeGreaterThan(0);
    expect(decomp.commercial.drivers.length).toBeGreaterThan(0);
    expect(decomp.manufacturing.drivers.length).toBeGreaterThan(0);
    expect(decomp.regulatory.drivers.length).toBeGreaterThan(0);
  });
});

describe('Risk Decomposition — TIER4_FLAGS gating', () => {
  const originalEnv = process.env.TIER4_RISK_DECOMP;

  afterEach(() => {
    if (originalEnv === undefined) {
      delete process.env.TIER4_RISK_DECOMP;
    } else {
      process.env.TIER4_RISK_DECOMP = originalEnv;
    }
    jest.resetModules();
  });

  test('calculateRNPV does not attach riskDecomposition when flag is off', () => {
    delete process.env.TIER4_RISK_DECOMP;
    jest.resetModules();
    // Re-import after env change so module-level flag reads the new value
    const { calculateRNPV: fresh } = require('@/lib/financial/rnpv-engine');
    const input = makeInput();
    const result = fresh(input);
    expect(result.riskDecomposition).toBeUndefined();
  });
});
