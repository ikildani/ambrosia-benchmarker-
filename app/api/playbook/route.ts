import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { isProEmail } from '@/lib/config/authorized-emails';
import { getPlaybookGenerator, PlaybookInput, NegotiationPlaybook } from '@/lib/ai/playbook-generator';
import { captureApiError } from '@/lib/sentry-api';

export interface PlaybookRequest {
  inputs: {
    modality: string;
    phase: string;
    indication: string;
    territory: string;
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

export async function POST(request: NextRequest): Promise<NextResponse<PlaybookResponse>> {
  try {
    // SECURITY: Require Pro tier — this is an expensive AI endpoint
    const supabase = createServiceClient();
    let authorized = false;

    const bodyText = await request.text();
    const body = JSON.parse(bodyText) as PlaybookRequest;

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
        if (profile?.tier === 'pro') authorized = true;
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
      if (profile?.tier === 'pro') authorized = true;
      if (!authorized && profile?.email && isProEmail(profile.email)) authorized = true;
    }

    if (!authorized) {
      // Temporary debug info to diagnose auth failures
      const debugInfo = {
        hasBearer: !!authHeader,
        hasUserId: !!body.userId,
        hasEmail: !!body.email,
        hasReportId: !!body.reportId,
      };
      console.error('[playbook] Auth failed:', JSON.stringify(debugInfo));
      return NextResponse.json(
        { success: false, error: 'Negotiation playbook is a Pro feature. Upgrade to access AI-powered negotiation strategies.', debug: debugInfo },
        { status: 403 }
      );
    }

    // Validate required fields
    if (!body.inputs || !body.results || !body.labels) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: inputs, results, labels' },
        { status: 400 }
      );
    }

    // Validate inputs structure
    if (!body.inputs.modality || !body.inputs.phase || !body.inputs.indication || !body.inputs.territory) {
      return NextResponse.json(
        { success: false, error: 'Invalid inputs: modality, phase, indication, and territory are required' },
        { status: 400 }
      );
    }

    // Validate results structure
    if (!body.results.terms || !body.results.tieredRoyalties || !body.results.dealRecommendation) {
      return NextResponse.json(
        { success: false, error: 'Invalid results: terms, tieredRoyalties, and dealRecommendation are required' },
        { status: 400 }
      );
    }

    // Generate playbook
    const generator = getPlaybookGenerator();
    const playbook = await generator.generatePlaybook({
      inputs: body.inputs,
      results: body.results,
      labels: body.labels,
    });

    return NextResponse.json({
      success: true,
      playbook,
    });
  } catch (error) {
    captureApiError(error, 'playbook');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    // Handle specific error types
    if (error instanceof SyntaxError) {
      return NextResponse.json(
        { success: false, error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    if (error instanceof Error && error.message.includes('ANTHROPIC_API_KEY')) {
      return NextResponse.json(
        { success: false, error: 'AI service configuration error' },
        { status: 500 }
      );
    }

    // Include error details for debugging
    if (error instanceof Error && error.message.includes('No JSON found')) {
      return NextResponse.json(
        { success: false, error: 'AI response format error. Retrying may help.' },
        { status: 500 }
      );
    }

    return NextResponse.json(
      { success: false, error: `Generation failed: ${errorMessage.slice(0, 100)}` },
      { status: 500 }
    );
  }
}
