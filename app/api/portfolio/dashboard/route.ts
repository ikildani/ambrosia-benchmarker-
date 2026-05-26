import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { apiSuccess, apiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('Unauthorized', 401);

    const supabase = createServiceClient();

    const { data: membership } = await supabase
      .from('team_members')
      .select('team_id, role')
      .eq('user_id', user.id)
      .eq('status', 'active')
      .single();

    if (!membership || membership.role !== 'admin') {
      return apiError('Only team admins can view the dashboard', 403);
    }

    const teamId = membership.team_id;

    const [teamResult, membersResult, analystHoursResult, alertsResult, auditResult] = await Promise.all([
      supabase.from('teams').select('*').eq('id', teamId).single(),

      supabase
        .from('team_members')
        .select('id, user_id, role, status, accepted_at')
        .eq('team_id', teamId),

      supabase
        .from('analyst_hour_entries')
        .select('hours')
        .eq('team_id', teamId)
        .gte('service_date', new Date(new Date().getFullYear(), new Date().getMonth(), 1).toISOString().split('T')[0]),

      supabase
        .from('deal_alert_configs')
        .select('id')
        .eq('team_id', teamId)
        .eq('is_active', true),

      supabase
        .from('audit_log')
        .select('id, user_email, action, resource, created_at, details')
        .eq('team_id', teamId)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    const team = teamResult.data;
    const members = membersResult.data || [];
    const activeMembers = members.filter(m => m.status === 'active').length;
    const pendingMembers = members.filter(m => m.status === 'pending').length;

    const analystHoursUsed = (analystHoursResult.data || [])
      .reduce((sum, entry) => sum + Number(entry.hours), 0);

    return apiSuccess({
      team,
      seats: {
        active: activeMembers,
        pending: pendingMembers,
        max: team?.max_seats || 5,
        utilization: team?.max_seats ? Math.round((activeMembers / team.max_seats) * 100) : 0,
      },
      analystHours: {
        used: analystHoursUsed,
        allocated: team?.analyst_hours_monthly || 0,
        remaining: Math.max(0, (team?.analyst_hours_monthly || 0) - analystHoursUsed),
      },
      activeAlerts: alertsResult.data?.length || 0,
      recentActivity: auditResult.data || [],
    });
  } catch {
    return apiError('Internal server error', 500);
  }
}
