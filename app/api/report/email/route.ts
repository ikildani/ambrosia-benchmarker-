import { NextRequest, NextResponse } from 'next/server';
import { getAuthenticatedUser } from '@/lib/auth-helpers';
import { createServiceClient } from '@/lib/supabase/server';
import { sendReportEmail } from '@/lib/email/client';

export const maxDuration = 15;

export async function POST(request: NextRequest) {
  try {
    const authUser = await getAuthenticatedUser(request);
    const userId = authUser?.id || null;

    const body = await request.json();
    const { email, pdfBase64, fileName, indication } = body as {
      email: string;
      pdfBase64: string;
      fileName: string;
      indication: string;
    };

    if (!email || !pdfBase64 || !fileName) {
      return NextResponse.json(
        { error: 'Email, PDF data, and filename are required' },
        { status: 400 }
      );
    }

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

    // Track event
    supabase.from('events').insert({
      user_id: userId,
      event_type: 'report_emailed',
      event_data: {
        recipient: email,
        file_name: fileName,
        indication,
        pdf_size_bytes: pdfBuffer.length,
      },
    }).then(({ error }) => {
      if (error) console.error('Event tracking error:', error.message);
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Report email error:', error);
    return NextResponse.json(
      { error: 'Failed to send report email' },
      { status: 500 }
    );
  }
}
