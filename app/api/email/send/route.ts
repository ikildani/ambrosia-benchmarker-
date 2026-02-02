import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { sendWelcomeEmail, sendCalculationReceipt, sendUpgradeConfirmation } from '@/lib/email/client';

export const dynamic = 'force-dynamic';

type EmailType = 'welcome' | 'calculation_receipt' | 'upgrade_confirmation';

export async function POST(request: NextRequest) {
  try {
    const supabase = createServiceClient();
    const body = await request.json();
    const { email, type, name, data } = body as {
      email: string;
      type: EmailType;
      name: string;
      data?: Record<string, string>;
    };

    if (!email || !type) {
      return NextResponse.json(
        { error: 'Email and type are required' },
        { status: 400 }
      );
    }

    let result;

    switch (type) {
      case 'welcome':
        // Check if welcome email already sent
        const { data: prefs } = await supabase
          .from('email_preferences')
          .select('welcome_sent')
          .eq('email', email)
          .single();

        if (prefs?.welcome_sent) {
          return NextResponse.json({ success: true, message: 'Welcome email already sent' });
        }

        result = await sendWelcomeEmail(email, name || 'there');

        // Update preferences
        await supabase
          .from('email_preferences')
          .upsert({
            email,
            welcome_sent: true,
          }, { onConflict: 'email' });
        break;

      case 'calculation_receipt':
        // Check if user has receipts enabled
        const { data: receiptPrefs } = await supabase
          .from('email_preferences')
          .select('calculation_receipts')
          .eq('email', email)
          .single();

        if (receiptPrefs && receiptPrefs.calculation_receipts === false) {
          return NextResponse.json({ success: true, message: 'Receipts disabled' });
        }

        if (!data) {
          return NextResponse.json(
            { error: 'Calculation data required for receipt' },
            { status: 400 }
          );
        }

        result = await sendCalculationReceipt(email, name || 'there', {
          modality: data.modality || 'Unknown',
          phase: data.phase || 'Unknown',
          indication: data.indication || 'Unknown',
          upfront: data.upfront || '$0',
          totalValue: data.totalValue || '$0',
        });
        break;

      case 'upgrade_confirmation':
        result = await sendUpgradeConfirmation(email, name || 'there');
        break;

      default:
        return NextResponse.json(
          { error: 'Invalid email type' },
          { status: 400 }
        );
    }

    // Log the email
    await supabase.from('email_logs').insert({
      email,
      email_type: type,
      status: result.success ? 'sent' : 'failed',
      error_message: result.error || null,
    });

    if (result.success) {
      return NextResponse.json({ success: true, id: result.id });
    } else {
      return NextResponse.json(
        { error: result.error || 'Failed to send email' },
        { status: 500 }
      );
    }
  } catch (error) {
    console.error('Email API error:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
