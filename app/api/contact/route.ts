import { NextRequest } from 'next/server';
import { apiSuccess, apiError, apiErrorWithHeaders } from '@/lib/api-response';
import { checkRateLimit, getIdentifier, getRateLimitHeaders } from '@/lib/rate-limit';
import { sendEmail } from '@/lib/email/client';
import { z } from 'zod';

const contactSchema = z.object({
  name: z.string().min(1, 'Name is required').max(200, 'Name is too long'),
  email: z.string().email('Valid email is required'),
  company: z.string().max(200, 'Company name is too long').optional().default(''),
  subject: z.enum([
    'General Inquiry',
    'Pro Pricing',
    'Portfolio License',
    'Partnership',
    'Technical Support',
    'Other',
  ]),
  message: z.string().min(1, 'Message is required').max(5000, 'Message is too long'),
});

function buildAdminEmailHtml(data: z.infer<typeof contactSchema>): string {
  const timestamp = new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  return `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 24px;">New Contact Form Submission</h1>
          <p style="color: #94a3b8; margin: 8px 0 0; font-size: 14px;">${data.subject}</p>
        </div>

        <div style="background: #fff; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 16px 16px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 10px 0; color: #64748b; font-size: 13px; width: 90px; vertical-align: top;">Name</td>
              <td style="padding: 10px 0; font-weight: 600;">${escapeHtml(data.name)}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #64748b; font-size: 13px; vertical-align: top;">Email</td>
              <td style="padding: 10px 0; font-weight: 600;"><a href="mailto:${escapeHtml(data.email)}" style="color: #14b8a6;">${escapeHtml(data.email)}</a></td>
            </tr>
            ${data.company ? `<tr>
              <td style="padding: 10px 0; color: #64748b; font-size: 13px; vertical-align: top;">Company</td>
              <td style="padding: 10px 0;">${escapeHtml(data.company)}</td>
            </tr>` : ''}
            <tr>
              <td style="padding: 10px 0; color: #64748b; font-size: 13px; vertical-align: top;">Subject</td>
              <td style="padding: 10px 0;">${escapeHtml(data.subject)}</td>
            </tr>
            <tr>
              <td style="padding: 10px 0; color: #64748b; font-size: 13px; vertical-align: top;">Time</td>
              <td style="padding: 10px 0;">${timestamp}</td>
            </tr>
          </table>

          <div style="margin-top: 20px; padding: 16px; background: #f8fafc; border-radius: 12px; border: 1px solid #e2e8f0;">
            <div style="color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 600; margin-bottom: 8px;">Message</div>
            <div style="color: #1e293b; font-size: 14px; white-space: pre-wrap;">${escapeHtml(data.message)}</div>
          </div>
        </div>

        <div style="text-align: center; padding: 24px; color: #64748b; font-size: 12px;">
          <p style="margin: 0;">Ambrosia Ventures Contact Form</p>
        </div>
      </body>
    </html>
  `;
}

function buildConfirmationEmailHtml(name: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 24px;">Thanks for Reaching Out</h1>
        </div>

        <div style="background: #fff; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 16px 16px;">
          <p style="font-size: 16px;">Hi ${escapeHtml(name)},</p>

          <p>We received your message and will get back to you within 24 hours.</p>

          <p>In the meantime, feel free to explore our deal benchmarking tools:</p>

          <div style="text-align: center; margin: 32px 0;">
            <a href="https://calculator.ambrosiaventures.co" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); color: #fff; padding: 14px 32px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px;">
              Open Deal Calculator
            </a>
          </div>

          <p style="margin-top: 24px;">
            Best,<br>
            <strong>The Ambrosia Ventures Team</strong>
          </p>
        </div>

        <div style="text-align: center; padding: 24px; color: #64748b; font-size: 12px;">
          <p style="margin: 0;">
            Ambrosia Ventures | <a href="https://ambrosiaventures.co" style="color: #14b8a6;">ambrosiaventures.co</a>
          </p>
        </div>
      </body>
    </html>
  `;
}

/** Escape HTML entities to prevent XSS in email bodies. */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

export async function POST(request: NextRequest) {
  // Rate limiting — 3 contact form submissions per hour
  const identifier = getIdentifier(request);
  const rateLimitResult = await checkRateLimit(identifier, 'contact', {
    limit: 3,
    windowSeconds: 3600,
  });

  if (!rateLimitResult.success) {
    return apiErrorWithHeaders(
      'Too many requests. Please try again later.',
      429,
      getRateLimitHeaders(rateLimitResult),
    );
  }

  try {
    const body = await request.json();
    const parsed = contactSchema.safeParse(body);

    if (!parsed.success) {
      const message = parsed.error.issues
        .map((i) => (i.path.length > 0 ? `${i.path.join('.')}: ${i.message}` : i.message))
        .join('; ');
      return apiError(message, 400);
    }

    const data = parsed.data;

    // Send notification email to Ambrosia team
    const adminResult = await sendEmail({
      to: 'info@ambrosiaventures.co',
      from: 'Ambrosia Contact Form <info@ambrosiaventures.co>',
      replyTo: data.email,
      subject: `[Contact] ${data.subject} - ${data.name}`,
      html: buildAdminEmailHtml(data),
    });

    if (!adminResult.success) {
      console.error('Failed to send contact admin email:', adminResult.error);
      return apiError('Failed to send message. Please try again.', 500);
    }

    // Send confirmation email to the user (fire and forget)
    sendEmail({
      to: data.email,
      subject: 'We received your message — Ambrosia Ventures',
      html: buildConfirmationEmailHtml(data.name),
    }).catch((err) => {
      console.error('Failed to send contact confirmation email:', err);
    });

    return apiSuccess({ message: 'Message sent successfully' });
  } catch (error) {
    console.error('Contact form error:', error);
    return apiError('Internal server error', 500);
  }
}
