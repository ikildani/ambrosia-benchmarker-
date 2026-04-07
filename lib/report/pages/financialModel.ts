// Page: Financial Modeling — rNPV & Monte Carlo
// rNPV summary KPIs, cash flow table, Monte Carlo distribution, cross-validation

import { formatUsd, formatPercent, pageHeader, pageFooter, COLORS, escapeHtml } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';
import type { CashFlowYear } from '@/lib/financial/types';

/**
 * Picks representative cash flow rows for the table:
 * first 5 years, approval year, peak revenue year, and a totals row.
 * Deduplicates if any of those overlap with the first 5.
 */
function selectCashFlowRows(cashFlows: CashFlowYear[]): { rows: CashFlowYear[]; totalRow: CashFlowYear | null } {
  if (cashFlows.length === 0) return { rows: [], totalRow: null };

  const first5 = cashFlows.slice(0, 5);
  const shownYears = new Set(first5.map(cf => cf.year));

  // Find the approval year (first year with revenue > 0)
  const approvalRow = cashFlows.find(cf => cf.revenue > 0);
  if (approvalRow && !shownYears.has(approvalRow.year)) {
    first5.push(approvalRow);
    shownYears.add(approvalRow.year);
  }

  // Find the peak revenue year
  const peakRow = cashFlows.reduce<CashFlowYear | null>((best, cf) =>
    (!best || cf.revenue > best.revenue) ? cf : best, null);
  if (peakRow && !shownYears.has(peakRow.year)) {
    first5.push(peakRow);
    shownYears.add(peakRow.year);
  }

  // Build a synthetic totals row
  const totalRow: CashFlowYear = {
    year: 0,
    revenue: cashFlows.reduce((s, cf) => s + cf.revenue, 0),
    cogs: cashFlows.reduce((s, cf) => s + cf.cogs, 0),
    grossProfit: cashFlows.reduce((s, cf) => s + cf.grossProfit, 0),
    rdCosts: cashFlows.reduce((s, cf) => s + cf.rdCosts, 0),
    sgaCosts: cashFlows.reduce((s, cf) => s + cf.sgaCosts, 0),
    netCashFlow: cashFlows.reduce((s, cf) => s + cf.netCashFlow, 0),
    discountFactor: 0,
    presentValue: cashFlows.reduce((s, cf) => s + cf.presentValue, 0),
    cumulativePoS: 0,
    riskAdjustedPV: cashFlows.reduce((s, cf) => s + cf.riskAdjustedPV, 0),
  };

  // Sort the selected rows chronologically
  first5.sort((a, b) => a.year - b.year);

  return { rows: first5, totalRow };
}

/**
 * Renders a text-based distribution shape using block characters.
 * Shows a simplified histogram bar for each of 10 bins.
 */
function renderDistributionShape(histogram: { binStart: number; binEnd: number; count: number; percentage: number }[]): string {
  if (!histogram || histogram.length === 0) return '';

  // Consolidate into ~10 display bins
  const binCount = 10;
  const perGroup = Math.max(1, Math.ceil(histogram.length / binCount));
  const groups: { label: string; pct: number }[] = [];

  for (let i = 0; i < histogram.length; i += perGroup) {
    const slice = histogram.slice(i, i + perGroup);
    const totalPct = slice.reduce((s, b) => s + b.percentage, 0);
    const midBin = slice[Math.floor(slice.length / 2)];
    groups.push({
      label: formatUsd(midBin.binStart),
      pct: totalPct,
    });
  }

  const maxPct = Math.max(...groups.map(g => g.pct), 1);

  return groups.map(g => {
    const barWidth = Math.round((g.pct / maxPct) * 100);
    return `
      <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 2px;">
        <div style="width: 50px; text-align: right; font-size: 8px; color: ${COLORS.gray400}; flex-shrink: 0;">${escapeHtml(g.label)}</div>
        <div style="flex: 1; height: 8px; background: ${COLORS.gray100}; border-radius: 2px; overflow: hidden;">
          <div style="width: ${barWidth}%; height: 100%; background: linear-gradient(90deg, ${COLORS.teal}, ${COLORS.cyan}); border-radius: 2px;"></div>
        </div>
        <div style="width: 32px; text-align: right; font-size: 8px; color: ${COLORS.gray400}; flex-shrink: 0;">${g.pct.toFixed(1)}%</div>
      </div>
    `;
  }).join('');
}

export function renderFinancialModelPage(data: PDFReportData, meta: ReportMeta): string {
  if (!data.rnpvResult) return '';

  const rnpv = data.rnpvResult;
  const mc = data.monteCarloResult;
  const { rows, totalRow } = selectCashFlowRows(rnpv.cashFlows);

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, 'Deal Valuation Report')}

      <div class="section-title-lg">Financial Modeling &mdash; rNPV &amp; Monte Carlo</div>

      <!-- rNPV Summary KPIs -->
      <div class="section-title">Risk-Adjusted NPV Summary</div>
      <div class="grid-4" style="margin-bottom: 18px;">
        <div class="kpi-card">
          <div class="kpi-value">${formatUsd(rnpv.riskAdjustedNPV)}</div>
          <div class="kpi-label">Total rNPV</div>
          <div class="kpi-sub">Risk-adjusted</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value" style="color: ${COLORS.navy};">${formatPercent(rnpv.cumulativePoS * 100, 1)}</div>
          <div class="kpi-label">Cumulative PoS</div>
          <div class="kpi-sub">Current phase to market</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value">${formatUsd(rnpv.unadjustedNPV)}</div>
          <div class="kpi-label">Unadjusted NPV</div>
          <div class="kpi-sub">Before risk weighting</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value" style="color: ${COLORS.navy};">${rnpv.yearsToMarket}yr</div>
          <div class="kpi-label">Years to Market</div>
          <div class="kpi-sub">Peak sales ${rnpv.peakSalesYear}</div>
        </div>
      </div>

      <!-- Cash Flow Table -->
      <div class="section-title">Projected Cash Flows</div>
      <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 18px;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Year</th>
              <th style="text-align: right;">Revenue</th>
              <th style="text-align: right;">R&amp;D Costs</th>
              <th style="text-align: right;">Net CF</th>
              <th style="text-align: right;">Present Value</th>
              <th style="text-align: right;">Risk-Adj PV</th>
            </tr>
          </thead>
          <tbody>
            ${rows.map(cf => `
              <tr>
                <td style="font-weight: 600; color: ${COLORS.navy};">${cf.year}</td>
                <td style="text-align: right;">${formatUsd(cf.revenue)}</td>
                <td style="text-align: right; color: ${COLORS.rose};">${cf.rdCosts > 0 ? '-' + formatUsd(cf.rdCosts) : '$0'}</td>
                <td style="text-align: right; color: ${cf.netCashFlow >= 0 ? COLORS.green : COLORS.rose};">${formatUsd(cf.netCashFlow)}</td>
                <td style="text-align: right;">${formatUsd(cf.presentValue)}</td>
                <td class="value-cell">${formatUsd(cf.riskAdjustedPV)}</td>
              </tr>
            `).join('')}
            ${rows.length < rnpv.cashFlows.length ? `
              <tr>
                <td colspan="6" style="text-align: center; font-size: 9px; color: ${COLORS.gray400}; padding: 4px;">... ${rnpv.cashFlows.length - rows.length} additional years omitted ...</td>
              </tr>
            ` : ''}
            ${totalRow ? `
              <tr style="border-top: 2px solid ${COLORS.navy}; background: ${COLORS.gray50};">
                <td style="font-weight: 800; color: ${COLORS.navy};">Total</td>
                <td style="text-align: right; font-weight: 700;">${formatUsd(totalRow.revenue)}</td>
                <td style="text-align: right; font-weight: 700; color: ${COLORS.rose};">-${formatUsd(totalRow.rdCosts)}</td>
                <td style="text-align: right; font-weight: 700;">${formatUsd(totalRow.netCashFlow)}</td>
                <td style="text-align: right; font-weight: 700;">${formatUsd(totalRow.presentValue)}</td>
                <td class="value-cell" style="font-weight: 800;">${formatUsd(totalRow.riskAdjustedPV)}</td>
              </tr>
            ` : ''}
          </tbody>
        </table>
      </div>

      ${mc ? `
      <!-- Monte Carlo Distribution -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 18px;">
        <div>
          <div class="section-title">Monte Carlo Distribution</div>
          <div class="card" style="padding: 12px;">
            ${renderDistributionShape(mc.histogram)}
            <div style="text-align: center; font-size: 8px; color: ${COLORS.gray400}; margin-top: 6px;">
              ${mc.iterations.toLocaleString()} iterations &middot; rNPV distribution ($M)
            </div>
          </div>
        </div>
        <div>
          <div class="section-title">Percentile Summary</div>
          <div class="card" style="padding: 0; overflow: hidden;">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Percentile</th>
                  <th style="text-align: right;">rNPV Value</th>
                </tr>
              </thead>
              <tbody>
                <tr><td>P5 (Bear Case)</td><td class="value-cell">${formatUsd(mc.percentiles.p5)}</td></tr>
                <tr><td>P25</td><td class="value-cell">${formatUsd(mc.percentiles.p25)}</td></tr>
                <tr><td style="font-weight: 700;">P50 (Median)</td><td class="value-cell" style="font-weight: 800;">${formatUsd(mc.percentiles.p50)}</td></tr>
                <tr><td>P75</td><td class="value-cell">${formatUsd(mc.percentiles.p75)}</td></tr>
                <tr><td>P95 (Bull Case)</td><td class="value-cell">${formatUsd(mc.percentiles.p95)}</td></tr>
              </tbody>
            </table>
          </div>
          <div style="margin-top: 8px; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <div class="card-sm" style="text-align: center;">
              <div style="font-size: 16px; font-weight: 800; color: ${mc.probabilityOfPositiveNPV >= 0.7 ? COLORS.green : mc.probabilityOfPositiveNPV >= 0.5 ? COLORS.amber : COLORS.rose};">${formatPercent(mc.probabilityOfPositiveNPV * 100, 0)}</div>
              <div style="font-size: 7px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; margin-top: 2px;">Prob. Positive NPV</div>
            </div>
            <div class="card-sm" style="text-align: center;">
              <div style="font-size: 16px; font-weight: 800; color: ${COLORS.navy};">${formatUsd(mc.stdDev)}</div>
              <div style="font-size: 7px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; margin-top: 2px;">Std. Deviation</div>
            </div>
          </div>

          <!-- Risk Metrics: VaR / CVaR / Distribution Shape -->
          ${mc.var95 !== undefined ? `
          <div style="margin-top: 10px;">
            <div style="font-size: 8px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 6px;">Institutional Risk Metrics</div>
            <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 6px;">
              <div class="card-sm" style="text-align: center; border-top: 2px solid ${COLORS.rose};">
                <div style="font-size: 12px; font-weight: 800; color: ${COLORS.rose};">${formatUsd(mc.var95)}</div>
                <div style="font-size: 6px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; margin-top: 2px;">VaR (95%)</div>
              </div>
              <div class="card-sm" style="text-align: center; border-top: 2px solid ${COLORS.rose};">
                <div style="font-size: 12px; font-weight: 800; color: ${COLORS.rose};">${formatUsd(mc.cvar95)}</div>
                <div style="font-size: 6px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; margin-top: 2px;">CVaR (95%)</div>
              </div>
              <div class="card-sm" style="text-align: center; border-top: 2px solid ${mc.skewness > 0 ? COLORS.teal : COLORS.amber};">
                <div style="font-size: 12px; font-weight: 800; color: ${mc.skewness > 0 ? COLORS.teal : COLORS.amber};">${mc.skewness > 0 ? '+' : ''}${mc.skewness.toFixed(2)}</div>
                <div style="font-size: 6px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; margin-top: 2px;">Skewness</div>
              </div>
              <div class="card-sm" style="text-align: center; border-top: 2px solid ${mc.kurtosis > 1 ? COLORS.amber : COLORS.gray300};">
                <div style="font-size: 12px; font-weight: 800; color: ${mc.kurtosis > 1 ? COLORS.amber : COLORS.navy};">${mc.kurtosis > 0 ? '+' : ''}${mc.kurtosis.toFixed(2)}</div>
                <div style="font-size: 6px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 700; margin-top: 2px;">Tail Risk</div>
              </div>
            </div>
          </div>
          ` : ''}
        </div>
      </div>
      ` : ''}

      ${rnpv.crossValidation ? `
      <!-- Cross-Validation -->
      <div class="section-title">Cross-Validation: Benchmark vs. rNPV</div>
      <div style="display: grid; grid-template-columns: 1fr auto 1fr; gap: 12px; align-items: center;">
        <div class="card-sm" style="text-align: center; border-top: 3px solid ${COLORS.navy};">
          <div style="font-size: 7px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; margin-bottom: 4px;">Benchmark Comps</div>
          <div style="font-size: 20px; font-weight: 800; color: ${COLORS.navy};">${formatUsd(rnpv.crossValidation.benchmarkMedian)}</div>
          <div style="font-size: 8px; color: ${COLORS.gray400};">Median deal value</div>
        </div>
        <div style="text-align: center;">
          <div style="font-size: 18px; font-weight: 800; color: ${rnpv.crossValidation.divergencePercent > 0 ? COLORS.teal : COLORS.rose};">
            ${rnpv.crossValidation.divergencePercent > 0 ? '+' : ''}${formatPercent(rnpv.crossValidation.divergencePercent, 1)}
          </div>
          <div style="font-size: 7px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.08em;">Divergence</div>
        </div>
        <div class="card-sm" style="text-align: center; border-top: 3px solid ${COLORS.teal};">
          <div style="font-size: 7px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.1em; font-weight: 700; margin-bottom: 4px;">rNPV-Implied</div>
          <div style="font-size: 20px; font-weight: 800; color: ${COLORS.teal};">${formatUsd(rnpv.crossValidation.rnpvMedian)}</div>
          <div style="font-size: 8px; color: ${COLORS.gray400};">Median implied value</div>
        </div>
      </div>
      <div class="callout" style="margin-top: 10px;">
        ${escapeHtml(rnpv.crossValidation.narrative)}
      </div>
      ` : ''}

      <!-- Model Assumptions -->
      ${rnpv.modelAssumptions && rnpv.modelAssumptions.length > 0 ? `
      <div style="margin-top: 14px;">
        <div style="font-size: 8px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px;">Key Model Assumptions</div>
        <div style="font-size: 9px; color: ${COLORS.gray500}; line-height: 1.6;">
          ${rnpv.modelAssumptions.map(a => `<span style="margin-right: 6px;">&bull; ${escapeHtml(a)}</span>`).join('')}
        </div>
      </div>
      ` : ''}

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
