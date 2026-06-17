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
    const { searchParams } = new URL(request.url);

    let query = supabase
      .from('playbook_templates')
      .select('*')
      .or(`is_system.eq.true,team_id.eq.${teamId}`);

    const dealType = searchParams.get('deal_type');
    const therapeuticArea = searchParams.get('therapeutic_area');
    const phase = searchParams.get('phase');

    if (dealType) query = query.eq('deal_type', dealType);
    if (therapeuticArea) query = query.eq('therapeutic_area', therapeuticArea);
    if (phase) query = query.eq('phase', phase);

    const { data, error } = await query
      .order('deal_type')
      .order('created_at', { ascending: false });

    if (error) return apiError('Failed to fetch playbooks', 500);

    return apiSuccess({ playbooks: data || [] });
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
    const { deal_type, title, description, template_content, therapeutic_area, phase } = body;

    if (!deal_type) return apiError('Deal type is required', 400);
    if (!title) return apiError('Title is required', 400);

    const supabase = createServiceClient();

    const { data: newPlaybook, error } = await supabase
      .from('playbook_templates')
      .insert({
        deal_type,
        title,
        description: description || null,
        template_content: template_content || {},
        therapeutic_area: therapeutic_area || null,
        phase: phase || null,
        is_system: false,
        team_id: teamId,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) return apiError('Failed to create playbook', 500);

    await logAuditEvent(supabase, {
      team_id: teamId,
      user_id: user.id,
      user_email: user.email,
      action: 'playbook_created',
      resource: 'playbook_template',
      resource_id: newPlaybook.id,
      ...getAuditContext(request),
      details: { title, deal_type },
    });

    return apiSuccess({ playbook: newPlaybook }, 201);
  } catch {
    return apiError('Internal server error', 500);
  }
}
