// Page 1: Cover Page
// Premium gradient header, headline metric, metadata grid, risk gauge

import { renderRiskGauge } from '../svg-charts/riskGauge';
import { logoFullWhite } from '../logo';
import { formatUsd, formatDate, escapeHtml, phaseLabels, territoryLabels, modalityLabels, getLabel, COLORS, getTAColors } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';

export function renderCoverPage(data: PDFReportData, meta: ReportMeta): string {
  const { result, inputs, riskScore } = data;
  const taColors = getTAColors(inputs.therapeuticArea);
  const phase = getLabel(inputs.phase, phaseLabels);
  const modality = result.labels.modality || getLabel(inputs.modality, modalityLabels);
  const indication = result.labels.indication || inputs.indication;
  const territory = getLabel(inputs.territory, territoryLabels);
  const totalLow = formatUsd(result.terms.totalDealValue.low);
  const totalHigh = formatUsd(result.terms.totalDealValue.high);
  const totalMedian = formatUsd(result.terms.totalDealValue.median);
  const gaugeHtml = renderRiskGauge(riskScore, 90);

  return `
    <div class="report-page cover-page">
      <!-- Gradient Header -->
      <div style="background: linear-gradient(150deg, #151838 0%, #1a1e42 35%, #1e2556 70%, #232a5c 100%); padding: 44px 48px; color: white; position: relative; overflow: hidden; min-height: 340px;">
        <!-- Subtle teal accent line at top -->
        <div style="position: absolute; top: 0; left: 0; right: 0; height: 3px; background: linear-gradient(90deg, #0d9488, #06b6d4, transparent);"></div>

        <!-- Logo + Brand -->
        <div style="margin-bottom: 44px; position: relative;">
          ${logoFullWhite(200)}
        </div>

        <!-- Title Block -->
        <div style="margin-bottom: 6px; position: relative;">
          <span style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.12); padding: 3px 12px; border-radius: 2px; font-size: 8px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase;">Confidential</span>
        </div>
        <h1 style="font-size: 34px; font-weight: 800; line-height: 1.1; margin-bottom: 6px; letter-spacing: -0.025em; position: relative;">
          Deal Valuation Report
        </h1>
        <p style="font-size: 13px; color: rgba(255,255,255,0.55); margin-bottom: 32px; letter-spacing: 0.02em; position: relative; font-weight: 400;">
          ${escapeHtml(phase)} &middot; ${escapeHtml(modality)} &middot; ${escapeHtml(indication)}
        </p>

        <!-- Headline Metric Card -->
        <div style="background: rgba(255,255,255,0.04); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 20px 24px; display: flex; align-items: center; justify-content: space-between; position: relative;">
          <div>
            <div style="font-size: 8px; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 0.16em; font-weight: 700; margin-bottom: 4px;">Estimated Total Deal Value</div>
            <div style="font-size: 32px; font-weight: 800; color: ${COLORS.tealMid}; letter-spacing: -0.03em; line-height: 1;">${totalMedian}</div>
            <div style="font-size: 11px; color: rgba(255,255,255,0.35); margin-top: 4px; font-weight: 400;">Range: ${totalLow} &ndash; ${totalHigh}</div>
          </div>
          <div style="text-align: center; flex-shrink: 0; margin-left: 24px;">
            ${gaugeHtml}
          </div>
        </div>
      </div>

      <!-- Metadata Grid -->
      <div style="padding: 28px 48px;">
        <!-- Row 1: Core parameters -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px; margin-bottom: 10px;">
          ${[
            { label: 'Phase', value: phase },
            { label: 'Modality', value: modality },
            { label: 'Indication', value: indication },
            { label: 'Territory', value: territory },
          ].map(item => `
            <div style="border: 1px solid ${COLORS.gray200}; border-radius: 4px; padding: 12px 14px;">
              <div style="font-size: 8px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; margin-bottom: 3px;">${item.label}</div>
              <div style="font-size: 12px; font-weight: 600; color: ${COLORS.navy}; line-height: 1.3;">${escapeHtml(item.value)}</div>
            </div>
          `).join('')}
        </div>

        <!-- Row 2: Secondary parameters -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px; margin-bottom: 24px;">
          <div style="border: 1px solid ${COLORS.gray200}; border-radius: 4px; padding: 12px 14px;">
            <div style="font-size: 8px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; margin-bottom: 3px;">Therapeutic Area</div>
            <div style="display: flex; align-items: center; gap: 5px;">
              <span style="width: 7px; height: 7px; border-radius: 50%; background: ${taColors.primary};"></span>
              <span style="font-size: 12px; font-weight: 600; color: ${COLORS.navy};">${escapeHtml(taColors.label)}</span>
            </div>
          </div>
          <div style="border: 1px solid ${COLORS.gray200}; border-radius: 4px; padding: 12px 14px;">
            <div style="font-size: 8px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; margin-bottom: 3px;">Competitive Position</div>
            <div style="font-size: 12px; font-weight: 600; color: ${COLORS.navy};">${escapeHtml(inputs.competitivePosition.replace(/([A-Z])/g, ' $1').trim())}</div>
          </div>
          <div style="border: 1px solid ${COLORS.gray200}; border-radius: 4px; padding: 12px 14px;">
            <div style="font-size: 8px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; margin-bottom: 3px;">Data Quality</div>
            <div style="font-size: 12px; font-weight: 600; color: ${COLORS.navy};">${escapeHtml(inputs.dataQuality.replace(/([A-Z])/g, ' $1').trim())}</div>
          </div>
          <div style="border: 1px solid ${COLORS.gray200}; border-radius: 4px; padding: 12px 14px;">
            <div style="font-size: 8px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; font-weight: 700; margin-bottom: 3px;">Risk Score</div>
            <div style="font-size: 12px; font-weight: 700; color: ${riskScore >= 70 ? COLORS.rose : riskScore >= 40 ? COLORS.amber : COLORS.green};">${riskScore}/100</div>
          </div>
        </div>

        <!-- Footer -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 12px; border-top: 1px solid ${COLORS.gray200};">
          <span style="font-size: 8px; color: ${COLORS.gray400}; letter-spacing: 0.02em;">Report ID: ${meta.reportId} &middot; Generated ${formatDate()}</span>
          <span style="font-size: 8px; color: ${COLORS.gray400}; letter-spacing: 0.02em;">Ambrosia Ventures &middot; calculator.ambrosiaventures.co</span>
        </div>
      </div>
    </div>
  `;
}
