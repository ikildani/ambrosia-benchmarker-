// Page: Scenario Comparison — Bear / Base / Bull
// Three-column side-by-side with expected value callout and assumption details

import { formatUsd, formatPercent, pageHeader, pageFooter, COLORS, escapeHtml } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';

/**
 * Renders an inline SVG bar comparing three scenario values with a baseline marker.
 */
function renderScenarioBar(bear: number, base: number, bull: number): string {
  const w = 520;
  const h = 40;
  const pad = 10;
  const barH = 14;
  const barY = (h - barH) / 2;
  const min = Math.min(bear, 0) * 1.1;
  const max = bull * 1.2;
  const range = max - min || 1;
  const x = (v: number) => pad + ((v - min) / range) * (w - 2 * pad);

  const uid = `sc-${Math.random().toString(36).slice(2, 8)}`;

  return `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="${uid}-grad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="${COLORS.rose}" stop-opacity="0.8" />
          <stop offset="50%" stop-color="${COLORS.teal}" stop-opacity="0.8" />
          <stop offset="100%" stop-color="${COLORS.green}" stop-opacity="0.8" />
        </linearGradient>
      </defs>
      <!-- Track -->
      <rect x="${pad}" y="${barY}" width="${w - 2 * pad}" height="${barH}" rx="7" fill="${COLORS.gray100}" />
      <!-- Gradient range bar -->
      <rect x="${x(bear)}" y="${barY}" width="${Math.max(x(bull) - x(bear), 2)}" height="${barH}" rx="7" fill="url(#${uid}-grad)" />
      <!-- Bear marker -->
      <circle cx="${x(bear)}" cy="${barY + barH / 2}" r="5" fill="${COLORS.rose}" stroke="white" stroke-width="1.5" />
      <!-- Base marker -->
      <circle cx="${x(base)}" cy="${barY + barH / 2}" r="5" fill="${COLORS.teal}" stroke="white" stroke-width="1.5" />
      <!-- Bull marker -->
      <circle cx="${x(bull)}" cy="${barY + barH / 2}" r="5" fill="${COLORS.green}" stroke="white" stroke-width="1.5" />
      <!-- Labels -->
      <text x="${x(bear)}" y="${barY - 3}" text-anchor="middle" font-size="8" font-weight="700" fill="${COLORS.rose}">${formatUsd(bear)}</text>
      <text x="${x(base)}" y="${barY - 3}" text-anchor="middle" font-size="8" font-weight="700" fill="${COLORS.teal}">${formatUsd(base)}</text>
      <text x="${x(bull)}" y="${barY - 3}" text-anchor="middle" font-size="8" font-weight="700" fill="${COLORS.green}">${formatUsd(bull)}</text>
    </svg>
  `;
}

export function renderScenarioComparisonPage(data: PDFReportData, meta: ReportMeta): string {
  if (!data.scenarioComparison) return '';

  const sc = data.scenarioComparison;

  const scenarioColumn = (
    label: string,
    scenario: { rnpv: number; impliedDeal: number; cumulativePoS: number; yearsToMarket: number; assumptions: string[] },
    accentColor: string,
    bgTint: string,
    weight: number,
  ) => `
    <div style="flex: 1; border: 1px solid ${COLORS.gray200}; border-top: 4px solid ${accentColor}; border-radius: 6px; background: ${bgTint}; padding: 16px 14px; display: flex; flex-direction: column; gap: 10px;">
      <!-- Scenario label -->
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <span style="font-size: 9px; font-weight: 800; color: ${accentColor}; text-transform: uppercase; letter-spacing: 0.14em;">${label}</span>
        <span style="font-size: 8px; font-weight: 700; color: ${COLORS.gray400}; background: ${COLORS.gray100}; padding: 2px 8px; border-radius: 3px;">${formatPercent(weight * 100, 0)} wt.</span>
      </div>
      <!-- rNPV -->
      <div>
        <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 2px;">Risk-Adjusted NPV</div>
        <div style="font-size: 26px; font-weight: 800; color: ${accentColor}; letter-spacing: -0.03em; line-height: 1;">${formatUsd(scenario.rnpv)}</div>
      </div>
      <!-- Implied Deal Value -->
      <div>
        <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 2px;">Implied Deal Value</div>
        <div style="font-size: 18px; font-weight: 800; color: ${COLORS.navy}; letter-spacing: -0.02em;">${formatUsd(scenario.impliedDeal)}</div>
      </div>
      <!-- Cumulative PoS -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-top: 1px solid ${COLORS.gray200};">
        <span style="font-size: 8px; font-weight: 600; color: ${COLORS.gray500};">Cumulative PoS</span>
        <span style="font-size: 12px; font-weight: 800; color: ${COLORS.navy};">${formatPercent(scenario.cumulativePoS * 100, 1)}</span>
      </div>
      <!-- Years to Market -->
      <div style="display: flex; justify-content: space-between; align-items: center; padding: 6px 0; border-top: 1px solid ${COLORS.gray200};">
        <span style="font-size: 8px; font-weight: 600; color: ${COLORS.gray500};">Years to Market</span>
        <span style="font-size: 12px; font-weight: 800; color: ${COLORS.navy};">${scenario.yearsToMarket}yr</span>
      </div>
      <!-- Assumptions -->
      <div style="border-top: 1px solid ${COLORS.gray200}; padding-top: 8px;">
        <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px;">Key Assumptions</div>
        <ul style="padding-left: 12px; margin: 0; font-size: 9px; color: ${COLORS.gray600}; line-height: 1.6;">
          ${scenario.assumptions.slice(0, 4).map(a => `<li>${escapeHtml(a)}</li>`).join('')}
        </ul>
      </div>
    </div>
  `;

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, 'Deal Valuation Report')}

      <div class="section-title-lg">Scenario Comparison</div>

      <!-- Scenario Bar Chart -->
      <div class="section-title">rNPV Range Across Scenarios</div>
      <div class="card" style="padding: 12px 16px; margin-bottom: 16px; border-top: 3px solid ${COLORS.navy};">
        <div class="chart-container">
          ${renderScenarioBar(sc.bear.rnpv, sc.base.rnpv, sc.bull.rnpv)}
        </div>
        <div style="display: flex; justify-content: center; gap: 24px; margin-top: 4px;">
          <div style="display: flex; align-items: center; gap: 4px;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${COLORS.rose};"></span>
            <span style="font-size: 8px; color: ${COLORS.gray400}; font-weight: 600;">Bear Case</span>
          </div>
          <div style="display: flex; align-items: center; gap: 4px;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${COLORS.teal};"></span>
            <span style="font-size: 8px; color: ${COLORS.gray400}; font-weight: 600;">Base Case</span>
          </div>
          <div style="display: flex; align-items: center; gap: 4px;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${COLORS.green};"></span>
            <span style="font-size: 8px; color: ${COLORS.gray400}; font-weight: 600;">Bull Case</span>
          </div>
        </div>
      </div>

      <!-- Three-Column Comparison -->
      <div class="section-title">Scenario Detail</div>
      <div style="display: flex; gap: 10px; margin-bottom: 16px;">
        ${scenarioColumn('Bear', sc.bear, COLORS.rose, '#fff5f5', sc.bearWeight)}
        ${scenarioColumn('Base', sc.base, COLORS.teal, '#f0fdfa', sc.baseWeight)}
        ${scenarioColumn('Bull', sc.bull, COLORS.green, '#f0fdf4', sc.bullWeight)}
      </div>

      <!-- Expected Value Callout -->
      <div style="background: linear-gradient(145deg, ${COLORS.navy} 0%, #252a5e 100%); border-radius: 6px; padding: 18px 24px; color: white; margin-bottom: 14px;">
        <div style="display: flex; justify-content: space-between; align-items: center;">
          <div>
            <div style="font-size: 7px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.16em; font-weight: 700; margin-bottom: 4px;">Probability-Weighted Expected Value</div>
            <div style="font-size: 9px; color: rgba(255,255,255,0.55); line-height: 1.5;">
              E[V] = (${formatPercent(sc.bearWeight * 100, 0)} &times; ${formatUsd(sc.bear.rnpv)}) + (${formatPercent(sc.baseWeight * 100, 0)} &times; ${formatUsd(sc.base.rnpv)}) + (${formatPercent(sc.bullWeight * 100, 0)} &times; ${formatUsd(sc.bull.rnpv)})
            </div>
          </div>
          <div style="text-align: right; flex-shrink: 0;">
            <div style="font-size: 32px; font-weight: 800; color: ${COLORS.tealMid}; letter-spacing: -0.03em; line-height: 1;">${formatUsd(sc.expectedValue)}</div>
            <div style="font-size: 8px; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 0.1em; margin-top: 4px;">Expected rNPV</div>
          </div>
        </div>
      </div>

      <!-- Narrative -->
      <div class="callout">
        ${escapeHtml(sc.narrative)}
      </div>

      <!-- Methodology note -->
      <div style="margin-top: 10px; font-size: 8px; color: ${COLORS.gray400}; line-height: 1.6;">
        <strong>Methodology:</strong> Scenario weights calibrated to BIO/Informa clinical phase transition distributions. Bear case models CRL + competitive erosion; Bull case models breakthrough designation + favorable readout. Expected value is the probability-weighted mean across all three scenarios.
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
