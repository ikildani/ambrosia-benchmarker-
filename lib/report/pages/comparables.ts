// Page 7: Comparable Transactions
// Deal comparison bar chart + enhanced deal cards

import { renderDealComparison } from '../svg-charts/dealComparison';
import { pageHeader, pageFooter, COLORS, escapeHtml } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';

export function renderComparablesPage(data: PDFReportData, meta: ReportMeta): string {
  const { comparableDeals, result } = data;
  const userMedian = result.terms.totalDealValue.median;

  if (!comparableDeals || comparableDeals.length === 0) {
    return `
      <div class="report-page">
        ${pageHeader(7, meta.pageCount, 'Deal Valuation Report')}
        <div class="section-title-lg">Comparable Transactions</div>
        <div class="card" style="text-align: center; padding: 40px;">
          <div style="font-size: 12px; color: ${COLORS.gray400};">No comparable deals available for this asset profile.</div>
        </div>
        ${pageFooter(meta.reportId)}
      </div>
    `;
  }

  const chartHtml = renderDealComparison(comparableDeals.slice(0, 6), userMedian, 560, 210);

  return `
    <div class="report-page">
      ${pageHeader(7, meta.pageCount, 'Deal Valuation Report')}

      <div class="section-title-lg">Comparable Transactions</div>

      <!-- Bar Chart -->
      <div class="card" style="margin-bottom: 20px; padding: 14px; border-top: 3px solid ${COLORS.navy};">
        <div class="section-title" style="margin-bottom: 4px;">Deal Value Comparison</div>
        <div class="chart-container">
          ${chartHtml}
        </div>
        <div style="text-align: center; font-size: 9px; color: ${COLORS.gray400}; margin-top: 6px;">
          Dashed line indicates your estimated median deal value
        </div>
      </div>

      <!-- Deal Cards -->
      <div class="section-title">Selected Comparables</div>
      <div class="grid-2">
        ${comparableDeals.slice(0, 6).map((deal, i) => `
          <div class="card-sm" style="border-left: 3px solid ${i < 2 ? COLORS.teal : COLORS.gray200};">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 5px;">
              <div style="font-size: 11px; font-weight: 700; color: ${COLORS.navy}; line-height: 1.3;">${escapeHtml(deal.parties)}</div>
              <span style="font-size: 13px; font-weight: 800; color: ${COLORS.teal}; white-space: nowrap; margin-left: 8px;">${escapeHtml(deal.totalValue)}</span>
            </div>
            <div style="display: flex; align-items: center; gap: 4px; margin-bottom: 5px;">
              <span class="badge badge-navy">${deal.year}</span>
              ${deal.phase ? `<span class="badge badge-gray">${escapeHtml(deal.phase)}</span>` : ''}
            </div>
            ${deal.relevanceReasons.length > 0 ? `
            <div style="display: flex; flex-wrap: wrap; gap: 3px;">
              ${deal.relevanceReasons.slice(0, 3).map(r => `<span class="badge badge-teal">${escapeHtml(r)}</span>`).join('')}
            </div>
            ` : ''}
          </div>
        `).join('')}
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
