// Page after The Decision: this call is scored. What we committed to, how it
// will be scored, what we measure, and when the client hears from us.
// Reads brief.bridge / decision / buyerMap / landscape through buildScoredCall;
// never recomputes a number.

import { pageHeader, pageFooter, sectionHead, microLabel, fmtM, escapeHtml, emptyState, COLORS, BRIEF_TITLE } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';
import { buildScoredCall } from '@/lib/brief/scored-call';

function fmtDate(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function renderScoredCallPage(data: PDFReportData, meta: ReportMeta): string {
  const brief = data.brief;
  const head = sectionHead('This call is scored', 'What we committed to, how it is scored, and when you hear from us.');
  // A reviewed brief is delivered the moment it is rendered, so follow-up dates count from now.
  const call = brief ? buildScoredCall(brief, { deliveredAt: new Date().toISOString() }) : null;

  if (!call) {
    return `
      <div class="report-page">
        ${pageHeader(meta.currentPage, meta.pageCount, BRIEF_TITLE)}
        ${head}
        ${emptyState('No call to score', 'The valuation bridge was not available for this run, so no ask or floor was registered in the outcome ledger.')}
        ${pageFooter(meta.reportId)}
      </div>
    `;
  }

  const cell = (label: string, value: string, sub?: string) => `
    <div style="flex: 1; min-width: 120px; padding: 10px 12px; border: 1px solid ${COLORS.gray200}; border-radius: 8px;">
      ${microLabel(label)}
      <div style="font-size: 18px; font-weight: 800; color: ${COLORS.navy}; margin-top: 2px;">${value}</div>
      ${sub ? `<div style="font-size: 9px; color: ${COLORS.gray500}; margin-top: 2px;">${escapeHtml(sub)}</div>` : ''}
    </div>`;

  const buyers = [
    ...call.buyers.lead.map(n => `<span style="display:inline-block; margin: 2px 4px 2px 0; padding: 2px 8px; border-radius: 999px; background: ${COLORS.tealLight}; color: ${COLORS.teal}; font-size: 9px; font-weight: 700;">${escapeHtml(n)} · lead</span>`),
    ...call.buyers.tension.map(n => `<span style="display:inline-block; margin: 2px 4px 2px 0; padding: 2px 8px; border-radius: 999px; background: ${COLORS.blueLight}; color: #1d4ed8; font-size: 9px; font-weight: 700;">${escapeHtml(n)} · tension</span>`),
  ].join('');

  const list = (items: string[]) => `<ul style="margin: 6px 0 0 14px; padding: 0; font-size: 9.5px; line-height: 1.5; color: ${COLORS.gray600};">${items.map(i => `<li style="margin-bottom: 3px;">${escapeHtml(i)}</li>`).join('')}</ul>`;

  const followups = call.followups
    .map(f => `<span style="display:inline-block; margin-right: 12px; font-size: 9.5px; color: ${COLORS.gray600};"><strong style="color: ${COLORS.navy};">Day ${f.day}</strong> · ${fmtDate(f.date)}</span>`)
    .join('');

  const accuracy = call.accuracy
    ? `<div class="callout" style="margin-top: 10px; padding: 8px 14px;"><div style="font-size: 9.5px; line-height: 1.5;"><strong>Track record in this area.</strong> ${escapeHtml(call.accuracy.metric)}: ${escapeHtml(call.accuracy.value)} on ${call.accuracy.n} resolved briefs. ${escapeHtml(call.accuracy.note)}</div></div>`
    : `<div class="callout" style="margin-top: 10px; padding: 8px 14px;"><div style="font-size: 9.5px; line-height: 1.5;"><strong>Track record in this area.</strong> Fewer than ten briefs in this therapeutic area have resolved, so no accuracy figure is printed; resolved accuracy by area is published on the methodology page as it accumulates.</div></div>`;

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, BRIEF_TITLE)}
      ${head}

      <p style="font-size: 10px; line-height: 1.55; color: ${COLORS.gray600}; margin: 0 0 10px;">
        The recommendation on the previous page is registered in the Solidus outcome ledger the day this brief is delivered.
        It is scored against what actually happens, the score feeds the next brief in this area, and you see the result in your data room.
        ${call.recommendationLabel ? `Registered call: <strong style="color: ${COLORS.navy};">${escapeHtml(call.recommendationLabel)}</strong>.` : ''}
      </p>

      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        ${cell('Ask', `${fmtM(call.ask.upfrontM)} up / ${fmtM(call.ask.totalM)} total`)}
        ${cell('Floor', `${fmtM(call.floor.upfrontM)} up / ${fmtM(call.floor.totalM)} total`)}
        ${cell('Walk-away', call.walkAwayUpfrontM != null ? `${fmtM(call.walkAwayUpfrontM)} upfront` : '—')}
        ${cell('Window', `${fmtDate(call.window.start)} – ${fmtDate(call.window.end)}`, call.expiresOn ? `Expires ${fmtDate(call.expiresOn)} if unresolved` : undefined)}
      </div>

      <div style="margin-top: 10px;">
        ${microLabel('Counterparties on the call')}
        <div style="margin-top: 4px;">${buyers || `<span style="font-size: 9.5px; color: ${COLORS.gray500};">No counterparties registered.</span>`}</div>
      </div>

      <div style="display: flex; gap: 14px; margin-top: 12px;">
        <div style="flex: 1;">
          ${microLabel('How it is scored')}
          ${list(call.scoredBy)}
        </div>
        <div style="flex: 1;">
          ${microLabel('What we measure')}
          ${list(call.measures)}
        </div>
      </div>

      <div style="margin-top: 12px;">
        ${microLabel('When you hear from us')}
        <div style="margin-top: 4px;">${followups}</div>
        <p style="font-size: 9px; color: ${COLORS.gray500}; margin: 4px 0 0;">Each note carries a link to a two-minute form. Nothing you report is published in a way that identifies you or the asset.</p>
      </div>

      ${accuracy}

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
