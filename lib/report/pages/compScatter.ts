// Brief v3 — Comparable set page: scatter, distribution strips, KPI strip,
// headline drivers, caveat. Reads brief.compSet and brief.bridge.ask; falls
// back to result.terms medians for the asset marker.

import { pageHeader, pageFooter, COLORS, escapeHtml, BRIEF_TITLE, sectionHead, chartSource, emptyState, fmtM, fmtShare, microLabel, phaseLabelAny } from '../helpers';
import { renderCompScatter } from '../svg-charts/scatter';
import { renderDistributionStrips } from '../svg-charts/distributionStrip';
import type { PDFReportData, ReportMeta } from '../types';

const STRUCTURE_LABEL: Record<string, string> = {
  license: 'License', option: 'Option', acquisition: 'Acquisition', collaboration: 'Collaboration',
  co_development: 'Co-development', co_promotion: 'Co-promotion', other: 'Other',
};

export function structureLabel(s: string): string {
  return STRUCTURE_LABEL[s] ?? s;
}

export function renderCompScatterPage(data: PDFReportData, meta: ReportMeta): string {
  const compSet = data.brief?.compSet ?? null;
  const head = sectionHead('Comparable set', 'What have assets like this one actually commanded, and which deals drive our number?');

  if (!compSet || compSet.rows.length < 3) {
    const n = compSet?.rows.length ?? 0;
    return `
      <div class="report-page">
        ${pageHeader(meta.currentPage, meta.pageCount, BRIEF_TITLE)}
        ${head}
        ${emptyState('Comparable set not available', n === 0
          ? 'No deals in the same therapeutic area or indication passed the quality filter (non-synthetic, canonical, not rejected or flagged, with disclosed economics). The valuation bridge relies on the model and buyer evidence instead.'
          : `Only ${n} qualifying comparable${n === 1 ? '' : 's'} — fewer than the three needed to print a distribution. The rows that exist are listed in the comparable appendix.`)}
        ${pageFooter(meta.reportId)}
      </div>
    `;
  }

  const ask = data.brief?.bridge?.ask ?? {
    upfrontM: data.result.terms.upfront.median,
    totalM: data.result.terms.totalDealValue.median,
  };
  const royaltyAsk = data.brief?.decision?.ask.royaltyPct?.median
    ?? (data.result.tieredRoyalties?.base ? (data.result.tieredRoyalties.base.low + data.result.tieredRoyalties.base.high) / 2 : null);

  const scatter = renderCompScatter(compSet.rows, { upfrontM: ask.upfrontM, totalM: ask.totalM, label: 'Your ask' }, 560, 236);

  const upfrontBuckets = compSet.byPhase.map((b) => ({ label: phaseLabelAny(b.phase), stats: b.stats.upfront, n: b.stats.n }));
  const royaltyBuckets = compSet.byPhase.map((b) => ({ label: phaseLabelAny(b.phase), stats: b.stats.royaltyMid, n: b.stats.n }));
  const stripUpfront = renderDistributionStrips(upfrontBuckets, ask.upfrontM, 268, '$M');
  const stripRoyalty = renderDistributionStrips(royaltyBuckets, royaltyAsk, 268, '%');

  const { all, exOutliers } = compSet.stats;
  const sameN = compSet.rows.filter((r) => r.sameIndication).length;
  const verifiedN = compSet.rows.filter((r) => r.verified).length;
  const outlierN = compSet.rows.filter((r) => r.outlier).length;

  const kpi = (value: string, label: string, sub: string) => `
    <div class="kpi-card" style="padding: 10px 8px;">
      <div class="kpi-value" style="font-size: 20px;">${escapeHtml(value)}</div>
      <div class="kpi-label">${escapeHtml(label)}</div>
      <div class="kpi-sub" style="font-size: 8px;">${escapeHtml(sub)}</div>
    </div>`;

  const driverRows = compSet.headlineDriverIds
    .map((id) => compSet.rows.find((r) => r.id === id))
    .filter((r): r is NonNullable<typeof r> => !!r);

  const drivers = driverRows.length
    ? `
      <table class="data-table" style="font-size: 8.5px;">
        <thead><tr>
          <th style="padding: 5px 8px;">Parties</th><th style="padding: 5px 8px;">Year</th><th style="padding: 5px 8px;">Phase</th>
          <th style="padding: 5px 8px; text-align: right;">Upfront</th><th style="padding: 5px 8px; text-align: right;">Total</th><th style="padding: 5px 8px; text-align: right;">Relevance</th>
        </tr></thead>
        <tbody>
          ${driverRows.map((r) => `
            <tr>
              <td style="padding: 4px 8px;">${escapeHtml(r.licensor)} → ${escapeHtml(r.licensee)}${r.sameIndication ? ' <span class="badge badge-teal" style="font-size: 6.5px; padding: 1px 4px;">Same indication</span>' : ''}</td>
              <td style="padding: 4px 8px;">${r.year ?? '—'}</td>
              <td style="padding: 4px 8px;">${escapeHtml(phaseLabelAny(r.phase))}</td>
              <td style="padding: 4px 8px; text-align: right;">${fmtM(r.upfrontM)}</td>
              <td style="padding: 4px 8px; text-align: right; font-weight: 700; color: ${COLORS.navy};">${fmtM(r.totalM)}</td>
              <td style="padding: 4px 8px; text-align: right;">${r.relevance}</td>
            </tr>`).join('')}
        </tbody>
      </table>`
    : emptyState('No headline drivers', 'Every row in the set is a statistical outlier on total value, so none is used to anchor the headline.');

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, BRIEF_TITLE)}
      ${head}

      <div class="card" style="padding: 10px 12px 6px; margin-bottom: 10px; border-top: 3px solid ${COLORS.navy};">
        ${microLabel('Upfront vs total deal value')}
        <div class="chart-container" style="margin: 0;">${scatter}</div>
        ${chartSource(compSet.source)}
      </div>

      <div class="grid-2" style="margin-bottom: 10px;">
        <div class="card-sm" style="padding: 8px 10px 4px;">
          ${microLabel('Upfront by phase (p25–p75, median tick)')}
          <div class="chart-container" style="margin: 0;">${stripUpfront}</div>
          ${chartSource({ ...compSet.source, note: 'diamond = your ask' })}
        </div>
        <div class="card-sm" style="padding: 8px 10px 4px;">
          ${microLabel('Royalty midpoint by phase')}
          <div class="chart-container" style="margin: 0;">${stripRoyalty}</div>
          ${chartSource({ ...compSet.source, note: royaltyAsk != null ? 'diamond = your ask' : 'no royalty ask set' })}
        </div>
      </div>

      <div class="grid-4" style="margin-bottom: 10px;">
        ${kpi(fmtM(all.total?.p50 ?? null), 'Headline median total', `all ${all.n} rows`)}
        ${kpi(fmtM(exOutliers.total?.p50 ?? null), 'Median ex-outliers', `${outlierN} outlier${outlierN === 1 ? '' : 's'} removed`)}
        ${kpi(String(sameN), 'Same-indication comps', `${compSet.rows.length - sameN} therapeutic-area fill`)}
        ${kpi(fmtShare(compSet.rows.length ? verifiedN / compSet.rows.length : null), 'Verified with citation', `${verifiedN} of ${compSet.rows.length}`)}
      </div>

      <div class="card" style="padding: 10px 12px 6px; margin-bottom: 8px;">
        ${microLabel('Drivers of the headline — top relevance, outliers excluded')}
        ${drivers}
        ${chartSource({ ...compSet.source, n: driverRows.length })}
      </div>

      ${compSet.caveat ? `<div class="callout-amber" style="padding: 8px 12px; font-size: 9px;">${escapeHtml(compSet.caveat)}</div>` : ''}

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
