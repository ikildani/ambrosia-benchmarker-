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

const categoryConfig: Record<string, { bg: string; fg: string; border: string; label: string; icon: string }> = {
  feature:      { bg: '#f0fdfa', fg: '#0d9488', border: '#99f6e4', label: 'New',         icon: '&#9733;' },
  improvement:  { bg: '#eff6ff', fg: '#2563eb', border: '#bfdbfe', label: 'Improved',    icon: '&#9650;' },
  data:         { bg: '#f5f3ff', fg: '#7c3aed', border: '#ddd6fe', label: 'Data',        icon: '&#9679;' },
  fix:          { bg: '#fffbeb', fg: '#d97706', border: '#fde68a', label: 'Resolved',    icon: '&#10003;' },
  announcement: { bg: '#f0fdf4', fg: '#16a34a', border: '#bbf7d0', label: 'Announcement', icon: '&#9670;' },
};

function categoryBadge(category: string): string {
  const c = categoryConfig[category] || { bg: '#f1f5f9', fg: '#64748b', border: '#e2e8f0', label: category, icon: '' };
  return `<span style="display: inline-block; background: ${c.bg}; color: ${c.fg}; border: 1px solid ${c.border}; font-size: 10px; font-weight: 700; padding: 3px 10px; border-radius: 20px; letter-spacing: 0.6px; text-transform: uppercase;">${c.icon}&nbsp; ${escapeHtml(c.label)}</span>`;
}

export function buildPlatformUpdatesHtml(
  updates: PlatformUpdate[],
  userName: string,
  unsubscribeUrl: string
): string {
  const featureCount = updates.filter(u => u.category === 'feature').length;
  const improvementCount = updates.filter(u => u.category === 'improvement' || u.category === 'fix').length;
  const dataCount = updates.filter(u => u.category === 'data' || u.category === 'announcement').length;

  const highlightStats = [
    featureCount > 0 ? { value: String(featureCount), label: featureCount === 1 ? 'New Feature' : 'New Features' } : null,
    improvementCount > 0 ? { value: String(improvementCount), label: improvementCount === 1 ? 'Improvement' : 'Improvements' } : null,
    dataCount > 0 ? { value: String(dataCount), label: dataCount === 1 ? 'Update' : 'Updates' } : null,
  ].filter(Boolean) as { value: string; label: string }[];

  const highlightCells = highlightStats.map((stat, i) => `
    <td width="${Math.floor(100 / highlightStats.length)}%" style="padding: 0 ${i > 0 ? '0 0 8px' : '0'};">
      <div style="text-align: center; padding: 16px 8px;">
        <div style="font-size: 28px; font-weight: 800; color: #ffffff; line-height: 1;">${stat.value}</div>
        <div style="font-size: 10px; color: #94a3b8; text-transform: uppercase; letter-spacing: 0.8px; margin-top: 6px; font-weight: 600;">${stat.label}</div>
      </div>
    </td>
  `).join('');

  const updateCards = updates
    .map(
      (update, idx) => `
      <div style="padding: 28px 32px;${idx < updates.length - 1 ? ' border-bottom: 1px solid #f1f5f9;' : ''}">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="36" valign="top" style="padding-right: 16px; padding-top: 2px;">
              <div style="width: 32px; height: 32px; border-radius: 8px; background: ${(categoryConfig[update.category] || categoryConfig.feature).bg}; border: 1px solid ${(categoryConfig[update.category] || categoryConfig.feature).border}; text-align: center; line-height: 32px; font-size: 14px; color: ${(categoryConfig[update.category] || categoryConfig.feature).fg};">
                ${(categoryConfig[update.category] || categoryConfig.feature).icon}
              </div>
            </td>
            <td valign="top">
              <div style="margin-bottom: 8px;">
                ${categoryBadge(update.category)}
              </div>
              <h3 style="font-size: 17px; font-weight: 700; color: #0f172a; margin: 0 0 8px; line-height: 1.3;">${escapeHtml(update.title)}</h3>
              <p style="font-size: 14px; color: #475569; line-height: 1.7; margin: 0;">${escapeHtml(truncateAtWord(update.body, 350))}</p>
              ${update.cta_url ? `
              <div style="margin-top: 16px;">
                <a href="${escapeHtml(update.cta_url)}" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); color: #ffffff; text-decoration: none; padding: 10px 24px; border-radius: 8px; font-size: 13px; font-weight: 700; letter-spacing: -0.1px;">${escapeHtml(update.cta_label || 'Learn More')} &rarr;</a>
              </div>
              ` : ''}
            </td>
          </tr>
        </table>
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
        <title>Platform Updates — Solidus</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 660px; margin: 0 auto; padding: 0; background: #f1f5f9;">

        <!-- Preheader -->
        <div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #f1f5f9;">
          ${updates.length} platform update${updates.length !== 1 ? 's' : ''}: ${updates.slice(0, 3).map(u => u.title).join(', ')}
        </div>

        <!-- Outer Wrapper -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background: #f1f5f9;">
          <tr>
            <td align="center" style="padding: 24px 16px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width: 660px;">

                <!-- Header -->
                <tr>
                  <td style="background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 50%, #0f172a 100%); padding: 40px 32px 20px; border-radius: 16px 16px 0 0; text-align: center;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center">
                          <img src="https://solidus.ambrosiaventures.co/logo-white.png" alt="Ambrosia Ventures" width="160" style="display: block; margin: 0 auto 16px; width: 160px; height: auto;" />
                          <h1 style="color: #ffffff; margin: 0; font-size: 26px; font-weight: 800; letter-spacing: -0.5px;">What's New</h1>
                          <div style="width: 40px; height: 3px; background: linear-gradient(90deg, #14b8a6, #06b6d4); margin: 14px auto; border-radius: 2px;"></div>
                          <p style="color: #94a3b8; margin: 0; font-size: 13px; font-weight: 400;">Solidus &middot; ${dateFormatted}</p>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Highlight Stats Strip -->
                <tr>
                  <td style="background: linear-gradient(135deg, #0f172a 0%, #1a2744 100%); padding: 0 32px 24px; text-align: center;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid rgba(148, 163, 184, 0.15); border-radius: 12px; overflow: hidden; background: rgba(255,255,255,0.04);">
                      <tr>
                        ${highlightCells}
                      </tr>
                    </table>
                  </td>
                </tr>

                <!-- Body -->
                <tr>
                  <td style="background: #ffffff; padding: 0; border-left: 1px solid #e2e8f0; border-right: 1px solid #e2e8f0;">

                    <!-- Greeting -->
                    <div style="padding: 32px 32px 4px;">
                      <p style="font-size: 15px; margin: 0; color: #334155;">Hi ${escapeHtml(userName)},</p>
                      <p style="font-size: 14px; margin: 8px 0 0; color: #64748b;">Here's what we've shipped recently to make your deal analysis sharper.</p>
                    </div>

                    <!-- Update Cards -->
                    ${updateCards}

                    <!-- Bottom CTA -->
                    <div style="padding: 28px 32px 36px; text-align: center;">
                      <a href="https://solidus.ambrosiaventures.co" style="display: inline-block; background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); color: #ffffff; text-decoration: none; padding: 14px 36px; border-radius: 10px; font-size: 14px; font-weight: 700; letter-spacing: -0.2px;">Open Solidus &rarr;</a>
                      <p style="font-size: 12px; color: #94a3b8; margin: 12px 0 0;">Questions or feedback? Reply directly to this email.</p>
                    </div>

                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background: #0f172a; padding: 28px 32px; border-radius: 0 0 16px 16px; text-align: center;">
                    <img src="https://solidus.ambrosiaventures.co/logo-white.png" alt="Ambrosia Ventures" width="110" style="display: block; margin: 0 auto 14px; width: 110px; height: auto; opacity: 0.6;" />
                    <div style="margin-bottom: 14px;">
                      <a href="https://ambrosiaventures.co" style="color: #64748b; text-decoration: none; font-size: 11px; margin: 0 8px;">ambrosiaventures.co</a>
                      <span style="color: #334155;">&middot;</span>
                      <a href="https://solidus.ambrosiaventures.co" style="color: #64748b; text-decoration: none; font-size: 11px; margin: 0 8px;">Solidus</a>
                    </div>
                    <p style="color: #475569; font-size: 10px; margin: 0 0 8px;">Ambrosia Ventures &middot; Biopharma Deal Intelligence</p>
                    <a href="${escapeHtml(unsubscribeUrl)}" style="color: #475569; text-decoration: underline; font-size: 10px;">Unsubscribe from platform updates</a>
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
