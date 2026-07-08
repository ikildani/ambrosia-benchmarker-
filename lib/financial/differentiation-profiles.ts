/**
 * Asset Differentiation Profiles
 *
 * Additive adjustments that compound on top of the STRATEGIC_PREMIUM
 * multiplier in institutional-upgrades.ts. Each dimension is empirically
 * grounded in deal premium differentials observed across the full deal corpus (see DEAL_STATS in constants.ts).
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

export const MAX_DIFFERENTIATION_PREMIUM = 0.20;

/** Phase normalization — canonical mapping from any phase string variant */
const PHASE_MAP: Record<string, string> = {
  discovery: 'preclinical', preclinical: 'preclinical',
  phase1: 'phase1', 'phase 1': 'phase1', phase_1: 'phase1',
  phase1_2: 'phase1_2', 'phase 1/2': 'phase1_2',
  phase2: 'phase2', 'phase 2': 'phase2', phase_2: 'phase2',
  phase2_3: 'phase2_3', 'phase 2/3': 'phase2_3',
  phase3: 'phase3', 'phase 3': 'phase3', phase_3: 'phase3',
  nda_filed: 'phase3', approved: 'approved',
};

function normalizePhase(phase?: string): string {
  if (!phase) return 'phase2';
  const key = phase.replace(/[_-]/g, '').toLowerCase();
  return PHASE_MAP[key] ?? PHASE_MAP[phase.toLowerCase()] ?? 'phase2';
}

/** Per-factor breakdown returned by computeDifferentiationAdjustment */
export interface DifferentiationFactorBreakdown {
  key: DifferentiationKey;
  label: string;
  baseAdjustment: number;
  phaseScaling: number;
  effectiveAdjustment: number;
}

/** Validation warnings for unrealistic factor selections */
export interface DifferentiationWarning {
  factorKey: DifferentiationKey;
  message: string;
  severity: 'warning' | 'info';
}

/** Validate factor selections against phase realism */
export function validateDifferentiationFactors(
  selected: DifferentiationKey[],
  phase?: string,
): DifferentiationWarning[] {
  const warnings: DifferentiationWarning[] = [];
  const norm = normalizePhase(phase);
  const isEarly = norm === 'preclinical' || norm === 'phase1';

  if (selected.includes('superiorEfficacy') && isEarly) {
    warnings.push({
      factorKey: 'superiorEfficacy',
      message: `Superior efficacy is unverifiable at ${norm === 'preclinical' ? 'preclinical' : 'Phase 1'} — no comparative clinical data exists. Premium scaled to ${(DIFFERENTIATION_FACTORS.superiorEfficacy.phaseScaling[norm] * 100).toFixed(0)}%.`,
      severity: 'warning',
    });
  }

  if (selected.includes('betterSafety') && norm === 'preclinical') {
    warnings.push({
      factorKey: 'betterSafety',
      message: 'Safety differentiation cannot be established before first-in-human dosing. Premium scaled to 30%.',
      severity: 'warning',
    });
  }

  if (selected.includes('novelMechanism') && selected.includes('superiorEfficacy') && isEarly) {
    warnings.push({
      factorKey: 'superiorEfficacy',
      message: 'Novel mechanism and superior efficacy are often correlated — buyers may not credit both at this stage.',
      severity: 'info',
    });
  }

  return warnings;
}

export interface DifferentiationResult {
  totalAdjustment: number;
  rawTotal: number;
  wasCapped: boolean;
  narrative: string;
  factorBreakdown: DifferentiationFactorBreakdown[];
  warnings: DifferentiationWarning[];
}

export function computeDifferentiationAdjustment(
  selected: DifferentiationKey[],
  phase?: string,
): DifferentiationResult {
  const empty: DifferentiationResult = { totalAdjustment: 0, rawTotal: 0, wasCapped: false, narrative: '', factorBreakdown: [], warnings: [] };

  if (!selected || selected.length === 0) return empty;

  const unique = [...new Set(selected)].filter(
    (k) => k in DIFFERENTIATION_FACTORS,
  );

  if (unique.length === 0) return empty;

  const norm = normalizePhase(phase);

  const factorBreakdown: DifferentiationFactorBreakdown[] = unique.map((key) => {
    const factor = DIFFERENTIATION_FACTORS[key];
    const scaling = factor.phaseScaling[norm] ?? 1.0;
    return {
      key,
      label: factor.label,
      baseAdjustment: factor.baseAdjustment,
      phaseScaling: scaling,
      effectiveAdjustment: factor.baseAdjustment * scaling,
    };
  });

  const rawTotal = factorBreakdown.reduce((sum, f) => sum + f.effectiveAdjustment, 0);
  const totalAdjustment = Math.min(rawTotal, MAX_DIFFERENTIATION_PREMIUM);
  const wasCapped = rawTotal > MAX_DIFFERENTIATION_PREMIUM;

  const factorLabels = unique.map((k) => DIFFERENTIATION_FACTORS[k].label);
  const pctStr = `+${(totalAdjustment * 100).toFixed(0)}%`;

  let narrative: string;
  if (unique.length === 1) {
    narrative = `Asset differentiation premium of ${pctStr} applied for ${factorLabels[0].toLowerCase()}.`;
  } else {
    const allLabels = [...factorLabels];
    const lastLabel = allLabels.pop()!;
    narrative = `Asset differentiation premium of ${pctStr} applied for ${allLabels.join(', ')} and ${lastLabel.toLowerCase()}.`;
  }

  if (phase && norm === 'preclinical') {
    narrative += ' Premium scaled down for preclinical stage (claims not yet validated by clinical data).';
  }

  if (wasCapped) {
    narrative += ` Premium capped at +${(MAX_DIFFERENTIATION_PREMIUM * 100).toFixed(0)}%.`;
  }

  const warnings = validateDifferentiationFactors(unique, phase);

  return { totalAdjustment, rawTotal, wasCapped, narrative, factorBreakdown, warnings };
}
