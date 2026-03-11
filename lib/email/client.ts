import { Resend } from 'resend';

// Lazy initialization to avoid build errors when RESEND_API_KEY is not set
let resendClient: Resend | null = null;

function getResendClient(): Resend | null {
  if (!process.env.RESEND_API_KEY) {
    return null;
  }
  if (!resendClient) {
    resendClient = new Resend(process.env.RESEND_API_KEY);
  }
  return resendClient;
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

  const resend = getResendClient();
  if (!resend) {
    console.log('Resend API key not configured, skipping email');
    return { success: false, error: 'Email not configured' };
  }

  try {
    const { data, error } = await resend.emails.send({
      from: from || (process.env.RESEND_FROM_EMAIL || 'Ambrosia Ventures <onboarding@resend.dev>'),
      to: [to],
      subject,
      html,
      replyTo: replyTo || 'hello@ambrosiaventures.co',
    });

    if (error) {
      console.error('Error sending email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (error) {
    console.error('Email send error:', error);
    return { success: false, error: 'Failed to send email' };
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

          <p>Thank you for signing up for the Ambrosia Ventures Deal Calculator!</p>

          <p>You now have access to our industry-leading biotech deal benchmarking tool. Here's what you can do:</p>

          <ul style="padding-left: 20px;">
            <li><strong>Benchmark deals</strong> across 17+ modalities</li>
            <li><strong>Get instant estimates</strong> for upfront payments, milestones, and royalties</li>
            <li><strong>Match with partners</strong> actively acquiring in your therapeutic area</li>
          </ul>

          <div style="text-align: center; margin: 32px 0;">
            <a href="https://calculator.ambrosiaventures.co" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); color: #fff; padding: 14px 32px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px;">
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
            <a href="https://calculator.ambrosiaventures.co/unsubscribe" style="color: #64748b;">Unsubscribe</a>
          </p>
        </div>
      </body>
    </html>
  `;

  return sendEmail({
    to,
    subject: 'Welcome to Ambrosia Ventures Deal Calculator',
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
            <a href="https://calculator.ambrosiaventures.co" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 10px; font-weight: 600;">
              View Full Analysis
            </a>
          </div>

          <p style="color: #64748b; font-size: 14px;">
            This is an automated receipt of your calculation. You can disable these emails in your account settings.
          </p>
        </div>

        <div style="text-align: center; padding: 24px; color: #64748b; font-size: 12px;">
          <p style="margin: 0;">Ambrosia Ventures Deal Calculator</p>
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
  const resend = getResendClient();
  if (!resend) {
    console.log('Resend API key not configured, skipping email');
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
            This report includes deal benchmarking, sensitivity analysis, comparable deals, partner matching, and AI-generated strategic insights.
          </p>

          <div style="text-align: center; margin: 24px 0;">
            <a href="https://calculator.ambrosiaventures.co" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); color: #fff; padding: 12px 24px; text-decoration: none; border-radius: 10px; font-weight: 600;">
              Run Another Analysis
            </a>
          </div>
        </div>

        <div style="text-align: center; padding: 24px; color: #64748b; font-size: 12px;">
          <p style="margin: 0;">Ambrosia Ventures Deal Calculator</p>
        </div>
      </body>
    </html>
  `;

  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL || 'Ambrosia Ventures <onboarding@resend.dev>',
      to: [to],
      subject: `Your Ambrosia Deal Report: ${indication}`,
      html,
      replyTo: 'hello@ambrosiaventures.co',
      attachments: [
        {
          filename: fileName,
          content: pdfBuffer,
        },
      ],
    });

    if (error) {
      console.error('Error sending report email:', error);
      return { success: false, error: error.message };
    }

    return { success: true, id: data?.id };
  } catch (error) {
    console.error('Report email send error:', error);
    return { success: false, error: 'Failed to send report email' };
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
          <h2 style="color: #14b8a6; margin: 0; font-size: 18px;">New Signup on Deal Calculator</h2>
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
            <li><strong>Complete deal database</strong> access (600+ deals)</li>
            <li><strong>Partner matching</strong> with detailed company profiles</li>
          </ul>

          <div style="text-align: center; margin: 32px 0;">
            <a href="https://calculator.ambrosiaventures.co" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); color: #fff; padding: 14px 32px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px;">
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
