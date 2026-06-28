// Page: Deal Valuation Waterfall
// SVG waterfall chart showing step-down from unadjusted NPV to final deal value,
// deal component allocation grid, narrative, and methodology note.

import { formatUsd, formatPercent, pageHeader, pageFooter, COLORS, escapeHtml } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';
import type { DealWaterfallStep } from '@/lib/financial/types';
import { computeDifferentiationAdjustment, DIFFERENTIATION_FACTORS, type DifferentiationKey } from '@/lib/financial/differentiation-profiles';

/**
 * Renders an inline SVG waterfall chart for the deal valuation cascade.
 * Bars float: positive adjustments go up (teal), negative adjustments go down (rose).
 * First bar (starting value) and last bar (final value) are grounded from baseline.
 */
function renderDealWaterfallSVG(steps: DealWaterfallStep[]): string {
  if (!steps || steps.length === 0) {
    return `<svg width="520" height="250" viewBox="0 0 520 250" xmlns="http://www.w3.org/2000/svg">
      <text x="260" y="125" text-anchor="middle" font-size="11" fill="${COLORS.gray400}">No waterfall data</text>
    </svg>`;
  }

  const w = 520;
  const marginTop = 24;
  const marginBottom = 60;
  const marginLeft = 12;
  const marginRight = 12;
  const chartW = w - marginLeft - marginRight;

  const barCount = steps.length;
  const barGap = 6;
  const barW = Math.min(64, (chartW - barGap * (barCount - 1)) / barCount);
  const totalBarsW = barCount * barW + (barCount - 1) * barGap;
  const offsetX = marginLeft + (chartW - totalBarsW) / 2;

  // Determine scale from running totals
  const allValues = steps.map(s => s.runningTotal);
  allValues.push(0);
  const maxVal = Math.max(...allValues) * 1.15;
  const minVal = Math.min(...allValues, 0) * 1.05;
  const range = maxVal - minVal || 1;

  const chartH = 250 - marginTop - marginBottom;
  const scaleY = (v: number) => marginTop + ((maxVal - v) / range) * chartH;
  const baselineY = scaleY(0);

  const uid = `dw-${Math.random().toString(36).slice(2, 8)}`;

  const bars: string[] = [];

  // Gridlines
  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const val = minVal + (i / gridSteps) * range;
    const gy = scaleY(val);
    bars.push(`<line x1="${marginLeft}" y1="${gy}" x2="${w - marginRight}" y2="${gy}" stroke="${COLORS.gray100}" stroke-width="0.5" />`);
    bars.push(`<text x="${marginLeft - 2}" y="${gy + 3}" text-anchor="end" font-size="7" fill="${COLORS.gray300}">${formatUsd(val)}</text>`);
  }

  let prevRunning = 0;

  steps.forEach((step, i) => {
    const cx = offsetX + i * (barW + barGap) + barW / 2;
    const x = offsetX + i * (barW + barGap);
    const isFirst = i === 0;
    const isLast = i === steps.length - 1;

    if (isFirst || isLast) {
      // Full bar from baseline to value
      const topY = scaleY(step.runningTotal);
      const botY = baselineY;
      const barH = Math.max(Math.abs(botY - topY), 2);
      const yPos = Math.min(topY, botY);
      const gradId = isFirst ? `url(#${uid}-base)` : `url(#${uid}-final)`;

      bars.push(`
        <rect x="${x}" y="${yPos}" width="${barW}" height="${barH}" rx="3" fill="${gradId}" filter="url(#${uid}-shadow)" />
        <text x="${cx}" y="${yPos - 5}" text-anchor="middle" font-size="9" font-weight="700" fill="${isLast ? '#0f766e' : COLORS.gray600}">${formatUsd(step.runningTotal)}</text>
      `);
    } else {
      // Floating bar from previous running total
      const adj = step.adjustment;
      const isPositive = adj >= 0;
      const topY = scaleY(Math.max(prevRunning, step.runningTotal));
      const botY = scaleY(Math.min(prevRunning, step.runningTotal));
      const barH = Math.max(Math.abs(botY - topY), 2);
      const gradId = isPositive ? `url(#${uid}-teal)` : `url(#${uid}-rose)`;

      // Connector from previous bar
      const prevX = offsetX + (i - 1) * (barW + barGap) + barW;
      const connY = scaleY(prevRunning);
      bars.push(`<line x1="${prevX}" y1="${connY}" x2="${x}" y2="${connY}" stroke="${COLORS.gray300}" stroke-width="1" stroke-dasharray="3,2" />`);

      bars.push(`
        <rect x="${x}" y="${topY}" width="${barW}" height="${barH}" rx="3" fill="${gradId}" filter="url(#${uid}-shadow)" />
        <text x="${cx}" y="${topY - 5}" text-anchor="middle" font-size="8" font-weight="700" fill="${isPositive ? COLORS.teal : COLORS.rose}">${isPositive ? '+' : ''}${formatUsd(adj)}</text>
      `);
    }

    // Bottom label (truncate long labels)
    const labelText = step.label.length > 14 ? step.label.substring(0, 12) + '...' : step.label;
    const labelY = 250 - marginBottom + 14;
    bars.push(`<text x="${cx}" y="${labelY}" text-anchor="middle" font-size="8" font-weight="600" fill="${COLORS.gray600}" transform="rotate(-25, ${cx}, ${labelY})">${escapeHtml(labelText)}</text>`);

    prevRunning = step.runningTotal;
  });

  return `
    <svg width="${w}" height="250" viewBox="0 0 ${w} 250" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="${uid}-base" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#64748b" />
          <stop offset="100%" stop-color="#94a3b8" />
        </linearGradient>
        <linearGradient id="${uid}-final" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0f766e" />
          <stop offset="100%" stop-color="#0d9488" />
        </linearGradient>
        <linearGradient id="${uid}-teal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0d9488" />
          <stop offset="100%" stop-color="#06b6d4" />
        </linearGradient>
        <linearGradient id="${uid}-rose" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${COLORS.rose}" />
          <stop offset="100%" stop-color="#fb7185" />
        </linearGradient>
        <filter id="${uid}-shadow" x="-4%" y="-4%" width="108%" height="112%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.08" />
        </filter>
      </defs>
      <!-- Baseline -->
      <line x1="${marginLeft}" y1="${baselineY}" x2="${w - marginRight}" y2="${baselineY}" stroke="${COLORS.gray200}" stroke-width="1" />
      ${bars.join('')}
    </svg>
  `;
}

function rangeBox(
  label: string,
  low: number,
  median: number,
  high: number,
  accentColor: string,
  isPercent: boolean = false,
): string {
  const fmt = isPercent ? (v: number) => formatPercent(v, 1) : formatUsd;
  return `
    <div style="flex: 1; border: 1px solid ${COLORS.gray200}; border-top: 3px solid ${accentColor}; border-radius: 6px; padding: 12px 14px; background: white;">
      <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 6px;">${label}</div>
      <div style="font-size: 22px; font-weight: 800; color: ${COLORS.navy}; letter-spacing: -0.03em; line-height: 1;">${fmt(median)}</div>
      <div style="display: flex; justify-content: space-between; margin-top: 6px; padding-top: 6px; border-top: 1px solid ${COLORS.gray100};">
        <div style="text-align: left;">
          <div style="font-size: 7px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600;">Low</div>
          <div style="font-size: 11px; font-weight: 700; color: ${COLORS.gray600};">${fmt(low)}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 7px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600;">High</div>
          <div style="font-size: 11px; font-weight: 700; color: ${COLORS.gray600};">${fmt(high)}</div>
        </div>
      </div>
    </div>
  `;
}

export function renderDealWaterfallPage(data: PDFReportData, meta: ReportMeta): string {
  if (!data.dealWaterfall) return '';

  const wf = data.dealWaterfall;

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, 'Deal Valuation Report')}

      <div class="section-title-lg">Deal Valuation Waterfall</div>

      <!-- Waterfall Chart -->
      <div class="section-title">Valuation Cascade</div>
      <div class="card" style="padding: 14px 16px; margin-bottom: 14px; border-top: 3px solid ${COLORS.navy};">
        <div class="chart-container">
          ${renderDealWaterfallSVG(wf.steps)}
        </div>
      </div>

      <!-- Step Rationale Table -->
      <div class="section-title">Adjustment Rationale</div>
      <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 16px;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Step</th>
              <th style="text-align: right;">Adjustment</th>
              <th style="text-align: right;">Running Total</th>
              <th>Rationale</th>
            </tr>
          </thead>
          <tbody>
            ${wf.steps.map((step, i) => {
              const isFirst = i === 0;
              const isLast = i === wf.steps.length - 1;
              const adjColor = step.adjustment > 0 ? COLORS.teal : step.adjustment < 0 ? COLORS.rose : COLORS.gray500;
              const adjStr = isFirst ? '--' : (step.adjustment > 0 ? '+' : '') + formatUsd(step.adjustment);
              return `
                <tr${isLast ? ` style="background: ${COLORS.gray50}; border-top: 2px solid ${COLORS.navy};"` : ''}>
                  <td style="font-weight: ${isFirst || isLast ? '700' : '500'}; color: ${isLast ? '#0f766e' : COLORS.navy};">${escapeHtml(step.label)}</td>
                  <td style="text-align: right; font-weight: 700; color: ${adjColor};">${adjStr}</td>
                  <td style="text-align: right; font-weight: 700; color: ${isLast ? '#0f766e' : COLORS.navy};">${formatUsd(step.runningTotal)}</td>
                  <td style="font-size: 9px; color: ${COLORS.gray500}; max-width: 220px;">${escapeHtml(step.rationale)}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Deal Component Allocation Grid -->
      <div class="section-title">Deal Component Allocation</div>
      <div style="display: flex; gap: 10px; margin-bottom: 14px;">
        ${rangeBox('Upfront Payment', wf.upfrontPayment.low, wf.upfrontPayment.median, wf.upfrontPayment.high, COLORS.teal)}
        ${rangeBox('Dev Milestones', wf.developmentMilestones.low, wf.developmentMilestones.median, wf.developmentMilestones.high, COLORS.cyan)}
        ${rangeBox('Comm Milestones', wf.commercialMilestones.low, wf.commercialMilestones.median, wf.commercialMilestones.high, '#6366f1')}
        ${rangeBox('Royalty Range', wf.royaltyRate.low, wf.royaltyRate.median, wf.royaltyRate.high, '#8b5cf6', true)}
      </div>

      <!-- Asset Differentiation Detail -->
      ${(() => {
        const factors = data.inputs.differentiationFactors;
        if (!factors || factors.length === 0) return '';
        const diffResult = computeDifferentiationAdjustment(factors as DifferentiationKey[], data.inputs.phase);
        if (diffResult.factorBreakdown.length === 0) return '';
        return `
          <div class="section-title">Asset Differentiation Premium</div>
          <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 14px;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Factor</th>
                  <th style="text-align: right;">Base</th>
                  <th style="text-align: right;">Phase Credit</th>
                  <th style="text-align: right;">Effective</th>
                </tr>
              </thead>
              <tbody>
                ${diffResult.factorBreakdown.map(f => `
                  <tr>
                    <td style="font-weight: 500;">${escapeHtml(f.label)}</td>
                    <td style="text-align: right; color: ${COLORS.gray500};">+${(f.baseAdjustment * 100).toFixed(0)}%</td>
                    <td style="text-align: right; color: ${f.phaseScaling < 1 ? '#d97706' : COLORS.gray500};">${(f.phaseScaling * 100).toFixed(0)}%</td>
                    <td style="text-align: right; font-weight: 700; color: ${COLORS.teal};">+${(f.effectiveAdjustment * 100).toFixed(1)}%</td>
                  </tr>
                `).join('')}
                <tr style="background: ${COLORS.gray50}; border-top: 2px solid ${COLORS.navy};">
                  <td style="font-weight: 700;">Total${diffResult.wasCapped ? ' (capped)' : ''}</td>
                  <td></td>
                  <td></td>
                  <td style="text-align: right; font-weight: 700; color: #0f766e;">+${(diffResult.totalAdjustment * 100).toFixed(0)}%</td>
                </tr>
              </tbody>
            </table>
            ${diffResult.warnings.length > 0 ? `
              <div style="padding: 8px 14px; background: #fef3c7; border-top: 1px solid #fde68a;">
                ${diffResult.warnings.map(w => `
                  <div style="font-size: 9px; color: #92400e; margin: 2px 0;">${escapeHtml(w.message)}</div>
                `).join('')}
              </div>
            ` : ''}
          </div>
        `;
      })()}

      <!-- Narrative -->
      <div class="callout" style="margin-bottom: 10px;">
        ${escapeHtml(wf.narrative)}
      </div>

      <!-- Methodology note -->
      <div class="disclaimer-box">
        <strong>Methodology:</strong> Deal component allocation ratios derived from DealForma pharmaceutical licensing database (2020-2025, n=1,200+ transactions). Upfront percentages calibrated by phase: Preclinical 10-15%, Phase 1 15-20%, Phase 2 20-30%, Phase 3 30-40%, Approved 40-60%. Milestone split follows historical 55/45 development-to-commercial weighting. Royalty ranges benchmarked to modality-specific precedents.
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
