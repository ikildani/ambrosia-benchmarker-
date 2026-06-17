import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { apiError } from '@/lib/api-response';

export async function getUserTeamId(userId: string): Promise<string | null> {
  const supabase = createServiceClient();
  const { data } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .single();
  return data?.team_id || null;
}

export async function requireTeamMember(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return { error: apiError('Unauthorized', 401) } as const;

  const teamId = await getUserTeamId(user.id);
  if (!teamId) return { error: apiError('Not a team member', 403) } as const;

  return { user, teamId } as const;
}

export async function requireTeamAdmin(request: NextRequest) {
  const user = await getAuthenticatedUser(request);
  if (!user) return { error: apiError('Unauthorized', 401) } as const;

  const supabase = createServiceClient();
  const { data: membership } = await supabase
    .from('team_members')
    .select('team_id, role')
    .eq('user_id', user.id)
    .eq('status', 'active')
    .single();

  if (!membership) return { error: apiError('Not a team member', 403) } as const;
  if (membership.role !== 'admin') return { error: apiError('Admin access required', 403) } as const;

  const { data: team } = await supabase
    .from('teams')
    .select('*')
    .eq('id', membership.team_id)
    .single();

  if (!team) return { error: apiError('Team not found', 404) } as const;

  return { user, teamId: membership.team_id, team } as const;
}
