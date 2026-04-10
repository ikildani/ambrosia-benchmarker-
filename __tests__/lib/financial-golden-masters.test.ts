/**
 * Golden Master Snapshots — Layer 5 of the 5-layer bug detection system
 *
 * 36 canonical reference calculations (6 TAs × 3 phases × 2 modalities).
 * Each runs the rNPV engine and asserts the key outputs are within a
 * tight tolerance of a pre-recorded expected value.
 *
 * Any drift forces explicit human review: "did we mean to change this?"
 *
 * Baseline values were captured from the current rNPV engine output on
 * 2026-04-06 (matching the matrix in the rnpv-regression cron). Tolerances
 * are tuned to:
 *   - absorb small calibration updates (±10pp of PoS)
 *   - catch order-of-magnitude bugs (±50% of rNPV, ±1.5y of yearsToMarket,
 *     ±2pp of discount rate)
 *
 * When updating these after an intentional engine change, run:
 *   npx jest __tests__/lib/financial-golden-masters.test.ts
 * and visually verify every new value before committing.
 */

import { calculateRNPV } from '@/lib/financial/rnpv-engine';
import type { RNPVInput } from '@/lib/financial/types';

// ---------------------------------------------------------------------------
// Tolerance helpers
// ---------------------------------------------------------------------------

interface Tol {
  /** Absolute tolerance (e.g., { abs: 50 } for ±$50M) */
  abs?: number;
  /** Fractional tolerance (e.g., 0.25 for ±25%) */
  pct?: number;
}

interface Expectation {
  value: number;
  tolerance: Tol;
}

interface GoldenMaster {
  name: string;
  input: RNPVInput;
  expected: {
    riskAdjustedNPV: Expectation;
    cumulativePoS: Expectation;
    yearsToMarket: Expectation;
    discountRate: Expectation;
  };
}

function makeInput(overrides: Partial<RNPVInput>): RNPVInput {
  return {
    phase: 'phase2',
    therapeuticArea: 'oncology',
    modality: 'smallMolecule',
    indication: 'lung_nsclc',
    territory: 'global',
    peakSalesEstimate: { low: 500, median: 1500, high: 3000 },
    competitivePosition: 'racing',
    dataQuality: 'moderate',
    biomarkerStatus: 'unselected',
    regulatoryDesignations: { breakthrough: false, fastTrack: false, orphan: false, prime: false },
    ...overrides,
  };
}

function assertWithinTolerance(
  label: string,
  actual: number,
  expected: Expectation,
): void {
  const diff = Math.abs(actual - expected.value);
  const { abs = 0, pct = 0 } = expected.tolerance;
  const pctAllowance = pct > 0 ? Math.abs(expected.value) * pct : 0;
  const allowance = Math.max(abs, pctAllowance);

  if (diff > allowance) {
    throw new Error(
      `[GOLDEN MASTER DRIFT] ${label}: actual=${actual.toFixed(3)} expected=${expected.value.toFixed(3)} diff=${diff.toFixed(3)} > allowance=${allowance.toFixed(3)} (tol=abs±${abs}, pct±${(pct * 100).toFixed(0)}%)`,
    );
  }
}

// ---------------------------------------------------------------------------
// Golden master matrix: 6 TAs × 3 phases × 2 modalities = 36 cases
// ---------------------------------------------------------------------------
// Expected values captured from the live rNPV engine output. They should be
// updated ONLY after a deliberate calibration change — never to "make the
// test pass" without understanding why.

// Standard tolerance pack — rNPV is noisy so we allow the larger of ±$150M or
// ±50%. PoS, yearsToMarket, and discountRate are tighter because they're
// structural and shouldn't shift silently.
const TOL_NPV: Tol = { abs: 150, pct: 0.50 };
const TOL_POS: Tol = { abs: 0.06 };
const TOL_YRS: Tol = { abs: 1.5 };
const TOL_DR: Tol = { abs: 0.03 };

const INDICATIONS: Record<string, string> = {
  oncology: 'lung_nsclc',
  neurology: 'alzheimers',
  immunology: 'rheumatoid_arthritis',
  metabolic: 'type2_diabetes',
  rareDisease: 'dmd',
  cardiovascular: 'heart_failure',
};

// Regulatory designations: rare disease gets orphan/breakthrough
const rareDesignations = { breakthrough: true, fastTrack: true, orphan: true, prime: false };
const noDesignations = { breakthrough: false, fastTrack: false, orphan: false, prime: false };

const GOLDEN_MASTERS: GoldenMaster[] = [
  // ─── ONCOLOGY ─────────────────────────────────────────────
  {
    name: 'oncology phase1 smallMolecule',
    input: makeInput({ therapeuticArea: 'oncology', phase: 'phase1', modality: 'smallMolecule', indication: INDICATIONS.oncology, regulatoryDesignations: noDesignations }),
    expected: {
      riskAdjustedNPV: { value: -10, tolerance: TOL_NPV },
      cumulativePoS: { value: 0.078, tolerance: TOL_POS },
      yearsToMarket: { value: 8.8, tolerance: TOL_YRS },
      discountRate: { value: 0.130, tolerance: TOL_DR },
    },
  },
  {
    name: 'oncology phase1 mab',
    input: makeInput({ therapeuticArea: 'oncology', phase: 'phase1', modality: 'mab', indication: INDICATIONS.oncology, regulatoryDesignations: noDesignations }),
    expected: {
      riskAdjustedNPV: { value: 7, tolerance: TOL_NPV },
      cumulativePoS: { value: 0.098, tolerance: TOL_POS },
      yearsToMarket: { value: 8.8, tolerance: TOL_YRS },
      discountRate: { value: 0.130, tolerance: TOL_DR },
    },
  },
  {
    name: 'oncology phase2 smallMolecule',
    input: makeInput({ therapeuticArea: 'oncology', phase: 'phase2', modality: 'smallMolecule', indication: INDICATIONS.oncology, regulatoryDesignations: noDesignations }),
    expected: {
      riskAdjustedNPV: { value: 182, tolerance: TOL_NPV },
      cumulativePoS: { value: 0.155, tolerance: TOL_POS },
      yearsToMarket: { value: 7.0, tolerance: TOL_YRS },
      discountRate: { value: 0.110, tolerance: TOL_DR },
    },
  },
  {
    name: 'oncology phase2 mab',
    input: makeInput({ therapeuticArea: 'oncology', phase: 'phase2', modality: 'mab', indication: INDICATIONS.oncology, regulatoryDesignations: noDesignations }),
    expected: {
      riskAdjustedNPV: { value: 219, tolerance: TOL_NPV },
      cumulativePoS: { value: 0.181, tolerance: TOL_POS },
      yearsToMarket: { value: 7.0, tolerance: TOL_YRS },
      discountRate: { value: 0.110, tolerance: TOL_DR },
    },
  },
  {
    name: 'oncology phase3 smallMolecule',
    input: makeInput({ therapeuticArea: 'oncology', phase: 'phase3', modality: 'smallMolecule', indication: INDICATIONS.oncology, regulatoryDesignations: noDesignations }),
    expected: {
      riskAdjustedNPV: { value: 1285, tolerance: TOL_NPV },
      cumulativePoS: { value: 0.485, tolerance: TOL_POS },
      yearsToMarket: { value: 4.5, tolerance: TOL_YRS },
      discountRate: { value: 0.090, tolerance: TOL_DR },
    },
  },
  {
    name: 'oncology phase3 mab',
    input: makeInput({ therapeuticArea: 'oncology', phase: 'phase3', modality: 'mab', indication: INDICATIONS.oncology, regulatoryDesignations: noDesignations }),
    expected: {
      riskAdjustedNPV: { value: 1374, tolerance: TOL_NPV },
      cumulativePoS: { value: 0.523, tolerance: TOL_POS },
      yearsToMarket: { value: 4.5, tolerance: TOL_YRS },
      discountRate: { value: 0.090, tolerance: TOL_DR },
    },
  },

  // ─── NEUROLOGY ────────────────────────────────────────────
  {
    name: 'neurology phase1 smallMolecule',
    input: makeInput({ therapeuticArea: 'neurology', phase: 'phase1', modality: 'smallMolecule', indication: INDICATIONS.neurology, regulatoryDesignations: noDesignations }),
    expected: {
      riskAdjustedNPV: { value: -71, tolerance: TOL_NPV },
      cumulativePoS: { value: 0.052, tolerance: TOL_POS },
      yearsToMarket: { value: 11.0, tolerance: TOL_YRS },
      discountRate: { value: 0.140, tolerance: TOL_DR },
    },
  },
  {
    name: 'neurology phase1 mab',
    input: makeInput({ therapeuticArea: 'neurology', phase: 'phase1', modality: 'mab', indication: INDICATIONS.neurology, regulatoryDesignations: noDesignations }),
    expected: {
      riskAdjustedNPV: { value: -64, tolerance: TOL_NPV },
      cumulativePoS: { value: 0.065, tolerance: TOL_POS },
      yearsToMarket: { value: 11.0, tolerance: TOL_YRS },
      discountRate: { value: 0.140, tolerance: TOL_DR },
    },
  },
  {
    name: 'neurology phase2 smallMolecule',
    input: makeInput({ therapeuticArea: 'neurology', phase: 'phase2', modality: 'smallMolecule', indication: INDICATIONS.neurology, regulatoryDesignations: noDesignations }),
    expected: {
      riskAdjustedNPV: { value: -3, tolerance: TOL_NPV },
      cumulativePoS: { value: 0.113, tolerance: TOL_POS },
      yearsToMarket: { value: 9.2, tolerance: TOL_YRS },
      discountRate: { value: 0.120, tolerance: TOL_DR },
    },
  },
  {
    name: 'neurology phase2 mab',
    input: makeInput({ therapeuticArea: 'neurology', phase: 'phase2', modality: 'mab', indication: INDICATIONS.neurology, regulatoryDesignations: noDesignations }),
    expected: {
      riskAdjustedNPV: { value: 13, tolerance: TOL_NPV },
      cumulativePoS: { value: 0.131, tolerance: TOL_POS },
      yearsToMarket: { value: 9.2, tolerance: TOL_YRS },
      discountRate: { value: 0.120, tolerance: TOL_DR },
    },
  },
  {
    name: 'neurology phase3 smallMolecule',
    input: makeInput({ therapeuticArea: 'neurology', phase: 'phase3', modality: 'smallMolecule', indication: INDICATIONS.neurology, regulatoryDesignations: noDesignations }),
    expected: {
      riskAdjustedNPV: { value: 863, tolerance: TOL_NPV },
      cumulativePoS: { value: 0.433, tolerance: TOL_POS },
      yearsToMarket: { value: 6.0, tolerance: TOL_YRS },
      discountRate: { value: 0.100, tolerance: TOL_DR },
    },
  },
  {
    name: 'neurology phase3 mab',
    input: makeInput({ therapeuticArea: 'neurology', phase: 'phase3', modality: 'mab', indication: INDICATIONS.neurology, regulatoryDesignations: noDesignations }),
    expected: {
      riskAdjustedNPV: { value: 924, tolerance: TOL_NPV },
      cumulativePoS: { value: 0.468, tolerance: TOL_POS },
      yearsToMarket: { value: 6.0, tolerance: TOL_YRS },
      discountRate: { value: 0.100, tolerance: TOL_DR },
    },
  },

  // ─── IMMUNOLOGY ───────────────────────────────────────────
  {
    name: 'immunology phase1 smallMolecule',
    input: makeInput({ therapeuticArea: 'immunology', phase: 'phase1', modality: 'smallMolecule', indication: INDICATIONS.immunology, regulatoryDesignations: noDesignations }),
    expected: {
      riskAdjustedNPV: { value: -26, tolerance: TOL_NPV },
      cumulativePoS: { value: 0.109, tolerance: TOL_POS },
      yearsToMarket: { value: 8.3, tolerance: TOL_YRS },
      discountRate: { value: 0.120, tolerance: TOL_DR },
    },
  },
  {
    name: 'immunology phase1 mab',
    input: makeInput({ therapeuticArea: 'immunology', phase: 'phase1', modality: 'mab', indication: INDICATIONS.immunology, regulatoryDesignations: noDesignations }),
    expected: {
      riskAdjustedNPV: { value: -11, tolerance: TOL_NPV },
      cumulativePoS: { value: 0.137, tolerance: TOL_POS },
      yearsToMarket: { value: 8.3, tolerance: TOL_YRS },
      discountRate: { value: 0.120, tolerance: TOL_DR },
    },
  },
  {
    name: 'immunology phase2 smallMolecule',
    input: makeInput({ therapeuticArea: 'immunology', phase: 'phase2', modality: 'smallMolecule', indication: INDICATIONS.immunology, regulatoryDesignations: noDesignations }),
    expected: {
      riskAdjustedNPV: { value: 107, tolerance: TOL_NPV },
      cumulativePoS: { value: 0.198, tolerance: TOL_POS },
      yearsToMarket: { value: 6.8, tolerance: TOL_YRS },
      discountRate: { value: 0.105, tolerance: TOL_DR },
    },
  },
  {
    name: 'immunology phase2 mab',
    input: makeInput({ therapeuticArea: 'immunology', phase: 'phase2', modality: 'mab', indication: INDICATIONS.immunology, regulatoryDesignations: noDesignations }),
    expected: {
      riskAdjustedNPV: { value: 135, tolerance: TOL_NPV },
      cumulativePoS: { value: 0.231, tolerance: TOL_POS },
      yearsToMarket: { value: 6.8, tolerance: TOL_YRS },
      discountRate: { value: 0.105, tolerance: TOL_DR },
    },
  },
  {
    name: 'immunology phase3 smallMolecule',
    input: makeInput({ therapeuticArea: 'immunology', phase: 'phase3', modality: 'smallMolecule', indication: INDICATIONS.immunology, regulatoryDesignations: noDesignations }),
    expected: {
      riskAdjustedNPV: { value: 690, tolerance: TOL_NPV },
      cumulativePoS: { value: 0.535, tolerance: TOL_POS },
      yearsToMarket: { value: 4.3, tolerance: TOL_YRS },
      discountRate: { value: 0.090, tolerance: TOL_DR },
    },
  },
  {
    name: 'immunology phase3 mab',
    input: makeInput({ therapeuticArea: 'immunology', phase: 'phase3', modality: 'mab', indication: INDICATIONS.immunology, regulatoryDesignations: noDesignations }),
    expected: {
      riskAdjustedNPV: { value: 747, tolerance: TOL_NPV },
      cumulativePoS: { value: 0.577, tolerance: TOL_POS },
      yearsToMarket: { value: 4.3, tolerance: TOL_YRS },
      discountRate: { value: 0.090, tolerance: TOL_DR },
    },
  },

  // ─── METABOLIC ────────────────────────────────────────────
  {
    name: 'metabolic phase1 smallMolecule',
    input: makeInput({ therapeuticArea: 'metabolic', phase: 'phase1', modality: 'smallMolecule', indication: INDICATIONS.metabolic, regulatoryDesignations: noDesignations }),
    expected: {
      riskAdjustedNPV: { value: -49, tolerance: TOL_NPV },
      cumulativePoS: { value: 0.127, tolerance: TOL_POS },
      yearsToMarket: { value: 9.5, tolerance: TOL_YRS },
      discountRate: { value: 0.120, tolerance: TOL_DR },
    },
  },
  {
    name: 'metabolic phase1 mab',
    input: makeInput({ therapeuticArea: 'metabolic', phase: 'phase1', modality: 'mab', indication: INDICATIONS.metabolic, regulatoryDesignations: noDesignations }),
    expected: {
      riskAdjustedNPV: { value: -36, tolerance: TOL_NPV },
      cumulativePoS: { value: 0.160, tolerance: TOL_POS },
      yearsToMarket: { value: 9.5, tolerance: TOL_YRS },
      discountRate: { value: 0.120, tolerance: TOL_DR },
    },
  },
  {
    name: 'metabolic phase2 smallMolecule',
    input: makeInput({ therapeuticArea: 'metabolic', phase: 'phase2', modality: 'smallMolecule', indication: INDICATIONS.metabolic, regulatoryDesignations: noDesignations }),
    expected: {
      riskAdjustedNPV: { value: 70, tolerance: TOL_NPV },
      cumulativePoS: { value: 0.227, tolerance: TOL_POS },
      yearsToMarket: { value: 8.0, tolerance: TOL_YRS },
      discountRate: { value: 0.105, tolerance: TOL_DR },
    },
  },
  {
    name: 'metabolic phase2 mab',
    input: makeInput({ therapeuticArea: 'metabolic', phase: 'phase2', modality: 'mab', indication: INDICATIONS.metabolic, regulatoryDesignations: noDesignations }),
    expected: {
      riskAdjustedNPV: { value: 92, tolerance: TOL_NPV },
      cumulativePoS: { value: 0.265, tolerance: TOL_POS },
      yearsToMarket: { value: 8.0, tolerance: TOL_YRS },
      discountRate: { value: 0.105, tolerance: TOL_DR },
    },
  },
  {
    name: 'metabolic phase3 smallMolecule',
    input: makeInput({ therapeuticArea: 'metabolic', phase: 'phase3', modality: 'smallMolecule', indication: INDICATIONS.metabolic, regulatoryDesignations: noDesignations }),
    expected: {
      riskAdjustedNPV: { value: 591, tolerance: TOL_NPV },
      cumulativePoS: { value: 0.568, tolerance: TOL_POS },
      yearsToMarket: { value: 5.5, tolerance: TOL_YRS },
      discountRate: { value: 0.090, tolerance: TOL_DR },
    },
  },
  {
    name: 'metabolic phase3 mab',
    input: makeInput({ therapeuticArea: 'metabolic', phase: 'phase3', modality: 'mab', indication: INDICATIONS.metabolic, regulatoryDesignations: noDesignations }),
    expected: {
      riskAdjustedNPV: { value: 625, tolerance: TOL_NPV },
      cumulativePoS: { value: 0.614, tolerance: TOL_POS },
      yearsToMarket: { value: 5.5, tolerance: TOL_YRS },
      discountRate: { value: 0.090, tolerance: TOL_DR },
    },
  },

  // ─── RARE DISEASE ─────────────────────────────────────────
  {
    name: 'rareDisease phase1 smallMolecule',
    input: makeInput({ therapeuticArea: 'rareDisease', phase: 'phase1', modality: 'smallMolecule', indication: INDICATIONS.rareDisease, regulatoryDesignations: rareDesignations }),
    expected: {
      riskAdjustedNPV: { value: 240, tolerance: TOL_NPV },
      cumulativePoS: { value: 0.257, tolerance: { abs: 0.08 } },
      yearsToMarket: { value: 7.8, tolerance: TOL_YRS },
      discountRate: { value: 0.150, tolerance: TOL_DR },
    },
  },
  {
    name: 'rareDisease phase1 mab',
    input: makeInput({ therapeuticArea: 'rareDisease', phase: 'phase1', modality: 'mab', indication: INDICATIONS.rareDisease, regulatoryDesignations: rareDesignations }),
    expected: {
      riskAdjustedNPV: { value: 264, tolerance: TOL_NPV },
      cumulativePoS: { value: 0.300, tolerance: { abs: 0.08 } },
      yearsToMarket: { value: 7.8, tolerance: TOL_YRS },
      discountRate: { value: 0.150, tolerance: TOL_DR },
    },
  },
  {
    name: 'rareDisease phase2 smallMolecule',
    input: makeInput({ therapeuticArea: 'rareDisease', phase: 'phase2', modality: 'smallMolecule', indication: INDICATIONS.rareDisease, regulatoryDesignations: rareDesignations }),
    expected: {
      riskAdjustedNPV: { value: 609, tolerance: TOL_NPV },
      cumulativePoS: { value: 0.428, tolerance: { abs: 0.10 } },
      yearsToMarket: { value: 6.3, tolerance: TOL_YRS },
      discountRate: { value: 0.140, tolerance: TOL_DR },
    },
  },
  {
    name: 'rareDisease phase2 mab',
    input: makeInput({ therapeuticArea: 'rareDisease', phase: 'phase2', modality: 'mab', indication: INDICATIONS.rareDisease, regulatoryDesignations: rareDesignations }),
    expected: {
      riskAdjustedNPV: { value: 610, tolerance: TOL_NPV },
      cumulativePoS: { value: 0.462, tolerance: { abs: 0.10 } },
      yearsToMarket: { value: 6.3, tolerance: TOL_YRS },
      discountRate: { value: 0.140, tolerance: TOL_DR },
    },
  },
  {
    name: 'rareDisease phase3 smallMolecule',
    input: makeInput({ therapeuticArea: 'rareDisease', phase: 'phase3', modality: 'smallMolecule', indication: INDICATIONS.rareDisease, regulatoryDesignations: rareDesignations }),
    expected: {
      riskAdjustedNPV: { value: 1948, tolerance: { abs: 300, pct: 0.50 } },
      cumulativePoS: { value: 0.777, tolerance: { abs: 0.12 } },
      yearsToMarket: { value: 4.3, tolerance: TOL_YRS },
      discountRate: { value: 0.120, tolerance: TOL_DR },
    },
  },
  {
    name: 'rareDisease phase3 mab',
    input: makeInput({ therapeuticArea: 'rareDisease', phase: 'phase3', modality: 'mab', indication: INDICATIONS.rareDisease, regulatoryDesignations: rareDesignations }),
    expected: {
      riskAdjustedNPV: { value: 1827, tolerance: { abs: 300, pct: 0.50 } },
      cumulativePoS: { value: 0.777, tolerance: { abs: 0.12 } },
      yearsToMarket: { value: 4.3, tolerance: TOL_YRS },
      discountRate: { value: 0.120, tolerance: TOL_DR },
    },
  },

  // ─── CARDIOVASCULAR ───────────────────────────────────────
  {
    name: 'cardiovascular phase1 smallMolecule',
    input: makeInput({ therapeuticArea: 'cardiovascular', phase: 'phase1', modality: 'smallMolecule', indication: INDICATIONS.cardiovascular, regulatoryDesignations: noDesignations }),
    expected: {
      riskAdjustedNPV: { value: -123, tolerance: TOL_NPV },
      cumulativePoS: { value: 0.079, tolerance: TOL_POS },
      yearsToMarket: { value: 10.8, tolerance: TOL_YRS },
      discountRate: { value: 0.130, tolerance: TOL_DR },
    },
  },
  {
    name: 'cardiovascular phase1 mab',
    input: makeInput({ therapeuticArea: 'cardiovascular', phase: 'phase1', modality: 'mab', indication: INDICATIONS.cardiovascular, regulatoryDesignations: noDesignations }),
    expected: {
      riskAdjustedNPV: { value: -119, tolerance: TOL_NPV },
      cumulativePoS: { value: 0.100, tolerance: TOL_POS },
      yearsToMarket: { value: 10.8, tolerance: TOL_YRS },
      discountRate: { value: 0.130, tolerance: TOL_DR },
    },
  },
  {
    name: 'cardiovascular phase2 smallMolecule',
    input: makeInput({ therapeuticArea: 'cardiovascular', phase: 'phase2', modality: 'smallMolecule', indication: INDICATIONS.cardiovascular, regulatoryDesignations: noDesignations }),
    expected: {
      riskAdjustedNPV: { value: -83, tolerance: TOL_NPV },
      cumulativePoS: { value: 0.159, tolerance: TOL_POS },
      yearsToMarket: { value: 9.3, tolerance: TOL_YRS },
      discountRate: { value: 0.115, tolerance: TOL_DR },
    },
  },
  {
    name: 'cardiovascular phase2 mab',
    input: makeInput({ therapeuticArea: 'cardiovascular', phase: 'phase2', modality: 'mab', indication: INDICATIONS.cardiovascular, regulatoryDesignations: noDesignations }),
    expected: {
      riskAdjustedNPV: { value: -74, tolerance: TOL_NPV },
      cumulativePoS: { value: 0.185, tolerance: TOL_POS },
      yearsToMarket: { value: 9.3, tolerance: TOL_YRS },
      discountRate: { value: 0.115, tolerance: TOL_DR },
    },
  },
  {
    name: 'cardiovascular phase3 smallMolecule',
    input: makeInput({ therapeuticArea: 'cardiovascular', phase: 'phase3', modality: 'smallMolecule', indication: INDICATIONS.cardiovascular, regulatoryDesignations: noDesignations }),
    expected: {
      riskAdjustedNPV: { value: 205, tolerance: TOL_NPV },
      cumulativePoS: { value: 0.496, tolerance: TOL_POS },
      yearsToMarket: { value: 6.3, tolerance: TOL_YRS },
      discountRate: { value: 0.095, tolerance: TOL_DR },
    },
  },
  {
    name: 'cardiovascular phase3 mab',
    input: makeInput({ therapeuticArea: 'cardiovascular', phase: 'phase3', modality: 'mab', indication: INDICATIONS.cardiovascular, regulatoryDesignations: noDesignations }),
    expected: {
      riskAdjustedNPV: { value: 233, tolerance: TOL_NPV },
      cumulativePoS: { value: 0.536, tolerance: TOL_POS },
      yearsToMarket: { value: 6.3, tolerance: TOL_YRS },
      discountRate: { value: 0.095, tolerance: TOL_DR },
    },
  },
];

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Golden masters — canonical reference calculations', () => {
  test('expected matrix size = 36 (6 TAs × 3 phases × 2 modalities)', () => {
    expect(GOLDEN_MASTERS.length).toBe(36);
  });

  for (const gm of GOLDEN_MASTERS) {
    test(`Golden: ${gm.name}`, () => {
      const result = calculateRNPV(gm.input);
      assertWithinTolerance(`${gm.name}.riskAdjustedNPV`, result.riskAdjustedNPV, gm.expected.riskAdjustedNPV);
      assertWithinTolerance(`${gm.name}.cumulativePoS`, result.cumulativePoS, gm.expected.cumulativePoS);
      assertWithinTolerance(`${gm.name}.yearsToMarket`, result.yearsToMarket, gm.expected.yearsToMarket);
      assertWithinTolerance(`${gm.name}.discountRate`, result.discountRate, gm.expected.discountRate);
    });
  }
});
