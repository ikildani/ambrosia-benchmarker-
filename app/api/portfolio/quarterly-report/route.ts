import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireTeamAdmin } from '@/lib/portfolio/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { logAuditEvent, getAuditContext } from '@/lib/audit-log';

export const dynamic = 'force-dynamic';

function getCurrentQuarter(): { quarter: number; year: number } {
  const now = new Date();
  return { quarter: Math.ceil((now.getMonth() + 1) / 3), year: now.getFullYear() };
}

function getQuarterDateRange(quarter: number, year: number): { start: string; end: string } {
  const startMonth = (quarter - 1) * 3;
  const start = new Date(year, startMonth, 1).toISOString();
  const end = new Date(year, startMonth + 3, 0, 23, 59, 59).toISOString();
  return { start, end };
}

export async function GET(request: NextRequest) {
  try {
    const auth = await requireTeamAdmin(request);
    if ('error' in auth) return auth.error;
    const { teamId } = auth;

    const supabase = createServiceClient();

    const { data: reports } = await supabase
      .from('portfolio_reports')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false })
      .limit(12);

    return apiSuccess({ reports: reports || [] });
  } catch {
    return apiError('Internal server error', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const auth = await requireTeamAdmin(request);
    if ('error' in auth) return auth.error;
    const { user, teamId, team } = auth;

    const supabase = createServiceClient();

    const body = await request.json().catch(() => ({}));
    const { quarter: qParam, year: yParam } = body as { quarter?: number; year?: number };
    const { quarter, year } = qParam && yParam
      ? { quarter: qParam, year: yParam }
      : getCurrentQuarter();

    const { start, end } = getQuarterDateRange(quarter, year);

    const { data: members } = await supabase
      .from('team_members')
      .select('user_id, role')
      .eq('team_id', teamId)
      .eq('status', 'active');

    const memberIds = (members ?? []).map(m => m.user_id);

    const { data: activity } = await supabase
      .from('audit_log')
      .select('user_id, user_email, action, details, created_at')
      .in('user_id', memberIds)
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: false })
      .limit(500);

    const { data: hourEntries } = await supabase
      .from('analyst_hour_entries')
      .select('hours, category, service_date')
      .eq('team_id', teamId)
      .gte('service_date', start.split('T')[0])
      .lte('service_date', end.split('T')[0]);

    const { data: alertHistory } = await supabase
      .from('deal_alert_history')
      .select('deal_id, delivered_at, relevance_score')
      .in('alert_config_id',
        (await supabase
          .from('deal_alert_configs')
          .select('id')
          .eq('team_id', teamId)
          .eq('is_active', true)
        ).data?.map(a => a.id) ?? [],
      )
      .gte('delivered_at', start)
      .lte('delivered_at', end);

    const taCounts: Record<string, number> = {};
    const companyCounts: Record<string, { calculations: number; comps: number; memos: number }> = {};
    let totalCalculations = 0;

    for (const evt of activity ?? []) {
      const details = evt.details as Record<string, unknown> | null;
      const company = (details?.company_name as string) || evt.user_email || 'Unknown';

      if (!companyCounts[company]) {
        companyCounts[company] = { calculations: 0, comps: 0, memos: 0 };
      }

      if (evt.action === 'calculation_run') {
        totalCalculations++;
        companyCounts[company].calculations++;
        const ta = details?.therapeutic_area as string;
        if (ta) taCounts[ta] = (taCounts[ta] || 0) + 1;
      } else if (evt.action === 'comp_set_created') {
        companyCounts[company].comps++;
      } else if (evt.action === 'deal_memo_generated') {
        companyCounts[company].memos++;
      }
    }

    const totalHoursUsed = (hourEntries ?? []).reduce((sum, e) => sum + Number(e.hours), 0);

    const reportData = {
      quarter,
      year,
      teamName: team.name,
      tier: team.portfolio_tier,
      summary: {
        activeSeats: memberIds.length,
        maxSeats: team.max_seats,
        totalCalculations,
        totalAlerts: alertHistory?.length ?? 0,
        analystHoursUsed: totalHoursUsed,
        analystHoursAllocated: team.analyst_hours_monthly * 3,
      },
      taDistribution: Object.entries(taCounts)
        .map(([ta, count]) => ({ therapeuticArea: ta, count, percentage: totalCalculations > 0 ? Math.round((count / totalCalculations) * 100) : 0 }))
        .sort((a, b) => b.count - a.count),
      companyActivity: Object.entries(companyCounts)
        .map(([name, counts]) => ({ company: name, ...counts }))
        .sort((a, b) => b.calculations - a.calculations),
    };

    const { data: report, error: insertError } = await supabase
      .from('portfolio_reports')
      .insert({
        team_id: teamId,
        report_type: 'quarterly',
        quarter,
        year,
        title: `Q${quarter} ${year} Portfolio Report — ${team.name}`,
        generated_by: user.id,
        metadata: reportData,
      })
      .select()
      .single();

    if (insertError) {
      console.error('Failed to save quarterly report:', insertError);
    }

    const auditCtx = getAuditContext(request);
    logAuditEvent(supabase, {
      team_id: teamId,
      user_id: user.id,
      user_email: user.email,
      action: 'quarterly_report_generated',
      resource: 'portfolio_report',
      resource_id: report?.id,
      details: { quarter, year, totalCalculations },
      ...auditCtx,
    });

    return apiSuccess({ report: reportData, id: report?.id });
  } catch (error) {
    console.error('Quarterly report error:', error);
    return apiError('Failed to generate quarterly report', 500);
  }
}
