import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireTeamMember, requireTeamAdmin } from '@/lib/portfolio/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { logAuditEvent, getAuditContext } from '@/lib/audit-log';

export const dynamic = 'force-dynamic';

const VALID_CATEGORIES = ['research', 'report', 'call', 'custom'] as const;

export async function GET(request: NextRequest) {
  try {
    const result = await requireTeamMember(request);
    if ('error' in result) return result.error;

    const { teamId } = result;
    const supabase = createServiceClient();

    // Fetch all entries for this team
    const { data: entries, error: entriesError } = await supabase
      .from('analyst_hour_entries')
      .select('id, description, hours, service_date, category, created_at, logged_by')
      .eq('team_id', teamId)
      .order('service_date', { ascending: false });

    if (entriesError) {
      return apiError('Failed to fetch analyst hour entries', 500);
    }

    // Fetch team's monthly allocation
    const { data: team } = await supabase
      .from('teams')
      .select('analyst_hours_monthly')
      .eq('id', teamId)
      .single();

    const monthly = team?.analyst_hours_monthly || 0;

    // Compute used hours this month
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString();

    const used = (entries || [])
      .filter(e => e.service_date >= monthStart.slice(0, 10) && e.service_date <= monthEnd.slice(0, 10))
      .reduce((sum, e) => sum + (e.hours || 0), 0);

    return apiSuccess({
      entries: entries || [],
      allocation: {
        monthly,
        used,
        remaining: Math.max(0, monthly - used),
      },
    });
  } catch {
    return apiError('Internal server error', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await requireTeamAdmin(request);
    if ('error' in result) return result.error;

    const { user, teamId } = result;
    const supabase = createServiceClient();

    const body = await request.json();
    const { description, hours, service_date, category } = body;

    if (!description || typeof description !== 'string' || description.trim().length === 0) {
      return apiError('Description is required', 400);
    }

    if (typeof hours !== 'number' || hours <= 0) {
      return apiError('Hours must be a positive number', 400);
    }

    if (!service_date) {
      return apiError('Service date is required', 400);
    }

    if (!VALID_CATEGORIES.includes(category)) {
      return apiError(`Category must be one of: ${VALID_CATEGORIES.join(', ')}`, 400);
    }

    const { data: entry, error: insertError } = await supabase
      .from('analyst_hour_entries')
      .insert({
        team_id: teamId,
        description: description.trim(),
        hours,
        service_date,
        category,
        logged_by: user.id,
      })
      .select()
      .single();

    if (insertError) {
      return apiError('Failed to log analyst hours', 500);
    }

    await logAuditEvent(supabase, {
      team_id: teamId,
      user_id: user.id,
      user_email: user.email,
      action: 'analyst_hours_logged',
      resource: 'analyst_hour_entry',
      resource_id: entry.id,
      ...getAuditContext(request),
      details: { description: description.trim(), hours, service_date, category },
    });

    return apiSuccess({ entry }, 201);
  } catch {
    return apiError('Internal server error', 500);
  }
}
