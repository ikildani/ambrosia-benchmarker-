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
import { modalitiesMatch, phaseKey } from '@/lib/comparables/match-normalize';
import { phaseRank as sharedPhaseRank } from '@/lib/comparable-scoring';
import { radarPhaseToDb } from './deal-thesis';
import { logRadarRun, deriveRunStatus } from './run-log';

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
  match_count: number | null;
  created_at: string | null;
  updated_at: string | null;
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
  /** Mandates created/updated in the last 24h that were scanned against the full pool. */
  newMandates: number;
  /** False when the data_ingestion_log insert failed. */
  logWritten: boolean;
}

// ═══════════════════════════════════════════════════════════════════════
// PHASE ORDERING (for range matching)
// ═══════════════════════════════════════════════════════════════════════

/**
 * Rank on the shared ladder. Mandates store 'phase 2' / 'Phase 2', assets
 * store 'phase_2' / 'phase1_phase2' — both go through the Radar → DB map and
 * the shared normalizer so they land on the same ladder. 0 = unknown.
 */
function phaseRank(phase: string | null): number {
  const key = phaseKey(radarPhaseToDb(phase));
  if (key === 'unknown') return 0;
  return (sharedPhaseRank(key) ?? -1) + 1;
}

const norm = (s: string | null | undefined) => (s || '').toLowerCase().trim();

// ═══════════════════════════════════════════════════════════════════════
// MATCHING LOGIC
// ═══════════════════════════════════════════════════════════════════════

function matchAssetToMandate(asset: Asset, mandate: Mandate): { matches: boolean; reasons: string[] } {
  const reasons: string[] = [];

  // TA filter
  if (mandate.therapeutic_areas.length > 0) {
    const assetTA = norm(asset.therapeutic_area);
    if (!assetTA || !mandate.therapeutic_areas.some(ta => norm(ta) === assetTA)) {
      return { matches: false, reasons: [] };
    }
    reasons.push(`TA: ${asset.therapeutic_area}`);
  }

  // Modality filter (alias/family aware: 'mab' matches 'antibody', 'adc_her2' matches 'adc')
  if (mandate.modalities.length > 0) {
    if (!asset.modality || !mandate.modalities.some(m => modalitiesMatch(m, asset.modality))) {
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
    // An unparseable bound is treated as unbounded rather than excluding everything.
    const lo = minRank || 0;
    const hi = maxRank || 99;
    if (rank < lo || rank > hi) {
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
const ASSET_SELECT = 'id, therapeutic_area, modality, phase, originator_country, originator_region, partnership_status, licensing_intent_score, deal_readiness_score, confidence_score';
const FULL_POOL_CAP = 5000;
const NEW_MANDATE_WINDOW_MS = 24 * 60 * 60 * 1000;

function isNewMandate(m: Mandate, now: number): boolean {
  const stamp = Math.max(
    m.updated_at ? new Date(m.updated_at).getTime() : 0,
    m.created_at ? new Date(m.created_at).getTime() : 0,
  );
  return stamp > 0 && now - stamp <= NEW_MANDATE_WINDOW_MS;
}

export async function runMandateMatching(supabase: SupabaseClient): Promise<MatchResult> {
  const startTime = Date.now();
  const errors: string[] = [];
  let mandatesProcessed = 0;
  let matchesCreated = 0;
  let existingMatchesSeen = 0;
  let newMandates = 0;
  let timedOut = false;

  const fail = async (message: string): Promise<MatchResult> => {
    const logWritten = await logRadarRun(supabase, { source: 'mandate_matcher', startedAt: startTime, status: 'failed', errors: [message] });
    return { mandatesProcessed: 0, matchesCreated: 0, errors: [message], timedOut: false, newMandates: 0, logWritten };
  };

  // Fetch all active mandates
  const { data: mandates, error: mandateError } = await supabase
    .from('radar_user_mandates')
    .select('id, user_id, therapeutic_areas, modalities, phase_min, phase_max, countries, regions, partnership_statuses, min_licensing_intent, min_deal_readiness, min_confidence, match_count, created_at, updated_at')
    .eq('is_active', true);

  if (mandateError) return fail(mandateError.message);
  if (!mandates || mandates.length === 0) {
    const logWritten = await logRadarRun(supabase, {
      source: 'mandate_matcher', startedAt: startTime, status: 'completed', fetched: 0, notes: 'No active mandates',
    });
    return { mandatesProcessed: 0, matchesCreated: 0, errors: [], timedOut: false, newMandates: 0, logWritten };
  }

  // Candidate window for established mandates: assets touched in the last 7 days.
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - 7);

  const { data: recentAssets, error: assetError } = await supabase
    .from('clinical_assets')
    .select(ASSET_SELECT)
    .gte('confidence_score', 15)
    .gte('updated_at', cutoff.toISOString())
    .limit(FULL_POOL_CAP);

  if (assetError || !recentAssets) return fail(assetError?.message || 'No assets found');

  // New mandates (created/updated in the last 24h) must see the whole
  // unpartnered pool, not just this week's updates — otherwise a fresh mandate
  // starts empty and only fills as assets happen to be re-enriched.
  let fullPool: Asset[] | null = null;
  const loadFullPool = async (): Promise<Asset[]> => {
    if (fullPool) return fullPool;
    const { data, error } = await supabase
      .from('clinical_assets')
      .select(ASSET_SELECT)
      .in('partnership_status', ['unpartnered', 'partially_partnered'])
      .gte('confidence_score', 15)
      .order('licensing_intent_score', { ascending: false, nullsFirst: false })
      .limit(FULL_POOL_CAP);
    if (error) {
      errors.push(`Full pool fetch error: ${error.message}`);
      fullPool = recentAssets as Asset[];
    } else {
      fullPool = (data || []) as Asset[];
    }
    return fullPool;
  };

  for (const mandate of mandates as Mandate[]) {
    if (Date.now() - startTime > MAX_RUNTIME_MS) { timedOut = true; break; }

    const fresh = isNewMandate(mandate, startTime);
    if (fresh) newMandates++;
    const candidates: Asset[] = fresh ? await loadFullPool() : (recentAssets as Asset[]);

    // Get existing matches to avoid duplicates
    const { data: existingMatches } = await supabase
      .from('radar_mandate_matches')
      .select('asset_id')
      .eq('mandate_id', mandate.id);

    const existingAssetIds = new Set((existingMatches || []).map(m => m.asset_id));
    existingMatchesSeen += existingAssetIds.size;

    const newMatches: {
      mandate_id: string;
      asset_id: string;
      user_id: string;
      match_score: number;
      match_reasons: string[];
    }[] = [];

    for (const asset of candidates) {
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
        const { error: statsError } = await supabase
          .from('radar_user_mandates')
          .update({
            last_matched_at: new Date().toISOString(),
            match_count: (mandate.match_count ?? 0) + newMatches.length,
          })
          .eq('id', mandate.id);
        if (statsError) errors.push(`Mandate stats update error ${mandate.id}: ${statsError.message}`);
      }
    } else {
      await supabase
        .from('radar_user_mandates')
        .update({ last_matched_at: new Date().toISOString() })
        .eq('id', mandate.id);
    }

    mandatesProcessed++;
  }

  // "Produced" counts new matches plus matches already on file for the
  // processed mandates: a steady-state day with nothing new but standing
  // matches is healthy; a run where no mandate has any match is partial.
  const status = deriveRunStatus({
    errors: errors.length,
    timedOut,
    processed: mandatesProcessed,
    produced: matchesCreated + existingMatchesSeen,
  });
  const logWritten = await logRadarRun(supabase, {
    source: 'mandate_matcher',
    startedAt: startTime,
    status,
    fetched: mandates.length,
    processed: mandatesProcessed,
    inserted: matchesCreated,
    failed: errors.length,
    errors,
    parameters: {
      total_mandates: mandates.length,
      new_mandates: newMandates,
      recent_assets: recentAssets.length,
      // fullPool is assigned inside a closure, so TS narrows it to null here.
      full_pool_assets: (fullPool as Asset[] | null)?.length ?? null,
      existing_matches_seen: existingMatchesSeen,
      timed_out: timedOut,
    },
  });

  const duration = Math.round((Date.now() - startTime) / 1000);
  console.log(`[mandate-matcher] Done: ${mandatesProcessed} mandates (${newMandates} new), ${matchesCreated} matches created, ${errors.length} errors, ${duration}s${timedOut ? ' (timed out)' : ''}`);

  return { mandatesProcessed, matchesCreated, errors, timedOut, newMandates, logWritten };
}
