// Centralized Benchmark Data Accessor
// Merges static JSON defaults with live calibration data from Supabase.

import staticBenchmarksData from '@/data/benchmarks.json';
import { createClient } from '@supabase/supabase-js';

// Re-export static benchmarks for code that needs raw uncalibrated data
export const staticBenchmarks = staticBenchmarksData;

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

// Map therapeutic_area to the correct baselines key in benchmarks.json
const TA_BASELINES_KEY: Record<string, string> = {
  'oncology': 'phaseBaselines',
  'neurology': 'neurologyPhaseBaselines',
  'immunology': 'immunologyPhaseBaselines',
  'metabolic': 'metabolicPhaseBaselines',
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
export function getBenchmarksSync(): typeof staticBenchmarksData {
  const now = Date.now();

  // If cache is null or expired, trigger async refresh (fire-and-forget)
  if (calibrationCache === null || (now - cacheTimestamp) > CACHE_TTL_MS) {
    // Fire-and-forget: don't await
    refreshCalibrationCache().catch(() => {
      // Swallow errors — static defaults will be used
    });

    // If cache is completely null (never loaded), return static defaults
    if (calibrationCache === null) {
      return deepClone(staticBenchmarksData);
    }
  }

  // Deep clone static benchmarks to avoid mutation
  const merged = deepClone(staticBenchmarksData) as Record<string, unknown>;

  for (const cal of calibrationCache) {
    // Only apply calibrations with sufficient sample size
    if (cal.sample_size < 5) continue;

    if (cal.calibration_type === 'phase_baseline' && cal.phase && cal.therapeutic_area) {
      // Find the correct baselines key for this therapeutic area
      const baselinesKey = TA_BASELINES_KEY[cal.therapeutic_area];
      if (!baselinesKey) continue;

      const baselines = merged[baselinesKey] as Record<string, {
        upfront: { low: number; median: number; high: number };
        totalValue: { low: number; median: number; high: number };
        royalty: { base: number; max: number };
      }> | undefined;

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
      const modalities = merged['modalities'] as Record<string, {
        multiplier: number;
        label: string;
        context: string;
      }> | undefined;

      if (!modalities || !modalities[cal.modality]) continue;

      modalities[cal.modality].multiplier = cal.multiplier;
    }
  }

  return merged as typeof staticBenchmarksData;
}
