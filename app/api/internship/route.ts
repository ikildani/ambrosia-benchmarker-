import { NextRequest, NextResponse } from 'next/server';
import { sendEmail } from '@/lib/email/client';
import { captureApiError } from '@/lib/sentry-api';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const {
      name, email, university, graduation_year, major, track,
      linkedin, why_ambrosia, ambiguous_problem, source,
      availability, location, additional_notes, resume_filename, submitted_at,
    } = body;

    if (!name || !email || !university || !major || !track) {
      return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }

    // Send formatted email to admin
    const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'ikildani@ambrosiaventures.co';

    const html = `
      <!DOCTYPE html>
      <html>
        <head><meta charset="utf-8"></head>
        <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 640px; margin: 0 auto; padding: 20px; background: #f8fafc;">

          <!-- Header -->
          <div style="background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); padding: 32px; border-radius: 12px 12px 0 0; text-align: center;">
            <img src="https://solidus.ambrosiaventures.co/logo-white.png" alt="Ambrosia Ventures" width="160" style="display: block; margin: 0 auto 16px; width: 160px; height: auto;">
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 2px; color: #14b8a6; font-weight: 700; margin-bottom: 8px;">New Internship Application</div>
            <h1 style="color: #fff; margin: 0; font-size: 24px; font-weight: 800;">${name}</h1>
            <p style="color: #94a3b8; margin: 8px 0 0; font-size: 14px;">${university} · ${graduation_year} · ${major}</p>
          </div>

          <!-- Body -->
          <div style="background: #fff; padding: 32px; border: 1px solid #e2e8f0; border-top: none;">

            <!-- Track Badge -->
            <div style="margin-bottom: 24px;">
              <span style="display: inline-block; background: linear-gradient(135deg, #14b8a6, #06b6d4); color: #fff; padding: 6px 16px; border-radius: 20px; font-size: 13px; font-weight: 700;">${track}</span>
            </div>

            <!-- Contact Info -->
            <table style="width: 100%; border-collapse: collapse; margin-bottom: 24px;">
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; width: 140px; font-weight: 600;">Email</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; font-weight: 600;"><a href="mailto:${email}" style="color: #14b8a6; text-decoration: none;">${email}</a></td>
              </tr>
              ${linkedin ? `<tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">LinkedIn</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;"><a href="${linkedin}" style="color: #14b8a6; text-decoration: none;">${linkedin}</a></td>
              </tr>` : ''}
              ${resume_filename ? `<tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Resume</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;">${resume_filename}</td>
              </tr>` : ''}
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Availability</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;">${availability || 'Not specified'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Location</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;">${location || 'Not specified'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Source</td>
                <td style="padding: 10px 0; border-bottom: 1px solid #f1f5f9;">${source || 'Not specified'}</td>
              </tr>
              <tr>
                <td style="padding: 10px 0; color: #64748b; font-size: 12px; text-transform: uppercase; letter-spacing: 0.5px; font-weight: 600;">Submitted</td>
                <td style="padding: 10px 0;">${submitted_at || new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'full', timeStyle: 'short' })} ET</td>
              </tr>
            </table>

            <!-- Why Ambrosia -->
            <div style="margin-bottom: 24px;">
              <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #14b8a6; font-weight: 700; margin-bottom: 8px;">Why Ambrosia Ventures?</div>
              <div style="background: #f8fafc; border-radius: 8px; padding: 16px; font-size: 14px; color: #334155; line-height: 1.7; border-left: 3px solid #14b8a6;">${(why_ambrosia || '').replace(/\n/g, '<br>')}</div>
            </div>

            <!-- Ambiguous Problem -->
            <div style="margin-bottom: 24px;">
              <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #14b8a6; font-weight: 700; margin-bottom: 8px;">Ambiguous Problem Response</div>
              <div style="background: #f8fafc; border-radius: 8px; padding: 16px; font-size: 14px; color: #334155; line-height: 1.7; border-left: 3px solid #06b6d4;">${(ambiguous_problem || '').replace(/\n/g, '<br>')}</div>
            </div>

            ${additional_notes ? `
            <!-- Additional Notes -->
            <div style="margin-bottom: 24px;">
              <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 1px; color: #64748b; font-weight: 700; margin-bottom: 8px;">Additional Notes</div>
              <div style="background: #f8fafc; border-radius: 8px; padding: 16px; font-size: 14px; color: #334155; line-height: 1.7;">${additional_notes.replace(/\n/g, '<br>')}</div>
            </div>
            ` : ''}

            <!-- Reply CTA -->
            <div style="text-align: center; margin-top: 28px;">
              <a href="mailto:${email}?subject=Re: Ambrosia Ventures Internship Application" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); color: #fff; padding: 12px 28px; text-decoration: none; border-radius: 8px; font-weight: 600; font-size: 14px;">Reply to ${name.split(' ')[0]}</a>
            </div>
          </div>

          <!-- Footer -->
          <div style="text-align: center; padding: 16px; font-size: 11px; color: #94a3b8;">
            Ambrosia Ventures · Internship Cohort 2026
          </div>
        </body>
      </html>
    `;

    await sendEmail({
      to: adminEmail,
      subject: `Internship Application: ${name} — ${track} (${university})`,
      html,
      replyTo: email,
    });

    // Also send Slack notification
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (webhookUrl) {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `New internship application: ${name}`,
          attachments: [{
            color: '#14b8a6',
            blocks: [
              { type: 'header', text: { type: 'plain_text', text: `Internship Application: ${name}` } },
              { type: 'section', fields: [
                { type: 'mrkdwn', text: `*Email:*\n${email}` },
                { type: 'mrkdwn', text: `*Track:*\n${track}` },
                { type: 'mrkdwn', text: `*University:*\n${university} (${graduation_year})` },
                { type: 'mrkdwn', text: `*Major:*\n${major}` },
                { type: 'mrkdwn', text: `*Availability:*\n${availability || 'N/A'}` },
                { type: 'mrkdwn', text: `*Location:*\n${location || 'N/A'}` },
              ]},
            ],
          }],
        }),
      }).catch(() => {});
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    captureApiError(error, 'internship-application');
    console.error('Internship submission error:', error);
    return NextResponse.json({ error: 'Failed to submit application' }, { status: 500 });
  }
}
