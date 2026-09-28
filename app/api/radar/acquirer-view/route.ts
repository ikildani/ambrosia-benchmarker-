/**
 * Search & Evaluation — Acquirer Perspective View
 *
 * GET /api/radar/acquirer-view?company_id=UUID   (or ?company=Pfizer, name match)
 *   "I am Pfizer — show me every program I should be looking at."
 *   Returns the acquirer profile, its open opportunities joined to the asset
 *   (one per asset, feed exclusions applied at read time), grouped by gap type.
 *
 * GET /api/radar/acquirer-view?top=20
 *   Acquirers ranked by open opportunity count (grouped by company id).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveUserTier } from '@/lib/auth/tier-check';
import { isUuid, sanitizeSearchTerm } from '@/app/api/radar/_lib/radar-api';
import {
  buildLeaderboard,
  dedupeOpportunities,
  groupByGap,
  opportunityEligible,
  type OpportunityAsset,
  type OpportunityRow,
  type OpportunityWithAsset,
} from '@/lib/radar/acquirer-view';

export const dynamic = 'force-dynamic';

const ASSET_SELECT =
  'id, asset_name, company_name, company_id, phase, modality, therapeutic_area, indication_specific, partnership_status, ownership_status, licensing_intent_score, score_pct_peer, originator_country, asset_origin';
const COMPANY_SELECT =
  'id, name, company_type, hq_country, modalities_active, modalities_primary, indications_active, deals_last_12mo, deals_last_24mo, acquisition_appetite, revenue_at_risk_2026, revenue_at_risk_2027, patent_cliffs, strategic_priorities, active_trials_count';
const OPPORTUNITY_LIMIT = 300;
const LEADERBOARD_SCAN = 5_000;
const PAGE = 1_000;

export async function GET(request: NextRequest) {
  // Search & Evaluation intelligence is Pro-only: this endpoint returns scored data
  // from the asset universe, so anonymous and free-tier callers are rejected.
  const auth = await resolveUserTier();
  if (!auth.hasProAccess) {
    return NextResponse.json({ error: 'Pro access required' }, { status: 403 });
  }

  const sp = request.nextUrl.searchParams;
  const companyId = sp.get('company_id');
  if (companyId && !isUuid(companyId)) return NextResponse.json({ error: 'company_id must be a UUID' }, { status: 400 });
  // Free text goes into an ilike pattern: strip PostgREST/LIKE metacharacters.
  const companyName = sanitizeSearchTerm(sp.get('company')) || null;
  const top = parseInt(sp.get('top') || '0', 10);

  const supabase = createServiceClient();

  // ── Single acquirer view ───────────────────────────
  if (companyId || companyName) {
    let q = supabase.from('companies').select(COMPANY_SELECT).limit(1);
    q = companyId ? q.eq('id', companyId) : q.ilike('name', `%${companyName}%`).order('deals_last_24mo', { ascending: false, nullsFirst: false });
    const { data: company } = await q.maybeSingle();
    if (!company) {
      return NextResponse.json({ error: 'Company not found' }, { status: 404 });
    }

    const { data: opps, error } = await supabase
      .from('radar_deal_opportunities')
      .select('*')
      .eq('acquirer_company_id', company.id)
      .neq('status', 'dismissed')
      .order('opportunity_score', { ascending: false })
      .limit(OPPORTUNITY_LIMIT);
    if (error) {
      console.error('[radar/acquirer-view] opportunities error:', error.message);
      return NextResponse.json({ error: 'Failed to load opportunities' }, { status: 500 });
    }
    const rows = (opps || []) as OpportunityRow[];

    const assetIds = Array.from(new Set(rows.map(r => r.asset_id)));
    const assetById = new Map<string, OpportunityAsset>();
    for (let i = 0; i < assetIds.length; i += 500) {
      const { data } = await supabase.from('clinical_assets').select(ASSET_SELECT).in('id', assetIds.slice(i, i + 500));
      for (const a of (data || []) as OpportunityAsset[]) assetById.set(a.id, a);
    }

    const joined: OpportunityWithAsset[] = rows.map(r => ({ ...r, asset: assetById.get(r.asset_id) ?? null }));
    const eligible = dedupeOpportunities(joined.filter(r => opportunityEligible(r.asset)));
    const excluded = joined.length - eligible.length;
    const byGap = groupByGap(eligible);

    const totalRevAtRisk = (Number(company.revenue_at_risk_2026) || 0) + (Number(company.revenue_at_risk_2027) || 0);
    const scores = eligible.map(o => Number(o.opportunity_score) || 0);

    return NextResponse.json({
      acquirer: {
        ...company,
        revenue_at_risk_total: totalRevAtRisk,
        revenue_at_risk_display: totalRevAtRisk > 0 ? `$${(totalRevAtRisk / 1_000_000_000).toFixed(1)}B` : null,
      },
      opportunities: eligible,
      by_gap_type: byGap,
      total_opportunities: eligible.length,
      excluded_opportunities: excluded,
      generated_at: rows.reduce<string | null>((max, r) => (!max || r.generated_at > max ? r.generated_at : max), null),
      summary: {
        gap_types: byGap.length,
        top_opportunity: eligible[0] ?? null,
        avg_score: scores.length ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length) : 0,
      },
    });
  }

  // ── Top acquirers leaderboard ──────────────────────
  if (top > 0) {
    const rows: Array<{ acquirer_company_id: string; acquirer_name: string; opportunity_score: number }> = [];
    for (let from = 0; from < LEADERBOARD_SCAN; from += PAGE) {
      const { data, error } = await supabase
        .from('radar_deal_opportunities')
        .select('acquirer_company_id, acquirer_name, opportunity_score')
        .neq('status', 'dismissed')
        .order('id', { ascending: true })
        .range(from, from + PAGE - 1);
      if (error) {
        console.error('[radar/acquirer-view] leaderboard error:', error.message);
        return NextResponse.json({ error: 'Failed to load acquirers' }, { status: 500 });
      }
      const page = (data || []) as typeof rows;
      rows.push(...page);
      if (page.length < PAGE) break;
    }
    const acquirers = buildLeaderboard(rows, top);
    return NextResponse.json({ acquirers, total: acquirers.length, scanned: rows.length });
  }

  return NextResponse.json({
    error: 'Provide company_id, company or top',
    usage: {
      single_acquirer: '/api/radar/acquirer-view?company_id=UUID',
      by_name: '/api/radar/acquirer-view?company=Pfizer',
      leaderboard: '/api/radar/acquirer-view?top=20',
    },
  }, { status: 400 });
}
