/**
 * GET  /api/radar/views   the caller's saved views plus those shared into
 *                         their active team (Pro).
 * POST /api/radar/views   create one from the current feed state.
 *
 * A view is the whole screen: every filter (sanitised through the URL
 * codec), sort, table/cards, and visible columns. `shared: true` stores the
 * caller's active team id so teammates see it; `is_default: true` makes it
 * the view that opens on /radar (one per user).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveUserTier } from '@/lib/auth/tier-check';
import { formatValidationError } from '@/app/api/radar/_lib/mandate-schema';
import { MAX_VIEWS_PER_USER, sanitizeViewFilters, savedViewFieldsSchema } from '@/app/api/radar/_lib/view-schema';
import { DEFAULT_TABLE_COLUMNS } from '@/lib/radar/client/filter-schema';
import { activeTeamId } from '@/app/api/radar/_lib/team';

export const dynamic = 'force-dynamic';

export async function GET() {
  const auth = await resolveUserTier();
  if (!auth.hasProAccess || !auth.userId) {
    return NextResponse.json({ error: 'Pro access required' }, { status: 403 });
  }
  const supabase = createServiceClient();
  const teamId = await activeTeamId(supabase, auth.userId);

  let q = supabase.from('radar_saved_views').select('*').order('updated_at', { ascending: false }).limit(200);
  q = teamId ? q.or(`user_id.eq.${auth.userId},team_id.eq.${teamId}`) : q.eq('user_id', auth.userId);
  const { data, error } = await q;
  if (error) {
    console.error('[radar/views] GET error:', error.message);
    return NextResponse.json({ error: 'Failed to fetch views' }, { status: 500 });
  }
  const views = (data ?? []).map(v => ({ ...v, is_mine: v.user_id === auth.userId, is_default: v.user_id === auth.userId && v.is_default }));
  return NextResponse.json({ views, team_id: teamId });
}

export async function POST(request: NextRequest) {
  const auth = await resolveUserTier();
  if (!auth.hasProAccess || !auth.userId) {
    return NextResponse.json({ error: 'Pro access required' }, { status: 403 });
  }
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = savedViewFieldsSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: formatValidationError(parsed.error) }, { status: 400 });
  const input = parsed.data;
  if (!input.name) return NextResponse.json({ error: 'name: Required' }, { status: 400 });

  const supabase = createServiceClient();
  const { count } = await supabase
    .from('radar_saved_views')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', auth.userId);
  if ((count ?? 0) >= MAX_VIEWS_PER_USER) {
    return NextResponse.json({ error: `Maximum ${MAX_VIEWS_PER_USER} saved views per user` }, { status: 400 });
  }

  const teamId = input.shared ? await activeTeamId(supabase, auth.userId) : null;
  if (input.shared && !teamId) {
    return NextResponse.json({ error: 'Sharing needs an active team (Portfolio plan)' }, { status: 400 });
  }

  if (input.is_default) {
    await supabase.from('radar_saved_views').update({ is_default: false }).eq('user_id', auth.userId).eq('is_default', true);
  }

  const { data: view, error } = await supabase
    .from('radar_saved_views')
    .insert({
      user_id: auth.userId,
      team_id: teamId,
      name: input.name,
      description: input.description ?? null,
      filters: sanitizeViewFilters(input.filters ?? {}),
      sort: input.sort ?? 'score',
      dir: input.dir ?? 'desc',
      view_mode: input.view_mode ?? 'table',
      columns: input.columns?.length ? input.columns : [...DEFAULT_TABLE_COLUMNS],
      is_default: input.is_default ?? false,
    })
    .select()
    .single();
  if (error) {
    console.error('[radar/views] POST error:', error.message);
    return NextResponse.json({ error: 'Failed to save the view' }, { status: 500 });
  }
  return NextResponse.json({ view: { ...view, is_mine: true } }, { status: 201 });
}
