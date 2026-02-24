// Report Orchestrator — assembles all pages into a print-ready HTML document

import { getReportStyles } from './styles';
import { getEmbeddedFontStyles } from './fonts';
import { generateReportId, formatDate } from './helpers';
import { renderCoverPage } from './pages/cover';
import { renderTableOfContents } from './pages/tableOfContents';
import { renderExecutiveDashboard } from './pages/executiveDashboard';
import { renderDealStructurePage } from './pages/dealStructure';
import { renderDealTermsPage } from './pages/dealTerms';
import { renderSensitivityPage } from './pages/sensitivity';
import { renderComparablesPage } from './pages/comparables';
import { renderPartnersPage } from './pages/partners';
import { renderAIMemoPage } from './pages/aiMemo';
import { renderRiskAnalysisPage } from './pages/riskAnalysis';
import { renderDealTimelinePage } from './pages/dealTimeline';
import { renderNegotiationPage } from './pages/negotiation';
import { renderTherapeuticIntelPage } from './pages/therapeuticIntel';
import { renderMethodologyPage } from './pages/methodology';
import type { PDFReportData, ReportMeta, TocEntry } from './types';

export type { PDFReportData, PartnerForPDF } from './types';

/** Returns the full HTML document string for the report with styles.
 *  Pages without data (AI memo, playbook) are excluded — no placeholders. */
export function generateReportHTML(data: PDFReportData): string {
  const indication = data.result.labels.indication || data.inputs.indication;

  // Build pages dynamically — exclude sections with no data
  const pages: string[] = [];

  // Conditionally included AI pages
  const hasAIMemo = !!(data.memoData || data.playbookData);
  const hasPlaybook = !!data.playbookData;

  // Build TOC entries with correct page numbers
  const tocEntries: TocEntry[] = [];
  let pageNum = 0;
  const toc = (title: string, description: string) => { pageNum++; tocEntries.push({ title, page: pageNum, description }); };
  toc('Cover Page', 'Asset overview, headline valuation, and risk score');
  toc('Table of Contents', 'Report navigation and section guide');
  toc('Executive Dashboard', 'Key metrics, value split, and deal recommendation');
  toc('Deal Structure', 'Payment architecture and milestone waterfall');
  toc('Deal Terms', 'Detailed term ranges, royalties, and modifiers');
  toc('Sensitivity Analysis', 'Parameter impact, tornado chart, and value drivers');
  toc('Comparable Deals', 'Recent transactions and market benchmarks');
  toc('Partner Matches', 'Top-ranked potential licensing partners');
  if (hasAIMemo) toc('AI Deal Memo', 'AI-generated strategic narrative and playbook');
  if (hasPlaybook) toc('Negotiation Strategy', 'AI-powered negotiation playbook and tactics');
  toc('Risk Analysis', 'Risk factor breakdown and probability-weighted valuation');
  toc('Deal Timeline', 'Gantt-style milestone schedule from signing to launch');
  toc('Therapeutic Intelligence', 'Indication-specific market context and trends');
  toc('Methodology', 'Model design, data sources, and disclaimer');

  const totalPages = pageNum;

  const meta: ReportMeta = {
    reportId: generateReportId(),
    generatedAt: formatDate(),
    version: '2.0',
    pageCount: totalPages,
    currentPage: 0,
    tocEntries,
  };

  // Helper to render a page with auto-incrementing page number
  const addPage = (renderer: (d: PDFReportData, m: ReportMeta) => string) => {
    meta.currentPage++;
    pages.push(renderer(data, meta));
  };

  // Core pages (always included)
  addPage(renderCoverPage);
  addPage(renderTableOfContents);
  addPage(renderExecutiveDashboard);
  addPage(renderDealStructurePage);
  addPage(renderDealTermsPage);
  addPage(renderSensitivityPage);
  addPage(renderComparablesPage);
  addPage(renderPartnersPage);
  // AI pages — only if data exists
  if (hasAIMemo) addPage(renderAIMemoPage);
  if (hasPlaybook) addPage(renderNegotiationPage);
  // Post-AI pages (always included)
  addPage(renderRiskAnalysisPage);
  addPage(renderDealTimelinePage);
  addPage(renderTherapeuticIntelPage);
  addPage(renderMethodologyPage);

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${indication} — Deal Valuation Report | Ambrosia Ventures</title>
      <style>${getEmbeddedFontStyles()}${getReportStyles()}</style>
    </head>
    <body>
      ${pages.join('\n')}
    </body>
    </html>
  `;
}

/** Opens a new window with the report HTML and triggers print dialog. */
export function generatePDFReport(data: PDFReportData): void {
  const html = generateReportHTML(data);

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    // Fallback: render inline via blob URL (avoids popup blocker)
    const blob = new Blob([html], { type: 'text/html' });
    const url = URL.createObjectURL(blob);
    const iframe = document.createElement('iframe');
    iframe.style.display = 'none';
    iframe.src = url;
    iframe.onload = () => {
      iframe.contentWindow?.print();
      setTimeout(() => { document.body.removeChild(iframe); URL.revokeObjectURL(url); }, 1000);
    };
    document.body.appendChild(iframe);
    return;
  }

  printWindow.document.write(html);
  printWindow.document.close();

  printWindow.onload = () => {
    setTimeout(() => {
      printWindow.print();
    }, 500);
  };
}

export { generateExecutiveSummaryHTML, generateExecutiveSummaryPDF } from './executiveSummary';
