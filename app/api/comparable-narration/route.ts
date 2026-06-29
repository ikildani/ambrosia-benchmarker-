import { NextRequest } from 'next/server';
export const maxDuration = 60;

import { createServiceClient } from '@/lib/supabase/server';
import { isProEmail } from '@/lib/config/authorized-emails';
import { narrateComparables, type ComparableNarrationResult } from '@/lib/ai/comparable-narrator';
import { apiSuccess, apiError } from '@/lib/api-response';
import { createLogger } from '@/lib/logger';

export async function POST(request: NextRequest): Promise<Response> {
  const log = createLogger('api:comparable-narration');
  const elapsed = log.startTimer();

  try {
    const body = await request.json();
    const { inputs, results, comparables, rnpv } = body;

    if (!inputs || !results || !comparables) {
      return apiError('inputs, results, and comparables are required', 400);
    }

    // Auth: cookie → email → userId
    let authorized = false;
    const supabase = createServiceClient();

    try {
      const { getAuthenticatedUser } = await import('@/lib/auth-helpers');
      const authUser = await getAuthenticatedUser(request);
      if (authUser?.id) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('tier, email')
          .eq('id', authUser.id)
          .single();
        if (profile?.tier === 'pro' || profile?.tier === 'report' || profile?.tier === 'portfolio') authorized = true;
        if (!authorized && profile?.email && isProEmail(profile.email)) authorized = true;
      }
    } catch {}

    if (!authorized && body.email) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('tier, email')
        .eq('email', body.email.toLowerCase().trim())
        .single();
      if (profile?.tier === 'pro' || profile?.tier === 'report' || profile?.tier === 'portfolio') authorized = true;
      if (!authorized && profile?.email && isProEmail(profile.email)) authorized = true;
    }

    if (!authorized) {
      return apiError('Pro subscription required for AI comparable narration', 403);
    }

    const result = await narrateComparables(inputs, results, comparables, rnpv);

    log.info('Narration complete', { durationMs: elapsed(), dealCount: comparables.length });
    return apiSuccess({ narration: result });
  } catch (error) {
    log.error('Narration failed', { error: error instanceof Error ? error.message : String(error), durationMs: elapsed() });
    return apiError('Narration failed', 500);
  }
}
