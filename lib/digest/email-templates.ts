import { WeeklySnapshot } from './weekly-snapshot';

interface WatchlistItem {
  item_type: string;
  item_value: string;
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
  return `<span style="color: ${color}; font-weight: 600;">${arrow} ${Math.abs(pct).toFixed(1)}%</span>`;
}

export function buildWeeklyDigestHtml(
  snapshot: WeeklySnapshot,
  watchlistItems: WatchlistItem[],
  userName: string
): string {
  // Top 5 notable deals section
  const dealRows = (snapshot.notable_deals || [])
    .map(
      (deal) => `
      <tr>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px;">
          <span style="display: inline-block; background: #f0fdfa; color: #0d9488; padding: 2px 8px; border-radius: 6px; font-size: 11px; font-weight: 600; margin-bottom: 4px;">${formatModality(deal.modality)}</span><br>
          <strong>${deal.licensor_name}</strong> &rarr; ${deal.licensee_name}
          ${deal.asset_name ? `<br><span style="color: #64748b; font-size: 12px;">${deal.asset_name}</span>` : ''}
        </td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: center;">${formatPhase(deal.phase_at_signing)}</td>
        <td style="padding: 10px 12px; border-bottom: 1px solid #e2e8f0; font-size: 13px; text-align: right; font-weight: 600; color: #14b8a6;">${formatUsd(deal.upfront_usd)}</td>
      </tr>`
    )
    .join('');

  // Benchmark changes section
  const benchmarkBullets = Object.entries(snapshot.benchmark_changes || {})
    .filter(([, pct]) => Math.abs(pct) >= 1)
    .sort(([, a], [, b]) => Math.abs(b) - Math.abs(a))
    .slice(0, 5)
    .map(([key, pct]) => {
      const modality = key.replace('_upfront_change_pct', '');
      return `<li style="margin-bottom: 6px;">${formatModality(modality)} upfronts ${changeBadge(pct)} vs 90-day avg</li>`;
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
      return `<li style="margin-bottom: 6px;"><strong>${formatModality(item.item_value)}</strong>: ${data.count} new deal${data.count !== 1 ? 's' : ''}${data.avg_upfront ? ` (avg upfront ${formatUsd(data.avg_upfront)})` : ''}</li>`;
    })
    .join('');

  // Trial updates summary
  const trialUpdates = snapshot.trial_updates;
  const trialParts: string[] = [];
  if (trialUpdates?.new_recruiting) trialParts.push(`${trialUpdates.new_recruiting} now recruiting`);
  if (trialUpdates?.completed) trialParts.push(`${trialUpdates.completed} completed`);
  if (trialUpdates?.terminated) trialParts.push(`${trialUpdates.terminated} terminated`);
  const trialSummary = trialParts.length > 0 ? trialParts.join(' &bull; ') : 'No trial status changes this week';

  // Find hottest modality
  const modalities = Object.entries(snapshot.modality_breakdown || {}).sort(([, a], [, b]) => b.count - a.count);
  const hottestModality = modalities.length > 0 ? modalities[0] : null;

  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
      </head>
      <body style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.6; color: #1e293b; max-width: 640px; margin: 0 auto; padding: 20px; background: #f8fafc;">

        <!-- Header -->
        <div style="background: linear-gradient(135deg, #0f172a 0%, #1e3a5f 100%); padding: 32px; border-radius: 16px 16px 0 0; text-align: center;">
          <p style="color: #94a3b8; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin: 0 0 8px;">Ambrosia Ventures</p>
          <h1 style="color: #fff; margin: 0; font-size: 24px;">Weekly Market Pulse</h1>
          <p style="color: #94a3b8; margin: 8px 0 0; font-size: 14px;">Week of ${new Date(snapshot.snapshot_date).toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}</p>
        </div>

        <div style="background: #fff; padding: 32px; border: 1px solid #e2e8f0; border-top: none;">

          <p style="font-size: 16px; margin-top: 0;">Hi ${userName},</p>

          <!-- Stat Row -->
          <div style="display: flex; background: #f0fdfa; border-radius: 12px; padding: 20px; margin: 20px 0; text-align: center;">
            <div style="flex: 1;">
              <div style="font-size: 28px; font-weight: 700; color: #0d9488;">${snapshot.new_deals_count}</div>
              <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">New Deals</div>
            </div>
            <div style="flex: 1; border-left: 1px solid #ccfbf1; border-right: 1px solid #ccfbf1;">
              <div style="font-size: 28px; font-weight: 700; color: #0d9488;">${formatUsd(snapshot.avg_upfront_usd)}</div>
              <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Avg Upfront</div>
            </div>
            <div style="flex: 1;">
              <div style="font-size: 28px; font-weight: 700; color: #0d9488;">${hottestModality ? formatModality(hottestModality[0]) : 'N/A'}</div>
              <div style="font-size: 12px; color: #64748b; text-transform: uppercase;">Hottest Modality</div>
            </div>
          </div>

          ${
            snapshot.notable_deals && snapshot.notable_deals.length > 0
              ? `
          <!-- This Week's Deals -->
          <h2 style="font-size: 18px; margin: 28px 0 12px; color: #0f172a;">This Week's Deals</h2>
          <table style="width: 100%; border-collapse: collapse; font-size: 14px;">
            <thead>
              <tr style="background: #f8fafc;">
                <th style="padding: 8px 12px; text-align: left; font-size: 11px; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #e2e8f0;">Deal</th>
                <th style="padding: 8px 12px; text-align: center; font-size: 11px; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #e2e8f0;">Phase</th>
                <th style="padding: 8px 12px; text-align: right; font-size: 11px; text-transform: uppercase; color: #64748b; border-bottom: 2px solid #e2e8f0;">Upfront</th>
              </tr>
            </thead>
            <tbody>${dealRows}</tbody>
          </table>
          `
              : '<p style="color: #64748b; font-style: italic;">No new deals announced this week.</p>'
          }

          ${
            benchmarkBullets
              ? `
          <!-- Benchmark Shifts -->
          <h2 style="font-size: 18px; margin: 28px 0 12px; color: #0f172a;">Benchmark Shifts</h2>
          <ul style="padding-left: 20px; margin: 0;">${benchmarkBullets}</ul>
          `
              : ''
          }

          <!-- Trial Updates -->
          <h2 style="font-size: 18px; margin: 28px 0 12px; color: #0f172a;">Trial Updates</h2>
          <p style="margin: 0; color: #334155;">${trialSummary}</p>

          ${
            watchlistMatches
              ? `
          <!-- Your Watchlist -->
          <h2 style="font-size: 18px; margin: 28px 0 12px; color: #0f172a;">Your Watchlist</h2>
          <ul style="padding-left: 20px; margin: 0;">${watchlistMatches}</ul>
          `
              : ''
          }

          <!-- CTA -->
          <div style="text-align: center; margin: 32px 0 16px;">
            <a href="https://calculator.ambrosiaventures.co/pulse" style="display: inline-block; background: linear-gradient(135deg, #14b8a6 0%, #06b6d4 100%); color: #fff; padding: 14px 32px; text-decoration: none; border-radius: 12px; font-weight: 600; font-size: 16px;">
              View Full Market Pulse
            </a>
          </div>

        </div>

        <!-- Footer -->
        <div style="background: #fff; padding: 20px 32px; border: 1px solid #e2e8f0; border-top: none; border-radius: 0 0 16px 16px; text-align: center;">
          <p style="margin: 0; color: #64748b; font-size: 12px;">
            Ambrosia Ventures | <a href="https://ambrosiaventures.co" style="color: #14b8a6; text-decoration: none;">ambrosiaventures.co</a>
          </p>
          <p style="margin: 8px 0 0; color: #94a3b8; font-size: 11px;">
            <a href="https://calculator.ambrosiaventures.co/dashboard?tab=settings" style="color: #94a3b8; text-decoration: none;">Manage email preferences</a>
          </p>
        </div>

      </body>
    </html>
  `;
}
