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

  const tocRows = TOC_ENTRIES.map(entry => `
    <div style="display: flex; align-items: baseline; margin-bottom: 10px;">
      <div style="font-size: 11px; font-weight: 600; color: ${COLORS.navy}; white-space: nowrap;">${entry.title}</div>
      <div style="flex: 1; border-bottom: 1.5px dotted ${COLORS.gray300}; margin: 0 8px; min-width: 20px; position: relative; top: -3px;"></div>
      <div style="font-size: 11px; font-weight: 700; color: ${COLORS.teal}; white-space: nowrap;">${entry.page}</div>
    </div>
    <div style="font-size: 9px; color: ${COLORS.gray500}; margin-top: -6px; margin-bottom: 14px; padding-left: 2px;">${entry.description}</div>
  `).join('');

  return `
    <div class="report-page">
      ${pageHeader(2, meta.pageCount, 'Deal Valuation Report')}

      <div class="section-title-lg">Table of Contents</div>

      <p style="font-size: 10px; color: ${COLORS.gray500}; line-height: 1.6; margin-bottom: 24px;">
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
          <div style="font-size: 10px; color: ${COLORS.gray700};">
            ${meta.pageCount} pages &middot; Version ${meta.version} &middot; Generated ${meta.generatedAt}
          </div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 8px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 3px;">Report ID</div>
          <div style="font-size: 10px; font-weight: 600; color: ${COLORS.teal};">${meta.reportId}</div>
        </div>
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
