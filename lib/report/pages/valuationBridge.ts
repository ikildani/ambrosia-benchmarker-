// Page: Valuation bridge — five ways to value the asset, reconciled to one number.

import { renderFootballField } from '../svg-charts/footballField';
import { pageHeader, pageFooter, sectionHead, chartSource, emptyState, fmtM, microLabel, escapeHtml, COLORS, BRIEF_TITLE } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';
import type { BridgeBar } from '@/lib/brief/types';

const WHAT_IT_MEASURES: Record<BridgeBar['key'], string> = {
  comps_total: 'Disclosed total deal value in comparable deals',
  comps_upfront: 'Cash paid at signing in comparable deals',
  rnpv: 'Risk-adjusted present value of the asset’s cash flows',
  monte_carlo: 'Distribution of the risk-adjusted value under uncertainty',
  scenarios: 'Bear-to-bull envelope around the base case',
  buyer_implied: 'Value to named buyers after their strategic premium',
  headline: 'Calibrated engine range; the ask is the mid',
};

export function renderValuationBridgePage(data: PDFReportData, meta: ReportMeta): string {
  const bridge = data.brief?.bridge;
  const head = sectionHead('Valuation bridge', 'Five ways to value this asset, reconciled to one number.');

  if (!bridge || bridge.bars.length === 0) {
    return `
      <div class="report-page">
        ${pageHeader(meta.currentPage, meta.pageCount, BRIEF_TITLE)}
        ${head}
        ${emptyState('Valuation bridge not available', 'The bridge needs at least the engine headline; the financial model did not run for this profile, so no reconciliation is printed.')}
        ${pageFooter(meta.reportId)}
      </div>
    `;
  }

  const totalBars = bridge.bars.filter(b => b.basis === 'total' || b.basis === 'rnpv');
  const upfrontBars = bridge.bars.filter(b => b.basis === 'upfront');
  const compsN = bridge.bars.find(b => b.key === 'comps_total')?.n ?? 0;

  const totalChart = renderFootballField(totalBars, bridge.ask.totalM, 560, { title: 'Total deal value and risk-adjusted value, $M' });
  const upfrontChart = upfrontBars.length > 0
    ? renderFootballField(upfrontBars.concat([{
      key: 'headline', label: 'Headline upfront (this brief)', basis: 'upfront',
      low: data.result.terms.upfront.low, mid: data.result.terms.upfront.median, high: data.result.terms.upfront.high,
    }]), bridge.ask.upfrontM, 560, { title: 'Upfront, $M' })
    : '';

  const rows = bridge.bars.map(b => `
    <tr>
      <td>${escapeHtml(b.label)}</td>
      <td style="text-align: right; font-variant-numeric: tabular-nums;">${fmtM(b.low)}</td>
      <td style="text-align: right; font-weight: 700; color: ${COLORS.navy}; font-variant-numeric: tabular-nums;">${fmtM(b.mid)}</td>
      <td style="text-align: right; font-variant-numeric: tabular-nums;">${fmtM(b.high)}</td>
      <td style="text-align: right; color: ${COLORS.gray500};">${b.n != null ? b.n.toLocaleString() : '—'}</td>
      <td style="color: ${COLORS.gray600};">${escapeHtml(WHAT_IT_MEASURES[b.key])}${b.note ? ` <span style="color: ${COLORS.gray400};">— ${escapeHtml(b.note)}</span>` : ''}</td>
    </tr>`).join('');

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, BRIEF_TITLE)}
      ${head}

      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 12px;">
        <div class="card-sm" style="border-top: 3px solid ${COLORS.teal};">
          ${microLabel('Ask')}
          <div style="font-size: 18px; font-weight: 800; color: ${COLORS.teal}; letter-spacing: -0.02em;">${fmtM(bridge.ask.totalM)}</div>
          <div style="font-size: 8.5px; color: ${COLORS.gray500};">${fmtM(bridge.ask.upfrontM)} upfront</div>
        </div>
        <div class="card-sm" style="border-top: 3px solid ${COLORS.amber};">
          ${microLabel('Floor')}
          <div style="font-size: 18px; font-weight: 800; color: ${COLORS.navy}; letter-spacing: -0.02em;">${fmtM(bridge.floor.totalM)}</div>
          <div style="font-size: 8.5px; color: ${COLORS.gray500};">${fmtM(bridge.floor.upfrontM)} upfront</div>
        </div>
        <div class="card-sm" style="border-top: 3px solid ${COLORS.rose};">
          ${microLabel('Walk-away')}
          <div style="font-size: 18px; font-weight: 800; color: ${COLORS.rose}; letter-spacing: -0.02em;">${fmtM(bridge.walkAway.upfrontM)}</div>
          <div style="font-size: 8.5px; color: ${COLORS.gray500};">upfront</div>
        </div>
      </div>

      <div class="card" style="padding: 12px 14px 8px; margin-bottom: 10px;">
        <div class="chart-container" style="margin: 0;">${totalChart}</div>
        ${upfrontChart ? `<div class="chart-container" style="margin: 6px 0 0;">${upfrontChart}</div>` : ''}
        ${chartSource({ source: 'Solidus deal database and financial engine', n: compsN, asOf: bridge.asOf, note: 'comps are verified, canonical, non-synthetic rows; bars show low – mid – high' })}
      </div>

      <div class="callout" style="margin-bottom: 10px; font-size: 9.5px;">
        <div style="font-size: 7px; font-weight: 700; color: ${COLORS.teal}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 4px;">Reconciliation</div>
        ${escapeHtml(bridge.reconciliation)}
      </div>

      <table class="data-table" style="font-size: 8.5px;">
        <thead>
          <tr><th>Method</th><th style="text-align: right;">Low</th><th style="text-align: right;">Mid</th><th style="text-align: right;">High</th><th style="text-align: right;">n</th><th>What it measures</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
