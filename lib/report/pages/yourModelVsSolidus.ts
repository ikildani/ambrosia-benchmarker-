// "Your model vs Solidus": the client's assumptions against the engine's,
// with the source of every gap. Reads brief.clientComparison; never
// recomputes a number. Prints an empty state when no client model was
// supplied so the client sees what the page would hold.

import { pageHeader, pageFooter, sectionHead, microLabel, escapeHtml, emptyState, COLORS, BRIEF_TITLE, fmtM } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';

function fmtVal(v: number | null, unit: '$M' | '%' | 'year'): string {
  if (v == null || !Number.isFinite(v)) return '—';
  if (unit === '$M') return fmtM(v);
  if (unit === '%') return `${Math.round(v * 10) / 10}%`;
  return String(Math.round(v));
}

function fmtDelta(r: { delta: number | null; deltaPct: number | null; unit: '$M' | '%' | 'year' }): string {
  if (r.deltaPct != null) { const s = Math.round(r.deltaPct * 100); return `${s >= 0 ? '+' : ''}${s}%`; }
  if (r.delta != null) { const s = Math.round(r.delta * 10) / 10; return `${s >= 0 ? '+' : ''}${s}${r.unit === '%' ? ' pts' : r.unit === 'year' ? ' yr' : ''}`; }
  return '—';
}

export function renderYourModelVsSolidusPage(data: PDFReportData, meta: ReportMeta): string {
  const cmp = data.brief?.clientComparison ?? null;
  const head = sectionHead('Your model vs Solidus', 'Where your assumptions and ours agree, where they differ, and what drives the gap.');

  if (!cmp) {
    return `
      <div class="report-page">
        ${pageHeader(meta.currentPage, meta.pageCount, BRIEF_TITLE)}
        ${head}
        ${emptyState('No client model supplied', 'This page sets your own peak-sales, probability, timing, cost and expected-terms view against ours, line by line, and prints any offer already on the table against the floor and the ask. Send those figures by reply or through your data room and the page is added to the brief.')}
        ${pageFooter(meta.reportId)}
      </div>
    `;
  }

  const rows = cmp.rows.map(r => {
    const material = (r.deltaPct != null && Math.abs(r.deltaPct) >= 0.15) || (r.key === 'pos' && r.delta != null && Math.abs(r.delta) >= 3) || (r.key === 'launch_year' && r.delta != null && Math.abs(r.delta) > 1);
    const color = material ? '#b45309' : COLORS.teal;
    return `
      <tr>
        <td style="padding: 5px 8px; font-weight: 600; white-space: nowrap;">${escapeHtml(r.label)}</td>
        <td style="padding: 5px 8px; text-align: right; font-weight: 700;">${fmtVal(r.client, r.unit)}</td>
        <td style="padding: 5px 8px; text-align: right; font-weight: 700; color: ${COLORS.navy};">${fmtVal(r.solidus, r.unit)}</td>
        <td style="padding: 5px 8px; text-align: right; font-weight: 700; color: ${color};">${fmtDelta(r)}</td>
        <td style="padding: 5px 8px; color: ${COLORS.gray600}; line-height: 1.4;">${escapeHtml(r.read)}<div style="font-size: 7.5px; color: ${COLORS.gray400}; margin-top: 2px;">Solidus basis: ${escapeHtml(r.basis)}</div></td>
      </tr>`;
  }).join('');

  const offer = cmp.priorOffer;
  const pct = (x: number | null) => (x == null ? '—' : `${Math.round(x * 100) >= 0 ? '+' : ''}${Math.round(x * 100)}%`);
  const offerBlock = offer ? `
    <div class="callout" style="margin-top: 10px; padding: 8px 14px;">
      <div style="font-size: 9.5px; line-height: 1.5;">
        <strong>Offer on the table: ${escapeHtml(offer.offer.party)}</strong>${offer.offer.date ? ` (${escapeHtml(offer.offer.date)})` : ''}${offer.offer.structure ? `, ${escapeHtml(offer.offer.structure)}` : ''}, ${escapeHtml(offer.offer.status)}.
        ${fmtM(offer.offer.upfrontM ?? null)} upfront (${pct(offer.vsFloorUpfrontPct)} vs floor, ${pct(offer.vsAskUpfrontPct)} vs ask) ·
        ${fmtM(offer.offer.totalM ?? null)} total (${pct(offer.vsFloorTotalPct)} vs floor, ${pct(offer.vsAskTotalPct)} vs ask).
        ${offer.offer.notes ? escapeHtml(offer.offer.notes) : ''}
      </div>
    </div>` : '';

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, BRIEF_TITLE)}
      ${head}
      <p style="font-size: 10px; line-height: 1.55; color: ${COLORS.gray600}; margin: 0 0 10px;">${escapeHtml(cmp.summary)}</p>
      ${cmp.rows.length ? `
      <table style="width: 100%; border-collapse: collapse; font-size: 9px;">
        <thead>
          <tr style="background: ${COLORS.gray100}; color: ${COLORS.gray600}; font-size: 8px; text-transform: uppercase; letter-spacing: 0.04em;">
            <th style="padding: 5px 8px; text-align: left;">Assumption</th>
            <th style="padding: 5px 8px; text-align: right;">Yours</th>
            <th style="padding: 5px 8px; text-align: right;">Solidus</th>
            <th style="padding: 5px 8px; text-align: right;">Gap</th>
            <th style="padding: 5px 8px; text-align: left;">What drives it and how a buyer reads it</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>` : ''}
      ${offerBlock}
      ${cmp.notes ? `<div style="margin-top: 10px;">${microLabel('Your notes on the model')}<p style="font-size: 9px; color: ${COLORS.gray600}; line-height: 1.5; margin: 3px 0 0;">${escapeHtml(cmp.notes)}</p></div>` : ''}
      <p style="font-size: 8.5px; color: ${COLORS.gray500}; margin-top: 10px;">Your figures are printed as supplied at intake and do not change the ask. Gaps of 15% or more (three points on probability, more than a year on timing) are marked.</p>
      ${pageFooter(meta.reportId)}
    </div>
  `;
}
