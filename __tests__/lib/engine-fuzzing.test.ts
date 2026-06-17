/**
 * Engine Fuzzing — crash-path discovery via random valid inputs.
 *
 * Uses fast-check to generate random but valid CalculationInput objects and
 * feed them through the full engine pipeline. Asserts no crashes, no NaN/Infinity
 * in monetary outputs, and no critical invariant violations.
 *
 * This catches the class of bugs where the engine works for canonical inputs
 * but throws or produces NaN for unusual (but valid) combinations — e.g.,
 * preclinical gene therapy in women's health with crowded competitive position.
 */

import fc from 'fast-check';
import { calculateDealTerms, type CalculationInput } from '@/lib/calculations';
import { calculateRNPV } from '@/lib/financial/rnpv-engine';
import { checkRNPVInvariants } from '@/lib/financial/invariants';
import type { RNPVInput } from '@/lib/financial/types';

const TAS = [
  'oncology', 'neurology', 'immunology', 'metabolic',
  'cardiovascular', 'infectiousDisease', 'ophthalmology', 'womensHealth',
  'rareDisease', 'hematology', 'dermatology', 'gastroenterology',
] as const;

const MODALITIES = [
  'smallMolecule', 'mab', 'adc', 'peptide', 'geneTherapy',
  'cellTherapy', 'mrna', 'bispecific', 'rnai', 'aso',
  'radiopharmaceutical', 'therapeuticVaccine',
] as const;

const PHASES = [
  'discovery', 'preclinical', 'phase1', 'phase1_2',
  'phase2', 'phase2_3', 'phase3', 'nda_filed', 'approved',
] as const;

const COMPETITIVE_POSITIONS = [
  'firstInClass', 'firstToPivotal', 'bestInClass', 'racing', 'behind', 'crowded',
] as const;

const DATA_QUALITIES = ['robust', 'strongPhase2', 'moderate', 'preliminary', 'preclinical_only'] as const;

const TERRITORIES = [
  'global', 'us_only', 'europe', 'china', 'japan',
  'ex_us', 'row', 'us_eu', 'us_japan',
] as const;

const DEAL_TYPES = ['licensing', 'acquisition', 'codevelopment', 'option', 'collaboration'] as const;

const BIOMARKERS = ['unselected', 'validated', 'exploratory', 'none'] as const;

const LINE_OF_THERAPY = ['1L', '2L', '3L+', 'adjuvant', 'neoadjuvant', 'maintenance'] as const;

const TREATMENT_APPROACHES = ['diseaseModifying', 'symptomatic', 'curative', 'preventive'] as const;

const COMBINATION_POTENTIALS = ['none', 'some', 'high', 'backbone'] as const;

const arbCalculationInput: fc.Arbitrary<CalculationInput> = fc
  .record({
    therapeuticArea: fc.constantFrom(...TAS),
    phase: fc.constantFrom(...PHASES),
    modality: fc.constantFrom(...MODALITIES),
    indication: fc.constantFrom('solid_tumor', 'neurodegeneration', 'autoimmune_systemic', 'diabetes_type2', 'heart_failure', 'rare_genetic', 'atopic_dermatitis', 'crohns', 'wet_amd', 'endometriosis', 'aml', 'bacterial'),
    territory: fc.constantFrom(...TERRITORIES),
    dealType: fc.constantFrom(...DEAL_TYPES),
    biomarker: fc.constantFrom(...BIOMARKERS),
    lineOfTherapy: fc.constantFrom(...LINE_OF_THERAPY),
    treatmentApproach: fc.constantFrom(...TREATMENT_APPROACHES),
    combinationPotential: fc.constantFrom(...COMBINATION_POTENTIALS),
    competitivePosition: fc.constantFrom(...COMPETITIVE_POSITIONS),
    dataQuality: fc.constantFrom(...DATA_QUALITIES),
    regulatoryDesignations: fc.record({
      breakthrough: fc.boolean(),
      fastTrack: fc.boolean(),
      orphan: fc.boolean(),
      prime: fc.boolean(),
    }),
  })
  .map((r) => r as unknown as CalculationInput);

const arbRNPVInput: fc.Arbitrary<RNPVInput> = fc
  .record({
    phase: fc.constantFrom(...PHASES),
    therapeuticArea: fc.constantFrom(...TAS),
    modality: fc.constantFrom(...MODALITIES),
    indication: fc.constantFrom('solid_tumor', 'neurodegeneration', 'autoimmune_systemic', 'rare_genetic'),
    territory: fc.constantFrom(...TERRITORIES),
    peakSalesEstimate: fc.double({ min: 100, max: 15000, noNaN: true, noDefaultInfinity: true }).map(median => ({
      low: Math.max(1, median * 0.5),
      median,
      high: median * 1.5,
    })),
    competitivePosition: fc.constantFrom(...COMPETITIVE_POSITIONS),
    dataQuality: fc.constantFrom(...DATA_QUALITIES),
    biomarkerStatus: fc.constantFrom('unselected', 'validated', 'exploratory', 'none'),
    regulatoryDesignations: fc.record({
      breakthrough: fc.boolean(),
      fastTrack: fc.boolean(),
      orphan: fc.boolean(),
      prime: fc.boolean(),
    }),
  })
  .map((r) => r as RNPVInput);

function isFiniteNumber(v: unknown): boolean {
  return typeof v === 'number' && Number.isFinite(v);
}

describe('Engine fuzzing: calculateDealTerms', () => {
  test('never throws for 500 random valid inputs', () => {
    let crashes = 0;
    fc.assert(
      fc.property(arbCalculationInput, (input) => {
        try {
          calculateDealTerms(input);
          return true;
        } catch {
          crashes++;
          return false;
        }
      }),
      { numRuns: 500 },
    );
    expect(crashes).toBe(0);
  });

  test('no NaN in monetary outputs for 200 random inputs', () => {
    fc.assert(
      fc.property(arbCalculationInput, (input) => {
        const result = calculateDealTerms(input);
        if (!result) return true;
        const values = [
          result.upfront?.low, result.upfront?.median, result.upfront?.high,
          result.totalDealValue?.low, result.totalDealValue?.median, result.totalDealValue?.high,
        ];
        return values.every(v => v === undefined || v === null || isFiniteNumber(v));
      }),
      { numRuns: 200 },
    );
  });

  test('upfront never exceeds total deal value', () => {
    fc.assert(
      fc.property(arbCalculationInput, (input) => {
        const result = calculateDealTerms(input);
        if (!result?.upfront || !result?.totalDealValue) return true;
        return result.upfront.median <= result.totalDealValue.median * 1.01;
      }),
      { numRuns: 200 },
    );
  });
});

describe('Engine fuzzing: calculateRNPV', () => {
  test('never crashes for 300 random valid inputs', () => {
    const crashes: Array<{ input: RNPVInput; error: string }> = [];
    fc.assert(
      fc.property(arbRNPVInput, (input) => {
        try {
          const result = calculateRNPV(input);
          if (!isFiniteNumber(result.riskAdjustedNPV)) return false;
          if (!isFiniteNumber(result.cumulativePoS)) return false;
          return true;
        } catch (e: any) {
          crashes.push({ input, error: e.message });
          return false;
        }
      }),
      { numRuns: 300 },
    );
    if (crashes.length > 0) {
      console.warn(`[fuzz] calculateRNPV crashes: ${crashes.length}`);
      console.warn(crashes.slice(0, 3));
    }
    expect(crashes.length).toBe(0);
  });

  test('no critical invariant violations for 200 random inputs', () => {
    const failures: Array<{ input: RNPVInput; violations: string[] }> = [];
    fc.assert(
      fc.property(arbRNPVInput, (input) => {
        const result = calculateRNPV(input);
        const violations = checkRNPVInvariants(result, input);
        const criticals = violations.filter(v => v.severity === 'critical');
        if (criticals.length > 0) {
          failures.push({
            input,
            violations: criticals.map(c => `${c.rule}: ${c.message}`),
          });
          return false;
        }
        return true;
      }),
      { numRuns: 200 },
    );
    if (failures.length > 0) {
      console.warn(`[fuzz] rNPV invariant failures: ${failures.length}`);
      console.warn(failures.slice(0, 3));
    }
    expect(failures.length).toBe(0);
  });

  test('PoS always in [0, 1]', () => {
    fc.assert(
      fc.property(arbRNPVInput, (input) => {
        const result = calculateRNPV(input);
        return result.cumulativePoS >= 0 && result.cumulativePoS <= 1;
      }),
      { numRuns: 300 },
    );
  });

  test('cashFlows array is non-empty for non-approved phases', () => {
    fc.assert(
      fc.property(arbRNPVInput, (input) => {
        if (input.phase === 'approved') return true;
        const result = calculateRNPV(input);
        return result.cashFlows.length > 0;
      }),
      { numRuns: 200 },
    );
  });
});
