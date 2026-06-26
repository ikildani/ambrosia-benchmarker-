/**
 * Asset Differentiation Profiles
 *
 * Defines differentiation dimensions with additive adjustments that compound
 * on top of the existing STRATEGIC_PREMIUM multiplier in institutional-upgrades.ts
 * (firstInClass=1.25x, bestInClass=1.10x, racing=1.00x, behind=0.90x, crowded=0.80x).
 *
 * Each dimension is a boolean toggle with a small additive adjustment to the
 * strategic premium multiplier. Multiple dimensions can be selected and their
 * adjustments sum (capped at +0.20 / 20% max differentiation premium).
 *
 * Sources: DealForma 2020-2025 differentiation premium analysis,
 * Nature Reviews Drug Discovery 2023 first-in-class deal premia,
 * BioCentury 2024 deal multiples by differentiation factor.
 *
 * @module lib/financial/differentiation-profiles
 */

export const DIFFERENTIATION_FACTORS = {
  novelMechanism: {
    label: 'Novel mechanism of action',
    description: 'First-in-class target or pathway — no approved drug with same MOA',
    adjustment: 0.08,
  },
  superiorEfficacy: {
    label: 'Demonstrated superior efficacy',
    description: 'Statistically significant improvement vs standard of care in primary endpoint',
    adjustment: 0.06,
  },
  betterSafety: {
    label: 'Differentiated safety profile',
    description: 'Clinically meaningful improvement in tolerability vs competitive agents',
    adjustment: 0.04,
  },
  convenientDosing: {
    label: 'Dosing/delivery advantage',
    description: 'Oral in IV-dominant class, monthly vs weekly, SC vs IV, or similar convenience',
    adjustment: 0.05,
  },
  biomarkerSelected: {
    label: 'Biomarker-selected population',
    description: 'Companion diagnostic or biomarker enrichment strategy for patient selection',
    adjustment: 0.04,
  },
} as const;

export type DifferentiationKey = keyof typeof DIFFERENTIATION_FACTORS;

/** All valid differentiation keys for runtime validation */
export const DIFFERENTIATION_KEYS: DifferentiationKey[] = Object.keys(
  DIFFERENTIATION_FACTORS,
) as DifferentiationKey[];

/** Maximum total differentiation premium (cap at 20%) */
const MAX_DIFFERENTIATION_PREMIUM = 0.20;

/**
 * Compute the total differentiation adjustment and a narrative explaining it.
 *
 * @param selected - Array of selected differentiation factor keys
 * @returns totalAdjustment (additive to strategic premium multiplier) and narrative
 */
export function computeDifferentiationAdjustment(
  selected: DifferentiationKey[],
): { totalAdjustment: number; narrative: string } {
  if (!selected || selected.length === 0) {
    return { totalAdjustment: 0, narrative: '' };
  }

  // Deduplicate and validate
  const unique = [...new Set(selected)].filter(
    (k) => k in DIFFERENTIATION_FACTORS,
  );

  if (unique.length === 0) {
    return { totalAdjustment: 0, narrative: '' };
  }

  // Sum selected adjustments
  const rawTotal = unique.reduce(
    (sum, key) => sum + DIFFERENTIATION_FACTORS[key].adjustment,
    0,
  );

  // Cap at MAX_DIFFERENTIATION_PREMIUM
  const totalAdjustment = Math.min(rawTotal, MAX_DIFFERENTIATION_PREMIUM);
  const wasCapped = rawTotal > MAX_DIFFERENTIATION_PREMIUM;

  // Build narrative
  const factorLabels = unique.map((k) => DIFFERENTIATION_FACTORS[k].label);
  const pctStr = `+${(totalAdjustment * 100).toFixed(0)}%`;

  let narrative: string;
  if (unique.length === 1) {
    narrative = `Asset differentiation premium of ${pctStr} applied for ${factorLabels[0].toLowerCase()}.`;
  } else {
    const lastLabel = factorLabels.pop()!;
    narrative = `Asset differentiation premium of ${pctStr} applied for ${factorLabels.join(', ')} and ${lastLabel.toLowerCase()}.`;
  }

  if (wasCapped) {
    narrative += ` Premium capped at +${(MAX_DIFFERENTIATION_PREMIUM * 100).toFixed(0)}% (${unique.length} factors selected).`;
  }

  return { totalAdjustment, narrative };
}
