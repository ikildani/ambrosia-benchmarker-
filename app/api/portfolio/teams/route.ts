import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { apiSuccess, apiError } from '@/lib/api-response';
import { logAuditEvent, getAuditContext } from '@/lib/audit-log';
import { requireTeamAdmin } from '@/lib/portfolio/auth';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const user = await getAuthenticatedUser(request);
    if (!user) return apiError('Unauthorized', 401);

    const body = await request.json();
    const { name, slug, portfolioTier, maxSeats, contractStartDate, contractEndDate } = body;

    if (!name || !slug) {
      return apiError('Team name and slug are required', 400);
    }

    const supabase = createServiceClient();

    const slugClean = slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');

    const { data: existing } = await supabase
      .from('teams')
      .select('id')
      .eq('slug', slugClean)
      .single();

    if (existing) {
      return apiError('A team with this slug already exists', 409);
    }

    const tierDefaults: Record<string, { seats: number; hours: number }> = {
      growth: { seats: 5, hours: 2 },
      scale: { seats: 10, hours: 5 },
      enterprise: { seats: 15, hours: 10 },
    };
    const tier = portfolioTier || 'growth';
    const defaults = tierDefaults[tier] || tierDefaults.growth;

    const { data: team, error: teamError } = await supabase
      .from('teams')
      .insert({
        name,
        slug: slugClean,
        portfolio_tier: tier,
        max_seats: maxSeats || defaults.seats,
        analyst_hours_monthly: defaults.hours,
        contract_start_date: contractStartDate || new Date().toISOString().split('T')[0],
        contract_end_date: contractEndDate || null,
        created_by: user.id,
      })
      .select()
      .single();

    if (teamError) {
      return apiError('Failed to create team', 500);
    }

    const { error: memberError } = await supabase
      .from('team_members')
      .insert({
        team_id: team.id,
        user_id: user.id,
        role: 'admin',
        status: 'active',
        accepted_at: new Date().toISOString(),
      });

    if (memberError) {
      await supabase.from('teams').delete().eq('id', team.id);
      return apiError('Failed to set up team admin', 500);
    }

    await supabase
      .from('user_profiles')
      .update({ tier: 'portfolio', team_id: team.id })
      .eq('id', user.id);

    await logAuditEvent(supabase, {
      user_id: user.id,
      user_email: user.email,
      action: 'team_created',
      resource: 'team',
      resource_id: team.id,
      ...getAuditContext(request),
      details: { name, slug: slugClean, tier, maxSeats: team.max_seats },
    });

    return apiSuccess({ team });
  } catch {
    return apiError('Internal server error', 500);
  }
}

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

    if (!membership) {
      return apiSuccess({ team: null });
    }

    const { data: team } = await supabase
      .from('teams')
      .select('*')
      .eq('id', membership.team_id)
      .single();

    return apiSuccess({ team, role: membership.role });
  } catch {
    return apiError('Internal server error', 500);
  }
}

const ALLOWED_FIELDS = new Set([
  'logo_url',
  'primary_color',
  'secondary_color',
  'disclaimer_text',
  'slack_webhook_url',
  'slack_channel_type',
]);

const BLOCKED_FIELDS = new Set([
  'portfolio_tier',
  'max_seats',
  'stripe_customer_id',
  'stripe_subscription_id',
  'stripe_price_id',
  'contract_start_date',
  'contract_end_date',
]);

const SSO_FIELDS = new Set([
  'sso_provider_id',
  'sso_email_domain',
  'sso_entity_id',
  'sso_sso_url',
]);

export async function PATCH(request: NextRequest) {
  try {
    const auth = await requireTeamAdmin(request);
    if ('error' in auth) return auth.error;

    const { user, teamId } = auth;

    const body = await request.json();
    const supabase = createServiceClient();

    // Filter to only allowed fields, explicitly reject blocked fields
    const updates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (BLOCKED_FIELDS.has(key)) continue;
      if (ALLOWED_FIELDS.has(key)) {
        updates[key] = value;
      }
    }

    // SSO fields require enterprise tier
    const ssoUpdates: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(body)) {
      if (SSO_FIELDS.has(key)) {
        ssoUpdates[key] = value;
      }
    }

    if (Object.keys(ssoUpdates).length > 0) {
      const { data: team } = await supabase
        .from('teams')
        .select('portfolio_tier')
        .eq('id', teamId)
        .single();

      if (team?.portfolio_tier === 'enterprise') {
        Object.assign(updates, ssoUpdates);
      }
    }

    if (Object.keys(updates).length === 0) {
      return apiError('No valid fields to update', 400);
    }

    const { error: updateError } = await supabase
      .from('teams')
      .update(updates)
      .eq('id', teamId);

    if (updateError) {
      return apiError('Failed to update team settings', 500);
    }

    await logAuditEvent(supabase, {
      user_id: user.id,
      user_email: user.email,
      action: 'team_settings_updated',
      resource: 'team',
      resource_id: teamId,
      ...getAuditContext(request),
      details: { fields: Object.keys(updates) },
    });

    return apiSuccess({ updated: true });
  } catch {
    return apiError('Internal server error', 500);
  }
}
