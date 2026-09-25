// Brief v3 — Comparable appendix: the full cited comp table, 16 rows per page.
// 16 is the most that fits an A4 page with the footnote even when every row
// wraps to four lines (rows measure 27–48px at 8px / 1.3 line-height).

import { pageHeader, pageFooter, COLORS, escapeHtml, BRIEF_TITLE, sectionHead, chartSource, emptyState, fmtM, phaseLabelAny } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';
import type { CompRow } from '@/lib/brief/types';
import { structureLabel } from './compScatter';

export const COMP_APPENDIX_ROWS_PER_PAGE = 16;

export function countCompAppendixPages(data: PDFReportData): number {
  const n = data.brief?.compSet?.rows.length ?? 0;
  return Math.max(1, Math.ceil(n / COMP_APPENDIX_ROWS_PER_PAGE));
}

/** Short host name from a URL ("sec.gov"), or "undisclosed". */
export function sourceHost(url: string | null | undefined): string {
  if (!url) return 'undisclosed';
  try {
    const host = new URL(url.trim()).hostname.replace(/^www\./i, '');
    return host || 'undisclosed';
  } catch {
    return 'undisclosed';
  }
}

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short' });
}

function fmtRoyalty(r: CompRow): string {
  const { royaltyLowPct: lo, royaltyHighPct: hi } = r;
  if (lo == null && hi == null) return '—';
  if (lo != null && hi != null && lo !== hi) return `${lo}–${hi}%`;
  return `${lo ?? hi}%`;
}

function territoryShort(t: string | null): string {
  if (!t) return '—';
  const s = t.replace(/_/g, ' ');
  return s.length > 14 ? `${s.slice(0, 13)}…` : s;
}

function truncate(s: string | null, max: number): string {
  if (!s) return '—';
  return s.length > max ? `${s.slice(0, max - 1)}…` : s;
}

export function renderCompAppendixPages(data: PDFReportData, meta: ReportMeta): string[] {
  const compSet = data.brief?.compSet ?? null;
  const rows = compSet?.rows ?? [];
  const head = sectionHead('Comparable appendix', 'Every deal behind the comparable set, with its source, so any number in this brief can be traced.');

  if (!compSet || rows.length === 0) {
    return [`
      <div class="report-page">
        ${pageHeader(meta.currentPage, meta.pageCount, BRIEF_TITLE)}
        ${head}
        ${emptyState('No comparable deals to list', 'No deals in the same therapeutic area or indication passed the quality filter (non-synthetic, canonical, not rejected or flagged, with disclosed economics).')}
        ${pageFooter(meta.reportId)}
      </div>
    `];
  }

  const pageCount = Math.ceil(rows.length / COMP_APPENDIX_ROWS_PER_PAGE);
  const pages: string[] = [];
  const th = (label: string, align = 'left') => `<th style="padding: 5px 6px; text-align: ${align};">${label}</th>`;
  const td = (v: string, align = 'left', extra = '') => `<td style="padding: 3px 6px; text-align: ${align}; ${extra}">${v}</td>`;

  for (let p = 0; p < pageCount; p++) {
    const slice = rows.slice(p * COMP_APPENDIX_ROWS_PER_PAGE, (p + 1) * COMP_APPENDIX_ROWS_PER_PAGE);
    const isLast = p === pageCount - 1;
    const body = slice.map((r, i) => {
      const idx = p * COMP_APPENDIX_ROWS_PER_PAGE + i + 1;
      const sup = r.outlier ? '<sup style="color: #be123c; font-weight: 700;">†</sup>' : '';
      return `
        <tr${r.sameIndication ? ` style="background: ${COLORS.tealLight}66;"` : ''}>
          ${td(String(idx), 'right', `color: ${COLORS.gray400};`)}
          ${td(`${escapeHtml(truncate(r.licensor, 22))} → ${escapeHtml(truncate(r.licensee, 22))}`)}
          ${td(escapeHtml(truncate(r.asset, 20)))}
          ${td(fmtDate(r.announcedDate))}
          ${td(escapeHtml(phaseLabelAny(r.phase)))}
          ${td(escapeHtml(structureLabel(r.structure)))}
          ${td(escapeHtml(territoryShort(r.territory)))}
          ${td(fmtM(r.upfrontM), 'right')}
          ${td(`${fmtM(r.totalM)}${sup}`, 'right', `font-weight: 700; color: ${COLORS.navy};`)}
          ${td(escapeHtml(fmtRoyalty(r)), 'right')}
          ${td(r.verified ? `<span style="color: ${COLORS.teal}; font-weight: 700;">✓</span>` : `<span style="color: ${COLORS.gray400};">–</span>`, 'center')}
          ${td(escapeHtml(sourceHost(r.sourceUrl)), 'left', `color: ${COLORS.gray500};`)}
        </tr>`;
    }).join('');

    pages.push(`
      <div class="report-page">
        ${pageHeader(meta.currentPage + p, meta.pageCount, BRIEF_TITLE)}
        ${p === 0 ? head : `<div class="section-title-lg" style="margin-bottom: 12px;">Comparable appendix <span style="font-size: 11px; font-weight: 600; color: ${COLORS.gray400};">(continued, ${p + 1} of ${pageCount})</span></div>`}
        <div class="card" style="padding: 0; overflow: hidden;">
          <table class="data-table" style="font-size: 8px; line-height: 1.3;">
            <thead><tr>
              ${th('#', 'right')}${th('Licensor → Licensee')}${th('Asset')}${th('Date')}${th('Phase')}${th('Structure')}${th('Territory')}
              ${th('Upfront', 'right')}${th('Total', 'right')}${th('Royalty', 'right')}${th('Verified', 'center')}${th('Source')}
            </tr></thead>
            <tbody>${body}</tbody>
          </table>
        </div>
        ${chartSource({ ...compSet.source, note: `${compSet.source.note ?? ''}${compSet.source.note ? '; ' : ''}rows ${p * COMP_APPENDIX_ROWS_PER_PAGE + 1}–${p * COMP_APPENDIX_ROWS_PER_PAGE + slice.length} of ${rows.length}` })}
        ${isLast ? `
          <div style="font-size: 7.5px; color: ${COLORS.gray500}; margin-top: 10px; line-height: 1.5;">
            <div><b>Quality filter.</b> Rows are drawn from the Solidus deal database where the record is not synthetic, is the canonical copy of the transaction, and has not been rejected or flagged in verification. Shaded rows share the asset's indication; the rest are same-therapeutic-area fill. "Verified" means the terms were checked against a primary source (filing or press release). Source shows the host of the citation on file.</div>
            <div style="margin-top: 3px;"><b><sup>†</sup> Outlier.</b> Total deal value above the 75th percentile plus 1.5 × the interquartile range of this set. Outliers are listed for completeness but excluded from the ex-outlier medians and from the headline drivers.</div>
          </div>` : ''}
        ${pageFooter(meta.reportId)}
      </div>
    `);
  }
  return pages;
}
