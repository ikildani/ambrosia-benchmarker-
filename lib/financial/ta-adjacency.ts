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
  oncology: ['hematology', 'womensHealth'],
  hematology: ['oncology', 'rareDisease'],
  immunology: ['gastroenterology', 'dermatology', 'rareDisease', 'infectiousDisease', 'womensHealth'],
  gastroenterology: ['immunology'],
  dermatology: ['immunology'],
  neurology: ['rareDisease', 'psychiatry', 'ophthalmology'],
  metabolic: ['cardiovascular', 'endocrinology'],
  cardiovascular: ['metabolic'],
  rareDisease: ['hematology', 'neurology', 'immunology', 'infectiousDisease', 'ophthalmology'],
  infectiousDisease: ['immunology', 'rareDisease'],
  ophthalmology: ['rareDisease', 'neurology'],
  womensHealth: ['oncology', 'immunology'],
};
