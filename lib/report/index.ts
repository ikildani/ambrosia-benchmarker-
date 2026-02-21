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
import type { PDFReportData, ReportMeta } from './types';

export type { PDFReportData, PartnerForPDF } from './types';

/** Returns the full HTML document string for the report with styles.
 *  Pages without data (AI memo, playbook) are excluded — no placeholders. */
export function generateReportHTML(data: PDFReportData): string {
  const indication = data.result.labels.indication || data.inputs.indication;

  // Build pages dynamically — exclude sections with no data
  const pages: string[] = [];

  // Always-included pages
  const corePagesPreAI = [
    renderCoverPage,
    // TOC placeholder — will be re-rendered with correct count below
    renderExecutiveDashboard,
    renderDealStructurePage,
    renderDealTermsPage,
    renderSensitivityPage,
    renderComparablesPage,
    renderPartnersPage,
  ];

  // Conditionally included AI pages
  const hasAIMemo = !!(data.memoData || data.playbookData);
  const hasPlaybook = !!data.playbookData;

  // Always-included post-AI pages
  const corePagesPostAI = [
    renderRiskAnalysisPage,
    renderDealTimelinePage,
    renderTherapeuticIntelPage,
    renderMethodologyPage,
  ];

  const totalPages = corePagesPreAI.length + (hasAIMemo ? 1 : 0) + (hasPlaybook ? 1 : 0) + corePagesPostAI.length + 1; // +1 for TOC

  const meta: ReportMeta = {
    reportId: generateReportId(),
    generatedAt: formatDate(),
    version: '2.0',
    pageCount: totalPages,
  };

  // Page 1: Cover
  pages.push(renderCoverPage(data, meta));
  // Page 2: TOC
  pages.push(renderTableOfContents(data, meta));
  // Pages 3-8: Core analysis
  pages.push(renderExecutiveDashboard(data, meta));
  pages.push(renderDealStructurePage(data, meta));
  pages.push(renderDealTermsPage(data, meta));
  pages.push(renderSensitivityPage(data, meta));
  pages.push(renderComparablesPage(data, meta));
  pages.push(renderPartnersPage(data, meta));
  // AI pages — only if data exists
  if (hasAIMemo) pages.push(renderAIMemoPage(data, meta));
  if (hasPlaybook) pages.push(renderNegotiationPage(data, meta));
  // Remaining pages
  pages.push(renderRiskAnalysisPage(data, meta));
  pages.push(renderDealTimelinePage(data, meta));
  pages.push(renderTherapeuticIntelPage(data, meta));
  pages.push(renderMethodologyPage(data, meta));

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

/** Legacy: opens a new window and triggers print dialog. */
export function generatePDFReport(data: PDFReportData): void {
  const html = generateReportHTML(data);

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow pop-ups to download the PDF report.');
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
