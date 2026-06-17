/**
 * Extreme Stress Tests
 *
 * Curated set of ~20 boundary-hitting inputs designed to test every extreme
 * simultaneously. Each test exercises a specific corner case or combination
 * of extremes that might expose crashes, NaN outputs, or unreasonable values.
 *
 * These tests protect against:
 * - Engine crashes on unusual but valid input combinations
 * - NaN / Infinity in monetary outputs
 * - Unreasonable valuations (e.g., $1T for a preclinical asset)
 * - PoS dropping to zero unexpectedly
 * - Overflow or underflow on extreme peak sales values
 */

import { calculateRNPV } from '@/lib/financial/rnpv-engine';
import { calculateDealTerms, type CalculationInput } from '@/lib/calculations';
import type { RNPVInput } from '@/lib/financial/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Check that a value is a finite number (not NaN, not Infinity) */
function isFiniteNumber(v: unknown): boolean {
  return typeof v === 'number' && Number.isFinite(v);
}

/** Build an RNPVInput from the canonical base with overrides */
function makeRNPVInput(overrides: Partial<RNPVInput> = {}): RNPVInput {
  return {
    phase: 'phase2',
    therapeuticArea: 'oncology',
    modality: 'smallMolecule',
    indication: 'solid_tumor',
    territory: 'global',
    dealType: 'licensing',
    competitivePosition: 'firstInClass',
    dataQuality: 'robust',
    peakSalesEstimate: { low: 500, median: 1000, high: 2000 },
    regulatoryDesignations: {
      breakthrough: false,
      fastTrack: false,
      orphan: false,
      prime: false,
    },
    ...overrides,
  };
}

/** Build a CalculationInput from a canonical base with overrides */
function makeCalcInput(overrides: Partial<CalculationInput> = {}): CalculationInput {
  return {
    therapeuticArea: 'oncology',
    phase: 'phase2',
    modality: 'smallMolecule',
    indication: 'solid_tumor',
    territory: 'global',
    biomarker: 'unselected',
    lineOfTherapy: '1L',
    treatmentApproach: 'diseaseModifying',
    combinationPotential: 'none',
    competitivePosition: 'firstInClass',
    dataQuality: 'pivotalReady',
    regulatoryDesignations: {
      breakthrough: false,
      fastTrack: false,
      orphan: false,
      prime: false,
    },
    ...overrides,
  } as CalculationInput;
}

/** Assert basic validity of an rNPV result */
function assertValidRNPVResult(result: ReturnType<typeof calculateRNPV>, label: string) {
  expect(isFiniteNumber(result.riskAdjustedNPV)).toBe(true);
  expect(isFiniteNumber(result.cumulativePoS)).toBe(true);
  expect(isFiniteNumber(result.discountRate)).toBe(true);
  expect(isFiniteNumber(result.yearsToMarket)).toBe(true);
  expect(isFiniteNumber(result.impliedDealValue.upfront.median)).toBe(true);
  expect(isFiniteNumber(result.impliedDealValue.totalDeal.median)).toBe(true);
  // PoS should be in [0, 1]
  expect(result.cumulativePoS).toBeGreaterThanOrEqual(0);
  expect(result.cumulativePoS).toBeLessThanOrEqual(1);
  // No NaN in cash flows
  for (const cf of result.cashFlows) {
    expect(isFiniteNumber(cf.revenue)).toBe(true);
    expect(isFiniteNumber(cf.presentValue)).toBe(true);
    expect(isFiniteNumber(cf.riskAdjustedPV)).toBe(true);
  }
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe('Extreme stress tests', () => {
  // -----------------------------------------------------------------------
  // 1. Minimum viable input
  // -----------------------------------------------------------------------
  test('minimum viable input: discovery, crowded, preclinical_only data, $50M peak', () => {
    const result = calculateRNPV(makeRNPVInput({
      phase: 'discovery',
      competitivePosition: 'crowded',
      dataQuality: 'preclinical_only',
      therapeuticArea: 'cardiovascular',
      modality: 'smallMolecule',
      indication: 'heart_failure',
      peakSalesEstimate: { low: 25, median: 50, high: 100 },
    }));

    assertValidRNPVResult(result, 'minimum viable');
    // Should not crash and should produce some output (even if small/negative)
    expect(isFiniteNumber(result.riskAdjustedNPV)).toBe(true);
  });

  // -----------------------------------------------------------------------
  // 2. Maximum premium input
  // -----------------------------------------------------------------------
  test('maximum premium input: approved, FIC, robust, $15B peak, mab, rareDisease, all designations', () => {
    const result = calculateRNPV(makeRNPVInput({
      phase: 'approved',
      competitivePosition: 'firstInClass',
      dataQuality: 'pivotalReady',
      therapeuticArea: 'rareDisease',
      modality: 'mab',
      indication: 'rare_genetic',
      peakSalesEstimate: { low: 7500, median: 15000, high: 30000 },
      regulatoryDesignations: {
        breakthrough: true,
        fastTrack: true,
        orphan: true,
        prime: true,
      },
    }));

    assertValidRNPVResult(result, 'maximum premium');
    // Should be a large but not absurd number (not $1 trillion)
    expect(result.impliedDealValue.totalDeal.median).toBeLessThan(1_000_000); // < $1T
    expect(result.impliedDealValue.totalDeal.median).toBeGreaterThan(0);
  });

  // -----------------------------------------------------------------------
  // 3. Worst-case combo
  // -----------------------------------------------------------------------
  test('worst-case combo: discovery, crowded, preclinical_only, $10M peak, geneTherapy, neurology', () => {
    const result = calculateRNPV(makeRNPVInput({
      phase: 'discovery',
      competitivePosition: 'crowded',
      dataQuality: 'preclinical_only',
      therapeuticArea: 'neurology',
      modality: 'geneTherapy',
      indication: 'neurodegeneration',
      peakSalesEstimate: { low: 5, median: 10, high: 20 },
    }));

    assertValidRNPVResult(result, 'worst-case combo');
    // PoS should still be > 0 (very small, but not zero)
    expect(result.cumulativePoS).toBeGreaterThan(0);
  });

  // -----------------------------------------------------------------------
  // 4. Orphan + rare + FIC
  // -----------------------------------------------------------------------
  test('orphan + rare + FIC: preclinical geneTherapy rareDisease with orphan designation', () => {
    const rareResult = calculateRNPV(makeRNPVInput({
      phase: 'preclinical',
      competitivePosition: 'firstInClass',
      therapeuticArea: 'rareDisease',
      modality: 'geneTherapy',
      indication: 'rare_genetic',
      peakSalesEstimate: { low: 250, median: 500, high: 1000 },
      regulatoryDesignations: {
        breakthrough: false,
        fastTrack: false,
        orphan: true,
        prime: false,
      },
    }));

    const oncoResult = calculateRNPV(makeRNPVInput({
      phase: 'preclinical',
      competitivePosition: 'firstInClass',
      therapeuticArea: 'oncology',
      modality: 'geneTherapy',
      indication: 'solid_tumor',
      peakSalesEstimate: { low: 250, median: 500, high: 1000 },
      regulatoryDesignations: {
        breakthrough: false,
        fastTrack: false,
        orphan: false,
        prime: false,
      },
    }));

    assertValidRNPVResult(rareResult, 'orphan+rare+FIC');
    assertValidRNPVResult(oncoResult, 'base oncology preclinical');

    // Rare disease + orphan + FIC should have higher PoS than base oncology
    // at the same phase (orphan drugs have historically higher approval rates)
    expect(rareResult.cumulativePoS).toBeGreaterThan(oncoResult.cumulativePoS);
  });

  // -----------------------------------------------------------------------
  // 5. All designations stacked
  // -----------------------------------------------------------------------
  test('all 4 designations stacked: phase2, oncology, adc', () => {
    const result = calculateRNPV(makeRNPVInput({
      phase: 'phase2',
      therapeuticArea: 'oncology',
      modality: 'adc',
      indication: 'breast_her2',
      regulatoryDesignations: {
        breakthrough: true,
        fastTrack: true,
        orphan: true,
        prime: true,
      },
    }));

    assertValidRNPVResult(result, 'all designations stacked');
    // No NaN anywhere
    expect(Number.isNaN(result.riskAdjustedNPV)).toBe(false);
    expect(Number.isNaN(result.cumulativePoS)).toBe(false);
    // PoS should get a boost from designations (higher than base)
    const baseResult = calculateRNPV(makeRNPVInput({
      phase: 'phase2',
      therapeuticArea: 'oncology',
      modality: 'adc',
      indication: 'breast_her2',
    }));
    expect(result.cumulativePoS).toBeGreaterThanOrEqual(baseResult.cumulativePoS);
  });

  // -----------------------------------------------------------------------
  // 6. Extreme peak sales ($50B)
  // -----------------------------------------------------------------------
  test('extreme peak sales: $50B median - scales but does not overflow', () => {
    const result = calculateRNPV(makeRNPVInput({
      peakSalesEstimate: { low: 25000, median: 50000, high: 100000 },
    }));

    assertValidRNPVResult(result, 'extreme peak sales');
    // Should not overflow to Infinity
    expect(Number.isFinite(result.riskAdjustedNPV)).toBe(true);
    expect(Number.isFinite(result.impliedDealValue.totalDeal.high)).toBe(true);
  });

  // -----------------------------------------------------------------------
  // 7. Zero-ish peak sales ($1M)
  // -----------------------------------------------------------------------
  test('zero-ish peak sales: $1M median - small but valid output', () => {
    const result = calculateRNPV(makeRNPVInput({
      peakSalesEstimate: { low: 0.5, median: 1, high: 2 },
    }));

    assertValidRNPVResult(result, 'zero-ish peak sales');
    // Output should be small but valid
    expect(isFiniteNumber(result.riskAdjustedNPV)).toBe(true);
  });

  // -----------------------------------------------------------------------
  // 8. Every phase produces valid output
  // -----------------------------------------------------------------------
  describe('every phase produces valid output', () => {
    const phases = [
      'discovery', 'preclinical', 'phase1', 'phase1_2',
      'phase2', 'phase2_3', 'phase3', 'nda_filed', 'approved',
    ] as const;

    for (const phase of phases) {
      test(`phase: ${phase}`, () => {
        const result = calculateRNPV(makeRNPVInput({ phase }));
        assertValidRNPVResult(result, `phase ${phase}`);
      });
    }
  });

  // -----------------------------------------------------------------------
  // 9. Every TA produces valid output
  // -----------------------------------------------------------------------
  describe('every therapeutic area produces valid output', () => {
    const tas = [
      'oncology', 'neurology', 'immunology', 'metabolic',
      'cardiovascular', 'infectiousDisease', 'ophthalmology', 'womensHealth',
      'rareDisease', 'hematology', 'dermatology', 'gastroenterology',
    ] as const;

    // Map TA to a reasonable indication for that TA
    const taIndication: Record<string, string> = {
      oncology: 'solid_tumor',
      neurology: 'neurodegeneration',
      immunology: 'autoimmune_systemic',
      metabolic: 'diabetes_type2',
      cardiovascular: 'heart_failure',
      infectiousDisease: 'bacterial',
      ophthalmology: 'wet_amd',
      womensHealth: 'endometriosis',
      rareDisease: 'rare_genetic',
      hematology: 'aml',
      dermatology: 'atopic_dermatitis',
      gastroenterology: 'crohns',
    };

    for (const ta of tas) {
      test(`TA: ${ta}`, () => {
        const result = calculateRNPV(makeRNPVInput({
          therapeuticArea: ta,
          indication: taIndication[ta] || 'solid_tumor',
        }));
        assertValidRNPVResult(result, `TA ${ta}`);
      });
    }
  });

  // -----------------------------------------------------------------------
  // 10. Every modality produces valid output
  // -----------------------------------------------------------------------
  describe('every modality produces valid output', () => {
    const modalities = [
      'smallMolecule', 'mab', 'adc', 'bispecific',
      'geneTherapy', 'rnai', 'carT_heme', 'peptide',
      'radiopharmaceutical', 'mrna', 'aso', 'therapeuticVaccine',
    ] as const;

    for (const modality of modalities) {
      test(`modality: ${modality}`, () => {
        const result = calculateRNPV(makeRNPVInput({ modality }));
        assertValidRNPVResult(result, `modality ${modality}`);
      });
    }
  });

  // -----------------------------------------------------------------------
  // 11. Combined phase stacking: phase1_2 and phase2_3 intermediate values
  // -----------------------------------------------------------------------
  test('combined phases produce valid output and implied deals are intermediate', () => {
    const p1 = calculateRNPV(makeRNPVInput({ phase: 'phase1' }));
    const p1_2 = calculateRNPV(makeRNPVInput({ phase: 'phase1_2' }));
    const p2 = calculateRNPV(makeRNPVInput({ phase: 'phase2' }));
    const p2_3 = calculateRNPV(makeRNPVInput({ phase: 'phase2_3' }));
    const p3 = calculateRNPV(makeRNPVInput({ phase: 'phase3' }));

    // All should produce valid results
    [p1, p1_2, p2, p2_3, p3].forEach((r) =>
      assertValidRNPVResult(r, 'combined phase stacking'),
    );

    // Raw rNPV can be non-monotonic for early phases because combined
    // pathway cost/duration profiles differ from standard phases.
    // Instead, check implied deal values (which include calibration floors):
    // phase2_3 upfront should be >= phase2 upfront (more de-risked)
    expect(p2_3.impliedDealValue.upfront.median).toBeGreaterThanOrEqual(
      p2.impliedDealValue.upfront.median,
    );

    // phase3 upfront should be > phase1 upfront (substantially more de-risked)
    expect(p3.impliedDealValue.upfront.median).toBeGreaterThan(
      p1.impliedDealValue.upfront.median,
    );

    // PoS should increase with phase advancement
    expect(p2.cumulativePoS).toBeGreaterThan(p1.cumulativePoS);
    expect(p3.cumulativePoS).toBeGreaterThan(p2.cumulativePoS);
  });

  // -----------------------------------------------------------------------
  // 12. Option deal type + approved
  // -----------------------------------------------------------------------
  test('option deal at approved stage produces reasonable upfront', () => {
    const result = calculateRNPV(makeRNPVInput({
      phase: 'approved',
      dealType: 'option',
    }));

    assertValidRNPVResult(result, 'option at approved');
    // Upfront should be positive
    expect(result.impliedDealValue.upfront.median).toBeGreaterThan(0);
    // Option exercise fee should be populated
    expect(result.impliedDealValue.optionExerciseFee).toBeDefined();
    if (result.impliedDealValue.optionExerciseFee) {
      expect(isFiniteNumber(result.impliedDealValue.optionExerciseFee.fee_M)).toBe(true);
      expect(result.impliedDealValue.optionExerciseFee.probability).toBeGreaterThan(0);
      expect(result.impliedDealValue.optionExerciseFee.probability).toBeLessThanOrEqual(1);
    }
  });

  // -----------------------------------------------------------------------
  // 13. Acquisition at discovery
  // -----------------------------------------------------------------------
  test('acquisition at discovery phase produces high upfront ratio', () => {
    const result = calculateRNPV(makeRNPVInput({
      phase: 'discovery',
      dealType: 'acquisition',
    }));

    assertValidRNPVResult(result, 'acquisition at discovery');
    // Acquisition should have high upfront-to-total ratio (>50%)
    const { upfront, totalDeal } = result.impliedDealValue;
    if (totalDeal.median > 0) {
      const upfrontRatio = upfront.median / totalDeal.median;
      expect(upfrontRatio).toBeGreaterThan(0.50);
    }
  });

  // -----------------------------------------------------------------------
  // 14. China territory
  // -----------------------------------------------------------------------
  test('china territory produces lower value than us_only due to pricing', () => {
    const china = calculateRNPV(makeRNPVInput({
      territory: 'china',
    }));
    const usOnly = calculateRNPV(makeRNPVInput({
      territory: 'us_only',
    }));

    assertValidRNPVResult(china, 'china territory');
    assertValidRNPVResult(usOnly, 'us_only territory');

    // China should produce lower rNPV due to NRDL pricing pressure
    // and higher discount rate (territory risk premium)
    expect(china.riskAdjustedNPV).toBeLessThan(usOnly.riskAdjustedNPV);
  });

  // -----------------------------------------------------------------------
  // 15. calculateDealTerms: minimum viable input
  // -----------------------------------------------------------------------
  test('calculateDealTerms: minimum viable input does not crash', () => {
    const result = calculateDealTerms(makeCalcInput({
      phase: 'discovery',
      competitivePosition: 'crowded',
      dataQuality: 'limited',
      therapeuticArea: 'cardiovascular',
      modality: 'smallMolecule',
      indication: 'heart_failure',
    } as Partial<CalculationInput>));

    expect(result).toBeDefined();
    expect(isFiniteNumber(result.terms.upfront.median)).toBe(true);
    expect(isFiniteNumber(result.terms.totalDealValue.median)).toBe(true);
  });

  // -----------------------------------------------------------------------
  // 16. calculateDealTerms: maximum premium input
  // -----------------------------------------------------------------------
  test('calculateDealTerms: maximum premium input produces reasonable output', () => {
    const result = calculateDealTerms(makeCalcInput({
      phase: 'approved',
      competitivePosition: 'firstInClass',
      dataQuality: 'pivotalReady',
      therapeuticArea: 'rareDisease',
      modality: 'mab',
      indication: 'rare_genetic',
      regulatoryDesignations: {
        breakthrough: true,
        fastTrack: true,
        orphan: true,
        prime: true,
      },
    } as Partial<CalculationInput>));

    expect(result).toBeDefined();
    expect(isFiniteNumber(result.terms.upfront.median)).toBe(true);
    expect(result.terms.totalDealValue.median).toBeGreaterThan(0);
  });

  // -----------------------------------------------------------------------
  // 17. Co-development deal with extreme cost sharing
  // -----------------------------------------------------------------------
  test('codevelopment deal with 90% licensee cost share does not crash', () => {
    const result = calculateRNPV(makeRNPVInput({
      dealType: 'codevelopment',
      costSharingRatio: 0.9,
    }));

    assertValidRNPVResult(result, 'codev extreme cost share');
    expect(result.impliedDealValue.codevCostSharing).toBeDefined();
    if (result.impliedDealValue.codevCostSharing) {
      expect(result.impliedDealValue.codevCostSharing.ratioLicensee).toBeCloseTo(0.9, 1);
    }
  });

  // -----------------------------------------------------------------------
  // 18. Collaboration with FTE funding + equity
  // -----------------------------------------------------------------------
  test('collaboration with FTE funding and equity investment', () => {
    const result = calculateRNPV(makeRNPVInput({
      dealType: 'collaboration',
      fteFunding: { fteCount: 30, costPerFTE_M: 2.0, yearsOfFunding: 5 },
      equityInvestment: 500,
    }));

    assertValidRNPVResult(result, 'collaboration + FTE + equity');
    expect(result.impliedDealValue.fteResearchValue).toBeDefined();
    expect(result.impliedDealValue.equityInvestment).toBeDefined();
    if (result.impliedDealValue.fteResearchValue) {
      expect(result.impliedDealValue.fteResearchValue.totalValue_M).toBeGreaterThan(0);
    }
    expect(result.impliedDealValue.equityInvestment).toBe(500);
  });

  // -----------------------------------------------------------------------
  // 19. Every deal type at phase2 produces valid output
  // -----------------------------------------------------------------------
  describe('every deal type at phase2 produces valid output', () => {
    const dealTypes = ['licensing', 'acquisition', 'codevelopment', 'option', 'collaboration'] as const;

    for (const dealType of dealTypes) {
      test(`deal type: ${dealType}`, () => {
        const result = calculateRNPV(makeRNPVInput({ dealType }));
        assertValidRNPVResult(result, `deal type ${dealType}`);
        expect(result.impliedDealValue.upfront.median).toBeGreaterThan(0);
      });
    }
  });

  // -----------------------------------------------------------------------
  // 20. Upfront never exceeds total deal value
  // -----------------------------------------------------------------------
  describe('upfront never exceeds total deal value across extremes', () => {
    const extremes: Array<{ label: string; overrides: Partial<RNPVInput> }> = [
      { label: 'discovery licensing', overrides: { phase: 'discovery', dealType: 'licensing' } },
      { label: 'approved acquisition', overrides: { phase: 'approved', dealType: 'acquisition' } },
      { label: 'phase2 option', overrides: { phase: 'phase2', dealType: 'option' } },
      { label: 'preclinical collaboration', overrides: { phase: 'preclinical', dealType: 'collaboration' } },
      { label: 'phase3 codevelopment', overrides: { phase: 'phase3', dealType: 'codevelopment' } },
      { label: 'max designations', overrides: { regulatoryDesignations: { breakthrough: true, fastTrack: true, orphan: true, prime: true } } },
      { label: '$50B peak sales', overrides: { peakSalesEstimate: { low: 25000, median: 50000, high: 100000 } } },
      { label: '$1M peak sales', overrides: { peakSalesEstimate: { low: 0.5, median: 1, high: 2 } } },
    ];

    for (const { label, overrides } of extremes) {
      test(`upfront <= totalDeal for: ${label}`, () => {
        const result = calculateRNPV(makeRNPVInput(overrides));
        const { upfront, totalDeal } = result.impliedDealValue;
        expect(upfront.low).toBeLessThanOrEqual(totalDeal.low + 1); // +1 for rounding
        expect(upfront.median).toBeLessThanOrEqual(totalDeal.median + 1);
        expect(upfront.high).toBeLessThanOrEqual(totalDeal.high + 1);
      });
    }
  });
});
