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

      <p style="font-size: 10px; color: ${COLORS.gray500}; line-height: 1.6; margin-bottom: 16px;">
        Estimated timeline from deal signing through commercial launch based on
        ${escapeHtml(phase)} entry point. Actual timelines vary based on regulatory feedback,
        trial design, and therapeutic area-specific factors.
      </p>

      <!-- Timeline Chart -->
      <div class="chart-container" style="margin-bottom: 20px;">
        ${timelineHtml}
      </div>

      <!-- Milestone Payments Grid -->
      <div class="section-title" style="margin-top: 16px;">MILESTONE PAYMENT SCHEDULE</div>
      <div class="grid-3" style="margin-top: 10px;">
        <div class="card">
          <div style="font-size: 8px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; margin-bottom: 6px;">Upfront Payment</div>
          <div style="font-size: 22px; font-weight: 700; color: ${COLORS.teal};">${formatUsd(result.terms.upfront.median)}</div>
          <div style="font-size: 9px; color: ${COLORS.gray400}; margin-top: 3px;">Range: ${formatUsd(result.terms.upfront.low)} &ndash; ${formatUsd(result.terms.upfront.high)}</div>
          <div style="font-size: 8px; color: ${COLORS.gray500}; margin-top: 6px;">Due at signing</div>
        </div>
        <div class="card">
          <div style="font-size: 8px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; margin-bottom: 6px;">Development Milestones</div>
          <div style="font-size: 22px; font-weight: 700; color: ${COLORS.teal};">${formatUsd(devMilestones.median)}</div>
          <div style="font-size: 9px; color: ${COLORS.gray400}; margin-top: 3px;">Range: ${formatUsd(devMilestones.low)} &ndash; ${formatUsd(devMilestones.high)}</div>
          <div style="font-size: 8px; color: ${COLORS.gray500}; margin-top: 6px;">IND, Phase starts, data readouts</div>
        </div>
        <div class="card">
          <div style="font-size: 8px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; margin-bottom: 6px;">Regulatory Milestones</div>
          <div style="font-size: 22px; font-weight: 700; color: ${COLORS.teal};">${formatUsd(regMilestones.median)}</div>
          <div style="font-size: 9px; color: ${COLORS.gray400}; margin-top: 3px;">Range: ${formatUsd(regMilestones.low)} &ndash; ${formatUsd(regMilestones.high)}</div>
          <div style="font-size: 8px; color: ${COLORS.gray500}; margin-top: 6px;">NDA/BLA filing, FDA approval</div>
        </div>
      </div>

      <div class="grid-2" style="margin-top: 12px;">
        <div class="card">
          <div style="font-size: 8px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; margin-bottom: 6px;">Commercial Milestones</div>
          <div style="font-size: 22px; font-weight: 700; color: ${COLORS.teal};">${formatUsd(commMilestones.median)}</div>
          <div style="font-size: 9px; color: ${COLORS.gray400}; margin-top: 3px;">Range: ${formatUsd(commMilestones.low)} &ndash; ${formatUsd(commMilestones.high)}</div>
          <div style="font-size: 8px; color: ${COLORS.gray500}; margin-top: 6px;">Sales thresholds ($100M, $500M, $1B+)</div>
        </div>
        <div class="card-highlight">
          <div style="font-size: 8px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; margin-bottom: 6px;">Total Deal Value</div>
          <div style="font-size: 22px; font-weight: 700; color: ${COLORS.navy};">${formatUsd(result.terms.totalDealValue.median)}</div>
          <div style="font-size: 9px; color: ${COLORS.gray400}; margin-top: 3px;">Range: ${formatUsd(result.terms.totalDealValue.low)} &ndash; ${formatUsd(result.terms.totalDealValue.high)}</div>
          <div style="font-size: 8px; color: ${COLORS.teal}; font-weight: 600; margin-top: 6px;">+ Royalties on net sales</div>
        </div>
      </div>

      <div class="callout" style="margin-top: 16px;">
        <strong>Timeline Note:</strong> Durations are industry median estimates for ${escapeHtml(inputs.therapeuticArea)} assets.
        Regulatory expedited pathways (Breakthrough, Fast Track, Priority Review) can significantly compress the NDA/BLA phase.
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
