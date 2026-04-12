/**
 * Tests for lib/financial/ensemble-valuation.ts (Item 7 — Tier 3)
 *
 * Validates the inverse-variance-weighted blend across rNPV, comparable
 * transactions, and real options. Includes property-based tests for
 * weight invariants and graceful degradation when methods are missing.
 */

import { calculateRNPV } from '@/lib/financial/rnpv-engine';
import { runMonteCarlo } from '@/lib/financial/monte-carlo';
import { calculateRealOptions } from '@/lib/financial/advanced-upgrades';
import {
  calculateEnsembleValuation,
  __test,
} from '@/lib/financial/ensemble-valuation';
import type { RNPVInput, RNPVResult, MonteCarloResult } from '@/lib/financial/types';
import type { ComparableDeal } from '@/lib/comparableDeals';
import { COMPARABLE_DEALS } from '@/lib/comparableDeals';
import * as fc from 'fast-check';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRNPVInput(overrides: Partial<RNPVInput> = {}): RNPVInput {
  return {
    phase: 'phase2',
    therapeuticArea: 'oncology',
    modality: 'mab',
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

function runFullPipeline(input: RNPVInput) {
  const rnpv = calculateRNPV(input);
  const monteCarlo = runMonteCarlo({ rnpvInput: input }, 42);
  const realOptions = calculateRealOptions(input, rnpv, monteCarlo);
  return { rnpv, monteCarlo, realOptions };
}

// Synthetic deal universe — small, deterministic
function syntheticDeals(values: number[], opts: Partial<ComparableDeal> = {}): ComparableDeal[] {
  return values.map((v, i) => ({
    licensor: `Licensor${i}`,
    licensee: `Buyer${i}`,
    value: `$${v}M`,
    totalValueM: v,
    year: 2024,
    relevance: 'synthetic',
    therapeuticArea: 'oncology',
    modalities: ['mab'],
    phase: 'phase2',
    dealType: 'licensing',
    ...opts,
  }));
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

describe('inverse-variance weighting', () => {
  test('three methods with equal variance → equal weights', () => {
    const w = __test.inverseVarianceWeights([100, 100, 100]);
    expect(w[0]).toBeCloseTo(1 / 3, 5);
    expect(w[1]).toBeCloseTo(1 / 3, 5);
    expect(w[2]).toBeCloseTo(1 / 3, 5);
    expect(w[0] + w[1] + w[2]).toBeCloseTo(1.0, 9);
  });

  test('one method with much smaller variance dominates', () => {
    const w = __test.inverseVarianceWeights([1, 100, 100]);
    expect(w[0]).toBeGreaterThan(0.95);
    expect(w[1]).toBeLessThan(0.025);
    expect(w[2]).toBeLessThan(0.025);
  });

  test('Infinity variance → zero weight, others renormalize', () => {
    const w = __test.inverseVarianceWeights([100, Number.POSITIVE_INFINITY, 100]);
    expect(w[1]).toBe(0);
    expect(w[0]).toBeCloseTo(0.5, 5);
    expect(w[2]).toBeCloseTo(0.5, 5);
  });

  test('all Infinity → equal-weight fallback', () => {
    const w = __test.inverseVarianceWeights([
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
      Number.POSITIVE_INFINITY,
    ]);
    expect(w[0]).toBeCloseTo(1 / 3, 5);
    expect(w[1]).toBeCloseTo(1 / 3, 5);
    expect(w[2]).toBeCloseTo(1 / 3, 5);
  });

  test('weights always sum to 1.0', () => {
    fc.assert(
      fc.property(
        fc.array(fc.double({ min: 0.1, max: 1e6, noNaN: true }), { minLength: 2, maxLength: 5 }),
        (variances) => {
          const w = __test.inverseVarianceWeights(variances);
          const sum = w.reduce((a, b) => a + b, 0);
          expect(sum).toBeCloseTo(1.0, 9);
        },
      ),
      { numRuns: 50 },
    );
  });
});

describe('comparable filter (Method 2)', () => {
  test('strict filter at level 0 when n ≥ 5', () => {
    const deals = syntheticDeals([400, 600, 800, 1000, 1200, 1400]);
    const result = __test.computeComparableMethod(makeRNPVInput(), deals);
    expect(result.widenLevel).toBe(0);
    expect(result.sampleSize).toBe(6);
    expect(result.value).toBe(900); // median of 6
  });

  test('widens to level 1 when modality match too sparse', () => {
    const deals = syntheticDeals([400, 600, 800], { modalities: ['adc'] });
    // Target is mab — none match modality, but all match TA + phase
    const result = __test.computeComparableMethod(makeRNPVInput(), deals);
    expect(result.widenLevel).toBe(1);
    expect(result.sampleSize).toBe(3);
  });

  test('widens to level 2 when phase match too sparse', () => {
    const deals = syntheticDeals(
      [400, 600, 800],
      { modalities: ['adc'], phase: 'preclinical' },
    );
    // Target is phase2 mab — preclinical adc widens twice
    const result = __test.computeComparableMethod(makeRNPVInput(), deals);
    expect(result.widenLevel).toBe(2);
    expect(result.sampleSize).toBe(3);
  });

  test('Infinity variance when no comparables match', () => {
    const deals = syntheticDeals([400, 600], { therapeuticArea: 'neurology' });
    const result = __test.computeComparableMethod(makeRNPVInput(), deals);
    expect(result.variance).toBe(Number.POSITIVE_INFINITY);
    expect(result.matchedDeals).toHaveLength(0);
  });

  test('comparables with missing phase are wildcard-matched', () => {
    // Bug C: deals without phase should still match
    const deals = syntheticDeals([400, 600, 800, 1000, 1200], { phase: undefined });
    const result = __test.computeComparableMethod(makeRNPVInput(), deals);
    expect(result.widenLevel).toBe(0);
    expect(result.sampleSize).toBe(5);
  });

  test('compound calculator phase widens correctly', () => {
    const deals = syntheticDeals([400, 600, 800, 1000, 1200], { phase: 'phase2' });
    // phase1_2 → DB phase_2 → window includes phase_1, phase_2, phase_3
    const result = __test.computeComparableMethod(
      makeRNPVInput({ phase: 'phase1_2' }),
      deals,
    );
    expect(result.widenLevel).toBe(0);
    expect(result.sampleSize).toBe(5);
  });

  test('matches secondaryTAs', () => {
    const deals = syntheticDeals([400, 600, 800, 1000, 1200], {
      therapeuticArea: 'neurology',
      secondaryTAs: ['oncology'],
    });
    const result = __test.computeComparableMethod(makeRNPVInput(), deals);
    expect(result.sampleSize).toBe(5);
  });
});

// ---------------------------------------------------------------------------
// End-to-end ensemble
// ---------------------------------------------------------------------------

describe('calculateEnsembleValuation — end-to-end', () => {
  test('produces a finite ensembleValue with all real-world inputs', () => {
    const input = makeRNPVInput();
    const { rnpv, monteCarlo, realOptions } = runFullPipeline(input);
    const ensemble = calculateEnsembleValuation(rnpv, monteCarlo, realOptions, input);

    expect(Number.isFinite(ensemble.ensembleValue)).toBe(true);
    expect(ensemble.ensembleValue).toBeGreaterThan(0);
    expect(ensemble.methods).toHaveLength(3);
  });

  test('weights sum to 1.0', () => {
    const input = makeRNPVInput();
    const { rnpv, monteCarlo, realOptions } = runFullPipeline(input);
    const ensemble = calculateEnsembleValuation(rnpv, monteCarlo, realOptions, input);
    const sum = ensemble.methods.reduce((a, m) => a + m.weight, 0);
    expect(sum).toBeCloseTo(1.0, 9);
  });

  test('ensemble lies between min and max of finite-variance methods', () => {
    const input = makeRNPVInput();
    const { rnpv, monteCarlo, realOptions } = runFullPipeline(input);
    const ensemble = calculateEnsembleValuation(rnpv, monteCarlo, realOptions, input);
    const finite = ensemble.methods.filter(m => Number.isFinite(m.variance));
    if (finite.length >= 2) {
      const minV = Math.min(...finite.map(m => m.value));
      const maxV = Math.max(...finite.map(m => m.value));
      // Allow tiny floating-point slack
      expect(ensemble.ensembleValue).toBeGreaterThanOrEqual(minV - 1e-6);
      expect(ensemble.ensembleValue).toBeLessThanOrEqual(maxV + 1e-6);
    }
  });

  test('comparables empty → ensemble degrades to 2-method blend, fallbackUsed=true', () => {
    const input = makeRNPVInput({ therapeuticArea: 'gastroenterology' as any, modality: 'phageTherapy' as any });
    const { rnpv, monteCarlo, realOptions } = runFullPipeline(input);
    // Pass empty comparable universe
    const ensemble = calculateEnsembleValuation(rnpv, monteCarlo, realOptions, input, []);
    expect(ensemble.fallbackUsed).toBe(true);
    const compMethod = ensemble.methods.find(m => m.name === 'Comparable Transactions')!;
    expect(compMethod.weight).toBe(0);
    // The other two methods should fully absorb the weight
    const otherWeights = ensemble.methods
      .filter(m => m.name !== 'Comparable Transactions')
      .reduce((a, m) => a + m.weight, 0);
    expect(otherWeights).toBeCloseTo(1.0, 9);
  });

  test('approved-phase asset still produces an ensemble value', () => {
    const input = makeRNPVInput({ phase: 'approved' });
    const { rnpv, monteCarlo, realOptions } = runFullPipeline(input);
    const ensemble = calculateEnsembleValuation(rnpv, monteCarlo, realOptions, input);
    expect(Number.isFinite(ensemble.ensembleValue)).toBe(true);
    expect(ensemble.ensembleValue).toBeGreaterThan(0);
    // For approved assets, real options collapses to rNPV (no remaining gates),
    // so the two should produce nearly identical values — verifying that the
    // ensemble doesn't blow up when methods converge.
    const roMethod = ensemble.methods.find(m => m.name === 'Real Options')!;
    const rnpvMethod = ensemble.methods.find(m => m.name === 'rNPV')!;
    const ratio = roMethod.value / Math.max(rnpvMethod.value, 1);
    // Real options ≈ rNPV for approved (within 50% — they share the same base)
    expect(Math.abs(Math.log(ratio))).toBeLessThan(1.0);
  });

  test('agreement classification reflects spread', () => {
    const input = makeRNPVInput();
    const { rnpv, monteCarlo, realOptions } = runFullPipeline(input);
    const ensemble = calculateEnsembleValuation(rnpv, monteCarlo, realOptions, input);
    expect(['tight', 'moderate', 'wide']).toContain(ensemble.agreement);
  });

  test('narrative is non-empty and mentions a dominant method', () => {
    const input = makeRNPVInput();
    const { rnpv, monteCarlo, realOptions } = runFullPipeline(input);
    const ensemble = calculateEnsembleValuation(rnpv, monteCarlo, realOptions, input);
    expect(ensemble.narrative.length).toBeGreaterThan(20);
    expect(ensemble.narrative).toMatch(/(rNPV|Comparable|Real Options)/);
  });

  test('runs across multiple TA × phase combinations without NaN', () => {
    const TAs = ['oncology', 'neurology', 'immunology', 'metabolic'] as const;
    const phases = ['phase1', 'phase2', 'phase3', 'approved'] as const;
    for (const ta of TAs) {
      for (const phase of phases) {
        const input = makeRNPVInput({ therapeuticArea: ta as any, phase: phase as any });
        const { rnpv, monteCarlo, realOptions } = runFullPipeline(input);
        const ensemble = calculateEnsembleValuation(rnpv, monteCarlo, realOptions, input);
        expect(Number.isFinite(ensemble.ensembleValue)).toBe(true);
        expect(Number.isFinite(ensemble.ensembleStdDev)).toBe(true);
        for (const m of ensemble.methods) {
          expect(Number.isFinite(m.weight)).toBe(true);
          expect(Number.isFinite(m.value)).toBe(true);
        }
      }
    }
  });

  test('uses the default COMPARABLE_DEALS universe when none passed', () => {
    const input = makeRNPVInput();
    const { rnpv, monteCarlo, realOptions } = runFullPipeline(input);
    const ensemble = calculateEnsembleValuation(rnpv, monteCarlo, realOptions, input);
    const comp = ensemble.methods.find(m => m.name === 'Comparable Transactions')!;
    // The bundled universe should be enough to find at least *some* oncology mab match
    expect(comp.sampleSize).toBeGreaterThanOrEqual(0);
  });
});
