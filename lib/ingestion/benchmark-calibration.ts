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

/** Ids of client-reported observations carry this prefix and are never written to deal_ids. */
export const OBSERVATION_ID_PREFIX = 'outcome_';

export function isObservationId(id: string | null | undefined): boolean {
  return typeof id === 'string' && id.startsWith(OBSERVATION_ID_PREFIX);
}

export interface CalibrationOptions {
  minSampleSize?: number;  // default 5
  dryRun?: boolean;        // default false
  /**
   * Client-reported outcomes (lib/outcomes/priors.ts observationsToDealRows)
   * appended to the phase-baseline grouping. Guarded: a cell needs
   * `minSampleSize` public deals before any observation counts, observations
   * are capped at `maxObservationShare` of the cell, and their ids never reach
   * `deal_ids`.
   */
  extraObservations?: DealRow[];
  /** Maximum share of a cell's rows that may be client observations. Default 0.5. */
  maxObservationShare?: number;
}

export interface CalibrationResult {
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
  /** Set only when client observations shaped this run (previous max + 1). */
  version?: number;
}

export interface CalibrationReport {
  phaseBaselinesUpdated: number;
  modalityMultipliersUpdated: number;
  skippedLowN: number;
  dryRunResults?: CalibrationResult[];
  errors: string[];
  /** Client observations that entered a phase-baseline cell. */
  observationsUsed: number;
  /** Phase-baseline cells that used at least one client observation. */
  cellsWithObservations: number;
  /** Per-cell notes about the observations used (also written to outcome_prior_runs). */
  priorNotes: string[];
  /** benchmark_calibrations.version written this run (null when unchanged). */
  version: number | null;
}

/** Subset of `deals` columns the calibration groups on. */
export interface DealRow {
  id: string;
  upfront_usd: number | null;
  total_deal_value_usd: number | null;
  royalty_low_pct: number | null;
  royalty_high_pct: number | null;
  phase_at_signing: string | null;
  therapeutic_area: string | null;
  modality: string | null;
  /** Only used to order client observations when a cell is over its cap (newest kept). */
  announced_date?: string | null;
}

type NormalizedDeal = DealRow & {
  upfront_m: number | null;
  total_value_m: number | null;
  royalty_low_norm: number | null;
  royalty_high_norm: number | null;
  mapped_phase: string | null;
  mapped_modality: string | null;
};

function normalizeDeal(deal: DealRow): NormalizedDeal {
  return {
    ...deal,
    upfront_m: toMillions(deal.upfront_usd),
    total_value_m: toMillions(deal.total_deal_value_usd),
    royalty_low_norm: normalizeRoyalty(deal.royalty_low_pct),
    royalty_high_norm: normalizeRoyalty(deal.royalty_high_pct),
    mapped_phase: deal.phase_at_signing ? PHASE_MAP[deal.phase_at_signing] ?? null : null,
    mapped_modality: deal.modality ? MODALITY_MAP[deal.modality] ?? null : null,
  };
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

export interface PhaseBaselineOptions {
  minSampleSize?: number;        // default 5 — also the k-anonymity floor for public deals per cell
  extraObservations?: DealRow[]; // client observations (ids prefixed outcome_)
  maxObservationShare?: number;  // default 0.5
}

export interface PhaseBaselineOutput {
  results: CalibrationResult[];
  skippedLowN: number;
  observationsUsed: number;
  cellsWithObservations: number;
  notes: string[];
}

function sortedValues(rows: NormalizedDeal[], pick: (d: NormalizedDeal) => number | null): number[] {
  return rows.map(pick).filter((v): v is number => v !== null).sort((a, b) => a - b);
}

/**
 * Pure: phase-baseline calibrations per (therapeutic_area, phase) cell.
 *
 * `rows` are public deals; `options.extraObservations` are client-reported
 * outcomes mapped to the same shape. Any row whose id carries the
 * `outcome_` prefix is treated as an observation wherever it arrives.
 *
 * Guards (benchmark_calibrations is public-read, so k-anonymity matters):
 *   - a cell needs ≥ minSampleSize PUBLIC deals before any observation counts;
 *   - observations are capped at maxObservationShare of the cell (newest kept);
 *   - deal_ids only ever contain public deal ids; sample_size counts both.
 */
export function computePhaseBaselines(rows: DealRow[], options: PhaseBaselineOptions = {}): PhaseBaselineOutput {
  const minSampleSize = options.minSampleSize ?? 5;
  const share = Math.min(0.9, Math.max(0, options.maxObservationShare ?? 0.5));
  const publicDeals: NormalizedDeal[] = [];
  const observations: NormalizedDeal[] = [];
  for (const r of [...rows, ...(options.extraObservations ?? [])]) {
    (isObservationId(r.id) ? observations : publicDeals).push(normalizeDeal(r));
  }

  const cellKey = (d: NormalizedDeal) => (d.therapeutic_area && d.mapped_phase ? `${d.therapeutic_area}|${d.mapped_phase}` : null);
  const group = (list: NormalizedDeal[]) => {
    const m = new Map<string, NormalizedDeal[]>();
    for (const d of list) {
      const key = cellKey(d);
      if (!key) continue;
      if (!m.has(key)) m.set(key, []);
      m.get(key)!.push(d);
    }
    return m;
  };
  const publicGroups = group(publicDeals);
  const observationGroups = group(observations);

  const results: CalibrationResult[] = [];
  const notes: string[] = [];
  let skippedLowN = 0;
  let observationsUsed = 0;
  let cellsWithObservations = 0;

  for (const [key, publicRows] of publicGroups) {
    const [therapeuticArea, phase] = key.split('|');

    if (publicRows.length < minSampleSize) {
      skippedLowN++;
      console.log(`Skipping phase baseline ${key}: only ${publicRows.length} deals (need ${minSampleSize})`);
      continue;
    }

    // Client observations: at most `share` of the cell → count ≤ share/(1−share) × public.
    const candidates = (observationGroups.get(key) ?? [])
      .slice()
      .sort((a, b) => (b.announced_date ?? '').localeCompare(a.announced_date ?? ''));
    const cap = share >= 1 ? candidates.length : Math.floor((publicRows.length * share) / (1 - share));
    const kept = candidates.slice(0, Math.max(0, cap));
    const dropped = candidates.length - kept.length;
    const groupDeals = [...publicRows, ...kept];

    const upfronts = sortedValues(groupDeals, d => d.upfront_m);
    const totalValues = sortedValues(groupDeals, d => d.total_value_m);
    const royaltyLows = sortedValues(groupDeals, d => d.royalty_low_norm);
    const royaltyHighs = sortedValues(groupDeals, d => d.royalty_high_norm);

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

    // Public ids only — observation ids are never persisted (k-anonymity; the column is uuid[]).
    const dealIds = publicRows.map(d => d.id).filter(id => !isObservationId(id));

    if (kept.length > 0) {
      observationsUsed += kept.length;
      cellsWithObservations++;
      notes.push(
        `${key}: ${kept.length} client observation${kept.length === 1 ? '' : 's'} blended with ${publicRows.length} public deals` +
        (dropped > 0 ? ` (${dropped} dropped by the ${Math.round(share * 100)}% cap)` : ''),
      );
    }

    results.push({
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
    });
  }

  return { results, skippedLowN, observationsUsed, cellsWithObservations, notes };
}

function emptyReport(errors: string[]): CalibrationReport {
  return { phaseBaselinesUpdated: 0, modalityMultipliersUpdated: 0, skippedLowN: 0, errors, observationsUsed: 0, cellsWithObservations: 0, priorNotes: [], version: null };
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
  supabase: import('@supabase/supabase-js').SupabaseClient,
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
    // Only verifier-confirmed, canonical, non-synthetic deals may shape a
    // baseline. Confidence score alone let LLM-seeded rows that were never
    // checked (some of them fabricated) into the medians.
    .eq('verification_status', 'verified')
    .eq('is_synthetic', false)
    .or('is_canonical.is.null,is_canonical.eq.true')
    .gte('confidence_score', 75);

  if (queryError) {
    errors.push(`Failed to query deals: ${queryError.message}`);
    return emptyReport(errors);
  }

  const deals: DealRow[] = rawDeals || [];
  console.log(`Queried ${deals.length} qualifying deals`);

  if (deals.length === 0) {
    errors.push('No qualifying deals found');
    return emptyReport(errors);
  }

  // Step 2 & 3: Normalize and convert (public deals only; observations are
  // normalized inside computePhaseBaselines and never reach the modality path)
  const normalizedDeals = deals.map(normalizeDeal);

  // ===== PHASE BASELINE CALIBRATION =====
  console.log('Computing phase baseline calibrations...');

  const observations = (options?.extraObservations ?? []).filter(o => isObservationId(o.id));
  const phase = computePhaseBaselines(deals, {
    minSampleSize,
    extraObservations: observations,
    maxObservationShare: options?.maxObservationShare,
  });
  skippedLowN += phase.skippedLowN;
  if (observations.length) {
    console.log(`Client observations: ${observations.length} offered, ${phase.observationsUsed} used across ${phase.cellsWithObservations} cells`);
  }

  // A run that used client observations is a new calibration version.
  let version: number | null = null;
  if (phase.observationsUsed > 0 && !dryRun) {
    const { data: prev, error: versionError } = await supabase
      .from('benchmark_calibrations')
      .select('version')
      .order('version', { ascending: false })
      .limit(1);
    if (versionError) {
      errors.push(`Failed to read calibration version: ${versionError.message}`);
    } else {
      const prevMax = Number((prev?.[0] as { version?: number } | undefined)?.version ?? 0);
      version = (Number.isFinite(prevMax) ? prevMax : 0) + 1;
    }
  }

  for (const result of phase.results) {
    const key = `${result.therapeutic_area}|${result.phase}`;
    if (version !== null) result.version = version;
    allResults.push(result);

    if (!dryRun) {
      // Delete existing active calibration for this key, then insert
      // (upsert doesn't work with nullable columns — PostgreSQL treats NULL != NULL)
      await supabase
        .from('benchmark_calibrations')
        .delete()
        .eq('calibration_type', 'phase_baseline')
        .eq('therapeutic_area', result.therapeutic_area)
        .eq('phase', result.phase)
        .is('modality', null)
        .eq('is_active', true);

      const { error: insertError } = await supabase
        .from('benchmark_calibrations')
        .insert(result);

      if (insertError) {
        errors.push(`Insert error for phase baseline ${key}: ${insertError.message}`);
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
      ...(version !== null ? { version } : {}),
    };

    allResults.push(result);

    if (!dryRun) {
      // Delete existing active calibration for this key, then insert
      await supabase
        .from('benchmark_calibrations')
        .delete()
        .eq('calibration_type', 'modality_multiplier')
        .eq('therapeutic_area', therapeuticArea)
        .is('phase', null)
        .eq('modality', modality)
        .eq('is_active', true);

      const { error: insertError } = await supabase
        .from('benchmark_calibrations')
        .insert(result);

      if (insertError) {
        errors.push(`Insert error for modality multiplier ${key}: ${insertError.message}`);
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

    // benchmark_calibrations has no notes column: the per-cell observation
    // notes go to the priors audit table (migration 136).
    if (phase.observationsUsed > 0) {
      const { error: auditError } = await supabase
        .from('outcome_prior_runs')
        .insert({
          ran_at: new Date().toISOString(),
          observations_used: phase.observationsUsed,
          cells_touched: phase.cellsWithObservations,
          buyers_touched: 0,
          notes: [`benchmark-calibration version ${version ?? '-'}`, ...phase.notes].join('\n'),
        });
      if (auditError) {
        errors.push(`Failed to write outcome_prior_runs: ${auditError.message}`);
      }
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
    observationsUsed: phase.observationsUsed,
    cellsWithObservations: phase.cellsWithObservations,
    priorNotes: phase.notes,
    version,
  };

  if (dryRun) {
    report.dryRunResults = allResults;
  }

  return report;
}
