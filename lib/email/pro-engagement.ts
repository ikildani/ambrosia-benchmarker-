/**
 * R72: Pro engagement email templates — confirmation + expiration warning.
 * Sent from info@ambrosiaventures.co via SendGrid.
 */

import { sendEmail } from './client';

const BRAND_COLOR = '#0d9488';
const BG_COLOR = '#0a0d1b';
const CARD_BG = '#0d1420';
const TEXT_PRIMARY = '#f4f1e8';
const TEXT_SECONDARY = '#94a3b8';

function emailWrapper(content: string): string {
  return `
    <!DOCTYPE html>
    <html>
      <head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"></head>
      <body style="margin:0; padding:0; background-color:${BG_COLOR}; font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;">
        <div style="max-width:600px; margin:0 auto; padding:40px 24px;">
          <div style="margin-bottom:32px;">
            <span style="font-size:18px; font-weight:700; color:${TEXT_PRIMARY}; letter-spacing:0.02em;">Ambrosia</span>
            <span style="font-size:14px; color:${TEXT_SECONDARY}; margin-left:8px;">Ventures</span>
          </div>
          ${content}
          <div style="margin-top:40px; padding-top:24px; border-top:1px solid rgba(244,241,232,0.08);">
            <p style="font-size:12px; color:#475569; margin:0;">Ambrosia Ventures · calculator.ambrosiaventures.co</p>
            <p style="font-size:12px; color:#475569; margin:4px 0 0;">Detroit & New York</p>
          </div>
        </div>
      </body>
    </html>
  `;
}

/**
 * Confirmation email sent when a Pro engagement invoice is paid.
 */
export async function sendProEngagementConfirmation(opts: {
  to: string;
  name: string;
  expiresAt: Date;
  months: number;
}) {
  const expiresFormatted = opts.expiresAt.toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  const html = emailWrapper(`
    <div style="background:${CARD_BG}; border:1px solid rgba(244,241,232,0.08); border-radius:12px; padding:32px; margin-bottom:24px;">
      <div style="display:inline-block; padding:4px 12px; background:rgba(13,148,136,0.15); border:1px solid rgba(13,148,136,0.25); border-radius:20px; margin-bottom:20px;">
        <span style="font-size:12px; font-weight:600; color:${BRAND_COLOR}; text-transform:uppercase; letter-spacing:0.1em;">Pro Access Active</span>
      </div>
      <h1 style="font-size:28px; font-weight:700; color:${TEXT_PRIMARY}; margin:0 0 12px; line-height:1.2;">
        Your Pro access is live${opts.name ? `, ${opts.name}` : ''}.
      </h1>
      <p style="font-size:16px; color:${TEXT_SECONDARY}; margin:0 0 24px; line-height:1.6;">
        Full access to all 14 engines, unlimited calculations, PDF & Excel exports, partner intelligence, and Market Pulse — active through <strong style="color:${TEXT_PRIMARY};">${expiresFormatted}</strong>.
      </p>
      <a href="https://calculator.ambrosiaventures.co/calculator" style="display:inline-block; padding:14px 28px; background:${BRAND_COLOR}; color:white; font-size:15px; font-weight:600; border-radius:10px; text-decoration:none;">
        Open the platform →
      </a>
    </div>

    <div style="background:${CARD_BG}; border:1px solid rgba(244,241,232,0.06); border-radius:12px; padding:24px;">
      <h3 style="font-size:14px; font-weight:600; color:${TEXT_PRIMARY}; margin:0 0 16px; text-transform:uppercase; letter-spacing:0.08em;">What's included</h3>
      <table style="width:100%; border-collapse:collapse;">
        ${[
          ['Deal Terms + rNPV', 'Comparable-transaction anchored valuation'],
          ['Monte Carlo', 'P5–P95 probabilistic distribution'],
          ['Scenario Planner', '22-scenario bear/base/bull stress test'],
          ['Buyer-Specific Valuation', 'Strategic premium by named counterparty'],
          ['Partner Intelligence', '1,300+ profiled pharma companies'],
          ['PDF & Excel Reports', '20-page committee-ready exports'],
        ].map(([feature, desc]) => `
          <tr>
            <td style="padding:8px 0; border-bottom:1px solid rgba(244,241,232,0.04);">
              <span style="font-size:14px; font-weight:600; color:${TEXT_PRIMARY};">${feature}</span>
            </td>
            <td style="padding:8px 0; border-bottom:1px solid rgba(244,241,232,0.04); text-align:right;">
              <span style="font-size:13px; color:${TEXT_SECONDARY};">${desc}</span>
            </td>
          </tr>
        `).join('')}
      </table>
    </div>

    <p style="font-size:14px; color:${TEXT_SECONDARY}; margin:24px 0 0; line-height:1.6;">
      Questions about the platform or methodology? Reply to this email — it goes directly to Issa.
    </p>
  `);

  return sendEmail({
    to: opts.to,
    subject: `Your Pro access is live — active through ${expiresFormatted}`,
    html,
    replyTo: 'ikildani@ambrosiaventures.co',
  });
}

/**
 * Warning email sent 7 days before Pro engagement expires.
 */
export async function sendProExpirationWarning(opts: {
  to: string;
  name: string;
  expiresAt: Date;
}) {
  const expiresFormatted = opts.expiresAt.toLocaleDateString('en-US', {
    month: 'long', day: 'numeric', year: 'numeric',
  });

  const html = emailWrapper(`
    <div style="background:${CARD_BG}; border:1px solid rgba(251,146,60,0.2); border-radius:12px; padding:32px;">
      <h1 style="font-size:24px; font-weight:700; color:${TEXT_PRIMARY}; margin:0 0 12px; line-height:1.2;">
        Your Pro access expires ${expiresFormatted}.
      </h1>
      <p style="font-size:15px; color:${TEXT_SECONDARY}; margin:0 0 24px; line-height:1.6;">
        ${opts.name ? `${opts.name}, your` : 'Your'} ${opts.name ? '' : ''} Pro engagement ends in 7 days. After ${expiresFormatted}, your account will revert to the free tier — calculations, partner intelligence, and exports will be limited.
      </p>
      <p style="font-size:15px; color:${TEXT_SECONDARY}; margin:0 0 24px; line-height:1.6;">
        To continue with Pro access, reply to this email with the engagement you'd like — monthly, annual, or another custom term.
      </p>
      <a href="https://calculator.ambrosiaventures.co/pro" style="display:inline-block; padding:14px 28px; background:${BRAND_COLOR}; color:white; font-size:15px; font-weight:600; border-radius:10px; text-decoration:none;">
        View Pro plans →
      </a>
    </div>
  `);

  return sendEmail({
    to: opts.to,
    subject: `Your Pro access expires ${expiresFormatted}`,
    html,
    replyTo: 'ikildani@ambrosiaventures.co',
  });
}
