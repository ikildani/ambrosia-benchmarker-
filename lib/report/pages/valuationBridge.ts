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
  headline: 'Calibrated engine range for this profile',
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

  const drawn = bridge.bars.filter(b => b.informative !== false);
  const totalBars = drawn.filter(b => b.basis === 'total' || b.basis === 'rnpv');
  const upfrontBars = drawn.filter(b => b.basis === 'upfront');
  const compsN = bridge.bars.find(b => b.key === 'comps_total')?.n ?? 0;
  const compRows = data.brief?.compSet?.rows ?? [];
  const verifiedN = compRows.filter(r => r.verified).length;
  const compsNote = compRows.length
    ? `comps are canonical, non-synthetic rows, ${verifiedN} of ${compRows.length} verified against a primary source; bars show low – mid – high`
    : 'no comparable set for this profile; bars show low – mid – high';

  const totalChart = renderFootballField(totalBars, bridge.ask.totalM, 560, { title: 'Total deal value and risk-adjusted value, $M' });
  const upfrontChart = upfrontBars.length > 0
    ? renderFootballField(upfrontBars.concat([{
      key: 'headline', label: 'Headline upfront (calibrated range)', basis: 'upfront',
      low: data.result.terms.upfront.low, mid: data.result.terms.upfront.median, high: data.result.terms.upfront.high,
    }]), bridge.ask.upfrontM, 560, { title: 'Upfront, $M' })
    : '';

  const rows = bridge.bars.map(b => {
    const muted = b.informative === false;
    const color = muted ? COLORS.gray400 : COLORS.navy;
    return `
    <tr style="${muted ? `color: ${COLORS.gray400};` : ''}">
      <td style="padding: 4px 8px;">${escapeHtml(b.label)}${muted ? ` <span style="font-size: 7px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: ${COLORS.rose};">not used</span>` : ''}</td>
      <td style="text-align: right; font-variant-numeric: tabular-nums; padding: 4px 8px;">${fmtM(b.low)}</td>
      <td style="text-align: right; font-weight: 700; color: ${color}; font-variant-numeric: tabular-nums; padding: 4px 8px;">${fmtM(b.mid)}</td>
      <td style="text-align: right; font-variant-numeric: tabular-nums; padding: 4px 8px;">${fmtM(b.high)}</td>
      <td style="text-align: right; color: ${COLORS.gray500};">${b.n != null ? b.n.toLocaleString() : '—'}</td>
      <td style="color: ${muted ? COLORS.gray400 : COLORS.gray600};">${escapeHtml(WHAT_IT_MEASURES[b.key])}${b.note ? ` <span style="color: ${COLORS.gray400};">— ${escapeHtml(b.note)}</span>` : ''}</td>
    </tr>`;
  }).join('');

  const askTag = (basis: 'headline' | 'comps') => basis === 'comps' ? 'comps median' : 'headline mid';

  // How the calibrated headline is built: baseline median for this phase and
  // area, then every modifier the engine applied, so the reader can follow the
  // arithmetic instead of trusting a label.
  const baseline = data.result.drillDown?.totalDealValue?.baseline ?? null;
  const mods = (data.result.modifiers ?? []).filter(m => Number.isFinite(m.multiplier) && Math.abs(m.multiplier - 1) >= 0.005);
  const shownMods = [...mods].sort((a, b) => Math.abs(b.multiplier - 1) - Math.abs(a.multiplier - 1)).slice(0, 8);
  const headlineMid = data.result.terms.totalDealValue.median;
  const buildUp = baseline ? `
      <div class="card-sm" style="margin-bottom: 8px; padding: 6px 12px;">
        ${microLabel('How the calibrated headline is built')}
        <div style="display: flex; flex-wrap: wrap; align-items: baseline; gap: 4px 10px; font-size: 8.5px; color: ${COLORS.gray700};">
          <span><strong style="color: ${COLORS.navy};">${fmtM(baseline.totalValueMedian)}</strong> ${escapeHtml(String(baseline.therapeuticArea))} ${escapeHtml(String(baseline.phase).replace(/_/g, ' '))} baseline median${baseline.source === 'calibrated' ? ` (calibrated from ${baseline.sampleSize ?? '—'} disclosed deals${baseline.calibratedAt ? `, ${escapeHtml(String(baseline.calibratedAt).slice(0, 10))}` : ''})` : ' (static table; no calibration for this cell yet)'}</span>
          ${Number.isFinite(baseline.dealTypeMultiplier) && Math.abs(baseline.dealTypeMultiplier - 1) >= 0.005 ? `<span>× <strong>${baseline.dealTypeMultiplier.toFixed(2)}</strong> deal structure</span>` : ''}
          ${shownMods.map(m => `<span>× <strong>${m.multiplier.toFixed(2)}</strong> ${escapeHtml(m.name)}${m.context ? ` <span style="color: ${COLORS.gray400};">(${escapeHtml(m.context)})</span>` : ''}</span>`).join('')}
          ${mods.length > shownMods.length ? `<span style="color: ${COLORS.gray400};">and ${mods.length - shownMods.length} smaller modifier${mods.length - shownMods.length === 1 ? '' : 's'}</span>` : ''}
          <span>= <strong style="color: ${COLORS.teal};">${fmtM(headlineMid)}</strong> headline mid (effective × ${Number.isFinite(baseline.effectiveMultiplier) ? baseline.effectiveMultiplier.toFixed(2) : '—'}; ±${Math.round(baseline.rangeWidthPercent ?? 0)}% range)</span>
        </div>
        <div style="margin-top: 4px; font-size: 7.5px; color: ${COLORS.gray400};">Multipliers are dampened before they compound; the Deal Terms page in the appendix lists every one with its source.</div>
      </div>` : '';

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, BRIEF_TITLE)}
      ${head}

      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; margin-bottom: 8px;">
        <div class="card-sm" style="border-top: 3px solid ${COLORS.teal};">
          ${microLabel('Ask')}
          <div style="font-size: 18px; font-weight: 800; color: ${COLORS.teal}; letter-spacing: -0.02em;">${fmtM(bridge.ask.totalM)}</div>
          <div style="font-size: 8.5px; color: ${COLORS.gray500};">${fmtM(bridge.ask.upfrontM)} upfront · ${askTag(bridge.askBasis.total)}${bridge.askBasis.total !== bridge.askBasis.upfront ? ` / ${askTag(bridge.askBasis.upfront)}` : ''}</div>
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
      <div style="font-size: 8px; color: ${COLORS.gray500}; margin-bottom: 10px; line-height: 1.4;"><strong style="color: ${COLORS.gray600};">Anchoring rule.</strong> ${escapeHtml(bridge.policy)}</div>

      <div class="card" style="padding: 12px 14px 8px; margin-bottom: 10px;">
        <div class="chart-container" style="margin: 0;">${totalChart}</div>
        ${upfrontChart ? `<div class="chart-container" style="margin: 6px 0 0;">${upfrontChart}</div>` : ''}
        ${chartSource({ source: 'Solidus deal database and financial engine', n: compsN, asOf: bridge.asOf, note: compsNote })}
      </div>

      <div class="callout" style="margin-bottom: 8px; font-size: 8.5px; padding: 8px 12px;">
        <div style="font-size: 7px; font-weight: 700; color: ${COLORS.teal}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 4px;">Reconciliation</div>
        ${escapeHtml(bridge.reconciliation)}
      </div>

      ${buildUp}

      <table class="data-table compact" style="font-size: 8px;">
        <thead>
          <tr><th>Method</th><th style="text-align: right;">Low</th><th style="text-align: right;">Mid</th><th style="text-align: right;">High</th><th style="text-align: right;">n</th><th>What it measures</th></tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
