import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { isProEmail } from '@/lib/config/authorized-emails';
import { getPlaybookGenerator, PlaybookInput, NegotiationPlaybook } from '@/lib/ai/playbook-generator';
import { captureApiError } from '@/lib/sentry-api';
import { createLogger } from '@/lib/logger';
import { apiSuccess, apiError } from '@/lib/api-response';
import { playbookSchema, formatZodErrors } from '@/lib/api-validation';

export interface PlaybookRequest {
  inputs: {
    modality: string;
    phase: string;
    indication: string;
    territory: string;
    therapeuticArea?: string;
  };
  results: PlaybookInput['results'];
  labels: {
    phase: string;
    modality: string;
    indication: string;
  };
  userId?: string;
  email?: string;
  reportId?: string;
}

export interface PlaybookResponse {
  success: boolean;
  playbook?: NegotiationPlaybook;
  error?: string;
}

export async function POST(request: NextRequest): Promise<Response> {
  const requestId = crypto.randomUUID();
  const log = createLogger('api:playbook', requestId);
  const elapsed = log.startTimer();

  try {
    // SECURITY: Require Pro tier — this is an expensive AI endpoint
    const supabase = createServiceClient();
    let authorized = false;

    const bodyText = await request.text();
    const body = JSON.parse(bodyText) as PlaybookRequest;

    const parsed = playbookSchema.safeParse(body);
    if (!parsed.success) {
      return apiError(formatZodErrors(parsed.error), 400);
    }

    // Auth method 1: Bearer token
    const authHeader = request.headers.get('authorization');
    if (authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      const { createClient } = await import('@supabase/supabase-js');
      const authClient = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data: { user } } = await authClient.auth.getUser(token);
      if (user) {
        const { data: profile } = await supabase
          .from('user_profiles')
          .select('tier, email')
          .eq('id', user.id)
          .single();
        if (profile?.tier === 'pro' || profile?.tier === 'report') authorized = true;
        if (!authorized && profile?.email && isProEmail(profile.email)) authorized = true;
      }
    }

    // Auth method 2: Report purchase (matches deal-memo pattern)
    if (!authorized && body.reportId) {
      const { data: report } = await supabase
        .from('report_purchases')
        .select('id, status')
        .eq('id', body.reportId)
        .eq('status', 'completed')
        .single();
      if (report) authorized = true;
    }

    // Auth method 3: userId/email in body (matches deal-memo pattern)
    if (!authorized && (body.userId || body.email)) {
      const query = supabase.from('user_profiles').select('tier, email');
      if (body.userId) {
        query.eq('id', body.userId);
      } else if (body.email) {
        query.eq('email', body.email);
      }
      const { data: profile } = await query.single();
      if (profile?.tier === 'pro' || profile?.tier === 'report') authorized = true;
      if (!authorized && profile?.email && isProEmail(profile.email)) authorized = true;
    }

    if (!authorized) {
      return apiError('Negotiation playbook requires a Report or Pro subscription.', 403);
    }

    // Generate playbook
    log.info('Starting playbook generation', { modality: body.inputs?.modality, phase: body.inputs?.phase });
    const generator = getPlaybookGenerator();
    const playbook = await generator.generatePlaybook({
      inputs: body.inputs,
      results: body.results,
      labels: body.labels,
    });

    log.info('Request completed', { durationMs: elapsed() });
    return apiSuccess({ playbook });
  } catch (error) {
    captureApiError(error, 'playbook', { requestId });
    log.error('Request failed', { durationMs: elapsed(), error: error instanceof Error ? error.message : String(error) });
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Handle specific error types
    if (error instanceof SyntaxError) {
      return apiError('Invalid JSON in request body', 400);
    }

    if (error instanceof Error && error.message.includes('ANTHROPIC_API_KEY')) {
      return apiError('AI service configuration error', 500);
    }

    // Include error details for debugging
    if (error instanceof Error && error.message.includes('No JSON found')) {
      return apiError('AI response format error. Retrying may help.', 500);
    }

    return apiError(`Generation failed: ${errorMessage.slice(0, 100)}`, 500);
  }
}
