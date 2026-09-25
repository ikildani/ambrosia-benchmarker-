// Brief v3 — Term-sheet precedent map: clause frequency table with bar cells
// (share of all comps vs share at the asset's phase), guidance column,
// royalty tier strip, term length, and the undisclosed-option-fee note.

import { pageHeader, pageFooter, COLORS, escapeHtml, BRIEF_TITLE, sectionHead, chartSource, emptyState, fmtShare, microLabel, phaseLabelAny } from '../helpers';
import { renderDistributionStrips } from '../svg-charts/distributionStrip';
import type { PDFReportData, ReportMeta } from '../types';

function barCell(share: number | null, n: number, color: string, label: string): string {
  if (share == null || n === 0) {
    return `<div style="display: flex; align-items: center; gap: 6px; font-size: 7.5px; color: ${COLORS.gray400};"><span style="width: 34px;">${escapeHtml(label)}</span><span>— (n=${n})</span></div>`;
  }
  const pct = Math.round(share * 100);
  return `
    <div style="display: flex; align-items: center; gap: 6px; font-size: 7.5px; color: ${COLORS.gray600};">
      <span style="width: 34px;">${escapeHtml(label)}</span>
      <span style="flex: 1; height: 6px; background: ${COLORS.gray100}; border-radius: 3px; overflow: hidden;"><span style="display: block; width: ${Math.max(pct, share > 0 ? 2 : 0)}%; height: 100%; background: ${color};"></span></span>
      <span style="width: 42px; text-align: right; font-weight: 600;">${pct}% <span style="font-weight: 400; color: ${COLORS.gray400};">/${n}</span></span>
    </div>`;
}

export function renderTermSheetPrecedentPage(data: PDFReportData, meta: ReportMeta): string {
  const ts = data.brief?.termSheet ?? null;
  const head = sectionHead('Term-sheet precedent map', 'Which clauses show up in deals like this, and what should we ask for?');

  if (!ts || ts.source.n === 0) {
    return `
      <div class="report-page">
        ${pageHeader(meta.currentPage, meta.pageCount, BRIEF_TITLE)}
        ${head}
        ${emptyState('Clause precedent not available', 'No deals in the same therapeutic area or indication passed the quality filter, so clause frequencies cannot be computed for this asset.')}
        ${pageFooter(meta.reportId)}
      </div>
    `;
  }

  const phaseLabel = phaseLabelAny(data.brief?.asset.phase);
  const optionFee = ts.clauses.find((c) => c.key === 'option_fee');

  const rows = ts.clauses.map((c) => `
    <tr>
      <td style="padding: 4px 8px; font-weight: 600; white-space: nowrap;">${escapeHtml(c.clause)}</td>
      <td style="padding: 4px 8px; width: 170px;">
        ${barCell(c.share, c.n, COLORS.cyan, 'All')}
        ${barCell(c.sharePhase, c.nPhase, COLORS.navy, escapeHtml(phaseLabel))}
      </td>
      <td style="padding: 4px 8px; color: ${COLORS.gray700}; line-height: 1.4;">${escapeHtml(c.guidance)}</td>
    </tr>`).join('');

  const royaltyStrip = renderDistributionStrips([
    { label: 'Low tier', stats: ts.royaltyTiers.low, n: ts.royaltyTiers.n },
    { label: 'High tier', stats: ts.royaltyTiers.high, n: ts.royaltyTiers.n },
  ], data.brief?.decision?.ask.royaltyPct?.median ?? null, 300, '%');

  const termText = ts.termYears
    ? `<div class="kpi-value" style="font-size: 20px;">${ts.termYears.p50.toFixed(0)} yrs</div>
       <div class="kpi-label">Median term length</div>
       <div class="kpi-sub" style="font-size: 8px;">p25 ${ts.termYears.p25.toFixed(0)} · p75 ${ts.termYears.p75.toFixed(0)} · n=${ts.termYears.n}</div>`
    : `<div class="kpi-value" style="font-size: 16px; color: ${COLORS.gray400};">—</div>
       <div class="kpi-label">Term length</div>
       <div class="kpi-sub" style="font-size: 8px;">disclosed in fewer than 3 of ${ts.source.n} deals</div>`;

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, BRIEF_TITLE)}
      ${head}

      <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 6px;">
        <table class="data-table" style="font-size: 8.5px;">
          <thead><tr>
            <th style="padding: 5px 8px;">Clause</th>
            <th style="padding: 5px 8px;">Share disclosed present — all vs at ${escapeHtml(phaseLabel)}</th>
            <th style="padding: 5px 8px;">What to ask for</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>
      ${chartSource(ts.source)}

      <div class="grid-2" style="margin-top: 10px; margin-bottom: 8px;">
        <div class="card-sm" style="padding: 8px 10px 4px;">
          ${microLabel('Royalty tiers (p25–p75, median tick)')}
          <div class="chart-container" style="margin: 0;">${royaltyStrip}</div>
          ${chartSource({ ...ts.source, n: ts.royaltyTiers.n, note: 'deals with a disclosed royalty' })}
        </div>
        <div class="kpi-card" style="padding: 12px 10px; display: flex; flex-direction: column; justify-content: center;">
          ${termText}
        </div>
      </div>

      <div style="font-size: 8.5px; color: ${COLORS.gray500}; line-height: 1.5;">
        A clause counts only when the filing discloses it; a low share means "rarely disclosed", not "rarely agreed". ${optionFee ? `Option exercise fees are undisclosed across the set (${optionFee.n} deals, ${fmtShare(optionFee.share)} with a fee on file), so the guidance on that line rests on market practice rather than these filings.` : ''}
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
