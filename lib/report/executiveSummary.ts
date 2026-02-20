// Executive Summary — single A4 page PDF export
// Designed as a standalone one-page overview suitable for board decks or quick sharing

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
  const gaugeHtml = renderRiskGauge(score, 80);

  // Deal recommendation
  const rec = result.dealRecommendation;

  // Royalty range
  const royaltyRange = `${result.tieredRoyalties.base.low}%–${result.tieredRoyalties.base.high}%`;

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
      <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@700&family=Inter:wght@400;500;600;700;800&family=Libre+Franklin:wght@200&display=swap" rel="stylesheet">
      <style>${executiveSummaryStyles}</style>
    </head>
    <body>
      <div class="report-page">
        <!-- Teal accent bar -->
        <div style="position: absolute; top: 0; left: 0; right: 0; height: 2.5px; background: linear-gradient(90deg, ${COLORS.teal}, ${COLORS.cyan});"></div>

        <!-- Header -->
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 18px; padding-top: 4px;">
          <div style="display: flex; align-items: center; gap: 16px;">
            ${logoFullColor(160)}
          </div>
          <div style="text-align: right;">
            <div style="font-size: 9px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.14em; margin-bottom: 3px;">Executive Summary</div>
            <div style="font-size: 8px; color: ${COLORS.gray400};">${reportDate}</div>
          </div>
        </div>

        <hr class="divider" style="margin: 0 0 16px 0;" />

        <!-- Deal Parameters Row -->
        <div class="grid-4" style="margin-bottom: 16px;">
          <div class="card-sm" style="padding: 8px 10px;">
            <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 4px;">Therapeutic Area</div>
            <div style="display: flex; align-items: center; gap: 5px;">
              <span style="display: inline-block; width: 7px; height: 7px; border-radius: 50%; background: ${taColors.primary};"></span>
              <span style="font-size: 10px; font-weight: 600; color: ${COLORS.navy};">${escapeHtml(taColors.label)}</span>
            </div>
          </div>
          <div class="card-sm" style="padding: 8px 10px;">
            <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 4px;">Phase</div>
            <div style="font-size: 10px; font-weight: 600; color: ${COLORS.navy};">${escapeHtml(getLabel(inputs.phase, phaseLabels))}</div>
          </div>
          <div class="card-sm" style="padding: 8px 10px;">
            <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 4px;">Modality</div>
            <div style="font-size: 10px; font-weight: 600; color: ${COLORS.navy};">${escapeHtml(getLabel(inputs.modality, modalityLabels))}</div>
          </div>
          <div class="card-sm" style="padding: 8px 10px;">
            <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 4px;">Indication</div>
            <div style="font-size: 10px; font-weight: 600; color: ${COLORS.navy};">${escapeHtml(result.labels.indication)}</div>
          </div>
        </div>

        <!-- Hero Metric: Total Deal Value + Risk Gauge -->
        <div class="card-navy" style="display: flex; justify-content: space-between; align-items: center; padding: 18px 22px; margin-bottom: 16px;">
          <div>
            <div style="font-size: 8px; font-weight: 700; color: ${COLORS.tealMid}; text-transform: uppercase; letter-spacing: 0.14em; margin-bottom: 6px;">Total Deal Value</div>
            <div style="font-size: 32px; font-weight: 800; color: ${COLORS.white}; line-height: 1.1; letter-spacing: -0.03em;">${formatUsd(terms.totalDealValue.median)}</div>
            <div style="font-size: 10px; color: ${COLORS.gray300}; margin-top: 5px;">Range: ${formatUsd(terms.totalDealValue.low)} &ndash; ${formatUsd(terms.totalDealValue.high)}</div>
          </div>
          <div style="flex-shrink: 0; margin-left: 16px;">
            ${gaugeHtml}
          </div>
        </div>

        <!-- Metrics Grid (2x3) -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 16px;">
          <!-- Upfront Payment -->
          <div class="card-sm" style="text-align: center; padding: 12px 8px;">
            <div style="font-size: 18px; font-weight: 800; color: ${COLORS.teal}; line-height: 1.1;">${formatUsd(terms.upfront.median)}</div>
            <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 4px;">Upfront Payment</div>
            <div style="font-size: 8px; color: ${COLORS.gray400}; margin-top: 2px;">${formatUsd(terms.upfront.low)} &ndash; ${formatUsd(terms.upfront.high)}</div>
          </div>
          <!-- Dev Milestones -->
          <div class="card-sm" style="text-align: center; padding: 12px 8px;">
            <div style="font-size: 18px; font-weight: 800; color: ${COLORS.navy}; line-height: 1.1;">${formatUsd(terms.devMilestones.median)}</div>
            <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 4px;">Dev Milestones</div>
            <div style="font-size: 8px; color: ${COLORS.gray400}; margin-top: 2px;">${formatUsd(terms.devMilestones.low)} &ndash; ${formatUsd(terms.devMilestones.high)}</div>
          </div>
          <!-- Reg Milestones -->
          <div class="card-sm" style="text-align: center; padding: 12px 8px;">
            <div style="font-size: 18px; font-weight: 800; color: ${COLORS.navy}; line-height: 1.1;">${formatUsd(terms.regMilestones.median)}</div>
            <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 4px;">Reg Milestones</div>
            <div style="font-size: 8px; color: ${COLORS.gray400}; margin-top: 2px;">${formatUsd(terms.regMilestones.low)} &ndash; ${formatUsd(terms.regMilestones.high)}</div>
          </div>
          <!-- Comm Milestones -->
          <div class="card-sm" style="text-align: center; padding: 12px 8px;">
            <div style="font-size: 18px; font-weight: 800; color: ${COLORS.navy}; line-height: 1.1;">${formatUsd(terms.commMilestones.median)}</div>
            <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 4px;">Comm Milestones</div>
            <div style="font-size: 8px; color: ${COLORS.gray400}; margin-top: 2px;">${formatUsd(terms.commMilestones.low)} &ndash; ${formatUsd(terms.commMilestones.high)}</div>
          </div>
          <!-- Base Royalty Range -->
          <div class="card-sm" style="text-align: center; padding: 12px 8px;">
            <div style="font-size: 18px; font-weight: 800; color: ${COLORS.purple}; line-height: 1.1;">${royaltyRange}</div>
            <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 4px;">Base Royalty Range</div>
            <div style="font-size: 8px; color: ${COLORS.gray400}; margin-top: 2px;">On net sales &lt;$500M</div>
          </div>
          <!-- Recommended Structure -->
          <div class="card-sm" style="text-align: center; padding: 12px 8px;">
            <div style="font-size: 18px; font-weight: 800; color: ${COLORS.teal}; line-height: 1.1;">${rec.upfrontPercent}/${rec.milestonePercent}</div>
            <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.1em; margin-top: 4px;">Recommended Structure</div>
            <div style="font-size: 8px; color: ${COLORS.gray400}; margin-top: 2px;">Upfront% / Milestone%</div>
          </div>
        </div>

        <!-- Key Highlights -->
        <div style="margin-bottom: 16px;">
          <div class="section-title" style="margin-bottom: 8px;">Key Highlights</div>
          <div style="background: ${COLORS.gray50}; border: 1px solid ${COLORS.gray200}; border-radius: 5px; padding: 12px 16px;">
            <ul style="padding-left: 16px; margin: 0; font-size: 9.5px; color: ${COLORS.gray700}; line-height: 1.7;">
              ${topHighlights.map(h => `<li style="margin-bottom: 4px;">${h}</li>`).join('\n              ')}
            </ul>
          </div>
        </div>

        <!-- Footer -->
        <div style="position: absolute; bottom: 24px; left: 48px; right: 48px;">
          <div style="background: ${COLORS.gray50}; border: 1px solid ${COLORS.gray200}; border-radius: 4px; padding: 8px 12px; margin-bottom: 8px;">
            <p style="font-size: 7px; color: ${COLORS.gray400}; line-height: 1.6; margin: 0;">
              This executive summary is generated by the Ambrosia Ventures Deal Benchmarker for informational purposes only. Estimates are based on publicly disclosed deal terms and proprietary benchmarking models. Actual deal terms vary based on asset-specific factors, market conditions, and negotiation dynamics. This does not constitute financial, legal, or investment advice.
            </p>
          </div>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 7px; color: ${COLORS.gray400}; letter-spacing: 0.06em; text-transform: uppercase;">Confidential &middot; ${reportDate}</span>
            <span style="font-size: 7px; color: ${COLORS.gray400}; font-weight: 600; letter-spacing: 0.04em;">${reportId}</span>
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
