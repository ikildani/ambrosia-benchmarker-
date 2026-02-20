// Page 5: Deal Terms Detail
// Term cards with factor impacts, milestone breakdown table, royalty step chart

import { renderRoyaltyStep } from '../svg-charts/royaltyStep';
import { formatUsd, pageHeader, pageFooter, COLORS, escapeHtml } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';

export function renderDealTermsPage(data: PDFReportData, meta: ReportMeta): string {
  const { result } = data;
  const drillDown = result.drillDown;
  const royalties = result.tieredRoyalties;

  // Term cards
  const termCards = [
    { key: 'upfront', label: 'Upfront Payment', terms: result.terms.upfront, dd: drillDown.upfront },
    { key: 'devMilestones', label: 'Development Milestones', terms: result.terms.devMilestones, dd: drillDown.devMilestones },
    { key: 'regMilestones', label: 'Regulatory Milestones', terms: result.terms.regMilestones, dd: drillDown.regMilestones },
    { key: 'commMilestones', label: 'Commercial Milestones', terms: result.terms.commMilestones, dd: drillDown.commMilestones },
  ];

  const royaltyStepHtml = renderRoyaltyStep(royalties, 260, 140);

  return `
    <div class="report-page">
      ${pageHeader(5, meta.pageCount, 'Deal Valuation Report')}

      <div class="section-title-lg">Deal Terms Detail</div>

      <!-- Term Cards Grid -->
      <div class="grid-2" style="margin-bottom: 20px;">
        ${termCards.map((tc, i) => {
          const colors = [COLORS.teal, COLORS.cyan, '#6366f1', '#8b5cf6'];
          return `
          <div class="card" style="border-top: 3px solid ${colors[i]};">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 6px;">
              <div style="font-size: 10px; font-weight: 700; color: ${COLORS.navy};">${tc.label}</div>
              <div style="font-size: 17px; font-weight: 800; color: ${COLORS.navy}; letter-spacing: -0.02em;">${formatUsd(tc.terms.median)}</div>
            </div>
            <div style="font-size: 9px; color: ${COLORS.gray400}; margin-bottom: 5px;">
              Range: ${formatUsd(tc.terms.low)} &ndash; ${formatUsd(tc.terms.high)}
            </div>
            <div style="font-size: 9px; color: ${COLORS.gray600}; line-height: 1.5; margin-bottom: 6px;">
              ${escapeHtml(tc.dd.rangeExplanation)}
            </div>
            <!-- Factor impacts -->
            ${tc.dd.factors.length > 0 ? `
            <div style="display: flex; flex-wrap: wrap; gap: 3px;">
              ${tc.dd.factors.slice(0, 3).map(f => {
                const badge = f.impact === 'positive' ? 'badge-teal' : f.impact === 'negative' ? 'badge-rose' : 'badge-gray';
                const sign = f.impact === 'positive' ? '+' : f.impact === 'negative' ? '-' : '';
                return `<span class="badge ${badge}">${sign}${f.percentage}% ${escapeHtml(f.name)}</span>`;
              }).join('')}
            </div>
            ` : ''}
          </div>`;
        }).join('')}
      </div>

      <!-- Milestone Breakdown Table -->
      ${(() => {
        const allBreakdowns = termCards.filter(tc => tc.dd.breakdown && tc.dd.breakdown.length > 0);
        if (allBreakdowns.length === 0) return '';
        return `
        <div style="margin-bottom: 12px;">
          <div class="section-title">Milestone Breakdown</div>
          <div class="card" style="padding: 0; overflow: hidden;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Category</th>
                  <th>Event</th>
                  <th style="text-align: right;">Est. Range</th>
                  <th style="text-align: right;">% of Category</th>
                </tr>
              </thead>
              <tbody>
                ${allBreakdowns.map(tc =>
                  (tc.dd.breakdown || []).slice(0, 2).map(b => `
                    <tr>
                      <td style="font-size: 9px; color: ${COLORS.gray500};">${tc.label}</td>
                      <td>${escapeHtml(b.label)}</td>
                      <td style="text-align: right;">${formatUsd(b.value.low)} \u2013 ${formatUsd(b.value.high)}</td>
                      <td class="value-cell">${b.percentage}%</td>
                    </tr>
                  `).join('')
                ).join('')}
              </tbody>
            </table>
          </div>
        </div>
        `;
      })()}

      <!-- Royalty Structure -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 16px;">
        <div class="card">
          <div style="font-size: 10px; font-weight: 700; color: ${COLORS.navy}; margin-bottom: 8px;">Tiered Royalty Rates</div>
          <table class="data-table">
            <thead>
              <tr>
                <th>Tier</th>
                <th style="text-align: right;">Low</th>
                <th style="text-align: right;">High</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Base</td>
                <td style="text-align: right;">${royalties.base.low}%</td>
                <td class="value-cell">${royalties.base.high}%</td>
              </tr>
              <tr>
                <td>Mid Tier</td>
                <td style="text-align: right;">${royalties.midTier.low}%</td>
                <td class="value-cell">${royalties.midTier.high}%</td>
              </tr>
              <tr>
                <td>High Tier</td>
                <td style="text-align: right;">${royalties.highTier.low}%</td>
                <td class="value-cell">${royalties.highTier.high}%</td>
              </tr>
            </tbody>
          </table>
        </div>
        <div class="card" style="display: flex; flex-direction: column; align-items: center; justify-content: center;">
          <div style="font-size: 8px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px;">Royalty Step Chart</div>
          ${royaltyStepHtml}
        </div>
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
