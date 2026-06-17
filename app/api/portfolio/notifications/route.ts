import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireTeamMember } from '@/lib/portfolio/auth';
import { apiSuccess, apiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

interface AuditEntry {
  id: string;
  action: string;
  user_email: string;
  resource: string;
  created_at: string;
  details: Record<string, unknown> | null;
}

function formatAuditMessage(item: AuditEntry): string {
  const who = item.user_email?.split('@')[0] || 'Someone';
  switch (item.action) {
    case 'member_invited':
      return `${who} invited a new member`;
    case 'member_removed':
      return `${who} removed a member`;
    case 'team_settings_updated':
      return `Settings updated by ${who}`;
    default:
      return `${who} performed ${item.action}`;
  }
}

export async function GET(request: NextRequest) {
  try {
    const result = await requireTeamMember(request);
    if ('error' in result) return result.error;
    const { teamId } = result;

    const lastReadAt = request.nextUrl.searchParams.get('lastReadAt');
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const supabase = createServiceClient();

    const [alertsResult, auditResult] = await Promise.all([
      supabase
        .from('deal_alert_history')
        .select(
          'id, delivered_at, delivered_via, deal_alert_configs!inner(name, alert_type, team_id)'
        )
        .eq('deal_alert_configs.team_id', teamId)
        .gte('delivered_at', sevenDaysAgo.toISOString())
        .order('delivered_at', { ascending: false })
        .limit(20),
      supabase
        .from('audit_log')
        .select('id, action, user_email, resource, created_at, details')
        .eq('team_id', teamId)
        .in('action', [
          'member_invited',
          'member_removed',
          'team_settings_updated',
        ])
        .gte('created_at', sevenDaysAgo.toISOString())
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    const alertNotifications = (alertsResult.data || []).map((item) => {
      const config = item.deal_alert_configs as unknown as {
        name: string;
        alert_type: string;
        team_id: string;
      };
      return {
        id: item.id,
        type: 'alert' as const,
        message: `Alert "${config.name}" triggered via ${item.delivered_via}`,
        timestamp: item.delivered_at,
      };
    });

    const auditNotifications = (
      (auditResult.data as AuditEntry[] | null) || []
    ).map((item) => ({
      id: item.id,
      type: item.action,
      message: formatAuditMessage(item),
      timestamp: item.created_at,
    }));

    const notifications = [...alertNotifications, ...auditNotifications]
      .sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      .slice(0, 20);

    const unreadCount = lastReadAt
      ? notifications.filter(
          (n) => new Date(n.timestamp) > new Date(lastReadAt)
        ).length
      : notifications.length;

    return apiSuccess({ notifications, unreadCount });
  } catch {
    return apiError('Internal server error', 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const result = await requireTeamMember(request);
    if ('error' in result) return result.error;

    const body = await request.json();
    const { lastReadAt } = body;

    return apiSuccess({ lastReadAt });
  } catch {
    return apiError('Internal server error', 500);
  }
}
