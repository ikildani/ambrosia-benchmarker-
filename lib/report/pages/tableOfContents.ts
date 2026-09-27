// Page 2: Table of Contents
// Two-column compact contents so a 50-section brief fits one page.

import { pageHeader, pageFooter, COLORS, BRIEF_TITLE, escapeHtml } from '../helpers';
import type { PDFReportData, ReportMeta, TocEntry } from '../types';

const HIGHLIGHT = new Set(['The Decision', 'Valuation Bridge', 'Comparable Set', 'Buyer Map', 'Catalyst Calendar']);

function tocRow(entry: TocEntry, first: boolean): string {
  const hi = HIGHLIGHT.has(entry.title);
  return `
    <div style="display: flex; align-items: center; padding: 4px 6px; margin-bottom: 1px; border-radius: 3px; ${hi ? `background: ${COLORS.tealLight};` : ''}">
      <div style="width: 20px; height: 20px; border-radius: 3px; background: ${first ? COLORS.navy : hi ? COLORS.teal : COLORS.gray100}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; margin-right: 8px;">
        <span style="font-size: 8px; font-weight: 800; color: ${first || hi ? '#fff' : COLORS.teal};">${entry.page}</span>
      </div>
      <div style="flex: 1; min-width: 0; font-size: 9.2px; font-weight: ${hi ? 800 : 600}; color: ${COLORS.navy}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(entry.title)}</div>
      <div style="flex: 0 0 14px; border-bottom: 1px dotted ${COLORS.gray300}; margin: 0 6px;"></div>
      <div style="font-size: 9px; font-weight: 800; color: ${COLORS.teal}; flex-shrink: 0; font-variant-numeric: tabular-nums;">${entry.page}</div>
    </div>`;
}

export function renderTableOfContents(data: PDFReportData, meta: ReportMeta): string {
  const indication = data.result.labels.indication || data.inputs.indication;
  const asset = data.brief?.asset;
  const body = meta.tocEntries.filter(e => e.section !== 'appendix');
  const appendix = meta.tocEntries.filter(e => e.section === 'appendix');
  const half = Math.ceil(body.length / 2);
  const left = body.slice(0, half);
  const right = body.slice(half);
  const aHalf = Math.ceil(appendix.length / 2);

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, BRIEF_TITLE)}

      <div class="section-title-lg">Contents</div>
      <p style="font-size: 10px; color: ${COLORS.gray500}; line-height: 1.55; margin-bottom: 14px;">
        ${asset?.assetName ? `<strong style="color: ${COLORS.navy};">${escapeHtml(asset.assetName)}</strong> in ` : ''}<strong style="color: ${COLORS.navy};">${escapeHtml(indication)}</strong>.
        Start with <strong>The Decision</strong> (recommendation, counterparties, ask and floor), then the <strong>Valuation Bridge</strong> and the <strong>Comparable Set</strong> that support it.
        Everything after that is evidence: buyers, landscape, negotiation and diligence. The appendix carries the engine detail behind the same numbers and every comparable with its source.
      </p>
      <hr class="divider-thick" style="margin-bottom: 10px;">

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0 18px;">
        <div>${left.map((e, i) => tocRow(e, i === 0)).join('')}</div>
        <div>${right.map(e => tocRow(e, false)).join('')}</div>
      </div>

      ${appendix.length ? `
      <div style="margin-top: 10px; padding-top: 8px; border-top: 1px solid ${COLORS.gray200};">
        <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 4px;">Appendix · engine detail and sources</div>
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 0 18px;">
          <div>${appendix.slice(0, aHalf).map(e => tocRow(e, false)).join('')}</div>
          <div>${appendix.slice(aHalf).map(e => tocRow(e, false)).join('')}</div>
        </div>
      </div>` : ''}

      <hr class="divider-thick" style="margin-top: 10px;">

      <div class="card" style="margin-top: 14px; display: flex; justify-content: space-between; align-items: center; padding: 10px 14px;">
        <div>
          <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 2px;">Brief details</div>
          <div style="font-size: 9.5px; color: ${COLORS.gray700};">${meta.pageCount} pages &middot; Version ${meta.version} &middot; Generated ${meta.generatedAt}${data.brief?.asOf ? ` &middot; Data as of ${escapeHtml(data.brief.asOf)}` : ''}</div>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 2px;">Brief ID</div>
          <div style="font-size: 9.5px; font-weight: 600; color: ${COLORS.teal};">${meta.reportId}</div>
        </div>
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
