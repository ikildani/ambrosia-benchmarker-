import { WeeklySnapshot } from './weekly-snapshot';

interface WatchlistItem {
  item_type: string;
  item_value: string;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatUsd(amount: number | null): string {
  if (amount == null) return 'N/A';
  if (amount >= 1e9) return `$${(amount / 1e9).toFixed(1)}B`;
  if (amount >= 1e6) return `$${(amount / 1e6).toFixed(0)}M`;
  if (amount >= 1e3) return `$${(amount / 1e3).toFixed(0)}K`;
  return `$${amount.toFixed(0)}`;
}

function formatPhase(phase: string): string {
  const map: Record<string, string> = {
    discovery: 'Discovery',
    preclinical: 'Preclinical',
    phase_1: 'Phase 1',
    phase_2: 'Phase 2',
    phase_3: 'Phase 3',
    approved: 'Approved',
    unknown: 'Unknown',
  };
  return map[phase] || phase;
}

function formatModality(modality: string): string {
  return modality
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}

function changeBadge(pct: number): string {
  const arrow = pct >= 0 ? '&#9650;' : '&#9660;';
  const color = pct >= 0 ? '#16a34a' : '#dc2626';
  const bg = pct >= 0 ? '#f0fdf4' : '#fef2f2';
  return `<span style="display: inline-block; background: ${bg}; color: ${color}; font-weight: 700; font-size: 12px; padding: 2px 8px; border-radius: 4px;">${arrow}&nbsp;${Math.abs(pct).toFixed(1)}%</span>`;
}

function phaseBadge(phase: string): string {
  const phaseColors: Record<string, { bg: string; fg: string }> = {
    discovery: { bg: '#f5f3ff', fg: '#7c3aed' },
    preclinical: { bg: '#fdf4ff', fg: '#a855f7' },
    phase_1: { bg: '#eff6ff', fg: '#3b82f6' },
    phase_2: { bg: '#ecfdf5', fg: '#059669' },
    phase_3: { bg: '#f0fdfa', fg: '#0d9488' },
    approved: { bg: '#f0fdf4', fg: '#16a34a' },
  };
  const colors = phaseColors[phase] || { bg: '#f1f5f9', fg: '#64748b' };
  return `<span style="display: inline-block; background: ${colors.bg}; color: ${colors.fg}; font-size: 11px; font-weight: 700; padding: 3px 10px; border-radius: 20px; letter-spacing: 0.3px;">${formatPhase(phase)}</span>`;
}

export function buildWeeklyDigestHtml(
  snapshot: WeeklySnapshot,
  watchlistItems: WatchlistItem[],
  userName: string
): string {
  // Top 5 notable deals
  const dealRows = (snapshot.notable_deals || [])
    .map(
      (deal) => `
      <tr>
        <td style="padding: 14px 16px; border-bottom: 1px solid #f1f5f9;">
          <div style="font-weight: 700; color: #0f172a; font-size: 14px; margin-bottom: 2px;">${escapeHtml(deal.licensor_name)}</div>
          <div style="color: #64748b; font-size: 13px;">
            <span style="color: #475569;">&#8594;</span> ${escapeHtml(deal.licensee_name)}
            ${deal.asset_name ? `<span style="color: #94a3b8;">&nbsp;&middot;&nbsp;</span><span style="color: #64748b;">${escapeHtml(deal.asset_name)}</span>` : ''}
          </div>
          <div style="margin-top: 6px;">
            <span style="display: inline-block; background: #f0fdfa; color: #0d9488; padding: 2px 8px; border-radius: 4px; font-size: 10px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">${formatModality(deal.modality)}</span>
          </div>
        </td>
        <td style="padding: 14px 12px; border-bottom: 1px solid #f1f5f9; text-align: center; vertical-align: middle;">
          ${phaseBadge(deal.phase_at_signing)}
        </td>
        <td style="padding: 14px 16px; border-bottom: 1px solid #f1f5f9; text-align: right; vertical-align: middle;">
          <div style="font-weight: 800; font-size: 16px; color: #0f172a;">${formatUsd(deal.upfront_usd)}</div>
          ${deal.total_deal_value_usd ? `<div style="font-size: 11px; color: #94a3b8; margin-top: 2px;">of ${formatUsd(deal.total_deal_value_usd)} total</div>` : ''}
        </td>
      </tr>`
    )
    .join('');

  // Benchmark changes
  const benchmarkEntries = Object.entries(snapshot.benchmark_changes || {})
    .filter(([, pct]) => Math.abs(pct) >= 1)
    .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
    .slice(0, 5);

  const benchmarkRows = benchmarkEntries
    .map(([key, pct]) => {
      const modality = key.replace('_upfront_change_pct', '');
      return `
      <tr>
        <td style="padding: 10px 16px; border-bottom: 1px solid #f1f5f9; font-size: 14px; font-weight: 600; color: #1e293b;">${formatModality(modality)}</td>
        <td style="padding: 10px 16px; border-bottom: 1px solid #f1f5f9; text-align: right;">${changeBadge(pct)}</td>
      </tr>`;
    })
    .join('');

  // Watchlist matches
  const watchlistMatches = watchlistItems
    .filter((item) => {
      if (item.item_type === 'modality') {
        return snapshot.modality_breakdown[item.item_value]?.count > 0;
      }
      if (item.item_type === 'therapeutic_area') {
        return snapshot.therapeutic_area_breakdown[item.item_value]?.count > 0;
      }
      return false;
    })
    .map((item) => {
      const data =
        item.item_type === 'modality'
          ? snapshot.modality_breakdown[item.item_value]
          : snapshot.therapeutic_area_breakdown[item.item_value];
      return `
      <tr>
        <td style="padding: 10px 16px; border-bottom: 1px solid #f1f5f9;">
          <span style="font-weight: 600; color: #1e293b; font-size: 14px;">${formatModality(item.item_value)}</span>
        </td>
        <td style="padding: 10px 16px; border-bottom: 1px solid #f1f5f9; text-align: center; font-size: 14px; font-weight: 700; color: #0d9488;">${data.count}</td>
        <td style="padding: 10px 16px; border-bottom: 1px solid #f1f5f9; text-align: right; font-size: 14px; font-weight: 600; color: #475569;">${data.avg_upfront ? formatUsd(data.avg_upfront) : '&mdash;'}</td>
      </tr>`;
    })
    .join('');

  // Trial updates
  const trialUpdates = snapshot.trial_updates;
  const trialStats = [
    { label: 'Recruiting', value: trialUpdates?.new_recruiting || 0, color: '#0d9488' },
    { label: 'Completed', value: trialUpdates?.completed || 0, color: '#16a34a' },
    { label: 'Terminated', value: trialUpdates?.terminated || 0, color: '#dc2626' },
    { label: 'Suspended', value: trialUpdates?.suspended || 0, color: '#f59e0b' },
  ].filter(s => s.value > 0);

  // Find hottest modality
  const modalities = Object.entries(snapshot.modality_breakdown || {}).sort(([, a], [, b]) => b.count - a.count);
  const hottestModality = modalities.length > 0 ? modalities[0] : null;

  // Phase breakdown for mini chart
  const phaseEntries = Object.entries(snapshot.phase_breakdown || {})
    .filter(([, data]) => data.count > 0)
    .sort(([, a], [, b]) => b.count - a.count);
  const maxPhaseCount = phaseEntries.length > 0 ? phaseEntries[0][1].count : 1;

  const snapshotDateFormatted = new Date(snapshot.snapshot_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' });

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>Weekly Market Pulse</title>
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 660px; margin: 0 auto; padding: 0; background: #f1f5f9;">

        <!-- Preheader (hidden, shows in email preview) -->
        <div style="display: none; max-height: 0; overflow: hidden; font-size: 1px; line-height: 1px; color: #f1f5f9;">
          ${snapshot.new_deals_count} new deals this week &bull; Avg upfront ${formatUsd(snapshot.avg_upfront_usd)}${hottestModality ? ` &bull; ${formatModality(hottestModality[0])} leading` : ''}
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
                          <img src="https://solidus.ambrosiaventures.co/logo-white.png" alt="Ambrosia Ventures" width="160" style="display: block; margin: 0 auto 16px; width: 160px; height: auto;" />
                          <h1 style="color: #ffffff; margin: 0; font-size: 28px; font-weight: 800; letter-spacing: -0.5px;">Weekly Market Pulse</h1>
                          <div style="width: 40px; height: 3px; background: linear-gradient(90deg, #14b8a6, #06b6d4); margin: 16px auto; border-radius: 2px;"></div>
                          <p style="color: #94a3b8; margin: 0; font-size: 14px; font-weight: 400;">Week of ${snapshotDateFormatted}</p>
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
                      <p style="font-size: 14px; margin: 8px 0 0; color: #64748b;">Here's your weekly snapshot of biopharma deal activity.</p>
                    </div>

                    <!-- KPI Cards -->
                    <div style="padding: 24px 32px;">
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          <td width="33%" style="padding: 0 4px 0 0;">
                            <div style="background: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 12px; padding: 20px 16px; text-align: center;">
                              <div style="font-size: 32px; font-weight: 800; color: #0d9488; line-height: 1;">${snapshot.new_deals_count}</div>
                              <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 6px; font-weight: 600;">New Deals</div>
                            </div>
                          </td>
                          <td width="33%" style="padding: 0 4px;">
                            <div style="background: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 12px; padding: 20px 16px; text-align: center;">
                              <div style="font-size: 32px; font-weight: 800; color: #0d9488; line-height: 1;">${formatUsd(snapshot.avg_upfront_usd)}</div>
                              <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 6px; font-weight: 600;">Avg Upfront</div>
                            </div>
                          </td>
                          <td width="33%" style="padding: 0 0 0 4px;">
                            <div style="background: #f0fdfa; border: 1px solid #ccfbf1; border-radius: 12px; padding: 20px 12px; text-align: center;">
                              <div style="font-size: 18px; font-weight: 800; color: #0d9488; line-height: 1.3; word-spacing: 0; white-space: nowrap;">${hottestModality ? formatModality(hottestModality[0]) : 'N/A'}</div>
                              <div style="font-size: 11px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 6px; font-weight: 600;">Top Modality</div>
                            </div>
                          </td>
                        </tr>
                      </table>
                    </div>

                    ${snapshot.notable_deals && snapshot.notable_deals.length > 0 ? `
                    <!-- Notable Deals -->
                    <div style="padding: 0 32px 24px;">
                      <div style="display: flex; align-items: center; margin-bottom: 16px;">
                        <div style="width: 4px; height: 20px; background: linear-gradient(180deg, #14b8a6, #06b6d4); border-radius: 2px; margin-right: 10px; display: inline-block; vertical-align: middle;"></div>
                        <h2 style="font-size: 18px; margin: 0; color: #0f172a; font-weight: 800; display: inline-block; vertical-align: middle;">Notable Deals</h2>
                      </div>
                      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                        <thead>
                          <tr style="background: #f8fafc;">
                            <th style="padding: 12px 16px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #94a3b8; font-weight: 700; border-bottom: 1px solid #e2e8f0;">Deal</th>
                            <th style="padding: 12px 12px; text-align: center; font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #94a3b8; font-weight: 700; border-bottom: 1px solid #e2e8f0;">Phase</th>
                            <th style="padding: 12px 16px; text-align: right; font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #94a3b8; font-weight: 700; border-bottom: 1px solid #e2e8f0;">Upfront</th>
                          </tr>
                        </thead>
                        <tbody>${dealRows}</tbody>
                      </table>
                    </div>
                    ` : `
                    <div style="padding: 0 32px 24px;">
                      <div style="background: #f8fafc; border-radius: 12px; padding: 24px; text-align: center;">
                        <p style="color: #94a3b8; font-size: 14px; margin: 0; font-style: italic;">No notable deals announced this week.</p>
                      </div>
                    </div>
                    `}

                    ${benchmarkEntries.length > 0 ? `
                    <!-- Benchmark Shifts -->
                    <div style="padding: 0 32px 24px;">
                      <div style="display: flex; align-items: center; margin-bottom: 16px;">
                        <div style="width: 4px; height: 20px; background: linear-gradient(180deg, #f59e0b, #ef4444); border-radius: 2px; margin-right: 10px; display: inline-block; vertical-align: middle;"></div>
                        <h2 style="font-size: 18px; margin: 0; color: #0f172a; font-weight: 800; display: inline-block; vertical-align: middle;">Benchmark Shifts</h2>
                      </div>
                      <p style="font-size: 12px; color: #94a3b8; margin: 0 0 12px; font-weight: 500;">Upfront payment changes vs. 90-day trailing average</p>
                      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                        <tbody>${benchmarkRows}</tbody>
                      </table>
                    </div>
                    ` : ''}

                    ${phaseEntries.length > 0 ? `
                    <!-- Phase Distribution -->
                    <div style="padding: 0 32px 24px;">
                      <div style="display: flex; align-items: center; margin-bottom: 16px;">
                        <div style="width: 4px; height: 20px; background: linear-gradient(180deg, #8b5cf6, #6366f1); border-radius: 2px; margin-right: 10px; display: inline-block; vertical-align: middle;"></div>
                        <h2 style="font-size: 18px; margin: 0; color: #0f172a; font-weight: 800; display: inline-block; vertical-align: middle;">Deals by Phase</h2>
                      </div>
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        ${phaseEntries.map(([phase, data]) => {
                          const barWidth = Math.max(8, Math.round((data.count / maxPhaseCount) * 100));
                          return `
                          <tr>
                            <td style="padding: 6px 0; width: 90px;">
                              <span style="font-size: 13px; font-weight: 600; color: #475569;">${formatPhase(phase)}</span>
                            </td>
                            <td style="padding: 6px 12px;">
                              <div style="background: #f1f5f9; border-radius: 4px; height: 22px; width: 100%; position: relative;">
                                <div style="background: linear-gradient(90deg, #14b8a6, #06b6d4); border-radius: 4px; height: 22px; width: ${barWidth}%;"></div>
                              </div>
                            </td>
                            <td style="padding: 6px 0; width: 50px; text-align: right;">
                              <span style="font-size: 14px; font-weight: 800; color: #0f172a;">${data.count}</span>
                            </td>
                          </tr>`;
                        }).join('')}
                      </table>
                    </div>
                    ` : ''}

                    ${trialStats.length > 0 ? `
                    <!-- Trial Updates -->
                    <div style="padding: 0 32px 24px;">
                      <div style="display: flex; align-items: center; margin-bottom: 16px;">
                        <div style="width: 4px; height: 20px; background: linear-gradient(180deg, #06b6d4, #0ea5e9); border-radius: 2px; margin-right: 10px; display: inline-block; vertical-align: middle;"></div>
                        <h2 style="font-size: 18px; margin: 0; color: #0f172a; font-weight: 800; display: inline-block; vertical-align: middle;">Trial Updates</h2>
                      </div>
                      <table width="100%" cellpadding="0" cellspacing="0" border="0">
                        <tr>
                          ${trialStats.map(stat => `
                          <td style="padding: 0 4px; text-align: center;">
                            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 8px;">
                              <div style="font-size: 24px; font-weight: 800; color: ${stat.color}; line-height: 1;">${stat.value}</div>
                              <div style="font-size: 10px; color: #64748b; text-transform: uppercase; letter-spacing: 0.5px; margin-top: 4px; font-weight: 600;">${stat.label}</div>
                            </div>
                          </td>
                          `).join('')}
                        </tr>
                      </table>
                    </div>
                    ` : ''}

                    ${watchlistMatches ? `
                    <!-- Watchlist -->
                    <div style="padding: 0 32px 24px;">
                      <div style="display: flex; align-items: center; margin-bottom: 16px;">
                        <div style="width: 4px; height: 20px; background: linear-gradient(180deg, #f59e0b, #eab308); border-radius: 2px; margin-right: 10px; display: inline-block; vertical-align: middle;"></div>
                        <h2 style="font-size: 18px; margin: 0; color: #0f172a; font-weight: 800; display: inline-block; vertical-align: middle;">Your Watchlist</h2>
                      </div>
                      <table width="100%" cellpadding="0" cellspacing="0" border="0" style="border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden;">
                        <thead>
                          <tr style="background: #f8fafc;">
                            <th style="padding: 10px 16px; text-align: left; font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #94a3b8; font-weight: 700;">Area</th>
                            <th style="padding: 10px 16px; text-align: center; font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #94a3b8; font-weight: 700;">Deals</th>
                            <th style="padding: 10px 16px; text-align: right; font-size: 10px; text-transform: uppercase; letter-spacing: 0.8px; color: #94a3b8; font-weight: 700;">Avg Upfront</th>
                          </tr>
                        </thead>
                        <tbody>${watchlistMatches}</tbody>
                      </table>
                    </div>
                    ` : ''}

                    <!-- CTA -->
                    <div style="padding: 8px 32px 36px; text-align: center;">
                      <a href="https://solidus.ambrosiaventures.co/pulse" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); color: #ffffff; padding: 16px 40px; text-decoration: none; border-radius: 12px; font-weight: 700; font-size: 15px; letter-spacing: 0.2px; box-shadow: 0 4px 14px rgba(20, 184, 166, 0.3);">
                        View Full Market Pulse &#8594;
                      </a>
                    </div>

                  </td>
                </tr>

                <!-- Footer -->
                <tr>
                  <td style="background: #0f172a; padding: 28px 32px; border-radius: 0 0 16px 16px; text-align: center;">
                    <img src="https://solidus.ambrosiaventures.co/logo-white.png" alt="Ambrosia Ventures" width="120" style="display: block; margin: 0 auto 8px; width: 120px; height: auto;" />
                    <p style="margin: 0 0 16px; font-size: 12px; color: #64748b;">
                      Data-driven deal intelligence for biopharma
                    </p>
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td align="center">
                          <a href="https://ambrosiaventures.co" style="color: #14b8a6; text-decoration: none; font-size: 12px; font-weight: 500;">ambrosiaventures.co</a>
                          <span style="color: #334155; margin: 0 8px;">&middot;</span>
                          <a href="https://solidus.ambrosiaventures.co" style="color: #14b8a6; text-decoration: none; font-size: 12px; font-weight: 500;">Solidus</a>
                          <span style="color: #334155; margin: 0 8px;">&middot;</span>
                          <a href="https://solidus.ambrosiaventures.co/dashboard?tab=settings" style="color: #64748b; text-decoration: none; font-size: 12px;">Unsubscribe</a>
                        </td>
                      </tr>
                    </table>
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
