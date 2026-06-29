// Page: Cross-Border Tax Structuring
// Jurisdiction comparison table, optimal structure callout, tax savings KPI,
// withholding/transfer pricing risk badges, Pillar Two impact, and narrative.

import { formatUsd, formatPercent, pageHeader, pageFooter, COLORS, escapeHtml } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';

// ---------------------------------------------------------------------------
// Risk badge color helper
// ---------------------------------------------------------------------------

function riskBadgeColor(level: string): { text: string; bg: string } {
  const l = level.toLowerCase();
  if (l === 'low' || l === 'minimal' || l === 'none') return { text: COLORS.green, bg: COLORS.greenLight };
  if (l === 'moderate' || l === 'medium') return { text: COLORS.amber, bg: COLORS.amberLight };
  return { text: COLORS.rose, bg: COLORS.roseLight };
}

// ---------------------------------------------------------------------------
// Main Page Export
// ---------------------------------------------------------------------------

export function renderTaxStructurePage(data: PDFReportData, meta: ReportMeta): string {
  if (!data.taxStructure) return '';

  const tx = data.taxStructure;

  // Find the optimal jurisdiction row for highlighting
  const optimalJurisdiction = tx.optimalStructure;

  // Withholding tax styling
  const whtIsNegative = tx.witholdingTaxImpact_M > 0;
  const whtColor = whtIsNegative ? COLORS.rose : COLORS.green;

  // Transfer pricing risk badge
  const tpRisk = riskBadgeColor(tx.transferPricingRisk);

  // Effective tax rate color coding
  const etrColor = tx.effectiveTaxRate <= 12 ? COLORS.green : tx.effectiveTaxRate <= 20 ? COLORS.amber : COLORS.rose;

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, 'Deal Valuation Report')}

      <div class="section-title-lg">Cross-Border Tax Structuring</div>

      <!-- Top KPI Row -->
      <div style="display: flex; gap: 10px; margin-bottom: 14px;">
        <!-- Tax Savings KPI -->
        <div style="flex: 1.2; border: 1px solid ${COLORS.gray200}; border-top: 4px solid ${COLORS.teal}; border-radius: 6px; padding: 16px 14px; background: white; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 6px;">
          <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em;">Estimated Tax Savings</div>
          <div style="font-size: 28px; font-weight: 800; color: ${COLORS.teal}; letter-spacing: -0.03em; line-height: 1;">${formatUsd(tx.taxSavings_M)}</div>
          <div style="font-size: 8px; color: ${COLORS.gray500};">vs. single-jurisdiction baseline</div>
        </div>
        <!-- Effective Tax Rate -->
        <div style="flex: 1; border: 1px solid ${COLORS.gray200}; border-top: 4px solid ${etrColor}; border-radius: 6px; padding: 16px 14px; background: white; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 6px;">
          <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em;">Blended Effective Rate</div>
          <div style="font-size: 28px; font-weight: 800; color: ${etrColor}; letter-spacing: -0.03em; line-height: 1;">${formatPercent(tx.effectiveTaxRate)}</div>
          <div style="font-size: 8px; color: ${COLORS.gray500};">weighted across jurisdictions</div>
        </div>
        <!-- Withholding Tax Impact -->
        <div style="flex: 1; border: 1px solid ${COLORS.gray200}; border-top: 4px solid ${whtColor}; border-radius: 6px; padding: 16px 14px; background: white; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 6px;">
          <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em;">Withholding Tax Impact</div>
          <div style="font-size: 28px; font-weight: 800; color: ${whtColor}; letter-spacing: -0.03em; line-height: 1;">${whtIsNegative ? '-' : ''}${formatUsd(tx.witholdingTaxImpact_M)}</div>
          <div style="font-size: 8px; color: ${COLORS.gray500};">cross-border royalty/milestone leakage</div>
        </div>
      </div>

      <!-- Risk Badges Row -->
      <div style="display: flex; gap: 10px; margin-bottom: 14px;">
        <!-- Transfer Pricing Risk -->
        <div style="flex: 1; border: 1px solid ${COLORS.gray200}; border-radius: 6px; padding: 12px 14px; background: white; display: flex; align-items: center; gap: 10px;">
          <div style="font-size: 9px; font-weight: 600; color: ${COLORS.gray600};">Transfer Pricing Risk:</div>
          <span style="font-size: 9px; font-weight: 800; color: ${tpRisk.text}; background: ${tpRisk.bg}; padding: 3px 12px; border-radius: 4px;">${escapeHtml(tx.transferPricingRisk)}</span>
        </div>
        <!-- Optimal Structure -->
        <div style="flex: 1; border: 1px solid ${COLORS.gray200}; border-radius: 6px; padding: 12px 14px; background: white; display: flex; align-items: center; gap: 10px;">
          <div style="font-size: 9px; font-weight: 600; color: ${COLORS.gray600};">Optimal Structure:</div>
          <span style="font-size: 9px; font-weight: 800; color: ${COLORS.navy}; background: ${COLORS.tealLight}; padding: 3px 12px; border-radius: 4px;">${escapeHtml(tx.optimalStructure)}</span>
        </div>
      </div>

      <!-- Jurisdiction Comparison Table -->
      <div class="section-title">Jurisdiction Breakdown</div>
      <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 14px;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Jurisdiction</th>
              <th style="text-align: right;">Tax Rate</th>
              <th style="text-align: right;">Applicable Income</th>
              <th>Rationale</th>
            </tr>
          </thead>
          <tbody>
            ${tx.structureBreakdown.map(row => {
              const isOptimal = row.jurisdiction.toLowerCase() === optimalJurisdiction.toLowerCase();
              const rowBg = isOptimal ? `background: ${COLORS.tealLight};` : '';
              const nameStyle = isOptimal
                ? `font-weight: 700; color: #0f766e;`
                : `font-weight: 500; color: ${COLORS.navy};`;
              const rateColor = row.taxRate <= 12.5 ? COLORS.green : row.taxRate <= 21 ? COLORS.amber : COLORS.rose;

              return `
                <tr style="${rowBg}">
                  <td style="${nameStyle}">
                    ${escapeHtml(row.jurisdiction)}${isOptimal ? ` <span style="font-size: 7px; font-weight: 800; color: ${COLORS.teal}; background: white; padding: 1px 6px; border-radius: 3px; margin-left: 4px;">OPTIMAL</span>` : ''}
                  </td>
                  <td style="text-align: right; font-weight: 700; color: ${rateColor};">${formatPercent(row.taxRate)}</td>
                  <td style="text-align: right; font-weight: 700; color: ${COLORS.navy};">${formatPercent(row.applicableIncome_pct)}</td>
                  <td style="font-size: 9px; color: ${COLORS.gray500}; max-width: 220px;">${escapeHtml(row.rationale)}</td>
                </tr>
              `;
            }).join('')}
            <tr style="background: ${COLORS.gray50}; border-top: 2px solid ${COLORS.navy};">
              <td style="font-weight: 700; color: ${COLORS.navy};">Blended Effective</td>
              <td style="text-align: right; font-weight: 700; color: ${etrColor};">${formatPercent(tx.effectiveTaxRate)}</td>
              <td style="text-align: right; font-weight: 700; color: ${COLORS.navy};">100.0%</td>
              <td style="font-size: 9px; color: ${COLORS.gray500};">Weighted across all jurisdictions</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Pillar Two Impact -->
      ${tx.pillarTwoImpact ? `
      <div class="section-title">OECD Pillar Two Impact</div>
      <div style="background: linear-gradient(145deg, ${COLORS.navy} 0%, #252a5e 100%); border-radius: 6px; padding: 14px 20px; color: white; margin-bottom: 14px; display: flex; align-items: center; gap: 16px;">
        <div style="flex-shrink: 0; width: 40px; height: 40px; background: rgba(94,234,212,0.12); border-radius: 8px; display: flex; align-items: center; justify-content: center;">
          <span style="font-size: 18px; font-weight: 800; color: ${COLORS.tealMid};">P2</span>
        </div>
        <div>
          <div style="font-size: 7px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.16em; font-weight: 700; margin-bottom: 3px;">Global Minimum Tax (15%)</div>
          <div style="font-size: 9px; color: rgba(255,255,255,0.65); line-height: 1.5;">OECD Pillar Two 15% global minimum tax applies</div>
        </div>
      </div>
      ` : ''}

      <!-- Narrative -->
      <div class="callout" style="margin-bottom: 10px;">
        ${escapeHtml(tx.narrative)}
      </div>

      <!-- Methodology -->
      <div class="disclaimer-box">
        <strong>Methodology:</strong> Effective tax rates computed using income-weighted blending across declared jurisdictions. Withholding tax impacts derived from applicable bilateral tax treaties (2024 IBFD treaty database). Transfer pricing risk assessed against OECD BEPS Action 8-10 guidelines and local TP documentation thresholds. Pillar Two (GloBE) top-up tax modeled per OECD Model Rules (Dec 2021, amended 2023) with 15% global minimum. Savings estimated relative to single-jurisdiction US C-corp baseline (21% federal + state).
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
