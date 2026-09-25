/**
 * Search & Evaluation — compare tray.
 *
 * GET /api/radar/compare?ids=UUID,UUID[,UUID,UUID,UUID]
 *   → { assets: CompareAsset[] } in the requested order (2 to 5 assets).
 *
 * Three queries: the asset rows with the owner type joined, the active
 * scoring factors for those assets (top three per asset by score), and the
 * deal thesis rows for predicted terms. Pro-gated like the feed.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveUserTier } from '@/lib/auth/tier-check';
import { isUuid } from '@/app/api/radar/_lib/radar-api';
import type { OwnerType, PartnershipStatus } from '@/lib/radar/types';
import { COMPARE_LIMIT } from '@/lib/radar/client/filter-schema';
import type { CompareAsset, CompareFactor, CompareResponse, CompareTerms } from '@/lib/radar/client/api-types';

export const dynamic = 'force-dynamic';

const ASSET_SELECT =
  'id, asset_name, company_name, company_id, originator_country, originator_region, phase, modality, therapeutic_area, indication_category, indication_specific, target, mechanism, partnership_status, partner_company_name, territory_rights_available, regulatory_designations, trial_count, enrollment_total, licensing_intent_score, score_confidence, deal_readiness_score, competitive_heat, last_update_date, score_probability, score_pct_peer, score_peer_n, score_peer_key, score_base_rate, score_top_drivers, companies(owner_type)';

interface AssetRow {
  id: string;
  asset_name: string;
  company_name: string;
  company_id: string | null;
  originator_country: string | null;
  originator_region: string | null;
  phase: string | null;
  modality: string | null;
  therapeutic_area: string | null;
  indication_category: string | null;
  indication_specific: string | null;
  target: string | null;
  mechanism: string | null;
  partnership_status: PartnershipStatus | null;
  partner_company_name: string | null;
  territory_rights_available: string[] | null;
  regulatory_designations: string[] | null;
  trial_count: number | null;
  enrollment_total: number | null;
  licensing_intent_score: number | null;
  score_confidence: number | null;
  deal_readiness_score: number | null;
  competitive_heat: number | null;
  last_update_date: string | null;
  /** Migration 126; numerics arrive as strings from PostgREST. */
  score_probability?: number | string | null;
  score_pct_peer?: number | string | null;
  score_peer_n?: number | string | null;
  score_peer_key?: string | null;
  score_base_rate?: number | string | null;
  score_top_drivers?: unknown;
  companies: { owner_type: string | null } | { owner_type: string | null }[] | null;
}

interface SignalRow {
  asset_id: string;
  signal_type: string;
  signal_value: number | null;
  confidence: number | null;
  evidence_text: string | null;
}

interface ThesisRow {
  asset_id: string;
  predicted_upfront_low: number | null;
  predicted_upfront_mid: number | null;
  predicted_upfront_high: number | null;
  predicted_total_low: number | null;
  predicted_total_mid: number | null;
  predicted_total_high: number | null;
  predicted_royalty_low: number | null;
  predicted_royalty_mid: number | null;
  predicted_royalty_high: number | null;
  comp_count: number | null;
  thesis_confidence: number | null;
  comp_relaxation: string | null;
  insufficient_comps: boolean | null;
}

const OWNER_TYPES: OwnerType[] = ['industry', 'academic', 'government', 'hospital', 'network', 'cro', 'other', 'unknown'];

function ownerTypeOf(row: AssetRow): OwnerType {
  const c = Array.isArray(row.companies) ? row.companies[0] : row.companies;
  const v = c?.owner_type;
  return v && (OWNER_TYPES as string[]).includes(v) ? (v as OwnerType) : 'unknown';
}

function num(v: number | string | null | undefined): number | null {
  if (v === null || v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

export async function GET(request: NextRequest) {
  const auth = await resolveUserTier();
  if (!auth.hasProAccess) {
    return NextResponse.json({ error: 'Pro access required' }, { status: 403 });
  }

  const idsParam = request.nextUrl.searchParams.get('ids');
  if (!idsParam) {
    return NextResponse.json({ error: 'ids parameter required (comma-separated UUIDs)' }, { status: 400 });
  }

  // Only well-formed UUIDs reach the `.in()` filter; anything else is dropped.
  const ids = Array.from(new Set(idsParam.split(',').map(id => id.trim()).filter(isUuid))).slice(0, COMPARE_LIMIT);
  if (ids.length < 2) {
    return NextResponse.json({ error: 'At least two asset ids are required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const [assetsRes, signalsRes, thesesRes] = await Promise.all([
    supabase.from('clinical_assets').select(ASSET_SELECT).in('id', ids),
    supabase
      .from('licensing_signals')
      .select('asset_id, signal_type, signal_value, confidence, evidence_text')
      .in('asset_id', ids)
      .eq('is_active', true)
      .order('signal_value', { ascending: false, nullsFirst: false }),
    supabase
      .from('radar_deal_theses')
      .select(
        'asset_id, predicted_upfront_low, predicted_upfront_mid, predicted_upfront_high, predicted_total_low, predicted_total_mid, predicted_total_high, predicted_royalty_low, predicted_royalty_mid, predicted_royalty_high, comp_count, thesis_confidence, comp_relaxation, insufficient_comps',
      )
      .in('asset_id', ids),
  ]);

  if (assetsRes.error) {
    console.error('[radar/compare] assets error:', assetsRes.error.message);
    return NextResponse.json({ error: 'Failed to load assets' }, { status: 500 });
  }
  if (signalsRes.error) console.warn('[radar/compare] signals unavailable:', signalsRes.error.message);
  if (thesesRes.error) console.warn('[radar/compare] theses unavailable:', thesesRes.error.message);

  const assetRows = (assetsRes.data ?? []) as unknown as AssetRow[];
  if (assetRows.length === 0) {
    return NextResponse.json({ error: 'No assets found' }, { status: 404 });
  }

  const factorsByAsset = new Map<string, CompareFactor[]>();
  for (const s of (signalsRes.data ?? []) as SignalRow[]) {
    const list = factorsByAsset.get(s.asset_id) ?? [];
    if (list.length >= 3) continue;
    list.push({
      factor: s.signal_type,
      score: num(s.signal_value) ?? 0,
      confidence: num(s.confidence) ?? 0,
      evidence_text: s.evidence_text,
    });
    factorsByAsset.set(s.asset_id, list);
  }

  const termsByAsset = new Map<string, CompareTerms>();
  for (const t of (thesesRes.data ?? []) as ThesisRow[]) {
    termsByAsset.set(t.asset_id, {
      upfront_low: num(t.predicted_upfront_low),
      upfront_mid: num(t.predicted_upfront_mid),
      upfront_high: num(t.predicted_upfront_high),
      total_low: num(t.predicted_total_low),
      total_mid: num(t.predicted_total_mid),
      total_high: num(t.predicted_total_high),
      royalty_low: num(t.predicted_royalty_low),
      royalty_mid: num(t.predicted_royalty_mid),
      royalty_high: num(t.predicted_royalty_high),
      comp_count: num(t.comp_count) ?? 0,
      confidence: num(t.thesis_confidence) ?? 0,
      relaxation: t.comp_relaxation,
      insufficient_comps: t.insufficient_comps === true,
    });
  }

  const byId = new Map(assetRows.map(r => [r.id, r]));
  const assets: CompareAsset[] = [];
  for (const id of ids) {
    const r = byId.get(id);
    if (!r) continue;
    const { companies: _companies, ...rest } = r; // eslint-disable-line @typescript-eslint/no-unused-vars
    assets.push({
      ...rest,
      licensing_intent_score: num(r.licensing_intent_score),
      score_probability: num(r.score_probability),
      score_pct_peer: num(r.score_pct_peer),
      score_peer_n: num(r.score_peer_n),
      score_peer_key: (r.score_peer_key as string | null) ?? null,
      score_base_rate: num(r.score_base_rate),
      score_top_drivers: Array.isArray(r.score_top_drivers) ? (r.score_top_drivers as CompareAsset['score_top_drivers']) : [],
      score_confidence: num(r.score_confidence),
      deal_readiness_score: num(r.deal_readiness_score),
      competitive_heat: num(r.competitive_heat),
      owner_type: ownerTypeOf(r),
      factors: factorsByAsset.get(id) ?? [],
      terms: termsByAsset.get(id) ?? null,
    });
  }

  const body: CompareResponse = { assets };
  return NextResponse.json(body, { headers: { 'Cache-Control': 'private, max-age=60' } });
}
