import { requireSingleSession } from "@/lib/auth/require-single-session";
export const maxDuration = 60;

import { createServiceClient } from '@/lib/supabase/server';
import { getDealMemoGenerator, DealMemo, DealMemoInput } from '@/lib/ai/deal-memo-generator';
import { isProEmail } from '@/lib/config/authorized-emails';
import { captureApiError } from '@/lib/sentry-api';
import { createLogger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';
import { dealMemoSchema, formatZodErrors } from '@/lib/api-validation';

export interface DealMemoRequest {
  reportId?: string;
  inputs: DealMemoInput['inputs'];
  results: DealMemoInput['results'];
  labels: DealMemoInput['labels'];
  email?: string;
  userId?: string;
}

export interface DealMemoResponse {
  success: boolean;
  memo?: DealMemo;
  error?: string;
}

export async function POST(request: Request): Promise<Response> {
  const requestId = crypto.randomUUID();
  const log = createLogger('api:deal-memo', requestId);
  const elapsed = log.startTimer();

  try {
    // R72: Single-session enforcement — block stale sessions
    const sessionCheck = await requireSingleSession(request);
    if (sessionCheck) return sessionCheck;

    const body = (await request.json()) as DealMemoRequest;

    const parsed = dealMemoSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(formatZodErrors(parsed.error), 400);
    }

    const supabase = createServiceClient();

    // Authorization: verify report purchase OR pro tier
    let authorized = false;

    // Check 0 (R72): Server-side cookie auth — authoritative
    try {
      const { getAuthenticatedUser } = await import('@/lib/auth-helpers');
      const authUser = await getAuthenticatedUser(request);
      if (authUser?.id) {
        const { data: cookieProfile } = await supabase
          .from('user_profiles')
          .select('id, tier, email')
          .eq('id', authUser.id)
          .single();
        if (cookieProfile) {
          if (cookieProfile.tier === 'pro' || cookieProfile.tier === 'report') authorized = true;
          if (!authorized && cookieProfile.email && isProEmail(cookieProfile.email)) authorized = true;
        }
      }
    } catch {} // non-blocking

    // Check 1: Report purchase
    if (body.reportId) {
      const { data: report } = await supabase
        .from('report_purchases')
        .select('id, status, memo_content')
        .eq('id', body.reportId)
        .eq('status', 'completed')
        .single();

      if (report) {
        authorized = true;

        // Return cached memo if already generated
        if (report.memo_content) {
          return apiSuccess({ memo: report.memo_content as DealMemo });
        }
      }
    }

    // Check 2: Pro tier (database)
    if (!authorized && (body.userId || body.email)) {
      const query = supabase.from('user_profiles').select('tier, email');
      if (body.userId) {
        query.eq('id', body.userId);
      } else if (body.email) {
        query.eq('email', body.email);
      }
      const { data: profile } = await query.single();
      if (profile?.tier === 'pro' || profile?.tier === 'report') {
        authorized = true;
      }
      // Check email whitelist (team members, beta testers)
      if (!authorized && profile?.email && isProEmail(profile.email)) {
        authorized = true;
      }
    }

    // SECURITY: Removed body.email whitelist fallback — only trust email from
    // database profile (Check 2 above) to prevent tier escalation via request body.

    if (!authorized) {
      return apiError('Report purchase or Pro subscription required', 403);
    }

    // Generate memo
    log.info('Starting memo generation', { reportId: body.reportId, modality: body.inputs?.modality });
    const generator = getDealMemoGenerator();
    const memo = await generator.generateMemo({
      inputs: body.inputs,
      results: body.results,
      labels: body.labels,
    });

    // Cache memo in report_purchases if reportId provided
    if (body.reportId) {
      await supabase
        .from('report_purchases')
        .update({ memo_content: memo })
        .eq('id', body.reportId);
    }

    log.info('Request completed', { durationMs: elapsed() });
    return apiSuccess({ memo });
  } catch (error) {
    captureApiError(error, 'deal-memo', { requestId });
    log.error('Request failed', { durationMs: elapsed(), error: error instanceof Error ? error.message : String(error) });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    if (error instanceof SyntaxError) {
      return apiError('Invalid JSON in request body', 400);
    }

    if (error instanceof Error && error.message.includes('ANTHROPIC_API_KEY')) {
      return apiError('AI service configuration error', 500);
    }

    if (error instanceof Error && error.message.includes('No JSON found')) {
      return apiError('AI response format error. Retrying may help.', 500);
    }

    return apiError(`Generation failed: ${errorMessage.slice(0, 100)}`, 500);
  }
}
