/**
 * Golden Master Snapshots — Layer 5 of the 5-layer bug detection system
 *
 * 108 canonical reference calculations (6 TAs × 3 indications × 3 phases × 2 modalities).
 * Each runs the rNPV engine and asserts the key outputs are within a
 * tight tolerance of a pre-recorded expected value.
 *
 * Any drift forces explicit human review: "did we mean to change this?"
 *
 * The 3-indications-per-TA expansion (replacing the original 1 indication each)
 * catches indication-specific bugs — e.g., a phase 2 oncology mAb in NSCLC vs
 * multiple myeloma produces a different rNPV because peak sales penalties,
 * generic entrenchment, and competitive dynamics differ per indication.
 *
 * Baseline values were captured from the live rNPV engine output on 2026-04-06
 * and then REGENERATED on 2026-04-10 following the Phase 3 indication-level
 * calibration project. Tolerances are tuned to:
 *   - absorb small calibration updates (±6pp of PoS)
 *   - catch order-of-magnitude bugs (±50% of rNPV, ±1.5y of yearsToMarket,
 *     ±3pp of discount rate)
 *
 * --- 2026-04-10 RECALIBRATION ---
 * Reason: Phase 3 indication-level calibration applied across 50 indications,
 * touching four independent layers:
 *   1. lib/financial/indication-pos-modifiers.ts (per-indication PoS multipliers)
 *   2. lib/financial/index-drugs.ts INDICATION_MARKET_CAPS (peak sales caps)
 *   3. lib/financial/pos-tables.ts INDICATION_REVENUE_CURVES (ramp/peak/decay)
 *   4. lib/financial/indication-competitive-density.ts (crowding penalty/boost)
 *
 * Of the 110 baseline assertions, 28 drifted past tolerance under the previous
 * table. The new baselines capture the correct calibrated outputs. Notable
 * regime shifts:
 *   - Oncology (lung_nsclc, breast_her2): rNPV drops ~40-45% at phase 3 due to
 *     density penalty on crowded indications.
 *   - Neurology (alzheimers, als): PoS at phase 2 now ~0.04 (was ~0.11) — the
 *     Alzheimer's modifier is 0.45x phase2->3 reflecting the empirical failure
 *     rate in that field; this reduces phase-3 rNPV by ~45%.
 *   - Metabolic (obesity): rNPV jumps at phase 1/2 due to new orphan-like
 *     revenue curve and positive competitive density on GLP-1 class.
 *   - Rare disease (dmd, sma, cystic_fibrosis): phase 1-2 rNPV increases
 *     2-4x due to new DMD/SMA PoS boost (1.40x) AND tighter orphan revenue
 *     curves (2y ramp + 10y peak) — matches recent deal comps (Capsida,
 *     Dyne, Avidity). Phase 3 rNPV also rises ~25%.
 *
 * When updating these after an intentional engine change:
 *   1. Run the test to see drift:
 *        npx jest __tests__/lib/financial-golden-masters.test.ts
 *   2. For each drifted case, read the "actual=X expected=Y" error and
 *      update the matching row in the BASELINES table below.
 *      (For bulk updates, write a throw-away tsx script that imports
 *      calculateRNPV and prints the full BASELINES array in the format
 *      below, then paste the output in.)
 *   3. Re-run the test and visually verify every new value before
 *      committing.
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
// Golden master matrix: 6 TAs × 3 indications × 3 phases × 2 modalities = 108 cases
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

// Rare-disease PoS is structurally higher-variance (orphan designations + small
// trials amplify PoS modifier swings) and rNPV swings past the $150M floor on
// phase 3, so we widen just those bands.
const TOL_POS_RARE: Tol = { abs: 0.12 };
const TOL_NPV_RARE_P3: Tol = { abs: 300, pct: 0.50 };

// Three indications per TA. Substitutions from the originally-requested set:
//   • oncology:       'breast'            → 'breast_her2'           (engine expects tumor-typed slug)
//   • oncology:       'melanoma'          → 'multiple_myeloma'      (distinct index-drug profile)
//   • neurology:      'parkinsons'        → 'multiple_sclerosis'    (PD has no index drug entry)
//   • metabolic:      'nash'              → 'nash_mash'             (canonical slug)
//   • cardiovascular: 'cardiometabolic'   → 'hypercholesterolemia'  (CM is not an enum slug)
const INDICATIONS_BY_TA: Record<string, [string, string, string]> = {
  oncology: ['lung_nsclc', 'breast_her2', 'multiple_myeloma'],
  neurology: ['alzheimers', 'multiple_sclerosis', 'als'],
  immunology: ['rheumatoid_arthritis', 'psoriasis', 'lupus'],
  metabolic: ['type2_diabetes', 'obesity', 'nash_mash'],
  rareDisease: ['dmd', 'cystic_fibrosis', 'sma'],
  cardiovascular: ['heart_failure', 'pah', 'hypercholesterolemia'],
};

const PHASES: Array<'phase1' | 'phase2' | 'phase3'> = ['phase1', 'phase2', 'phase3'];
const MODALITIES: Array<'smallMolecule' | 'mab'> = ['smallMolecule', 'mab'];

// Regulatory designations: rare disease gets orphan/breakthrough
const rareDesignations = { breakthrough: true, fastTrack: true, orphan: true, prime: false };
const noDesignations = { breakthrough: false, fastTrack: false, orphan: false, prime: false };

// ---------------------------------------------------------------------------
// Baseline table — one row per (ta, indication, phase, modality).
// Values captured from calculateRNPV() on 2026-04-06.
// ---------------------------------------------------------------------------

interface Baseline {
  ta: keyof typeof INDICATIONS_BY_TA;
  indication: string;
  phase: 'phase1' | 'phase2' | 'phase3';
  modality: 'smallMolecule' | 'mab';
  npv: number;
  pos: number;
  yrs: number;
  dr: number;
}

const BASELINES: Baseline[] = [
  // ─── ONCOLOGY ───
  { ta: 'oncology', indication: 'lung_nsclc', phase: 'phase1', modality: 'smallMolecule', npv: -62, pos: 0.0528, yrs: 8.80, dr: 0.1300 },
  { ta: 'oncology', indication: 'lung_nsclc', phase: 'phase1', modality: 'mab', npv: -55, pos: 0.0666, yrs: 8.80, dr: 0.1300 },
  { ta: 'oncology', indication: 'lung_nsclc', phase: 'phase2', modality: 'smallMolecule', npv: 25, pos: 0.1149, yrs: 7.00, dr: 0.1100 },
  { ta: 'oncology', indication: 'lung_nsclc', phase: 'phase2', modality: 'mab', npv: 39, pos: 0.1340, yrs: 7.00, dr: 0.1100 },
  { ta: 'oncology', indication: 'lung_nsclc', phase: 'phase3', modality: 'smallMolecule', npv: 730, pos: 0.4603, yrs: 4.50, dr: 0.0900 },
  { ta: 'oncology', indication: 'lung_nsclc', phase: 'phase3', modality: 'mab', npv: 764, pos: 0.4971, yrs: 4.50, dr: 0.0900 },
  { ta: 'oncology', indication: 'breast_her2', phase: 'phase1', modality: 'smallMolecule', npv: -25, pos: 0.0940, yrs: 8.80, dr: 0.1300 },
  { ta: 'oncology', indication: 'breast_her2', phase: 'phase1', modality: 'mab', npv: -14, pos: 0.1185, yrs: 8.80, dr: 0.1300 },
  { ta: 'oncology', indication: 'breast_her2', phase: 'phase2', modality: 'smallMolecule', npv: 123, pos: 0.1790, yrs: 7.00, dr: 0.1100 },
  { ta: 'oncology', indication: 'breast_her2', phase: 'phase2', modality: 'mab', npv: 142, pos: 0.2088, yrs: 7.00, dr: 0.1100 },
  { ta: 'oncology', indication: 'breast_her2', phase: 'phase3', modality: 'smallMolecule', npv: 907, pos: 0.5088, yrs: 4.50, dr: 0.0900 },
  { ta: 'oncology', indication: 'breast_her2', phase: 'phase3', modality: 'mab', npv: 921, pos: 0.5494, yrs: 4.50, dr: 0.0900 },
  { ta: 'oncology', indication: 'multiple_myeloma', phase: 'phase1', modality: 'smallMolecule', npv: -83, pos: 0.0776, yrs: 8.80, dr: 0.1300 },
  { ta: 'oncology', indication: 'multiple_myeloma', phase: 'phase1', modality: 'mab', npv: -81, pos: 0.0977, yrs: 8.80, dr: 0.1300 },
  { ta: 'oncology', indication: 'multiple_myeloma', phase: 'phase2', modality: 'smallMolecule', npv: -54, pos: 0.1550, yrs: 7.00, dr: 0.1100 },
  { ta: 'oncology', indication: 'multiple_myeloma', phase: 'phase2', modality: 'mab', npv: -47, pos: 0.1809, yrs: 7.00, dr: 0.1100 },
  { ta: 'oncology', indication: 'multiple_myeloma', phase: 'phase3', modality: 'smallMolecule', npv: 172, pos: 0.4845, yrs: 4.50, dr: 0.0900 },
  { ta: 'oncology', indication: 'multiple_myeloma', phase: 'phase3', modality: 'mab', npv: 190, pos: 0.5233, yrs: 4.50, dr: 0.0900 },

  // ─── NEUROLOGY ───
  { ta: 'neurology', indication: 'alzheimers', phase: 'phase1', modality: 'smallMolecule', npv: -101, pos: 0.0139, yrs: 11.00, dr: 0.1400 },
  { ta: 'neurology', indication: 'alzheimers', phase: 'phase1', modality: 'mab', npv: -98, pos: 0.0175, yrs: 11.00, dr: 0.1400 },
  { ta: 'neurology', indication: 'alzheimers', phase: 'phase2', modality: 'smallMolecule', npv: -99, pos: 0.0355, yrs: 9.20, dr: 0.1200 },
  { ta: 'neurology', indication: 'alzheimers', phase: 'phase2', modality: 'mab', npv: -93, pos: 0.0414, yrs: 9.20, dr: 0.1200 },
  { ta: 'neurology', indication: 'alzheimers', phase: 'phase3', modality: 'smallMolecule', npv: 479, pos: 0.3034, yrs: 6.00, dr: 0.1000 },
  { ta: 'neurology', indication: 'alzheimers', phase: 'phase3', modality: 'mab', npv: 561, pos: 0.3277, yrs: 6.00, dr: 0.1000 },
  { ta: 'neurology', indication: 'multiple_sclerosis', phase: 'phase1', modality: 'smallMolecule', npv: -103, pos: 0.0519, yrs: 11.00, dr: 0.1400 },
  { ta: 'neurology', indication: 'multiple_sclerosis', phase: 'phase1', modality: 'mab', npv: -102, pos: 0.0653, yrs: 11.00, dr: 0.1400 },
  { ta: 'neurology', indication: 'multiple_sclerosis', phase: 'phase2', modality: 'smallMolecule', npv: -108, pos: 0.1127, yrs: 9.20, dr: 0.1200 },
  { ta: 'neurology', indication: 'multiple_sclerosis', phase: 'phase2', modality: 'mab', npv: -106, pos: 0.1315, yrs: 9.20, dr: 0.1200 },
  { ta: 'neurology', indication: 'multiple_sclerosis', phase: 'phase3', modality: 'smallMolecule', npv: 73, pos: 0.4334, yrs: 6.00, dr: 0.1000 },
  { ta: 'neurology', indication: 'multiple_sclerosis', phase: 'phase3', modality: 'mab', npv: 81, pos: 0.4681, yrs: 6.00, dr: 0.1000 },
  { ta: 'neurology', indication: 'als', phase: 'phase1', modality: 'smallMolecule', npv: -102, pos: 0.0157, yrs: 11.00, dr: 0.1400 },
  { ta: 'neurology', indication: 'als', phase: 'phase1', modality: 'mab', npv: -101, pos: 0.0199, yrs: 11.00, dr: 0.1400 },
  { ta: 'neurology', indication: 'als', phase: 'phase2', modality: 'smallMolecule', npv: -105, pos: 0.0403, yrs: 9.20, dr: 0.1200 },
  { ta: 'neurology', indication: 'als', phase: 'phase2', modality: 'mab', npv: -104, pos: 0.0470, yrs: 9.20, dr: 0.1200 },
  { ta: 'neurology', indication: 'als', phase: 'phase3', modality: 'smallMolecule', npv: 265, pos: 0.2817, yrs: 6.00, dr: 0.1000 },
  { ta: 'neurology', indication: 'als', phase: 'phase3', modality: 'mab', npv: 253, pos: 0.3043, yrs: 6.00, dr: 0.1000 },

  // ─── IMMUNOLOGY ───
  { ta: 'immunology', indication: 'rheumatoid_arthritis', phase: 'phase1', modality: 'smallMolecule', npv: -51, pos: 0.1088, yrs: 8.30, dr: 0.1200 },
  { ta: 'immunology', indication: 'rheumatoid_arthritis', phase: 'phase1', modality: 'mab', npv: -42, pos: 0.1371, yrs: 8.30, dr: 0.1200 },
  { ta: 'immunology', indication: 'rheumatoid_arthritis', phase: 'phase2', modality: 'smallMolecule', npv: 37, pos: 0.1979, yrs: 6.80, dr: 0.1050 },
  { ta: 'immunology', indication: 'rheumatoid_arthritis', phase: 'phase2', modality: 'mab', npv: 54, pos: 0.2307, yrs: 6.80, dr: 0.1050 },
  { ta: 'immunology', indication: 'rheumatoid_arthritis', phase: 'phase3', modality: 'smallMolecule', npv: 422, pos: 0.5347, yrs: 4.30, dr: 0.0900 },
  { ta: 'immunology', indication: 'rheumatoid_arthritis', phase: 'phase3', modality: 'mab', npv: 453, pos: 0.5774, yrs: 4.30, dr: 0.0900 },
  { ta: 'immunology', indication: 'psoriasis', phase: 'phase1', modality: 'smallMolecule', npv: 17, pos: 0.1720, yrs: 8.30, dr: 0.1200 },
  { ta: 'immunology', indication: 'psoriasis', phase: 'phase1', modality: 'mab', npv: 37, pos: 0.2168, yrs: 8.30, dr: 0.1200 },
  { ta: 'immunology', indication: 'psoriasis', phase: 'phase2', modality: 'smallMolecule', npv: 184, pos: 0.2720, yrs: 6.80, dr: 0.1050 },
  { ta: 'immunology', indication: 'psoriasis', phase: 'phase2', modality: 'mab', npv: 213, pos: 0.3173, yrs: 6.80, dr: 0.1050 },
  { ta: 'immunology', indication: 'psoriasis', phase: 'phase3', modality: 'smallMolecule', npv: 765, pos: 0.5881, yrs: 4.30, dr: 0.0900 },
  { ta: 'immunology', indication: 'psoriasis', phase: 'phase3', modality: 'mab', npv: 799, pos: 0.6352, yrs: 4.30, dr: 0.0900 },
  { ta: 'immunology', indication: 'lupus', phase: 'phase1', modality: 'smallMolecule', npv: 27, pos: 0.1088, yrs: 8.30, dr: 0.1200 },
  { ta: 'immunology', indication: 'lupus', phase: 'phase1', modality: 'mab', npv: 53, pos: 0.1371, yrs: 8.30, dr: 0.1200 },
  { ta: 'immunology', indication: 'lupus', phase: 'phase2', modality: 'smallMolecule', npv: 253, pos: 0.1979, yrs: 6.80, dr: 0.1050 },
  { ta: 'immunology', indication: 'lupus', phase: 'phase2', modality: 'mab', npv: 298, pos: 0.2307, yrs: 6.80, dr: 0.1050 },
  { ta: 'immunology', indication: 'lupus', phase: 'phase3', modality: 'smallMolecule', npv: 1259, pos: 0.5347, yrs: 4.30, dr: 0.0900 },
  { ta: 'immunology', indication: 'lupus', phase: 'phase3', modality: 'mab', npv: 1342, pos: 0.5774, yrs: 4.30, dr: 0.0900 },

  // ─── METABOLIC ───
  { ta: 'metabolic', indication: 'type2_diabetes', phase: 'phase1', modality: 'smallMolecule', npv: -71, pos: 0.1272, yrs: 9.50, dr: 0.1200 },
  { ta: 'metabolic', indication: 'type2_diabetes', phase: 'phase1', modality: 'mab', npv: -63, pos: 0.1603, yrs: 9.50, dr: 0.1200 },
  { ta: 'metabolic', indication: 'type2_diabetes', phase: 'phase2', modality: 'smallMolecule', npv: 10, pos: 0.2272, yrs: 8.00, dr: 0.1050 },
  { ta: 'metabolic', indication: 'type2_diabetes', phase: 'phase2', modality: 'mab', npv: 24, pos: 0.2650, yrs: 8.00, dr: 0.1050 },
  { ta: 'metabolic', indication: 'type2_diabetes', phase: 'phase3', modality: 'smallMolecule', npv: 373, pos: 0.5681, yrs: 5.50, dr: 0.0900 },
  { ta: 'metabolic', indication: 'type2_diabetes', phase: 'phase3', modality: 'mab', npv: 390, pos: 0.6135, yrs: 5.50, dr: 0.0900 },
  { ta: 'metabolic', indication: 'obesity', phase: 'phase1', modality: 'smallMolecule', npv: 185, pos: 0.2283, yrs: 9.50, dr: 0.1200 },
  { ta: 'metabolic', indication: 'obesity', phase: 'phase1', modality: 'mab', npv: 238, pos: 0.2876, yrs: 9.50, dr: 0.1200 },
  { ta: 'metabolic', indication: 'obesity', phase: 'phase2', modality: 'smallMolecule', npv: 568, pos: 0.3397, yrs: 8.00, dr: 0.1050 },
  { ta: 'metabolic', indication: 'obesity', phase: 'phase2', modality: 'mab', npv: 641, pos: 0.3962, yrs: 8.00, dr: 0.1050 },
  { ta: 'metabolic', indication: 'obesity', phase: 'phase3', modality: 'smallMolecule', npv: 1803, pos: 0.6533, yrs: 5.50, dr: 0.0900 },
  { ta: 'metabolic', indication: 'obesity', phase: 'phase3', modality: 'mab', npv: 1875, pos: 0.7055, yrs: 5.50, dr: 0.0900 },
  { ta: 'metabolic', indication: 'nash_mash', phase: 'phase1', modality: 'smallMolecule', npv: 25, pos: 0.1272, yrs: 9.50, dr: 0.1200 },
  { ta: 'metabolic', indication: 'nash_mash', phase: 'phase1', modality: 'mab', npv: 56, pos: 0.1603, yrs: 9.50, dr: 0.1200 },
  { ta: 'metabolic', indication: 'nash_mash', phase: 'phase2', modality: 'smallMolecule', npv: 273, pos: 0.2272, yrs: 8.00, dr: 0.1050 },
  { ta: 'metabolic', indication: 'nash_mash', phase: 'phase2', modality: 'mab', npv: 328, pos: 0.2650, yrs: 8.00, dr: 0.1050 },
  { ta: 'metabolic', indication: 'nash_mash', phase: 'phase3', modality: 'smallMolecule', npv: 1331, pos: 0.5681, yrs: 5.50, dr: 0.0900 },
  { ta: 'metabolic', indication: 'nash_mash', phase: 'phase3', modality: 'mab', npv: 1436, pos: 0.6135, yrs: 5.50, dr: 0.0900 },

  // ─── RARE DISEASE ───
  { ta: 'rareDisease', indication: 'dmd', phase: 'phase1', modality: 'smallMolecule', npv: 623, pos: 0.4316, yrs: 7.80, dr: 0.1500 },
  { ta: 'rareDisease', indication: 'dmd', phase: 'phase1', modality: 'mab', npv: 679, pos: 0.5034, yrs: 7.80, dr: 0.1500 },
  { ta: 'rareDisease', indication: 'dmd', phase: 'phase2', modality: 'smallMolecule', npv: 1179, pos: 0.5995, yrs: 6.30, dr: 0.1400 },
  { ta: 'rareDisease', indication: 'dmd', phase: 'phase2', modality: 'mab', npv: 1187, pos: 0.6474, yrs: 6.30, dr: 0.1400 },
  { ta: 'rareDisease', indication: 'dmd', phase: 'phase3', modality: 'smallMolecule', npv: 2533, pos: 0.7769, yrs: 4.30, dr: 0.1200 },
  { ta: 'rareDisease', indication: 'dmd', phase: 'phase3', modality: 'mab', npv: 2388, pos: 0.7769, yrs: 4.30, dr: 0.1200 },
  { ta: 'rareDisease', indication: 'cystic_fibrosis', phase: 'phase1', modality: 'smallMolecule', npv: 256, pos: 0.2570, yrs: 7.80, dr: 0.1500 },
  { ta: 'rareDisease', indication: 'cystic_fibrosis', phase: 'phase1', modality: 'mab', npv: 283, pos: 0.2997, yrs: 7.80, dr: 0.1500 },
  { ta: 'rareDisease', indication: 'cystic_fibrosis', phase: 'phase2', modality: 'smallMolecule', npv: 641, pos: 0.4282, yrs: 6.30, dr: 0.1400 },
  { ta: 'rareDisease', indication: 'cystic_fibrosis', phase: 'phase2', modality: 'mab', npv: 645, pos: 0.4625, yrs: 6.30, dr: 0.1400 },
  { ta: 'rareDisease', indication: 'cystic_fibrosis', phase: 'phase3', modality: 'smallMolecule', npv: 2028, pos: 0.7769, yrs: 4.30, dr: 0.1200 },
  { ta: 'rareDisease', indication: 'cystic_fibrosis', phase: 'phase3', modality: 'mab', npv: 1911, pos: 0.7769, yrs: 4.30, dr: 0.1200 },
  { ta: 'rareDisease', indication: 'sma', phase: 'phase1', modality: 'smallMolecule', npv: 594, pos: 0.4162, yrs: 7.80, dr: 0.1500 },
  { ta: 'rareDisease', indication: 'sma', phase: 'phase1', modality: 'mab', npv: 643, pos: 0.4855, yrs: 7.80, dr: 0.1500 },
  { ta: 'rareDisease', indication: 'sma', phase: 'phase2', modality: 'smallMolecule', npv: 1125, pos: 0.5781, yrs: 6.30, dr: 0.1400 },
  { ta: 'rareDisease', indication: 'sma', phase: 'phase2', modality: 'mab', npv: 1124, pos: 0.6243, yrs: 6.30, dr: 0.1400 },
  { ta: 'rareDisease', indication: 'sma', phase: 'phase3', modality: 'smallMolecule', npv: 2510, pos: 0.7769, yrs: 4.30, dr: 0.1200 },
  { ta: 'rareDisease', indication: 'sma', phase: 'phase3', modality: 'mab', npv: 2346, pos: 0.7769, yrs: 4.30, dr: 0.1200 },

  // ─── CARDIOVASCULAR ───
  { ta: 'cardiovascular', indication: 'heart_failure', phase: 'phase1', modality: 'smallMolecule', npv: -131, pos: 0.0793, yrs: 10.80, dr: 0.1300 },
  { ta: 'cardiovascular', indication: 'heart_failure', phase: 'phase1', modality: 'mab', npv: -128, pos: 0.1000, yrs: 10.80, dr: 0.1300 },
  { ta: 'cardiovascular', indication: 'heart_failure', phase: 'phase2', modality: 'smallMolecule', npv: -106, pos: 0.1587, yrs: 9.30, dr: 0.1150 },
  { ta: 'cardiovascular', indication: 'heart_failure', phase: 'phase2', modality: 'mab', npv: -99, pos: 0.1851, yrs: 9.30, dr: 0.1150 },
  { ta: 'cardiovascular', indication: 'heart_failure', phase: 'phase3', modality: 'smallMolecule', npv: 84, pos: 0.4960, yrs: 6.30, dr: 0.0950 },
  { ta: 'cardiovascular', indication: 'heart_failure', phase: 'phase3', modality: 'mab', npv: 111, pos: 0.5356, yrs: 6.30, dr: 0.0950 },
  { ta: 'cardiovascular', indication: 'pah', phase: 'phase1', modality: 'smallMolecule', npv: -87, pos: 0.0793, yrs: 10.80, dr: 0.1300 },
  { ta: 'cardiovascular', indication: 'pah', phase: 'phase1', modality: 'mab', npv: -78, pos: 0.1000, yrs: 10.80, dr: 0.1300 },
  { ta: 'cardiovascular', indication: 'pah', phase: 'phase2', modality: 'smallMolecule', npv: 16, pos: 0.1587, yrs: 9.30, dr: 0.1150 },
  { ta: 'cardiovascular', indication: 'pah', phase: 'phase2', modality: 'mab', npv: 30, pos: 0.1851, yrs: 9.30, dr: 0.1150 },
  { ta: 'cardiovascular', indication: 'pah', phase: 'phase3', modality: 'smallMolecule', npv: 749, pos: 0.4960, yrs: 6.30, dr: 0.0950 },
  { ta: 'cardiovascular', indication: 'pah', phase: 'phase3', modality: 'mab', npv: 770, pos: 0.5356, yrs: 6.30, dr: 0.0950 },
  { ta: 'cardiovascular', indication: 'hypercholesterolemia', phase: 'phase1', modality: 'smallMolecule', npv: -99, pos: 0.0793, yrs: 10.80, dr: 0.1300 },
  { ta: 'cardiovascular', indication: 'hypercholesterolemia', phase: 'phase1', modality: 'mab', npv: -91, pos: 0.1000, yrs: 10.80, dr: 0.1300 },
  { ta: 'cardiovascular', indication: 'hypercholesterolemia', phase: 'phase2', modality: 'smallMolecule', npv: -17, pos: 0.1587, yrs: 9.30, dr: 0.1150 },
  { ta: 'cardiovascular', indication: 'hypercholesterolemia', phase: 'phase2', modality: 'mab', npv: -2, pos: 0.1851, yrs: 9.30, dr: 0.1150 },
  { ta: 'cardiovascular', indication: 'hypercholesterolemia', phase: 'phase3', modality: 'smallMolecule', npv: 571, pos: 0.4960, yrs: 6.30, dr: 0.0950 },
  { ta: 'cardiovascular', indication: 'hypercholesterolemia', phase: 'phase3', modality: 'mab', npv: 609, pos: 0.5356, yrs: 6.30, dr: 0.0950 },
];

// ---------------------------------------------------------------------------
// Expand baselines into GoldenMaster records
// ---------------------------------------------------------------------------

function buildGoldenMasters(): GoldenMaster[] {
  return BASELINES.map((b) => {
    const designations = b.ta === 'rareDisease' ? rareDesignations : noDesignations;
    const posTol = b.ta === 'rareDisease' ? TOL_POS_RARE : TOL_POS;
    const npvTol = b.ta === 'rareDisease' && b.phase === 'phase3' ? TOL_NPV_RARE_P3 : TOL_NPV;
    return {
      name: `${b.ta} ${b.indication} ${b.phase} ${b.modality}`,
      input: makeInput({
        therapeuticArea: b.ta as RNPVInput['therapeuticArea'],
        phase: b.phase,
        modality: b.modality as RNPVInput['modality'],
        indication: b.indication,
        regulatoryDesignations: designations,
      }),
      expected: {
        riskAdjustedNPV: { value: b.npv, tolerance: npvTol },
        cumulativePoS: { value: b.pos, tolerance: posTol },
        yearsToMarket: { value: b.yrs, tolerance: TOL_YRS },
        discountRate: { value: b.dr, tolerance: TOL_DR },
      },
    };
  });
}

const GOLDEN_MASTERS: GoldenMaster[] = buildGoldenMasters();

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('Golden masters — canonical reference calculations', () => {
  test('expected matrix size = 108 (6 TAs × 3 indications × 3 phases × 2 modalities)', () => {
    expect(GOLDEN_MASTERS.length).toBe(108);
  });

  test('matrix covers every (ta, indication, phase, modality) combination exactly once', () => {
    const seen = new Set<string>();
    for (const gm of GOLDEN_MASTERS) {
      if (seen.has(gm.name)) throw new Error(`Duplicate golden master: ${gm.name}`);
      seen.add(gm.name);
    }
    expect(seen.size).toBe(108);
    for (const [ta, indications] of Object.entries(INDICATIONS_BY_TA)) {
      for (const indication of indications) {
        for (const phase of PHASES) {
          for (const modality of MODALITIES) {
            const name = `${ta} ${indication} ${phase} ${modality}`;
            if (!seen.has(name)) throw new Error(`Missing golden master: ${name}`);
          }
        }
      }
    }
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
