import sgMail from '@sendgrid/mail';
import { DEAL_STATS } from '@/lib/config/constants';

const DEFAULT_FROM = 'Ambrosia Ventures <info@ambrosiaventures.co>';
const DEFAULT_REPLY_TO = 'hello@ambrosiaventures.co';

function initSendGrid(): boolean {
  const apiKey = process.env.SENDGRID_API_KEY;
  if (!apiKey) return false;
  sgMail.setApiKey(apiKey);
  return true;
}

export interface EmailOptions {
  to: string;
  subject: string;
  html: string;
  from?: string;
  replyTo?: string;
}

export async function sendEmail(options: EmailOptions) {
  const { to, subject, html, from, replyTo } = options;

  if (!initSendGrid()) {
    console.log('SendGrid API key not configured, skipping email');
    return { success: false, error: 'Email not configured' };
  }

  try {
    const [response] = await sgMail.send({
      to,
      from: from || DEFAULT_FROM,
      replyTo: replyTo || DEFAULT_REPLY_TO,
      subject,
      html,
    });

    return { success: true, id: response.headers['x-message-id'] };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to send email';
    console.error('Email send error:', message);
    return { success: false, error: message };
  }
}

export async function sendWelcomeEmail(to: string, name: string) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 24px;">Welcome to Ambrosia Ventures</h1>
        </div>

        <div style="background: #fff; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 16px 16px;">
          <p style="font-size: 16px;">Hi ${name},</p>

          <p>Thank you for signing up for Solidus!</p>

          <p>You now have access to our industry-leading biotech deal benchmarking tool. Here's what you can do:</p>

          <ul style="padding-left: 20px;">
            <li><strong>Benchmark deals</strong> across 17+ modalities</li>
            <li><strong>Get instant estimates</strong> for upfront payments, milestones, and royalties</li>
            <li><strong>Match with partners</strong> actively acquiring in your therapeutic area</li>
          </ul>

          <div style="text-align: center; margin: 32px 0;">
            <a href="https://solidus.ambrosiaventures.co" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); color: #fff; padding: 14px 32px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px;">
              Start Calculating
            </a>
          </div>

          <p>Need help closing a deal? Our advisory team provides full market mapping, warm introductions, and deal support.</p>

          <p style="margin-top: 24px;">
            Best,<br>
            <strong>The Ambrosia Ventures Team</strong>
          </p>
        </div>

        <div style="text-align: center; padding: 24px; color: #64748b; font-size: 12px;">
          <p style="margin: 0;">
            Ambrosia Ventures | <a href="https://ambrosiaventures.co" style="color: #14b8a6;">ambrosiaventures.co</a>
          </p>
          <p style="margin: 8px 0 0;">
            <a href="https://solidus.ambrosiaventures.co/unsubscribe" style="color: #64748b;">Unsubscribe</a>
          </p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: 'Welcome to Solidus',
    html,
  });
}

export async function sendCalculationReceipt(
  to: string,
  name: string,
  calculation: {
    modality: string;
    phase: string;
    indication: string;
    upfront: string;
    totalValue: string;
  }
) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 24px;">Your Deal Analysis</h1>
        </div>

        <div style="background: #fff; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 16px 16px;">
          <p style="font-size: 16px;">Hi ${name},</p>

          <p>Here's a summary of your recent deal calculation:</p>

          <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <div style="margin-bottom: 12px;">
              <span style="color: #64748b; font-size: 12px; text-transform: uppercase;">Asset Profile</span>
              <p style="margin: 4px 0; font-weight: 600;">${calculation.phase} • ${calculation.modality} • ${calculation.indication}</p>
            </div>

            <div style="display: flex; gap: 20px; margin-top: 16px;">
              <div style="flex: 1;">
                <span style="color: #64748b; font-size: 12px; text-transform: uppercase;">Upfront</span>
                <p style="margin: 4px 0; font-weight: 700; font-size: 18px; color: #14b8a6;">${calculation.upfront}</p>
              </div>
              <div style="flex: 1;">
                <span style="color: #64748b; font-size: 12px; text-transform: uppercase;">Total Value</span>
                <p style="margin: 4px 0; font-weight: 700; font-size: 18px; color: #16a34a;">${calculation.totalValue}</p>
              </div>
            </div>
          </div>

          <div style="text-align: center; margin: 24px 0;">
            <a href="https://solidus.ambrosiaventures.co" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 10px; font-weight: 600;">
              View Full Analysis
            </a>
          </div>

          <p style="color: #64748b; font-size: 14px;">
            This is an automated receipt of your calculation. You can disable these emails in your account settings.
          </p>
        </div>

        <div style="text-align: center; padding: 24px; color: #64748b; font-size: 12px;">
          <p style="margin: 0;">Solidus</p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: `Deal Analysis: ${calculation.modality} - ${calculation.phase}`,
    html,
  });
}

export async function sendReportEmail(
  to: string,
  indication: string,
  pdfBuffer: Buffer,
  fileName: string
) {
  if (!initSendGrid()) {
    console.log('SendGrid API key not configured, skipping email');
    return { success: false, error: 'Email not configured' };
  }

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 24px;">Your Deal Report</h1>
          <p style="color: #94a3b8; margin: 8px 0 0; font-size: 14px;">${indication}</p>
        </div>

        <div style="background: #fff; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 16px 16px;">
          <p>Your consulting-grade deal analysis report is attached to this email as a PDF.</p>

          <div style="background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 12px; padding: 20px; margin: 24px 0; text-align: center;">
            <div style="font-size: 14px; font-weight: 600; color: #0d9488; margin-bottom: 4px;">Report Attached</div>
            <div style="font-size: 12px; color: #64748b;">${fileName}</div>
          </div>

          <p style="font-size: 14px; color: #64748b;">
            This report includes deal benchmarking, sensitivity analysis, comparable deals, partner matching, and strategic insights.
          </p>

          <div style="text-align: center; margin: 24px 0;">
            <a href="https://solidus.ambrosiaventures.co" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 10px; font-weight: 600;">
              Run Another Analysis
            </a>
          </div>
        </div>

        <div style="text-align: center; padding: 24px; color: #64748b; font-size: 12px;">
          <p style="margin: 0;">Solidus</p>
        </div>
      </body>
    </html>
  `;

  try {
    const [response] = await sgMail.send({
      to,
      from: DEFAULT_FROM,
      replyTo: DEFAULT_REPLY_TO,
      subject: `Your Ambrosia Deal Report: ${indication}`,
      html,
      attachments: [
        {
          filename: fileName,
          content: pdfBuffer.toString('base64'),
          type: 'application/pdf',
          disposition: 'attachment',
        },
      ],
    });

    return { success: true, id: response.headers['x-message-id'] };
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Failed to send report email';
    console.error('Report email send error:', message);
    return { success: false, error: message };
  }
}

export async function sendAdminSignupNotification(newUser: {
  email: string;
  name?: string;
  company?: string;
}) {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'ikildani@ambrosiaventures.co';
  const timestamp = new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 500px; margin: 0 auto; padding: 20px;">
        <div style="background: #0f172a; padding: 20px 24px; border-radius: 12px 12px 0 0;">
          <h2 style="color: #14b8a6; margin: 0; font-size: 18px;">New Signup on Solidus</h2>
        </div>
        <div style="background: #fff; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 13px; width: 80px;">Email</td>
              <td style="padding: 8px 0; font-weight: 600;">${newUser.email}</td>
            </tr>
            ${newUser.name ? `<tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Name</td>
              <td style="padding: 8px 0;">${newUser.name}</td>
            </tr>` : ''}
            ${newUser.company ? `<tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Company</td>
              <td style="padding: 8px 0;">${newUser.company}</td>
            </tr>` : ''}
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Time</td>
              <td style="padding: 8px 0;">${timestamp}</td>
            </tr>
          </table>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: adminEmail,
    subject: `New signup: ${newUser.name || newUser.email}${newUser.company ? ` (${newUser.company})` : ''}`,
    html,
  });
}

export async function sendAdminSubscriptionNotification(details: {
  email: string;
  name?: string;
  type: 'pro_subscription' | 'report_purchase' | 'trial_started';
  amount?: number;
  promoCode?: string;
}) {
  const adminEmail = process.env.ADMIN_NOTIFICATION_EMAIL || 'ikildani@ambrosiaventures.co';
  const timestamp = new Date().toLocaleString('en-US', {
    timeZone: 'America/New_York',
    dateStyle: 'medium',
    timeStyle: 'short',
  });

  const typeLabels: Record<string, { label: string; color: string }> = {
    pro_subscription: { label: 'New Pro Subscription', color: '#14b8a6' },
    report_purchase: { label: 'Deal Report Purchased', color: '#8b5cf6' },
    trial_started: { label: 'Trial Started (AMBROSIA)', color: '#f59e0b' },
  };

  const { label, color } = typeLabels[details.type] || typeLabels.pro_subscription;

  const html = `
    <!DOCTYPE html>
    <html>
      <head><meta charset="utf-8"></head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 500px; margin: 0 auto; padding: 20px;">
        <div style="background: #0f172a; padding: 20px 24px; border-radius: 12px 12px 0 0;">
          <h2 style="color: ${color}; margin: 0; font-size: 18px;">${label}</h2>
        </div>
        <div style="background: #fff; padding: 24px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 12px 12px;">
          <table style="width: 100%; border-collapse: collapse;">
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 13px; width: 80px;">Email</td>
              <td style="padding: 8px 0; font-weight: 600;">${details.email}</td>
            </tr>
            ${details.name ? `<tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Name</td>
              <td style="padding: 8px 0;">${details.name}</td>
            </tr>` : ''}
            ${details.amount ? `<tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Amount</td>
              <td style="padding: 8px 0; font-weight: 600; color: #16a34a;">$${(details.amount / 100).toFixed(2)}</td>
            </tr>` : ''}
            ${details.promoCode ? `<tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Promo</td>
              <td style="padding: 8px 0;">${details.promoCode}</td>
            </tr>` : ''}
            <tr>
              <td style="padding: 8px 0; color: #64748b; font-size: 13px;">Time</td>
              <td style="padding: 8px 0;">${timestamp}</td>
            </tr>
          </table>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to: adminEmail,
    subject: `${label}: ${details.name || details.email}`,
    html,
  });
}

export async function sendPortfolioInviteEmail(
  to: string,
  teamName: string,
  role: string,
  joinUrl: string,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const roleLabel = role.charAt(0).toUpperCase() + role.slice(1);

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 24px;">You're Invited</h1>
          <p style="color: #94a3b8; margin: 8px 0 0; font-size: 14px;">Join ${teamName} on Solidus</p>
        </div>

        <div style="background: #fff; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 16px 16px;">
          <p style="font-size: 16px;">You've been invited to join <strong>${teamName}</strong> on Solidus as a <strong>${roleLabel}</strong>.</p>

          <div style="background: #f8fafc; border-radius: 12px; padding: 20px; margin: 24px 0;">
            <div style="margin-bottom: 8px;">
              <span style="color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: 600;">Team</span>
              <p style="margin: 4px 0; font-weight: 600; font-size: 16px;">${teamName}</p>
            </div>
            <div>
              <span style="color: #64748b; font-size: 12px; text-transform: uppercase; font-weight: 600;">Your Role</span>
              <p style="margin: 4px 0; font-weight: 600; font-size: 16px;">${roleLabel}</p>
            </div>
          </div>

          <div style="text-align: center; margin: 32px 0;">
            <a href="${joinUrl}" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); color: #fff; padding: 14px 32px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px;">
              Accept Invite
            </a>
          </div>

          <p style="color: #94a3b8; font-size: 13px; text-align: center;">This invite expires in 7 days.</p>

          <p style="margin-top: 24px;">
            Best,<br>
            <strong>The Ambrosia Ventures Team</strong>
          </p>
        </div>

        <div style="text-align: center; padding: 24px; color: #64748b; font-size: 12px;">
          <p style="margin: 0;">
            Ambrosia Ventures | <a href="https://ambrosiaventures.co" style="color: #14b8a6;">ambrosiaventures.co</a>
          </p>
          <p style="margin: 8px 0 0;">
            <a href="https://solidus.ambrosiaventures.co/unsubscribe" style="color: #64748b;">Unsubscribe</a>
          </p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: `You've been invited to join ${teamName} on Solidus`,
    html,
  });
}

export async function sendDealAlertDigestEmail(
  to: string,
  alertName: string,
  deals: Array<{ parties: string; therapeuticArea: string; totalValue: string; phase?: string; date: string }>,
): Promise<{ success: boolean; id?: string; error?: string }> {
  const dealRows = deals.slice(0, 10).map(deal => `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #1e293b; color: #f1f5f9; font-weight: 600; font-size: 14px;">${deal.parties}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #1e293b; color: #94a3b8; font-size: 13px;">${deal.therapeuticArea}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #1e293b; color: #14b8a6; font-weight: 600; font-size: 14px;">${deal.totalValue}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #1e293b; color: #94a3b8; font-size: 13px;">${deal.phase || '-'}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #1e293b; color: #94a3b8; font-size: 13px;">${deal.date}</td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #e2e8f0; max-width: 700px; margin: 0 auto; padding: 20px; background-color: #0f172a;">
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 22px;">Deal Alert: ${alertName}</h1>
          <p style="color: #94a3b8; margin: 8px 0 0; font-size: 14px;">${deals.length} new deal${deals.length !== 1 ? 's' : ''} matched your criteria</p>
        </div>

        <div style="background: #1e293b; padding: 24px; border: 1px solid #334155; border-top: none; border-radius: 0 0 16px 16px;">
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr>
                <th style="padding: 8px 12px; text-align: left; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 600; border-bottom: 2px solid #334155;">Parties</th>
                <th style="padding: 8px 12px; text-align: left; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 600; border-bottom: 2px solid #334155;">TA</th>
                <th style="padding: 8px 12px; text-align: left; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 600; border-bottom: 2px solid #334155;">Value</th>
                <th style="padding: 8px 12px; text-align: left; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 600; border-bottom: 2px solid #334155;">Phase</th>
                <th style="padding: 8px 12px; text-align: left; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 600; border-bottom: 2px solid #334155;">Date</th>
              </tr>
            </thead>
            <tbody>
              ${dealRows}
            </tbody>
          </table>

          <div style="text-align: center; margin: 28px 0 12px;">
            <a href="https://solidus.ambrosiaventures.co/portfolio" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); color: #fff; padding: 12px 28px; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 14px;">
              View on Dashboard
            </a>
          </div>
        </div>

        <div style="text-align: center; padding: 20px; color: #64748b; font-size: 12px;">
          <p style="margin: 0;">Ambrosia Ventures Portfolio License</p>
          <p style="margin: 6px 0 0;">
            <a href="https://solidus.ambrosiaventures.co/portfolio/admin/alerts" style="color: #14b8a6;">Manage alert settings</a>
          </p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: `Deal Alert: ${alertName} — ${deals.length} new deal${deals.length !== 1 ? 's' : ''}`,
    html,
  });
}

export async function sendUpgradeConfirmation(to: string, name: string) {
  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 600px; margin: 0 auto; padding: 20px;">
        <div style="background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 24px;">Welcome to Pro!</h1>
        </div>

        <div style="background: #fff; padding: 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 16px 16px;">
          <p style="font-size: 16px;">Hi ${name},</p>

          <p>Thank you for upgrading to Ambrosia Ventures Pro! You now have access to:</p>

          <ul style="padding-left: 20px;">
            <li><strong>Full deal analysis</strong> with detailed breakdowns</li>
            <li><strong>PDF & Excel exports</strong> for your presentations</li>
            <li><strong>Save & compare scenarios</strong> side-by-side</li>
            <li><strong>Share calculations</strong> with your team</li>
            <li><strong>Interactive charts</strong> and visualizations</li>
            <li><strong>Complete deal database</strong> access (${DEAL_STATS.TOTAL_DEALS} deals)</li>
            <li><strong>Partner matching</strong> with detailed company profiles</li>
          </ul>

          <div style="text-align: center; margin: 32px 0;">
            <a href="https://solidus.ambrosiaventures.co" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); color: #fff; padding: 14px 32px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px;">
              Start Using Pro Features
            </a>
          </div>

          <p>Questions? Reply to this email and we'll help you get the most out of your Pro subscription.</p>

          <p style="margin-top: 24px;">
            Best,<br>
            <strong>The Ambrosia Ventures Team</strong>
          </p>
        </div>

        <div style="text-align: center; padding: 24px; color: #64748b; font-size: 12px;">
          <p style="margin: 0;">Ambrosia Ventures | Pro Subscription</p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: 'Welcome to Ambrosia Ventures Pro!',
    html,
  });
}

export async function sendPortfolioActivityDigest(
  to: string,
  teamName: string,
  digest: {
    period: string;
    activeSeats: number;
    maxSeats: number;
    calculationsRun: number;
    reportsGenerated: number;
    alertsFired: number;
    analystHoursUsed: number;
    analystHoursAllocated: number;
    topCompanies: Array<{ name: string; calculations: number }>;
  },
): Promise<{ success: boolean; id?: string; error?: string }> {
  const companyRows = digest.topCompanies.slice(0, 5).map((company, i) => `
    <tr>
      <td style="padding: 10px 12px; border-bottom: 1px solid #1e293b; color: #f1f5f9; font-weight: 600; font-size: 14px;">${i + 1}. ${company.name}</td>
      <td style="padding: 10px 12px; border-bottom: 1px solid #1e293b; color: #14b8a6; font-weight: 600; font-size: 14px; text-align: right;">${company.calculations}</td>
    </tr>
  `).join('');

  const html = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #e2e8f0; max-width: 700px; margin: 0 auto; padding: 20px; background-color: #0f172a;">
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
          <h1 style="color: #fff; margin: 0; font-size: 22px;">${teamName} Weekly Portfolio Activity</h1>
          <p style="color: #94a3b8; margin: 8px 0 0; font-size: 14px;">${digest.period}</p>
        </div>

        <div style="background: #1e293b; padding: 24px; border: 1px solid #334155; border-top: none;">
          <table style="width: 100%; border-collapse: collapse;">
            <tbody>
              <tr>
                <td style="padding: 16px; text-align: center; width: 33%; border-bottom: 1px solid #334155; border-right: 1px solid #334155;">
                  <div style="color: #64748b; font-size: 10px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Active Seats</div>
                  <div style="color: #f1f5f9; font-size: 24px; font-weight: 700; margin-top: 4px;">${digest.activeSeats}<span style="color: #64748b; font-size: 14px; font-weight: 400;">/${digest.maxSeats}</span></div>
                </td>
                <td style="padding: 16px; text-align: center; width: 33%; border-bottom: 1px solid #334155; border-right: 1px solid #334155;">
                  <div style="color: #64748b; font-size: 10px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Calculations Run</div>
                  <div style="color: #f1f5f9; font-size: 24px; font-weight: 700; margin-top: 4px;">${digest.calculationsRun}</div>
                </td>
                <td style="padding: 16px; text-align: center; width: 34%; border-bottom: 1px solid #334155;">
                  <div style="color: #64748b; font-size: 10px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Reports Generated</div>
                  <div style="color: #f1f5f9; font-size: 24px; font-weight: 700; margin-top: 4px;">${digest.reportsGenerated}</div>
                </td>
              </tr>
              <tr>
                <td style="padding: 16px; text-align: center; width: 33%; border-right: 1px solid #334155;">
                  <div style="color: #64748b; font-size: 10px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Alerts Fired</div>
                  <div style="color: #f1f5f9; font-size: 24px; font-weight: 700; margin-top: 4px;">${digest.alertsFired}</div>
                </td>
                <td style="padding: 16px; text-align: center; width: 33%; border-right: 1px solid #334155;">
                  <div style="color: #64748b; font-size: 10px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Analyst Hours</div>
                  <div style="color: #f1f5f9; font-size: 24px; font-weight: 700; margin-top: 4px;">${digest.analystHoursUsed}<span style="color: #64748b; font-size: 14px; font-weight: 400;">/${digest.analystHoursAllocated}</span></div>
                </td>
                <td style="padding: 16px; text-align: center; width: 34%;">
                  <div style="color: #64748b; font-size: 10px; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em;">Utilization</div>
                  <div style="color: #14b8a6; font-size: 24px; font-weight: 700; margin-top: 4px;">${digest.analystHoursAllocated > 0 ? Math.round((digest.analystHoursUsed / digest.analystHoursAllocated) * 100) : 0}%</div>
                </td>
              </tr>
            </tbody>
          </table>
        </div>

        ${digest.topCompanies.length > 0 ? `
        <div style="background: #1e293b; padding: 24px; border: 1px solid #334155; border-top: none;">
          <h2 style="color: #f1f5f9; font-size: 14px; margin: 0 0 16px; text-transform: uppercase; letter-spacing: 0.05em;">Top 5 Most Active Companies</h2>
          <table style="width: 100%; border-collapse: collapse;">
            <thead>
              <tr>
                <th style="padding: 8px 12px; text-align: left; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 600; border-bottom: 2px solid #334155;">Company</th>
                <th style="padding: 8px 12px; text-align: right; color: #64748b; font-size: 11px; text-transform: uppercase; font-weight: 600; border-bottom: 2px solid #334155;">Calculations</th>
              </tr>
            </thead>
            <tbody>
              ${companyRows}
            </tbody>
          </table>
        </div>
        ` : ''}

        <div style="background: #1e293b; padding: 24px; border: 1px solid #334155; border-top: none; border-radius: 0 0 16px 16px; text-align: center;">
          <a href="https://solidus.ambrosiaventures.co/portfolio/admin" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); color: #fff; padding: 12px 28px; text-decoration: none; border-radius: 10px; font-weight: 600; font-size: 14px;">
            View Dashboard
          </a>
        </div>

        <div style="text-align: center; padding: 20px; color: #64748b; font-size: 12px;">
          <p style="margin: 0;">Ambrosia Ventures Portfolio License</p>
          <p style="margin: 6px 0 0;">
            <a href="https://solidus.ambrosiaventures.co/portfolio/admin/settings" style="color: #14b8a6;">Unsubscribe from weekly digests</a>
          </p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: `${teamName} Weekly Activity — ${digest.period}`,
    html,
  });
}
