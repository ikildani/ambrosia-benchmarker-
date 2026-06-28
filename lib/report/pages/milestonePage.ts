// Page: Milestone Probability Analysis
// Gantt-style SVG timeline, milestone table, probability-weighted total callout,
// payout schedule bar chart, and narrative block.

import { formatPercent, pageHeader, pageFooter, COLORS, escapeHtml } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';
import type { MilestoneEntry, AnnualPayout } from '@/lib/financial/milestone-probability';

// ---------------------------------------------------------------------------
// Category colors
// ---------------------------------------------------------------------------

const CAT_COLORS = {
  dev:  { fill: COLORS.teal,   light: COLORS.tealLight, label: 'Development' },
  comm: { fill: '#6366f1',     light: '#eef2ff',        label: 'Commercial'  },
  reg:  { fill: COLORS.amber,  light: COLORS.amberLight, label: 'Regulatory'  },
} as const;

type Category = keyof typeof CAT_COLORS;

// ---------------------------------------------------------------------------
// 1. Gantt-style timeline SVG
// ---------------------------------------------------------------------------

interface TimelineRow {
  event: string;
  timing: number;
  probability: number;
  category: Category;
}

function renderGanttTimeline(rows: TimelineRow[]): string {
  if (rows.length === 0) {
    return `<svg width="520" height="60" viewBox="0 0 520 60" xmlns="http://www.w3.org/2000/svg">
      <text x="260" y="30" text-anchor="middle" font-size="11" fill="${COLORS.gray400}">No milestone data</text>
    </svg>`;
  }

  const w = 520;
  const rowH = 22;
  const labelW = 140;
  const padR = 16;
  const padTop = 28;
  const chartW = w - labelW - padR;
  const h = padTop + rows.length * rowH + 32;

  const maxTiming = Math.max(...rows.map(r => r.timing), 1) * 1.15;
  const scaleX = (t: number) => labelW + (t / maxTiming) * chartW;

  const uid = `ms-${Math.random().toString(36).slice(2, 8)}`;

  // Gridlines
  const gridYears = [2, 4, 6, 8, 10, 12].filter(y => y <= maxTiming);
  const gridLines = gridYears.map(y => {
    const gx = scaleX(y);
    return `
      <line x1="${gx}" y1="${padTop - 6}" x2="${gx}" y2="${padTop + rows.length * rowH}" stroke="${COLORS.gray100}" stroke-width="0.5" />
      <text x="${gx}" y="${padTop - 10}" text-anchor="middle" font-size="7" fill="${COLORS.gray300}">${y}yr</text>
    `;
  }).join('');

  // Axis label
  const axisLabel = `<text x="${labelW + chartW / 2}" y="12" text-anchor="middle" font-size="7" font-weight="700" fill="${COLORS.gray400}" text-transform="uppercase" letter-spacing="0.12em">YEARS FROM DEAL SIGNING</text>`;

  // Bars
  const barSvg = rows.map((row, i) => {
    const y = padTop + i * rowH;
    const barY = y + 4;
    const barH = rowH - 8;
    const barW = Math.max(scaleX(row.timing) - labelW, 4);
    const color = CAT_COLORS[row.category].fill;
    const opacity = Math.max(0.25, Math.min(row.probability, 1));

    const truncLabel = row.event.length > 22 ? row.event.substring(0, 20) + '...' : row.event;
    const probLabel = `${(row.probability * 100).toFixed(0)}%`;

    return `
      <text x="${labelW - 6}" y="${barY + barH / 2 + 3}" text-anchor="end" font-size="8" font-weight="600" fill="${COLORS.gray600}">${escapeHtml(truncLabel)}</text>
      <rect x="${labelW}" y="${barY}" width="${barW}" height="${barH}" rx="3" fill="${color}" opacity="${opacity.toFixed(2)}" filter="url(#${uid}-shadow)" />
      <text x="${labelW + barW + 4}" y="${barY + barH / 2 + 3}" font-size="7" font-weight="700" fill="${color}">${probLabel}</text>
    `;
  }).join('');

  return `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="${uid}-shadow" x="-4%" y="-4%" width="108%" height="112%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.08" />
        </filter>
      </defs>
      ${axisLabel}
      ${gridLines}
      ${barSvg}
    </svg>
  `;
}

// ---------------------------------------------------------------------------
// 2. Payout schedule bar chart
// ---------------------------------------------------------------------------

function renderPayoutChart(schedule: AnnualPayout[]): string {
  if (!schedule || schedule.length === 0) {
    return `<svg width="520" height="120" viewBox="0 0 520 120" xmlns="http://www.w3.org/2000/svg">
      <text x="260" y="60" text-anchor="middle" font-size="11" fill="${COLORS.gray400}">No payout schedule</text>
    </svg>`;
  }

  const w = 520;
  const h = 120;
  const padL = 40;
  const padR = 16;
  const padT = 16;
  const padB = 28;
  const chartW = w - padL - padR;
  const chartH = h - padT - padB;

  const maxVal = Math.max(...schedule.map(s => s.expectedPayout_pct), 1) * 1.2;
  const barCount = schedule.length;
  const barGap = 4;
  const barW = Math.min(40, (chartW - barGap * (barCount - 1)) / barCount);
  const totalW = barCount * barW + (barCount - 1) * barGap;
  const offsetX = padL + (chartW - totalW) / 2;

  const scaleY = (v: number) => padT + ((maxVal - v) / maxVal) * chartH;
  const baseY = scaleY(0);

  const uid = `ps-${Math.random().toString(36).slice(2, 8)}`;

  const bars = schedule.map((s, i) => {
    const x = offsetX + i * (barW + barGap);
    const cx = x + barW / 2;
    const topY = scaleY(s.expectedPayout_pct);
    const barH = Math.max(baseY - topY, 2);

    return `
      <rect x="${x}" y="${topY}" width="${barW}" height="${barH}" rx="3" fill="url(#${uid}-grad)" filter="url(#${uid}-shadow)" />
      <text x="${cx}" y="${topY - 4}" text-anchor="middle" font-size="7" font-weight="700" fill="${COLORS.teal}">${s.expectedPayout_pct.toFixed(1)}%</text>
      <text x="${cx}" y="${baseY + 14}" text-anchor="middle" font-size="8" font-weight="600" fill="${COLORS.gray500}">Yr ${s.year}</text>
    `;
  }).join('');

  // Gridlines
  const gridSteps = 3;
  const gridSvg = Array.from({ length: gridSteps + 1 }, (_, i) => {
    const val = (i / gridSteps) * maxVal;
    const gy = scaleY(val);
    return `
      <line x1="${padL}" y1="${gy}" x2="${w - padR}" y2="${gy}" stroke="${COLORS.gray100}" stroke-width="0.5" />
      <text x="${padL - 4}" y="${gy + 3}" text-anchor="end" font-size="7" fill="${COLORS.gray300}">${val.toFixed(0)}%</text>
    `;
  }).join('');

  return `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="${uid}-grad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${COLORS.teal}" />
          <stop offset="100%" stop-color="${COLORS.cyan}" />
        </linearGradient>
        <filter id="${uid}-shadow" x="-4%" y="-4%" width="108%" height="112%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.08" />
        </filter>
      </defs>
      <line x1="${padL}" y1="${baseY}" x2="${w - padR}" y2="${baseY}" stroke="${COLORS.gray200}" stroke-width="1" />
      ${gridSvg}
      ${bars}
    </svg>
  `;
}

// ---------------------------------------------------------------------------
// 3. Milestone table
// ---------------------------------------------------------------------------

function renderMilestoneTable(
  milestones: MilestoneEntry[],
  category: Category,
  totalDealValue_pct: number,
): string {
  if (milestones.length === 0) return '';

  const { fill, label } = CAT_COLORS[category];

  const rows = milestones.map(m => {
    const expectedValue = m.probability * m.typicalValue_pct;
    const probColor = m.probability >= 0.7 ? COLORS.green : m.probability >= 0.4 ? COLORS.amber : COLORS.rose;
    return `
      <tr>
        <td style="font-weight: 500;">${escapeHtml(m.event)}</td>
        <td style="text-align: right; font-weight: 700; color: ${probColor};">${formatPercent(m.probability * 100, 1)}</td>
        <td style="text-align: right; color: ${COLORS.gray600};">${m.typicalTiming_years.toFixed(1)}</td>
        <td style="text-align: right; color: ${COLORS.gray600};">${formatPercent(m.typicalValue_pct, 1)}</td>
        <td style="text-align: right; font-weight: 700; color: ${COLORS.navy};">${formatPercent(expectedValue, 1)}</td>
      </tr>
    `;
  }).join('');

  const categoryExpected = milestones.reduce((sum, m) => sum + m.probability * m.typicalValue_pct, 0);

  return `
    <div style="margin-bottom: 10px;">
      <div style="font-size: 8px; font-weight: 800; color: ${fill}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 4px; padding-left: 2px;">${label} Milestones</div>
      <table class="data-table">
        <thead>
          <tr>
            <th>Event</th>
            <th style="text-align: right;">Probability</th>
            <th style="text-align: right;">Timing (Yr)</th>
            <th style="text-align: right;">Value (% TDV)</th>
            <th style="text-align: right;">Expected Value</th>
          </tr>
        </thead>
        <tbody>
          ${rows}
          <tr style="background: ${COLORS.gray50}; border-top: 2px solid ${COLORS.navy};">
            <td style="font-weight: 700;">Subtotal</td>
            <td></td>
            <td></td>
            <td style="text-align: right; font-weight: 700; color: ${COLORS.gray600};">${formatPercent(milestones.reduce((s, m) => s + m.typicalValue_pct, 0), 1)}</td>
            <td style="text-align: right; font-weight: 700; color: ${fill};">${formatPercent(categoryExpected, 1)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function renderMilestonePage(data: PDFReportData, meta: ReportMeta): string {
  if (!data.milestoneProbabilities) return '';

  const mp = data.milestoneProbabilities;

  // Build Gantt rows sorted by timing
  const toRows = (entries: MilestoneEntry[], cat: Category): TimelineRow[] =>
    entries.map(e => ({ event: e.event, timing: e.typicalTiming_years, probability: e.probability, category: cat }));

  const timelineRows: TimelineRow[] = [
    ...toRows(mp.developmentMilestones, 'dev'),
    ...toRows(mp.commercialMilestones, 'comm'),
    ...toRows(mp.regulatoryMilestones, 'reg'),
  ].sort((a, b) => a.timing - b.timing);

  const totalNominal = [
    ...mp.developmentMilestones,
    ...mp.commercialMilestones,
    ...mp.regulatoryMilestones,
  ].reduce((s, m) => s + m.typicalValue_pct, 0);

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, 'Deal Valuation Report')}

      <div class="section-title-lg">Milestone Probability Analysis</div>

      <!-- Gantt Timeline -->
      <div class="section-title">Milestone Timeline</div>
      <div class="card" style="padding: 12px 16px; margin-bottom: 14px; border-top: 3px solid ${COLORS.navy};">
        <div class="chart-container">
          ${renderGanttTimeline(timelineRows)}
        </div>
        <div style="display: flex; justify-content: center; gap: 20px; margin-top: 4px;">
          ${Object.values(CAT_COLORS).map(c => `
            <div style="display: flex; align-items: center; gap: 4px;">
              <span style="width: 8px; height: 8px; border-radius: 2px; background: ${c.fill};"></span>
              <span style="font-size: 8px; color: ${COLORS.gray400}; font-weight: 600;">${c.label}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Milestone Tables -->
      <div class="section-title">Milestone Detail</div>
      <div class="card" style="padding: 10px 14px; margin-bottom: 14px; border-top: 3px solid ${COLORS.navy};">
        ${renderMilestoneTable(mp.developmentMilestones, 'dev', totalNominal)}
        ${renderMilestoneTable(mp.commercialMilestones, 'comm', totalNominal)}
        ${renderMilestoneTable(mp.regulatoryMilestones, 'reg', totalNominal)}
      </div>

      <!-- Probability-Weighted Total Value Callout -->
      <div style="background: linear-gradient(145deg, ${COLORS.navy} 0%, #252a5e 100%); border-radius: 6px; padding: 18px 24px; color: white; margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 7px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.16em; font-weight: 700; margin-bottom: 4px;">Probability-Weighted Total Value</div>
            <div style="font-size: 9px; color: rgba(255,255,255,0.55); line-height: 1.5;">
              Sum of (milestone probability &times; milestone value as % TDV) across all ${timelineRows.length} milestones
            </div>
          </div>
          <div style="text-align: right; flex-shrink: 0;">
            <div style="font-size: 32px; font-weight: 800; color: ${COLORS.tealMid}; letter-spacing: -0.03em; line-height: 1;">${formatPercent(mp.probabilityWeightedTotalValue, 1)}</div>
            <div style="font-size: 8px; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 0.1em; margin-top: 4px;">of Total Deal Value</div>
          </div>
        </div>
      </div>

      <!-- Payout Schedule -->
      <div class="section-title">Expected Payout Schedule</div>
      <div class="card" style="padding: 12px 16px; margin-bottom: 14px; border-top: 3px solid ${COLORS.navy};">
        <div class="chart-container">
          ${renderPayoutChart(mp.expectedPayoutSchedule)}
        </div>
      </div>

      <!-- Narrative -->
      <div class="callout">
        ${escapeHtml(mp.narrative)}
      </div>

      <!-- Methodology note -->
      <div style="margin-top: 10px; font-size: 8px; color: ${COLORS.gray400}; line-height: 1.6;">
        <strong>Methodology:</strong> Milestone probabilities derived from BIO/QLS phase transition tables (2021-2024) with cascading conditional logic. Commercial milestones conditional on FDA approval. Timing calibrated to DealForma pharmaceutical licensing database (n=1,200+). Value allocations benchmarked to EvaluatePharma deal structure analysis (2020-2026). Bar opacity reflects probability of achievement.
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
