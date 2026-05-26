import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { apiSuccess, apiError } from '@/lib/api-response';
import { logAuditEvent, getAuditContext } from '@/lib/audit-log';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('You must be signed in to accept an invite', 401);

    const body = await request.json();
    const { token } = body;

    if (!token) return apiError('Invite token is required', 400);

    const supabase = createServiceClient();

    const { data: invite, error: inviteError } = await supabase
      .from('team_invites')
      .select('id, team_id, email, role, expires_at, accepted_at')
      .eq('token', token)
      .single();

    if (inviteError || !invite) {
      return apiError('Invalid or expired invite', 400);
    }

    if (invite.accepted_at) {
      return apiError('This invite has already been used', 400);
    }

    if (new Date(invite.expires_at) < new Date()) {
      return apiError('This invite has expired', 400);
    }

    if (user.email?.toLowerCase() !== invite.email.toLowerCase()) {
      return apiError('This invite was sent to a different email address', 403);
    }

    const { data: existingMember } = await supabase
      .from('team_members')
      .select('id, status')
      .eq('team_id', invite.team_id)
      .eq('user_id', user.id)
      .single();

    if (existingMember?.status === 'active') {
      return apiError('You are already a member of this team', 409);
    }

    if (existingMember) {
      await supabase
        .from('team_members')
        .update({
          status: 'active',
          role: invite.role,
          accepted_at: new Date().toISOString(),
        })
        .eq('id', existingMember.id);
    } else {
      await supabase
        .from('team_members')
        .insert({
          team_id: invite.team_id,
          user_id: user.id,
          role: invite.role,
          status: 'active',
          accepted_at: new Date().toISOString(),
        });
    }

    await supabase
      .from('team_invites')
      .update({ accepted_at: new Date().toISOString() })
      .eq('id', invite.id);

    await supabase
      .from('user_profiles')
      .update({ tier: 'portfolio', team_id: invite.team_id })
      .eq('id', user.id);

    const { data: team } = await supabase
      .from('teams')
      .select('name')
      .eq('id', invite.team_id)
      .single();

    await logAuditEvent(supabase, {
      user_id: user.id,
      user_email: user.email,
      action: 'invite_accepted',
      resource: 'team_member',
      resource_id: invite.team_id,
      ...getAuditContext(request),
      details: { teamName: team?.name, role: invite.role },
    });

    return apiSuccess({
      teamId: invite.team_id,
      teamName: team?.name,
      role: invite.role,
    });
  } catch {
    return apiError('Internal server error', 500);
  }
}
