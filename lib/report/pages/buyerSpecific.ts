// Page: Buyer-Specific Deal Valuation
// Shows generic vs buyer-specific deal values for multiple partners

import { pageHeader, pageFooter, COLORS, escapeHtml, formatUsd } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';

const BUYER_COLORS = [COLORS.teal, '#8B5CF6', '#F59E0B'];
const BUYER_BG = ['#f0fdfa', '#f5f3ff', '#fffbeb'];
const BUYER_BORDER = [COLORS.teal, '#8B5CF6', '#F59E0B'];

export function renderBuyerSpecificPage(data: PDFReportData, meta: ReportMeta): string {
  const allValuations = data.buyerSpecificValuations ?? (data.buyerSpecificValuation ? [data.buyerSpecificValuation] : []);
  if (allValuations.length === 0) return '';

  const colCount = 1 + allValuations.length; // generic + buyers
  const colWidth = `${Math.floor(100 / colCount)}%`;

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, 'Deal Valuation Report')}

      <div class="section-title-lg">Buyer-Specific Deal Valuation</div>
      <p style="font-size: 11px; color: ${COLORS.gray500}; margin-bottom: 20px; line-height: 1.5;">
        Strategic premium analysis comparing ${allValuations.length} potential buyer${allValuations.length > 1 ? 's' : ''}
        against generic market value, based on portfolio fit, deal urgency, patent cliff pressure, and competitive dynamics.
      </p>

      <!-- Multi-buyer comparison cards -->
      <div style="display: grid; grid-template-columns: repeat(${colCount}, 1fr); gap: 10px; margin-bottom: 24px; align-items: stretch;">
        <!-- Generic -->
        <div style="background: #f8fafc; border: 1px solid ${COLORS.gray200}; border-radius: 8px; padding: 16px; text-align: center;">
          <div style="font-size: 8px; font-weight: 700; color: ${COLORS.gray400}; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 10px;">Generic Buyer</div>
          <div style="font-size: ${allValuations.length > 2 ? '24' : '28'}px; font-weight: 800; color: ${COLORS.gray500}; letter-spacing: -0.03em; line-height: 1; margin-bottom: 4px;">${formatUsd(allValuations[0].genericDealValue.median)}</div>
          <div style="font-size: 8px; color: ${COLORS.gray400}; margin-bottom: 14px;">${formatUsd(allValuations[0].genericDealValue.low)} – ${formatUsd(allValuations[0].genericDealValue.high)}</div>
          <div style="border-top: 1px solid ${COLORS.gray200}; padding-top: 10px;">
            <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 3px;">Upfront</div>
            <div style="font-size: 16px; font-weight: 700; color: ${COLORS.gray500};">${formatUsd(allValuations[0].genericUpfront.median)}</div>
          </div>
        </div>

        ${allValuations.map((bsv, i) => {
          const color = BUYER_COLORS[i % BUYER_COLORS.length];
          const bg = BUYER_BG[i % BUYER_BG.length];
          const border = BUYER_BORDER[i % BUYER_BORDER.length];
          return `
        <!-- ${escapeHtml(bsv.buyer.companyName)} -->
        <div style="background: linear-gradient(135deg, ${bg} 0%, white 100%); border: 2px solid ${border}; border-radius: 8px; padding: 16px; text-align: center; position: relative;">
          <div style="position: absolute; top: -9px; right: 8px; background: ${color}; color: white; font-size: 8px; font-weight: 700; padding: 2px 8px; border-radius: 8px;">+${bsv.strategicPremiumPercent.toFixed(0)}%</div>
          <div style="font-size: 8px; font-weight: 700; color: ${color}; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 10px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(bsv.buyer.companyName)}</div>
          <div style="font-size: ${allValuations.length > 2 ? '24' : '28'}px; font-weight: 800; color: ${COLORS.navy}; letter-spacing: -0.03em; line-height: 1; margin-bottom: 4px;">${formatUsd(bsv.buyerSpecificDealValue.median)}</div>
          <div style="font-size: 8px; color: ${COLORS.gray500}; margin-bottom: 14px;">${formatUsd(bsv.buyerSpecificDealValue.low)} – ${formatUsd(bsv.buyerSpecificDealValue.high)}</div>
          <div style="border-top: 1px solid rgba(0,0,0,0.06); padding-top: 10px;">
            <div style="font-size: 7px; font-weight: 700; color: ${color}; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 3px;">Upfront</div>
            <div style="font-size: 16px; font-weight: 700; color: ${COLORS.navy};">${formatUsd(bsv.buyerUpfront.median)}</div>
            <div style="font-size: 8px; color: ${color}; margin-top: 2px;">+${formatUsd(bsv.upfrontPremium)} vs generic</div>
          </div>
        </div>`;
        }).join('')}
      </div>

      <!-- Comparison Table -->
      <div class="section-title">Buyer Comparison</div>
      <table style="width: 100%; border-collapse: collapse; font-size: 10px; margin-bottom: 20px;">
        <thead>
          <tr style="border-bottom: 2px solid ${COLORS.gray200};">
            <th style="text-align: left; padding: 6px 8px; color: ${COLORS.gray400}; font-size: 8px; text-transform: uppercase; letter-spacing: 0.1em;">Metric</th>
            <th style="text-align: center; padding: 6px 8px; color: ${COLORS.gray400}; font-size: 8px; text-transform: uppercase; letter-spacing: 0.1em;">Generic</th>
            ${allValuations.map((bsv, i) => `
            <th style="text-align: center; padding: 6px 8px; color: ${BUYER_COLORS[i % BUYER_COLORS.length]}; font-size: 8px; text-transform: uppercase; letter-spacing: 0.1em;">${escapeHtml(bsv.buyer.companyName)}</th>
            `).join('')}
          </tr>
        </thead>
        <tbody>
          <tr style="border-bottom: 1px solid ${COLORS.gray100};">
            <td style="padding: 5px 8px; color: ${COLORS.navy}; font-weight: 600;">Deal Value</td>
            <td style="padding: 5px 8px; text-align: center; color: ${COLORS.gray500};">${formatUsd(allValuations[0].genericDealValue.median)}</td>
            ${allValuations.map((bsv, i) => `<td style="padding: 5px 8px; text-align: center; color: ${BUYER_COLORS[i % BUYER_COLORS.length]}; font-weight: 700;">${formatUsd(bsv.buyerSpecificDealValue.median)}</td>`).join('')}
          </tr>
          <tr style="border-bottom: 1px solid ${COLORS.gray100};">
            <td style="padding: 5px 8px; color: ${COLORS.navy}; font-weight: 600;">Upfront</td>
            <td style="padding: 5px 8px; text-align: center; color: ${COLORS.gray500};">${formatUsd(allValuations[0].genericUpfront.median)}</td>
            ${allValuations.map((bsv, i) => `<td style="padding: 5px 8px; text-align: center; color: ${BUYER_COLORS[i % BUYER_COLORS.length]}; font-weight: 700;">${formatUsd(bsv.buyerUpfront.median)}</td>`).join('')}
          </tr>
          <tr style="border-bottom: 1px solid ${COLORS.gray100};">
            <td style="padding: 5px 8px; color: ${COLORS.navy}; font-weight: 600;">Premium</td>
            <td style="padding: 5px 8px; text-align: center; color: ${COLORS.gray400};">—</td>
            ${allValuations.map((bsv, i) => `<td style="padding: 5px 8px; text-align: center; color: ${BUYER_COLORS[i % BUYER_COLORS.length]}; font-weight: 800;">+${bsv.strategicPremiumPercent.toFixed(0)}%</td>`).join('')}
          </tr>
          <tr style="border-bottom: 1px solid ${COLORS.gray100};">
            <td style="padding: 5px 8px; color: ${COLORS.navy}; font-weight: 600;">Match Score</td>
            <td style="padding: 5px 8px; text-align: center; color: ${COLORS.gray400};">—</td>
            ${allValuations.map((bsv, i) => `<td style="padding: 5px 8px; text-align: center; color: ${BUYER_COLORS[i % BUYER_COLORS.length]};">${bsv.buyer.matchScore}%</td>`).join('')}
          </tr>
          <tr style="border-bottom: 1px solid ${COLORS.gray100};">
            <td style="padding: 5px 8px; color: ${COLORS.navy}; font-weight: 600;">Intent Score</td>
            <td style="padding: 5px 8px; text-align: center; color: ${COLORS.gray400};">—</td>
            ${allValuations.map((bsv, i) => `<td style="padding: 5px 8px; text-align: center; color: ${BUYER_COLORS[i % BUYER_COLORS.length]};">${bsv.buyer.intentScore}</td>`).join('')}
          </tr>
          <tr style="border-bottom: 1px solid ${COLORS.gray100};">
            <td style="padding: 5px 8px; color: ${COLORS.navy}; font-weight: 600;">Timing</td>
            <td style="padding: 5px 8px; text-align: center; color: ${COLORS.gray400};">—</td>
            ${allValuations.map((bsv, i) => `<td style="padding: 5px 8px; text-align: center; color: ${BUYER_COLORS[i % BUYER_COLORS.length]}; text-transform: capitalize;">${bsv.buyer.timing.replace('_', ' ')}</td>`).join('')}
          </tr>
          <tr>
            <td style="padding: 5px 8px; color: ${COLORS.navy}; font-weight: 600;">Leverage</td>
            <td style="padding: 5px 8px; text-align: center; color: ${COLORS.gray400};">—</td>
            ${allValuations.map(bsv => {
              const lColor = bsv.negotiationLeverage === 'strong' ? COLORS.teal
                : bsv.negotiationLeverage === 'moderate' ? COLORS.amber
                : COLORS.gray400;
              const lBg = bsv.negotiationLeverage === 'strong' ? COLORS.tealLight
                : bsv.negotiationLeverage === 'moderate' ? COLORS.amberLight
                : '#f1f5f9';
              return `<td style="padding: 5px 8px; text-align: center;">
                <span style="background: ${lBg}; color: ${lColor}; font-size: 8px; font-weight: 700; padding: 2px 8px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.1em;">${bsv.negotiationLeverage}</span>
              </td>`;
            }).join('')}
          </tr>
        </tbody>
      </table>

      <!-- Per-buyer premium breakdowns -->
      ${allValuations.map((bsv, i) => {
        const color = BUYER_COLORS[i % BUYER_COLORS.length];
        const maxContribution = Math.max(...bsv.premiumBreakdown.map(f => f.contribution), 1);
        return `
      <div style="margin-bottom: 16px;">
        <div style="font-size: 11px; font-weight: 700; color: ${color}; margin-bottom: 8px;">${escapeHtml(bsv.buyer.companyName)} — Premium Breakdown</div>
        ${bsv.premiumBreakdown.sort((a, b) => b.contribution - a.contribution).map(factor => {
          const barWidth = Math.max(5, (factor.contribution / maxContribution) * 100);
          return `
        <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 5px;">
          <div style="width: 120px; text-align: right; flex-shrink: 0;">
            <div style="font-size: 9px; font-weight: 600; color: ${COLORS.navy};">${escapeHtml(factor.factor)}</div>
            <div style="font-size: 7px; color: ${COLORS.gray400};">${factor.score}/100 × ${factor.weight.toFixed(2)}</div>
          </div>
          <div style="flex: 1; height: 12px; background: #f1f5f9; border-radius: 3px; overflow: hidden;">
            <div style="height: 100%; width: ${barWidth}%; background: ${color}; border-radius: 3px;"></div>
          </div>
          <div style="width: 45px; text-align: right; font-size: 10px; font-weight: 700; color: ${color}; flex-shrink: 0;">+${factor.contribution.toFixed(1)}%</div>
        </div>`;
        }).join('')}
      </div>`;
      }).join('')}

      <!-- Narratives -->
      ${allValuations.map((bsv, i) => {
        const color = BUYER_COLORS[i % BUYER_COLORS.length];
        return `
      <div style="background: ${BUYER_BG[i % BUYER_BG.length]}; border-left: 4px solid ${color}; padding: 10px 14px; border-radius: 0 6px 6px 0; margin-bottom: 10px;">
        <div style="font-size: 9px; font-weight: 700; color: ${color}; margin-bottom: 3px;">${escapeHtml(bsv.buyer.companyName)}</div>
        <div style="font-size: 9px; color: ${COLORS.gray600}; line-height: 1.5;">${escapeHtml(bsv.narrative)}</div>
      </div>`;
      }).join('')}

      <div style="margin-top: 10px; font-size: 8px; color: ${COLORS.gray400}; text-align: center;">
        Premium capped at +75%. Confidence-adjusted based on data quality.
        Factor weights: Portfolio Fit 30%, Deal Urgency 25%, Patent Cliff 20%, Pipeline Gap 15%, Competitive Pressure 10%.
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
