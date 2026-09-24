// Page: Positioning and objections — how to tell the story, and what they will push back on.
// Labelled "Strategic analysis"; the model name is never printed.

import { pageHeader, pageFooter, sectionHead, emptyState, escapeHtml, COLORS, BRIEF_TITLE, formatShortDate } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';

export function renderPositioningObjectionsPage(data: PDFReportData, meta: ReportMeta): string {
  const po = data.brief?.positioning;
  const head = sectionHead('Positioning and objections', 'How to tell the story, and what they will push back on.');

  if (!po || po.positioning.length === 0 || po.objections.length === 0) {
    return `
      <div class="report-page">
        ${pageHeader(meta.currentPage, meta.pageCount, BRIEF_TITLE)}
        ${head}
        ${emptyState('Positioning not yet written', 'The positioning and objection set is written from the decision summary. The decision summary was not available for this run.')}
        ${pageFooter(meta.reportId)}
      </div>
    `;
  }

  const rows = po.objections.slice(0, 5).map((o, i) => `
    <tr>
      <td style="vertical-align: top; width: 26%;"><span style="display: inline-block; min-width: 14px; font-weight: 800; color: ${COLORS.rose};">${i + 1}.</span> <span style="font-weight: 700; color: ${COLORS.navy};">${escapeHtml(o.objection)}</span></td>
      <td style="vertical-align: top; width: 46%; line-height: 1.5;">${escapeHtml(o.answer)}</td>
      <td style="vertical-align: top; width: 28%; color: ${COLORS.gray600}; line-height: 1.45;">${escapeHtml(o.evidenceToPrepare)}</td>
    </tr>`).join('');

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, BRIEF_TITLE)}
      ${head}

      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <div class="section-title" style="margin-bottom: 0; border-bottom: none; padding-bottom: 0;">Strategic analysis</div>
        <span style="font-size: 7.5px; color: ${COLORS.gray400};">written ${escapeHtml(formatShortDate(new Date(po.generatedAt)))}</span>
      </div>

      <div class="card-highlight" style="margin-bottom: 14px;">
        <div style="font-size: 7px; font-weight: 700; color: ${COLORS.teal}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 6px;">How to position it</div>
        ${po.positioning.slice(0, 2).map(p => `<p style="font-size: 10px; color: ${COLORS.gray800}; line-height: 1.65; margin-bottom: 8px;">${escapeHtml(p)}</p>`).join('')}
      </div>

      <div class="section-title">What they will push back on</div>
      <table class="data-table" style="font-size: 9px;">
        <thead>
          <tr><th>Objection</th><th>Answer</th><th>Evidence to prepare</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
