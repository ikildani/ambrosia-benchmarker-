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

  const gaugeHtml = renderRiskGauge(riskScore, 110);

  // Donut segments
  const donutHtml = renderDonut([
    { label: 'Upfront', value: terms.upfront.median, color: COLORS.teal },
    { label: 'Dev Milestones', value: terms.devMilestones.median, color: COLORS.cyan },
    { label: 'Reg Milestones', value: terms.regMilestones.median, color: '#6366f1' },
    { label: 'Comm Milestones', value: terms.commMilestones.median, color: '#8b5cf6' },
  ], 200);

  const topDriver = sensitivityData?.topValueDriver;

  return `
    <div class="report-page">
      ${pageHeader(3, meta.pageCount, 'Deal Valuation Report')}

      <div class="section-title-lg">Executive Dashboard</div>

      <!-- Hero KPI Row -->
      <div style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 14px; margin-bottom: 18px;">
        <!-- Total Deal Value — large hero card -->
        <div style="background: linear-gradient(145deg, ${COLORS.navy} 0%, #252a5e 100%); border-radius: 6px; padding: 20px 22px; color: white;">
          <div style="font-size: 7px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.16em; font-weight: 700; margin-bottom: 6px;">Total Deal Value</div>
          <div style="font-size: 32px; font-weight: 800; color: ${COLORS.tealMid}; letter-spacing: -0.03em; line-height: 1;">${formatUsd(terms.totalDealValue.median)}</div>
          <div style="font-size: 10px; color: rgba(255,255,255,0.35); margin-top: 5px;">${formatUsd(terms.totalDealValue.low)} &ndash; ${formatUsd(terms.totalDealValue.high)}</div>
        </div>
        <!-- Upfront Payment -->
        <div class="kpi-card">
          <div class="kpi-value">${formatUsd(terms.upfront.median)}</div>
          <div class="kpi-label">Upfront Payment</div>
          <div class="kpi-sub">${upfrontPct}% of total deal value</div>
        </div>
        <!-- Risk Gauge -->
        <div class="kpi-card" style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 10px 16px;">
          ${gaugeHtml}
        </div>
      </div>

      <!-- Milestone Breakdown Row -->
      <div class="grid-4" style="margin-bottom: 18px;">
        ${[
          { label: 'Dev Milestones', value: formatUsd(terms.devMilestones.median), color: COLORS.teal },
          { label: 'Reg Milestones', value: formatUsd(terms.regMilestones.median), color: COLORS.cyan },
          { label: 'Comm Milestones', value: formatUsd(terms.commMilestones.median), color: '#6366f1' },
          { label: 'Base Royalty', value: `${result.tieredRoyalties.base.low}%\u2013${result.tieredRoyalties.base.high}%`, color: '#8b5cf6' },
        ].map(item => `
          <div class="card-sm" style="text-align: center; border-top: 3px solid ${item.color};">
            <div style="font-size: 20px; font-weight: 800; color: ${COLORS.navy}; letter-spacing: -0.02em;">${item.value}</div>
            <div style="font-size: 8px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; margin-top: 4px;">${item.label}</div>
          </div>
        `).join('')}
      </div>

      <!-- Bottom row: Donut + Recommendation -->
      <div style="display: grid; grid-template-columns: 220px 1fr; gap: 20px;">
        <!-- Donut chart -->
        <div style="display: flex; flex-direction: column; align-items: center;">
          <div class="section-title" style="margin-bottom: 6px;">Value Split</div>
          ${donutHtml}
        </div>

        <!-- Right column: Recommendation + Top Driver -->
        <div style="display: flex; flex-direction: column; gap: 10px;">
          <!-- Deal Recommendation -->
          <div class="card-highlight">
            <div style="font-size: 9px; font-weight: 700; color: ${COLORS.navy}; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px;">Recommended Structure</div>
            <div style="font-size: 11px; color: ${COLORS.gray800}; line-height: 1.6;">
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
