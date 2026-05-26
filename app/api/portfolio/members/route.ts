import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { apiSuccess, apiError } from '@/lib/api-response';
import { logAuditEvent, getAuditContext } from '@/lib/audit-log';

export const dynamic = 'force-dynamic';

async function getUserTeam(userId: string) {
  const supabase = createServiceClient();
  const { data: membership } = await supabase
    .from('team_members')
    .select('team_id, role')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();
  return membership;
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('Unauthorized', 401);

    const membership = await getUserTeam(user.id);
    if (!membership) return apiError('Not a team member', 403);

    const supabase = createServiceClient();

    const { data: members } = await supabase
      .from('team_members')
      .select(`
        id,
        user_id,
        role,
        status,
        invited_at,
        accepted_at
      `)
      .eq('team_id', membership.team_id)
      .order('accepted_at', { ascending: true });

    const userIds = (members || []).map(m => m.user_id);
    const { data: profiles } = await supabase
      .from('user_profiles')
      .select('id, email, company_name')
      .in('id', userIds);

    const profileMap = new Map((profiles || []).map(p => [p.id, p]));
    const enrichedMembers = (members || []).map(m => ({
      ...m,
      email: profileMap.get(m.user_id)?.email || 'Unknown',
      companyName: profileMap.get(m.user_id)?.company_name || null,
    }));

    return apiSuccess({ members: enrichedMembers });
  } catch {
    return apiError('Internal server error', 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('Unauthorized', 401);

    const membership = await getUserTeam(user.id);
    if (!membership || membership.role !== 'admin') {
      return apiError('Only team admins can update members', 403);
    }

    const body = await request.json();
    const { memberId, role } = body;

    if (!memberId || !role) return apiError('memberId and role are required', 400);

    const validRoles = ['admin', 'analyst', 'viewer'];
    if (!validRoles.includes(role)) return apiError('Invalid role', 400);

    const supabase = createServiceClient();

    const { data: target } = await supabase
      .from('team_members')
      .select('id, user_id, team_id')
      .eq('id', memberId)
      .eq('team_id', membership.team_id)
      .single();

    if (!target) return apiError('Member not found', 404);

    if (target.user_id === user.id) {
      return apiError('Cannot change your own role', 400);
    }

    await supabase
      .from('team_members')
      .update({ role })
      .eq('id', memberId);

    await logAuditEvent(supabase, {
      user_id: user.id,
      user_email: user.email,
      action: 'member_role_changed',
      resource: 'team_member',
      resource_id: memberId,
      ...getAuditContext(request),
      details: { newRole: role, targetUserId: target.user_id },
    });

    return apiSuccess({ updated: true });
  } catch {
    return apiError('Internal server error', 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('Unauthorized', 401);

    const membership = await getUserTeam(user.id);
    if (!membership || membership.role !== 'admin') {
      return apiError('Only team admins can remove members', 403);
    }

    const { searchParams } = new URL(request.url);
    const memberId = searchParams.get('memberId');

    if (!memberId) return apiError('memberId is required', 400);

    const supabase = createServiceClient();

    const { data: target } = await supabase
      .from('team_members')
      .select('id, user_id, team_id')
      .eq('id', memberId)
      .eq('team_id', membership.team_id)
      .single();

    if (!target) return apiError('Member not found', 404);

    if (target.user_id === user.id) {
      return apiError('Cannot remove yourself from the team', 400);
    }

    await supabase
      .from('team_members')
      .update({ status: 'deactivated' })
      .eq('id', memberId);

    await supabase
      .from('user_profiles')
      .update({ tier: 'free', team_id: null })
      .eq('id', target.user_id);

    await logAuditEvent(supabase, {
      user_id: user.id,
      user_email: user.email,
      action: 'member_removed',
      resource: 'team_member',
      resource_id: memberId,
      ...getAuditContext(request),
      details: { removedUserId: target.user_id },
    });

    return apiSuccess({ removed: true });
  } catch {
    return apiError('Internal server error', 500);
  }
}
