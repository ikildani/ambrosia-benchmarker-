// Page 2: Table of Contents
// Clean dotted-leader TOC listing all report sections with page numbers

import { pageHeader, pageFooter, COLORS } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';

export function renderTableOfContents(data: PDFReportData, meta: ReportMeta): string {
  const indication = data.result.labels.indication || data.inputs.indication;
  const entries = meta.tocEntries;

  // Highlight key analytical sections
  const highlightTitles = new Set(['Executive Dashboard', 'Sensitivity Analysis', 'Risk Analysis', 'Deal Timeline']);

  const tocRows = entries.map((entry, i) => {
    const isHighlight = highlightTitles.has(entry.title);
    return `
    <div style="display: flex; align-items: center; margin-bottom: 3px; padding: 7px 12px; border-radius: 4px; ${isHighlight ? `background: ${COLORS.gray50};` : ''}">
      <div style="width: 28px; height: 28px; border-radius: 4px; background: ${i === 0 ? COLORS.navy : COLORS.gray100}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-right: 12px;">
        <span style="font-size: 10px; font-weight: 800; color: ${i === 0 ? '#fff' : COLORS.teal};">${entry.page}</span>
      </div>
      <div style="flex: 1; min-width: 0;">
        <div style="font-size: 11px; font-weight: 700; color: ${COLORS.navy}; margin-bottom: 1px;">${entry.title}</div>
        <div style="font-size: 9px; color: ${COLORS.gray400}; line-height: 1.4;">${entry.description}</div>
      </div>
      <div style="flex: 1; border-bottom: 1px dotted ${COLORS.gray200}; margin: 0 12px; min-width: 20px;"></div>
      <div style="font-size: 11px; font-weight: 800; color: ${COLORS.teal}; flex-shrink: 0;">p. ${entry.page}</div>
    </div>`;
  }).join('');

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, 'Deal Valuation Report')}

      <div class="section-title-lg">Table of Contents</div>

      <p style="font-size: 11px; color: ${COLORS.gray500}; line-height: 1.6; margin-bottom: 28px;">
        This report provides a comprehensive deal valuation analysis for
        <strong style="color: ${COLORS.navy};">${indication}</strong>,
        including quantitative benchmarks, sensitivity modeling, comparable transactions,
        partner intelligence, and strategic insights. Each section is designed
        to support data-driven licensing negotiations.
      </p>

      <hr class="divider-thick" style="margin-bottom: 24px;">

      <div style="padding: 0 8px;">
        ${tocRows}
      </div>

      <hr class="divider-thick" style="margin-top: 10px;">

      <!-- Report metadata callout -->
      <div class="card" style="margin-top: 24px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 8px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 3px;">Report Details</div>
          <div style="font-size: 11px; color: ${COLORS.gray700};">
            ${meta.pageCount} pages &middot; Version ${meta.version} &middot; Generated ${meta.generatedAt}
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 8px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 3px;">Report ID</div>
          <div style="font-size: 11px; font-weight: 600; color: ${COLORS.teal};">${meta.reportId}</div>
        </div>
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
