// Brief v3 — Regional deal strategy: grouped bars by region, per-region
// table, deterministic recommendation, explicit thin-data notes.

import { pageHeader, pageFooter, COLORS, escapeHtml, BRIEF_TITLE, sectionHead, chartSource, emptyState, fmtM, fmtShare, microLabel } from '../helpers';
import { renderGroupedBars } from '../svg-charts/groupedBars';
import type { PDFReportData, ReportMeta } from '../types';

export function renderRegionalStrategyPage(data: PDFReportData, meta: ReportMeta): string {
  const regional = data.brief?.regional ?? null;
  const head = sectionHead('Regional deal strategy', 'Is a global deal the right shape, or do regional rights fetch more in pieces?');

  if (!regional || regional.rows.length === 0) {
    return `
      <div class="report-page">
        ${pageHeader(meta.currentPage, meta.pageCount, BRIEF_TITLE)}
        ${head}
        ${emptyState('Regional split not available', 'The comparable set has no rows with a territory on file, so upfronts cannot be compared by region. Regional pricing has to come from buyer conversations for this asset.')}
        ${pageFooter(meta.reportId)}
      </div>
    `;
  }

  const groups = regional.rows.map((r) => ({
    label: `${r.label} (n=${r.n})`,
    values: [
      { label: 'Median upfront', value: r.upfront?.p50 ?? null },
      { label: 'Median total', value: r.total?.p50 ?? null },
    ],
  }));
  const bars = renderGroupedBars(groups, 560, 190);

  const thin = regional.rows.filter((r) => r.n < 3);
  const thinNote = thin.length
    ? `Thin data: ${thin.map((r) => `${r.label} (n=${r.n})`).join(', ')} — fewer than three deals, so no quartiles are printed and these regions do not support a pricing claim on their own.`
    : 'Every region shown has at least three deals behind it.';

  const q = (s: { p25: number; p50: number; p75: number } | null) => s ? `${fmtM(s.p25)} / <b>${fmtM(s.p50)}</b> / ${fmtM(s.p75)}` : '—';

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, BRIEF_TITLE)}
      ${head}

      <div class="card" style="padding: 10px 12px 6px; margin-bottom: 10px; border-top: 3px solid ${COLORS.navy};">
        ${microLabel('Median upfront and total by region')}
        <div class="chart-container" style="margin: 0;">${bars}</div>
        ${chartSource(regional.source)}
      </div>

      <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 6px;">
        <table class="data-table" style="font-size: 8.5px;">
          <thead><tr>
            <th style="padding: 5px 8px;">Region</th>
            <th style="padding: 5px 8px; text-align: right;">n</th>
            <th style="padding: 5px 8px; text-align: right;">Upfront p25 / p50 / p75</th>
            <th style="padding: 5px 8px; text-align: right;">Median total</th>
            <th style="padding: 5px 8px; text-align: right;">vs global</th>
            <th style="padding: 5px 8px;">Example deal</th>
          </tr></thead>
          <tbody>
            ${regional.rows.map((r) => `
              <tr>
                <td style="padding: 4px 8px; font-weight: 600;">${escapeHtml(r.label)}</td>
                <td style="padding: 4px 8px; text-align: right; ${r.n < 3 ? `color: ${COLORS.rose}; font-weight: 700;` : ''}">${r.n}</td>
                <td style="padding: 4px 8px; text-align: right;">${q(r.upfront)}</td>
                <td style="padding: 4px 8px; text-align: right;">${fmtM(r.total?.p50 ?? null)}</td>
                <td style="padding: 4px 8px; text-align: right;">${r.region === 'global' ? '—' : fmtShare(r.upfrontVsGlobal)}</td>
                <td style="padding: 4px 8px; color: ${COLORS.gray600};">${r.exampleDeal ? `${escapeHtml(r.exampleDeal.parties)}${r.exampleDeal.year ? ` (${r.exampleDeal.year})` : ''}, ${fmtM(r.exampleDeal.upfrontM)} upfront` : '—'}</td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
      ${chartSource(regional.source)}

      <div class="callout" style="margin-top: 12px; font-size: 9.5px;">
        <div style="font-size: 7px; font-weight: 700; letter-spacing: 0.14em; text-transform: uppercase; color: ${COLORS.teal}; margin-bottom: 4px;">Recommendation</div>
        ${escapeHtml(regional.recommendation)}
      </div>

      <div style="font-size: 8.5px; color: ${COLORS.gray500}; margin-top: 10px; line-height: 1.5;">
        ${escapeHtml(thinNote)} Territory is mapped from the wording of each filing; deals with an unusual split (for example, country lists or profit-share carve-outs) sit under "Other / regional".
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
