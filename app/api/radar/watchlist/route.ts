/**
 * Asset Radar — Watchlist API
 *
 * GET  /api/radar/watchlist — list user's watched assets with current scores
 * POST /api/radar/watchlist — add asset to watchlist { asset_id, tags?, notes?, priority? }
 * DELETE /api/radar/watchlist?asset_id=UUID — remove from watchlist
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveUserTier } from '@/lib/auth/tier-check';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await resolveUserTier();
  if (!auth.userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const supabase = createServiceClient();

  const { data: watchlist } = await supabase
    .from('radar_watchlist')
    .select('id, asset_id, added_at, score_at_add, tags, notes, priority')
    .eq('user_id', auth.userId)
    .order('added_at', { ascending: false });

  if (!watchlist || watchlist.length === 0) {
    return NextResponse.json({ watchlist: [], assets: [], total: 0 });
  }

  // Fetch current asset data for all watched assets
  const assetIds = watchlist.map(w => w.asset_id);
  const { data: assets } = await supabase
    .from('clinical_assets')
    .select('id, company_name, asset_name, modality, therapeutic_area, indication_category, phase, trial_status, trial_count, partnership_status, licensing_intent_score, competitive_heat, deal_readiness_score, confidence_score, originator_country, last_update_date, territory_rights_available, nct_ids, enrollment_total, partner_company_name')
    .in('id', assetIds);

  // Merge watchlist metadata with asset data
  const assetMap = new Map((assets || []).map(a => [a.id, a]));
  const enriched = watchlist.map(w => ({
    ...w,
    asset: assetMap.get(w.asset_id) || null,
    score_change: assetMap.get(w.asset_id)
      ? Math.round(Number((assetMap.get(w.asset_id) as Record<string, unknown>).licensing_intent_score || 0) - Number(w.score_at_add || 0))
      : 0,
  }));

  return NextResponse.json({
    watchlist: enriched,
    total: enriched.length,
  });
}

export async function POST(request: NextRequest) {
  const auth = await resolveUserTier();
  if (!auth.userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const body = await request.json();
  const { asset_id, tags, notes, priority } = body;

  if (!asset_id) {
    return NextResponse.json({ error: 'asset_id required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Get current score for tracking
  const { data: asset } = await supabase
    .from('clinical_assets')
    .select('licensing_intent_score')
    .eq('id', asset_id)
    .single();

  const { data, error } = await supabase
    .from('radar_watchlist')
    .upsert({
      user_id: auth.userId,
      asset_id,
      score_at_add: asset?.licensing_intent_score || 0,
      tags: tags || [],
      notes: notes || null,
      priority: priority || 'normal',
    }, { onConflict: 'user_id,asset_id' })
    .select()
    .single();

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true, item: data });
}

export async function DELETE(request: NextRequest) {
  const auth = await resolveUserTier();
  if (!auth.userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const assetId = request.nextUrl.searchParams.get('asset_id');
  if (!assetId) {
    return NextResponse.json({ error: 'asset_id required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { error } = await supabase
    .from('radar_watchlist')
    .delete()
    .eq('user_id', auth.userId)
    .eq('asset_id', assetId);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }

  return NextResponse.json({ success: true });
}
