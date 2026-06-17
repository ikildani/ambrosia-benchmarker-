import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireTeamAdmin } from '@/lib/portfolio/auth';
import { apiSuccess, apiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

const CONCENTRATION_THRESHOLD = 0.40;

export async function GET(request: NextRequest) {
  try {
    const auth = await requireTeamAdmin(request);
    if ('error' in auth) return auth.error;
    const { teamId } = auth;

    const supabase = createServiceClient();

    const { data: members } = await supabase
      .from('team_members')
      .select('user_id')
      .eq('team_id', teamId)
      .eq('status', 'active');

    if (!members?.length) {
      return apiSuccess({ distribution: [], alerts: [], total: 0 });
    }

    const memberIds = members.map(m => m.user_id);

    const { data: events } = await supabase
      .from('audit_log')
      .select('user_id, details')
      .in('user_id', memberIds)
      .eq('action', 'calculation_run')
      .gte('created_at', new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString())
      .order('created_at', { ascending: false })
      .limit(500);

    const taCounts: Record<string, { count: number; companies: Set<string> }> = {};
    let total = 0;

    for (const event of events ?? []) {
      const ta = (event.details as Record<string, unknown>)?.therapeutic_area as string;
      const company = (event.details as Record<string, unknown>)?.company_name as string;
      if (!ta) continue;
      total++;
      if (!taCounts[ta]) taCounts[ta] = { count: 0, companies: new Set() };
      taCounts[ta].count++;
      if (company) taCounts[ta].companies.add(company);
    }

    const distribution = Object.entries(taCounts)
      .map(([ta, data]) => ({
        therapeuticArea: ta,
        count: data.count,
        percentage: total > 0 ? Math.round((data.count / total) * 100) : 0,
        companyCount: data.companies.size,
      }))
      .sort((a, b) => b.count - a.count);

    const alerts = distribution
      .filter(d => total > 0 && d.count / total > CONCENTRATION_THRESHOLD)
      .map(d => ({
        therapeuticArea: d.therapeuticArea,
        percentage: d.percentage,
        companyCount: d.companyCount,
        message: `${d.percentage}% of portfolio activity concentrated in ${d.therapeuticArea} across ${d.companyCount} companies`,
      }));

    return apiSuccess({ distribution, alerts, total });
  } catch {
    return apiError('Internal server error', 500);
  }
}
