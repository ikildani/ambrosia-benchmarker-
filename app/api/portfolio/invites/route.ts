import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { apiSuccess, apiError } from '@/lib/api-response';
import { logAuditEvent, getAuditContext } from '@/lib/audit-log';
import { sendPortfolioInviteEmail } from '@/lib/email/client';
import crypto from 'crypto';

export const dynamic = 'force-dynamic';

async function getAdminTeam(userId: string) {
  const supabase = createServiceClient();
  const { data: membership } = await supabase
    .from('team_members')
    .select('team_id, role')
    .eq('user_id', userId)
    .eq('status', 'active')
    .eq('role', 'admin')
    .single();

  if (!membership) return null;

  const { data: team } = await supabase
    .from('teams')
    .select('id, name, max_seats')
    .eq('id', membership.team_id)
    .single();

  return team;
}

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('Unauthorized', 401);

    const team = await getAdminTeam(user.id);
    if (!team) return apiError('Only team admins can invite members', 403);

    const body = await request.json();
    const { email, role } = body;

    if (!email) return apiError('Email is required', 400);

    const validRoles = ['admin', 'analyst', 'viewer'];
    const inviteRole = validRoles.includes(role) ? role : 'viewer';

    const supabase = createServiceClient();

    const { count: activeMembers } = await supabase
      .from('team_members')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', team.id)
      .eq('status', 'active');

    const { count: pendingInvites } = await supabase
      .from('team_invites')
      .select('*', { count: 'exact', head: true })
      .eq('team_id', team.id)
      .is('accepted_at', null)
      .gt('expires_at', new Date().toISOString());

    const totalSlots = (activeMembers || 0) + (pendingInvites || 0);
    if (totalSlots >= team.max_seats) {
      return apiError(`Seat limit reached (${team.max_seats} seats). Contact sales to add more.`, 400);
    }

    const { data: existingMember } = await supabase
      .from('team_members')
      .select('id, status')
      .eq('team_id', team.id)
      .eq('user_id', (
        await supabase.from('user_profiles').select('id').eq('email', email.toLowerCase()).single()
      ).data?.id || '00000000-0000-0000-0000-000000000000')
      .single();

    if (existingMember?.status === 'active') {
      return apiError('This user is already a team member', 409);
    }

    const token = crypto.randomBytes(32).toString('base64url');
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

    const { data: invite, error: inviteError } = await supabase
      .from('team_invites')
      .insert({
        team_id: team.id,
        email: email.toLowerCase(),
        role: inviteRole,
        token,
        invited_by: user.id,
        expires_at: expiresAt,
      })
      .select()
      .single();

    if (inviteError) {
      return apiError('Failed to create invite', 500);
    }

    await logAuditEvent(supabase, {
      user_id: user.id,
      user_email: user.email,
      action: 'member_invited',
      resource: 'team_invite',
      resource_id: invite.id,
      ...getAuditContext(request),
      details: { invitedEmail: email, role: inviteRole, teamName: team.name },
    });

    const joinUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'https://solidus.ambrosiaventures.co'}/portfolio/join?token=${token}`;
    await sendPortfolioInviteEmail(email, team.name, inviteRole, joinUrl);

    return apiSuccess({
      invite: {
        id: invite.id,
        email: invite.email,
        role: invite.role,
        expiresAt: invite.expires_at,
      },
    });
  } catch {
    return apiError('Internal server error', 500);
  }
}

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('Unauthorized', 401);

    const team = await getAdminTeam(user.id);
    if (!team) return apiError('Only team admins can view invites', 403);

    const supabase = createServiceClient();

    const { data: invites } = await supabase
      .from('team_invites')
      .select('id, email, role, created_at, expires_at, accepted_at')
      .eq('team_id', team.id)
      .order('created_at', { ascending: false });

    return apiSuccess({ invites: invites || [] });
  } catch {
    return apiError('Internal server error', 500);
  }
}
