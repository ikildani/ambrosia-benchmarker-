// Centralized Benchmark Data Accessor
// Merges static JSON defaults with live calibration data from Supabase.

import staticBenchmarksData from '@/data/benchmarks.json';
import { createClient } from '@supabase/supabase-js';

// ── Shared sub-types used across the Benchmarks interface ──────────────────

/** Shape of a single phase-baseline entry (upfront/totalValue/royalty). */
export interface PhaseBaselineEntry {
  upfront: { low: number; median: number; high: number };
  totalValue: { low: number; median: number; high: number };
  royalty: { base: number; max: number };
}

/** Phase baselines keyed by phase string. */
export type PhaseBaselines = Record<string, PhaseBaselineEntry>;

/** Shape of a single multiplier option (e.g. biomarker.selected). */
export interface MultiplierOption {
  multiplier: number;
  label: string;
  context?: string;
}

/** A multiplier config category is a map of option-key → MultiplierOption. */
export type MultiplierCategory = Record<string, MultiplierOption>;

/** Phase configuration block (range widths, upfront ratios, milestone allocations). */
export interface PhaseConfig {
  rangeWidths: Record<string, number>;
  upfrontRatios: Record<string, { low: number; high: number }>;
  milestoneAllocations: Record<string, { dev: number; reg: number; comm: number }>;
}

/** Shape of an interaction term entry. */
export interface InteractionTerm {
  bonus: number;
  context: string;
}

/** Neurology disease-modifying phase adjustment block. */
export interface NeurologyDMPhaseAdjustment {
  _description: string;
  milestoneRebalance: Record<string, { dev: number; reg: number; comm: number }>;
}

/** Full Benchmarks interface covering all keys in benchmarks.json. */
export interface Benchmarks {
  metadata: { version: string; lastUpdated: string; [key: string]: unknown };

  // Phase baselines per therapeutic area
  phaseBaselines: PhaseBaselines;
  neurologyPhaseBaselines: PhaseBaselines;
  immunologyPhaseBaselines: PhaseBaselines;
  metabolicPhaseBaselines: PhaseBaselines;
  cardiovascularPhaseBaselines: PhaseBaselines;
  infectiousDiseasePhaseBaselines: PhaseBaselines;
  ophthalmologyPhaseBaselines: PhaseBaselines;
  womensHealthPhaseBaselines: PhaseBaselines;
  rareDiseasePhaseBaselines: PhaseBaselines;
  rareDiseaseChronicPhaseBaselines: PhaseBaselines;
  rareDiseaseGeneTherapyPhaseBaselines: PhaseBaselines;
  hematologyPhaseBaselines: PhaseBaselines;
  dermatologyPhaseBaselines: PhaseBaselines;
  gastroenterologyPhaseBaselines: PhaseBaselines;

  // Phase config per therapeutic area
  phaseConfig: PhaseConfig;
  neurologyPhaseConfig: PhaseConfig;
  immunologyPhaseConfig: PhaseConfig;
  metabolicPhaseConfig: PhaseConfig;
  cardiovascularPhaseConfig: PhaseConfig;
  infectiousDiseasePhaseConfig: PhaseConfig;
  ophthalmologyPhaseConfig: PhaseConfig;
  womensHealthPhaseConfig: PhaseConfig;
  rareDiseasePhaseConfig: PhaseConfig;
  hematologyPhaseConfig: PhaseConfig;
  dermatologyPhaseConfig: PhaseConfig;
  gastroenterologyPhaseConfig: PhaseConfig;

  // Modalities & territories
  modalities: Record<string, MultiplierOption>;
  territories: Record<string, MultiplierOption>;

  // Indications by category
  indications: {
    solidTumor: Record<string, MultiplierOption>;
    hematologic: Record<string, MultiplierOption>;
    neurology: Record<string, MultiplierOption>;
    immunology: Record<string, MultiplierOption>;
    metabolic: Record<string, MultiplierOption>;
    cardiovascular: Record<string, MultiplierOption>;
    infectiousDisease: Record<string, MultiplierOption>;
    ophthalmology: Record<string, MultiplierOption>;
    womensHealth: Record<string, MultiplierOption>;
    rareDisease: Record<string, MultiplierOption>;
    hematology: Record<string, MultiplierOption>;
    dermatology: Record<string, MultiplierOption>;
    gastroenterology: Record<string, MultiplierOption>;
  };

  // Multiplier config — all 19 categories
  multiplierConfig: {
    biomarker: MultiplierCategory;
    lineOfTherapy: MultiplierCategory;
    combinationPotential: MultiplierCategory;
    competitivePosition: MultiplierCategory;
    dataQuality: MultiplierCategory;
    treatmentApproach: MultiplierCategory;
    bbbPenetration: MultiplierCategory;
    diseaseProgression: MultiplierCategory;
    biomarkerValidation: MultiplierCategory;
    regulatoryDesignations: {
      breakthrough: { bonus: number; label: string };
      fastTrack: { bonus: number; label: string };
      orphan: { bonus: number; label: string };
      prime: { bonus: number; label: string };
      maxBonus: number;
    };
    immuneResetPotential: MultiplierCategory;
    targetSpecificity: MultiplierCategory;
    diseaseSeverity: MultiplierCategory;
    treatmentGoal: MultiplierCategory;
    mechanismDifferentiation: MultiplierCategory;
    weightLossEfficacy: MultiplierCategory;
    routeOfAdministration: MultiplierCategory;
    comorbidityBreadth: MultiplierCategory;
    metabolicTreatmentApproach: MultiplierCategory;
    // Cardiovascular
    cvOutcomeBenefit: MultiplierCategory;
    cvTrialEndpoint: MultiplierCategory;
    cvPopulationRisk: MultiplierCategory;
    // Infectious Disease
    resistanceProfile: MultiplierCategory;
    infectionChronicity: MultiplierCategory;
    publicHealthPriority: MultiplierCategory;
    // Ophthalmology
    ocularDelivery: MultiplierCategory;
    treatmentDurability: MultiplierCategory;
    visionImpact: MultiplierCategory;
    // Women's Health
    whTargetPopulation: MultiplierCategory;
    whUnmetNeed: MultiplierCategory;
    whRegulatory: MultiplierCategory;
    // Rare Disease
    orphanDesignation: MultiplierCategory;
    patientPopulationSize: MultiplierCategory;
    geneticBasis: MultiplierCategory;
    // Hematology
    hemeLineage: MultiplierCategory;
    transplantEligibility: MultiplierCategory;
    mrdStatus: MultiplierCategory;
    // Dermatology
    skinSeverity: MultiplierCategory;
    chronicityProfile: MultiplierCategory;
    topicalVsSystemic: MultiplierCategory;
    // Gastroenterology
    giSegment: MultiplierCategory;
    biologicExperience: MultiplierCategory;
    endoscopicEndpoint: MultiplierCategory;
  };

  // Interaction terms and special adjustments
  interactionTerms: Record<string, InteractionTerm>;
  neurologyDiseaseModifyingPhaseAdjustment: NeurologyDMPhaseAdjustment;

  // Market context & labels (used by frontend)
  marketContext: {
    tooltips: Record<string, string>;
    negotiationInsights: Record<string, Record<string, string>>;
  };
  labels: {
    phases: Record<string, string>;
    metrics: Record<string, string>;
    rangeLabels: Record<string, string>;
  };
}

// Re-export static benchmarks for code that needs raw uncalibrated data
export const staticBenchmarks = staticBenchmarksData as unknown as Benchmarks;

// In-memory cache
let calibrationCache: CalibrationRow[] | null = null;
let cacheTimestamp = 0;
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

interface CalibrationRow {
  calibration_type: string;
  therapeutic_area: string;
  phase: string | null;
  modality: string | null;
  upfront_low: number | null;
  upfront_median: number | null;
  upfront_high: number | null;
  total_value_low: number | null;
  total_value_median: number | null;
  total_value_high: number | null;
  royalty_base: number | null;
  royalty_max: number | null;
  multiplier: number | null;
  sample_size: number;
}

// Map therapeutic_area to the correct baselines key in Benchmarks
type PhaseBaselinesKey = 'phaseBaselines' | 'neurologyPhaseBaselines' | 'immunologyPhaseBaselines' | 'metabolicPhaseBaselines' | 'cardiovascularPhaseBaselines' | 'infectiousDiseasePhaseBaselines' | 'ophthalmologyPhaseBaselines' | 'womensHealthPhaseBaselines' | 'rareDiseasePhaseBaselines' | 'rareDiseaseChronicPhaseBaselines' | 'rareDiseaseGeneTherapyPhaseBaselines' | 'hematologyPhaseBaselines' | 'dermatologyPhaseBaselines' | 'gastroenterologyPhaseBaselines';
const TA_BASELINES_KEY: Record<string, PhaseBaselinesKey> = {
  'oncology': 'phaseBaselines',
  'neurology': 'neurologyPhaseBaselines',
  'immunology': 'immunologyPhaseBaselines',
  'metabolic': 'metabolicPhaseBaselines',
  'cardiovascular': 'cardiovascularPhaseBaselines',
  'infectiousDisease': 'infectiousDiseasePhaseBaselines',
  'ophthalmology': 'ophthalmologyPhaseBaselines',
  'womensHealth': 'womensHealthPhaseBaselines',
  'rareDisease': 'rareDiseasePhaseBaselines',
  'hematology': 'hematologyPhaseBaselines',
  'dermatology': 'dermatologyPhaseBaselines',
  'gastroenterology': 'gastroenterologyPhaseBaselines',
};

/**
 * Fetch active calibrations from Supabase using the anon client (public read policy).
 * On failure, leaves cache as null so static defaults are used.
 */
export async function refreshCalibrationCache(): Promise<void> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      console.warn('Supabase env vars not configured, using static benchmarks');
      return;
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const { data, error } = await supabase
      .from('benchmark_calibrations')
      .select(
        'calibration_type, therapeutic_area, phase, modality, ' +
        'upfront_low, upfront_median, upfront_high, ' +
        'total_value_low, total_value_median, total_value_high, ' +
        'royalty_base, royalty_max, multiplier, sample_size'
      )
      .eq('is_active', true);

    if (error) {
      console.error('Failed to fetch calibration data:', error.message);
      return;
    }

    calibrationCache = (data as unknown) as CalibrationRow[];
    cacheTimestamp = Date.now();
    console.log(`Calibration cache refreshed: ${calibrationCache.length} active calibrations`);
  } catch (err) {
    console.error('Error refreshing calibration cache:', err);
    // Leave cache as null — static defaults will be used
  }
}

/**
 * Deep clone a JSON-serializable object.
 */
function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj));
}

/**
 * Get benchmarks with calibration overlays applied.
 *
 * This is synchronous. If the cache is null or expired, it triggers a
 * fire-and-forget refresh and returns static defaults for this call.
 *
 * Calibration overlays:
 * - phase_baseline: overrides TA-specific phase baselines (upfront, totalValue, royalty)
 * - modality_multiplier: overrides modalities[modality].multiplier
 *
 * Only calibrations with sample_size >= 5 are applied.
 */
export function getBenchmarksSync(): Benchmarks {
  const now = Date.now();

  // If cache is null or expired, trigger async refresh (fire-and-forget)
  if (calibrationCache === null || (now - cacheTimestamp) > CACHE_TTL_MS) {
    // Fire-and-forget: don't await
    refreshCalibrationCache().catch(() => {
      // Swallow errors — static defaults will be used
    });

    // If cache is completely null (never loaded), return static defaults
    if (calibrationCache === null) {
      return deepClone(staticBenchmarksData as unknown as Benchmarks);
    }
  }

  // Deep clone static benchmarks to avoid mutation
  const merged = deepClone(staticBenchmarksData as unknown as Benchmarks);

  for (const cal of calibrationCache) {
    // Only apply calibrations with sufficient sample size
    if (cal.sample_size < 5) continue;

    if (cal.calibration_type === 'phase_baseline' && cal.phase && cal.therapeutic_area) {
      // Find the correct baselines key for this therapeutic area.
      // For rareDisease, if modality is set, route to the chronic or
      // gene-therapy sub-baseline (mirrors the same modality-routing
      // used by the production quick-calculator in lib/calculations.ts).
      // Otherwise fall back to the base key.
      let baselinesKey: PhaseBaselinesKey | undefined = TA_BASELINES_KEY[cal.therapeutic_area];
      if (cal.therapeutic_area === 'rareDisease' && cal.modality) {
        if (cal.modality === 'geneTherapyRare' || cal.modality === 'geneTherapy') {
          baselinesKey = 'rareDiseaseGeneTherapyPhaseBaselines';
        } else if (cal.modality === 'enzymeReplacement' || cal.modality === 'substrateReduction' || cal.modality === 'smallMolecule') {
          baselinesKey = 'rareDiseaseChronicPhaseBaselines';
        }
      }
      if (!baselinesKey) continue;

      const baselines = merged[baselinesKey];
      if (!baselines || !baselines[cal.phase]) continue;

      const phaseData = baselines[cal.phase];

      // Override upfront values if calibration provides them
      if (cal.upfront_low !== null) phaseData.upfront.low = cal.upfront_low;
      if (cal.upfront_median !== null) phaseData.upfront.median = cal.upfront_median;
      if (cal.upfront_high !== null) phaseData.upfront.high = cal.upfront_high;

      // Override total value
      if (cal.total_value_low !== null) phaseData.totalValue.low = cal.total_value_low;
      if (cal.total_value_median !== null) phaseData.totalValue.median = cal.total_value_median;
      if (cal.total_value_high !== null) phaseData.totalValue.high = cal.total_value_high;

      // Override royalty
      if (cal.royalty_base !== null) phaseData.royalty.base = cal.royalty_base;
      if (cal.royalty_max !== null) phaseData.royalty.max = cal.royalty_max;
    }

    if (cal.calibration_type === 'modality_multiplier' && cal.modality && cal.multiplier !== null) {
      if (!merged.modalities[cal.modality]) continue;
      merged.modalities[cal.modality].multiplier = cal.multiplier;
    }
  }

  return merged;
}
