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
  const gaugeHtml = renderRiskGauge(riskScore, 100);

  return `
    <div class="report-page cover-page">
      <!-- Gradient Header -->
      <div style="background: linear-gradient(145deg, ${COLORS.navy} 0%, #252a5e 40%, #1e2556 100%); padding: 48px 52px; color: white; position: relative; overflow: hidden; min-height: 360px;">
        <!-- Subtle gradient overlay -->
        <div style="position: absolute; top: 0; right: 0; bottom: 0; left: 60%; background: linear-gradient(135deg, transparent 0%, rgba(13,148,136,0.06) 100%);"></div>

        <!-- Logo + Brand -->
        <div style="margin-bottom: 52px; position: relative;">
          ${logoFullWhite(220)}
        </div>

        <!-- Title Block -->
        <div style="margin-bottom: 8px; position: relative;">
          <span style="background: rgba(255,255,255,0.12); padding: 4px 14px; border-radius: 3px; font-size: 9px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;">Confidential</span>
        </div>
        <h1 style="font-size: 38px; font-weight: 800; line-height: 1.12; margin-bottom: 8px; letter-spacing: -0.02em; position: relative;">
          Deal Valuation Report
        </h1>
        <p style="font-size: 14px; color: rgba(255,255,255,0.65); margin-bottom: 36px; letter-spacing: 0.02em; position: relative;">
          ${escapeHtml(phase)} &middot; ${escapeHtml(modality)} &middot; ${escapeHtml(indication)}
        </p>

        <!-- Headline Metric Card -->
        <div style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 22px 26px; display: flex; align-items: center; justify-content: space-between; position: relative;">
          <div>
            <div style="font-size: 9px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.14em; font-weight: 700; margin-bottom: 5px;">Estimated Total Deal Value</div>
            <div style="font-size: 36px; font-weight: 800; color: ${COLORS.tealMid}; letter-spacing: -0.02em; line-height: 1;">${totalMedian}</div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.4); margin-top: 5px;">Range: ${totalLow} &ndash; ${totalHigh}</div>
          </div>
          <div style="text-align: center; flex-shrink: 0; margin-left: 28px;">
            ${gaugeHtml}
          </div>
        </div>
      </div>

      <!-- Metadata Grid -->
      <div style="padding: 32px 52px;">
        <!-- Row 1: Core parameters -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 14px; margin-bottom: 16px;">
          ${[
            { label: 'Phase', value: phase },
            { label: 'Modality', value: modality },
            { label: 'Indication', value: indication },
            { label: 'Territory', value: territory },
          ].map(item => `
            <div style="border: 1px solid ${COLORS.gray200}; border-radius: 5px; padding: 14px 16px;">
              <div style="font-size: 9px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; margin-bottom: 4px;">${item.label}</div>
              <div style="font-size: 13px; font-weight: 600; color: ${COLORS.navy}; line-height: 1.3;">${escapeHtml(item.value)}</div>
            </div>
          `).join('')}
        </div>

        <!-- Row 2: Secondary parameters -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 14px; margin-bottom: 28px;">
          <div style="border: 1px solid ${COLORS.gray200}; border-radius: 5px; padding: 14px 16px;">
            <div style="font-size: 9px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; margin-bottom: 4px;">Therapeutic Area</div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: ${taColors.primary};"></span>
              <span style="font-size: 13px; font-weight: 600; color: ${COLORS.navy};">${escapeHtml(taColors.label)}</span>
            </div>
          </div>
          <div style="border: 1px solid ${COLORS.gray200}; border-radius: 5px; padding: 14px 16px;">
            <div style="font-size: 9px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; margin-bottom: 4px;">Competitive Position</div>
            <div style="font-size: 13px; font-weight: 600; color: ${COLORS.navy};">${escapeHtml(inputs.competitivePosition.replace(/([A-Z])/g, ' $1').trim())}</div>
          </div>
          <div style="border: 1px solid ${COLORS.gray200}; border-radius: 5px; padding: 14px 16px;">
            <div style="font-size: 9px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; margin-bottom: 4px;">Data Quality</div>
            <div style="font-size: 13px; font-weight: 600; color: ${COLORS.navy};">${escapeHtml(inputs.dataQuality.replace(/([A-Z])/g, ' $1').trim())}</div>
          </div>
          <div style="border: 1px solid ${COLORS.gray200}; border-radius: 5px; padding: 14px 16px;">
            <div style="font-size: 9px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; margin-bottom: 4px;">Risk Score</div>
            <div style="font-size: 13px; font-weight: 700; color: ${riskScore >= 70 ? COLORS.rose : riskScore >= 40 ? COLORS.amber : COLORS.green};">${riskScore}/100</div>
          </div>
        </div>

        <!-- Footer -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 16px; border-top: 1px solid ${COLORS.gray200};">
          <span style="font-size: 9px; color: ${COLORS.gray400}; letter-spacing: 0.02em;">Report ID: ${meta.reportId} &middot; Generated ${formatDate()}</span>
          <span style="font-size: 9px; color: ${COLORS.gray400}; letter-spacing: 0.02em;">Ambrosia Ventures &middot; calculator.ambrosiaventures.co</span>
        </div>
      </div>
    </div>
  `;
}
