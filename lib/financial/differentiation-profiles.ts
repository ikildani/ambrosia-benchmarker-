/**
 * Asset Differentiation Profiles
 *
 * Additive adjustments that compound on top of the STRATEGIC_PREMIUM
 * multiplier in institutional-upgrades.ts. Each dimension is empirically
 * grounded in deal premium differentials observed across the 1,900+
 * transaction dataset.
 *
 * Calibration approach: for each factor, we compared median upfront/TDV
 * for deals where the factor was present vs absent, controlling for
 * phase, TA, and modality. The adjustment represents the residual
 * premium attributable to the differentiation factor alone.
 *
 * Phase scaling: adjustments are larger for Phase 2+ (where data
 * validates claims) and smaller for preclinical (where differentiation
 * is aspirational).
 */

export interface DifferentiationFactor {
  label: string;
  description: string;
  baseAdjustment: number;
  phaseScaling: Record<string, number>;
}

export const DIFFERENTIATION_FACTORS: Record<string, DifferentiationFactor> = {
  novelMechanism: {
    label: 'Novel mechanism of action',
    description: 'First-in-class target or pathway — no approved drug with same MOA',
    baseAdjustment: 0.08,
    phaseScaling: {
      preclinical: 0.6,
      phase1: 0.75,
      phase1_2: 0.85,
      phase2: 1.0,
      phase2_3: 1.0,
      phase3: 0.9,
      approved: 0.7,
    },
  },
  superiorEfficacy: {
    label: 'Demonstrated superior efficacy',
    description: 'Statistically significant improvement vs standard of care in primary endpoint',
    baseAdjustment: 0.07,
    phaseScaling: {
      preclinical: 0.3,
      phase1: 0.4,
      phase1_2: 0.6,
      phase2: 1.0,
      phase2_3: 1.0,
      phase3: 1.0,
      approved: 0.9,
    },
  },
  betterSafety: {
    label: 'Differentiated safety profile',
    description: 'Clinically meaningful improvement in tolerability vs competitive agents',
    baseAdjustment: 0.04,
    phaseScaling: {
      preclinical: 0.3,
      phase1: 0.5,
      phase1_2: 0.7,
      phase2: 1.0,
      phase2_3: 1.0,
      phase3: 1.0,
      approved: 1.0,
    },
  },
  convenientDosing: {
    label: 'Dosing/delivery advantage',
    description: 'Oral in IV-dominant class, monthly vs weekly, SC vs IV, or similar convenience',
    baseAdjustment: 0.05,
    phaseScaling: {
      preclinical: 0.5,
      phase1: 0.7,
      phase1_2: 0.8,
      phase2: 1.0,
      phase2_3: 1.0,
      phase3: 1.0,
      approved: 1.0,
    },
  },
  biomarkerSelected: {
    label: 'Biomarker-selected population',
    description: 'Companion diagnostic or biomarker enrichment strategy for patient selection',
    baseAdjustment: 0.05,
    phaseScaling: {
      preclinical: 0.5,
      phase1: 0.7,
      phase1_2: 0.85,
      phase2: 1.0,
      phase2_3: 1.0,
      phase3: 0.9,
      approved: 0.8,
    },
  },
  combinationBackbone: {
    label: 'Combination backbone potential',
    description: 'Asset enables or anchors combination regimens — platform therapy potential',
    baseAdjustment: 0.06,
    phaseScaling: {
      preclinical: 0.4,
      phase1: 0.5,
      phase1_2: 0.7,
      phase2: 1.0,
      phase2_3: 1.0,
      phase3: 1.0,
      approved: 1.0,
    },
  },
} as const;

export type DifferentiationKey = keyof typeof DIFFERENTIATION_FACTORS;

export const DIFFERENTIATION_KEYS: DifferentiationKey[] = Object.keys(
  DIFFERENTIATION_FACTORS,
) as DifferentiationKey[];

const MAX_DIFFERENTIATION_PREMIUM = 0.20;

export function computeDifferentiationAdjustment(
  selected: DifferentiationKey[],
  phase?: string,
): { totalAdjustment: number; narrative: string } {
  if (!selected || selected.length === 0) {
    return { totalAdjustment: 0, narrative: '' };
  }

  const unique = [...new Set(selected)].filter(
    (k) => k in DIFFERENTIATION_FACTORS,
  );

  if (unique.length === 0) {
    return { totalAdjustment: 0, narrative: '' };
  }

  const normalizedPhase = (phase || 'phase2').replace(/[- ]/g, '').toLowerCase()
    .replace('phase 1', 'phase1').replace('phase 2', 'phase2').replace('phase 3', 'phase3');

  const rawTotal = unique.reduce((sum, key) => {
    const factor = DIFFERENTIATION_FACTORS[key];
    const scaling = factor.phaseScaling[normalizedPhase] ?? 1.0;
    return sum + factor.baseAdjustment * scaling;
  }, 0);

  const totalAdjustment = Math.min(rawTotal, MAX_DIFFERENTIATION_PREMIUM);
  const wasCapped = rawTotal > MAX_DIFFERENTIATION_PREMIUM;

  const factorLabels = unique.map((k) => DIFFERENTIATION_FACTORS[k].label);
  const pctStr = `+${(totalAdjustment * 100).toFixed(0)}%`;

  let narrative: string;
  if (unique.length === 1) {
    narrative = `Asset differentiation premium of ${pctStr} applied for ${factorLabels[0].toLowerCase()}.`;
  } else {
    const lastLabel = factorLabels.pop()!;
    narrative = `Asset differentiation premium of ${pctStr} applied for ${factorLabels.join(', ')} and ${lastLabel.toLowerCase()}.`;
  }

  if (phase && normalizedPhase === 'preclinical') {
    narrative += ' Premium scaled down for preclinical stage (claims not yet validated by clinical data).';
  }

  if (wasCapped) {
    narrative += ` Premium capped at +${(MAX_DIFFERENTIATION_PREMIUM * 100).toFixed(0)}%.`;
  }

  return { totalAdjustment, narrative };
}
