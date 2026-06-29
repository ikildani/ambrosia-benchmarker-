// Page: Earnout / CVR Analysis
// Tranche detail table, horizontal payout schedule bar chart, KPI boxes,
// and narrative block for contingent value right structures.

import { formatUsd, formatPercent, pageHeader, pageFooter, COLORS, escapeHtml } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';

// ---------------------------------------------------------------------------
// Trigger-type color mapping
// ---------------------------------------------------------------------------

const TRIGGER_COLORS: Record<string, { fill: string; light: string }> = {
  regulatory: { fill: COLORS.amber, light: COLORS.amberLight },
  commercial: { fill: '#6366f1', light: '#eef2ff' },
  clinical:   { fill: COLORS.teal, light: COLORS.tealLight },
  milestone:  { fill: COLORS.blue, light: COLORS.blueLight },
  sales:      { fill: COLORS.green, light: COLORS.greenLight },
};

function triggerColor(type?: string): { fill: string; light: string } {
  return TRIGGER_COLORS[(type || '').toLowerCase()] ?? { fill: COLORS.gray500, light: COLORS.gray100 };
}

// ---------------------------------------------------------------------------
// 1. Payout schedule horizontal bar chart
// ---------------------------------------------------------------------------

function renderPayoutScheduleSVG(
  schedule: { year: number; expectedPayment_M: number }[],
): string {
  if (!schedule || schedule.length === 0) {
    return `<svg width="520" height="120" viewBox="0 0 520 120" xmlns="http://www.w3.org/2000/svg">
      <text x="260" y="60" text-anchor="middle" font-size="11" fill="${COLORS.gray400}">No payout schedule</text>
    </svg>`;
  }

  const w = 520;
  const rowH = 24;
  const padL = 50;
  const padR = 60;
  const padT = 20;
  const chartW = w - padL - padR;
  const h = padT + schedule.length * rowH + 12;

  const maxVal = Math.max(...schedule.map(s => s.expectedPayment_M), 1) * 1.2;
  const scaleX = (v: number) => (v / maxVal) * chartW;

  const uid = `eo-${Math.random().toString(36).slice(2, 8)}`;

  // Gridlines (vertical)
  const gridSteps = 4;
  const gridSvg = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const val = (i / gridSteps) * maxVal;
    const gx = padL + scaleX(val);
    return `
      <line x1="${gx}" y1="${padT - 4}" x2="${gx}" y2="${padT + schedule.length * rowH}" stroke="${COLORS.gray100}" stroke-width="0.5" />
      <text x="${gx}" y="${padT - 8}" text-anchor="middle" font-size="7" fill="${COLORS.gray300}">${formatUsd(val)}</text>
    `;
  }).join('');

  // Axis label
  const axisLabel = `<text x="${padL + chartW / 2}" y="10" text-anchor="middle" font-size="7" font-weight="700" fill="${COLORS.gray400}" letter-spacing="0.12em">EXPECTED PAYOUT ($M)</text>`;

  // Bars
  const barsSvg = schedule.map((s, i) => {
    const y = padT + i * rowH;
    const barY = y + 4;
    const barH = rowH - 8;
    const barW = Math.max(scaleX(s.expectedPayment_M), 4);

    return `
      <text x="${padL - 6}" y="${barY + barH / 2 + 3}" text-anchor="end" font-size="8" font-weight="600" fill="${COLORS.gray600}">Year ${s.year}</text>
      <rect x="${padL}" y="${barY}" width="${barW}" height="${barH}" rx="3" fill="url(#${uid}-grad)" filter="url(#${uid}-shadow)" />
      <text x="${padL + barW + 5}" y="${barY + barH / 2 + 3}" font-size="8" font-weight="700" fill="${COLORS.teal}">${formatUsd(s.expectedPayment_M)}</text>
    `;
  }).join('');

  return `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="${uid}-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="${COLORS.teal}" />
          <stop offset="100%" stop-color="${COLORS.cyan}" />
        </linearGradient>
        <filter id="${uid}-shadow" x="-4%" y="-4%" width="108%" height="112%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.08" />
        </filter>
      </defs>
      ${axisLabel}
      ${gridSvg}
      ${barsSvg}
    </svg>
  `;
}

// ---------------------------------------------------------------------------
// 2. KPI metric box helper
// ---------------------------------------------------------------------------

function kpiBox(
  label: string,
  value: string,
  accentColor: string,
  subtitle?: string,
): string {
  return `
    <div style="flex: 1; border: 1px solid ${COLORS.gray200}; border-top: 3px solid ${accentColor}; border-radius: 6px; padding: 12px 14px; background: white;">
      <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 6px;">${label}</div>
      <div style="font-size: 22px; font-weight: 800; color: ${COLORS.navy}; letter-spacing: -0.03em; line-height: 1;">${value}</div>
      ${subtitle ? `<div style="font-size: 8px; font-weight: 500; color: ${COLORS.gray400}; margin-top: 4px;">${subtitle}</div>` : ''}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function renderEarnoutPage(data: PDFReportData, meta: ReportMeta): string {
  if (!data.earnoutValuation) return '';

  const ev = data.earnoutValuation;

  // Compute total contingent value from tranches
  const totalContingent = ev.tranches.reduce((sum, t) => sum + t.value_M, 0);

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, 'Deal Valuation Report')}

      <div class="section-title-lg">Earnout / CVR Analysis</div>

      <!-- KPI Boxes -->
      <div class="section-title">Key Metrics</div>
      <div style="display: flex; gap: 10px; margin-bottom: 14px;">
        ${kpiBox('Total Contingent Value', formatUsd(totalContingent), COLORS.navy, `${ev.tranches.length} tranche${ev.tranches.length !== 1 ? 's' : ''}`)}
        ${kpiBox('Probability-Weighted Value', formatUsd(ev.probabilityWeightedValue_M), COLORS.teal)}
        ${kpiBox('Upfront Equivalent', formatUsd(ev.upfrontEquivalent_M), COLORS.cyan)}
        ${kpiBox('Earnout % of Total', formatPercent(ev.earnoutAsPercentOfTotal, 1), COLORS.purple)}
      </div>

      <!-- Tranche Detail Table -->
      <div class="section-title">Earnout Tranche Detail</div>
      <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 14px; border-top: 3px solid ${COLORS.navy};">
        <table class="data-table">
          <thead>
            <tr>
              <th>Trigger</th>
              <th>Type</th>
              <th style="text-align: right;">Value</th>
              <th style="text-align: right;">Probability</th>
              <th style="text-align: right;">Timing (Yr)</th>
              <th style="text-align: right;">Discounted Value</th>
            </tr>
          </thead>
          <tbody>
            ${ev.tranches.map((t, i) => {
              const tc = triggerColor(t.triggerType);
              const probColor = t.probability >= 0.7 ? COLORS.green : t.probability >= 0.4 ? COLORS.amber : COLORS.rose;
              const isLast = i === ev.tranches.length - 1;
              return `
                <tr>
                  <td style="font-weight: 500;">${escapeHtml(t.trigger)}</td>
                  <td>
                    <span style="display: inline-block; font-size: 7px; font-weight: 700; color: ${tc.fill}; background: ${tc.light}; padding: 2px 6px; border-radius: 3px; text-transform: uppercase; letter-spacing: 0.08em;">${escapeHtml(t.triggerType || 'Other')}</span>
                  </td>
                  <td style="text-align: right; font-weight: 700; color: ${COLORS.navy};">${formatUsd(t.value_M)}</td>
                  <td style="text-align: right; font-weight: 700; color: ${probColor};">${formatPercent(t.probability * 100, 1)}</td>
                  <td style="text-align: right; color: ${COLORS.gray600};">${t.expectedTiming_years.toFixed(1)}</td>
                  <td style="text-align: right; font-weight: 700; color: ${COLORS.teal};">${formatUsd(t.discountedValue_M)}</td>
                </tr>
              `;
            }).join('')}
            <tr style="background: ${COLORS.gray50}; border-top: 2px solid ${COLORS.navy};">
              <td style="font-weight: 700;">Total</td>
              <td></td>
              <td style="text-align: right; font-weight: 700; color: ${COLORS.navy};">${formatUsd(totalContingent)}</td>
              <td></td>
              <td></td>
              <td style="text-align: right; font-weight: 700; color: #0f766e;">${formatUsd(ev.probabilityWeightedValue_M)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Payout Schedule Chart -->
      <div class="section-title">Expected Payout Schedule</div>
      <div class="card" style="padding: 12px 16px; margin-bottom: 14px; border-top: 3px solid ${COLORS.navy};">
        <div class="chart-container">
          ${renderPayoutScheduleSVG(ev.expectedPayoutSchedule)}
        </div>
      </div>

      <!-- Probability-Weighted Value Callout -->
      <div style="background: linear-gradient(145deg, ${COLORS.navy} 0%, #252a5e 100%); border-radius: 6px; padding: 18px 24px; color: white; margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 7px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.16em; font-weight: 700; margin-bottom: 4px;">Probability-Weighted Earnout Value</div>
            <div style="font-size: 9px; color: rgba(255,255,255,0.55); line-height: 1.5;">
              ${formatUsd(totalContingent)} nominal &rarr; ${formatUsd(ev.probabilityWeightedValue_M)} risk-adjusted across ${ev.tranches.length} tranche${ev.tranches.length !== 1 ? 's' : ''}
            </div>
          </div>
          <div style="text-align: right; flex-shrink: 0;">
            <div style="font-size: 32px; font-weight: 800; color: ${COLORS.tealMid}; letter-spacing: -0.03em; line-height: 1;">${formatPercent(ev.earnoutAsPercentOfTotal, 1)}</div>
            <div style="font-size: 8px; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 0.1em; margin-top: 4px;">of Total Deal Value</div>
          </div>
        </div>
      </div>

      <!-- Narrative -->
      <div class="callout">
        ${escapeHtml(ev.narrative)}
      </div>

      <!-- Methodology note -->
      <div style="margin-top: 10px; font-size: 8px; color: ${COLORS.gray400}; line-height: 1.6;">
        <strong>Methodology:</strong> Earnout probabilities derived from BIO/QLS phase transition tables and FDA approval rates (2020-2026). Commercial trigger probabilities calibrated to DealForma revenue-milestone achievement data (n=850+ transactions). Discounted values use a risk-adjusted rate reflecting the contingent nature of each tranche. CVR fair-value estimates follow ASC 805 acquisition accounting guidance.
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
