import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { apiSuccess, apiError } from '@/lib/api-response';
import { logAuditEvent, getAuditContext } from '@/lib/audit-log';
import { requireTeamMember } from '@/lib/portfolio/auth';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const result = await requireTeamMember(request);
    if ('error' in result) return result.error;
    const { teamId } = result;

    const supabase = createServiceClient();

    const { data } = await supabase
      .from('office_hour_slots')
      .select('*')
      .eq('team_id', teamId)
      .order('scheduled_date', { ascending: true });

    return apiSuccess({ slots: data || [] });
  } catch {
    return apiError('Internal server error', 500);
  }
}

export async function POST(request: NextRequest) {
  try {
    const result = await requireTeamMember(request);
    if ('error' in result) return result.error;
    const { user, teamId } = result;

    const body = await request.json();
    const { company_name, contact_name, contact_email, scheduled_date, topic } = body;

    if (!company_name) return apiError('Company name is required', 400);
    if (!scheduled_date) return apiError('Scheduled date is required', 400);

    const supabase = createServiceClient();

    const { data: slot, error } = await supabase
      .from('office_hour_slots')
      .insert({
        team_id: teamId,
        company_name,
        contact_name: contact_name || null,
        contact_email: contact_email || null,
        scheduled_date,
        topic: topic || null,
        status: 'booked',
        booked_by: user.id,
      })
      .select()
      .single();

    if (error) return apiError('Failed to book office hours', 500);

    await logAuditEvent(supabase, {
      team_id: teamId,
      user_id: user.id,
      user_email: user.email,
      action: 'office_hours_booked',
      resource: 'office_hour_slot',
      resource_id: slot.id,
      ...getAuditContext(request),
      details: { company_name, topic, scheduled_date },
    });

    return apiSuccess({ slot });
  } catch {
    return apiError('Internal server error', 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const result = await requireTeamMember(request);
    if ('error' in result) return result.error;
    const { user, teamId } = result;

    const body = await request.json();
    const { id, status, notes, topic } = body;

    if (!id) return apiError('Slot ID is required', 400);

    const supabase = createServiceClient();

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (status !== undefined) updates.status = status;
    if (notes !== undefined) updates.notes = notes;
    if (topic !== undefined) updates.topic = topic;

    const { data: slot, error } = await supabase
      .from('office_hour_slots')
      .update(updates)
      .eq('id', id)
      .eq('team_id', teamId)
      .select()
      .single();

    if (error) return apiError('Failed to update slot', 500);

    await logAuditEvent(supabase, {
      team_id: teamId,
      user_id: user.id,
      user_email: user.email,
      action: status === 'cancelled' ? 'office_hours_cancelled' : 'office_hours_updated',
      resource: 'office_hour_slot',
      resource_id: id,
      ...getAuditContext(request),
      details: { status, notes, topic },
    });

    return apiSuccess({ slot });
  } catch {
    return apiError('Internal server error', 500);
  }
}
