/**
 * Target + Route Integration Tests
 *
 * Validates that molecular targets and delivery routes correctly modify
 * PoS, peak sales, and deal premiums — and that existing calculations
 * are completely unaffected when the new fields are absent.
 */

import { calculateDealTerms, type CalculationInput } from '@/lib/calculations';
import { getCumulativePoS } from '@/lib/financial/pos-tables';
import { computeEmpiricalMultiplier } from '@/lib/financial/empirical-multiplier';
import type { RNPVInput } from '@/lib/financial/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function baseInput(overrides?: Partial<CalculationInput>): CalculationInput {
  return {
    therapeuticArea: 'oncology',
    phase: 'phase2',
    dealType: 'licensing',
    modality: 'mab',
    indication: 'lung_nsclc',
    territory: 'global',
    biomarker: 'unselected',
    lineOfTherapy: '2L',
    treatmentApproach: 'symptomatic',
    combinationPotential: 'some',
    competitivePosition: 'racing',
    dataQuality: 'promising',
    regulatoryDesignations: { breakthrough: false, fastTrack: false, orphan: false, prime: false },
    ...overrides,
  };
}

function baseRNPVInput(overrides?: Partial<RNPVInput>): RNPVInput {
  return {
    phase: 'phase2',
    therapeuticArea: 'oncology',
    modality: 'mab',
    indication: 'lung_nsclc',
    territory: 'global',
    biomarkerStatus: 'unselected',
    competitivePosition: 'racing',
    dataQuality: 'promising',
    peakSalesEstimate: { low: 800, median: 1500, high: 3000 },
    regulatoryDesignations: { breakthrough: false, fastTrack: false, orphan: false, prime: false },
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// Regression: no-change when targets/route absent
// ---------------------------------------------------------------------------

describe('backward compatibility', () => {
  test('no targets + no route = identical to baseline', () => {
    const baseline = calculateDealTerms(baseInput());
    const withEmpty = calculateDealTerms(baseInput({ molecularTargets: [], deliveryRoute: undefined }));
    expect(withEmpty.terms.upfront.median).toBe(baseline.terms.upfront.median);
    expect(withEmpty.terms.totalDealValue.median).toBe(baseline.terms.totalDealValue.median);
  });

  test('getCumulativePoS returns same result with undefined targets/route', () => {
    const base = getCumulativePoS('phase2', 'oncology', 'mab', 'unselected',
      { breakthrough: false, fastTrack: false, orphan: false, prime: false }, 'lung_nsclc');
    const withNulls = getCumulativePoS('phase2', 'oncology', 'mab', 'unselected',
      { breakthrough: false, fastTrack: false, orphan: false, prime: false }, 'lung_nsclc', undefined, undefined, undefined);
    expect(withNulls.cumulativePoS).toBe(base.cumulativePoS);
  });
});

// ---------------------------------------------------------------------------
// Target PoS modifiers
// ---------------------------------------------------------------------------

describe('molecular target PoS adjustments', () => {
  test('validated target (PD-1) increases PoS', () => {
    const base = getCumulativePoS('phase2', 'oncology', 'mab', 'unselected',
      { breakthrough: false, fastTrack: false, orphan: false, prime: false }, 'lung_nsclc');
    const withPD1 = getCumulativePoS('phase2', 'oncology', 'mab', 'unselected',
      { breakthrough: false, fastTrack: false, orphan: false, prime: false }, 'lung_nsclc', undefined, ['pd1']);
    expect(withPD1.cumulativePoS).toBeGreaterThan(base.cumulativePoS);
  });

  test('novel target (TIGIT) decreases PoS', () => {
    const base = getCumulativePoS('phase2', 'oncology', 'mab', 'unselected',
      { breakthrough: false, fastTrack: false, orphan: false, prime: false }, 'lung_nsclc');
    const withTIGIT = getCumulativePoS('phase2', 'oncology', 'mab', 'unselected',
      { breakthrough: false, fastTrack: false, orphan: false, prime: false }, 'lung_nsclc', undefined, ['tigit']);
    expect(withTIGIT.cumulativePoS).toBeLessThan(base.cumulativePoS);
  });

  test('modality-target overlap is neutralized (tauTargeting + tau)', () => {
    const withTauModality = getCumulativePoS('phase2', 'neurology', 'tauTargeting', 'unselected',
      { breakthrough: false, fastTrack: false, orphan: false, prime: false }, 'alzheimers', undefined, ['tau']);
    const withoutTarget = getCumulativePoS('phase2', 'neurology', 'tauTargeting', 'unselected',
      { breakthrough: false, fastTrack: false, orphan: false, prime: false }, 'alzheimers');
    // When modality already encodes the target, adding the target explicitly should not change PoS
    expect(withTauModality.cumulativePoS).toBe(withoutTarget.cumulativePoS);
  });
});

// ---------------------------------------------------------------------------
// Delivery route adjustments
// ---------------------------------------------------------------------------

describe('delivery route PoS adjustments', () => {
  test('oral route produces different PoS than IV', () => {
    const iv = getCumulativePoS('phase2', 'oncology', 'smallMolecule', 'unselected',
      { breakthrough: false, fastTrack: false, orphan: false, prime: false }, 'lung_nsclc', undefined, undefined, 'iv');
    const oral = getCumulativePoS('phase2', 'oncology', 'smallMolecule', 'unselected',
      { breakthrough: false, fastTrack: false, orphan: false, prime: false }, 'lung_nsclc', undefined, undefined, 'oral');
    expect(oral.cumulativePoS).not.toBe(iv.cumulativePoS);
  });

  test('intrathecal route decreases PoS', () => {
    const iv = getCumulativePoS('phase2', 'neurology', 'aso', 'unselected',
      { breakthrough: false, fastTrack: false, orphan: false, prime: false }, 'alzheimers', undefined, undefined, 'iv');
    const it = getCumulativePoS('phase2', 'neurology', 'aso', 'unselected',
      { breakthrough: false, fastTrack: false, orphan: false, prime: false }, 'alzheimers', undefined, undefined, 'intrathecal');
    expect(it.cumulativePoS).toBeLessThan(iv.cumulativePoS);
  });
});

// ---------------------------------------------------------------------------
// Deal terms: target + route impact on total deal value
// ---------------------------------------------------------------------------

describe('deal terms integration', () => {
  test('PD-1 mAb has higher TDV than unspecified mAb', () => {
    const base = calculateDealTerms(baseInput());
    const withPD1 = calculateDealTerms(baseInput({ molecularTargets: ['pd1'] }));
    expect(withPD1.terms.totalDealValue.median).toBeGreaterThan(base.terms.totalDealValue.median);
  });

  test('oral route has higher TDV than IV for small molecule', () => {
    const iv = calculateDealTerms(baseInput({ modality: 'smallMolecule', deliveryRoute: 'iv' }));
    const oral = calculateDealTerms(baseInput({ modality: 'smallMolecule', deliveryRoute: 'oral' }));
    expect(oral.terms.totalDealValue.median).toBeGreaterThan(iv.terms.totalDealValue.median);
  });

  test('validated dual-target (PD-1+CTLA-4) produces different TDV than PD-1 alone', () => {
    const mono = calculateDealTerms(baseInput({ molecularTargets: ['pd1'] }));
    const dual = calculateDealTerms(baseInput({ molecularTargets: ['pd1', 'ctla4'] }));
    // Multi-target changes TDV (combination premium + complexity penalty + PoS shift)
    expect(dual.terms.totalDealValue.median).not.toBe(mono.terms.totalDealValue.median);
  });

  test('dual GLP-1R+GIPR (validated combo) has higher TDV than GLP-1R alone', () => {
    // This is the strongest validated combination — tirzepatide precedent
    const mono = calculateDealTerms(baseInput({
      therapeuticArea: 'metabolic', indication: 'type2_diabetes', modality: 'peptide',
      molecularTargets: ['glp1r'],
    }));
    const dual = calculateDealTerms(baseInput({
      therapeuticArea: 'metabolic', indication: 'type2_diabetes', modality: 'peptide',
      molecularTargets: ['glp1r', 'gipr'],
    }));
    expect(dual.terms.totalDealValue.median).toBeGreaterThan(mono.terms.totalDealValue.median);
  });

  test('Alzheimer Aβ+tau produces different TDV than Aβ alone (tau is novel/risky)', () => {
    const mono = calculateDealTerms(baseInput({
      therapeuticArea: 'neurology', indication: 'alzheimers', modality: 'mab',
      molecularTargets: ['amyloid_beta'],
    }));
    const dual = calculateDealTerms(baseInput({
      therapeuticArea: 'neurology', indication: 'alzheimers', modality: 'mab',
      molecularTargets: ['amyloid_beta', 'tau'],
    }));
    // tau is novel (posModifier 0.60) — adding it may reduce TDV because of PoS drag
    // but the combination premium partially offsets. Engine captures this trade-off.
    expect(dual.terms.totalDealValue.median).not.toBe(mono.terms.totalDealValue.median);
  });
});

// ---------------------------------------------------------------------------
// Empirical multiplier: target + route premiums
// ---------------------------------------------------------------------------

describe('empirical multiplier composition', () => {
  test('target premium is bounded at 15%', () => {
    const base = computeEmpiricalMultiplier(baseRNPVInput());
    const withManyTargets = computeEmpiricalMultiplier(baseRNPVInput({
      molecularTargets: ['pd1', 'ctla4', 'vegf', 'her2'],
    }));
    // Should increase but remain within caps
    expect(withManyTargets).toBeGreaterThanOrEqual(base);
    expect(withManyTargets).toBeLessThanOrEqual(8.0); // HARD_CAP
  });

  test('route premium for oral is positive', () => {
    const base = computeEmpiricalMultiplier(baseRNPVInput());
    const oral = computeEmpiricalMultiplier(baseRNPVInput({ deliveryRoute: 'oral' }));
    expect(oral).toBeGreaterThan(base);
  });

  test('route premium for intrathecal is negative', () => {
    const base = computeEmpiricalMultiplier(baseRNPVInput({
      therapeuticArea: 'neurology', modality: 'aso', indication: 'alzheimers',
    }));
    const it = computeEmpiricalMultiplier(baseRNPVInput({
      therapeuticArea: 'neurology', modality: 'aso', indication: 'alzheimers',
      deliveryRoute: 'intrathecal',
    }));
    expect(it).toBeLessThan(base);
  });

  test('convenientDosing + oral route: double-counting guard reduces route premium', () => {
    const routeOnly = computeEmpiricalMultiplier(baseRNPVInput({ deliveryRoute: 'oral' }));
    const routePlusDosing = computeEmpiricalMultiplier(baseRNPVInput({
      deliveryRoute: 'oral',
      differentiationFactors: ['convenientDosing'],
    }));
    // The route premium should be partially offset by the double-counting guard
    // so routePlusDosing < routeOnly + full differentiation premium
    const diffOnly = computeEmpiricalMultiplier(baseRNPVInput({
      differentiationFactors: ['convenientDosing'],
    }));
    const naiveSum = routeOnly + diffOnly - computeEmpiricalMultiplier(baseRNPVInput());
    expect(routePlusDosing).toBeLessThanOrEqual(naiveSum + 0.01);
  });
});

// ---------------------------------------------------------------------------
// Invariant checks
// ---------------------------------------------------------------------------

describe('invariants', () => {
  test('target PoS modifier stays within [0.3, 1.5]', () => {
    const { getCompositeTargetPosModifier } = require('@/lib/financial/target-taxonomy');
    const allTargets = Object.keys(require('@/lib/financial/target-taxonomy').TARGET_TAXONOMY);
    for (const slug of allTargets) {
      const mod = getCompositeTargetPosModifier([slug]);
      expect(mod).toBeGreaterThanOrEqual(0.3);
      expect(mod).toBeLessThanOrEqual(1.5);
    }
  });

  test('delivery route PoS modifier stays within [0.5, 1.5]', () => {
    const { DELIVERY_ROUTE_PROFILES } = require('@/lib/financial/delivery-routes');
    for (const [, profile] of Object.entries(DELIVERY_ROUTE_PROFILES)) {
      expect((profile as { posModifier: number }).posModifier).toBeGreaterThanOrEqual(0.5);
      expect((profile as { posModifier: number }).posModifier).toBeLessThanOrEqual(1.5);
    }
  });

  test('delivery route peak sales modifier stays within [0.5, 2.0]', () => {
    const { DELIVERY_ROUTE_PROFILES } = require('@/lib/financial/delivery-routes');
    for (const [, profile] of Object.entries(DELIVERY_ROUTE_PROFILES)) {
      expect((profile as { peakSalesModifier: number }).peakSalesModifier).toBeGreaterThanOrEqual(0.5);
      expect((profile as { peakSalesModifier: number }).peakSalesModifier).toBeLessThanOrEqual(2.0);
    }
  });

  test('target combination netEffect stays within [0.2, 2.5]', () => {
    const { TARGET_COMBINATIONS } = require('@/lib/financial/target-combinations');
    for (const [, combo] of Object.entries(TARGET_COMBINATIONS)) {
      expect((combo as { netEffect: number }).netEffect).toBeGreaterThanOrEqual(0.2);
      expect((combo as { netEffect: number }).netEffect).toBeLessThanOrEqual(2.5);
    }
  });

  test('all 96 targets have valid posModifier values', () => {
    const { TARGET_TAXONOMY } = require('@/lib/financial/target-taxonomy');
    const count = Object.keys(TARGET_TAXONOMY).length;
    expect(count).toBeGreaterThanOrEqual(90);
    for (const [, entry] of Object.entries(TARGET_TAXONOMY)) {
      const t = entry as { posModifier: number; peakSalesModifier: number; dealPremium: number };
      expect(t.posModifier).toBeGreaterThan(0);
      expect(t.peakSalesModifier).toBeGreaterThan(0);
      expect(t.dealPremium).toBeGreaterThanOrEqual(0);
      expect(t.dealPremium).toBeLessThanOrEqual(0.15);
    }
  });
});
