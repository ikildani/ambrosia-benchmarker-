// Page 6: Sensitivity Analysis
// Top value driver callout, tornado chart, parameter impact table, TA risk factors

import { renderTornado } from '../svg-charts/tornado';
import { formatUsd, pageHeader, pageFooter, COLORS, escapeHtml } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';

function impactBadge(level: string): string {
  const cls: Record<string, string> = {
    'VERY HIGH': 'impact-very-high',
    'HIGH': 'impact-high',
    'MEDIUM': 'impact-medium',
    'LOW': 'impact-low',
  };
  return `<span class="badge ${cls[level] || 'badge-gray'}">${level}</span>`;
}

export function renderSensitivityPage(data: PDFReportData, meta: ReportMeta): string {
  const { sensitivityData } = data;
  const topDriver = sensitivityData.topValueDriver;
  const params = sensitivityData.parameters;

  const tornadoHtml = renderTornado(params, 560, 300);

  return `
    <div class="report-page">
      ${pageHeader(6, meta.pageCount, 'Deal Valuation Report')}

      <div class="section-title-lg">Sensitivity Analysis</div>

      <!-- Top Value Driver Callout -->
      <div style="display: grid; grid-template-columns: 1fr auto; gap: 16px; margin-bottom: 18px; background: linear-gradient(145deg, ${COLORS.navy} 0%, #252a5e 100%); border-radius: 6px; padding: 20px 24px; color: white;">
        <div>
          <div style="font-size: 7px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.16em; font-weight: 700; margin-bottom: 6px;">Top Value Driver</div>
          <div style="font-size: 14px; font-weight: 800; color: #fff; margin-bottom: 5px;">${escapeHtml(topDriver.parameterLabel)}</div>
          <div style="font-size: 10px; color: rgba(255,255,255,0.55); line-height: 1.6;">${escapeHtml(topDriver.insightText)}</div>
        </div>
        <div style="text-align: right; flex-shrink: 0; display: flex; flex-direction: column; justify-content: center;">
          <div style="font-size: 28px; font-weight: 800; color: ${COLORS.tealMid}; letter-spacing: -0.03em;">+${formatUsd(topDriver.bestOption.delta)}</div>
          <div style="font-size: 8px; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 0.1em;">potential upside</div>
        </div>
      </div>

      <!-- Tornado Chart -->
      <div class="card" style="margin-bottom: 18px; padding: 14px; border-top: 3px solid ${COLORS.navy};">
        <div class="section-title" style="margin-bottom: 4px;">Parameter Impact (Tornado Chart)</div>
        <div class="chart-container">
          ${tornadoHtml}
        </div>
      </div>

      <!-- Parameter Impact Table -->
      <div style="margin-bottom: 12px;">
        <div class="section-title">Parameter Details</div>
        <div class="card" style="padding: 0; overflow: hidden;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Parameter</th>
                <th>Current</th>
                <th>Best Alternative</th>
                <th style="text-align: right;">Potential Gain</th>
                <th style="text-align: center;">Impact</th>
              </tr>
            </thead>
            <tbody>
              ${params.slice(0, 7).map(p => {
                const bestOpt = p.options.reduce((best, opt) => opt.delta > best.delta ? opt : best, p.options[0]);
                return `
                <tr>
                  <td style="font-weight: 500;">${escapeHtml(p.label)}</td>
                  <td style="font-size: 9px;">${escapeHtml(p.currentLabel)}</td>
                  <td style="font-size: 9px;">${bestOpt ? escapeHtml(bestOpt.label) : 'N/A'}</td>
                  <td class="value-cell">${bestOpt && bestOpt.delta > 0 ? '+' + formatUsd(bestOpt.delta) : 'N/A'}</td>
                  <td style="text-align: center;">${impactBadge(p.impactLevel)}</td>
                </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
      </div>

      <!-- TA Risk Factors -->
      ${sensitivityData.neurologyInsights.length > 0 ? `
      <div>
        <div class="section-title">Therapeutic Area Considerations</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 8px;">
          ${sensitivityData.neurologyInsights.slice(0, 3).map(insight => `
            <div class="card-sm">
              <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 3px;">
                <span style="font-size: 10px; font-weight: 700; color: ${COLORS.navy};">${escapeHtml(insight.title)}</span>
                ${impactBadge(insight.impactLevel)}
              </div>
              <div style="font-size: 10px; color: ${COLORS.gray600}; line-height: 1.5;">${escapeHtml(insight.description)}</div>
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
