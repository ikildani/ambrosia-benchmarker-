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
  /** Provenance of the numbers above. Absent on static JSON baselines. */
  meta?: {
    sampleSize: number;
    calibratedAt: string | null;
    source: 'calibrated' | 'static';
  };
}

/** Phase baselines keyed by phase string. */
export type PhaseBaselines = Record<string, PhaseBaselineEntry>;

/** Shape of a single multiplier option (e.g. biomarker.selected). */
export interface MultiplierOption {
  multiplier: number;
  label: string;
  context?: string;
  /**
   * Territories only: share of worldwide sales, when it differs from the deal-value multiplier
   * (Greater China licenses pay well above China's share of revenue).
   */
  revenueShare?: number;
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
  /** TA-neutral modality multipliers (static JSON). Read through resolveModalityMultiplier, not directly. */
  modalities: Record<string, MultiplierOption>;
  /**
   * Static per-area modality overrides with evidence notes (e.g. oncology therapeutic vaccines).
   * A calibrated row for the same area and modality takes precedence.
   */
  modalityByTA?: Record<string, Record<string, MultiplierOption>>;
  /** Calibrated modality multipliers keyed by therapeutic area, then modality (filled by getBenchmarksSync). */
  calibratedModalityByTA?: Record<string, Record<string, { multiplier: number; sampleSize: number }>>;
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
    /**
     * R72: TA-specific overrides for competitive-position multipliers.
     * When a TA is present here (e.g., rareDisease), its entries take
     * precedence over the global competitivePosition map in lib/
     * calculations.ts. Currently only rareDisease is populated (FIC cap
     * because rare baselines already bake in FIC positioning). Other
     * TAs fall through to the global map unchanged.
     */
    competitivePositionByTA?: Record<string, MultiplierCategory>;
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
  calibrated_at?: string | null;
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
        'royalty_base, royalty_max, multiplier, sample_size, calibrated_at'
      )
      .eq('is_active', true);

    if (error) {
      // When PostgREST is unreachable the message is Cloudflare's full HTML error page
      // (Sep 25 2026: it repeated until the Vercel build log hit its 4 MB cap and hid
      // the real build error). Log the first line only.
      const msg = String(error.message ?? '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
      console.error('Failed to fetch calibration data:', msg || 'unknown error');
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
/**
 * Await the calibration overlay before the first calculation so that every
 * run in a session uses the same (calibrated) baselines. Without this, the
 * first calculateDealTerms() call in a fresh tab silently uses static JSON
 * while later calls use Supabase-calibrated values, and the same inputs
 * produce different numbers. Resolves immediately when the cache is warm.
 */
export async function ensureBenchmarksLoaded(): Promise<void> {
  const now = Date.now();
  if (calibrationCache !== null && (now - cacheTimestamp) <= CACHE_TTL_MS) return;
  try {
    await refreshCalibrationCache();
  } catch {
    // Static defaults remain in use; getBenchmarksSync() handles null cache.
  }
}

/**
 * Pin the calibration overlay to the given rows without Supabase (offline backtest, tests). The rows never expire,
 * so no refresh is attempted. Pass null to drop the pin and return to normal loading.
 */
export function setCalibrationRowsForTesting(rows: Array<Record<string, unknown>> | null): void {
  calibrationCache = rows === null ? null : ((rows as unknown) as CalibrationRow[]);
  cacheTimestamp = rows === null ? 0 : Number.POSITIVE_INFINITY;
}

/** Lowest calibrated modality multiplier applied (see getBenchmarksSync). */
export const MODALITY_MULTIPLIER_FLOOR = 0.6;

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

      // Carry provenance so the results page can say "n=40 deals, calibrated <date>".
      phaseData.meta = {
        sampleSize: cal.sample_size,
        calibratedAt: cal.calibrated_at ?? null,
        source: 'calibrated',
      };
    }

    if (cal.calibration_type === 'modality_multiplier' && cal.modality && cal.multiplier !== null && cal.therapeutic_area) {
      if (!merged.modalities[cal.modality]) continue;
      // Calibrated multipliers are measured per therapeutic area. Until Nov 23 2026 every row was written
      // onto the one TA-neutral map, so whichever area came back last won: oncology vaccines priced with
      // the infectious-disease vaccine multiplier (2.16, x8.5 the upfront actually paid) and every area's
      // antibodies with dermatology's 3.0. They are now kept per area and read by resolveModalityMultiplier.
      // The calibrated phase baselines already reflect each area's modality mix, so a raw multiplier
      // below MODALITY_MULTIPLIER_FLOOR double-counts it: small molecules priced at x0.46 of the upfront
      // actually paid on 121 global licenses (Nov 5 2026), x0.92 with the floor. No cap: raising the
      // ceiling or harmonising phase ladders (#110, reverted in #114) inflated late-stage terms 2-3x.
      const byTA = (merged.calibratedModalityByTA ??= {});
      (byTA[cal.therapeutic_area] ??= {})[cal.modality] = {
        multiplier: Math.max(MODALITY_MULTIPLIER_FLOOR, cal.multiplier),
        sampleSize: cal.sample_size,
      };
    }
  }

  for (const key of Object.keys(merged) as Array<keyof Benchmarks>) {
    if (/^(phaseBaselines|\w+PhaseBaselines)$/.test(String(key))) monotonePhaseLadder(merged[key] as unknown as PhaseBaselines);
  }

  return merged;
}

/**
 * The modality multiplier for one deal: the calibrated row for the deal's own therapeutic area, then a static
 * per-area override (modalityByTA), then the TA-neutral static multiplier. Never another area's calibration.
 */
export function resolveModalityMultiplier(
  b: Benchmarks,
  therapeuticArea: string | undefined,
  modality: string,
): { multiplier: number; label?: string; context?: string; source: 'calibrated' | 'area' | 'static' | 'none' } {
  const base = b.modalities[modality];
  const ta = therapeuticArea ?? 'oncology';
  const cal = b.calibratedModalityByTA?.[ta]?.[modality];
  if (cal && base) {
    return { multiplier: cal.multiplier, label: base.label, context: base.context, source: 'calibrated' };
  }
  const area = b.modalityByTA?.[ta]?.[modality];
  if (area) return { multiplier: area.multiplier, label: area.label ?? base?.label, context: area.context ?? base?.context, source: 'area' };
  if (base) return { multiplier: base.multiplier, label: base.label, context: base.context, source: 'static' };
  return { multiplier: 1, source: 'none' };
}

/** Development phases whose calibrated medians must not fall as a program advances. */
const LADDER_PHASES = ['preclinical', 'phase1', 'phase1_2', 'phase2', 'phase2_3', 'phase3'] as const;

function scaleEntry(e: PhaseBaselineEntry, part: 'upfront' | 'totalValue', median: number): void {
  const old = e[part].median;
  if (!(old > 0) || !(median > 0)) return;
  const f = median / old;
  const round = (x: number) => Math.round(x * 10) / 10;
  e[part] = { low: round(e[part].low * f), median: round(median), high: round(e[part].high * f) };
}

/**
 * Make one area's phase ladder monotone (mutates `baselines`). Calibrated cells come from small, differently
 * composed samples, and uncalibrated cells are static numbers on another scale, so the mixed ladder zig-zagged:
 * oncology ran preclinical $10M, Phase 1 $60M, Phase 1/2 $90M (static), Phase 2 $35M, Phase 2/3 $235M (static),
 * Phase 3 $98M, and a Phase 2 asset priced below a Phase 1 one.
 *
 *  1. Calibrated development-phase medians (upfront and total value separately) are fitted by weighted isotonic
 *     regression in log space (pool-adjacent-violators, weights = sample size). Violating neighbours are pooled
 *     to their weighted geometric mean, so the fit is not biased up or down. #110's "never fall" floor lifted
 *     every later cell to the highest earlier one, which is what inflated late-stage terms 2-3x.
 *  2. An uncalibrated half-step (Phase 1/2, Phase 2/3) between two calibrated phases takes their geometric mean.
 *  3. An uncalibrated discovery cell is capped at the preclinical value.
 * Low/high scale with the median. NDA-filed and approved cells are left alone: approved-asset deals are mostly
 * regional commercial licenses, a different population.
 */
export function monotonePhaseLadder(baselines: PhaseBaselines): void {
  if (!baselines) return;
  const isCal = (p: string) => baselines[p]?.meta?.source === 'calibrated';

  for (const part of ['upfront', 'totalValue'] as const) {
    // 1. Weighted PAV over calibrated cells, in ladder order.
    type Block = { phases: string[]; w: number; v: number };
    const blocks: Block[] = [];
    for (const p of LADDER_PHASES) {
      const e = baselines[p];
      if (!e || !isCal(p) || !(e[part].median > 0)) continue;
      blocks.push({ phases: [p], w: Math.max(1, e.meta?.sampleSize ?? 1), v: Math.log(e[part].median) });
      while (blocks.length > 1 && blocks[blocks.length - 2].v > blocks[blocks.length - 1].v) {
        const b = blocks.pop()!;
        const a = blocks.pop()!;
        blocks.push({ phases: [...a.phases, ...b.phases], w: a.w + b.w, v: (a.v * a.w + b.v * b.w) / (a.w + b.w) });
      }
    }
    for (const b of blocks) {
      if (b.phases.length < 2) continue;
      for (const p of b.phases) scaleEntry(baselines[p], part, Math.exp(b.v));
    }

    // 2. Uncalibrated half-steps between calibrated neighbours.
    for (const [half, prev, next] of [['phase1_2', 'phase1', 'phase2'], ['phase2_3', 'phase2', 'phase3']] as const) {
      const e = baselines[half];
      if (!e || isCal(half) || !isCal(prev) || !isCal(next)) continue;
      const a = baselines[prev][part];
      const c = baselines[next][part];
      const geo = (x: number, y: number) => Math.round(Math.sqrt(Math.max(x, 0) * Math.max(y, 0)) * 10) / 10;
      e[part] = { low: geo(a.low, c.low), median: geo(a.median, c.median), high: geo(a.high, c.high) };
    }

    // 3. Uncalibrated discovery never above preclinical.
    const disc = baselines.discovery;
    const pre = baselines.preclinical;
    if (disc && pre && !isCal('discovery') && disc[part].median > pre[part].median) scaleEntry(disc, part, pre[part].median);
  }
}
