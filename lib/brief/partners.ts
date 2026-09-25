/**
 * Deal Intelligence Brief v3 — partner supply for the buyer map.
 *
 * Why this exists (Sep 2026): the brief used to POST to
 * https://solidus.ambrosiaventures.co/api/partners/match with `tier: 'pro'`
 * in the body. That endpoint ignores the body tier (security) and resolves the
 * tier from the session cookie or user id — neither is present on a
 * server-to-server call — so the brief was served the FREE tier: three
 * matches, profiles locked (deals_last_12mo, pharma_intent, strategic_context
 * and phase preference all null). A preclinical Alzheimer's antibody therefore
 * arrived with Biogen, Roche and Neurocrine only, and the buyer map had to be
 * padded from deal history. The match layer itself had 310 companies scoring
 * >= 15 for that asset; the first mid-sized buyer sits at rank 34, so a Pro
 * page of 10 would still have been all large pharma.
 *
 * The brief runs with a service-role client, so it calls the matching library
 * directly: no HTTP hop, no tier gating, no rate limit, no analytics insert,
 * full Pro fields, and a pool deep enough for the composition rule in
 * lib/brief/buyer-map.ts (BRIEF_PARTNER_POOL). The web endpoint and its tier
 * limits are untouched.
 *
 * Read-only: findPartnerMatches only selects.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { findPartnerMatches } from '@/lib/services/partner-matching';
import type { PartnerInput } from './buyer-map';

/**
 * How many ranked matches the brief pulls into the buyer pool. The buyer map
 * selects 12 from this pool with a size-mix rule, so the pool has to reach
 * past the large-cap block at the top of the ranking (mid-sized buyers first
 * appear around rank 30–35 for large indications).
 */
export const BRIEF_PARTNER_POOL = 40;

/**
 * Score floor applied to the pool. The match layer already drops anything
 * below 15; the brief keeps that floor (a lower one adds noise, not buyers).
 */
export const BRIEF_PARTNER_MIN_SCORE = 15;

export interface BriefPartnerInput {
  modality: string;
  phase: string;
  indication: string;
  territory: string;
  therapeuticArea: string;
  /** Desired structure from intake (license, option, acquisition …); optional. */
  dealType?: string | null;
}

export async function fetchBriefPartners(
  supabase: SupabaseClient,
  input: BriefPartnerInput,
  opts: { limit?: number; minScore?: number; log?: (m: string) => void } = {},
): Promise<PartnerInput[]> {
  const limit = opts.limit ?? BRIEF_PARTNER_POOL;
  const minScore = opts.minScore ?? BRIEF_PARTNER_MIN_SCORE;
  const log = opts.log ?? (() => undefined);
  try {
    const result = await findPartnerMatches(supabase, {
      modality: input.modality,
      development_phase: input.phase,
      indication_category: input.indication || null,
      indication_specific: null,
      territory_scope: input.territory || null,
      therapeutic_area: input.therapeuticArea || null,
      dealType: input.dealType || undefined,
    }, { limit, includeEnhancedBreakdown: true });

    const partners: PartnerInput[] = result.matches
      .filter(m => m.company_name && m.match_score >= minScore)
      .map(m => ({
        company_name: m.company_name,
        company_id: m.company_id ?? null,
        match_score: m.match_score,
        match_reasons: m.match_reasons ?? [],
        deals_last_12mo: m.deals_last_12mo ?? 0,
        hq_country: m.hq_country ?? null,
        strategic_context: m.strategic_context ?? null,
        pharma_intent: m.pharma_intent ?? null,
        company_type: m.company_type ?? null,
        deals_last_24mo: m.deals_last_24mo ?? null,
        last_deal_date: m.last_deal_date ?? null,
        phase_preference_min: m.phase_preference_min ?? null,
        phase_preference_max: m.phase_preference_max ?? null,
        acquisition_appetite: m.acquisition_appetite ?? null,
        median_upfront_usd: m.median_upfront_usd ?? null,
        source: 'partner_match' as const,
      }));
    log(`[partners] ${partners.length} of ${result.total_matches} matches (pool ${limit}, floor ${minScore})`);
    return partners;
  } catch (err) {
    log(`[partners] failed: ${(err as Error).message}`);
    return [];
  }
}
