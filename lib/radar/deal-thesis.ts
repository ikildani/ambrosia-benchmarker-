/**
 * Asset Radar — Layer 3: AI Deal Thesis Generator
 *
 * For every unpartnered clinical asset, generates a predicted deal thesis
 * by matching against comparable transactions in the deals table.
 *
 * Output: predicted upfront, milestones, royalties, total deal value,
 * likely acquirers, and a narrative deal thesis.
 *
 * Run: daily at 9:00 AM UTC via /api/cron/deal-thesis
 * Depends on: asset-universe (6:30 AM), licensing-signals (7:30 AM)
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

interface DealComp {
  id: string;
  licensor_name: string;
  licensee_name: string;
  asset_name: string | null;
  therapeutic_area: string | null;
  modality: string | null;
  phase_at_deal: string | null;
  upfront_m: number | null;
  total_deal_value_m: number | null;
  royalty_rate: number | null;
  milestone_m: number | null;
  territory: string | null;
  announcement_date: string | null;
}

export interface DealThesis {
  assetId: string;
  companyName: string;
  assetName: string;
  therapeuticArea: string | null;
  modality: string | null;
  phase: string | null;

  // Predicted terms
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

  // Comparable transactions
  compCount: number;
  compDealIds: string[];

  // Confidence
  thesisConfidence: number;
}

export interface ThesisResult {
  assetsProcessed: number;
  thesesGenerated: number;
  errors: string[];
  timedOut: boolean;
}

// ═══════════════════════════════════════════════════════════════════════
// PHASE MATCHING
// ═══════════════════════════════════════════════════════════════════════

const PHASE_BUCKETS: Record<string, string[]> = {
  'preclinical': ['preclinical', 'discovery'],
  'phase1': ['early_phase1', 'phase1', 'phase_1', 'Phase 1', 'Early Phase 1'],
  'phase1_2': ['phase1_phase2', 'phase_1_2', 'Phase 1/Phase 2'],
  'phase2': ['phase2', 'phase_2', 'Phase 2'],
  'phase2_3': ['phase2_phase3', 'phase_2_3', 'Phase 2/Phase 3'],
  'phase3': ['phase3', 'phase_3', 'Phase 3'],
  'approved': ['phase4', 'phase_4', 'approved', 'Phase 4', 'Approved'],
};

function getAdjacentPhases(phase: string): string[] {
  const normalized = phase.toLowerCase().replace(/\s+/g, '').replace(/-/g, '_');
  const bucketKeys = Object.keys(PHASE_BUCKETS);

  for (let i = 0; i < bucketKeys.length; i++) {
    const bucket = PHASE_BUCKETS[bucketKeys[i]];
    if (bucket.some(p => p.toLowerCase().replace(/\s+/g, '').replace(/-/g, '_') === normalized || p === phase)) {
      const adjacent: string[] = [...bucket];
      if (i > 0) adjacent.push(...PHASE_BUCKETS[bucketKeys[i - 1]]);
      if (i < bucketKeys.length - 1) adjacent.push(...PHASE_BUCKETS[bucketKeys[i + 1]]);
      return adjacent;
    }
  }
  return [phase];
}

// ═══════════════════════════════════════════════════════════════════════
// PERCENTILE CALCULATION
// ═══════════════════════════════════════════════════════════════════════

function percentile(values: number[], p: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (p / 100) * (sorted.length - 1);
  const lower = Math.floor(idx);
  const upper = Math.ceil(idx);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (idx - lower);
}

// ═══════════════════════════════════════════════════════════════════════
// COMPARABLE DEAL FETCHING
// ═══════════════════════════════════════════════════════════════════════

async function fetchComparableDeals(
  supabase: SupabaseClient,
  ta: string | null,
  modality: string | null,
  phase: string | null,
): Promise<DealComp[]> {
  let query = supabase
    .from('deals')
    .select('id, licensor_name, licensee_name, asset_name, therapeutic_area, modality, phase_at_deal, upfront_m, total_deal_value_m, royalty_rate, milestone_m, territory, announcement_date')
    .eq('is_synthetic', false)
    .not('total_deal_value_m', 'is', null)
    .gt('total_deal_value_m', 0);

  // Match on TA first (broadest filter)
  if (ta) {
    query = query.eq('therapeutic_area', ta);
  }

  // Modality match if available
  if (modality) {
    query = query.eq('modality', modality);
  }

  query = query.order('announcement_date', { ascending: false }).limit(200);

  const { data, error } = await query;
  if (error || !data) return [];

  // Filter by phase adjacency if phase is specified
  if (phase) {
    const adjacentPhases = getAdjacentPhases(phase);
    const phaseFiltered = data.filter(d => {
      if (!d.phase_at_deal) return true; // include deals with unknown phase
      return adjacentPhases.some(p =>
        p.toLowerCase() === d.phase_at_deal?.toLowerCase() ||
        p === d.phase_at_deal
      );
    });
    // If phase filtering is too restrictive, fall back to all TA+modality matches
    if (phaseFiltered.length >= 5) return phaseFiltered;
  }

  return data;
}

// ═══════════════════════════════════════════════════════════════════════
// THESIS GENERATION
// ═══════════════════════════════════════════════════════════════════════

function generateThesis(
  asset: { id: string; company_name: string; asset_name: string; therapeutic_area: string | null; modality: string | null; phase: string | null },
  comps: DealComp[],
): DealThesis {
  const upfronts = comps.map(d => d.upfront_m).filter((v): v is number => v !== null && v > 0);
  const totals = comps.map(d => d.total_deal_value_m).filter((v): v is number => v !== null && v > 0);
  const royalties = comps.map(d => d.royalty_rate).filter((v): v is number => v !== null && v > 0);

  // Predict term ranges (P25 / P50 / P75)
  const predictedUpfrontLow = upfronts.length >= 3 ? Math.round(percentile(upfronts, 25)) : null;
  const predictedUpfrontMid = upfronts.length >= 3 ? Math.round(percentile(upfronts, 50)) : null;
  const predictedUpfrontHigh = upfronts.length >= 3 ? Math.round(percentile(upfronts, 75)) : null;

  const predictedTotalLow = totals.length >= 3 ? Math.round(percentile(totals, 25)) : null;
  const predictedTotalMid = totals.length >= 3 ? Math.round(percentile(totals, 50)) : null;
  const predictedTotalHigh = totals.length >= 3 ? Math.round(percentile(totals, 75)) : null;

  const predictedRoyaltyLow = royalties.length >= 3 ? Math.round(percentile(royalties, 25) * 10) / 10 : null;
  const predictedRoyaltyMid = royalties.length >= 3 ? Math.round(percentile(royalties, 50) * 10) / 10 : null;
  const predictedRoyaltyHigh = royalties.length >= 3 ? Math.round(percentile(royalties, 75) * 10) / 10 : null;

  // Identify likely acquirers from licensee frequency
  const acquirerMap = new Map<string, { count: number; upfronts: number[] }>();
  for (const comp of comps) {
    if (!comp.licensee_name) continue;
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

  // Confidence: based on comp count, term disclosure rate, recency
  let confidence = 0;
  confidence += Math.min(comps.length * 5, 30); // up to 30 for comp count
  confidence += upfronts.length >= 5 ? 20 : upfronts.length >= 3 ? 10 : 0;
  confidence += totals.length >= 5 ? 20 : totals.length >= 3 ? 10 : 0;
  confidence += royalties.length >= 3 ? 10 : 0;
  // Recency bonus: any comp from last 2 years
  const recentCutoff = new Date();
  recentCutoff.setFullYear(recentCutoff.getFullYear() - 2);
  const recentComps = comps.filter(d => d.announcement_date && new Date(d.announcement_date) > recentCutoff);
  confidence += recentComps.length >= 3 ? 20 : recentComps.length >= 1 ? 10 : 0;

  return {
    assetId: asset.id,
    companyName: asset.company_name,
    assetName: asset.asset_name,
    therapeuticArea: asset.therapeutic_area,
    modality: asset.modality,
    phase: asset.phase,
    predictedUpfrontLow,
    predictedUpfrontMid,
    predictedUpfrontHigh,
    predictedTotalLow,
    predictedTotalMid,
    predictedTotalHigh,
    predictedRoyaltyLow,
    predictedRoyaltyMid,
    predictedRoyaltyHigh,
    likelyAcquirers,
    compCount: comps.length,
    compDealIds: comps.slice(0, 20).map(d => d.id),
    thesisConfidence: Math.min(confidence, 100),
  };
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN: BATCH THESIS GENERATION
// ═══════════════════════════════════════════════════════════════════════

const MAX_RUNTIME_MS = 240_000;
const BATCH_SIZE = 20;

export async function generateDealTheses(
  supabase: SupabaseClient,
  options?: { assetIds?: string[]; limit?: number },
): Promise<ThesisResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let assetsProcessed = 0;
  let thesesGenerated = 0;
  let timedOut = false;

  // Fetch unpartnered/partially-partnered assets that need theses
  let assetQuery = supabase
    .from('clinical_assets')
    .select('id, company_name, asset_name, therapeutic_area, modality, phase, confidence_score')
    .in('partnership_status', ['unpartnered', 'partially_partnered'])
    .gte('confidence_score', 20)
    .order('licensing_intent_score', { ascending: false, nullsFirst: false });

  if (options?.assetIds?.length) {
    assetQuery = assetQuery.in('id', options.assetIds);
  }

  const limit = options?.limit ?? 200;
  const { data: assets, error: fetchError } = await assetQuery.limit(limit);

  if (fetchError || !assets) {
    return { assetsProcessed: 0, thesesGenerated: 0, errors: [fetchError?.message || 'No assets found'], timedOut: false };
  }

  // Cache comps by TA+modality to avoid redundant queries
  const compCache = new Map<string, DealComp[]>();

  for (let i = 0; i < assets.length; i += BATCH_SIZE) {
    if (Date.now() - startTime > MAX_RUNTIME_MS) { timedOut = true; break; }

    const batch = assets.slice(i, i + BATCH_SIZE);

    for (const asset of batch) {
      if (Date.now() - startTime > MAX_RUNTIME_MS) { timedOut = true; break; }

      try {
        const cacheKey = `${asset.therapeutic_area || 'any'}::${asset.modality || 'any'}`;

        let comps = compCache.get(cacheKey);
        if (!comps) {
          comps = await fetchComparableDeals(supabase, asset.therapeutic_area, asset.modality, asset.phase);
          compCache.set(cacheKey, comps);
        }

        if (comps.length < 3) {
          assetsProcessed++;
          continue;
        }

        const thesis = generateThesis(asset, comps);

        // Store thesis on clinical_assets (using JSONB metadata column or dedicated columns)
        const { error: updateError } = await supabase
          .from('clinical_assets')
          .update({
            deal_readiness_score: thesis.thesisConfidence,
            updated_at: new Date().toISOString(),
          })
          .eq('id', asset.id);

        if (updateError) {
          errors.push(`Thesis update error ${asset.asset_name}: ${updateError.message}`);
        }

        // Store full thesis in deal_theses table
        const { error: thesisError } = await supabase
          .from('radar_deal_theses')
          .upsert({
            asset_id: asset.id,
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
          }, { onConflict: 'asset_id' });

        if (thesisError) {
          if (thesisError.code !== '23505') {
            errors.push(`Thesis insert error ${asset.asset_name}: ${thesisError.message}`);
          }
        } else {
          thesesGenerated++;
        }

        assetsProcessed++;
      } catch (err) {
        errors.push(`Thesis error ${asset.asset_name}: ${err instanceof Error ? err.message : String(err)}`);
        assetsProcessed++;
      }
    }
  }

  // Log
  const duration = Math.round((Date.now() - startTime) / 1000);
  await supabase.from('data_ingestion_log').insert({
    source: 'deal_thesis',
    status: errors.length > 0 ? 'partial' : 'success',
    records_processed: assetsProcessed,
    records_inserted: thesesGenerated,
    duration_seconds: duration,
    error_details: errors.length > 0 ? errors.slice(0, 20) : null,
    metadata: { timed_out: timedOut },
  });

  console.log(`[deal-thesis] Done: ${assetsProcessed} assets, ${thesesGenerated} theses generated, ${errors.length} errors, ${duration}s${timedOut ? ' (timed out)' : ''}`);

  return { assetsProcessed, thesesGenerated, errors, timedOut };
}
