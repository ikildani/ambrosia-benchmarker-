import { NextRequest } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { apiSuccess, apiError } from '@/lib/api-response';
import { checkRateLimit, getIdentifier, RATE_LIMIT_CONFIGS } from '@/lib/rate-limit';
import { sendEmail } from '@/lib/email/client';

/**
 * POST /api/report-download
 *
 * Email-gated report download. Captures email + metadata into
 * newsletter_subscribers (with source='gated_report'), then returns
 * the report URL. Also sends a follow-up email with the download link
 * so the user has it in their inbox.
 */
export async function POST(request: NextRequest) {
  const identifier = getIdentifier(request);
  const rateLimitResult = await checkRateLimit(identifier, 'newsletter', { limit: 5, windowSeconds: 60 });
  if (!rateLimitResult.success) {
    return apiError('Too many requests', 429);
  }

  try {
    const body = await request.json();
    const { email, name, company, title, report_slug } = body;

    if (!email || !report_slug) {
      return apiError('Email and report_slug are required', 400);
    }

    const normalizedEmail = email.trim().toLowerCase();
    const supabase = createServiceClient();

    // Upsert into newsletter_subscribers with gated_report source
    const { data: existing } = await supabase
      .from('newsletter_subscribers')
      .select('id')
      .eq('email', normalizedEmail)
      .single();

    if (existing) {
      await supabase
        .from('newsletter_subscribers')
        .update({
          source: 'gated_report',
          metadata: { report: report_slug, name, company, title, downloaded_at: new Date().toISOString() },
        })
        .eq('email', normalizedEmail);
    } else {
      await supabase
        .from('newsletter_subscribers')
        .insert({
          email: normalizedEmail,
          source: 'gated_report',
          status: 'active',
          metadata: { report: report_slug, name, company, title, downloaded_at: new Date().toISOString() },
        });
    }

    // Track the download event
    await supabase.from('events').insert({
      event_type: 'report_downloaded',
      event_data: { email: normalizedEmail, report: report_slug, name, company, title },
    });

    // Send follow-up email with download link
    const reportUrl = `https://calculator.ambrosiaventures.co/reports/${report_slug}.pdf`;
    try {
      await sendEmail({
        to: normalizedEmail,
        subject: 'Your Ambrosia Benchmarks Report is ready',
        html: `
          <div style="font-family: -apple-system, sans-serif; max-width: 560px; margin: 0 auto; padding: 40px 24px; background: #0a0d1b; color: #f4f1e8;">
            <p style="font-size: 14px; color: #e2e8f0; line-height: 1.6;">
              ${name ? name + ' — ' : ''}Your report is ready.
            </p>
            <p style="font-size: 14px; color: #c8d0db; line-height: 1.6; margin-top: 12px;">
              Bookmark this link for reference — the report stays available for 30 days:
            </p>
            <a href="${reportUrl}" style="display: inline-block; margin-top: 16px; padding: 14px 28px; background: #0d9488; color: white; font-size: 14px; font-weight: 600; border-radius: 8px; text-decoration: none;">
              Download Report (PDF)
            </a>
            <p style="font-size: 13px; color: #94a3b8; margin-top: 24px; line-height: 1.6;">
              Want the interactive version? Every number in this report is live-modifiable on
              <a href="https://calculator.ambrosiaventures.co/calculator" style="color: #5fd4e3;">calculator.ambrosiaventures.co</a>
              — adjust phase, modality, indication, and see how the comp set shifts in real time.
            </p>
            <hr style="border: none; border-top: 1px solid rgba(244,241,232,0.08); margin: 24px 0;" />
            <p style="font-size: 11px; color: #475569;">Ambrosia Ventures · ambrosiaventures.co</p>
          </div>
        `,
        replyTo: 'ikildani@ambrosiaventures.co',
      });
    } catch {} // non-blocking

    return apiSuccess({
      message: 'Report access granted',
      download_url: reportUrl,
    });
  } catch (error) {
    console.error('Report download error:', error);
    return apiError('Failed to process download request', 500);
  }
}
