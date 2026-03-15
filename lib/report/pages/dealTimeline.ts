// Page: Deal Timeline — Gantt-style visualization from signing to commercial milestones

import { renderDealTimeline, getDefaultMilestones } from '../svg-charts/timeline';
import { formatUsd, pageHeader, pageFooter, COLORS, escapeHtml, getLabel, phaseLabels } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';

export function renderDealTimelinePage(data: PDFReportData, meta: ReportMeta): string {
  const { inputs, result } = data;
  const dtl = result.dealTypeLabels;
  const phase = getLabel(inputs.phase, phaseLabels);
  const milestones = getDefaultMilestones(inputs.phase, inputs.therapeuticArea);
  const timelineHtml = renderDealTimeline(inputs.phase, milestones);

  // Milestone payment estimates
  const devMilestones = result.terms.devMilestones;
  const regMilestones = result.terms.regMilestones;
  const commMilestones = result.terms.commMilestones;

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, 'Deal Timeline')}

      <div class="section-title">PROJECTED TIMELINE</div>
      <div class="section-title-lg">Deal Timeline & Milestone Schedule</div>

      <p style="font-size: 11px; color: ${COLORS.gray500}; line-height: 1.6; margin-bottom: 20px;">
        Estimated timeline from deal signing through commercial launch based on
        ${escapeHtml(phase)} entry point. Actual timelines vary based on regulatory feedback,
        trial design, and therapeutic area-specific factors.
      </p>

      <!-- Timeline Chart -->
      <div class="chart-container" style="margin-bottom: 24px;">
        ${timelineHtml}
      </div>

      <!-- Milestone Payments Grid -->
      <div class="section-title" style="margin-top: 16px;">MILESTONE PAYMENT SCHEDULE</div>
      <div class="grid-4" style="margin-top: 10px;">
        ${[
          { label: dtl.upfrontLabel, data: result.terms.upfront, desc: dtl.upfrontTooltip || 'Due at signing', color: COLORS.teal },
          { label: dtl.devMilestoneLabel, data: devMilestones, desc: 'IND, Phase starts, readouts', color: COLORS.cyan },
          { label: dtl.regMilestoneLabel, data: regMilestones, desc: 'NDA/BLA filing, approval', color: '#6366f1' },
          { label: dtl.commMilestoneLabel, data: commMilestones, desc: 'Sales thresholds ($500M+)', color: '#8b5cf6' },
        ].map(item => `
          <div class="card" style="border-top: 3px solid ${item.color};">
            <div style="font-size: 7px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; margin-bottom: 6px;">${item.label}</div>
            <div style="font-size: 20px; font-weight: 800; color: ${COLORS.navy}; letter-spacing: -0.02em;">${formatUsd(item.data.median)}</div>
            <div style="font-size: 9px; color: ${COLORS.gray400}; margin-top: 3px;">${formatUsd(item.data.low)} &ndash; ${formatUsd(item.data.high)}</div>
            <div style="font-size: 8px; color: ${COLORS.gray500}; margin-top: 6px;">${item.desc}</div>
          </div>
        `).join('')}
      </div>

      <!-- Total Deal Value Hero -->
      <div style="background: linear-gradient(145deg, ${COLORS.navy} 0%, #252a5e 100%); border-radius: 6px; padding: 18px 22px; color: white; margin-top: 12px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 7px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.14em; font-weight: 700; margin-bottom: 6px;">${dtl.totalValueLabel || 'Total Deal Value'}</div>
          <div style="font-size: 28px; font-weight: 800; color: ${COLORS.tealMid}; letter-spacing: -0.03em;">${formatUsd(result.terms.totalDealValue.median)}</div>
          <div style="font-size: 9px; color: rgba(255,255,255,0.35); margin-top: 3px;">${formatUsd(result.terms.totalDealValue.low)} &ndash; ${formatUsd(result.terms.totalDealValue.high)}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 8px; color: ${COLORS.tealMid}; font-weight: 600;">+ Tiered Royalties</div>
          <div style="font-size: 14px; font-weight: 800; color: white; margin-top: 2px;">${result.tieredRoyalties.base.low}% &ndash; ${result.tieredRoyalties.highTier.high}%</div>
          <div style="font-size: 8px; color: rgba(255,255,255,0.35); margin-top: 2px;">on net sales</div>
        </div>
      </div>

      <div class="callout" style="margin-top: 20px;">
        <strong>Timeline Note:</strong> Durations are industry median estimates for ${escapeHtml(inputs.therapeuticArea)} assets.
        Regulatory expedited pathways (Breakthrough, Fast Track, Priority Review) can significantly compress the NDA/BLA phase.
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
