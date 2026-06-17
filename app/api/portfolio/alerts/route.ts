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
      .from('deal_alert_configs')
      .select('*')
      .eq('team_id', teamId)
      .order('created_at', { ascending: false });

    return apiSuccess({ alerts: data || [] });
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
    const { name, alert_type, filters, channels, frequency } = body;

    if (!name) return apiError('Name is required', 400);

    const supabase = createServiceClient();

    const { data: alert, error } = await supabase
      .from('deal_alert_configs')
      .insert({
        team_id: teamId,
        user_id: user.id,
        created_by: user.id,
        name,
        alert_type: alert_type || 'deal_feed',
        filters: filters || {},
        channels: channels || ['email'],
        frequency: frequency || null,
      })
      .select()
      .single();

    if (error) return apiError('Failed to create alert config', 500);

    await logAuditEvent(supabase, {
      user_id: user.id,
      user_email: user.email,
      action: 'deal_alert_created',
      resource: 'deal_alert_config',
      resource_id: alert.id,
      ...getAuditContext(request),
      details: { name, alert_type: alert_type || 'deal_feed' },
    });

    return apiSuccess({ alert });
  } catch {
    return apiError('Internal server error', 500);
  }
}

export async function PUT(request: NextRequest) {
  try {
    const result = await requireTeamMember(request);
    if ('error' in result) return result.error;
    const { teamId } = result;

    const body = await request.json();
    const { id, is_active, name, filters, channels, frequency } = body;

    if (!id) return apiError('Alert config ID is required', 400);

    const supabase = createServiceClient();

    const updates: Record<string, unknown> = {};
    if (is_active !== undefined) updates.is_active = is_active;
    if (name !== undefined) updates.name = name;
    if (filters !== undefined) updates.filters = filters;
    if (channels !== undefined) updates.channels = channels;
    if (frequency !== undefined) updates.frequency = frequency;

    const { error } = await supabase
      .from('deal_alert_configs')
      .update(updates)
      .eq('id', id)
      .eq('team_id', teamId);

    if (error) return apiError('Failed to update alert config', 500);

    return apiSuccess({ updated: true });
  } catch {
    return apiError('Internal server error', 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const result = await requireTeamMember(request);
    if ('error' in result) return result.error;
    const { teamId } = result;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return apiError('Alert config ID is required', 400);

    const supabase = createServiceClient();

    const { error } = await supabase
      .from('deal_alert_configs')
      .delete()
      .eq('id', id)
      .eq('team_id', teamId);

    if (error) return apiError('Failed to delete alert config', 500);

    return apiSuccess({ deleted: true });
  } catch {
    return apiError('Internal server error', 500);
  }
}
