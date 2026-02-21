// Benchmark Auto-Recalibration Pipeline
// Queries the deals table, computes medians, and writes calibrated benchmark values to Supabase.

import staticBenchmarks from '@/data/benchmarks.json';

// Phase mapping: deals table -> benchmarks.json
const PHASE_MAP: Record<string, string> = {
  'discovery': 'preclinical',
  'preclinical': 'preclinical',
  'phase_1': 'phase1',
  'phase_2': 'phase2',
  'phase_3': 'phase3',
  'approved': 'approved',
};

// Modality mapping: deals table -> benchmarks.json
const MODALITY_MAP: Record<string, string> = {
  'small_molecule': 'smallMolecule',
  'antibody': 'mab',
  'adc': 'adc',
  'bispecific': 'bispecific',
  'car_t': 'carT_heme',
  'cell_therapy': 'cellTherapy',
  'gene_therapy': 'geneTherapy',
  'mrna': 'mrna',
  'radiopharm': 'radiopharmaceutical',
  'peptide': 'peptide',
  'oligonucleotide': 'oligonucleotide',
  'vaccine': 'therapeuticVaccine',
};

// Map therapeutic_area to the correct phase baselines key in benchmarks.json
const TA_BASELINES_KEY: Record<string, string> = {
  'oncology': 'phaseBaselines',
  'neurology': 'neurologyPhaseBaselines',
  'immunology': 'immunologyPhaseBaselines',
  'metabolic': 'metabolicPhaseBaselines',
};

export interface CalibrationOptions {
  minSampleSize?: number;  // default 5
  dryRun?: boolean;        // default false
}

interface CalibrationResult {
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
  deal_ids: string[];
  confidence_score: number;
  is_active: boolean;
}

interface CalibrationReport {
  phaseBaselinesUpdated: number;
  modalityMultipliersUpdated: number;
  skippedLowN: number;
  dryRunResults?: CalibrationResult[];
  errors: string[];
}

interface DealRow {
  id: string;
  upfront_usd: number | null;
  total_deal_value_usd: number | null;
  royalty_low_pct: number | null;
  royalty_high_pct: number | null;
  phase_at_signing: string | null;
  therapeutic_area: string | null;
  modality: string | null;
}

/**
 * Compute the p-th percentile of a sorted array using linear interpolation.
 */
function percentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

/**
 * Normalize a royalty value: if it's between 0 and 1 (exclusive), treat it as a decimal
 * and convert to percentage. E.g., 0.15 -> 15.
 */
function normalizeRoyalty(value: number | null): number | null {
  if (value === null || value === 0) return value;
  if (value > 0 && value <= 1) {
    return value * 100;
  }
  return value;
}

/**
 * Convert a USD value to $M (millions).
 */
function toMillions(value: number | null): number | null {
  if (value === null) return null;
  return value / 1_000_000;
}

/**
 * Round to 1 decimal place.
 */
function round1(value: number): number {
  return Math.round(value * 10) / 10;
}

/**
 * Look up the static benchmark value for a given TA + phase to use as a sanity check reference.
 */
function getStaticBaseline(therapeuticArea: string, phase: string): { upfrontMedian: number; totalValueMedian: number } | null {
  const baselinesKey = TA_BASELINES_KEY[therapeuticArea];
  if (!baselinesKey) return null;

  const baselines = (staticBenchmarks as Record<string, unknown>)[baselinesKey] as
    Record<string, { upfront: { median: number }; totalValue: { median: number } }> | undefined;
  if (!baselines || !baselines[phase]) return null;

  return {
    upfrontMedian: baselines[phase].upfront.median,
    totalValueMedian: baselines[phase].totalValue.median,
  };
}

/**
 * Run the benchmark calibration pipeline.
 *
 * 1. Queries deals with disclosed terms and high confidence
 * 2. Normalizes royalties and converts to $M
 * 3. Computes phase baseline calibrations (per TA + phase)
 * 4. Computes modality multiplier calibrations (per TA + modality)
 * 5. Writes results to benchmark_calibrations table (unless dryRun)
 * 6. Logs to data_ingestion_log
 */
export async function runBenchmarkCalibration(
  supabase: any,
  options?: CalibrationOptions
): Promise<CalibrationReport> {
  const minSampleSize = options?.minSampleSize ?? 5;
  const dryRun = options?.dryRun ?? false;

  const errors: string[] = [];
  let phaseBaselinesUpdated = 0;
  let modalityMultipliersUpdated = 0;
  let skippedLowN = 0;
  const allResults: CalibrationResult[] = [];

  console.log(`Starting benchmark calibration (minSampleSize=${minSampleSize}, dryRun=${dryRun})...`);

  // Step 1: Query all qualifying deals
  const { data: rawDeals, error: queryError } = await supabase
    .from('deals')
    .select('id, upfront_usd, total_deal_value_usd, royalty_low_pct, royalty_high_pct, phase_at_signing, therapeutic_area, modality')
    .eq('terms_disclosed', true)
    .gte('confidence_score', 75);

  if (queryError) {
    errors.push(`Failed to query deals: ${queryError.message}`);
    return { phaseBaselinesUpdated: 0, modalityMultipliersUpdated: 0, skippedLowN: 0, errors };
  }

  const deals: DealRow[] = rawDeals || [];
  console.log(`Queried ${deals.length} qualifying deals`);

  if (deals.length === 0) {
    errors.push('No qualifying deals found');
    return { phaseBaselinesUpdated: 0, modalityMultipliersUpdated: 0, skippedLowN: 0, errors };
  }

  // Step 2 & 3: Normalize and convert
  const normalizedDeals = deals.map(deal => ({
    ...deal,
    upfront_m: toMillions(deal.upfront_usd),
    total_value_m: toMillions(deal.total_deal_value_usd),
    royalty_low_norm: normalizeRoyalty(deal.royalty_low_pct),
    royalty_high_norm: normalizeRoyalty(deal.royalty_high_pct),
    mapped_phase: deal.phase_at_signing ? PHASE_MAP[deal.phase_at_signing] ?? null : null,
    mapped_modality: deal.modality ? MODALITY_MAP[deal.modality] ?? null : null,
  }));

  // ===== PHASE BASELINE CALIBRATION =====
  console.log('Computing phase baseline calibrations...');

  // Group deals by (therapeutic_area, mapped_phase)
  const phaseGroups = new Map<string, typeof normalizedDeals>();
  for (const deal of normalizedDeals) {
    if (!deal.therapeutic_area || !deal.mapped_phase) continue;
    const key = `${deal.therapeutic_area}|${deal.mapped_phase}`;
    if (!phaseGroups.has(key)) phaseGroups.set(key, []);
    phaseGroups.get(key)!.push(deal);
  }

  for (const [key, groupDeals] of phaseGroups) {
    const [therapeuticArea, phase] = key.split('|');

    if (groupDeals.length < minSampleSize) {
      skippedLowN++;
      console.log(`Skipping phase baseline ${key}: only ${groupDeals.length} deals (need ${minSampleSize})`);
      continue;
    }

    // Compute percentiles for upfront (in $M)
    const upfronts = groupDeals
      .map(d => d.upfront_m)
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b);

    // Compute percentiles for total value (in $M)
    const totalValues = groupDeals
      .map(d => d.total_value_m)
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b);

    // Compute royalty medians
    const royaltyLows = groupDeals
      .map(d => d.royalty_low_norm)
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b);

    const royaltyHighs = groupDeals
      .map(d => d.royalty_high_norm)
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b);

    const upfrontLow = upfronts.length > 0 ? round1(percentile(upfronts, 25)) : null;
    const upfrontMedian = upfronts.length > 0 ? round1(percentile(upfronts, 50)) : null;
    const upfrontHigh = upfronts.length > 0 ? round1(percentile(upfronts, 75)) : null;

    const totalValueLow = totalValues.length > 0 ? round1(percentile(totalValues, 25)) : null;
    const totalValueMedian = totalValues.length > 0 ? round1(percentile(totalValues, 50)) : null;
    const totalValueHigh = totalValues.length > 0 ? round1(percentile(totalValues, 75)) : null;

    const royaltyBase = royaltyLows.length > 0 ? round1(percentile(royaltyLows, 50)) : null;
    const royaltyMax = royaltyHighs.length > 0 ? round1(percentile(royaltyHighs, 50)) : null;

    // Sanity check against static benchmarks
    let confidenceScore = 85; // default high confidence
    const staticRef = getStaticBaseline(therapeuticArea, phase);
    if (staticRef && upfrontMedian !== null) {
      const upfrontRatio = upfrontMedian / staticRef.upfrontMedian;
      if (upfrontRatio > 3 || upfrontRatio < 1 / 3) {
        confidenceScore = 50; // flag divergence but still write
        console.warn(
          `Sanity check warning: ${key} upfront median $${upfrontMedian}M vs static $${staticRef.upfrontMedian}M (ratio: ${upfrontRatio.toFixed(2)})`
        );
      }
    }
    if (staticRef && totalValueMedian !== null) {
      const totalRatio = totalValueMedian / staticRef.totalValueMedian;
      if (totalRatio > 3 || totalRatio < 1 / 3) {
        confidenceScore = Math.min(confidenceScore, 50);
        console.warn(
          `Sanity check warning: ${key} total value median $${totalValueMedian}M vs static $${staticRef.totalValueMedian}M (ratio: ${totalRatio.toFixed(2)})`
        );
      }
    }

    const dealIds = groupDeals.map(d => d.id);

    const result: CalibrationResult = {
      calibration_type: 'phase_baseline',
      therapeutic_area: therapeuticArea,
      phase,
      modality: null,
      upfront_low: upfrontLow,
      upfront_median: upfrontMedian,
      upfront_high: upfrontHigh,
      total_value_low: totalValueLow,
      total_value_median: totalValueMedian,
      total_value_high: totalValueHigh,
      royalty_base: royaltyBase,
      royalty_max: royaltyMax,
      multiplier: null,
      sample_size: groupDeals.length,
      deal_ids: dealIds,
      confidence_score: confidenceScore,
      is_active: true,
    };

    allResults.push(result);

    if (!dryRun) {
      const { error: upsertError } = await supabase
        .from('benchmark_calibrations')
        .upsert(result, {
          onConflict: 'calibration_type,therapeutic_area,phase,modality',
        });

      if (upsertError) {
        errors.push(`Upsert error for phase baseline ${key}: ${upsertError.message}`);
      } else {
        phaseBaselinesUpdated++;
      }
    } else {
      phaseBaselinesUpdated++;
    }
  }

  // ===== MODALITY MULTIPLIER CALIBRATION =====
  console.log('Computing modality multiplier calibrations...');

  // Step 6: For each therapeutic_area, compute the overall median total_deal_value
  const taBaseMedians = new Map<string, number>();
  const taGroups = new Map<string, typeof normalizedDeals>();

  for (const deal of normalizedDeals) {
    if (!deal.therapeutic_area || deal.total_value_m === null) continue;
    if (!taGroups.has(deal.therapeutic_area)) taGroups.set(deal.therapeutic_area, []);
    taGroups.get(deal.therapeutic_area)!.push(deal);
  }

  for (const [ta, taDeals] of taGroups) {
    const totalValues = taDeals
      .map(d => d.total_value_m)
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b);

    if (totalValues.length > 0) {
      taBaseMedians.set(ta, percentile(totalValues, 50));
    }
  }

  // Step 7: Group by (therapeutic_area, mapped_modality) and compute multipliers
  const modalityGroups = new Map<string, typeof normalizedDeals>();
  for (const deal of normalizedDeals) {
    if (!deal.therapeutic_area || !deal.mapped_modality || deal.total_value_m === null) continue;
    const key = `${deal.therapeutic_area}|${deal.mapped_modality}`;
    if (!modalityGroups.has(key)) modalityGroups.set(key, []);
    modalityGroups.get(key)!.push(deal);
  }

  for (const [key, groupDeals] of modalityGroups) {
    const [therapeuticArea, modality] = key.split('|');

    if (groupDeals.length < minSampleSize) {
      skippedLowN++;
      console.log(`Skipping modality multiplier ${key}: only ${groupDeals.length} deals (need ${minSampleSize})`);
      continue;
    }

    const baseMedian = taBaseMedians.get(therapeuticArea);
    if (!baseMedian || baseMedian === 0) {
      errors.push(`No base median for TA ${therapeuticArea}, skipping modality ${modality}`);
      continue;
    }

    const modalityTotalValues = groupDeals
      .map(d => d.total_value_m)
      .filter((v): v is number => v !== null)
      .sort((a, b) => a - b);

    const modalityMedian = percentile(modalityTotalValues, 50);
    // Clamp multiplier to 0.3 - 3.0
    const rawMultiplier = modalityMedian / baseMedian;
    const clampedMultiplier = Math.round(Math.max(0.3, Math.min(3.0, rawMultiplier)) * 100) / 100;

    const dealIds = groupDeals.map(d => d.id);

    const result: CalibrationResult = {
      calibration_type: 'modality_multiplier',
      therapeutic_area: therapeuticArea,
      phase: null,
      modality,
      upfront_low: null,
      upfront_median: null,
      upfront_high: null,
      total_value_low: null,
      total_value_median: null,
      total_value_high: null,
      royalty_base: null,
      royalty_max: null,
      multiplier: clampedMultiplier,
      sample_size: groupDeals.length,
      deal_ids: dealIds,
      confidence_score: 80,
      is_active: true,
    };

    allResults.push(result);

    if (!dryRun) {
      const { error: upsertError } = await supabase
        .from('benchmark_calibrations')
        .upsert(result, {
          onConflict: 'calibration_type,therapeutic_area,phase,modality',
        });

      if (upsertError) {
        errors.push(`Upsert error for modality multiplier ${key}: ${upsertError.message}`);
      } else {
        modalityMultipliersUpdated++;
      }
    } else {
      modalityMultipliersUpdated++;
    }
  }

  // Step 10: Log to data_ingestion_log
  if (!dryRun) {
    const { error: logError } = await supabase
      .from('data_ingestion_log')
      .insert({
        source: 'benchmark_calibration',
        run_type: 'scheduled',
        parameters: {
          minSampleSize,
          dryRun,
          totalDealsQueried: deals.length,
        },
        completed_at: new Date().toISOString(),
        records_fetched: deals.length,
        records_processed: allResults.length,
        records_inserted: phaseBaselinesUpdated + modalityMultipliersUpdated,
        records_skipped: skippedLowN,
        records_failed: errors.length,
        errors: errors.slice(0, 50),
        status: errors.length > 0 ? 'partial' : 'completed',
      });

    if (logError) {
      errors.push(`Failed to write ingestion log: ${logError.message}`);
    }
  }

  console.log(
    `Benchmark calibration complete: ${phaseBaselinesUpdated} phase baselines, ` +
    `${modalityMultipliersUpdated} modality multipliers, ${skippedLowN} skipped (low N), ` +
    `${errors.length} errors`
  );

  const report: CalibrationReport = {
    phaseBaselinesUpdated,
    modalityMultipliersUpdated,
    skippedLowN,
    errors,
  };

  if (dryRun) {
    report.dryRunResults = allResults;
  }

  return report;
}
