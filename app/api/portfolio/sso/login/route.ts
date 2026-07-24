import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { apiSuccess, apiError } from '@/lib/api-response';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email || typeof email !== 'string') {
      return apiError('Email is required', 400);
    }

    // Basic email format check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return apiError('Invalid email format', 400);
    }

    // Extract domain from email
    const emailDomain = email.split('@')[1].toLowerCase();

    const supabase = createServiceClient();

    // Find a team with SSO configured for this email domain
    const { data: team, error: teamError } = await supabase
      .from('teams')
      .select('id, name, sso_provider_id, sso_email_domain, sso_entity_id, sso_sso_url, portfolio_tier')
      .eq('sso_email_domain', emailDomain)
      .not('sso_provider_id', 'is', null)
      .single();

    if (teamError || !team) {
      return apiError('No SSO configuration found for this email domain', 404);
    }

    // Verify the team has all required SSO fields
    if (!team.sso_entity_id || !team.sso_sso_url) {
      return apiError(
        'SSO is partially configured for this domain. Please contact your team administrator to complete the setup.',
        422
      );
    }

    // Initiate the Supabase SSO flow
    const appUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://solidus.ambrosiaventures.co';

    try {
      const { data, error } = await supabase.auth.signInWithSSO({
        domain: emailDomain,
        options: {
          redirectTo: `${appUrl}/auth/callback?next=/portfolio/admin`,
        },
      });

      if (error) {
        // Check for common SSO-not-available errors
        if (
          error.message?.includes('not enabled') ||
          error.message?.includes('not available') ||
          error.message?.includes('not supported') ||
          error.message?.includes('No SSO provider')
        ) {
          return apiError(
            'SSO requires Supabase Pro plan. Contact support to enable SSO for your organization.',
            503,
            'SSO_NOT_ENABLED'
          );
        }
        console.error('[SSO Login] Supabase SSO error:', error.message);
        return apiError('Failed to initiate SSO login. Please try again or contact support.', 500);
      }

      if (!data?.url) {
        return apiError('SSO provider did not return a login URL. Please contact support.', 500);
      }

      return apiSuccess({ url: data.url });
    } catch (ssoError) {
      // Graceful fallback if signInWithSSO is not available on this Supabase instance
      const errorMessage = ssoError instanceof Error ? ssoError.message : 'Unknown error';

      if (
        errorMessage.includes('signInWithSSO') ||
        errorMessage.includes('not a function') ||
        errorMessage.includes('not enabled')
      ) {
        return apiError(
          'SSO requires Supabase Pro plan. Contact support to enable SSO for your organization.',
          503,
          'SSO_NOT_ENABLED'
        );
      }

      console.error('[SSO Login] Unexpected error:', errorMessage);
      return apiError('Failed to initiate SSO login', 500);
    }
  } catch {
    return apiError('Internal server error', 500);
  }
}
