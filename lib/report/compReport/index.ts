import { getReportStyles } from '../styles';
import { getEmbeddedFontStyles } from '../fonts';
import { renderCompReportCover } from './pages/cover';
import { renderBenchmarkSummaryPage } from './pages/benchmarkSummary';
import { renderTransactionTablePage } from './pages/transactionTable';
import { renderDeepDivePage } from './pages/deepDive';
import { renderSynthesisPage } from './pages/synthesis';
import type { CompReportData } from './types';
import type { BrandConfig } from '../types';

export type { CompReportData } from './types';

export function generateCompReportHTML(data: CompReportData, brandConfig?: BrandConfig): string {
  const totalPages = 5; // cover + summary + table + deep dive + synthesis

  const { html: coverHtml, reportId } = renderCompReportCover(data);

  const benchmarkHtml = renderBenchmarkSummaryPage(data, {
    reportId,
    currentPage: 2,
    pageCount: totalPages,
  });

  const tableHtml = renderTransactionTablePage(data, {
    reportId,
    currentPage: 3,
    pageCount: totalPages,
  });

  const deepDiveHtml = renderDeepDivePage(data, {
    reportId,
    currentPage: 4,
    pageCount: totalPages,
  });

  const synthesisHtml = renderSynthesisPage(data, {
    reportId,
    currentPage: 5,
    pageCount: totalPages,
  });

  const allPages = [
    coverHtml,
    benchmarkHtml,
    tableHtml,
    deepDiveHtml,
    synthesisHtml,
  ].join('\n');

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${data.assetName ? `${data.assetName} — ` : ''}Comparable Transaction Analysis | Ambrosia Ventures</title>
      <style>
        ${getEmbeddedFontStyles()}
        ${getReportStyles(brandConfig)}
      </style>
    </head>
    <body>
      ${allPages}
    </body>
    </html>
  `;
}
