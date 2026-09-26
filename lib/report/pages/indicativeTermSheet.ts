// Indicative term sheet: the one page the CEO carries into the room. Reads
// brief.indicativeTermSheet; never recomputes a number.

import { pageHeader, pageFooter, sectionHead, microLabel, escapeHtml, emptyState, COLORS, BRIEF_TITLE, fmtM } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';

export function renderIndicativeTermSheetPage(data: PDFReportData, meta: ReportMeta): string {
  const ts = data.brief?.indicativeTermSheet ?? null;
  const head = sectionHead('Indicative term sheet', 'The opening positions consistent with the decision, and where we would stop.');

  if (!ts) {
    return `
      <div class="report-page">
        ${pageHeader(meta.currentPage, meta.pageCount, BRIEF_TITLE)}
        ${head}
        ${emptyState('No term sheet built', 'The indicative term sheet is generated from the decision on page three. No decision was built for this run, so there are no positions to print.')}
        ${pageFooter(meta.reportId)}
      </div>
    `;
  }

  const rows = ts.lines.map(l => `
    <tr>
      <td style="padding: 5px 8px; font-weight: 700; white-space: nowrap; color: ${COLORS.navy};">${escapeHtml(l.term)}</td>
      <td style="padding: 5px 8px; font-weight: 600;">${escapeHtml(l.position)}</td>
      <td style="padding: 5px 8px; color: ${COLORS.gray600};">${l.floor ? escapeHtml(l.floor) : '—'}</td>
      <td style="padding: 5px 8px; color: ${COLORS.gray500}; font-size: 8px; line-height: 1.4;">${escapeHtml(l.basis)}</td>
    </tr>`).join('');

  const total = ts.milestones.reduce((s, m) => s + m.amountM, 0);
  const schedule = ts.milestones.map(m => `
    <div style="display: flex; align-items: center; gap: 8px; font-size: 8.5px; margin: 2px 0;">
      <span style="width: 190px; color: ${COLORS.gray700};">${escapeHtml(m.event)}</span>
      <span style="flex: 1; height: 7px; background: ${COLORS.gray100}; border-radius: 4px; overflow: hidden;"><span style="display: block; width: ${Math.round(m.shareOfMilestones * 100)}%; height: 100%; background: ${COLORS.teal};"></span></span>
      <span style="width: 60px; text-align: right; font-weight: 700;">${fmtM(m.amountM)}</span>
      <span style="width: 34px; text-align: right; color: ${COLORS.gray500};">${Math.round(m.shareOfMilestones * 100)}%</span>
    </div>`).join('');

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, BRIEF_TITLE)}
      ${head}
      <div style="font-size: 11px; font-weight: 800; color: ${COLORS.navy}; margin-bottom: 2px;">${escapeHtml(ts.headline)}</div>
      <div style="font-size: 9px; color: ${COLORS.gray600}; margin-bottom: 8px;">${escapeHtml(ts.structure)}${ts.counterparties.length ? ` · for discussion with ${escapeHtml(ts.counterparties.slice(0, 5).join(', '))}` : ''}</div>
      <table style="width: 100%; border-collapse: collapse; font-size: 9px;">
        <thead>
          <tr style="background: ${COLORS.gray100}; color: ${COLORS.gray600}; font-size: 8px; text-transform: uppercase; letter-spacing: 0.04em;">
            <th style="padding: 5px 8px; text-align: left;">Term</th>
            <th style="padding: 5px 8px; text-align: left;">Opening position</th>
            <th style="padding: 5px 8px; text-align: left;">Floor</th>
            <th style="padding: 5px 8px; text-align: left;">Basis</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top: 10px;">
        ${microLabel(`Milestone schedule · ${fmtM(total)} in aggregate`)}
        <div style="margin-top: 4px;">${schedule}</div>
      </div>
      <div class="callout" style="margin-top: 10px; padding: 8px 14px;">
        <div style="font-size: 9px; line-height: 1.5;">${ts.notes.map(n => escapeHtml(n)).join(' ')}</div>
      </div>
      ${pageFooter(meta.reportId)}
    </div>
  `;
}
