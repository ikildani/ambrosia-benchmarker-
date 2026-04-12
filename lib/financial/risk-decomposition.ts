/**
 * Risk Decomposition (Tier 4 Item 11)
 *
 * Attributes the "risk wedge" (`unadjustedNPV - riskAdjustedNPV`) across four
 * buckets: clinical, commercial, manufacturing, regulatory — plus a bookkeeping
 * `other` residual so the sum always reconciles to the wedge within 10%.
 *
 * Methodology: counterfactual re-runs of `calculateRNPV` with specific risk
 * sources neutralized (via `RNPVInput.__internalFlags`). The marginal NPV
 * change attributable to each source becomes that bucket's impact.
 *
 * Recursion safety: every counterfactual call carries `skipDecomposition: true`.
 * The engine checks this flag before recursing, so the decomposer never calls
 * itself.
 *
 * @module lib/financial/risk-decomposition
 */

import type {
  RNPVInput,
  RNPVResult,
  RiskBucket,
  RiskDecomposition,
} from './types';

/** Zero-impact bucket placeholder used when no drivers apply. */
function emptyBucket(drivers: string[] = []): RiskBucket {
  return { impact_M: 0, percentOfTotal: 0, drivers };
}

/** Fully empty decomposition (used when the risk wedge is zero). */
function emptyDecomposition(): RiskDecomposition {
  return {
    clinical: emptyBucket(),
    commercial: emptyBucket(),
    manufacturing: emptyBucket(),
    regulatory: emptyBucket(),
    other: emptyBucket(),
    total_M: 0,
    reconciliationGap: 0,
  };
}

/**
 * Decompose the risk wedge into clinical / commercial / manufacturing /
 * regulatory / other buckets.
 *
 * @param input — the original RNPVInput (public API shape; no internal flags)
 * @param baselineResult — the baseline RNPVResult to attribute
 * @param calculateRNPV — function reference to the engine (passed to avoid
 *   circular imports — risk-decomposition.ts cannot import rnpv-engine.ts
 *   because rnpv-engine.ts imports this module)
 */
export function decomposeRisk(
  input: RNPVInput,
  baselineResult: RNPVResult,
  calculateRNPV: (input: RNPVInput) => RNPVResult,
): RiskDecomposition {
  const T = Math.max(0, baselineResult.unadjustedNPV - baselineResult.riskAdjustedNPV);

  // No wedge → nothing to decompose. Return zero-impact structure.
  if (T <= 0 || !Number.isFinite(T)) {
    return emptyDecomposition();
  }

  // ─── Clinical bucket ───
  // Strip all PoS uplifts (indication modifier, modality adjustment, biomarker,
  // regulatory designations). Remaining PoS is the pure TA×phase baseline —
  // unavoidable biology/trial risk. Impact = value destroyed by that baseline
  // attrition rate on the unadjusted NPV.
  const clinicalOnlyRun = calculateRNPV({
    ...input,
    __internalFlags: { clinicalOnlyPoS: true, skipDecomposition: true },
  });
  // The clinical bucket magnitude is the NPV destroyed purely by phase-transition
  // attrition — measured as unadjustedNPV × (1 − clinicalOnlyPoS).
  const clinicalPoS = clinicalOnlyRun.cumulativePoS;
  const clinical_M = Math.max(0, baselineResult.unadjustedNPV * (1 - clinicalPoS));
  const clinicalDrivers = [
    `TA-baseline PoS for ${input.therapeuticArea} ${input.phase}: ${(clinicalPoS * 100).toFixed(1)}%`,
    ...baselineResult.cashFlows.length > 0
      ? [`Phase transition attrition through ${input.phase}→approval`]
      : [],
  ];

  // ─── Manufacturing bucket ───
  // Strip MANUFACTURING_WACC_PREMIUM from the discount rate. If modality has
  // no premium (small molecule, mAb), the re-run equals the baseline → 0.
  const noMfgRun = calculateRNPV({
    ...input,
    __internalFlags: { skipMfgPremium: true, skipDecomposition: true },
  });
  const manufacturing_M = Math.max(0, noMfgRun.riskAdjustedNPV - baselineResult.riskAdjustedNPV);
  const manufacturingDrivers = manufacturing_M > 0
    ? [`${input.modality} WACC premium (higher discount rate for CMC-complex modalities)`]
    : [`${input.modality} has no CMC premium`];

  // ─── Regulatory bucket ───
  // Strip regulatory designations (breakthrough, fast-track, orphan, PRIME).
  // Bucket = NPV *lost* when designations are neutralized. If the asset has
  // no designations, baseline === neutralized → 0.
  const noRegRun = calculateRNPV({
    ...input,
    __internalFlags: { skipRegulatoryDesignations: true, skipDecomposition: true },
  });
  const regulatory_M = Math.max(0, baselineResult.riskAdjustedNPV - noRegRun.riskAdjustedNPV);
  const regDrivers: string[] = [];
  if (input.regulatoryDesignations?.breakthrough) regDrivers.push('breakthrough designation');
  if (input.regulatoryDesignations?.fastTrack) regDrivers.push('fast-track designation');
  if (input.regulatoryDesignations?.orphan) regDrivers.push('orphan designation');
  if (input.regulatoryDesignations?.prime) regDrivers.push('PRIME designation');
  const regulatoryDrivers = regDrivers.length > 0
    ? [`Value at risk if designations withdrawn: ${regDrivers.join(', ')}`]
    : ['No regulatory designations — baseline territory/pathway risk only'];

  // ─── Commercial bucket ───
  // Neutralize competitive density penalty, generic entrenchment, and market
  // access delay. Delta = value recovered if commercial headwinds vanish.
  const noCommercialRun = calculateRNPV({
    ...input,
    __internalFlags: {
      skipCompetitiveDensity: true,
      skipGenericEntrenchment: true,
      skipMarketAccessDelay: true,
      skipDecomposition: true,
    },
  });
  const commercial_M = Math.max(0, noCommercialRun.riskAdjustedNPV - baselineResult.riskAdjustedNPV);
  const commercialDrivers: string[] = [];
  if (baselineResult.modelAssumptions?.some(a => a.includes('Competitive density'))) {
    commercialDrivers.push('indication competitive density');
  }
  commercialDrivers.push(`${input.therapeuticArea} market access delay`);
  if (commercial_M > 0) {
    commercialDrivers.push('generic entrenchment / pricing pressure');
  }

  // ─── Reconciliation ───
  // The four counterfactual-based buckets usually don't sum to the wedge
  // exactly because (a) they overlap (e.g., WACC change shifts cash-flow
  // time value differently than PoS changes) and (b) rNPV is non-linear.
  // We cap each bucket at T to prevent any single bucket from exceeding the
  // total wedge, then route any shortfall/overage into `other`.
  const cappedClinical = Math.min(clinical_M, T);
  const cappedCommercial = Math.min(commercial_M, T);
  const cappedMfg = Math.min(manufacturing_M, T);
  const cappedReg = Math.min(regulatory_M, T);
  const subtotal = cappedClinical + cappedCommercial + cappedMfg + cappedReg;

  // If buckets over-claim, scale them down proportionally to leave room for
  // a small positive `other`. If they under-claim, `other` catches the gap.
  let scale = 1;
  if (subtotal > T && subtotal > 0) {
    // Reserve 5% of wedge for `other` so the residual isn't exactly zero.
    scale = (T * 0.95) / subtotal;
  }
  const scaledClinical = cappedClinical * scale;
  const scaledCommercial = cappedCommercial * scale;
  const scaledMfg = cappedMfg * scale;
  const scaledReg = cappedReg * scale;
  const accounted = scaledClinical + scaledCommercial + scaledMfg + scaledReg;
  const other_M = Math.max(0, T - accounted);

  const buckets = {
    clinical: { impact_M: scaledClinical, drivers: clinicalDrivers },
    commercial: { impact_M: scaledCommercial, drivers: commercialDrivers },
    manufacturing: { impact_M: scaledMfg, drivers: manufacturingDrivers },
    regulatory: { impact_M: scaledReg, drivers: regulatoryDrivers },
    other: { impact_M: other_M, drivers: ['non-attributed residual (model non-linearity)'] },
  };

  const total_M = scaledClinical + scaledCommercial + scaledMfg + scaledReg + other_M;
  const toBucket = (impact_M: number, drivers: string[]): RiskBucket => ({
    impact_M: Math.round(impact_M * 10) / 10,
    percentOfTotal: total_M > 0 ? impact_M / total_M : 0,
    drivers,
  });

  const reconciliationGap = total_M > 0 ? Math.abs(total_M - T) / total_M : 0;

  return {
    clinical: toBucket(buckets.clinical.impact_M, buckets.clinical.drivers),
    commercial: toBucket(buckets.commercial.impact_M, buckets.commercial.drivers),
    manufacturing: toBucket(buckets.manufacturing.impact_M, buckets.manufacturing.drivers),
    regulatory: toBucket(buckets.regulatory.impact_M, buckets.regulatory.drivers),
    other: toBucket(buckets.other.impact_M, buckets.other.drivers),
    total_M: Math.round(total_M * 10) / 10,
    reconciliationGap,
  };
}
