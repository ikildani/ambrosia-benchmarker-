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

/**
 * Parameters describing competitive intensity in a specific market segment.
 */
export interface CompetitiveIntensity {
  /** Expected number of meaningful competitors over the asset's lifetime */
  baseCompetitorCount: number;
  /** Average share taken per competitor at full ramp (0-1) */
  avgShareImpact: number;
  /** Average years from launch until first meaningful competitor */
  avgEntryLagYears: number;
  /** Price erosion per active competitor per year (0-1) */
  priceErosionPerEntrant: number;
  /** Standard deviation of share impact across entrants (for variance modeling) */
  shareImpactStd: number;
}

/**
 * Base competitive intensity by therapeutic area.
 *
 * Calibrated from IQVIA/EvaluatePharma 2024 pipeline density analysis.
 * Represents the "market standard" — modified downstream by competitive
 * position, modality, and regulatory designations.
 */
export const COMPETITIVE_INTENSITY_BY_TA: Record<string, CompetitiveIntensity> = {
  // Oncology: extremely crowded; checkpoint inhibitors, ADCs, TKIs, CAR-T all compete
  // Source: EvaluatePharma 2024 — oncology pipelines have 6-10 assets per indication
  oncology: {
    baseCompetitorCount: 5,
    avgShareImpact: 0.14,
    avgEntryLagYears: 1.5,
    priceErosionPerEntrant: 0.03,
    shareImpactStd: 0.04,
  },

  // Neurology: moderate to high; Alzheimer's and MS have dense pipelines
  // Source: Citeline 2024 — 3-6 assets competing per neurology indication
  neurology: {
    baseCompetitorCount: 4,
    avgShareImpact: 0.15,
    avgEntryLagYears: 2.5,
    priceErosionPerEntrant: 0.04,
    shareImpactStd: 0.05,
  },

  // Immunology: high intensity — JAK inhibitors, biologics, oral small molecules
  // Source: IQVIA 2024 — immunology pipelines have 5-8 assets per indication
  immunology: {
    baseCompetitorCount: 5,
    avgShareImpact: 0.13,
    avgEntryLagYears: 2.0,
    priceErosionPerEntrant: 0.04,
    shareImpactStd: 0.04,
  },

  // Metabolic: extremely crowded for GLP-1 class; moderate for specialty
  // Source: EvaluatePharma 2024 — GLP-1 class has 10+ assets in late stage
  metabolic: {
    baseCompetitorCount: 5,
    avgShareImpact: 0.13,
    avgEntryLagYears: 1.5,
    priceErosionPerEntrant: 0.05,
    shareImpactStd: 0.05,
  },

  // Cardiovascular: moderate; PCSK9, Factor Xa, SGLT2 classes have 3-5 competitors
  // Source: Nature Reviews 2023 — cardiovascular pipelines less dense than onco/immuno
  cardiovascular: {
    baseCompetitorCount: 4,
    avgShareImpact: 0.14,
    avgEntryLagYears: 3.0,
    priceErosionPerEntrant: 0.04,
    shareImpactStd: 0.04,
  },

  // Infectious disease: variable — outbreak drugs can see rapid entry; others slow
  // Source: WHO analysis 2024 — typical 3-5 assets per anti-infective class
  infectiousDisease: {
    baseCompetitorCount: 3,
    avgShareImpact: 0.16,
    avgEntryLagYears: 2.0,
    priceErosionPerEntrant: 0.05,
    shareImpactStd: 0.05,
  },

  // Rare disease: lowest intensity — orphan exclusivity protects many assets
  // Source: Tufts CSDD 2024 — 1-3 assets per rare disease indication
  rareDisease: {
    baseCompetitorCount: 2,
    avgShareImpact: 0.18,
    avgEntryLagYears: 4.0,
    priceErosionPerEntrant: 0.015,
    shareImpactStd: 0.06,
  },

  // Hematology: moderate; biomarker-driven segmentation limits head-to-head
  // Source: ASH 2024 — 3-5 assets per hematologic indication, often biomarker-gated
  hematology: {
    baseCompetitorCount: 3,
    avgShareImpact: 0.15,
    avgEntryLagYears: 2.5,
    priceErosionPerEntrant: 0.03,
    shareImpactStd: 0.05,
  },

  // Dermatology: moderate for Rx; Rx-to-OTC switches complicate dynamics
  // Source: AAD benchmarks 2024
  dermatology: {
    baseCompetitorCount: 3,
    avgShareImpact: 0.15,
    avgEntryLagYears: 2.5,
    priceErosionPerEntrant: 0.04,
    shareImpactStd: 0.05,
  },

  // Ophthalmology: moderate; VEGF class is crowded, others less so
  ophthalmology: {
    baseCompetitorCount: 3,
    avgShareImpact: 0.16,
    avgEntryLagYears: 3.0,
    priceErosionPerEntrant: 0.03,
    shareImpactStd: 0.05,
  },

  // Gastroenterology: moderate; IBD pipeline is dense, others variable
  gastroenterology: {
    baseCompetitorCount: 4,
    avgShareImpact: 0.14,
    avgEntryLagYears: 2.5,
    priceErosionPerEntrant: 0.04,
    shareImpactStd: 0.04,
  },

  // Women's health: lower intensity — underserved market, fewer competitors
  womensHealth: {
    baseCompetitorCount: 2,
    avgShareImpact: 0.17,
    avgEntryLagYears: 3.0,
    priceErosionPerEntrant: 0.03,
    shareImpactStd: 0.05,
  },
};

/**
 * Competitive position modifiers — how the asset's position affects the
 * number and timing of competing entrants.
 *
 * firstInClass gets fewer competitors and longer lag.
 * crowded gets more competitors entering earlier.
 */
export interface PositionModifier {
  /** Multiplier on baseCompetitorCount */
  competitorCountMultiplier: number;
  /** Additive adjustment to avgEntryLagYears (positive = later) */
  entryLagAdjustment: number;
  /** First-mover advantage — fraction of share protected from first entrant */
  firstMoverShield: number;
}

export const POSITION_MODIFIERS: Record<string, PositionModifier> = {
  // First-in-class: true pioneer. Fewer fast-followers, longer runway.
  firstInClass: {
    competitorCountMultiplier: 0.7,
    entryLagAdjustment: 1.5,
    firstMoverShield: 0.25,
  },
  // First-to-pivotal: leading but not first. Moderate protection.
  firstToPivotal: {
    competitorCountMultiplier: 0.85,
    entryLagAdjustment: 0.75,
    firstMoverShield: 0.15,
  },
  // Best-in-class: competing on differentiation. Normal market dynamics.
  bestInClass: {
    competitorCountMultiplier: 1.0,
    entryLagAdjustment: 0.0,
    firstMoverShield: 0.10,
  },
  // Co-leader: tied for leadership position.
  co_leader: {
    competitorCountMultiplier: 1.0,
    entryLagAdjustment: 0.0,
    firstMoverShield: 0.05,
  },
  // Leader: established leader in the space.
  leader: {
    competitorCountMultiplier: 0.9,
    entryLagAdjustment: 0.5,
    firstMoverShield: 0.15,
  },
  // Challenger: behind the leader, working to catch up.
  challenger: {
    competitorCountMultiplier: 1.1,
    entryLagAdjustment: -0.5,
    firstMoverShield: 0.05,
  },
  // Racing: multiple assets in similar dev stages competing for approval.
  racing: {
    competitorCountMultiplier: 1.2,
    entryLagAdjustment: -0.5,
    firstMoverShield: 0.0,
  },
  // Behind: late entrant with established competitors.
  behind: {
    competitorCountMultiplier: 1.3,
    entryLagAdjustment: -2.0,
    firstMoverShield: 0.0,
  },
  // Crowded: entering a very crowded market.
  crowded: {
    competitorCountMultiplier: 1.5,
    entryLagAdjustment: -2.5,
    firstMoverShield: 0.0,
  },
};

/**
 * Modality-specific adjustments to competitor entry lag.
 *
 * Biologics, cell therapies, and gene therapies enjoy longer protection
 * from biosimilars/copycats due to manufacturing complexity and regulatory
 * pathways. Small molecules face faster generic entry.
 *
 * Source: FDA Purple Book 2024 — biosimilar approval timelines
 */
export const MODALITY_ENTRY_LAG_MULTIPLIER: Record<string, number> = {
  smallMolecule: 1.0,
  peptide: 1.1,
  oligonucleotide: 1.3,
  mab: 1.6,           // Biosimilar lag typically 8-12 years post-approval
  adc: 1.5,           // Complex linker chemistry delays copycats
  bispecific: 1.5,
  mrna: 1.3,          // Newer class, evolving landscape
  gene_therapy: 2.0,  // 10+ year effective exclusivity
  cell_therapy: 1.8,  // Manufacturing complexity delays competitors
  car_t: 1.8,
  radiopharm: 1.4,    // Specialized manufacturing
  vaccine: 1.2,
};

/**
 * Regulatory designation exclusivity delays.
 *
 * Each designation adds years to the effective competitive entry lag.
 * These are ADDITIVE but capped at MAX_REG_DELAY.
 *
 * Source: FDA Orange Book/Purple Book, EMA orphan designation database
 */
export const REGULATORY_EXCLUSIVITY_DELAY = {
  /** US Orphan Drug Act: 7-year exclusivity + typical ~0.5yr effective protection uplift */
  orphan: 2.5,
  /** Breakthrough designation: accelerates YOUR review, creates de-facto first-mover protection */
  breakthrough: 0.75,
  /** Fast Track: moderate review acceleration */
  fastTrack: 0.5,
  /** PRIME (EMA breakthrough equivalent) */
  prime: 0.5,
};

/** Maximum regulatory delay (to prevent stacking to unrealistic values) */
export const MAX_REG_DELAY = 4.0;

/**
 * Look up competitive intensity for a TA, with fallback to oncology.
 */
export function getCompetitiveIntensity(therapeuticArea: string): CompetitiveIntensity {
  return COMPETITIVE_INTENSITY_BY_TA[therapeuticArea] ?? COMPETITIVE_INTENSITY_BY_TA.oncology;
}

/**
 * Look up position modifier with fallback to 'racing'.
 */
export function getPositionModifier(position: string | undefined): PositionModifier {
  if (!position) return POSITION_MODIFIERS.racing;
  return POSITION_MODIFIERS[position] ?? POSITION_MODIFIERS.racing;
}

/**
 * Compute total regulatory exclusivity delay (years) from designations.
 */
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

/**
 * Compute modality-specific entry lag multiplier with fallback to 1.0.
 */
export function getModalityLagMultiplier(modality: string | undefined): number {
  if (!modality) return 1.0;
  return MODALITY_ENTRY_LAG_MULTIPLIER[modality] ?? 1.0;
}
