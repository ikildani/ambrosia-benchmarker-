// Page 3: Executive Dashboard
// 3 large KPIs, 4 smaller cards, donut chart, recommendation callout

import { renderRiskGauge } from '../svg-charts/riskGauge';
import { renderDonut } from '../svg-charts/donut';
import { formatUsd, formatPercent, pageHeader, pageFooter, COLORS } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';

export function renderExecutiveDashboard(data: PDFReportData, meta: ReportMeta): string {
  const { result, riskScore, sensitivityData } = data;
  const terms = result.terms;

  const upfrontPct = terms.totalDealValue.median > 0
    ? (terms.upfront.median / terms.totalDealValue.median * 100).toFixed(0)
    : '0';

  const gaugeHtml = renderRiskGauge(riskScore, 90);

  // Donut segments
  const donutHtml = renderDonut([
    { label: 'Upfront', value: terms.upfront.median, color: COLORS.teal },
    { label: 'Dev Milestones', value: terms.devMilestones.median, color: COLORS.cyan },
    { label: 'Reg Milestones', value: terms.regMilestones.median, color: '#6366f1' },
    { label: 'Comm Milestones', value: terms.commMilestones.median, color: '#8b5cf6' },
  ], 150);

  const topDriver = sensitivityData?.topValueDriver;

  return `
    <div class="report-page">
      ${pageHeader(3, meta.pageCount, 'Deal Valuation Report')}

      <div class="section-title-lg">Executive Dashboard</div>

      <!-- Top row: 3 large KPIs -->
      <div class="grid-3" style="margin-bottom: 14px;">
        <div class="kpi-card">
          <div class="kpi-value">${formatUsd(terms.totalDealValue.median)}</div>
          <div class="kpi-label">Total Deal Value</div>
          <div class="kpi-sub">${formatUsd(terms.totalDealValue.low)} &ndash; ${formatUsd(terms.totalDealValue.high)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value">${formatUsd(terms.upfront.median)}</div>
          <div class="kpi-label">Upfront Payment</div>
          <div class="kpi-sub">${upfrontPct}% of total deal value</div>
        </div>
        <div class="kpi-card" style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
          ${gaugeHtml}
        </div>
      </div>

      <!-- Middle row: 4 smaller cards -->
      <div class="grid-4" style="margin-bottom: 16px;">
        <div class="card-sm" style="text-align: center;">
          <div style="font-size: 16px; font-weight: 700; color: ${COLORS.teal};">${formatUsd(terms.devMilestones.median)}</div>
          <div style="font-size: 8px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; margin-top: 2px;">Dev Milestones</div>
        </div>
        <div class="card-sm" style="text-align: center;">
          <div style="font-size: 16px; font-weight: 700; color: ${COLORS.teal};">${formatUsd(terms.regMilestones.median)}</div>
          <div style="font-size: 8px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; margin-top: 2px;">Reg Milestones</div>
        </div>
        <div class="card-sm" style="text-align: center;">
          <div style="font-size: 16px; font-weight: 700; color: ${COLORS.teal};">${formatUsd(terms.commMilestones.median)}</div>
          <div style="font-size: 8px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; margin-top: 2px;">Comm Milestones</div>
        </div>
        <div class="card-sm" style="text-align: center;">
          <div style="font-size: 16px; font-weight: 700; color: ${COLORS.teal};">${result.tieredRoyalties.base.low}%\u2013${result.tieredRoyalties.base.high}%</div>
          <div style="font-size: 8px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; margin-top: 2px;">Base Royalty</div>
        </div>
      </div>

      <!-- Bottom row: Donut + Recommendation -->
      <div style="display: grid; grid-template-columns: 180px 1fr; gap: 16px;">
        <!-- Donut chart -->
        <div style="display: flex; flex-direction: column; align-items: center;">
          <div class="section-title" style="margin-bottom: 6px;">Value Split</div>
          ${donutHtml}
        </div>

        <!-- Right column: Recommendation + Top Driver -->
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <!-- Deal Recommendation -->
          <div class="card-highlight">
            <div style="font-size: 8px; font-weight: 700; color: ${COLORS.teal}; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 5px;">Recommended Structure</div>
            <div style="font-size: 10px; color: ${COLORS.gray800}; line-height: 1.6;">
              ${result.dealRecommendation.rationale}
            </div>
            <div style="margin-top: 6px; display: flex; gap: 8px;">
              <span class="badge badge-teal">Upfront ${result.dealRecommendation.upfrontPercent}%</span>
              <span class="badge badge-blue">Milestones ${result.dealRecommendation.milestonePercent}%</span>
            </div>
          </div>

          ${topDriver ? `
          <!-- Top Value Driver -->
          <div class="card-amber">
            <div style="font-size: 8px; font-weight: 700; color: #b45309; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 5px;">Top Value Driver</div>
            <div style="font-size: 10px; color: ${COLORS.gray800}; line-height: 1.5;">
              <strong>${topDriver.parameterLabel}:</strong> ${topDriver.insightText}
            </div>
            <div style="margin-top: 5px;">
              <span class="badge badge-amber">+${formatUsd(topDriver.bestOption.delta)} potential</span>
            </div>
          </div>
          ` : ''}
        </div>
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
