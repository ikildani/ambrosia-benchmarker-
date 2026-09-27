/**
 * PATCH  /api/radar/views/:id   rename, re-save the current state into it,
 *                               share/unshare, set as default. Owner only.
 * DELETE /api/radar/views/:id   owner only.
 * POST   /api/radar/views/:id   "used": bumps use_count / last_used_at
 *                               (owner or teammate).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveUserTier } from '@/lib/auth/tier-check';
import { isUuid } from '@/app/api/radar/_lib/radar-api';
import { formatValidationError } from '@/app/api/radar/_lib/mandate-schema';
import { sanitizeViewFilters, savedViewFieldsSchema } from '@/app/api/radar/_lib/view-schema';
import { activeTeamId } from '@/app/api/radar/_lib/team';

export const dynamic = 'force-dynamic';

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveUserTier();
  if (!auth.hasProAccess || !auth.userId) {
    return NextResponse.json({ error: 'Pro access required' }, { status: 403 });
  }
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'View not found' }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = savedViewFieldsSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: formatValidationError(parsed.error) }, { status: 400 });
  const input = parsed.data;
  const bodyKeys = body && typeof body === 'object' ? Object.keys(body as object) : [];

  const supabase = createServiceClient();
  const patch: Record<string, unknown> = {};
  if (bodyKeys.includes('name') && input.name) patch.name = input.name;
  if (bodyKeys.includes('description')) patch.description = input.description ?? null;
  if (bodyKeys.includes('filters') && input.filters) patch.filters = sanitizeViewFilters(input.filters);
  if (bodyKeys.includes('sort') && input.sort) patch.sort = input.sort;
  if (bodyKeys.includes('dir') && input.dir) patch.dir = input.dir;
  if (bodyKeys.includes('view_mode') && input.view_mode) patch.view_mode = input.view_mode;
  if (bodyKeys.includes('columns') && input.columns) patch.columns = input.columns;
  if (bodyKeys.includes('is_default') && typeof input.is_default === 'boolean') patch.is_default = input.is_default;
  if (bodyKeys.includes('shared') && typeof input.shared === 'boolean') {
    if (input.shared) {
      const teamId = await activeTeamId(supabase, auth.userId);
      if (!teamId) return NextResponse.json({ error: 'Sharing needs an active team (Portfolio plan)' }, { status: 400 });
      patch.team_id = teamId;
    } else {
      patch.team_id = null;
    }
  }
  if (Object.keys(patch).length === 0) return NextResponse.json({ error: 'No updatable fields provided' }, { status: 400 });

  if (patch.is_default === true) {
    await supabase.from('radar_saved_views').update({ is_default: false }).eq('user_id', auth.userId).eq('is_default', true).neq('id', id);
  }

  // Ownership enforced on the UPDATE itself.
  const { data: view, error } = await supabase
    .from('radar_saved_views')
    .update(patch)
    .eq('id', id)
    .eq('user_id', auth.userId)
    .select()
    .maybeSingle();
  if (error) {
    console.error('[radar/views/:id] PATCH error:', error.message);
    return NextResponse.json({ error: 'Failed to update the view' }, { status: 500 });
  }
  if (!view) return NextResponse.json({ error: 'View not found' }, { status: 404 });
  return NextResponse.json({ view: { ...view, is_mine: true } });
}

export async function DELETE(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveUserTier();
  if (!auth.hasProAccess || !auth.userId) {
    return NextResponse.json({ error: 'Pro access required' }, { status: 403 });
  }
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'View not found' }, { status: 404 });
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('radar_saved_views')
    .delete()
    .eq('id', id)
    .eq('user_id', auth.userId)
    .select('id')
    .maybeSingle();
  if (error) {
    console.error('[radar/views/:id] DELETE error:', error.message);
    return NextResponse.json({ error: 'Failed to delete the view' }, { status: 500 });
  }
  if (!data) return NextResponse.json({ error: 'View not found' }, { status: 404 });
  return NextResponse.json({ deleted: true });
}

/** Marks the view as used (owner or teammate); never fails the caller's navigation. */
export async function POST(_request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const auth = await resolveUserTier();
  if (!auth.hasProAccess || !auth.userId) {
    return NextResponse.json({ error: 'Pro access required' }, { status: 403 });
  }
  const { id } = await params;
  if (!isUuid(id)) return NextResponse.json({ error: 'View not found' }, { status: 404 });
  const supabase = createServiceClient();
  const teamId = await activeTeamId(supabase, auth.userId);
  const { data } = await supabase.from('radar_saved_views').select('id, user_id, team_id, use_count').eq('id', id).maybeSingle();
  if (!data || (data.user_id !== auth.userId && (!teamId || data.team_id !== teamId))) {
    return NextResponse.json({ error: 'View not found' }, { status: 404 });
  }
  await supabase
    .from('radar_saved_views')
    .update({ use_count: (Number(data.use_count) || 0) + 1, last_used_at: new Date().toISOString() })
    .eq('id', id);
  return NextResponse.json({ ok: true });
}
