import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { requireAuth } from '@/lib/auth-helpers';
import { apiError, apiSuccess, apiErrorWithHeaders } from '@/lib/api-response';
import { emailSendSchema, formatZodErrors } from '@/lib/api-validation';
import { sendWelcomeEmail, sendCalculationReceipt, sendUpgradeConfirmation } from '@/lib/email/client';
import { captureApiError } from '@/lib/sentry-api';
import { checkRateLimit, getIdentifier, getRateLimitHeaders } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    // SECURITY: Require authenticated session
    const [user, authError] = await requireAuth(request);
    if (authError) return authError;

    // Rate limiting — 5 emails per hour per user
    const identifier = getIdentifier(request);
    const rateLimitResult = await checkRateLimit(identifier, 'email-send', { limit: 5, windowSeconds: 3600 });
    if (!rateLimitResult.success) {
      return apiErrorWithHeaders('Too many email requests', 429, getRateLimitHeaders(rateLimitResult));
    }

    const rawBody = await request.json();

    // Validate input with Zod
    const parsed = emailSendSchema.safeParse(rawBody);
    if (!parsed.success) {
      return apiError(formatZodErrors(parsed.error), 400);
    }

    const { email, type, name, data } = parsed.data;

    // SECURITY: User can only send emails to their own address
    if (email.toLowerCase() !== user.email?.toLowerCase()) {
      return apiError('Email must match authenticated user', 403);
    }

    const supabase = createServiceClient();
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
          return apiSuccess({ message: 'Welcome email already sent' });
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
          return apiSuccess({ message: 'Receipts disabled' });
        }

        if (!data) {
          return apiError('Calculation data required for receipt', 400);
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
        return apiError('Invalid email type', 400);
    }

    // Log the email
    await supabase.from('email_logs').insert({
      email,
      email_type: type,
      status: result.success ? 'sent' : 'failed',
      error_message: result.error || null,
    });

    if (result.success) {
      return apiSuccess({ id: result.id });
    } else {
      return apiError(result.error || 'Failed to send email', 500);
    }
  } catch (error) {
    captureApiError(error, 'email-send');
    return apiError('Internal server error', 500);
  }
}
