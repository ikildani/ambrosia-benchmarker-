/**
 * Asset Radar — Layer 3: AI Deal Thesis Generator
 *
 * For every unpartnered clinical asset, generates a predicted deal thesis
 * by matching against comparable transactions in the deals table.
 *
 * Comps come from the SAME server path the calculator uses
 * (`findEnrichedComparableDeals`): canonical/verified/terms-disclosed rows,
 * the shared weight table, stage sanity filter and relaxation ladder. Radar
 * and the calculator therefore agree on the comp set for a given asset.
 *
 * Output: predicted upfront, milestones, royalties, total deal value,
 * likely acquirers, and a narrative deal thesis.
 *
 * Run: daily at 9:00 AM UTC via /api/cron/deal-thesis
 * Depends on: asset-universe (6:30 AM), licensing-signals (7:30 AM)
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { findEnrichedComparableDeals, type EnrichedComparableDeal } from '@/lib/comparableDeals.server';
import { computeCompStats, MIN_POOL_BEFORE_RELAX, type CompRelaxation } from '@/lib/comparable-scoring';
import { modalityKey, phaseKey } from '@/lib/comparables/match-normalize';
import { logRadarRun, deriveRunStatus } from './run-log';

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

/** One comparable transaction as Radar consumes it ($M, never raw USD). */
export interface DealComp {
  id: string;
  licensor_name: string;
  licensee_name: string;
  asset_name: string | null;
  therapeutic_area: string | null;
  modality: string | null;
  phase_at_signing: string | null;
  /** $M */
  upfront_m: number | null;
  /** $M */
  total_deal_value_m: number | null;
  /** Midpoint of royalty_low_pct / royalty_high_pct, % */
  royalty_pct: number | null;
  royalty_low_pct: number | null;
  royalty_high_pct: number | null;
  /** $M */
  milestones_m: number | null;
  territory: string | null;
  announced_date: string | null;
  year: number;
  deal_type: string | null;
  verification_status: string | null;
  /** 0–1 from the shared scorer */
  match_score: number;
  relevance_reasons: string[];
}

export interface ComparableSet {
  comps: DealComp[];
  relaxation: CompRelaxation;
  excludedApprovedMA: number;
}

export interface DealThesis {
  assetId: string;
  companyName: string;
  assetName: string;
  therapeuticArea: string | null;
  modality: string | null;
  phase: string | null;

  // Predicted terms ($M / %) — all null when insufficientComps
  predictedUpfrontLow: number | null;
  predictedUpfrontMid: number | null;
  predictedUpfrontHigh: number | null;
  predictedTotalLow: number | null;
  predictedTotalMid: number | null;
  predictedTotalHigh: number | null;
  predictedRoyaltyLow: number | null;
  predictedRoyaltyMid: number | null;
  predictedRoyaltyHigh: number | null;

  // Acquirer predictions
  likelyAcquirers: { name: string; dealCount: number; avgUpfront: number | null }[];

  // Comparable transaction basis
  compCount: number;
  compDealIds: string[];
  /** Which rung of the relaxation ladder produced the pool. */
  compRelaxation: CompRelaxation;
  /** True when the pool is below MIN_COMPS_FOR_TERMS — no terms are predicted. */
  insufficientComps: boolean;
  /** IQR / median of disclosed total values (dispersion of the comp set). */
  compDispersion: number | null;

  // Confidence
  thesisConfidence: number;
}

export interface ThesisResult {
  assetsProcessed: number;
  thesesGenerated: number;
  /** Assets whose comp pool was below the floor — persisted as a marker, no terms. */
  insufficientComps: number;
  errors: string[];
  timedOut: boolean;
  /** False when the data_ingestion_log insert failed. */
  logWritten: boolean;
}

/**
 * Hard floor for predicting terms. Below this many comps the thesis is
 * persisted as an `insufficient_comps` marker with no numbers.
 */
export const MIN_COMPS_FOR_TERMS = Math.max(5, MIN_POOL_BEFORE_RELAX);

/** Max comps pulled from the shared path per asset. */
const MAX_COMPS = 30;

// ═══════════════════════════════════════════════════════════════════════
// PHASE / MODALITY NORMALIZATION (Radar ↔ deals vocabulary)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Radar assets carry ClinicalTrials.gov spellings ('early_phase1',
 * 'phase1_phase2', 'phase4', 'Phase 2') that the shared normalizers do not
 * know. Map them to the deals-table form first, then hand off to `phaseKey`.
 */
const RADAR_PHASE_TO_DB: Record<string, string> = {
  early_phase1: 'phase_1',
  earlyphase1: 'phase_1',
  phase1: 'phase_1',
  phase_1: 'phase_1',
  phase1_phase2: 'phase_1_2',
  phase1phase2: 'phase_1_2',
  phase1_2: 'phase_1_2',
  phase_1_2: 'phase_1_2',
  phase2: 'phase_2',
  phase_2: 'phase_2',
  phase2_phase3: 'phase_2_3',
  phase2phase3: 'phase_2_3',
  phase2_3: 'phase_2_3',
  phase_2_3: 'phase_2_3',
  phase3: 'phase_3',
  phase_3: 'phase_3',
  phase4: 'approved',
  phase_4: 'approved',
  approved: 'approved',
  marketed: 'approved',
  preclinical: 'preclinical',
  discovery: 'discovery',
  nda_filed: 'nda_filed',
  bla_filed: 'bla_filed',
};

/**
 * Deals-table phase spelling for a Radar/CT.gov phase ('phase_1_2' keeps its
 * half-step so the shared scorer can rate adjacency). Null when unknown.
 */
export function radarPhaseToDb(phase: string | null | undefined): string | null {
  if (!phase) return null;
  // 'Phase 1/Phase 2' → 'phase_1_phase_2' → (no hit) → 'phase1phase2' → 'phase_1_2'
  const c = phase.toLowerCase().trim().replace(/[\s/-]+/g, '_');
  return RADAR_PHASE_TO_DB[c] ?? RADAR_PHASE_TO_DB[c.replace(/_/g, '')] ?? null;
}

/** Collapsed canonical phase key ('phase_2', 'approved', ...) or 'unknown'. */
export function radarPhaseKey(phase: string | null | undefined): string {
  return phaseKey(radarPhaseToDb(phase));
}

/** Inputs for the shared comparable-deals path, derived from a clinical asset. */
export function buildCompInputs(asset: {
  therapeutic_area: string | null;
  modality: string | null;
  phase: string | null;
  indication_category?: string | null;
  indication_specific?: string | null;
}): { therapeuticArea: string; modality: string; indication: string; phase?: string; dealType: string } | null {
  if (!asset.therapeutic_area) return null;
  const phase = radarPhaseToDb(asset.phase);
  return {
    therapeuticArea: asset.therapeutic_area.toLowerCase().trim(),
    modality: asset.modality || '',
    indication: asset.indication_specific || asset.indication_category || '',
    phase: phase ?? undefined,
    dealType: 'licensing',
  };
}

/** Cache key so assets that resolve to the same comp query share one fetch. */
export function compCacheKey(asset: {
  therapeutic_area: string | null;
  modality: string | null;
  phase: string | null;
  indication_category?: string | null;
  indication_specific?: string | null;
}): string {
  const indication = (asset.indication_specific || asset.indication_category || '').toLowerCase().trim();
  return `${(asset.therapeutic_area || 'any').toLowerCase()}::${modalityKey(asset.modality) || 'any'}::${radarPhaseKey(asset.phase)}::${indication || 'any'}`;
}

// ═══════════════════════════════════════════════════════════════════════
// COMPARABLE DEAL FETCHING (shared calculator path)
// ═══════════════════════════════════════════════════════════════════════

function toDealComp(
  d: EnrichedComparableDeal,
  extra: { asset_name: string | null; royalty_low_pct: number | null; royalty_high_pct: number | null; milestones_total_usd: number | null; announced_date: string | null } | undefined,
): DealComp {
  const low = extra?.royalty_low_pct != null ? Number(extra.royalty_low_pct) : null;
  const high = extra?.royalty_high_pct != null ? Number(extra.royalty_high_pct) : null;
  const royalty = low != null && high != null ? (low + high) / 2 : (low ?? high);
  const milestonesUsd = extra?.milestones_total_usd != null ? Number(extra.milestones_total_usd) : null;

  return {
    id: d.id,
    licensor_name: d.licensor,
    licensee_name: d.licensee,
    asset_name: extra?.asset_name ?? null,
    therapeutic_area: d.therapeuticArea,
    modality: d.modality,
    phase_at_signing: d.phase,
    upfront_m: d.upfrontM,
    total_deal_value_m: d.totalValueM,
    royalty_pct: royalty != null && royalty > 0 ? royalty : null,
    royalty_low_pct: low,
    royalty_high_pct: high,
    milestones_m: milestonesUsd && milestonesUsd > 0 ? Math.round(milestonesUsd / 1_000_000) : null,
    territory: d.territory,
    announced_date: extra?.announced_date ?? null,
    year: d.year,
    deal_type: d.dealType,
    verification_status: d.verificationStatus,
    match_score: d.matchScore,
    relevance_reasons: d.relevanceReasons,
  };
}

/**
 * Comparable transactions for an asset via the shared calculator path.
 * Returns an empty set when the asset has no therapeutic area (the shared
 * path filters on TA in SQL and never widens beyond it).
 */
export async function fetchComparableDeals(
  supabase: SupabaseClient,
  asset: {
    therapeutic_area: string | null;
    modality: string | null;
    phase: string | null;
    indication_category?: string | null;
    indication_specific?: string | null;
  },
  maxDeals: number = MAX_COMPS,
): Promise<ComparableSet> {
  const inputs = buildCompInputs(asset);
  if (!inputs) return { comps: [], relaxation: 'none', excludedApprovedMA: 0 };

  const result = await findEnrichedComparableDeals(inputs, maxDeals);
  if (result.deals.length === 0) {
    return { comps: [], relaxation: result.relaxation, excludedApprovedMA: result.excludedApprovedMA };
  }

  // The enriched row carries upfront/total in $M but not royalties, milestones
  // or the asset name — pull those for the selected ids only.
  const ids = result.deals.map(d => d.id);
  const { data: extras, error } = await supabase
    .from('deals')
    .select('id, asset_name, royalty_low_pct, royalty_high_pct, milestones_total_usd, announced_date')
    .in('id', ids);
  if (error) {
    console.warn(`[deal-thesis] royalty/milestone lookup failed: ${error.message}`);
  }
  const extraById = new Map((extras || []).map(e => [e.id as string, e]));

  return {
    comps: result.deals.map(d => toDealComp(d, extraById.get(d.id))),
    relaxation: result.relaxation,
    excludedApprovedMA: result.excludedApprovedMA,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// THESIS GENERATION
// ═══════════════════════════════════════════════════════════════════════

const RELAXATION_PENALTY: Record<CompRelaxation, number> = {
  none: 0,
  modality_only: 10,
  ta_only: 20,
};

/** Dispersion penalty: IQR/median of the comp totals, up to 30 points. */
export function dispersionPenalty(dispersion: number | null): number {
  if (dispersion == null || !Number.isFinite(dispersion)) return 0;
  return Math.min(30, Math.round(dispersion * 15));
}

export function generateThesis(
  asset: { id: string; company_name: string; asset_name: string; therapeutic_area: string | null; modality: string | null; phase: string | null },
  set: ComparableSet,
): DealThesis {
  const { comps, relaxation } = set;
  const insufficientComps = comps.length < MIN_COMPS_FOR_TERMS;

  const upfronts = comps.map(d => d.upfront_m).filter((v): v is number => v !== null && v > 0);
  const totals = comps.map(d => d.total_deal_value_m).filter((v): v is number => v !== null && v > 0);
  const royalties = comps.map(d => d.royalty_pct).filter((v): v is number => v !== null && v > 0);

  // Each metric needs the floor of disclosed values — a pool of 8 deals with
  // 2 disclosed royalties predicts no royalty.
  const upfrontStats = !insufficientComps && upfronts.length >= MIN_COMPS_FOR_TERMS ? computeCompStats(upfronts) : null;
  const totalStats = !insufficientComps && totals.length >= MIN_COMPS_FOR_TERMS ? computeCompStats(totals) : null;
  const royaltyStats = !insufficientComps && royalties.length >= MIN_COMPS_FOR_TERMS ? computeCompStats(royalties) : null;

  const r1 = (v: number) => Math.round(v * 10) / 10;

  // Dispersion of the comp set (IQR / median). Prefer totals; fall back to upfronts.
  const dispersionSource = totalStats ?? upfrontStats;
  const compDispersion = dispersionSource && dispersionSource.median > 0
    ? Math.round(((dispersionSource.p75 - dispersionSource.p25) / dispersionSource.median) * 100) / 100
    : null;

  // Identify likely acquirers from licensee frequency
  const acquirerMap = new Map<string, { count: number; upfronts: number[] }>();
  for (const comp of comps) {
    if (!comp.licensee_name || comp.licensee_name === 'Unknown') continue;
    const existing = acquirerMap.get(comp.licensee_name) || { count: 0, upfronts: [] };
    existing.count++;
    if (comp.upfront_m && comp.upfront_m > 0) existing.upfronts.push(comp.upfront_m);
    acquirerMap.set(comp.licensee_name, existing);
  }

  const likelyAcquirers = Array.from(acquirerMap.entries())
    .map(([name, data]) => ({
      name,
      dealCount: data.count,
      avgUpfront: data.upfronts.length > 0
        ? Math.round(data.upfronts.reduce((a, b) => a + b, 0) / data.upfronts.length)
        : null,
    }))
    .sort((a, b) => b.dealCount - a.dealCount)
    .slice(0, 5);

  // Confidence: comp count, disclosure depth, recency, minus relaxation and dispersion.
  let confidence = 0;
  if (!insufficientComps) {
    confidence += Math.min(comps.length * 3, 30);
    confidence += upfronts.length >= 10 ? 20 : upfronts.length >= MIN_COMPS_FOR_TERMS ? 12 : 0;
    confidence += totals.length >= 10 ? 20 : totals.length >= MIN_COMPS_FOR_TERMS ? 12 : 0;
    confidence += royalties.length >= MIN_COMPS_FOR_TERMS ? 10 : 0;
    const currentYear = new Date().getFullYear();
    const recentComps = comps.filter(d => d.year >= currentYear - 2);
    confidence += recentComps.length >= 3 ? 20 : recentComps.length >= 1 ? 10 : 0;
    confidence -= RELAXATION_PENALTY[relaxation];
    confidence -= dispersionPenalty(compDispersion);
  }

  return {
    assetId: asset.id,
    companyName: asset.company_name,
    assetName: asset.asset_name,
    therapeuticArea: asset.therapeutic_area,
    modality: asset.modality,
    phase: asset.phase,
    predictedUpfrontLow: upfrontStats ? Math.round(upfrontStats.p25) : null,
    predictedUpfrontMid: upfrontStats ? Math.round(upfrontStats.median) : null,
    predictedUpfrontHigh: upfrontStats ? Math.round(upfrontStats.p75) : null,
    predictedTotalLow: totalStats ? Math.round(totalStats.p25) : null,
    predictedTotalMid: totalStats ? Math.round(totalStats.median) : null,
    predictedTotalHigh: totalStats ? Math.round(totalStats.p75) : null,
    predictedRoyaltyLow: royaltyStats ? r1(royaltyStats.p25) : null,
    predictedRoyaltyMid: royaltyStats ? r1(royaltyStats.median) : null,
    predictedRoyaltyHigh: royaltyStats ? r1(royaltyStats.p75) : null,
    likelyAcquirers,
    compCount: comps.length,
    compDealIds: comps.map(d => d.id),
    compRelaxation: relaxation,
    insufficientComps,
    compDispersion,
    thesisConfidence: Math.max(0, Math.min(Math.round(confidence), 100)),
  };
}

// ═══════════════════════════════════════════════════════════════════════
// PERSIST
// ═══════════════════════════════════════════════════════════════════════

/**
 * Columns added by migration 104. If the migration has not been applied yet
 * PostgREST rejects the upsert (PGRST204 / 42703); we retry without them so
 * the thesis is still written and log a warning once per run.
 */
const OPTIONAL_THESIS_COLUMNS = ['comp_relaxation', 'insufficient_comps', 'comp_dispersion'] as const;

function isMissingColumnError(err: { code?: string; message?: string } | null): boolean {
  if (!err) return false;
  if (err.code === 'PGRST204' || err.code === '42703') return true;
  return /column|schema cache/i.test(err.message || '');
}

async function upsertThesis(
  supabase: SupabaseClient,
  thesis: DealThesis,
  state: { optionalColumnsMissing: boolean },
): Promise<{ error: { code?: string; message: string } | null }> {
  const row: Record<string, unknown> = {
    asset_id: thesis.assetId,
    company_name: thesis.companyName,
    asset_name: thesis.assetName,
    therapeutic_area: thesis.therapeuticArea,
    modality: thesis.modality,
    phase: thesis.phase,
    predicted_upfront_low: thesis.predictedUpfrontLow,
    predicted_upfront_mid: thesis.predictedUpfrontMid,
    predicted_upfront_high: thesis.predictedUpfrontHigh,
    predicted_total_low: thesis.predictedTotalLow,
    predicted_total_mid: thesis.predictedTotalMid,
    predicted_total_high: thesis.predictedTotalHigh,
    predicted_royalty_low: thesis.predictedRoyaltyLow,
    predicted_royalty_mid: thesis.predictedRoyaltyMid,
    predicted_royalty_high: thesis.predictedRoyaltyHigh,
    likely_acquirers: thesis.likelyAcquirers,
    comp_count: thesis.compCount,
    comp_deal_ids: thesis.compDealIds,
    thesis_confidence: thesis.thesisConfidence,
    generated_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
  if (!state.optionalColumnsMissing) {
    row.comp_relaxation = thesis.compRelaxation;
    row.insufficient_comps = thesis.insufficientComps;
    row.comp_dispersion = thesis.compDispersion;
  }

  const { error } = await supabase.from('radar_deal_theses').upsert(row, { onConflict: 'asset_id' });
  if (error && !state.optionalColumnsMissing && isMissingColumnError(error)) {
    state.optionalColumnsMissing = true;
    console.warn(`[deal-thesis] ${OPTIONAL_THESIS_COLUMNS.join(', ')} not on radar_deal_theses (apply migration 104); writing without them`);
    for (const col of OPTIONAL_THESIS_COLUMNS) delete row[col];
    const retry = await supabase.from('radar_deal_theses').upsert(row, { onConflict: 'asset_id' });
    return { error: retry.error };
  }
  return { error };
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN: BATCH THESIS GENERATION
// ═══════════════════════════════════════════════════════════════════════

const MAX_RUNTIME_MS = 240_000;

export async function generateDealTheses(
  supabase: SupabaseClient,
  options?: { assetIds?: string[]; limit?: number },
): Promise<ThesisResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let assetsProcessed = 0;
  let thesesGenerated = 0;
  let insufficientComps = 0;
  let timedOut = false;

  // Fetch unpartnered/partially-partnered assets that need theses
  let assetQuery = supabase
    .from('clinical_assets')
    .select('id, company_name, asset_name, therapeutic_area, modality, phase, indication_category, indication_specific, confidence_score')
    .in('partnership_status', ['unpartnered', 'partially_partnered'])
    .gte('confidence_score', 20)
    .order('licensing_intent_score', { ascending: false, nullsFirst: false });

  if (options?.assetIds?.length) {
    assetQuery = assetQuery.in('id', options.assetIds);
  }

  const limit = options?.limit ?? 200;
  const { data: assets, error: fetchError } = await assetQuery.limit(limit);

  if (fetchError || !assets) {
    const message = fetchError?.message || 'No assets found';
    const logWritten = await logRadarRun(supabase, {
      source: 'deal_thesis', startedAt: startTime, status: 'failed', errors: [message],
    });
    return { assetsProcessed: 0, thesesGenerated: 0, insufficientComps: 0, errors: [message], timedOut: false, logWritten };
  }

  // Cache comp sets by TA::modality::phase::indication so assets that resolve
  // to the same comp query share one fetch.
  const compCache = new Map<string, ComparableSet>();
  const persistState = { optionalColumnsMissing: false };
  const relaxationCounts: Record<CompRelaxation, number> = { none: 0, modality_only: 0, ta_only: 0 };

  for (const asset of assets) {
    if (Date.now() - startTime > MAX_RUNTIME_MS) { timedOut = true; break; }

    try {
      const cacheKey = compCacheKey(asset);
      let set = compCache.get(cacheKey);
      if (!set) {
        set = await fetchComparableDeals(supabase, asset);
        compCache.set(cacheKey, set);
      }

      const thesis = generateThesis(asset, set);
      relaxationCounts[thesis.compRelaxation]++;

      // Persist to radar_deal_theses only. deal_readiness_score on
      // clinical_assets is owned by Layer 2 (signal-detection) — never touch it here.
      const { error: thesisError } = await upsertThesis(supabase, thesis, persistState);

      if (thesisError) {
        errors.push(`Thesis upsert error ${asset.asset_name}: ${thesisError.message}`);
      } else if (thesis.insufficientComps) {
        insufficientComps++;
      } else {
        thesesGenerated++;
      }

      assetsProcessed++;
    } catch (err) {
      errors.push(`Thesis error ${asset.asset_name}: ${err instanceof Error ? err.message : String(err)}`);
      assetsProcessed++;
    }
  }

  const status = deriveRunStatus({ errors: errors.length, timedOut, processed: assetsProcessed, produced: thesesGenerated });
  const logWritten = await logRadarRun(supabase, {
    source: 'deal_thesis',
    startedAt: startTime,
    status,
    fetched: assets.length,
    processed: assetsProcessed,
    inserted: thesesGenerated,
    skipped: insufficientComps,
    failed: errors.length,
    errors,
    parameters: {
      timed_out: timedOut,
      min_comps_for_terms: MIN_COMPS_FOR_TERMS,
      insufficient_comps: insufficientComps,
      relaxation: relaxationCounts,
      comp_queries: compCache.size,
      optional_columns_missing: persistState.optionalColumnsMissing,
    },
  });

  const duration = Math.round((Date.now() - startTime) / 1000);
  console.log(`[deal-thesis] Done: ${assetsProcessed} assets, ${thesesGenerated} theses generated, ${insufficientComps} below comp floor, ${errors.length} errors, ${duration}s${timedOut ? ' (timed out)' : ''}`);

  return { assetsProcessed, thesesGenerated, insufficientComps, errors, timedOut, logWritten };
}
