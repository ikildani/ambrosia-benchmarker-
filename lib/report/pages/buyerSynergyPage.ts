// Page: Buyer Synergy Analysis
// Comparison table of buyer synergy premiums, stacked bar breakdown for top buyer,
// integration risk badges, and narrative callout.

import { formatUsd, formatPercent, pageHeader, pageFooter, COLORS, escapeHtml } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';
import type { BuyerSynergyResult, IntegrationRisk } from '@/lib/financial/buyer-synergy';

// ---------------------------------------------------------------------------
// Risk badge helper
// ---------------------------------------------------------------------------

function riskBadge(risk: IntegrationRisk): string {
  const cfg: Record<IntegrationRisk, { color: string; bg: string }> = {
    low:    { color: COLORS.teal,  bg: COLORS.tealLight },
    medium: { color: COLORS.amber, bg: COLORS.amberLight },
    high:   { color: COLORS.rose,  bg: COLORS.roseLight },
  };
  const { color, bg } = cfg[risk] ?? cfg.medium;
  return `<span style="background: ${bg}; color: ${color}; font-size: 8px; font-weight: 700; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.10em;">${risk}</span>`;
}

// ---------------------------------------------------------------------------
// Horizontal stacked bar SVG for synergy source breakdown
// ---------------------------------------------------------------------------

function renderSynergyStackedBar(sources: BuyerSynergyResult['synergySources']): string {
  const w = 520;
  const h = 140;
  const barX = 10;
  const barW = w - 20;
  const barH = 22;
  const barY = 10;

  const total = sources.reduce((s, src) => s + src.premium_pct, 0) || 1;
  const uid = `bs-${Math.random().toString(36).slice(2, 8)}`;

  const segmentColors = [
    COLORS.teal, COLORS.cyan, COLORS.purple, COLORS.blue,
    COLORS.amber, COLORS.green, COLORS.rose, '#6366f1',
  ];

  const confColor = (c: string) =>
    c === 'high' ? COLORS.teal : c === 'medium' ? COLORS.amber : COLORS.gray400;

  let offsetX = barX;
  const segments: string[] = [];
  const labels: string[] = [];

  sources.forEach((src, i) => {
    const segW = Math.max((src.premium_pct / total) * barW, 2);
    const fill = segmentColors[i % segmentColors.length];

    segments.push(
      `<rect x="${offsetX}" y="${barY}" width="${segW}" height="${barH}" ` +
      `fill="${fill}" ${i === 0 ? 'rx="3"' : ''} ${i === sources.length - 1 ? 'rx="3"' : ''} />`,
    );

    // Label row below bar
    const labelY = barY + barH + 16 + i * 16;
    labels.push(`
      <circle cx="${barX + 4}" cy="${labelY - 4}" r="4" fill="${fill}" />
      <text x="${barX + 14}" y="${labelY}" font-size="8" font-weight="600" fill="${COLORS.gray700}">${escapeHtml(src.source)}</text>
      <text x="${barX + 200}" y="${labelY}" font-size="8" font-weight="700" fill="${COLORS.navy}">+${src.premium_pct.toFixed(1)}%</text>
      <text x="${barX + 260}" y="${labelY}" font-size="7" font-weight="700" fill="${confColor(src.confidence)}" text-transform="uppercase">${src.confidence}</text>
    `);

    offsetX += segW;
  });

  const svgH = barY + barH + 20 + sources.length * 16 + 4;

  return `
    <svg width="${w}" height="${svgH}" viewBox="0 0 ${w} ${svgH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="${uid}-sh" x="-4%" y="-4%" width="108%" height="112%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.08" />
        </filter>
      </defs>
      <!-- Bar track -->
      <rect x="${barX}" y="${barY}" width="${barW}" height="${barH}" rx="3" fill="${COLORS.gray100}" />
      <!-- Segments -->
      ${segments.join('')}
      <!-- Legend rows -->
      ${labels.join('')}
    </svg>
  `;
}

// ---------------------------------------------------------------------------
// Export
// ---------------------------------------------------------------------------

export function renderBuyerSynergyPage(data: PDFReportData, meta: ReportMeta): string {
  if (!data.buyerSynergies?.length) return '';

  const buyers = data.buyerSynergies;
  const topBuyer = buyers.reduce((best, b) =>
    b.totalSynergyPremium_pct > best.totalSynergyPremium_pct ? b : best, buyers[0]);

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, 'Deal Valuation Report')}

      <div class="section-title-lg">Buyer Synergy Analysis</div>

      <!-- Buyer comparison table -->
      <div class="section-title">Synergy Comparison Across Buyers</div>
      <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 16px; border-top: 3px solid ${COLORS.navy};">
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th style="text-align: right;">Total Synergy</th>
              <th style="text-align: right;">Revenue Synergy</th>
              <th style="text-align: right;">Cost Synergy</th>
              <th style="text-align: right;">Realization</th>
              <th style="text-align: center;">Integration Risk</th>
            </tr>
          </thead>
          <tbody>
            ${buyers.map((b, i) => {
              const isTop = b === topBuyer;
              const rowBg = isTop ? COLORS.gray50 : 'transparent';
              return `
              <tr style="background: ${rowBg};${isTop ? ` border-left: 3px solid ${COLORS.teal};` : ''}">
                <td style="font-weight: ${isTop ? '700' : '500'}; color: ${COLORS.navy};">Buyer ${i + 1}${isTop ? ' *' : ''}</td>
                <td style="text-align: right; font-weight: 800; color: ${isTop ? COLORS.teal : COLORS.navy};">+${formatPercent(b.totalSynergyPremium_pct, 1)}</td>
                <td style="text-align: right; font-weight: 700; color: ${COLORS.navy};">${formatUsd(b.revenueSynergies_M)}</td>
                <td style="text-align: right; font-weight: 700; color: ${COLORS.navy};">${formatUsd(b.costSynergies_M)}</td>
                <td style="text-align: right; font-weight: 600; color: ${COLORS.gray600};">${b.timeToRealizeSynergies_years.toFixed(1)} yr</td>
                <td style="text-align: center;">${riskBadge(b.integrationRisk)}</td>
              </tr>`;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Metric highlight cards -->
      <div style="display: flex; gap: 10px; margin-bottom: 16px;">
        <div style="flex: 1; border: 1px solid ${COLORS.gray200}; border-top: 4px solid ${COLORS.teal}; border-radius: 6px; padding: 14px; background: white;">
          <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 4px;">Top Synergy Premium</div>
          <div style="font-size: 26px; font-weight: 800; color: ${COLORS.teal}; letter-spacing: -0.03em; line-height: 1;">+${formatPercent(topBuyer.totalSynergyPremium_pct, 1)}</div>
        </div>
        <div style="flex: 1; border: 1px solid ${COLORS.gray200}; border-top: 4px solid ${COLORS.cyan}; border-radius: 6px; padding: 14px; background: white;">
          <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 4px;">Revenue Synergy</div>
          <div style="font-size: 26px; font-weight: 800; color: ${COLORS.navy}; letter-spacing: -0.03em; line-height: 1;">${formatUsd(topBuyer.revenueSynergies_M)}</div>
          <div style="font-size: 8px; color: ${COLORS.gray400}; margin-top: 4px;">per year (top buyer)</div>
        </div>
        <div style="flex: 1; border: 1px solid ${COLORS.gray200}; border-top: 4px solid ${COLORS.purple}; border-radius: 6px; padding: 14px; background: white;">
          <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 4px;">Cost Synergy</div>
          <div style="font-size: 26px; font-weight: 800; color: ${COLORS.navy}; letter-spacing: -0.03em; line-height: 1;">${formatUsd(topBuyer.costSynergies_M)}</div>
          <div style="font-size: 8px; color: ${COLORS.gray400}; margin-top: 4px;">per year (top buyer)</div>
        </div>
        <div style="flex: 1; border: 1px solid ${COLORS.gray200}; border-top: 4px solid ${COLORS.amber}; border-radius: 6px; padding: 14px; background: white;">
          <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 4px;">Time to Realize</div>
          <div style="font-size: 26px; font-weight: 800; color: ${COLORS.navy}; letter-spacing: -0.03em; line-height: 1;">${topBuyer.timeToRealizeSynergies_years.toFixed(1)}<span style="font-size: 14px;"> yr</span></div>
        </div>
      </div>

      <!-- Synergy source breakdown for top buyer -->
      <div class="section-title">Synergy Source Breakdown (Top Buyer)</div>
      <div class="card" style="padding: 12px 16px; margin-bottom: 16px; border-top: 3px solid ${COLORS.teal};">
        <div class="chart-container">
          ${renderSynergyStackedBar(topBuyer.synergySources)}
        </div>
      </div>

      <!-- Narrative -->
      <div class="callout" style="margin-bottom: 10px;">
        ${escapeHtml(topBuyer.narrative)}
      </div>

      <!-- Methodology -->
      <div style="margin-top: 10px; font-size: 8px; color: ${COLORS.gray400}; line-height: 1.6;">
        <strong>Methodology:</strong> Synergy premiums decomposed into 7 independent operational levers (commercial, manufacturing, pipeline, patent, regulatory, geographic, competitive blocking) calibrated against McKinsey, BCG, and DealForma pharma M&A datasets (2020-2026). Total synergy capped at 60% above standalone value. Revenue synergies = co-promotion + geographic expansion; cost synergies = manufacturing + SGA + R&D overlap. Integration risk assessed by modality complexity and TA overlap.
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
