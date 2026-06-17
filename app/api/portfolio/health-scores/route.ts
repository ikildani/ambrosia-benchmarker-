import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireTeamAdmin } from '@/lib/portfolio/auth';
import { apiSuccess, apiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const auth = await requireTeamAdmin(request);
    if ('error' in auth) return auth.error;
    const { teamId } = auth;

    const supabase = createServiceClient();

    const { data: members } = await supabase
      .from('team_members')
      .select('user_id, role')
      .eq('team_id', teamId)
      .eq('status', 'active');

    if (!members?.length) return apiSuccess({ scores: [] });

    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

    const scores = await Promise.all(
      members.map(async (member) => {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('email, company_name')
          .eq('id', member.user_id)
          .single();

        const { count: actions30d } = await supabase
          .from('audit_log')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', member.user_id)
          .gte('created_at', thirtyDaysAgo);

        const { count: actions7d } = await supabase
          .from('audit_log')
          .select('*', { count: 'exact', head: true })
          .eq('user_id', member.user_id)
          .gte('created_at', sevenDaysAgo);

        const health = (actions7d ?? 0) > 0
          ? 'active'
          : (actions30d ?? 0) > 0
            ? 'moderate'
            : 'inactive';

        return {
          userId: member.user_id,
          email: profile?.email ?? 'unknown',
          companyName: profile?.company_name ?? '',
          role: member.role,
          actions30d: actions30d ?? 0,
          actions7d: actions7d ?? 0,
          health,
        };
      }),
    );

    return apiSuccess({ scores });
  } catch {
    return apiError('Internal server error', 500);
  }
}
