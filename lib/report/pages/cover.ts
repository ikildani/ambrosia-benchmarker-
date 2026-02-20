// Page 1: Cover Page
// Premium gradient header, headline metric, metadata grid, risk gauge

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
  const gaugeHtml = renderRiskGauge(riskScore, 80);

  return `
    <div class="report-page cover-page">
      <!-- Gradient Header -->
      <div style="background: linear-gradient(145deg, ${COLORS.navy} 0%, #252a5e 40%, #1e2556 100%); padding: 44px; color: white; position: relative; overflow: hidden; min-height: 340px;">
        <!-- Subtle geometric accents -->
        <div style="position: absolute; top: -60px; right: -60px; width: 240px; height: 240px; border-radius: 50%; border: 1px solid rgba(13,148,136,0.12);"></div>
        <div style="position: absolute; top: -20px; right: -20px; width: 160px; height: 160px; border-radius: 50%; border: 1px solid rgba(13,148,136,0.08);"></div>
        <div style="position: absolute; bottom: -40px; left: 30%; width: 200px; height: 200px; border-radius: 50%; background: rgba(6,182,212,0.04);"></div>

        <!-- Logo + Brand -->
        <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 48px;">
          <div style="width: 32px; height: 32px; background: linear-gradient(135deg, ${COLORS.teal}, ${COLORS.cyan}); border-radius: 6px;"></div>
          <span style="font-size: 13px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;">Ambrosia Ventures</span>
        </div>

        <!-- Title Block -->
        <div style="margin-bottom: 6px;">
          <span style="background: rgba(255,255,255,0.12); padding: 3px 12px; border-radius: 3px; font-size: 8px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase;">Confidential</span>
        </div>
        <h1 style="font-size: 28px; font-weight: 700; line-height: 1.15; margin-bottom: 6px; letter-spacing: -0.02em;">
          Deal Valuation Report
        </h1>
        <p style="font-size: 12px; color: rgba(255,255,255,0.55); margin-bottom: 32px; letter-spacing: 0.02em;">
          ${escapeHtml(phase)} &middot; ${escapeHtml(modality)} &middot; ${escapeHtml(indication)}
        </p>

        <!-- Headline Metric Card -->
        <div style="background: rgba(255,255,255,0.06); border: 1px solid rgba(255,255,255,0.1); border-radius: 8px; padding: 18px 22px; display: flex; align-items: center; justify-content: space-between;">
          <div>
            <div style="font-size: 8px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.14em; font-weight: 700; margin-bottom: 4px;">Estimated Total Deal Value</div>
            <div style="font-size: 32px; font-weight: 700; color: ${COLORS.tealMid}; letter-spacing: -0.02em; line-height: 1;">${totalMedian}</div>
            <div style="font-size: 11px; color: rgba(255,255,255,0.4); margin-top: 4px;">Range: ${totalLow} &ndash; ${totalHigh}</div>
          </div>
          <div style="text-align: center; flex-shrink: 0; margin-left: 24px;">
            ${gaugeHtml}
          </div>
        </div>
      </div>

      <!-- Metadata Grid -->
      <div style="padding: 28px 44px;">
        <!-- Row 1: Core parameters -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; margin-bottom: 14px;">
          ${[
            { label: 'Phase', value: phase },
            { label: 'Modality', value: modality },
            { label: 'Indication', value: indication },
            { label: 'Territory', value: territory },
          ].map(item => `
            <div style="border: 1px solid ${COLORS.gray200}; border-radius: 5px; padding: 10px 12px;">
              <div style="font-size: 8px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; margin-bottom: 3px;">${item.label}</div>
              <div style="font-size: 12px; font-weight: 600; color: ${COLORS.navy}; line-height: 1.3;">${escapeHtml(item.value)}</div>
            </div>
          `).join('')}
        </div>

        <!-- Row 2: Secondary parameters -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 12px; margin-bottom: 24px;">
          <div style="border: 1px solid ${COLORS.gray200}; border-radius: 5px; padding: 10px 12px;">
            <div style="font-size: 8px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; margin-bottom: 3px;">Therapeutic Area</div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="width: 7px; height: 7px; border-radius: 50%; background: ${taColors.primary};"></span>
              <span style="font-size: 12px; font-weight: 600; color: ${COLORS.navy};">${escapeHtml(taColors.label)}</span>
            </div>
          </div>
          <div style="border: 1px solid ${COLORS.gray200}; border-radius: 5px; padding: 10px 12px;">
            <div style="font-size: 8px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; margin-bottom: 3px;">Competitive Position</div>
            <div style="font-size: 12px; font-weight: 600; color: ${COLORS.navy};">${escapeHtml(inputs.competitivePosition.replace(/([A-Z])/g, ' $1').trim())}</div>
          </div>
          <div style="border: 1px solid ${COLORS.gray200}; border-radius: 5px; padding: 10px 12px;">
            <div style="font-size: 8px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; margin-bottom: 3px;">Data Quality</div>
            <div style="font-size: 12px; font-weight: 600; color: ${COLORS.navy};">${escapeHtml(inputs.dataQuality.replace(/([A-Z])/g, ' $1').trim())}</div>
          </div>
          <div style="border: 1px solid ${COLORS.gray200}; border-radius: 5px; padding: 10px 12px;">
            <div style="font-size: 8px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; margin-bottom: 3px;">Risk Score</div>
            <div style="font-size: 12px; font-weight: 700; color: ${riskScore >= 70 ? COLORS.rose : riskScore >= 40 ? COLORS.amber : COLORS.green};">${riskScore}/100</div>
          </div>
        </div>

        <!-- Footer -->
        <div style="display: flex; justify-content: space-between; align-items: center; padding-top: 14px; border-top: 1px solid ${COLORS.gray200};">
          <span style="font-size: 8px; color: ${COLORS.gray400}; letter-spacing: 0.02em;">Report ID: ${meta.reportId} &middot; Generated ${formatDate()}</span>
          <span style="font-size: 8px; color: ${COLORS.gray400}; letter-spacing: 0.02em;">Ambrosia Ventures &middot; calculator.ambrosiaventures.co</span>
        </div>
      </div>
    </div>
  `;
}
