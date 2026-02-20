// Report Orchestrator — assembles all pages into a print-ready HTML document

import { getReportStyles } from './styles';
import { generateReportId, formatDate } from './helpers';
import { renderCoverPage } from './pages/cover';
import { renderExecutiveDashboard } from './pages/executiveDashboard';
import { renderDealStructurePage } from './pages/dealStructure';
import { renderDealTermsPage } from './pages/dealTerms';
import { renderSensitivityPage } from './pages/sensitivity';
import { renderComparablesPage } from './pages/comparables';
import { renderPartnersPage } from './pages/partners';
import { renderAIMemoPage } from './pages/aiMemo';
import { renderTherapeuticIntelPage } from './pages/therapeuticIntel';
import { renderMethodologyPage } from './pages/methodology';
import type { PDFReportData, ReportMeta } from './types';

export type { PDFReportData, PartnerForPDF } from './types';

/** Returns the full HTML document string for the report (10 pages with styles). */
export function generateReportHTML(data: PDFReportData): string {
  const meta: ReportMeta = {
    reportId: generateReportId(),
    generatedAt: formatDate(),
    version: '2.0',
    pageCount: 10,
  };

  const pages = [
    renderCoverPage(data, meta),
    renderExecutiveDashboard(data, meta),
    renderDealStructurePage(data, meta),
    renderDealTermsPage(data, meta),
    renderSensitivityPage(data, meta),
    renderComparablesPage(data, meta),
    renderPartnersPage(data, meta),
    renderAIMemoPage(data, meta),
    renderTherapeuticIntelPage(data, meta),
    renderMethodologyPage(data, meta),
  ];

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Deal Valuation Report — ${data.result.labels.indication} | Ambrosia Ventures</title>
      <style>${getReportStyles()}</style>
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
