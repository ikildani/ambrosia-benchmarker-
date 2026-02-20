// Page: Deal Timeline — Gantt-style visualization from signing to commercial milestones

import { renderDealTimeline, getDefaultMilestones } from '../svg-charts/timeline';
import { formatUsd, pageHeader, pageFooter, COLORS, escapeHtml, getLabel, phaseLabels } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';

export function renderDealTimelinePage(data: PDFReportData, meta: ReportMeta): string {
  const { inputs, result } = data;
  const phase = getLabel(inputs.phase, phaseLabels);
  const milestones = getDefaultMilestones(inputs.phase, inputs.therapeuticArea);
  const timelineHtml = renderDealTimeline(inputs.phase, milestones);

  // Milestone payment estimates
  const devMilestones = result.terms.devMilestones;
  const regMilestones = result.terms.regMilestones;
  const commMilestones = result.terms.commMilestones;

  return `
    <div class="report-page">
      ${pageHeader(11, meta.pageCount, 'Deal Timeline')}

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
      <div class="grid-3" style="margin-top: 10px;">
        ${[
          { label: 'Upfront Payment', data: result.terms.upfront, desc: 'Due at signing', color: COLORS.teal },
          { label: 'Development Milestones', data: devMilestones, desc: 'IND, Phase starts, data readouts', color: COLORS.cyan },
          { label: 'Regulatory Milestones', data: regMilestones, desc: 'NDA/BLA filing, FDA approval', color: '#6366f1' },
        ].map(item => `
          <div class="card" style="border-top: 3px solid ${item.color};">
            <div style="font-size: 7px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; margin-bottom: 6px;">${item.label}</div>
            <div style="font-size: 24px; font-weight: 800; color: ${COLORS.navy}; letter-spacing: -0.02em;">${formatUsd(item.data.median)}</div>
            <div style="font-size: 9px; color: ${COLORS.gray400}; margin-top: 3px;">${formatUsd(item.data.low)} &ndash; ${formatUsd(item.data.high)}</div>
            <div style="font-size: 8px; color: ${COLORS.gray500}; margin-top: 6px;">${item.desc}</div>
          </div>
        `).join('')}
      </div>

      <div class="grid-2" style="margin-top: 12px;">
        <div class="card" style="border-top: 3px solid #8b5cf6;">
          <div style="font-size: 7px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; margin-bottom: 6px;">Commercial Milestones</div>
          <div style="font-size: 24px; font-weight: 800; color: ${COLORS.navy}; letter-spacing: -0.02em;">${formatUsd(commMilestones.median)}</div>
          <div style="font-size: 9px; color: ${COLORS.gray400}; margin-top: 3px;">${formatUsd(commMilestones.low)} &ndash; ${formatUsd(commMilestones.high)}</div>
          <div style="font-size: 8px; color: ${COLORS.gray500}; margin-top: 6px;">Sales thresholds ($100M, $500M, $1B+)</div>
        </div>
        <div style="background: linear-gradient(145deg, ${COLORS.navy} 0%, #252a5e 100%); border-radius: 6px; padding: 18px; color: white;">
          <div style="font-size: 7px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.14em; font-weight: 700; margin-bottom: 6px;">Total Deal Value</div>
          <div style="font-size: 26px; font-weight: 800; color: ${COLORS.tealMid}; letter-spacing: -0.03em;">${formatUsd(result.terms.totalDealValue.median)}</div>
          <div style="font-size: 9px; color: rgba(255,255,255,0.35); margin-top: 3px;">${formatUsd(result.terms.totalDealValue.low)} &ndash; ${formatUsd(result.terms.totalDealValue.high)}</div>
          <div style="font-size: 8px; color: ${COLORS.tealMid}; font-weight: 600; margin-top: 6px;">+ Royalties on net sales</div>
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
