// Executive Summary — single A4 page PDF export
// Consulting-grade one-pager: clean typography, visual deal structure bar,
// numbered highlights, premium metric cards — suitable for board decks

import { getReportStyles } from './styles';
import {
  formatUsd,
  generateReportId,
  formatDate,
  COLORS,
  getTAColors,
  getLabel,
  phaseLabels,
  modalityLabels,
  escapeHtml,
} from './helpers';
import { logoFullColor } from './logo';
import { renderRiskGauge } from './svg-charts/riskGauge';
import type { PDFReportData } from './types';

/** Builds a single A4 page HTML string for the Executive Summary. */
export function generateExecutiveSummaryHTML(data: PDFReportData): string {
  const { result, inputs, riskScore } = data;
  const terms = result.terms;
  const indication = result.labels.indication || inputs.indication;
  const reportId = generateReportId();
  const reportDate = formatDate();

  // Therapeutic area colors
  const taColors = getTAColors(inputs.therapeuticArea);

  // Risk score — fall back to 50 if not provided
  const score = typeof riskScore === 'number' ? riskScore : 50;
  const gaugeHtml = renderRiskGauge(score, 90);

  // Deal recommendation
  const rec = result.dealRecommendation;

  // Royalty range
  const royaltyRange = `${result.tieredRoyalties.base.low}%\u2013${result.tieredRoyalties.base.high}%`;

  // Deal structure percentages for the stacked bar
  const upfrontPct = rec.upfrontPercent;
  const milestonePct = rec.milestonePercent;

  // Build key highlights
  const highlights: string[] = [];
  if (rec.rationale) {
    highlights.push(escapeHtml(rec.rationale));
  }
  if (result.negotiationInsight) {
    highlights.push(escapeHtml(result.negotiationInsight));
  }
  // Always add a score-based statement
  if (score >= 70) {
    highlights.push(`Risk score of ${score}/100 indicates higher execution risk — consider structuring with protective milestones and upfront weighting.`);
  } else if (score >= 40) {
    highlights.push(`Risk score of ${score}/100 reflects moderate risk — balanced deal structures with milestone-heavy payouts are appropriate.`);
  } else {
    highlights.push(`Risk score of ${score}/100 suggests lower execution risk — a favorable environment for competitive upfront terms.`);
  }
  // Limit to 3 highlights
  const topHighlights = highlights.slice(0, 3);

  // Readable labels
  const phaseLabel = escapeHtml(getLabel(inputs.phase, phaseLabels));
  const modalityLabel = escapeHtml(result.labels.modality || getLabel(inputs.modality, modalityLabels));
  const indicationLabel = escapeHtml(indication);
  const taLabel = escapeHtml(taColors.label);

  // Metric card helper — produces a polished card with left accent border
  const metricCard = (
    value: string,
    label: string,
    sub: string,
    accentColor: string,
  ): string => `
    <div style="
      background: ${COLORS.white};
      border: 1px solid ${COLORS.gray200};
      border-left: 3.5px solid ${accentColor};
      border-radius: 0 6px 6px 0;
      padding: 14px 16px;
      box-shadow: 0 1px 3px rgba(0,0,0,0.04);
    ">
      <div style="font-size: 21px; font-weight: 800; color: ${COLORS.navy}; line-height: 1.1; letter-spacing: -0.02em;">${value}</div>
      <div style="font-size: 9.5px; font-weight: 700; color: ${COLORS.gray500}; text-transform: uppercase; letter-spacing: 0.12em; margin-top: 6px;">${label}</div>
      <div style="font-size: 9px; color: ${COLORS.gray400}; margin-top: 3px;">${sub}</div>
    </div>
  `;

  const executiveSummaryStyles = `
    ${getReportStyles()}

    /* Override for single-page executive summary */
    @page {
      size: A4;
      margin: 0;
    }

    .report-page {
      page-break-after: auto;
    }
  `;

  return `
    <!DOCTYPE html>
    <html lang="en">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>${escapeHtml(indication)} — Executive Summary | Ambrosia Ventures</title>
      <link rel="preconnect" href="https://fonts.googleapis.com">
      <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@700&family=Inter:wght@200;400;500;600;700;800&family=Libre+Franklin:wght@200&display=swap" rel="stylesheet">
      <style>${executiveSummaryStyles}</style>
    </head>
    <body>
      <div class="report-page">
        <!-- Teal accent line across the top -->
        <div style="position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, ${COLORS.teal}, ${COLORS.cyan}, ${COLORS.teal});"></div>

        <!-- ======== HEADER ======== -->
        <div style="display: flex; justify-content: space-between; align-items: flex-end; margin-bottom: 6px; padding-top: 2px;">
          <div>
            ${logoFullColor(170)}
          </div>
          <div style="text-align: right;">
            <div style="font-size: 11px; font-weight: 200; color: ${COLORS.navy}; text-transform: uppercase; letter-spacing: 0.22em;">Executive Summary</div>
          </div>
        </div>
        <div style="height: 1px; background: ${COLORS.gray200}; margin-bottom: 4px;"></div>
        <div style="font-size: 8.5px; font-weight: 500; color: ${COLORS.gray400}; margin-bottom: 18px; letter-spacing: 0.02em;">${reportDate} &nbsp;&middot;&nbsp; ${reportId}</div>

        <!-- ======== DEAL PARAMETERS ROW ======== -->
        <div style="
          display: flex;
          align-items: center;
          gap: 0;
          margin-bottom: 18px;
          padding: 12px 20px;
          background: ${COLORS.gray50};
          border: 1px solid ${COLORS.gray200};
          border-radius: 6px;
        ">
          <span style="display: inline-block; width: 9px; height: 9px; border-radius: 50%; background: ${taColors.primary}; margin-right: 10px; flex-shrink: 0;"></span>
          <span style="font-size: 12px; font-weight: 600; color: ${COLORS.navy}; letter-spacing: 0.01em;">${taLabel}</span>
          <span style="display: inline-block; width: 1px; height: 18px; background: ${COLORS.gray300}; margin: 0 16px; flex-shrink: 0;"></span>
          <span style="font-size: 12px; font-weight: 600; color: ${COLORS.navy};">${phaseLabel}</span>
          <span style="display: inline-block; width: 1px; height: 18px; background: ${COLORS.gray300}; margin: 0 16px; flex-shrink: 0;"></span>
          <span style="font-size: 12px; font-weight: 600; color: ${COLORS.navy};">${modalityLabel}</span>
          <span style="display: inline-block; width: 1px; height: 18px; background: ${COLORS.gray300}; margin: 0 16px; flex-shrink: 0;"></span>
          <span style="font-size: 12px; font-weight: 600; color: ${COLORS.navy};">${indicationLabel}</span>
        </div>

        <!-- ======== HERO METRIC: Total Deal Value + Risk Gauge ======== -->
        <div style="
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 22px 28px;
          margin-bottom: 18px;
          background: linear-gradient(155deg, #0f1229 0%, #1a1e42 50%, #252a5e 100%);
          border-radius: 8px;
          border-bottom: 3px solid ${COLORS.teal};
          box-shadow: 0 3px 12px rgba(26,30,66,0.18);
          position: relative;
          overflow: hidden;
        ">
          <!-- Subtle background texture -->
          <div style="position: absolute; top: 0; right: 0; width: 200px; height: 100%; background: radial-gradient(circle at 80% 30%, rgba(13,148,136,0.08) 0%, transparent 60%);"></div>
          <div style="position: relative;">
            <div style="font-size: 9px; font-weight: 200; color: ${COLORS.tealMid}; text-transform: uppercase; letter-spacing: 0.18em; margin-bottom: 8px;">Total Deal Value</div>
            <div style="font-size: 38px; font-weight: 800; color: ${COLORS.white}; line-height: 1; letter-spacing: -0.03em;">${formatUsd(terms.totalDealValue.median)}</div>
            <div style="font-size: 11px; font-weight: 400; color: rgba(255,255,255,0.4); margin-top: 6px; letter-spacing: 0.01em;">Range: ${formatUsd(terms.totalDealValue.low)} &ndash; ${formatUsd(terms.totalDealValue.high)}</div>
          </div>
          <div style="flex-shrink: 0; margin-left: 20px; position: relative;">
            ${gaugeHtml}
          </div>
        </div>

        <!-- ======== DEAL STRUCTURE BAR ======== -->
        <div style="margin-bottom: 18px;">
          <div style="font-size: 9px; font-weight: 700; color: ${COLORS.teal}; text-transform: uppercase; letter-spacing: 0.16em; margin-bottom: 8px;">Recommended Deal Structure</div>
          <div style="display: flex; height: 32px; border-radius: 6px; overflow: hidden; box-shadow: 0 1px 3px rgba(0,0,0,0.06);">
            <!-- Upfront segment -->
            <div style="
              width: ${upfrontPct}%;
              background: linear-gradient(135deg, ${COLORS.teal}, #0f766e);
              display: flex;
              align-items: center;
              justify-content: center;
              color: ${COLORS.white};
              font-size: 10px;
              font-weight: 700;
              letter-spacing: 0.03em;
              position: relative;
            ">
              ${upfrontPct >= 15 ? `Upfront ${upfrontPct}%` : `${upfrontPct}%`}
            </div>
            <!-- Milestones segment -->
            <div style="
              width: ${milestonePct}%;
              background: linear-gradient(135deg, ${COLORS.cyan}, #0891b2);
              display: flex;
              align-items: center;
              justify-content: center;
              color: ${COLORS.white};
              font-size: 10px;
              font-weight: 700;
              letter-spacing: 0.03em;
              position: relative;
            ">
              ${milestonePct >= 15 ? `Milestones ${milestonePct}%` : `${milestonePct}%`}
            </div>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 4px;">
            <span style="font-size: 8.5px; color: ${COLORS.gray400}; font-weight: 500;">${formatUsd(terms.upfront.median)} upfront</span>
            <span style="font-size: 8.5px; color: ${COLORS.gray400}; font-weight: 500;">${formatUsd(terms.devMilestones.median + terms.regMilestones.median + terms.commMilestones.median)} milestones</span>
          </div>
        </div>

        <!-- ======== METRICS GRID (2x3) ======== -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 18px;">
          ${metricCard(
            formatUsd(terms.upfront.median),
            'Upfront Payment',
            `${formatUsd(terms.upfront.low)} \u2013 ${formatUsd(terms.upfront.high)}`,
            COLORS.teal,
          )}
          ${metricCard(
            formatUsd(terms.devMilestones.median),
            'Dev Milestones',
            `${formatUsd(terms.devMilestones.low)} \u2013 ${formatUsd(terms.devMilestones.high)}`,
            COLORS.cyan,
          )}
          ${metricCard(
            formatUsd(terms.regMilestones.median),
            'Reg Milestones',
            `${formatUsd(terms.regMilestones.low)} \u2013 ${formatUsd(terms.regMilestones.high)}`,
            '#6366f1',
          )}
          ${metricCard(
            formatUsd(terms.commMilestones.median),
            'Comm Milestones',
            `${formatUsd(terms.commMilestones.low)} \u2013 ${formatUsd(terms.commMilestones.high)}`,
            COLORS.purple,
          )}
          ${metricCard(
            royaltyRange,
            'Base Royalty Range',
            'On net sales <$500M',
            COLORS.amber,
          )}
          ${metricCard(
            `${rec.upfrontPercent}/${rec.milestonePercent}`,
            'Upfront / Milestone Split',
            'Recommended allocation',
            COLORS.navy,
          )}
        </div>

        <!-- ======== KEY HIGHLIGHTS ======== -->
        <div style="margin-bottom: 0;">
          <div style="font-size: 9px; font-weight: 700; color: ${COLORS.teal}; text-transform: uppercase; letter-spacing: 0.16em; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 2px solid ${COLORS.tealLight};">Key Highlights</div>
          <div style="display: flex; flex-direction: column; gap: 10px;">
            ${topHighlights.map((h, i) => `
              <div style="display: flex; align-items: flex-start; gap: 12px;">
                <div style="
                  flex-shrink: 0;
                  width: 24px;
                  height: 24px;
                  border-radius: 50%;
                  background: linear-gradient(135deg, ${COLORS.teal}, ${COLORS.cyan});
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  color: ${COLORS.white};
                  font-size: 11px;
                  font-weight: 700;
                  line-height: 1;
                  box-shadow: 0 1px 3px rgba(13,148,136,0.25);
                ">${i + 1}</div>
                <div style="font-size: 10.5px; color: ${COLORS.gray700}; line-height: 1.6; padding-top: 2px;">${h}</div>
              </div>
            `).join('')}
          </div>
        </div>

        <!-- ======== FOOTER ======== -->
        <div style="position: absolute; bottom: 22px; left: 48px; right: 48px;">
          <!-- Gradient line above footer -->
          <div style="height: 1.5px; background: linear-gradient(90deg, ${COLORS.teal}, ${COLORS.cyan}, transparent); margin-bottom: 10px;"></div>
          <div style="background: ${COLORS.gray50}; border: 1px solid ${COLORS.gray200}; border-radius: 4px; padding: 8px 14px; margin-bottom: 8px;">
            <p style="font-size: 7.5px; color: ${COLORS.gray400}; line-height: 1.65; margin: 0; font-weight: 400;">
              This executive summary is generated by the Ambrosia Ventures Deal Benchmarker for informational purposes only. Estimates are based on publicly disclosed deal terms and proprietary benchmarking models. Actual deal terms vary based on asset-specific factors, market conditions, and negotiation dynamics. This does not constitute financial, legal, or investment advice.
            </p>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 7.5px; color: ${COLORS.gray400}; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 600;">Confidential &middot; ${reportDate}</span>
            <span style="font-size: 7.5px; color: ${COLORS.teal}; font-weight: 700; letter-spacing: 0.04em;">${reportId}</span>
          </div>
        </div>
      </div>
    </body>
    </html>
  `;
}

/** Opens a new window and triggers the print dialog for the Executive Summary. */
export function generateExecutiveSummaryPDF(data: PDFReportData): void {
  const html = generateExecutiveSummaryHTML(data);

  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert('Please allow pop-ups to download the Executive Summary.');
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
