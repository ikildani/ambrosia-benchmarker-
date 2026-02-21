import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { createServiceClient } from '@/lib/supabase/server';
import { sendReportEmail } from '@/lib/email/client';
import { captureApiError } from '@/lib/sentry-api';
import { hashEmail, reportEmailSchema } from '@/lib/api-validation';

export const maxDuration = 15;

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(request);
    const userId = authUser?.id || null;

    const rawBody = await request.json();

    // Validate input with Zod schema (also sanitizes fileName)
    const parseResult = reportEmailSchema.safeParse(rawBody);
    if (!parseResult.success) {
      const firstError = parseResult.error.issues[0]?.message || 'Invalid input';
      return NextResponse.json(
        { error: firstError },
        { status: 400 }
      );
    }
    const { email, pdfBase64, fileName, indication } = parseResult.data;

    // Verify access: must be Pro tier or authenticated user
    const supabase = createServiceClient();
    let hasAccess = false;

    if (userId) {
      const { data: profile } = await supabase
        .from('user_profiles')
        .select('tier')
        .eq('id', userId)
        .single();

      if (profile?.tier === 'pro') {
        hasAccess = true;
      }
    }

    if (!hasAccess) {
      return NextResponse.json(
        { error: 'Pro subscription required' },
        { status: 403 }
      );
    }

    // Convert base64 to Buffer
    const pdfBuffer = Buffer.from(pdfBase64, 'base64');

    // Send email with PDF attachment
    const result = await sendReportEmail(email, indication, pdfBuffer, fileName);

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to send email' },
        { status: 500 }
      );
    }

    // Track event (hash email to avoid storing PII in event_data)
    const emailHash = await hashEmail(email);
    supabase.from('events').insert({
      user_id: userId,
      event_type: 'report_emailed',
      event_data: {
        recipient_hash: emailHash,
        file_name: fileName,
        indication,
        pdf_size_bytes: pdfBuffer.length,
      },
    }).then(({ error }) => {
      if (error) console.error('Event tracking error:', error.message);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    captureApiError(error, 'report-email');
    return NextResponse.json(
      { error: 'Failed to send report email' },
      { status: 500 }
    );
  }
}
