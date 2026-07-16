interface PlatformUpdate {
  id: string;
  title: string;
  body: string;
  category: string;
  cta_url?: string | null;
  cta_label?: string | null;
  created_at: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function truncateAtWord(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  const truncated = text.slice(0, maxLen);
  const lastSpace = truncated.lastIndexOf(' ');
  return (lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated) + '...';
}

const categoryStyles: Record<string, { bg: string; fg: string; label: string }> = {
  feature: { bg: '#f0fdfa', fg: '#0d9488', label: 'New Feature' },
  improvement: { bg: '#eff6ff', fg: '#3b82f6', label: 'Improvement' },
  data: { bg: '#f5f3ff', fg: '#7c3aed', label: 'Data Update' },
  fix: { bg: '#fffbeb', fg: '#d97706', label: 'Bug Fix' },
  announcement: { bg: '#f0fdf4', fg: '#16a34a', label: 'Announcement' },
};

function categoryBadge(category: string): string {
  const style = categoryStyles[category] || { bg: '#f1f5f9', fg: '#64748b', label: category };
  return `<span style="display: inline-block; background: ${style.bg}; color: ${style.fg}; font-size: 10px; font-weight: 700; padding: 3px 10px; border-radius: 20px; letter-spacing: 0.5px; text-transform: uppercase;">${escapeHtml(style.label)}</span>`;
}

export function buildPlatformUpdatesHtml(
  updates: PlatformUpdate[],
  userName: string,
  unsubscribeUrl: string
): string {
  const updateCards = updates
    .map(
      (update) => `
      <div style="padding: 24px 32px; border-bottom: 1px solid #f1f5f9;">
        <div style="margin-bottom: 10px;">
          ${categoryBadge(update.category)}
        </div>
        <h3 style="font-size: 17px; font-weight: 700; color: #0f172a; margin: 0 0 8px;">${escapeHtml(update.title)}</h3>
        <p style="font-size: 14px; color: #475569; line-height: 1.6; margin: 0;">${escapeHtml(truncateAtWord(update.body, 300))}</p>
        ${update.cta_url ? `
        <div style="margin-top: 14px;">
          <a href="${escapeHtml(update.cta_url)}" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); color: #ffffff; text-decoration: none; padding: 8px 20px; border-radius: 8px; font-size: 13px; font-weight: 600;">${escapeHtml(update.cta_label || 'Learn More')}</a>
        </div>
        ` : ''}
      </div>`
    )
    .join('');

  const dateFormatted = new Date().toLocaleDateString('en-US', {
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Platform Updates</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 660px; margin: 0 auto; padding: 0; background: #f1f5f9;">

        <!-- Preheader -->
        <div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #f1f5f9;">
          ${updates.length} new update${updates.length !== 1 ? 's' : ''} to the Deal Calculator platform
        </div>

        <!-- Outer Wrapper -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #f1f5f9;">
          <tr>
            <td align="center" style="padding: 24px 16px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 660px;">

                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%); padding: 40px 32px 36px; border-radius: 16px 16px 0 0; text-align: center;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center">
                          <img src="https://calculator.ambrosiaventures.co/logo-white.png" alt="Ambrosia Ventures" width="160" style="display: block; margin: 0 auto 16px; width: 160px; height: auto;" />
                          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">Platform Updates</h1>
                          <div style="width: 40px; height: 3px; background: linear-gradient(90deg, #14b8a6, #06b6d4); margin: 16px auto; border-radius: 2px;"></div>
                          <p style="color: #94a3b8; margin: 0; font-size: 14px; font-weight: 400;">${dateFormatted}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="background: #ffffff; padding: 0; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">

                    <!-- Greeting -->
                    <div style="padding: 32px 32px 0;">
                      <p style="font-size: 16px; margin: 0; color: #334155;">Hi ${escapeHtml(userName)},</p>
                      <p style="font-size: 14px; margin: 8px 0 0; color: #64748b;">Here's what's new on the Deal Calculator.</p>
                    </div>

                    <!-- Update Cards -->
                    ${updateCards}

                    <!-- CTA -->
                    <div style="padding: 24px 32px 32px; text-align: center;">
                      <a href="https://calculator.ambrosiaventures.co" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); color: #ffffff; text-decoration: none; padding: 14px 32px; border-radius: 10px; font-size: 15px; font-weight: 700; letter-spacing: -0.2px;">Explore the Platform</a>
                    </div>

                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background: #0f172a; padding: 32px; border-radius: 0 0 16px 16px; text-align: center;">
                    <img src="https://calculator.ambrosiaventures.co/logo-white.png" alt="Ambrosia Ventures" width="120" style="display: block; margin: 0 auto 16px; width: 120px; height: auto; opacity: 0.7;" />
                    <div style="margin-bottom: 16px;">
                      <a href="https://ambrosiaventures.co" style="color: #94a3b8; text-decoration: none; font-size: 12px; margin: 0 8px;">ambrosiaventures.co</a>
                      <span style="color: #475569;">&middot;</span>
                      <a href="https://calculator.ambrosiaventures.co" style="color: #94a3b8; text-decoration: none; font-size: 12px; margin: 0 8px;">Deal Calculator</a>
                    </div>
                    <a href="${escapeHtml(unsubscribeUrl)}" style="color: #64748b; text-decoration: underline; font-size: 11px;">Unsubscribe from platform updates</a>
                  </td>
                </tr>

              </table>
            </td>
          </tr>
        </table>
      </body>
    </html>
  `;
}
