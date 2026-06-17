/**
 * Canonical TA (therapeutic area) adjacency map.
 *
 * Single source of truth — imported by comparableDeals.ts and pharma-intent.ts.
 * Adjacencies are symmetric: if A lists B, then B must list A.
 *
 * Sources: EvaluatePharma cross-TA deal analysis, FDA therapeutic area
 * classifications, clinical trial cross-listing patterns.
 */

export const TA_ADJACENCY: Record<string, string[]> = {
  oncology: ['hematology'],
  hematology: ['oncology', 'rareDisease'],
  immunology: ['gastroenterology', 'dermatology', 'rareDisease'],
  gastroenterology: ['immunology'],
  dermatology: ['immunology'],
  neurology: ['rareDisease', 'psychiatry'],
  metabolic: ['cardiovascular', 'endocrinology'],
  cardiovascular: ['metabolic'],
  rareDisease: ['hematology', 'neurology', 'immunology'],
  infectiousDisease: [],
  ophthalmology: [],
  womensHealth: [],
};
