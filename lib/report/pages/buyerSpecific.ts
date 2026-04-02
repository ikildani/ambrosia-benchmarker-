// Page: Buyer-Specific Deal Valuation
// Shows generic vs buyer-specific deal value with premium breakdown

import { pageHeader, pageFooter, COLORS, escapeHtml, formatUsd } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';

export function renderBuyerSpecificPage(data: PDFReportData, meta: ReportMeta): string {
  const bsv = data.buyerSpecificValuation;
  if (!bsv) return '';

  const buyer = bsv.buyer;
  const leverageColor = bsv.negotiationLeverage === 'strong' ? COLORS.teal
    : bsv.negotiationLeverage === 'moderate' ? COLORS.amber
    : COLORS.gray400;
  const leverageBg = bsv.negotiationLeverage === 'strong' ? COLORS.tealLight
    : bsv.negotiationLeverage === 'moderate' ? COLORS.amberLight
    : '#f1f5f9';

  const maxContribution = Math.max(...bsv.premiumBreakdown.map(f => f.contribution), 1);

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, 'Deal Valuation Report')}

      <div class="section-title-lg">Buyer-Specific Deal Valuation</div>
      <p style="font-size: 11px; color: ${COLORS.gray500}; margin-bottom: 20px; line-height: 1.5;">
        Strategic premium analysis for <strong style="color: ${COLORS.navy};">${escapeHtml(buyer.companyName)}</strong>
        based on portfolio fit, deal urgency, patent cliff pressure, and competitive dynamics.
      </p>

      <!-- Side-by-side comparison -->
      <div style="display: grid; grid-template-columns: 1fr 40px 1fr; gap: 0; margin-bottom: 24px; align-items: stretch;">
        <!-- Generic -->
        <div style="background: #f8fafc; border: 1px solid ${COLORS.gray200}; border-radius: 8px; padding: 20px; text-align: center;">
          <div style="font-size: 8px; font-weight: 700; color: ${COLORS.gray400}; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 12px;">Generic Buyer</div>
          <div style="font-size: 32px; font-weight: 800; color: ${COLORS.gray500}; letter-spacing: -0.03em; line-height: 1; margin-bottom: 4px;">${formatUsd(bsv.genericDealValue.median)}</div>
          <div style="font-size: 9px; color: ${COLORS.gray400}; margin-bottom: 16px;">${formatUsd(bsv.genericDealValue.low)} – ${formatUsd(bsv.genericDealValue.high)}</div>
          <div style="border-top: 1px solid ${COLORS.gray200}; padding-top: 12px;">
            <div style="font-size: 8px; font-weight: 700; color: ${COLORS.gray400}; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 4px;">Upfront</div>
            <div style="font-size: 18px; font-weight: 700; color: ${COLORS.gray500};">${formatUsd(bsv.genericUpfront.median)}</div>
          </div>
        </div>

        <!-- Arrow -->
        <div style="display: flex; align-items: center; justify-content: center;">
          <div style="font-size: 18px; color: ${COLORS.teal}; font-weight: 700;">→</div>
        </div>

        <!-- Buyer-specific -->
        <div style="background: linear-gradient(135deg, #f0fdfa 0%, #ecfdf5 100%); border: 2px solid ${COLORS.teal}; border-radius: 8px; padding: 20px; text-align: center; position: relative;">
          <div style="position: absolute; top: -10px; right: 12px; background: ${COLORS.teal}; color: white; font-size: 9px; font-weight: 700; padding: 2px 10px; border-radius: 10px; letter-spacing: 0.05em;">+${bsv.strategicPremiumPercent.toFixed(0)}% PREMIUM</div>
          <div style="font-size: 8px; font-weight: 700; color: ${COLORS.teal}; letter-spacing: 0.15em; text-transform: uppercase; margin-bottom: 12px;">${escapeHtml(buyer.companyName)}</div>
          <div style="font-size: 32px; font-weight: 800; color: ${COLORS.navy}; letter-spacing: -0.03em; line-height: 1; margin-bottom: 4px;">${formatUsd(bsv.buyerSpecificDealValue.median)}</div>
          <div style="font-size: 9px; color: ${COLORS.gray500}; margin-bottom: 16px;">${formatUsd(bsv.buyerSpecificDealValue.low)} – ${formatUsd(bsv.buyerSpecificDealValue.high)}</div>
          <div style="border-top: 1px solid rgba(13,148,136,0.2); padding-top: 12px;">
            <div style="font-size: 8px; font-weight: 700; color: ${COLORS.teal}; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 4px;">Upfront</div>
            <div style="font-size: 18px; font-weight: 700; color: ${COLORS.navy};">${formatUsd(bsv.buyerUpfront.median)}</div>
            <div style="font-size: 9px; color: ${COLORS.teal}; margin-top: 2px;">+${formatUsd(bsv.upfrontPremium)} vs generic</div>
          </div>
        </div>
      </div>

      <!-- Buyer profile KPIs -->
      <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; margin-bottom: 20px;">
        <div class="kpi-card">
          <div class="kpi-label">Match Score</div>
          <div class="kpi-value" style="color: ${COLORS.teal};">${buyer.matchScore}%</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Intent Score</div>
          <div class="kpi-value" style="color: ${buyer.intentScore >= 70 ? COLORS.teal : buyer.intentScore >= 40 ? COLORS.amber : COLORS.gray500};">${buyer.intentScore}%</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Timing</div>
          <div class="kpi-value" style="font-size: 14px;">${buyer.timing.replace('_', '-')}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Leverage</div>
          <div style="display: inline-block; background: ${leverageBg}; color: ${leverageColor}; font-size: 10px; font-weight: 700; padding: 3px 10px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.1em;">${bsv.negotiationLeverage}</div>
        </div>
      </div>

      <!-- Premium Breakdown -->
      <div class="section-title">Strategic Premium Breakdown</div>
      <div style="margin-bottom: 20px;">
        ${bsv.premiumBreakdown.sort((a, b) => b.contribution - a.contribution).map(factor => {
          const barWidth = Math.max(5, (factor.contribution / maxContribution) * 100);
          return `
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
            <div style="width: 130px; text-align: right; flex-shrink: 0;">
              <div style="font-size: 10px; font-weight: 600; color: ${COLORS.navy};">${escapeHtml(factor.factor)}</div>
              <div style="font-size: 8px; color: ${COLORS.gray400};">${factor.score}/100 × ${factor.weight.toFixed(2)}</div>
            </div>
            <div style="flex: 1; height: 16px; background: #f1f5f9; border-radius: 4px; overflow: hidden; position: relative;">
              <div style="height: 100%; width: ${barWidth}%; background: linear-gradient(90deg, ${COLORS.teal}, #06b6d4); border-radius: 4px;"></div>
            </div>
            <div style="width: 50px; text-align: right; font-size: 11px; font-weight: 700; color: ${COLORS.teal}; flex-shrink: 0;">+${factor.contribution.toFixed(1)}%</div>
          </div>
          `;
        }).join('')}
      </div>

      <!-- Timing Advantage -->
      ${bsv.timingAdvantage ? `
      <div class="callout" style="margin-bottom: 16px;">
        <strong style="color: ${COLORS.navy};">Timing Advantage</strong>
        <div style="font-size: 10px; color: ${COLORS.gray600}; line-height: 1.55; margin-top: 4px;">${escapeHtml(bsv.timingAdvantage)}</div>
      </div>
      ` : ''}

      <!-- Narrative -->
      <div style="background: #f0fdfa; border-left: 4px solid ${COLORS.teal}; padding: 14px 18px; border-radius: 0 6px 6px 0;">
        <div style="font-size: 10px; color: ${COLORS.gray600}; line-height: 1.6;">${escapeHtml(bsv.narrative)}</div>
      </div>

      <div style="margin-top: 12px; font-size: 8px; color: ${COLORS.gray400}; text-align: center;">
        Premium capped at +75%. Confidence-adjusted based on data quality (${(buyer.confidence * 100).toFixed(0)}% confidence).
        Factor weights: Portfolio Fit 30%, Deal Urgency 25%, Patent Cliff 20%, Pipeline Gap 15%, Competitive Pressure 10%.
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
