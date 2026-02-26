// Page: Deal Flow & Market Context
// Historical deal flow, forecast, competitive landscape, market sentiment, market sizing

import { formatUsd, formatPercent, pageHeader, pageFooter, COLORS, escapeHtml } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';

function sentimentBadge(sentiment: string): string {
  const styles: Record<string, { cls: string; label: string }> = {
    hot: { cls: 'badge-rose', label: 'HOT' },
    warm: { cls: 'badge-amber', label: 'WARM' },
    neutral: { cls: 'badge-gray', label: 'NEUTRAL' },
    cooling: { cls: 'badge-blue', label: 'COOLING' },
  };
  const s = styles[sentiment] || { cls: 'badge-gray', label: sentiment.toUpperCase() };
  return `<span class="badge ${s.cls}">${s.label}</span>`;
}

function trendBadge(trend: string): string {
  const styles: Record<string, { cls: string; label: string }> = {
    accelerating: { cls: 'badge-teal', label: 'ACCELERATING' },
    stable: { cls: 'badge-gray', label: 'STABLE' },
    decelerating: { cls: 'badge-amber', label: 'DECELERATING' },
  };
  const s = styles[trend] || { cls: 'badge-gray', label: trend.toUpperCase() };
  return `<span class="badge ${s.cls}">${s.label}</span>`;
}

export function renderDealFlowContextPage(data: PDFReportData, meta: ReportMeta): string {
  const df = data.dealFlowForecast;
  const cl = data.competitiveLandscape;
  const ms = data.marketSizeEstimate;

  if (!df && !cl) return '';

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, 'Deal Valuation Report')}

      <div class="section-title-lg">Deal Flow &amp; Market Context</div>

      <div style="display: grid; grid-template-columns: ${df && cl ? '1fr 1fr' : '1fr'}; gap: 14px; margin-bottom: 18px;">

        ${df ? `
        <!-- Left Column: Deal Flow -->
        <div>
          <div class="section-title">Deal Flow Trend &amp; Forecast</div>

          <!-- Sentiment & Trend badges -->
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 10px;">
            <span style="font-size: 8px; color: ${COLORS.gray400}; font-weight: 600;">Sentiment:</span>
            ${sentimentBadge(df.marketSentiment)}
            <span style="font-size: 8px; color: ${COLORS.gray400}; font-weight: 600; margin-left: 6px;">Trend:</span>
            ${trendBadge(df.trend)}
          </div>

          <!-- Historical Quarters Table -->
          <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 10px;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Quarter</th>
                  <th style="text-align: right;">Deals</th>
                  <th style="text-align: right;">Total Value</th>
                </tr>
              </thead>
              <tbody>
                ${df.historicalQuarters.slice(-6).map(q => `
                  <tr>
                    <td style="font-weight: 500;">${escapeHtml(q.quarter)}</td>
                    <td style="text-align: right;">${q.dealCount}</td>
                    <td class="value-cell">${formatUsd(q.totalValue)}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Forecast Table -->
          ${df.forecast && df.forecast.length > 0 ? `
          <div style="font-size: 8px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px;">Forecast</div>
          <div class="card" style="padding: 0; overflow: hidden;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Quarter</th>
                  <th style="text-align: right;">Predicted Deals</th>
                  <th style="text-align: right;">Confidence</th>
                </tr>
              </thead>
              <tbody>
                ${df.forecast.slice(0, 4).map(f => `
                  <tr>
                    <td style="font-weight: 500;">${escapeHtml(f.quarter)}</td>
                    <td style="text-align: right; font-weight: 700; color: ${COLORS.teal};">${f.predictedDeals}</td>
                    <td style="text-align: right;">
                      <div style="display: flex; align-items: center; justify-content: flex-end; gap: 4px;">
                        <div class="score-bar" style="width: 40px;">
                          <div class="score-bar-fill" style="width: ${Math.round(f.confidence * 100)}%;"></div>
                        </div>
                        <span style="font-size: 9px; color: ${COLORS.gray400};">${formatPercent(f.confidence * 100, 0)}</span>
                      </div>
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
          ` : ''}
        </div>
        ` : ''}

        ${cl ? `
        <!-- Right Column: Competitive Landscape -->
        <div>
          <div class="section-title">Competitive Landscape</div>

          <!-- Density Score Hero -->
          <div style="background: linear-gradient(145deg, ${COLORS.navy} 0%, #252a5e 100%); border-radius: 6px; padding: 14px 16px; color: white; margin-bottom: 10px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <div>
                <div style="font-size: 7px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.14em; font-weight: 700;">Competitive Density</div>
                <div style="font-size: 22px; font-weight: 800; color: ${COLORS.tealMid}; margin-top: 2px;">${cl.competitiveDensityScore}<span style="font-size: 12px; color: rgba(255,255,255,0.4);">/100</span></div>
              </div>
              <div style="text-align: right;">
                <div style="font-size: 7px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.14em; font-weight: 700;">Total Competitors</div>
                <div style="font-size: 22px; font-weight: 800; color: #fff; margin-top: 2px;">${cl.totalCompetingAssets}</div>
              </div>
            </div>
            <div class="score-bar" style="background: rgba(255,255,255,0.1);">
              <div class="score-bar-fill" style="width: ${cl.competitiveDensityScore}%; background: linear-gradient(90deg, ${COLORS.green}, ${cl.competitiveDensityScore > 60 ? COLORS.rose : COLORS.amber});"></div>
            </div>
          </div>

          <!-- Competitors by Phase -->
          <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 10px;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Phase</th>
                  <th style="text-align: right;">Competitors</th>
                </tr>
              </thead>
              <tbody>
                ${Object.entries(cl.byPhase).map(([phase, count]) => `
                  <tr>
                    <td style="font-weight: 500;">${escapeHtml(phase)}</td>
                    <td style="text-align: right; font-weight: 700; color: ${COLORS.navy};">${count}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>

          <!-- Key Competitive Info -->
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            ${cl.expectedNextApproval ? `
            <div class="card-sm">
              <div style="font-size: 7px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; margin-bottom: 2px;">Next Approval</div>
              <div style="font-size: 10px; font-weight: 700; color: ${COLORS.navy};">${escapeHtml(cl.expectedNextApproval.company)}</div>
              <div style="font-size: 9px; color: ${COLORS.gray400};">${cl.expectedNextApproval.year}</div>
            </div>
            ` : ''}
            <div class="card-sm">
              <div style="font-size: 7px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; margin-bottom: 2px;">Mkt Share Erosion</div>
              <div style="font-size: 14px; font-weight: 800; color: ${cl.marketShareErosionEstimate > 0.3 ? COLORS.rose : COLORS.amber};">${formatPercent(cl.marketShareErosionEstimate * 100, 0)}</div>
            </div>
            ${cl.firstMoverAdvantage ? `
            <div class="card-sm" style="border-left: 3px solid ${COLORS.green};">
              <div style="font-size: 9px; font-weight: 700; color: ${COLORS.green};">First-Mover Advantage</div>
              <div style="font-size: 8px; color: ${COLORS.gray400};">This asset has meaningful FMA.</div>
            </div>
            ` : ''}
          </div>
        </div>
        ` : ''}
      </div>

      ${ms ? `
      <!-- Market Size Section -->
      <div class="section-title">Market Size Estimate</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 14px;">
        <div class="kpi-card">
          <div class="kpi-value">${formatUsd(ms.totalAddressableMarket)}</div>
          <div class="kpi-label">Total Addressable (TAM)</div>
        </div>
        <div class="kpi-card" style="border-top-color: ${COLORS.navy};">
          <div class="kpi-value" style="color: ${COLORS.navy};">${formatUsd(ms.serviceableAddressableMarket)}</div>
          <div class="kpi-label">Serviceable (SAM)</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value">${formatUsd(ms.serviceableObtainableMarket)}</div>
          <div class="kpi-label">Obtainable (SOM)</div>
        </div>
      </div>

      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 14px; margin-bottom: 14px;">
        <!-- Patient Funnel -->
        <div class="card" style="padding: 0; overflow: hidden;">
          <table class="data-table">
            <thead>
              <tr>
                <th>Patient Funnel Stage</th>
                <th style="text-align: right;">Patients</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Prevalent Patients</td>
                <td style="text-align: right; font-weight: 600;">${ms.patientFunnel.prevalentPatients.toLocaleString()}</td>
              </tr>
              <tr>
                <td>Diagnosed</td>
                <td style="text-align: right; font-weight: 600;">${ms.patientFunnel.diagnosedPatients.toLocaleString()}</td>
              </tr>
              <tr>
                <td>Treated</td>
                <td style="text-align: right; font-weight: 600;">${ms.patientFunnel.treatedPatients.toLocaleString()}</td>
              </tr>
              <tr>
                <td>Drug Eligible</td>
                <td style="text-align: right; font-weight: 600;">${ms.patientFunnel.drugEligiblePatients.toLocaleString()}</td>
              </tr>
              <tr>
                <td style="font-weight: 700; color: ${COLORS.navy};">Addressable</td>
                <td style="text-align: right; font-weight: 800; color: ${COLORS.teal};">${ms.patientFunnel.addressablePatients.toLocaleString()}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Peak Sales Scenarios -->
        <div>
          <div style="font-size: 8px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px;">Peak Sales Scenarios</div>
          <div class="card-sm" style="margin-bottom: 6px; text-align: center;">
            <div style="font-size: 7px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700;">Low</div>
            <div style="font-size: 14px; font-weight: 800; color: ${COLORS.gray500};">${formatUsd(ms.peakSales.low)}</div>
          </div>
          <div class="card-sm" style="margin-bottom: 6px; text-align: center; border-left: 3px solid ${COLORS.teal};">
            <div style="font-size: 7px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700;">Median</div>
            <div style="font-size: 14px; font-weight: 800; color: ${COLORS.teal};">${formatUsd(ms.peakSales.median)}</div>
          </div>
          <div class="card-sm" style="text-align: center;">
            <div style="font-size: 7px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700;">High</div>
            <div style="font-size: 14px; font-weight: 800; color: ${COLORS.gray500};">${formatUsd(ms.peakSales.high)}</div>
          </div>
        </div>
      </div>
      ` : ''}

      <!-- Timing Advice / Narrative -->
      ${df ? `
      <div class="callout" style="margin-top: 4px;">
        <div style="font-size: 8px; font-weight: 700; color: ${COLORS.teal}; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px;">Timing Advice</div>
        <div style="font-size: 10px; color: #134e4a; line-height: 1.65;">${escapeHtml(df.narrative)}</div>
      </div>
      ` : ''}

      ${cl && cl.narrative ? `
      <div class="callout-amber" style="margin-top: 10px;">
        <div style="font-size: 8px; font-weight: 700; color: #78350f; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px;">Competitive Outlook</div>
        <div style="font-size: 10px; color: #78350f; line-height: 1.65;">${escapeHtml(cl.narrative)}</div>
      </div>
      ` : ''}

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
