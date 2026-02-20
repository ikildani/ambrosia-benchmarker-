// Page 2: Table of Contents
// Clean dotted-leader TOC listing all report sections with page numbers

import { pageHeader, pageFooter, COLORS } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';

const TOC_ENTRIES: { title: string; page: number; description: string }[] = [
  { title: 'Cover Page', page: 1, description: 'Asset overview, headline valuation, and risk score' },
  { title: 'Table of Contents', page: 2, description: 'Report navigation and section guide' },
  { title: 'Executive Dashboard', page: 3, description: 'Key metrics, value split, and deal recommendation' },
  { title: 'Deal Structure', page: 4, description: 'Payment architecture and milestone waterfall' },
  { title: 'Deal Terms', page: 5, description: 'Detailed term ranges, royalties, and modifiers' },
  { title: 'Sensitivity Analysis', page: 6, description: 'Parameter impact, tornado chart, and value drivers' },
  { title: 'Comparable Deals', page: 7, description: 'Recent transactions and market benchmarks' },
  { title: 'Partner Matches', page: 8, description: 'Top-ranked potential licensing partners' },
  { title: 'AI Deal Memo', page: 9, description: 'AI-generated strategic narrative and playbook' },
  { title: 'Risk Analysis', page: 10, description: 'Risk factor breakdown and probability-weighted valuation' },
  { title: 'Deal Timeline', page: 11, description: 'Gantt-style milestone schedule from signing to launch' },
  { title: 'Negotiation Strategy', page: 12, description: 'AI-powered negotiation playbook and tactics' },
  { title: 'Therapeutic Intelligence', page: 13, description: 'Indication-specific market context and trends' },
  { title: 'Methodology', page: 14, description: 'Model design, data sources, and disclaimer' },
];

export function renderTableOfContents(data: PDFReportData, meta: ReportMeta): string {
  const indication = data.result.labels.indication || data.inputs.indication;

  const tocRows = TOC_ENTRIES.map((entry, i) => {
    // Visual grouping: highlight key sections
    const isHighlight = [3, 6, 9, 10].includes(entry.page); // Executive, Sensitivity, Risk, Timeline
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
      ${pageHeader(2, meta.pageCount, 'Deal Valuation Report')}

      <div class="section-title-lg">Table of Contents</div>

      <p style="font-size: 11px; color: ${COLORS.gray500}; line-height: 1.6; margin-bottom: 28px;">
        This report provides a comprehensive deal valuation analysis for
        <strong style="color: ${COLORS.navy};">${indication}</strong>,
        including quantitative benchmarks, sensitivity modeling, comparable transactions,
        partner intelligence, and AI-generated strategic insights. Each section is designed
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
