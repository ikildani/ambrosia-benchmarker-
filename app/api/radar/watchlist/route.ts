/**
 * Asset Radar — Watchlist API (team-aware)
 *
 * GET    /api/radar/watchlist?scope=mine|team&include=activity
 *          mine (default): the caller's rows. team: the caller's rows plus
 *          every row shared into their active team (radar_watchlist.team_id,
 *          migration 118). include=activity adds recent score moves for the
 *          returned assets (snapshot deltas, last 30 days) plus each asset's
 *          current score.
 * POST   /api/radar/watchlist   { asset_id, tags?, notes?, priority? }
 *          Insert (team_id = caller's active team) or update the caller's row
 *          without resetting score_at_add.
 * PATCH  /api/radar/watchlist?asset_id=UUID  { tags?, notes?, priority? }
 * DELETE /api/radar/watchlist?asset_id=UUID
 *
 * Auth-only (not Pro): the watchlist is the free-tier hook into Radar.
 */

import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveUserTier } from '@/lib/auth/tier-check';
import { isUuid, uuidSchema } from '@/app/api/radar/_lib/radar-api';

export const dynamic = 'force-dynamic';

type ServiceClient = ReturnType<typeof createServiceClient>;
type Row = Record<string, unknown>;

const fieldsSchema = z.object({
  tags: z.array(z.string().trim().min(1).max(40)).max(10),
  notes: z.string().trim().max(2000).nullable(),
  priority: z.enum(['high', 'normal', 'low']),
});

const addSchema = fieldsSchema.partial().extend({ asset_id: uuidSchema });
const patchSchema = fieldsSchema.partial();

const ASSET_COLUMNS = 'id, company_name, asset_name, modality, therapeutic_area, indication_category, phase, trial_status, trial_count, partnership_status, licensing_intent_score, score_confidence, competitive_heat, deal_readiness_score, confidence_score, originator_country, originator_region, last_update_date, last_scored_at, territory_rights_available, nct_ids, enrollment_total, partner_company_name';

async function activeTeam(supabase: ServiceClient, userId: string): Promise<{ id: string; name: string } | null> {
  const { data: membership } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  const teamId = (membership as { team_id?: string } | null)?.team_id;
  if (!teamId) return null;
  const { data: team } = await supabase.from('teams').select('id, name').eq('id', teamId).maybeSingle();
  return team ? { id: String(team.id), name: String(team.name) } : { id: teamId, name: 'Team' };
}

function displayName(fullName: string | null | undefined): string {
  const name = (fullName || '').trim();
  if (!name) return 'Teammate';
  const parts = name.split(/\s+/);
  if (parts.length === 1) return parts[0];
  return `${parts[0]} ${parts[parts.length - 1].charAt(0).toUpperCase()}.`;
}

export async function GET(request: NextRequest) {
  const auth = await resolveUserTier();
  if (!auth.userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const sp = request.nextUrl.searchParams;
  const scope = sp.get('scope') === 'team' ? 'team' : 'mine';
  const includeActivity = (sp.get('include') || '').split(',').includes('activity');

  const supabase = createServiceClient();
  const team = await activeTeam(supabase, auth.userId);

  let query = supabase
    .from('radar_watchlist')
    .select('id, user_id, team_id, asset_id, added_at, score_at_add, tags, notes, priority, updated_at')
    .order('added_at', { ascending: false })
    .limit(500);
  query = scope === 'team' && team
    ? query.or(`user_id.eq.${auth.userId},team_id.eq.${team.id}`)
    : query.eq('user_id', auth.userId);

  const { data: watchlist, error } = await query;
  if (error) {
    console.error('[radar/watchlist] GET error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch watchlist' }, { status: 500 });
  }
  const rows = (watchlist || []) as Row[];
  if (rows.length === 0) {
    return NextResponse.json({ watchlist: [], total: 0, scope, team, activity: [] });
  }

  const assetIds = Array.from(new Set(rows.map(w => String(w.asset_id))));
  const ownerIds = Array.from(new Set(rows.map(w => String(w.user_id))));

  const [assetsRes, profilesRes] = await Promise.all([
    supabase.from('clinical_assets').select(ASSET_COLUMNS).in('id', assetIds),
    supabase.from('user_profiles').select('id, full_name').in('id', ownerIds),
  ]);
  const assetMap = new Map(((assetsRes.data || []) as Row[]).map(a => [String(a.id), a]));
  const nameMap = new Map(((profilesRes.data || []) as Row[]).map(p => [String(p.id), p.full_name as string | null]));

  const enriched = rows.map(w => {
    const asset = assetMap.get(String(w.asset_id)) || null;
    const current = asset ? Number(asset.licensing_intent_score || 0) : 0;
    return {
      id: w.id,
      asset_id: w.asset_id,
      added_at: w.added_at,
      updated_at: w.updated_at,
      score_at_add: w.score_at_add,
      tags: w.tags,
      notes: w.notes,
      priority: w.priority,
      team_id: w.team_id,
      is_mine: String(w.user_id) === auth.userId,
      owner: displayName(nameMap.get(String(w.user_id))),
      asset,
      score_change: asset ? Math.round(current - Number(w.score_at_add || 0)) : 0,
    };
  });

  let activity: Array<Row> = [];
  if (includeActivity) {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 30);
    const { data: snaps } = await supabase
      .from('asset_signal_snapshots')
      .select('asset_id, snapshot_date, licensing_intent_score, score_delta, trend')
      .in('asset_id', assetIds.slice(0, 500))
      .gte('snapshot_date', since.toISOString().slice(0, 10))
      .neq('score_delta', 0)
      .order('snapshot_date', { ascending: false })
      .limit(200);
    activity = ((snaps || []) as Row[]).map(s => {
      const a = assetMap.get(String(s.asset_id));
      return {
        asset_id: s.asset_id,
        asset_name: a?.asset_name ?? null,
        company_name: a?.company_name ?? null,
        date: s.snapshot_date,
        score: Math.round(Number(s.licensing_intent_score) || 0),
        delta: Math.round(Number(s.score_delta) || 0),
        trend: s.trend,
      };
    });
  }

  return NextResponse.json({ watchlist: enriched, total: enriched.length, scope, team, activity });
}

export async function POST(request: NextRequest) {
  const auth = await resolveUserTier();
  if (!auth.userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = addSchema.safeParse(body);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const message = issue?.path?.[0] === 'asset_id' ? 'asset_id required' : (issue?.message || 'Invalid request');
    return NextResponse.json({ error: message }, { status: 400 });
  }
  const { asset_id, tags, notes, priority } = parsed.data;

  const supabase = createServiceClient();

  const [{ data: asset }, { data: existing }, team] = await Promise.all([
    supabase.from('clinical_assets').select('id, licensing_intent_score, partnership_status').eq('id', asset_id).maybeSingle(),
    supabase.from('radar_watchlist').select('id').eq('user_id', auth.userId).eq('asset_id', asset_id).maybeSingle(),
    activeTeam(supabase, auth.userId),
  ]);
  if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

  if (existing) {
    const patch: Row = {};
    if (tags !== undefined) patch.tags = tags;
    if (notes !== undefined) patch.notes = notes;
    if (priority !== undefined) patch.priority = priority;
    if (team && Object.keys(patch).length === 0) patch.team_id = team.id;
    const { data, error } = await supabase
      .from('radar_watchlist')
      .update(Object.keys(patch).length > 0 ? patch : { updated_at: new Date().toISOString() })
      .eq('id', existing.id)
      .select()
      .single();
    if (error) {
      console.error('[radar/watchlist] POST update error:', error.message);
      return NextResponse.json({ error: 'Failed to update watchlist' }, { status: 500 });
    }
    return NextResponse.json({ success: true, item: data, created: false });
  }

  const score = Number(asset.licensing_intent_score || 0);
  const { data, error } = await supabase
    .from('radar_watchlist')
    .insert({
      user_id: auth.userId,
      asset_id,
      team_id: team?.id ?? null,
      score_at_add: score,
      last_score_seen: score,
      last_partnership_status: asset.partnership_status ?? null,
      tags: tags ?? [],
      notes: notes ?? null,
      priority: priority ?? 'normal',
    })
    .select()
    .single();

  if (error) {
    console.error('[radar/watchlist] POST error:', error.message);
    return NextResponse.json({ error: 'Failed to update watchlist' }, { status: 500 });
  }
  return NextResponse.json({ success: true, item: data, created: true });
}

export async function PATCH(request: NextRequest) {
  const auth = await resolveUserTier();
  if (!auth.userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const assetId = request.nextUrl.searchParams.get('asset_id');
  if (!assetId || !isUuid(assetId)) {
    return NextResponse.json({ error: 'asset_id must be a UUID' }, { status: 400 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success || Object.keys(parsed.data).length === 0) {
    return NextResponse.json({ error: 'Nothing to update' }, { status: 400 });
  }
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('radar_watchlist')
    .update(parsed.data)
    .eq('user_id', auth.userId)
    .eq('asset_id', assetId)
    .select()
    .maybeSingle();
  if (error) {
    console.error('[radar/watchlist] PATCH error:', error.message);
    return NextResponse.json({ error: 'Failed to update watchlist' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'Not on your watchlist' }, { status: 404 });
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
  if (!isUuid(assetId)) {
    return NextResponse.json({ error: 'asset_id must be a UUID' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const { error } = await supabase
    .from('radar_watchlist')
    .delete()
    .eq('user_id', auth.userId)
    .eq('asset_id', assetId);

  if (error) {
    console.error('[radar/watchlist] DELETE error:', error.message);
    return NextResponse.json({ error: 'Failed to remove from watchlist' }, { status: 500 });
  }
  return NextResponse.json({ success: true });
}
