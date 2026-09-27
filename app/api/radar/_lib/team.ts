/**
 * Search & Evaluation — the caller's active team (Portfolio plan), used by
 * routes that share rows into a team (watchlist, mandates, saved views).
 */

import type { createServiceClient } from '@/lib/supabase/server';

type ServiceClient = ReturnType<typeof createServiceClient>;

export async function activeTeamId(supabase: ServiceClient, userId: string): Promise<string | null> {
  const { data } = await supabase
    .from('team_members')
    .select('team_id')
    .eq('user_id', userId)
    .eq('status', 'active')
    .limit(1)
    .maybeSingle();
  const teamId = (data as { team_id?: string } | null)?.team_id;
  return teamId ? String(teamId) : null;
}
