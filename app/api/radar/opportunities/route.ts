/**
 * Asset Radar — Deal Opportunities API
 *
 * GET /api/radar/opportunities?top=20
 *   Top N proposed deals by opportunity score.
 *
 * GET /api/radar/opportunities?acquirer=Pfizer
 *   Proposed deals for a specific acquirer.
 *
 * GET /api/radar/opportunities?asset_id=UUID
 *   Who should acquire this specific asset.
 *
 * GET /api/radar/opportunities?gap_type=patent_cliff_replacement
 *   Opportunities driven by a specific portfolio gap.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const top = parseInt(searchParams.get('top') || '0', 10);
  const acquirerName = searchParams.get('acquirer');
  const assetId = searchParams.get('asset_id');
  const gapType = searchParams.get('gap_type');
  const minScore = parseInt(searchParams.get('min_score') || '0', 10);

  const supabase = createServiceClient();

  // ── Top opportunities overall ──────────────────────
  if (top > 0 || (!acquirerName && !assetId)) {
    let query = supabase
      .from('radar_deal_opportunities')
      .select('*')
      .neq('status', 'dismissed')
      .order('opportunity_score', { ascending: false })
      .limit(Math.min(top || 20, 100));

    if (gapType) query = query.eq('gap_type', gapType);
    if (minScore > 0) query = query.gte('opportunity_score', minScore);

    const { data: opportunities, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      opportunities: opportunities || [],
      count: opportunities?.length || 0,
    });
  }

  // ── By acquirer ────────────────────────────────────
  if (acquirerName) {
    const { data: opportunities } = await supabase
      .from('radar_deal_opportunities')
      .select('*')
      .ilike('acquirer_name', `%${acquirerName}%`)
      .neq('status', 'dismissed')
      .order('opportunity_score', { ascending: false })
      .limit(50);

    // Group by gap type
    const byGap: Record<string, typeof opportunities> = {};
    if (opportunities) {
      for (const opp of opportunities) {
        const key = opp.gap_type || 'other';
        if (!byGap[key]) byGap[key] = [];
        byGap[key]!.push(opp);
      }
    }

    return NextResponse.json({
      acquirer: acquirerName,
      opportunities: opportunities || [],
      by_gap_type: byGap,
      count: opportunities?.length || 0,
    });
  }

  // ── By asset (who should acquire this?) ────────────
  if (assetId) {
    const [assetResult, oppsResult] = await Promise.all([
      supabase
        .from('clinical_assets')
        .select('id, company_name, asset_name, modality, therapeutic_area, phase, licensing_intent_score, competitive_heat, deal_readiness_score')
        .eq('id', assetId)
        .single(),

      supabase
        .from('radar_deal_opportunities')
        .select('*')
        .eq('asset_id', assetId)
        .neq('status', 'dismissed')
        .order('opportunity_score', { ascending: false })
        .limit(20),
    ]);

    if (assetResult.error || !assetResult.data) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    return NextResponse.json({
      asset: assetResult.data,
      proposed_acquirers: oppsResult.data || [],
      count: oppsResult.data?.length || 0,
    });
  }

  return NextResponse.json({
    error: 'Provide top, acquirer, asset_id, or gap_type parameter',
    usage: {
      top_deals: '/api/radar/opportunities?top=20',
      by_acquirer: '/api/radar/opportunities?acquirer=Pfizer',
      by_asset: '/api/radar/opportunities?asset_id=UUID',
      by_gap: '/api/radar/opportunities?gap_type=patent_cliff_replacement',
    },
  }, { status: 400 });
}
