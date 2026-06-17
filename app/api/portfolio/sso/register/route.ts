import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireTeamAdmin } from '@/lib/portfolio/auth';
import { apiSuccess, apiError } from '@/lib/api-response';
import { logAuditEvent, getAuditContext } from '@/lib/audit-log';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const auth = await requireTeamAdmin(request);
    if ('error' in auth) return auth.error;

    const { user, teamId, team } = auth;

    // Verify Enterprise tier
    if (team.portfolio_tier !== 'enterprise') {
      return apiError('SSO configuration requires Enterprise tier', 403, 'TIER_REQUIRED');
    }

    // Check that SSO fields are configured
    if (!team.sso_email_domain || !team.sso_entity_id || !team.sso_sso_url) {
      return apiError(
        'Please fill in all SSO fields (email domain, SAML entity ID, SAML SSO URL) in Team Settings before registering the provider.',
        400,
        'INCOMPLETE_CONFIG'
      );
    }

    const supabase = createServiceClient();

    // Attempt to register the SAML provider with Supabase Auth Admin API
    try {
      // Supabase's admin API for SSO uses createSSOProvider (if available)
      // The metadata_url can be either the Entity ID or a metadata XML URL
      const { data, error } = await (supabase.auth.admin as any).createSSOProvider({
        type: 'saml',
        metadata_url: team.sso_entity_id,
        domains: [team.sso_email_domain],
        attribute_mapping: {
          keys: {
            email: { name: 'email' },
          },
        },
      });

      if (error) {
        // If the provider already exists for this domain, treat as success
        if (error.message?.includes('already exists') || error.message?.includes('duplicate')) {
          // Update the team record to mark as configured
          await supabase
            .from('teams')
            .update({ sso_provider_id: team.sso_provider_id || 'configured' })
            .eq('id', teamId);

          await logAuditEvent(supabase, {
            team_id: teamId,
            user_id: user.id,
            user_email: user.email,
            action: 'sso_provider_registered',
            resource: 'team',
            resource_id: teamId,
            ...getAuditContext(request),
            details: {
              domain: team.sso_email_domain,
              provider: team.sso_provider_id,
              note: 'Provider already registered with Supabase',
            },
          });

          return apiSuccess({
            registered: true,
            provider_id: team.sso_provider_id || 'configured',
            message: 'SSO provider is already registered for this domain.',
          });
        }

        console.error('[SSO Register] Supabase admin error:', error.message);
        return apiError(
          'Failed to register SSO provider with Supabase. Please verify your SAML configuration.',
          500
        );
      }

      // Update team with the returned provider ID
      const providerId = data?.id || data?.provider?.id || 'registered';
      await supabase
        .from('teams')
        .update({ sso_provider_id: providerId })
        .eq('id', teamId);

      await logAuditEvent(supabase, {
        team_id: teamId,
        user_id: user.id,
        user_email: user.email,
        action: 'sso_provider_registered',
        resource: 'team',
        resource_id: teamId,
        ...getAuditContext(request),
        details: {
          domain: team.sso_email_domain,
          provider_id: providerId,
          entity_id: team.sso_entity_id,
        },
      });

      return apiSuccess({
        registered: true,
        provider_id: providerId,
        message: 'SSO provider registered successfully.',
      });
    } catch (adminError) {
      // If the admin SSO API isn't available (Supabase free tier, or API not supported),
      // fall back to marking the config as "configured" in the teams table
      const errorMessage = adminError instanceof Error ? adminError.message : 'Unknown error';

      if (
        errorMessage.includes('not a function') ||
        errorMessage.includes('createSSOProvider') ||
        errorMessage.includes('not enabled') ||
        errorMessage.includes('not available')
      ) {
        // Mark as configured — SSO login will still attempt signInWithSSO
        // and provide a clear error if Supabase SSO isn't available
        const configuredId = `manual_${Date.now()}`;
        await supabase
          .from('teams')
          .update({ sso_provider_id: configuredId })
          .eq('id', teamId);

        await logAuditEvent(supabase, {
          team_id: teamId,
          user_id: user.id,
          user_email: user.email,
          action: 'sso_provider_registered',
          resource: 'team',
          resource_id: teamId,
          ...getAuditContext(request),
          details: {
            domain: team.sso_email_domain,
            provider_id: configuredId,
            note: 'Registered locally — Supabase SSO admin API not available. Provider must be registered via Supabase dashboard.',
          },
          status: 'success',
        });

        return apiSuccess({
          registered: true,
          provider_id: configuredId,
          message: 'SSO configuration saved. Note: The SAML provider must also be registered in the Supabase dashboard for SSO login to function.',
          requires_dashboard_setup: true,
        });
      }

      console.error('[SSO Register] Unexpected error:', errorMessage);
      return apiError('Failed to register SSO provider', 500);
    }
  } catch {
    return apiError('Internal server error', 500);
  }
}
