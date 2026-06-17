import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { apiSuccess, apiError } from '@/lib/api-response';
import { logAuditEvent, getAuditContext } from '@/lib/audit-log';
import { requireTeamMember } from '@/lib/portfolio/auth';

export const dynamic = 'force-dynamic';

interface PipelineDeal {
  id: string;
  company_name: string;
  partner_name: string | null;
  stage: string;
  [key: string]: unknown;
}

interface Conflict {
  partner_name: string;
  companies: string[];
}

function detectConflicts(deals: PipelineDeal[]): Conflict[] {
  const partnerMap = new Map<string, Set<string>>();

  for (const deal of deals) {
    if (!deal.partner_name) continue;
    const key = deal.partner_name.toLowerCase().trim();
    if (!partnerMap.has(key)) partnerMap.set(key, new Set());
    partnerMap.get(key)!.add(deal.company_name);
  }

  const conflicts: Conflict[] = [];
  for (const [, companies] of partnerMap) {
    if (companies.size >= 2) {
      // Use the first deal's original casing for the partner name
      const partnerDeal = deals.find(
        (d) => d.partner_name && companies.has(d.company_name)
      );
      conflicts.push({
        partner_name: partnerDeal?.partner_name || '',
        companies: Array.from(companies),
      });
    }
  }

  return conflicts;
}

export async function GET(request: NextRequest) {
  try {
    const result = await requireTeamMember(request);
    if ('error' in result) return result.error;
    const { teamId } = result;

    const supabase = createServiceClient();

    const { data } = await supabase
      .from('portfolio_deal_pipelines')
      .select('*')
      .eq('team_id', teamId)
      .order('updated_at', { ascending: false });

    const deals = (data || []) as PipelineDeal[];
    const conflicts = detectConflicts(deals);

    return apiSuccess({ deals, conflicts });
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
    const {
      company_name, partner_name, stage, deal_type,
      therapeutic_area, modality, indication,
      estimated_value_m, notes, priority,
    } = body;

    if (!company_name) return apiError('Company name is required', 400);

    const supabase = createServiceClient();

    const { data: deal, error } = await supabase
      .from('portfolio_deal_pipelines')
      .insert({
        team_id: teamId,
        company_name,
        partner_name: partner_name || null,
        stage: stage || 'evaluating',
        deal_type: deal_type || null,
        therapeutic_area: therapeutic_area || null,
        modality: modality || null,
        indication: indication || null,
        estimated_value_m: estimated_value_m ? Number(estimated_value_m) : null,
        notes: notes || null,
        priority: priority || 'medium',
        updated_by: user.id,
      })
      .select()
      .single();

    if (error) return apiError('Failed to add pipeline deal', 500);

    // Check for conflicts after insertion
    const { data: allDeals } = await supabase
      .from('portfolio_deal_pipelines')
      .select('*')
      .eq('team_id', teamId);

    const conflicts = detectConflicts((allDeals || []) as PipelineDeal[]);

    await logAuditEvent(supabase, {
      team_id: teamId,
      user_id: user.id,
      user_email: user.email,
      action: 'pipeline_deal_added',
      resource: 'portfolio_deal_pipeline',
      resource_id: deal.id,
      ...getAuditContext(request),
      details: { company_name, partner_name, stage: stage || 'evaluating', therapeutic_area },
    });

    return apiSuccess({ deal, conflicts });
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
    const { id, stage, notes, priority, estimated_value_m } = body;

    if (!id) return apiError('Deal ID is required', 400);

    const supabase = createServiceClient();

    const updates: Record<string, unknown> = {
      updated_by: user.id,
      updated_at: new Date().toISOString(),
    };
    if (stage !== undefined) updates.stage = stage;
    if (notes !== undefined) updates.notes = notes;
    if (priority !== undefined) updates.priority = priority;
    if (estimated_value_m !== undefined) updates.estimated_value_m = estimated_value_m ? Number(estimated_value_m) : null;

    const { data: deal, error } = await supabase
      .from('portfolio_deal_pipelines')
      .update(updates)
      .eq('id', id)
      .eq('team_id', teamId)
      .select()
      .single();

    if (error) return apiError('Failed to update pipeline deal', 500);

    await logAuditEvent(supabase, {
      team_id: teamId,
      user_id: user.id,
      user_email: user.email,
      action: 'pipeline_deal_updated',
      resource: 'portfolio_deal_pipeline',
      resource_id: id,
      ...getAuditContext(request),
      details: { stage, notes, priority, estimated_value_m },
    });

    return apiSuccess({ deal });
  } catch {
    return apiError('Internal server error', 500);
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const result = await requireTeamMember(request);
    if ('error' in result) return result.error;
    const { user, teamId } = result;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) return apiError('Deal ID is required', 400);

    const supabase = createServiceClient();

    const { error } = await supabase
      .from('portfolio_deal_pipelines')
      .delete()
      .eq('id', id)
      .eq('team_id', teamId);

    if (error) return apiError('Failed to delete pipeline deal', 500);

    await logAuditEvent(supabase, {
      team_id: teamId,
      user_id: user.id,
      user_email: user.email,
      action: 'pipeline_deal_deleted',
      resource: 'portfolio_deal_pipeline',
      resource_id: id,
      ...getAuditContext(request),
    });

    return apiSuccess({ deleted: true });
  } catch {
    return apiError('Internal server error', 500);
  }
}
