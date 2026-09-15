import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth-helpers';
import { apiSuccess, apiError } from '@/lib/api-response';
import { captureApiError } from '@/lib/sentry-api';
import { enrichProfile } from '@/lib/enrichment/profile-enrichment';

export const dynamic = 'force-dynamic';

/**
 * POST /api/user/profile/enrich
 *
 * Called by the client right after sign-in. Fills empty identity fields on
 * the caller's own profile from the email domain, the companies table and
 * Apollo (when configured). Returns the fields that were filled so the
 * "Tell us about yourself" step can pre-fill them. Idempotent; a complete
 * profile returns { filled: {} } without touching anything.
 */
export async function POST(request: NextRequest): Promise<NextResponse> {
  try {
    const [user, authError] = await requireAuth(request);
    if (authError) return authError;

    const supabase = createServiceClient();
    const { data: profile, error } = await supabase
      .from('user_profiles')
      .select('id, email, full_name, company_name, company_domain, company_type, job_title, job_function, profile_enriched_at')
      .eq('id', user.id)
      .single();
    if (error || !profile) return apiError('Profile not found', 404);

    // One enrichment pass per profile from this path; the daily cron retries
    // anything still empty, so a failed Apollo call is not a dead end.
    if (profile.profile_enriched_at) {
      return apiSuccess({ filled: {}, sources: {}, skipped: 'already_enriched' });
    }

    const result = await enrichProfile(supabase, profile);
    return apiSuccess({ filled: result.filled, sources: result.sources, skipped: result.skipped ?? null });
  } catch (error) {
    captureApiError(error, 'profile-enrich');
    return apiError('Internal server error', 500);
  }
}
