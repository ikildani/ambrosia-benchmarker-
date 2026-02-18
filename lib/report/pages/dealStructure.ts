// Page 3: Deal Structure & Valuation
// Waterfall chart, range bars for each term

import { renderWaterfall } from '../svg-charts/waterfall';
import { renderRangeBar } from '../svg-charts/rangeBar';
import { formatUsd, pageHeader, pageFooter, COLORS } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';

export function renderDealStructurePage(data: PDFReportData, meta: ReportMeta): string {
  const { result } = data;
  const terms = result.terms;

  // Waterfall chart
  const baseValue = terms.totalDealValue.median / result.modifiers.reduce((acc, m) => acc * m.multiplier, 1);
  const waterfallHtml = renderWaterfall(result.modifiers, baseValue, 580, 240);

  // Range bars for each term
  const maxVal = terms.totalDealValue.high * 1.1;
  const termRanges = [
    { label: 'Total Deal Value', ...terms.totalDealValue },
    { label: 'Upfront Payment', ...terms.upfront },
    { label: 'Dev Milestones', ...terms.devMilestones },
    { label: 'Reg Milestones', ...terms.regMilestones },
    { label: 'Comm Milestones', ...terms.commMilestones },
  ];

  return `
    <div class="report-page">
      ${pageHeader(3, meta.pageCount, 'Deal Valuation Report')}

      <div class="section-title-lg">Deal Structure & Valuation</div>

      <!-- Modifier Waterfall -->
      <div style="margin-bottom: 20px;">
        <div class="section-title">Value Impact Waterfall</div>
        <div class="card" style="padding: 16px 12px;">
          <div class="chart-container">
            ${waterfallHtml}
          </div>
          <div style="text-align: center; font-size: 9px; color: ${COLORS.gray400}; margin-top: 8px;">
            Shows how each factor modifies the base valuation to reach the final estimated deal value
          </div>
        </div>
      </div>

      <!-- Term Ranges -->
      <div style="margin-bottom: 16px;">
        <div class="section-title">Term Ranges (Low / Median / High)</div>
        <div class="card">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 150px;">Metric</th>
                <th style="text-align: right;">Low</th>
                <th style="text-align: right; color: ${COLORS.teal};">Median</th>
                <th style="text-align: right;">High</th>
                <th style="width: 280px;">Range</th>
              </tr>
            </thead>
            <tbody>
              ${termRanges.map(t => `
                <tr>
                  <td style="font-weight: 600;">${t.label}</td>
                  <td style="text-align: right; color: ${COLORS.gray500};">${formatUsd(t.low)}</td>
                  <td class="value-cell">${formatUsd(t.median)}</td>
                  <td style="text-align: right; color: ${COLORS.gray500};">${formatUsd(t.high)}</td>
                  <td>${renderRangeBar({ low: t.low, median: t.median, high: t.high }, maxVal, 260, 30, true)}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- Value Distribution Summary -->
      <div class="callout">
        <strong>Key Insight:</strong> ${result.negotiationInsight}
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
