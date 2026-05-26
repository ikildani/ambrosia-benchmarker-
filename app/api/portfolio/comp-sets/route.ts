import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { apiSuccess, apiError } from '@/lib/api-response';
import { logAuditEvent, getAuditContext } from '@/lib/audit-log';

export const dynamic = 'force-dynamic';

async function getUserTeamId(userId: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();
  return data?.team_id || null;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('Unauthorized', 401);

    const teamId = await getUserTeamId(user.id);
    if (!teamId) return apiError('Not a team member', 403);

    const supabase = createServiceClient();

    const { data: compSets } = await supabase
      .from('shared_comp_sets')
      .select('*')
      .eq('team_id', teamId)
      .order('updated_at', { ascending: false });

    return apiSuccess({ compSets: compSets || [] });
  } catch {
    return apiError('Internal server error', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('Unauthorized', 401);

    const teamId = await getUserTeamId(user.id);
    if (!teamId) return apiError('Not a team member', 403);

    const body = await request.json();
    const { name, description, filters, dealIds } = body;

    if (!name) return apiError('Name is required', 400);

    const supabase = createServiceClient();

    const { data: compSet, error } = await supabase
      .from('shared_comp_sets')
      .insert({
        team_id: teamId,
        name,
        description: description || null,
        filters: filters || {},
        deal_ids: dealIds || [],
        created_by: user.id,
      })
      .select()
      .single();

    if (error) return apiError('Failed to create comp set', 500);

    await logAuditEvent(supabase, {
      user_id: user.id,
      user_email: user.email,
      action: 'comp_set_created',
      resource: 'shared_comp_set',
      resource_id: compSet.id,
      ...getAuditContext(request),
      details: { name, dealCount: dealIds?.length || 0 },
    });

    return apiSuccess({ compSet });
  } catch {
    return apiError('Internal server error', 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('Unauthorized', 401);

    const teamId = await getUserTeamId(user.id);
    if (!teamId) return apiError('Not a team member', 403);

    const body = await request.json();
    const { id, name, description, filters, dealIds, isPinned } = body;

    if (!id) return apiError('Comp set ID is required', 400);

    const supabase = createServiceClient();

    const updates: Record<string, unknown> = {};
    if (name !== undefined) updates.name = name;
    if (description !== undefined) updates.description = description;
    if (filters !== undefined) updates.filters = filters;
    if (dealIds !== undefined) updates.deal_ids = dealIds;
    if (isPinned !== undefined) updates.is_pinned = isPinned;

    const { error } = await supabase
      .from('shared_comp_sets')
      .update(updates)
      .eq('id', id)
      .eq('team_id', teamId);

    if (error) return apiError('Failed to update comp set', 500);

    return apiSuccess({ updated: true });
  } catch {
    return apiError('Internal server error', 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('Unauthorized', 401);

    const teamId = await getUserTeamId(user.id);
    if (!teamId) return apiError('Not a team member', 403);

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return apiError('Comp set ID is required', 400);

    const supabase = createServiceClient();

    const { error } = await supabase
      .from('shared_comp_sets')
      .delete()
      .eq('id', id)
      .eq('team_id', teamId);

    if (error) return apiError('Failed to delete comp set', 500);

    return apiSuccess({ deleted: true });
  } catch {
    return apiError('Internal server error', 500);
  }
}
