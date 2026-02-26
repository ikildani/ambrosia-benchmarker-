// Page: Currency & Pricing Sensitivity
// FX scenario impact table, regulatory pricing pressure, pricing narrative

import { formatUsd, formatPercent, pageHeader, pageFooter, COLORS, escapeHtml } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';

export function renderCurrencySensitivityPage(data: PDFReportData, meta: ReportMeta): string {
  if (!data.fxSensitivity) return '';

  const fx = data.fxSensitivity;

  // Determine the max absolute deal value impact for scaling the visual bars
  const maxAbsImpact = Math.max(
    ...fx.scenarios.map(s => Math.abs(s.dealValueImpact)),
    1,
  );

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, 'Deal Valuation Report')}

      <div class="section-title-lg">Currency &amp; Pricing Sensitivity</div>

      <!-- Revenue Hero -->
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 12px; margin-bottom: 18px;">
        <div class="kpi-card">
          <div class="kpi-value">${formatUsd(fx.baseCaseRevenue)}</div>
          <div class="kpi-label">Base Case Revenue</div>
          <div class="kpi-sub">At current FX rates</div>
        </div>
        <div class="kpi-card" style="border-top-color: ${fx.regulatoryPricingImpact < 0 ? COLORS.rose : COLORS.navy};">
          <div class="kpi-value" style="color: ${fx.regulatoryPricingImpact < 0 ? COLORS.rose : COLORS.teal};">${formatUsd(fx.regulatoryPricingImpact)}</div>
          <div class="kpi-label">Regulatory Impact</div>
          <div class="kpi-sub">Pricing pressure</div>
        </div>
        <div class="kpi-card" style="border-top-color: ${COLORS.navy};">
          <div class="kpi-value" style="color: ${COLORS.navy};">${formatUsd(fx.totalAdjustedRevenue)}</div>
          <div class="kpi-label">Adjusted Revenue</div>
          <div class="kpi-sub">After all adjustments</div>
        </div>
      </div>

      <!-- FX Scenarios Table -->
      <div class="section-title">FX Scenario Analysis</div>
      <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 18px;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Scenario</th>
              <th style="text-align: right;">FX Change</th>
              <th style="text-align: right;">Revenue Impact</th>
              <th style="text-align: right;">Deal Value Impact</th>
              <th style="width: 25%;">Visual</th>
            </tr>
          </thead>
          <tbody>
            ${fx.scenarios.map(s => {
              const isPositive = s.dealValueImpact >= 0;
              const barWidth = Math.round((Math.abs(s.dealValueImpact) / maxAbsImpact) * 100);
              const barColor = isPositive ? COLORS.green : COLORS.rose;
              const fxLabel = s.fxChange >= 0
                ? `+${formatPercent(s.fxChange * 100, 0)}`
                : `${formatPercent(s.fxChange * 100, 0)}`;

              return `
                <tr>
                  <td style="font-weight: 600; color: ${COLORS.navy};">${escapeHtml(s.label)}</td>
                  <td style="text-align: right;">
                    <span class="badge ${isPositive ? 'badge-teal' : 'badge-rose'}">${fxLabel}</span>
                  </td>
                  <td style="text-align: right; color: ${isPositive ? COLORS.green : COLORS.rose}; font-weight: 600;">
                    ${s.revenueImpact >= 0 ? '+' : ''}${formatUsd(s.revenueImpact)}
                  </td>
                  <td style="text-align: right; font-weight: 700; color: ${isPositive ? COLORS.green : COLORS.rose};">
                    ${s.dealValueImpact >= 0 ? '+' : ''}${formatUsd(s.dealValueImpact)}
                  </td>
                  <td>
                    <div style="display: flex; align-items: center; gap: 4px;">
                      ${isPositive ? `
                        <div style="flex: 1; display: flex; justify-content: flex-start;">
                          <div style="width: ${barWidth}%; height: 8px; background: ${barColor}; border-radius: 2px; min-width: 2px;"></div>
                        </div>
                      ` : `
                        <div style="flex: 1; display: flex; justify-content: flex-end;">
                          <div style="width: ${barWidth}%; height: 8px; background: ${barColor}; border-radius: 2px; min-width: 2px;"></div>
                        </div>
                      `}
                    </div>
                  </td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- Waterfall: Base -> Adjusted -->
      <div class="section-title">Revenue Waterfall</div>
      <div class="card" style="margin-bottom: 18px; padding: 16px;">
        <div style="display: flex; align-items: flex-end; justify-content: center; gap: 20px; height: 120px;">
          ${(() => {
            // Build waterfall items
            const items = [
              { label: 'Base Revenue', value: fx.baseCaseRevenue, color: COLORS.teal },
              { label: 'Regulatory Impact', value: fx.regulatoryPricingImpact, color: fx.regulatoryPricingImpact >= 0 ? COLORS.green : COLORS.rose },
              { label: 'FX Adjustments', value: fx.totalAdjustedRevenue - fx.baseCaseRevenue - fx.regulatoryPricingImpact, color: COLORS.amber },
              { label: 'Adjusted Revenue', value: fx.totalAdjustedRevenue, color: COLORS.navy },
            ];
            const maxVal = Math.max(...items.map(i => Math.abs(i.value)), 1);

            return items.map(item => {
              const barHeight = Math.max(8, Math.round((Math.abs(item.value) / maxVal) * 90));
              return `
                <div style="text-align: center; flex: 1;">
                  <div style="font-size: 10px; font-weight: 800; color: ${item.color}; margin-bottom: 4px;">
                    ${item.value < 0 ? '' : ''}${formatUsd(item.value)}
                  </div>
                  <div style="height: ${barHeight}px; background: ${item.color}; border-radius: 3px 3px 0 0; margin: 0 auto; width: 60%; opacity: 0.85;"></div>
                  <div style="font-size: 7px; color: ${COLORS.gray400}; margin-top: 4px; text-transform: uppercase; letter-spacing: 0.06em; font-weight: 700; line-height: 1.3;">${item.label}</div>
                </div>
              `;
            }).join('');
          })()}
        </div>
      </div>

      <!-- Regulatory Pricing Impact Narrative -->
      <div class="section-title">Regulatory Pricing Landscape</div>
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 14px;">
        <div class="card-sm" style="border-top: 3px solid ${COLORS.blue};">
          <div style="font-size: 10px; font-weight: 700; color: ${COLORS.navy}; margin-bottom: 3px;">IRA (US)</div>
          <div style="font-size: 9px; color: ${COLORS.gray500}; line-height: 1.5;">
            The Inflation Reduction Act allows Medicare to negotiate prices for select drugs,
            creating potential 25-60% price erosion for high-spend therapies after 9-13 years
            on market.
          </div>
        </div>
        <div class="card-sm" style="border-top: 3px solid ${COLORS.amber};">
          <div style="font-size: 10px; font-weight: 700; color: ${COLORS.navy}; margin-bottom: 3px;">NRDL (China)</div>
          <div style="font-size: 9px; color: ${COLORS.gray500}; line-height: 1.5;">
            China&rsquo;s National Reimbursement Drug List negotiations typically require
            40-70% discounts from list price for market access across public hospital channels.
          </div>
        </div>
        <div class="card-sm" style="border-top: 3px solid ${COLORS.purple};">
          <div style="font-size: 10px; font-weight: 700; color: ${COLORS.navy}; margin-bottom: 3px;">Reference Pricing (EU)</div>
          <div style="font-size: 9px; color: ${COLORS.gray500}; line-height: 1.5;">
            International reference pricing in EU5 markets creates downward pressure,
            with average basket discounts of 15-35% relative to US launch prices.
          </div>
        </div>
      </div>

      <!-- Revenue Impact Summary -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
        <div class="callout">
          <div style="font-size: 8px; font-weight: 700; color: ${COLORS.teal}; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px;">Revenue Sensitivity Summary</div>
          <div style="font-size: 10px; color: #134e4a; line-height: 1.65;">
            Base case revenue of <strong>${formatUsd(fx.baseCaseRevenue)}</strong> adjusts to
            <strong>${formatUsd(fx.totalAdjustedRevenue)}</strong> after incorporating FX and regulatory pricing
            pressures, a net change of
            <strong style="color: ${fx.totalAdjustedRevenue >= fx.baseCaseRevenue ? COLORS.green : COLORS.rose};">
              ${fx.totalAdjustedRevenue >= fx.baseCaseRevenue ? '+' : ''}${formatUsd(fx.totalAdjustedRevenue - fx.baseCaseRevenue)}
            </strong>.
          </div>
        </div>
        <div class="callout-amber">
          <div style="font-size: 8px; font-weight: 700; color: #78350f; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px;">Key Consideration</div>
          <div style="font-size: 10px; color: #78350f; line-height: 1.65;">
            FX volatility and regulatory pricing shifts can significantly alter deal economics.
            Deal structures should include FX protection clauses and pricing adjustment mechanisms
            for ex-US territories to mitigate downside risk.
          </div>
        </div>
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
