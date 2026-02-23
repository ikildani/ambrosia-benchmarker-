// Page 4: Deal Structure & Valuation
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
  const waterfallHtml = renderWaterfall(result.modifiers, baseValue, 560, 280);

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
      ${pageHeader(meta.currentPage, meta.pageCount, 'Deal Valuation Report')}

      <div class="section-title-lg">Deal Structure & Valuation</div>

      <!-- Modifier Waterfall -->
      <div style="margin-bottom: 22px;">
        <div class="section-title">Value Impact Waterfall</div>
        <div class="card" style="padding: 16px 12px; border-top: 3px solid ${COLORS.navy};">
          <div class="chart-container">
            ${waterfallHtml}
          </div>
          <div style="text-align: center; font-size: 9px; color: ${COLORS.gray400}; margin-top: 6px; letter-spacing: 0.02em;">
            Shows how each factor modifies the base valuation to reach the final estimated deal value
          </div>
        </div>
      </div>

      <!-- Term Ranges -->
      <div style="margin-bottom: 12px;">
        <div class="section-title">Term Ranges (Low / Median / High)</div>
        <div class="card" style="padding: 0; overflow: hidden;">
          <table class="data-table">
            <thead>
              <tr>
                <th style="width: 140px;">Metric</th>
                <th style="text-align: right;">Low</th>
                <th style="text-align: right; color: ${COLORS.teal};">Median</th>
                <th style="text-align: right;">High</th>
                <th style="width: 260px;">Range</th>
              </tr>
            </thead>
            <tbody>
              ${termRanges.map((t, i) => {
                const isTotal = i === 0;
                const rowBg = isTotal ? `background: linear-gradient(90deg, #f0fdfa, #ecfeff);` : '';
                const labelStyle = isTotal
                  ? `font-weight: 800; color: ${COLORS.navy}; font-size: 11px;`
                  : `font-weight: 600;`;
                const medianStyle = isTotal
                  ? `font-weight: 800; color: ${COLORS.teal}; text-align: right; font-size: 12px;`
                  : '';
                return `
                <tr style="${rowBg}">
                  <td style="${labelStyle}">${t.label}</td>
                  <td style="text-align: right; color: ${COLORS.gray500};">${formatUsd(t.low)}</td>
                  <td ${isTotal ? `style="${medianStyle}"` : 'class="value-cell"'}>${formatUsd(t.median)}</td>
                  <td style="text-align: right; color: ${COLORS.gray500};">${formatUsd(t.high)}</td>
                  <td style="padding: 2px 8px;">${renderRangeBar({ low: t.low, median: t.median, high: t.high }, maxVal, 250, 20, false)}</td>
                </tr>`;
              }).join('')}
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
