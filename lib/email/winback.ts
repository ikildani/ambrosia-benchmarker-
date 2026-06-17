const BASE_URL = 'https://calculator.ambrosiaventures.co';

export function buildSubscriptionWinbackEmail(name: string): { subject: string; html: string } {
  const firstName = name?.split(' ')[0] || 'there';

  return {
    subject: 'We\'re sorry to see you go',
    html: `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; background-color: #0b1120; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;">
  <div style="max-width: 600px; margin: 0 auto; padding: 24px;">
    <div style="text-align: center; padding: 32px 24px; background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); border-radius: 16px 16px 0 0; border: 1px solid #1e3a5f; border-bottom: none;">
      <img src="${BASE_URL}/icon-color.png" alt="Ambrosia Ventures" width="48" height="48" style="margin-bottom: 16px;">
      <h1 style="color: #ffffff; margin: 0; font-size: 22px; font-weight: 700;">Ambrosia Ventures</h1>
      <p style="color: #64748b; margin: 4px 0 0; font-size: 13px;">Deal Intelligence Platform</p>
    </div>

    <div style="background: #111827; padding: 32px; border: 1px solid #1e3a5f; border-top: none; border-radius: 0 0 16px 16px;">
      <p style="color: #e2e8f0; font-size: 16px; margin: 0 0 16px;">Hi ${firstName},</p>

      <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        Your Pro subscription has been cancelled. We understand — if the timing wasn't right or something didn't meet your expectations, we'd genuinely like to know.
      </p>

      <p style="color: #94a3b8; font-size: 15px; line-height: 1.7; margin: 0 0 16px;">
        Quick question: what could we have done better? Just reply to this email — Issa reads every response.
      </p>

      <div style="background: #0f172a; border: 1px solid #14b8a620; border-radius: 12px; padding: 24px; margin: 24px 0; text-align: center;">
        <p style="color: #14b8a6; font-size: 14px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px; margin: 0 0 8px;">Welcome back offer</p>
        <p style="color: #e2e8f0; font-size: 24px; font-weight: 800; margin: 0 0 8px;">50% off for 3 months</p>
        <p style="color: #94a3b8; font-size: 14px; margin: 0 0 16px;">
          That's Pro at $149.50/month — full access to all 14 engines, unlimited calculations, and 850+ company profiles.
        </p>
        <a href="${BASE_URL}/calculator?upgrade=true&promo=COMEBACK50" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); color: #ffffff; padding: 14px 36px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 15px;">
          Reactivate at 50% Off
        </a>
      </div>

      <p style="color: #64748b; font-size: 13px; margin: 16px 0 0;">
        Your saved calculations and shared links are preserved. You can reactivate anytime.
      </p>

      <p style="color: #94a3b8; font-size: 15px; margin: 20px 0 0;">
        Best,<br>
        <strong style="color: #e2e8f0;">Issa</strong><br>
        <span style="color: #64748b; font-size: 13px;">Ambrosia Ventures</span>
      </p>
    </div>

    <div style="text-align: center; padding: 24px; color: #475569; font-size: 12px; line-height: 1.5;">
      <p style="margin: 0;">Ambrosia Ventures | <a href="https://ambrosiaventures.co" style="color: #14b8a6; text-decoration: none;">ambrosiaventures.co</a></p>
      <p style="margin: 8px 0 0;"><a href="${BASE_URL}/unsubscribe" style="color: #475569; text-decoration: underline;">Unsubscribe</a></p>
    </div>
  </div>
</body>
</html>`,
  };
}
