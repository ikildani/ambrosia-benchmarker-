/**
 * Competitive Dynamics Calibration Tables
 *
 * Empirically-grounded parameters for modeling competitive erosion by
 * therapeutic area, modality, regulatory exclusivity, and competitive position.
 *
 * Sources:
 *   - IQVIA Channel Dynamics 2024 — competitive intensity by therapeutic area
 *   - EvaluatePharma World Preview 2024 — pipeline density analysis
 *   - Citeline/Norstella 2023 — time-to-second-entrant analysis
 *   - FDA Purple Book (2024) — biosimilar approval timelines
 *   - Nature Reviews Drug Discovery (Lo & Pisani 2019) — price erosion post-generic
 *   - Tufts CSDD Impact Report 2024 — orphan exclusivity effects
 *
 * @module lib/financial/competitive-calibration
 */

export interface CompetitiveIntensity {
  baseCompetitorCount: number;
  avgShareImpact: number;
  avgEntryLagYears: number;
  priceErosionPerEntrant: number;
  shareImpactStd: number;
}

/**
 * Base competitive intensity by therapeutic area.
 * Source: IQVIA/EvaluatePharma 2024 pipeline density analysis.
 */
export const COMPETITIVE_INTENSITY_BY_TA: Record<string, CompetitiveIntensity> = {
  oncology: { baseCompetitorCount: 5, avgShareImpact: 0.14, avgEntryLagYears: 1.5, priceErosionPerEntrant: 0.03, shareImpactStd: 0.04 },
  neurology: { baseCompetitorCount: 4, avgShareImpact: 0.15, avgEntryLagYears: 2.5, priceErosionPerEntrant: 0.04, shareImpactStd: 0.05 },
  immunology: { baseCompetitorCount: 5, avgShareImpact: 0.13, avgEntryLagYears: 2.0, priceErosionPerEntrant: 0.04, shareImpactStd: 0.04 },
  metabolic: { baseCompetitorCount: 5, avgShareImpact: 0.13, avgEntryLagYears: 1.5, priceErosionPerEntrant: 0.05, shareImpactStd: 0.05 },
  cardiovascular: { baseCompetitorCount: 4, avgShareImpact: 0.14, avgEntryLagYears: 3.0, priceErosionPerEntrant: 0.04, shareImpactStd: 0.04 },
  infectiousDisease: { baseCompetitorCount: 3, avgShareImpact: 0.16, avgEntryLagYears: 2.0, priceErosionPerEntrant: 0.05, shareImpactStd: 0.05 },
  rareDisease: { baseCompetitorCount: 2, avgShareImpact: 0.18, avgEntryLagYears: 4.0, priceErosionPerEntrant: 0.015, shareImpactStd: 0.06 },
  hematology: { baseCompetitorCount: 3, avgShareImpact: 0.15, avgEntryLagYears: 2.5, priceErosionPerEntrant: 0.03, shareImpactStd: 0.05 },
  dermatology: { baseCompetitorCount: 3, avgShareImpact: 0.15, avgEntryLagYears: 2.5, priceErosionPerEntrant: 0.04, shareImpactStd: 0.05 },
  ophthalmology: { baseCompetitorCount: 3, avgShareImpact: 0.16, avgEntryLagYears: 3.0, priceErosionPerEntrant: 0.03, shareImpactStd: 0.05 },
  gastroenterology: { baseCompetitorCount: 4, avgShareImpact: 0.14, avgEntryLagYears: 2.5, priceErosionPerEntrant: 0.04, shareImpactStd: 0.04 },
  womensHealth: { baseCompetitorCount: 2, avgShareImpact: 0.17, avgEntryLagYears: 3.0, priceErosionPerEntrant: 0.03, shareImpactStd: 0.05 },
};

export interface PositionModifier {
  competitorCountMultiplier: number;
  entryLagAdjustment: number;
  firstMoverShield: number;
  /** Minimum peak erosion floor — co-leaders should always predict at least this erosion */
  baseErosionFloor?: number;
}

export const POSITION_MODIFIERS: Record<string, PositionModifier> = {
  // Calibrated against historical outcomes (Keytruda, Ozempic, Dupixent, Tagrisso).
  // firstInClass assets with dominant market capture (e.g., Keytruda) maintain
  // 80-90% of their uncontested peak due to biomarker selection, label breadth,
  // and physician habit formation. The shield decays over 3 years post-launch.
  firstInClass:   { competitorCountMultiplier: 0.5,  entryLagAdjustment: 2.5,  firstMoverShield: 0.60 },
  firstToPivotal: { competitorCountMultiplier: 0.75, entryLagAdjustment: 1.25, firstMoverShield: 0.35 },
  bestInClass:    { competitorCountMultiplier: 0.85, entryLagAdjustment: 0.5,  firstMoverShield: 0.45 },
  co_leader:      { competitorCountMultiplier: 1.0,  entryLagAdjustment: 0.0,  firstMoverShield: 0.15, baseErosionFloor: 0.45 },
  leader:         { competitorCountMultiplier: 0.85, entryLagAdjustment: 1.0,  firstMoverShield: 0.35 },
  challenger:     { competitorCountMultiplier: 1.1,  entryLagAdjustment: -0.5, firstMoverShield: 0.10 },
  racing:         { competitorCountMultiplier: 1.2,  entryLagAdjustment: -0.5, firstMoverShield: 0.05 },
  behind:         { competitorCountMultiplier: 1.3,  entryLagAdjustment: -2.0, firstMoverShield: 0.0 },
  crowded:        { competitorCountMultiplier: 1.5,  entryLagAdjustment: -2.5, firstMoverShield: 0.0 },
};

/**
 * Modality-specific entry lag multipliers.
 * Biologics enjoy longer protection from biosimilar entry.
 * Source: FDA Purple Book 2024 — biosimilar approval timelines
 */
export const MODALITY_ENTRY_LAG_MULTIPLIER: Record<string, number> = {
  smallMolecule: 1.0,
  peptide: 1.1,
  oligonucleotide: 1.3,
  mab: 1.6,
  adc: 1.5,
  bispecific: 1.5,
  trispecificAntibody: 1.8,
  mrna: 1.3,
  gene_therapy: 2.0,
  geneTherapy: 2.0,
  cell_therapy: 1.8,
  cellTherapy: 1.8,
  car_t: 1.8,
  carT: 1.8,
  radiopharm: 1.4,
  vaccine: 1.2,
};

/**
 * Regulatory exclusivity delays (years).
 * Sources: FDA Orange/Purple Book, EMA orphan database, Tufts CSDD 2024.
 */
export const REGULATORY_EXCLUSIVITY_DELAY = {
  orphan: 2.5,
  breakthrough: 0.75,
  fastTrack: 0.5,
  prime: 0.5,
};

export const MAX_REG_DELAY = 4.0;

/**
 * Territorial entry lag adjustments (years added to competitor entry time).
 *
 * Competitors enter US first (largest market, fastest FDA pathway), then EU,
 * then Japan/China/ROW. A US-only deal sees faster competitive entry;
 * a global deal sees an effective weighted average lag.
 *
 * Source: IQVIA global launch analytics 2024 — median US→EU lag is ~1 year,
 * US→Japan ~2 years, US→China ~1.5 years.
 */
export const TERRITORIAL_ENTRY_LAG: Record<string, number> = {
  us: 0.0,
  eu: 1.0,
  japan: 2.0,
  china: 1.5,
  row: 2.5, // rest of world
};

/**
 * Global territory weights for computing effective entry lag.
 * Based on typical global pharma revenue distribution: US ~45%, EU ~25%, Japan ~10%, China ~10%, ROW ~10%.
 */
export const GLOBAL_TERRITORY_WEIGHTS = {
  us: 0.45,
  eu: 0.25,
  japan: 0.10,
  china: 0.10,
  row: 0.10,
} as const;

/**
 * Compute effective territorial entry lag for a given territory scope.
 * For 'global', returns the revenue-weighted average across all territories.
 */
export function getTerritorialEntryLag(territory: string | undefined): number {
  if (!territory) return 0;
  const t = territory.toLowerCase();
  if (t === 'global' || t === 'ww' || t === 'worldwide') {
    return Object.entries(GLOBAL_TERRITORY_WEIGHTS).reduce(
      (sum, [terr, weight]) => sum + (TERRITORIAL_ENTRY_LAG[terr] ?? 0) * weight,
      0,
    );
  }
  return TERRITORIAL_ENTRY_LAG[t] ?? 0;
}

export function getCompetitiveIntensity(therapeuticArea: string): CompetitiveIntensity {
  return COMPETITIVE_INTENSITY_BY_TA[therapeuticArea] ?? COMPETITIVE_INTENSITY_BY_TA.oncology;
}

export function getPositionModifier(position: string | undefined): PositionModifier {
  if (!position) return POSITION_MODIFIERS.racing;
  return POSITION_MODIFIERS[position] ?? POSITION_MODIFIERS.racing;
}

export function computeRegulatoryDelay(
  designations: { breakthrough?: boolean; fastTrack?: boolean; orphan?: boolean; prime?: boolean },
): number {
  let delay = 0;
  if (designations.orphan) delay += REGULATORY_EXCLUSIVITY_DELAY.orphan;
  if (designations.breakthrough) delay += REGULATORY_EXCLUSIVITY_DELAY.breakthrough;
  if (designations.fastTrack) delay += REGULATORY_EXCLUSIVITY_DELAY.fastTrack;
  if (designations.prime) delay += REGULATORY_EXCLUSIVITY_DELAY.prime;
  return Math.min(delay, MAX_REG_DELAY);
}

export function getModalityLagMultiplier(modality: string | undefined): number {
  if (!modality) return 1.0;
  return MODALITY_ENTRY_LAG_MULTIPLIER[modality] ?? 1.0;
}
