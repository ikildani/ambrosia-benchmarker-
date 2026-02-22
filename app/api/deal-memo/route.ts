import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { getDealMemoGenerator, DealMemo, DealMemoInput } from '@/lib/ai/deal-memo-generator';
import { isProEmail } from '@/lib/config/authorized-emails';
import { captureApiError } from '@/lib/sentry-api';

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

export async function POST(request: Request): Promise<NextResponse<DealMemoResponse>> {
  try {
    const body = (await request.json()) as DealMemoRequest;

    if (!body.inputs || !body.results || !body.labels) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: inputs, results, labels' },
        { status: 400 }
      );
    }

    const supabase = createServiceClient();

    // Authorization: verify report purchase OR pro tier
    let authorized = false;

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
          return NextResponse.json({
            success: true,
            memo: report.memo_content as DealMemo,
          });
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
      if (profile?.tier === 'pro') {
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
      // Temporary debug info to diagnose auth failures
      const debugInfo = {
        hasReportId: !!body.reportId,
        hasUserId: !!body.userId,
        hasEmail: !!body.email,
      };
      console.error('[deal-memo] Auth failed:', JSON.stringify(debugInfo));
      return NextResponse.json(
        { success: false, error: 'Report purchase or Pro subscription required', debug: debugInfo },
        { status: 403 }
      );
    }

    // Generate memo
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

    return NextResponse.json({ success: true, memo });
  } catch (error) {
    captureApiError(error, 'deal-memo');
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

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
