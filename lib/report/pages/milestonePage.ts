// Page: Milestone Probability Analysis
// Gantt-style SVG timeline, milestone tables, probability-weighted total callout,
// payout schedule bar chart, and narrative block. The section is packed across
// as many physical A4 pages as the milestone count needs (typically 2–3): a
// deal with ~30 milestones produces a ~2,600px column that cannot fit one page.

import { formatPercent, pageHeader, pageFooter, COLORS, escapeHtml, BRIEF_TITLE } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';
import type { MilestoneEntry, AnnualPayout, MilestoneProbabilityResult } from '@/lib/financial/milestone-probability';

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

const GANTT_PAD_TOP = 28;
const GANTT_PAD_BOTTOM = 32;

function renderGanttTimeline(rows: TimelineRow[], rowH: number): string {
  if (rows.length === 0) {
    return `<svg width="520" height="60" viewBox="0 0 520 60" xmlns="http://www.w3.org/2000/svg">
      <text x="260" y="30" text-anchor="middle" font-size="11" fill="${COLORS.gray400}">No milestone data</text>
    </svg>`;
  }

  const w = 520;
  const labelW = 140;
  const padR = 16;
  const padTop = GANTT_PAD_TOP;
  const chartW = w - labelW - padR;
  const h = padTop + rows.length * rowH + GANTT_PAD_BOTTOM;

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
    const barY = y + 3;
    const barH = rowH - 6;
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
// 3. Milestone table (one chunk of a category; a category split across pages
//    carries its subtotal only on its last chunk)
// ---------------------------------------------------------------------------

interface TableChunk {
  category: Category;
  rows: MilestoneEntry[];
  /** All milestones of the category — the subtotal sums the whole category. */
  all: MilestoneEntry[];
  continued: boolean;
  withSubtotal: boolean;
}

function renderMilestoneTableChunk(chunk: TableChunk): string {
  const { fill, label } = CAT_COLORS[chunk.category];

  const rows = chunk.rows.map(m => {
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

  const categoryExpected = chunk.all.reduce((sum, m) => sum + m.probability * m.typicalValue_pct, 0);
  const categoryNominal = chunk.all.reduce((s, m) => s + m.typicalValue_pct, 0);

  return `
    <div style="margin-bottom: 10px;">
      <div style="font-size: 8px; font-weight: 800; color: ${fill}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 4px; padding-left: 2px;">${label} Milestones${chunk.continued ? ' (continued)' : ''}</div>
      <table class="data-table compact">
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
          ${chunk.withSubtotal ? `
          <tr style="background: ${COLORS.gray50}; border-top: 2px solid ${COLORS.navy};">
            <td style="font-weight: 700;">Subtotal</td>
            <td></td>
            <td></td>
            <td style="text-align: right; font-weight: 700; color: ${COLORS.gray600};">${formatPercent(categoryNominal, 1)}</td>
            <td style="text-align: right; font-weight: 700; color: ${fill};">${formatPercent(categoryExpected, 1)}</td>
          </tr>` : ''}
        </tbody>
      </table>
    </div>
  `;
}

// ---------------------------------------------------------------------------
// 4. Page layout — pack blocks into physical A4 pages by estimated height
// ---------------------------------------------------------------------------

/** Usable px below the page title (A4 content 1031 − header 56 − title 39 ≈ 936), kept conservative. */
const PAGE_BUDGET = 900;
const SECTION_TITLE_H = 32;                       // .section-title 22 + 10 margin
const ROW_H = 26;                                 // .data-table.compact row
const SUBTOTAL_H = 26;
const TABLE_CHUNK_OVERHEAD = 20 + 30 + 10;        // category label + thead + margin
const TABLE_CARD_OVERHEAD = SECTION_TITLE_H + 20 + 14; // section title + card padding + margin
const CALLOUT_H = 84 + 14;
const PAYOUT_H = SECTION_TITLE_H + 24 + 120 + 12 + 14;
const METHODOLOGY_H = 10 + 40;
const GANTT_ROW_H = 18;

interface PageLayout {
  gantt: boolean;
  callout: boolean;
  tables: TableChunk[];
  payout: boolean;
  narrative: boolean;
  methodology: boolean;
  used: number;
}

interface MilestoneLayout {
  pages: PageLayout[];
  ganttRowH: number;
  timelineRows: TimelineRow[];
}

const newPage = (): PageLayout => ({ gantt: false, callout: false, tables: [], payout: false, narrative: false, methodology: false, used: 0 });
const isEmpty = (p: PageLayout) => !p.gantt && !p.callout && p.tables.length === 0 && !p.payout && !p.narrative && !p.methodology;

export function layoutMilestonePages(mp: MilestoneProbabilityResult): MilestoneLayout {
  const toRows = (entries: MilestoneEntry[], cat: Category): TimelineRow[] =>
    entries.map(e => ({ event: e.event, timing: e.typicalTiming_years, probability: e.probability, category: cat }));
  const timelineRows: TimelineRow[] = [
    ...toRows(mp.developmentMilestones, 'dev'),
    ...toRows(mp.commercialMilestones, 'comm'),
    ...toRows(mp.regulatoryMilestones, 'reg'),
  ].sort((a, b) => a.timing - b.timing);

  // Gantt: shrink the row pitch only if the chart alone would not fit a page.
  const ganttFixed = SECTION_TITLE_H + 24 + 12 + 20 + 14 + GANTT_PAD_TOP + GANTT_PAD_BOTTOM;
  let ganttRowH = GANTT_ROW_H;
  if (timelineRows.length > 0 && ganttFixed + timelineRows.length * ganttRowH > PAGE_BUDGET) {
    ganttRowH = Math.max(10, Math.floor((PAGE_BUDGET - ganttFixed) / timelineRows.length));
  }
  const ganttEst = ganttFixed + Math.max(timelineRows.length * ganttRowH, 60);

  const pages: PageLayout[] = [];
  let cur = newPage();
  const ensure = (h: number) => {
    if (!isEmpty(cur) && cur.used + h > PAGE_BUDGET) { pages.push(cur); cur = newPage(); }
  };

  ensure(ganttEst); cur.gantt = true; cur.used += ganttEst;
  ensure(CALLOUT_H); cur.callout = true; cur.used += CALLOUT_H;

  const categories: Array<[Category, MilestoneEntry[]]> = [
    ['dev', mp.developmentMilestones],
    ['comm', mp.commercialMilestones],
    ['reg', mp.regulatoryMilestones],
  ];
  for (const [category, all] of categories) {
    let i = 0;
    let first = true;
    while (i < all.length) {
      const remaining = all.length - i;
      const cardOverhead = cur.tables.length ? 0 : TABLE_CARD_OVERHEAD;
      const avail = PAGE_BUDGET - cur.used - cardOverhead - TABLE_CHUNK_OVERHEAD - SUBTOTAL_H;
      const fit = Math.floor(avail / ROW_H);
      if (fit < Math.min(3, remaining) && !isEmpty(cur)) { pages.push(cur); cur = newPage(); continue; }
      const take = Math.max(1, Math.min(fit, remaining));
      const withSubtotal = i + take === all.length;
      cur.tables.push({ category, rows: all.slice(i, i + take), all, continued: !first, withSubtotal });
      cur.used += cardOverhead + TABLE_CHUNK_OVERHEAD + take * ROW_H + (withSubtotal ? SUBTOTAL_H : 0);
      i += take;
      first = false;
    }
  }

  ensure(PAYOUT_H); cur.payout = true; cur.used += PAYOUT_H;
  const narrativeH = 24 + 16 * Math.max(1, Math.ceil(mp.narrative.length / 110));
  ensure(narrativeH); cur.narrative = true; cur.used += narrativeH;
  ensure(METHODOLOGY_H); cur.methodology = true; cur.used += METHODOLOGY_H;
  pages.push(cur);

  return { pages, ganttRowH, timelineRows };
}

/** Number of physical pages the milestone section produces (0 when the engine did not run). */
export function countMilestonePages(data: PDFReportData): number {
  if (!data.milestoneProbabilities) return 0;
  return layoutMilestonePages(data.milestoneProbabilities).pages.length;
}

// ---------------------------------------------------------------------------
// 5. Render
// ---------------------------------------------------------------------------

function renderPage(mp: MilestoneProbabilityResult, layout: MilestoneLayout, page: PageLayout, index: number, meta: ReportMeta): string {
  const continued = index > 0;
  const title = `Milestone Probability Analysis${continued ? ` <span style="font-size: 11px; font-weight: 600; color: ${COLORS.gray400};">(continued)</span>` : ''}`;
  const tablesContinued = page.tables.length > 0 && page.tables[0].continued;

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage + index, meta.pageCount, BRIEF_TITLE)}

      <div class="section-title-lg">${title}</div>

      ${page.gantt ? `
      <!-- Gantt Timeline -->
      <div class="section-title">Milestone Timeline</div>
      <div class="card" style="padding: 12px 16px; margin-bottom: 14px; border-top: 3px solid ${COLORS.navy};">
        <div class="chart-container">
          ${renderGanttTimeline(layout.timelineRows, layout.ganttRowH)}
        </div>
        <div style="display: flex; justify-content: center; gap: 20px; margin-top: 4px;">
          ${Object.values(CAT_COLORS).map(c => `
            <div style="display: flex; align-items: center; gap: 4px;">
              <span style="width: 8px; height: 8px; border-radius: 2px; background: ${c.fill};"></span>
              <span style="font-size: 8px; color: ${COLORS.gray400}; font-weight: 600;">${c.label}</span>
            </div>
          `).join('')}
        </div>
      </div>` : ''}

      ${page.callout ? `
      <!-- Probability-Weighted Total Value Callout -->
      <div style="background: linear-gradient(145deg, ${COLORS.navy} 0%, #252a5e 100%); border-radius: 6px; padding: 18px 24px; color: white; margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 7px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.16em; font-weight: 700; margin-bottom: 4px;">Probability-Weighted Total Value</div>
            <div style="font-size: 9px; color: rgba(255,255,255,0.55); line-height: 1.5;">
              Sum of (milestone probability &times; milestone value as % TDV) across all ${layout.timelineRows.length} milestones
            </div>
          </div>
          <div style="text-align: right; flex-shrink: 0;">
            <div style="font-size: 32px; font-weight: 800; color: ${COLORS.tealMid}; letter-spacing: -0.03em; line-height: 1;">${formatPercent(mp.probabilityWeightedTotalValue, 1)}</div>
            <div style="font-size: 8px; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 0.1em; margin-top: 4px;">of Total Deal Value</div>
          </div>
        </div>
      </div>` : ''}

      ${page.tables.length > 0 ? `
      <!-- Milestone Tables -->
      <div class="section-title">Milestone Detail${tablesContinued ? ' (continued)' : ''}</div>
      <div class="card" style="padding: 10px 14px; margin-bottom: 14px; border-top: 3px solid ${COLORS.navy};">
        ${page.tables.map(renderMilestoneTableChunk).join('')}
      </div>` : ''}

      ${page.payout ? `
      <!-- Payout Schedule -->
      <div class="section-title">Expected Payout Schedule</div>
      <div class="card" style="padding: 12px 16px; margin-bottom: 14px; border-top: 3px solid ${COLORS.navy};">
        <div class="chart-container">
          ${renderPayoutChart(mp.expectedPayoutSchedule)}
        </div>
      </div>` : ''}

      ${page.narrative ? `
      <!-- Narrative -->
      <div class="callout">
        ${escapeHtml(mp.narrative)}
      </div>` : ''}

      ${page.methodology ? `
      <!-- Methodology note -->
      <div style="margin-top: 10px; font-size: 8px; color: ${COLORS.gray400}; line-height: 1.6;">
        <strong>Methodology:</strong> Milestone probabilities derived from BIO/QLS phase transition tables (2021-2024) with cascading conditional logic. Commercial milestones conditional on FDA approval. Timing calibrated to DealForma pharmaceutical licensing database (n=1,200+). Value allocations benchmarked to EvaluatePharma deal structure analysis (2020-2026). Bar opacity reflects probability of achievement.
      </div>` : ''}

      ${pageFooter(meta.reportId)}
    </div>
  `;
}

/** Multi-page renderer: one `.report-page` per physical page, numbered from meta.currentPage. */
export function renderMilestonePages(data: PDFReportData, meta: ReportMeta): string[] {
  if (!data.milestoneProbabilities) return [];
  const mp = data.milestoneProbabilities;
  const layout = layoutMilestonePages(mp);
  return layout.pages.map((page, i) => renderPage(mp, layout, page, i, meta));
}

/** Legacy single-string entry point — joins the physical pages. Prefer renderMilestonePages. */
export function renderMilestonePage(data: PDFReportData, meta: ReportMeta): string {
  return renderMilestonePages(data, meta).join('\n');
}
