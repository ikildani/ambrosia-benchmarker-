// Brief v3 — Catalyst calendar page.
// What happens in the next 24 months that reprices this asset, and when should we go to market?

import { pageHeader, pageFooter, sectionHead, chartSource, emptyState, microLabel, escapeHtml, formatShortDate, COLORS, BRIEF_TITLE } from '../helpers';
import { renderCatalystTimeline } from '../svg-charts/catalystTimeline';
import type { PDFReportData, ReportMeta } from '../types';
import type { CatalystCalendar, CatalystEvent } from '@/lib/brief/types';

const KIND_LABEL: Record<CatalystEvent['kind'], string> = {
  readout: 'Readout', loe: 'Exclusivity', regulatory: 'Regulatory', buyer_event: 'Buyer event',
};

function directionBadge(d: CatalystEvent['direction']): string {
  if (d === 'up') return `<span class="badge badge-teal">Up</span>`;
  if (d === 'down') return `<span class="badge badge-rose">Down</span>`;
  return `<span class="badge badge-gray">Mixed</span>`;
}

function eventDate(e: CatalystEvent): string {
  if (e.kind === 'loe') return e.date.slice(0, 4);
  return formatShortDate(new Date(e.date));
}

export function renderCatalystCalendarPage(data: PDFReportData, meta: ReportMeta): string {
  const cal: CatalystCalendar | null | undefined = data.brief?.landscape?.catalysts;
  const head = sectionHead('Catalyst calendar', 'What happens in the next 24 months that reprices this asset, and when should we go to market?');

  if (!cal || cal.events.length === 0) {
    return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, BRIEF_TITLE)}
      ${head}
      ${emptyState('No dated catalysts in the window', 'No Phase 2 or Phase 3 trial in this indication has a primary completion date inside the window, and no buyer exclusivity loss falls in it. Timing is therefore driven by the asset\'s own data, not by the market.')}
      ${pageFooter(meta.reportId)}
    </div>`;
  }

  const rows = cal.events.slice(0, 14);
  const rw = cal.recommendedWindow;

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, BRIEF_TITLE)}
      ${head}

      <div class="card" style="padding: 12px 12px 8px;">
        ${microLabel(`Events in the next ${cal.windowMonths} months`)}
        <div class="chart-container" style="margin: 0;">${renderCatalystTimeline(cal, 560, 230)}</div>
        ${chartSource(cal.source)}
      </div>

      ${rw ? `
      <div class="callout" style="margin-top: 10px; padding: 9px 14px;">
        <div style="display: flex; justify-content: space-between; align-items: baseline;">
          <div style="font-size: 8px; font-weight: 700; color: ${COLORS.teal}; text-transform: uppercase; letter-spacing: 0.1em;">Recommended go-to-market window</div>
          <div style="font-size: 10px; font-weight: 800; color: ${COLORS.navy};">${escapeHtml(formatShortDate(new Date(rw.start)))} &rarr; ${escapeHtml(formatShortDate(new Date(rw.end)))}</div>
        </div>
        <div style="font-size: 9.5px; margin-top: 3px; line-height: 1.5;">${escapeHtml(rw.rationale)}</div>
      </div>` : ''}

      <div class="card" style="padding: 0; overflow: hidden; margin-top: 10px;">
        <table class="data-table" style="font-size: 8.5px;">
          <thead>
            <tr>
              <th style="width: 52px;">Date</th>
              <th>Event</th>
              <th style="width: 60px;">Kind</th>
              <th style="width: 48px;">Direction</th>
              <th style="width: 190px;">Why it matters</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(e => `
            <tr>
              <td style="white-space: nowrap; font-weight: 600; padding: 5px 8px;">${escapeHtml(eventDate(e))}</td>
              <td style="padding: 5px 8px; font-weight: ${e.isBuyerCandidate ? 800 : 500}; color: ${e.isBuyerCandidate ? COLORS.navy : COLORS.gray700};">${escapeHtml(e.title)}${e.isBuyerCandidate ? ' <span class="badge badge-navy" style="font-size: 6.5px; padding: 1px 5px;">Buyer</span>' : ''}</td>
              <td style="padding: 5px 8px;">${escapeHtml(KIND_LABEL[e.kind] ?? e.kind)}</td>
              <td style="padding: 5px 8px;">${directionBadge(e.direction)}</td>
              <td style="padding: 5px 8px; color: ${COLORS.gray600}; line-height: 1.35;">${escapeHtml(e.impact)}</td>
            </tr>`).join('')}
          </tbody>
        </table>
        ${cal.events.length > rows.length ? `<div style="font-size: 7.5px; color: ${COLORS.gray400}; padding: 4px 8px;">${cal.events.length - rows.length} further events inside the window are on the timeline above.</div>` : ''}
        ${chartSource(cal.source)}
      </div>

      ${pageFooter(meta.reportId)}
    </div>`;
}
