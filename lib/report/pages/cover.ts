// Page 1: Cover Page
// Gradient header, logo, headline metric, metadata grid, risk gauge

import { renderRiskGauge } from '../svg-charts/riskGauge';
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
      <div style="background: linear-gradient(135deg, ${COLORS.navy} 0%, #312e81 50%, ${COLORS.navy} 100%); padding: 50px; color: white; position: relative; overflow: hidden;">
        <!-- Decorative circles -->
        <div style="position: absolute; top: -40px; right: -40px; width: 200px; height: 200px; border-radius: 50%; background: rgba(13,148,136,0.1);"></div>
        <div style="position: absolute; bottom: -60px; left: -30px; width: 160px; height: 160px; border-radius: 50%; background: rgba(6,182,212,0.08);"></div>

        <!-- Logo -->
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 40px;">
          <div style="width: 36px; height: 36px; background: linear-gradient(135deg, ${COLORS.teal}, ${COLORS.cyan}); border-radius: 8px;"></div>
          <span style="font-size: 16px; font-weight: 700; letter-spacing: 0.08em;">AMBROSIA VENTURES</span>
        </div>

        <!-- Title -->
        <div style="margin-bottom: 8px;">
          <span style="background: rgba(255,255,255,0.15); padding: 3px 12px; border-radius: 12px; font-size: 9px; font-weight: 600; letter-spacing: 0.1em; text-transform: uppercase;">CONFIDENTIAL</span>
        </div>
        <h1 style="font-size: 32px; font-weight: 700; line-height: 1.2; margin-bottom: 6px;">
          Deal Valuation Report
        </h1>
        <p style="font-size: 14px; color: rgba(255,255,255,0.7); margin-bottom: 30px;">
          ${escapeHtml(phase)} &middot; ${escapeHtml(modality)} &middot; ${escapeHtml(indication)}
        </p>

        <!-- Headline Metric -->
        <div style="background: rgba(255,255,255,0.08); border: 1px solid rgba(255,255,255,0.15); border-radius: 12px; padding: 20px 24px; display: flex; align-items: center; justify-content: space-between;">
          <div>
            <div style="font-size: 10px; color: rgba(255,255,255,0.5); text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px;">Estimated Total Deal Value</div>
            <div style="font-size: 36px; font-weight: 700; color: ${COLORS.tealMid};">${totalMedian}</div>
            <div style="font-size: 12px; color: rgba(255,255,255,0.5);">Range: ${totalLow} &ndash; ${totalHigh}</div>
          </div>
          <div style="text-align: center;">
            ${gaugeHtml}
          </div>
        </div>
      </div>

      <!-- Metadata Grid -->
      <div style="padding: 30px 50px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 16px; margin-bottom: 20px;">
          <div class="card-sm">
            <div style="font-size: 9px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px;">Phase</div>
            <div style="font-size: 14px; font-weight: 600; color: ${COLORS.navy};">${escapeHtml(phase)}</div>
          </div>
          <div class="card-sm">
            <div style="font-size: 9px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px;">Modality</div>
            <div style="font-size: 14px; font-weight: 600; color: ${COLORS.navy};">${escapeHtml(modality)}</div>
          </div>
          <div class="card-sm">
            <div style="font-size: 9px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px;">Indication</div>
            <div style="font-size: 14px; font-weight: 600; color: ${COLORS.navy};">${escapeHtml(indication)}</div>
          </div>
          <div class="card-sm">
            <div style="font-size: 9px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px;">Territory</div>
            <div style="font-size: 14px; font-weight: 600; color: ${COLORS.navy};">${escapeHtml(territory)}</div>
          </div>
        </div>

        <!-- Second row -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 16px; margin-bottom: 20px;">
          <div class="card-sm">
            <div style="font-size: 9px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px;">Therapeutic Area</div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="width: 8px; height: 8px; border-radius: 50%; background: ${taColors.primary};"></span>
              <span style="font-size: 13px; font-weight: 600; color: ${COLORS.navy};">${escapeHtml(taColors.label)}</span>
            </div>
          </div>
          <div class="card-sm">
            <div style="font-size: 9px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px;">Competitive Position</div>
            <div style="font-size: 13px; font-weight: 600; color: ${COLORS.navy};">${escapeHtml(inputs.competitivePosition)}</div>
          </div>
          <div class="card-sm">
            <div style="font-size: 9px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px;">Data Quality</div>
            <div style="font-size: 13px; font-weight: 600; color: ${COLORS.navy};">${escapeHtml(inputs.dataQuality)}</div>
          </div>
          <div class="card-sm">
            <div style="font-size: 9px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 4px;">Risk Score</div>
            <div style="font-size: 13px; font-weight: 600; color: ${riskScore >= 70 ? COLORS.rose : riskScore >= 40 ? COLORS.amber : COLORS.green};">${riskScore}/100</div>
          </div>
        </div>

        <!-- Footer info -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 16px; border-top: 1px solid ${COLORS.gray200};">
          <span style="font-size: 9px; color: ${COLORS.gray400};">Report ID: ${meta.reportId} &middot; Generated ${formatDate()}</span>
          <span style="font-size: 9px; color: ${COLORS.gray400};">Ambrosia Ventures &middot; calculator.ambrosiaventures.co</span>
        </div>
      </div>
    </div>
  `;
}
