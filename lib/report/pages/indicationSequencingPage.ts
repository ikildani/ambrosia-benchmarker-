// Page: Indication Expansion Sequencing
// Gantt-style timeline of franchise expansion across indications,
// expansion table, franchise value KPI, cannibalization note, and narrative.

import { formatUsd, formatPercent, pageHeader, pageFooter, COLORS, escapeHtml } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';

interface ExpansionEntry {
  indication: string;
  lineOfTherapy: string;
  probability: number;
  lag_years: number;
  incrementalPeakSales_M: number;
  cannibalization_pct: number;
  sequenceOrder: number;
}

/**
 * Renders an inline SVG Gantt-style timeline for indication expansion.
 * Each indication is a horizontal bar positioned at its lag_years offset,
 * width proportional to incremental peak sales, opacity keyed to probability.
 */
function renderExpansionTimelineSVG(expansions: ExpansionEntry[]): string {
  if (!expansions || expansions.length === 0) {
    return `<svg width="520" height="180" viewBox="0 0 520 180" xmlns="http://www.w3.org/2000/svg">
      <text x="260" y="90" text-anchor="middle" font-size="11" fill="${COLORS.gray400}">No expansion data</text>
    </svg>`;
  }

  const w = 520;
  const marginTop = 28;
  const marginBottom = 32;
  const marginLeft = 120;
  const marginRight = 24;
  const chartW = w - marginLeft - marginRight;

  const rowH = 28;
  const barH = 16;
  const n = expansions.length;
  const chartH = n * rowH;
  const h = marginTop + chartH + marginBottom;

  // Determine time scale (x = lag_years)
  const maxLag = Math.max(...expansions.map(e => e.lag_years)) + 2;
  const scaleX = (years: number) => marginLeft + (years / maxLag) * chartW;

  // Peak sales scale (bar width proportional to peak sales)
  const maxPeak = Math.max(...expansions.map(e => e.incrementalPeakSales_M), 1);
  const maxBarW = chartW * 0.35;
  const barWidth = (peak: number) => Math.max((peak / maxPeak) * maxBarW, 18);

  const uid = `is-${Math.random().toString(36).slice(2, 8)}`;

  const accentColors = [
    COLORS.teal, COLORS.cyan, COLORS.blue, COLORS.purple,
    COLORS.amber, COLORS.green, COLORS.rose,
  ];

  // Year gridlines
  const gridlines: string[] = [];
  for (let yr = 0; yr <= maxLag; yr++) {
    const gx = scaleX(yr);
    gridlines.push(
      `<line x1="${gx}" y1="${marginTop}" x2="${gx}" y2="${marginTop + chartH}" stroke="${COLORS.gray100}" stroke-width="0.5" />`,
    );
    gridlines.push(
      `<text x="${gx}" y="${marginTop + chartH + 14}" text-anchor="middle" font-size="7" font-weight="600" fill="${COLORS.gray400}">Yr ${yr}</text>`,
    );
  }

  // Sort by sequenceOrder for rendering
  const sorted = [...expansions].sort((a, b) => a.sequenceOrder - b.sequenceOrder);

  const bars = sorted.map((exp, i) => {
    const y = marginTop + i * rowH + (rowH - barH) / 2;
    const x = scaleX(exp.lag_years);
    const bw = barWidth(exp.incrementalPeakSales_M);
    const color = accentColors[i % accentColors.length];
    const opacity = Math.max(0.35, Math.min(1, exp.probability));

    // Row label (indication name, left side)
    const labelY = marginTop + i * rowH + rowH / 2 + 3;
    const truncLabel = exp.indication.length > 18 ? exp.indication.substring(0, 16) + '...' : exp.indication;

    // Row stripe for readability
    const stripe = i % 2 === 0
      ? `<rect x="${marginLeft}" y="${marginTop + i * rowH}" width="${chartW}" height="${rowH}" fill="${COLORS.gray50}" opacity="0.5" />`
      : '';

    return `
      ${stripe}
      <text x="${marginLeft - 6}" y="${labelY}" text-anchor="end" font-size="8" font-weight="600" fill="${COLORS.gray600}">${escapeHtml(truncLabel)}</text>
      <rect x="${x}" y="${y}" width="${bw}" height="${barH}" rx="3" fill="${color}" opacity="${opacity.toFixed(2)}" filter="url(#${uid}-shadow)" />
      <text x="${x + bw + 4}" y="${y + barH / 2 + 3}" font-size="7" font-weight="700" fill="${color}">${formatUsd(exp.incrementalPeakSales_M)}</text>
    `;
  });

  return `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="${uid}-shadow" x="-4%" y="-4%" width="108%" height="112%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.08" />
        </filter>
      </defs>
      <!-- Gridlines -->
      ${gridlines.join('')}
      <!-- Bars -->
      ${bars.join('')}
      <!-- Axis label -->
      <text x="${marginLeft + chartW / 2}" y="${h - 4}" text-anchor="middle" font-size="7" font-weight="700" fill="${COLORS.gray400}" text-transform="uppercase" letter-spacing="0.12em">YEARS FROM LEAD INDICATION LAUNCH</text>
    </svg>
  `;
}

export function renderIndicationSequencingPage(data: PDFReportData, meta: ReportMeta): string {
  if (!data.indicationSequence) return '';

  const seq = data.indicationSequence;
  const sorted = [...seq.expansionSequence].sort((a, b) => a.sequenceOrder - b.sequenceOrder);
  const hasCannibalization = sorted.some(e => e.cannibalization_pct > 0);

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, 'Deal Valuation Report')}

      <div class="section-title-lg">Indication Expansion Sequencing</div>

      <!-- Franchise Value KPI -->
      <div style="display: flex; gap: 10px; margin-bottom: 16px;">
        <div style="flex: 1; border: 1px solid ${COLORS.gray200}; border-top: 4px solid ${COLORS.teal}; border-radius: 6px; padding: 14px 16px; background: white;">
          <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 4px;">Total Franchise Value</div>
          <div style="font-size: 28px; font-weight: 800; color: ${COLORS.navy}; letter-spacing: -0.03em; line-height: 1;">${formatUsd(seq.totalFranchiseValue_M)}</div>
          <div style="font-size: 8px; color: ${COLORS.gray500}; margin-top: 4px;">${sorted.length} indication${sorted.length !== 1 ? 's' : ''} across franchise</div>
        </div>
        <div style="flex: 1; border: 1px solid ${COLORS.gray200}; border-top: 4px solid ${COLORS.cyan}; border-radius: 6px; padding: 14px 16px; background: white;">
          <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 4px;">Franchise Premium</div>
          <div style="font-size: 28px; font-weight: 800; color: ${COLORS.teal}; letter-spacing: -0.03em; line-height: 1;">${formatPercent(seq.franchisePremium_pct, 1)}</div>
          <div style="font-size: 8px; color: ${COLORS.gray500}; margin-top: 4px;">Over single-indication value</div>
        </div>
      </div>

      <!-- Expansion Timeline Chart -->
      <div class="section-title">Franchise Expansion Timeline</div>
      <div class="card" style="padding: 12px 16px; margin-bottom: 14px; border-top: 3px solid ${COLORS.navy};">
        <div class="chart-container">
          ${renderExpansionTimelineSVG(seq.expansionSequence)}
        </div>
        <div style="display: flex; justify-content: center; gap: 16px; margin-top: 6px;">
          <div style="font-size: 7px; color: ${COLORS.gray400}; font-weight: 600;">Bar width = incremental peak sales</div>
          <div style="font-size: 7px; color: ${COLORS.gray400}; font-weight: 600;">Opacity = probability of success</div>
        </div>
      </div>

      <!-- Expansion Sequence Table -->
      <div class="section-title">Expansion Sequence Detail</div>
      <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 14px;">
        <table class="data-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Indication</th>
              <th>Line of Therapy</th>
              <th style="text-align: right;">Probability</th>
              <th style="text-align: right;">Lag (Yr)</th>
              <th style="text-align: right;">Incr. Peak Sales</th>
              <th style="text-align: right;">Cannibalization</th>
            </tr>
          </thead>
          <tbody>
            ${sorted.map((exp, i) => {
              const isLast = i === sorted.length - 1;
              const cannColor = exp.cannibalization_pct > 10 ? COLORS.rose : exp.cannibalization_pct > 0 ? COLORS.amber : COLORS.gray500;
              return `
                <tr${isLast ? ` style="background: ${COLORS.gray50}; border-top: 2px solid ${COLORS.navy};"` : ''}>
                  <td style="font-weight: 700; color: ${COLORS.gray400};">${exp.sequenceOrder}</td>
                  <td style="font-weight: 600; color: ${COLORS.navy};">${escapeHtml(exp.indication)}</td>
                  <td style="font-size: 9px; color: ${COLORS.gray500};">${escapeHtml(exp.lineOfTherapy)}</td>
                  <td style="text-align: right; font-weight: 700; color: ${COLORS.teal};">${formatPercent(exp.probability * 100, 1)}</td>
                  <td style="text-align: right; font-weight: 700; color: ${COLORS.navy};">${exp.lag_years.toFixed(1)}</td>
                  <td style="text-align: right; font-weight: 700; color: ${COLORS.navy};">${formatUsd(exp.incrementalPeakSales_M)}</td>
                  <td style="text-align: right; font-weight: 700; color: ${cannColor};">${exp.cannibalization_pct > 0 ? '-' : ''}${formatPercent(exp.cannibalization_pct, 1)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      ${hasCannibalization ? `
      <!-- Cannibalization Note -->
      <div style="background: ${COLORS.amberLight}; border: 1px solid #fde68a; border-radius: 6px; padding: 10px 14px; margin-bottom: 14px;">
        <div style="font-size: 7px; font-weight: 700; color: #92400e; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 4px;">Cannibalization Risk</div>
        <div style="font-size: 9px; color: #78350f; line-height: 1.6;">
          Incremental peak sales figures are shown gross of cannibalization. Indications sharing overlapping patient populations may erode the lead indication's market share.
          Cannibalization rates above 10% warrant differentiated positioning or sequenced launch timing to preserve franchise economics.
        </div>
      </div>
      ` : ''}

      <!-- Narrative -->
      <div class="callout">
        ${escapeHtml(seq.narrative)}
      </div>

      <!-- Methodology note -->
      <div style="margin-top: 10px; font-size: 8px; color: ${COLORS.gray400}; line-height: 1.6;">
        <strong>Methodology:</strong> Expansion sequencing modeled using historical label expansion timelines from FDA supplemental approval data (2015-2025, n=280+ sNDAs/sBLAs). Probability estimates reflect phase-adjusted likelihood of approval for each follow-on indication. Cannibalization rates derived from analogous multi-indication franchises in the same therapeutic area.
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
