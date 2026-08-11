import {
  formatUsd,
  generateReportId,
  formatDate,
  COLORS,
  getTAColors,
  getLabel,
  phaseLabels,
  modalityLabels,
  competitivePositionLabels,
  territoryLabels,
  escapeHtml,
} from '../../helpers';
import { logoFullWhite } from '../../logo';
import type { CompReportData } from '../types';

export function renderCompReportCover(data: CompReportData): { html: string; reportId: string; reportDate: string } {
  const { inputs, benchmarkRange, comparableDeals, assetName, assetCode, preparedFor } = data;
  const reportId = generateReportId();
  const reportDate = formatDate();
  const taColors = getTAColors(inputs.therapeuticArea);

  const phaseLabel = escapeHtml(getLabel(inputs.phase, phaseLabels));
  const modalityLabel = escapeHtml(getLabel(inputs.modality, modalityLabels));
  const indicationLabel = escapeHtml(inputs.indication);
  const territoryLabel = escapeHtml(getLabel(inputs.territory, territoryLabels));
  const positionLabel = inputs.competitivePosition
    ? escapeHtml(getLabel(inputs.competitivePosition, competitivePositionLabels))
    : null;

  const displayName = assetName
    ? `${escapeHtml(assetName)}${assetCode ? ` (${escapeHtml(assetCode)})` : ''}`
    : 'Asset Under Review';

  const medianTDV = formatUsd(benchmarkRange.totalDealValue.median);
  const medianUpfront = formatUsd(benchmarkRange.upfront.median);

  const html = `
    <div class="report-page cover-page">
      <!-- Navy header block -->
      <div style="
        background: linear-gradient(155deg, #0f1229 0%, #1a1e42 50%, #252a5e 100%);
        padding: 48px 56px 44px 56px;
        position: relative;
        overflow: hidden;
      ">
        <!-- Subtle radial accents -->
        <div style="position: absolute; top: 0; right: 0; width: 300px; height: 100%; background: radial-gradient(circle at 80% 30%, rgba(13,148,136,0.06) 0%, transparent 60%);"></div>
        <div style="position: absolute; bottom: 0; left: 0; width: 200px; height: 100%; background: radial-gradient(circle at 20% 80%, rgba(6,182,212,0.04) 0%, transparent 60%);"></div>

        <!-- Logo -->
        <div style="margin-bottom: 40px; position: relative;">
          ${logoFullWhite(180)}
        </div>

        <!-- Teal accent line -->
        <div style="width: 60px; height: 3px; background: linear-gradient(90deg, ${COLORS.teal}, ${COLORS.cyan}); margin-bottom: 28px;"></div>

        <!-- Title -->
        <div style="position: relative;">
          <div style="font-size: 11px; font-weight: 200; color: ${COLORS.tealMid}; text-transform: uppercase; letter-spacing: 0.28em; margin-bottom: 14px;">Comparable Transaction Analysis</div>
          <div style="font-size: 32px; font-weight: 800; color: ${COLORS.white}; line-height: 1.15; letter-spacing: -0.02em; margin-bottom: 6px;">${displayName}</div>
          <div style="font-size: 14px; font-weight: 400; color: rgba(255,255,255,0.5); letter-spacing: 0.01em;">${modalityLabel} &middot; ${indicationLabel}</div>
        </div>

        <!-- Prepared for -->
        ${preparedFor ? `
          <div style="margin-top: 32px; padding-top: 20px; border-top: 1px solid rgba(255,255,255,0.08);">
            <div style="font-size: 8px; font-weight: 200; color: rgba(255,255,255,0.3); text-transform: uppercase; letter-spacing: 0.18em; margin-bottom: 6px;">Prepared for</div>
            <div style="font-size: 15px; font-weight: 600; color: ${COLORS.white}; letter-spacing: 0.01em;">${escapeHtml(preparedFor)}</div>
          </div>
        ` : ''}
      </div>

      <!-- Asset summary card -->
      <div style="padding: 36px 56px 0 56px;">
        <div style="
          display: flex;
          align-items: center;
          gap: 0;
          padding: 16px 24px;
          background: ${COLORS.gray50};
          border: 1px solid ${COLORS.gray200};
          border-radius: 8px;
          margin-bottom: 28px;
        ">
          <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${taColors.primary}; margin-right: 12px; flex-shrink: 0;"></span>
          <span style="font-size: 12px; font-weight: 600; color: ${COLORS.navy};">${escapeHtml(taColors.label)}</span>
          <span style="display: inline-block; width: 1px; height: 20px; background: ${COLORS.gray300}; margin: 0 18px; flex-shrink: 0;"></span>
          <span style="font-size: 12px; font-weight: 600; color: ${COLORS.navy};">${phaseLabel}</span>
          <span style="display: inline-block; width: 1px; height: 20px; background: ${COLORS.gray300}; margin: 0 18px; flex-shrink: 0;"></span>
          <span style="font-size: 12px; font-weight: 600; color: ${COLORS.navy};">${territoryLabel}</span>
          ${positionLabel ? `
            <span style="display: inline-block; width: 1px; height: 20px; background: ${COLORS.gray300}; margin: 0 18px; flex-shrink: 0;"></span>
            <span style="font-size: 12px; font-weight: 600; color: ${COLORS.navy};">${positionLabel}</span>
          ` : ''}
        </div>

        <!-- Headline benchmark metrics -->
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; margin-bottom: 28px;">
          <div style="
            background: linear-gradient(155deg, #0f1229 0%, #1a1e42 100%);
            border-radius: 8px;
            padding: 20px 24px;
            border-bottom: 3px solid ${COLORS.teal};
          ">
            <div style="font-size: 8px; font-weight: 200; color: ${COLORS.tealMid}; text-transform: uppercase; letter-spacing: 0.16em; margin-bottom: 8px;">Median Deal Value</div>
            <div style="font-size: 28px; font-weight: 800; color: ${COLORS.white}; line-height: 1; letter-spacing: -0.02em;">${medianTDV}</div>
            <div style="font-size: 9px; color: rgba(255,255,255,0.35); margin-top: 6px;">P25: ${formatUsd(benchmarkRange.totalDealValue.p25)} &middot; P75: ${formatUsd(benchmarkRange.totalDealValue.p75)}</div>
          </div>
          <div style="
            background: linear-gradient(155deg, #0f1229 0%, #1a1e42 100%);
            border-radius: 8px;
            padding: 20px 24px;
            border-bottom: 3px solid ${COLORS.cyan};
          ">
            <div style="font-size: 8px; font-weight: 200; color: ${COLORS.tealMid}; text-transform: uppercase; letter-spacing: 0.16em; margin-bottom: 8px;">Median Upfront</div>
            <div style="font-size: 28px; font-weight: 800; color: ${COLORS.white}; line-height: 1; letter-spacing: -0.02em;">${medianUpfront}</div>
            <div style="font-size: 9px; color: rgba(255,255,255,0.35); margin-top: 6px;">P25: ${formatUsd(benchmarkRange.upfront.p25)} &middot; P75: ${formatUsd(benchmarkRange.upfront.p75)}</div>
          </div>
          <div style="
            background: linear-gradient(155deg, #0f1229 0%, #1a1e42 100%);
            border-radius: 8px;
            padding: 20px 24px;
            border-bottom: 3px solid ${COLORS.purple};
          ">
            <div style="font-size: 8px; font-weight: 200; color: ${COLORS.tealMid}; text-transform: uppercase; letter-spacing: 0.16em; margin-bottom: 8px;">Comparable Set</div>
            <div style="font-size: 28px; font-weight: 800; color: ${COLORS.white}; line-height: 1; letter-spacing: -0.02em;">n=${benchmarkRange.compCount}</div>
            <div style="font-size: 9px; color: rgba(255,255,255,0.35); margin-top: 6px;">${benchmarkRange.yearRange.min}–${benchmarkRange.yearRange.max}</div>
          </div>
        </div>

        <!-- Disclaimer line -->
        <div style="font-size: 8px; color: ${COLORS.gray400}; line-height: 1.6; margin-bottom: 0;">
          This analysis identifies and scores comparable transactions using a six-dimension hedonic regression model with recency weighting. All deal data is sourced from publicly disclosed terms, SEC filings, and proprietary databases. This document is confidential and does not constitute financial, legal, or investment advice.
        </div>
      </div>

      <!-- Footer -->
      <div style="position: absolute; bottom: 28px; left: 56px; right: 56px;">
        <div style="height: 1.5px; background: linear-gradient(90deg, ${COLORS.teal}, ${COLORS.cyan}, transparent); margin-bottom: 12px;"></div>
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <span style="font-size: 7.5px; color: ${COLORS.gray400}; letter-spacing: 0.08em; text-transform: uppercase; font-weight: 600;">Confidential &middot; ${reportDate}</span>
          <span style="font-size: 7.5px; color: ${COLORS.teal}; font-weight: 700; letter-spacing: 0.04em;">${reportId}</span>
        </div>
      </div>
    </div>
  `;

  return { html, reportId, reportDate };
}
