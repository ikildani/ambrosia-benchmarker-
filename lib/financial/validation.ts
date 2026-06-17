/**
 * Input validation schemas for the financial modeling engine.
 *
 * Uses Zod for runtime type validation at system boundaries.
 * All financial engine functions should validate inputs before processing
 * to prevent silent failures from malformed data.
 *
 * @module lib/financial/validation
 */

import { z } from 'zod';
import { INDICATION_CATALOG } from './indication-tier3-calibration';

/** Valid therapeutic areas */
const therapeuticAreas = [
  'oncology', 'neurology', 'immunology', 'metabolic',
  'cardiovascular', 'infectiousDisease', 'ophthalmology', 'womensHealth',
  'rareDisease', 'hematology', 'dermatology', 'gastroenterology',
] as const;

/** Valid development phases */
const phases = ['discovery', 'preclinical', 'phase1', 'phase1_2', 'phase2', 'phase2_3', 'phase3', 'nda_filed', 'approved'] as const;

/** Valid territories */
const territories = [
  'global', 'us_only', 'europe', 'china', 'japan',
  'ex_us', 'row', 'us_eu', 'us_japan',
  'canada', 'australia', 'south_korea', 'apac_ex_cj', 'latam', 'mena',
] as const;

/** Range schema (low/median/high) with positive values */
const positiveRange = z.object({
  low: z.number().min(0, 'Low estimate must be non-negative'),
  median: z.number().min(0, 'Median estimate must be non-negative'),
  high: z.number().min(0, 'High estimate must be non-negative'),
}).refine(
  (r) => r.low <= r.median && r.median <= r.high,
  { message: 'Range must satisfy: low <= median <= high' }
);

/** rNPV input validation schema */
export const RNPVInputSchema = z.object({
  phase: z.enum(phases, { error: `Phase must be one of: ${phases.join(', ')}` }),
  therapeuticArea: z.enum(therapeuticAreas, { error: `Therapeutic area must be one of: ${therapeuticAreas.join(', ')}` }),
  modality: z.string().min(1, 'Modality is required'),
  indication: z.string().min(1, 'Indication is required'),
  territory: z.enum(territories, { error: `Territory must be one of: ${territories.join(', ')}` }),
  peakSalesEstimate: positiveRange,
  competitivePosition: z.string().min(1),
  dataQuality: z.string().min(1),
  biomarkerStatus: z.string().optional(),
  regulatoryDesignations: z.object({
    breakthrough: z.boolean(),
    fastTrack: z.boolean(),
    orphan: z.boolean(),
    prime: z.boolean(),
  }),
  discountRate: z.number().min(0.01, 'Discount rate must be >= 1%').max(0.40, 'Discount rate must be <= 40%').optional(),
  benchmarkDealValue: positiveRange.optional(),
});

/** Monte Carlo input validation schema */
export const MonteCarloInputSchema = z.object({
  rnpvInput: RNPVInputSchema,
  iterations: z.number().int().min(100).max(100_000).optional(),
  posVariation: z.number().min(0).max(1).optional(),
  peakSalesVariation: z.number().min(0).max(2).optional(),
  discountRateVariation: z.number().min(0).max(0.10).optional(),
  timeToMarketVariation: z.number().min(0).max(5).optional(),
  pricingVariation: z.number().min(0).max(1).optional(),
});

/** Epidemiology data validation schema */
export const EpidemiologyDataSchema = z.object({
  prevalencePerMillion: z.number().min(0),
  incidencePerMillion: z.number().min(0),
  diagnosedPercent: z.number().min(0).max(1),
  treatedPercent: z.number().min(0).max(1),
  drugEligiblePercent: z.number().min(0).max(1),
  annualCostOfTherapy: z.number().min(0),
  sources: z.array(z.string()),
});

// ---------------------------------------------------------------------------
// Cross-field validation: indication ↔ therapeutic area
// ---------------------------------------------------------------------------

const indicationToTAs: Map<string, string[]> = new Map();
for (const [ta, indications] of Object.entries(INDICATION_CATALOG)) {
  for (const ind of indications) {
    const existing = indicationToTAs.get(ind) ?? [];
    existing.push(ta);
    indicationToTAs.set(ind, existing);
  }
}

/**
 * Check whether an indication belongs to the given therapeutic area.
 * Returns null if valid (or indication not in catalog), or a warning string.
 */
export function validateIndicationTA(indication: string, therapeuticArea: string): string | null {
  const validTAs = indicationToTAs.get(indication);
  if (!validTAs) return null;
  if (validTAs.includes(therapeuticArea)) return null;
  return `Indication '${indication}' belongs to ${validTAs.join('/')} but was submitted with therapeutic area '${therapeuticArea}'`;
}

/**
 * Validate rNPV input and return cleaned data or throw descriptive error.
 * Call this at the entry point of calculateRNPV and runMonteCarlo.
 */
export function validateRNPVInput(input: unknown): z.infer<typeof RNPVInputSchema> {
  return RNPVInputSchema.parse(input);
}

/**
 * Safe validation that returns result instead of throwing.
 * Useful for UI form validation where you want to show errors.
 */
export function safeValidateRNPVInput(input: unknown): { success: true; data: z.infer<typeof RNPVInputSchema> } | { success: false; errors: string[] } {
  const result = RNPVInputSchema.safeParse(input);
  if (result.success) return { success: true, data: result.data };
  return { success: false, errors: result.error.issues.map((e) => `${e.path.join('.')}: ${e.message}`) };
}
