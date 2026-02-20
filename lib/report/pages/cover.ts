// Page 1: Cover Page
// Premium dark header with bold metrics, metadata grid below

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
  const upfrontMedian = formatUsd(result.terms.upfront.median);
  const gaugeHtml = renderRiskGauge(riskScore, 90);

  return `
    <div class="report-page cover-page">
      <!-- Dark Header Block -->
      <div style="background: linear-gradient(155deg, #0f1229 0%, #1a1e42 40%, #1e2556 80%, #252a5e 100%); padding: 44px 48px 40px; color: white; position: relative; overflow: hidden;">
        <!-- Top accent line -->
        <div style="position: absolute; top: 0; left: 0; right: 0; height: 4px; background: linear-gradient(90deg, #0d9488 0%, #06b6d4 50%, #0d9488 100%);"></div>

        <!-- Logo -->
        <div style="margin-bottom: 40px; position: relative;">
          ${logoFullWhite(190)}
        </div>

        <!-- Title -->
        <div style="margin-bottom: 6px; position: relative;">
          <span style="background: rgba(13,148,136,0.15); border: 1px solid rgba(13,148,136,0.3); padding: 3px 14px; border-radius: 3px; font-size: 8px; font-weight: 700; letter-spacing: 0.18em; text-transform: uppercase; color: #5eead4;">Confidential</span>
        </div>
        <h1 style="font-size: 32px; font-weight: 800; line-height: 1.1; margin-bottom: 5px; letter-spacing: -0.03em; position: relative;">
          Deal Valuation Report
        </h1>
        <p style="font-size: 12px; color: rgba(255,255,255,0.45); margin-bottom: 28px; letter-spacing: 0.03em; position: relative; font-weight: 400;">
          ${escapeHtml(phase)} &middot; ${escapeHtml(modality)} &middot; ${escapeHtml(indication)}
        </p>

        <!-- Key Metrics Row -->
        <div style="display: grid; grid-template-columns: 1fr 1fr auto; gap: 16px; position: relative;">
          <!-- Total Deal Value -->
          <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 18px 20px;">
            <div style="font-size: 7px; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 0.18em; font-weight: 700; margin-bottom: 6px;">Total Deal Value</div>
            <div style="font-size: 30px; font-weight: 800; color: #5eead4; letter-spacing: -0.03em; line-height: 1;">${totalMedian}</div>
            <div style="font-size: 10px; color: rgba(255,255,255,0.3); margin-top: 4px;">${totalLow} &ndash; ${totalHigh}</div>
          </div>
          <!-- Upfront -->
          <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 18px 20px;">
            <div style="font-size: 7px; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 0.18em; font-weight: 700; margin-bottom: 6px;">Upfront Payment</div>
            <div style="font-size: 30px; font-weight: 800; color: #ffffff; letter-spacing: -0.03em; line-height: 1;">${upfrontMedian}</div>
            <div style="font-size: 10px; color: rgba(255,255,255,0.3); margin-top: 4px;">${formatUsd(result.terms.upfront.low)} &ndash; ${formatUsd(result.terms.upfront.high)}</div>
          </div>
          <!-- Risk Gauge -->
          <div style="background: rgba(255,255,255,0.05); border: 1px solid rgba(255,255,255,0.08); border-radius: 6px; padding: 12px 16px; display: flex; align-items: center; justify-content: center;">
            ${gaugeHtml}
          </div>
        </div>
      </div>

      <!-- Metadata Grid -->
      <div style="padding: 24px 48px;">
        <!-- Row 1: Core parameters -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px; margin-bottom: 10px;">
          ${[
            { label: 'Phase', value: phase },
            { label: 'Modality', value: modality },
            { label: 'Indication', value: indication },
            { label: 'Territory', value: territory },
          ].map(item => `
            <div style="border-left: 3px solid #0d9488; padding: 10px 14px; background: #f8fafc; border-radius: 0 4px 4px 0;">
              <div style="font-size: 7px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.14em; font-weight: 700; margin-bottom: 2px;">${item.label}</div>
              <div style="font-size: 12px; font-weight: 700; color: ${COLORS.navy}; line-height: 1.3;">${escapeHtml(item.value)}</div>
            </div>
          `).join('')}
        </div>

        <!-- Row 2: Secondary parameters -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px; margin-bottom: 20px;">
          <div style="border-left: 3px solid ${taColors.primary}; padding: 10px 14px; background: #f8fafc; border-radius: 0 4px 4px 0;">
            <div style="font-size: 7px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.14em; font-weight: 700; margin-bottom: 2px;">Therapeutic Area</div>
            <div style="display: flex; align-items: center; gap: 5px;">
              <span style="width: 7px; height: 7px; border-radius: 50%; background: ${taColors.primary};"></span>
              <span style="font-size: 12px; font-weight: 700; color: ${COLORS.navy};">${escapeHtml(taColors.label)}</span>
            </div>
          </div>
          <div style="border-left: 3px solid ${COLORS.navy}; padding: 10px 14px; background: #f8fafc; border-radius: 0 4px 4px 0;">
            <div style="font-size: 7px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.14em; font-weight: 700; margin-bottom: 2px;">Competitive Position</div>
            <div style="font-size: 12px; font-weight: 700; color: ${COLORS.navy};">${escapeHtml(inputs.competitivePosition.replace(/([A-Z])/g, ' $1').trim())}</div>
          </div>
          <div style="border-left: 3px solid ${COLORS.navy}; padding: 10px 14px; background: #f8fafc; border-radius: 0 4px 4px 0;">
            <div style="font-size: 7px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.14em; font-weight: 700; margin-bottom: 2px;">Data Quality</div>
            <div style="font-size: 12px; font-weight: 700; color: ${COLORS.navy};">${escapeHtml(inputs.dataQuality.replace(/([A-Z])/g, ' $1').trim())}</div>
          </div>
          <div style="border-left: 3px solid ${riskScore >= 70 ? COLORS.rose : riskScore >= 40 ? COLORS.amber : COLORS.green}; padding: 10px 14px; background: #f8fafc; border-radius: 0 4px 4px 0;">
            <div style="font-size: 7px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.14em; font-weight: 700; margin-bottom: 2px;">Risk Score</div>
            <div style="font-size: 12px; font-weight: 800; color: ${riskScore >= 70 ? COLORS.rose : riskScore >= 40 ? COLORS.amber : COLORS.green};">${riskScore} / 100</div>
          </div>
        </div>

        <!-- Footer bar -->
        <div style="background: #f8fafc; border-radius: 4px; padding: 10px 16px; display: flex; justify-content: space-between; align-items: center; border: 1px solid #e2e8f0;">
          <span style="font-size: 8px; color: ${COLORS.gray500}; font-weight: 600;">${meta.reportId} &middot; Generated ${formatDate()}</span>
          <span style="font-size: 8px; color: ${COLORS.gray400};">Ambrosia Ventures &middot; calculator.ambrosiaventures.co</span>
        </div>
      </div>
    </div>
  `;
}
