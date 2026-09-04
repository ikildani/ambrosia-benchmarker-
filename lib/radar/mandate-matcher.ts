/**
 * Asset Radar — Layer 4: Mandate Matching Engine
 *
 * Matches clinical_assets against user search mandates (radar_user_mandates).
 * Creates radar_mandate_matches for new asset-mandate pairs.
 *
 * Run: daily at 10:00 AM UTC via /api/cron/mandate-matcher
 * Depends on: asset-universe (6:30 AM), licensing-signals (7:30 AM), deal-thesis (9 AM)
 */

import type { SupabaseClient } from '@supabase/supabase-js';

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

interface Mandate {
  id: string;
  user_id: string;
  therapeutic_areas: string[];
  modalities: string[];
  phase_min: string | null;
  phase_max: string | null;
  countries: string[];
  regions: string[];
  partnership_statuses: string[];
  min_licensing_intent: number;
  min_deal_readiness: number;
  min_confidence: number;
}

interface Asset {
  id: string;
  therapeutic_area: string | null;
  modality: string | null;
  phase: string | null;
  originator_country: string | null;
  originator_region: string | null;
  partnership_status: string;
  licensing_intent_score: number;
  deal_readiness_score: number;
  confidence_score: number;
}

export interface MatchResult {
  mandatesProcessed: number;
  matchesCreated: number;
  errors: string[];
  timedOut: boolean;
}

// ═══════════════════════════════════════════════════════════════════════
// PHASE ORDERING (for range matching)
// ═══════════════════════════════════════════════════════════════════════

const PHASE_ORDER: Record<string, number> = {
  'early phase 1': 1, 'phase 1': 2, 'phase 1/phase 2': 3,
  'phase 2': 4, 'phase 2/phase 3': 5, 'phase 3': 6,
  'phase 4': 7, 'approved': 8,
};

function phaseRank(phase: string | null): number {
  if (!phase) return 0;
  return PHASE_ORDER[phase.toLowerCase()] || 0;
}

// ═══════════════════════════════════════════════════════════════════════
// MATCHING LOGIC
// ═══════════════════════════════════════════════════════════════════════

function matchAssetToMandate(asset: Asset, mandate: Mandate): { matches: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // TA filter
  if (mandate.therapeutic_areas.length > 0) {
    if (!asset.therapeutic_area || !mandate.therapeutic_areas.includes(asset.therapeutic_area)) {
      return { matches: false, reasons: [] };
    }
    reasons.push(`TA: ${asset.therapeutic_area}`);
  }

  // Modality filter
  if (mandate.modalities.length > 0) {
    if (!asset.modality || !mandate.modalities.includes(asset.modality)) {
      return { matches: false, reasons: [] };
    }
    reasons.push(`Modality: ${asset.modality}`);
  }

  // Phase range
  if (mandate.phase_min || mandate.phase_max) {
    const rank = phaseRank(asset.phase);
    if (rank === 0) return { matches: false, reasons: [] };
    const minRank = mandate.phase_min ? phaseRank(mandate.phase_min) : 0;
    const maxRank = mandate.phase_max ? phaseRank(mandate.phase_max) : 99;
    if (rank < minRank || rank > maxRank) {
      return { matches: false, reasons: [] };
    }
    reasons.push(`Phase: ${asset.phase}`);
  }

  // Country filter
  if (mandate.countries.length > 0) {
    if (!asset.originator_country || !mandate.countries.includes(asset.originator_country)) {
      return { matches: false, reasons: [] };
    }
    reasons.push(`Country: ${asset.originator_country}`);
  }

  // Region filter
  if (mandate.regions.length > 0) {
    if (!asset.originator_region || !mandate.regions.includes(asset.originator_region)) {
      return { matches: false, reasons: [] };
    }
    reasons.push(`Region: ${asset.originator_region}`);
  }

  // Partnership status
  if (mandate.partnership_statuses.length > 0) {
    if (!mandate.partnership_statuses.includes(asset.partnership_status)) {
      return { matches: false, reasons: [] };
    }
  }

  // Score thresholds
  if (mandate.min_licensing_intent > 0 && asset.licensing_intent_score < mandate.min_licensing_intent) {
    return { matches: false, reasons: [] };
  }
  if (mandate.min_deal_readiness > 0 && asset.deal_readiness_score < mandate.min_deal_readiness) {
    return { matches: false, reasons: [] };
  }
  if (mandate.min_confidence > 0 && asset.confidence_score < mandate.min_confidence) {
    return { matches: false, reasons: [] };
  }

  return { matches: true, reasons };
}

function computeMatchScore(asset: Asset, reasons: string[]): number {
  let score = 0;
  score += reasons.length * 15;
  score += Math.min(asset.licensing_intent_score * 0.3, 30);
  score += Math.min(asset.deal_readiness_score * 0.2, 20);
  score += Math.min(asset.confidence_score * 0.1, 10);
  return Math.min(Math.round(score), 100);
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN MATCHING FUNCTION
// ═══════════════════════════════════════════════════════════════════════

const MAX_RUNTIME_MS = 240_000;

export async function runMandateMatching(supabase: SupabaseClient): Promise<MatchResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let mandatesProcessed = 0;
  let matchesCreated = 0;
  let timedOut = false;

  // Fetch all active mandates
  const { data: mandates, error: mandateError } = await supabase
    .from('radar_user_mandates')
    .select('id, user_id, therapeutic_areas, modalities, phase_min, phase_max, countries, regions, partnership_statuses, min_licensing_intent, min_deal_readiness, min_confidence')
    .eq('is_active', true);

  if (mandateError || !mandates || mandates.length === 0) {
    return { mandatesProcessed: 0, matchesCreated: 0, errors: mandateError ? [mandateError.message] : [], timedOut: false };
  }

  // Fetch candidate assets (recently updated, reasonable confidence)
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);

  const { data: assets, error: assetError } = await supabase
    .from('clinical_assets')
    .select('id, therapeutic_area, modality, phase, originator_country, originator_region, partnership_status, licensing_intent_score, deal_readiness_score, confidence_score')
    .gte('confidence_score', 15)
    .gte('updated_at', cutoff.toISOString())
    .limit(5000);

  if (assetError || !assets) {
    return { mandatesProcessed: 0, matchesCreated: 0, errors: [assetError?.message || 'No assets found'], timedOut: false };
  }

  for (const mandate of mandates) {
    if (Date.now() - startTime > MAX_RUNTIME_MS) { timedOut = true; break; }

    // Get existing matches to avoid duplicates
    const { data: existingMatches } = await supabase
      .from('radar_mandate_matches')
      .select('asset_id')
      .eq('mandate_id', mandate.id);

    const existingAssetIds = new Set((existingMatches || []).map(m => m.asset_id));

    const newMatches: {
      mandate_id: string;
      asset_id: string;
      user_id: string;
      match_score: number;
      match_reasons: string[];
    }[] = [];

    for (const asset of assets) {
      if (existingAssetIds.has(asset.id)) continue;

      const { matches, reasons } = matchAssetToMandate(asset, mandate);
      if (!matches) continue;

      const score = computeMatchScore(asset, reasons);
      newMatches.push({
        mandate_id: mandate.id,
        asset_id: asset.id,
        user_id: mandate.user_id,
        match_score: score,
        match_reasons: reasons,
      });
    }

    // Batch insert new matches
    if (newMatches.length > 0) {
      const { error: insertError } = await supabase
        .from('radar_mandate_matches')
        .insert(newMatches);

      if (insertError) {
        errors.push(`Match insert error for mandate ${mandate.id}: ${insertError.message}`);
      } else {
        matchesCreated += newMatches.length;

        // Update mandate stats
        await supabase
          .from('radar_user_mandates')
          .update({
            last_matched_at: new Date().toISOString(),
            match_count: (mandate as unknown as { match_count: number }).match_count + newMatches.length,
          })
          .eq('id', mandate.id);
      }
    }

    mandatesProcessed++;
  }

  // Log
  const duration = Math.round((Date.now() - startTime) / 1000);
  await supabase.from('data_ingestion_log').insert({
    source: 'mandate_matcher',
    status: errors.length > 0 ? 'partial' : 'success',
    records_processed: mandatesProcessed,
    records_inserted: matchesCreated,
    duration_seconds: duration,
    error_details: errors.length > 0 ? errors.slice(0, 20) : null,
    metadata: { total_mandates: mandates.length, total_assets: assets.length, timed_out: timedOut },
  });

  console.log(`[mandate-matcher] Done: ${mandatesProcessed} mandates, ${matchesCreated} matches created, ${errors.length} errors, ${duration}s${timedOut ? ' (timed out)' : ''}`);

  return { mandatesProcessed, matchesCreated, errors, timedOut };
}
