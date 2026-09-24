// Page 3: The decision — what we recommend, with whom, at what terms, by when.
// The most important page in the Brief. Reads brief.decision and brief.mpOpinion;
// never recomputes a number.

import { pageHeader, pageFooter, sectionHead, microLabel, fmtM, escapeHtml, emptyState, COLORS, BRIEF_TITLE, formatShortDate } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';

const ROLE_STYLE: Record<'lead' | 'tension' | 'hold', { bg: string; fg: string; label: string }> = {
  lead: { bg: COLORS.tealLight, fg: COLORS.teal, label: 'Lead' },
  tension: { bg: COLORS.blueLight, fg: '#1d4ed8', label: 'Tension' },
  hold: { bg: COLORS.gray100, fg: COLORS.gray500, label: 'Hold' },
};

export function renderDecisionPage(data: PDFReportData, meta: ReportMeta): string {
  const decision = data.brief?.decision;
  const opinion = data.brief?.mpOpinion;
  const head = sectionHead('The decision', 'What we recommend, with whom, at what terms, and by when.');

  if (!decision) {
    return `
      <div class="report-page">
        ${pageHeader(meta.currentPage, meta.pageCount, BRIEF_TITLE)}
        ${head}
        ${emptyState('Decision not yet built', 'The decision summary needs the valuation bridge and the buyer map. Neither was available for this run, so no recommendation is printed.')}
        ${pageFooter(meta.reportId)}
      </div>
    `;
  }

  const royalty = decision.ask.royaltyPct
    ? `${decision.ask.royaltyPct.low.toFixed(0)}–${decision.ask.royaltyPct.high.toFixed(0)}% royalty`
    : '';

  const confidenceBadge = decision.confidence === 'high' ? 'badge-teal' : decision.confidence === 'medium' ? 'badge-amber' : 'badge-rose';

  const trim = (t: string, n = 120) => (t.length > n ? `${t.slice(0, n - 1).trimEnd()}…` : t);
  const featured = decision.counterparties.filter(c => c.role !== 'hold').slice(0, 5);
  const held = decision.counterparties.filter(c => c.role === 'hold').map(c => c.name);
  const counterpartyRows = decision.counterparties.length > 0
    ? featured.map(c => {
      const s = ROLE_STYLE[c.role];
      return `
        <div style="display: flex; gap: 8px; align-items: flex-start; padding: 4px 0; border-bottom: 1px solid ${COLORS.gray100};">
          <span style="flex-shrink: 0; display: inline-block; min-width: 46px; text-align: center; padding: 2px 6px; border-radius: 3px; font-size: 7px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; background: ${s.bg}; color: ${s.fg};">${s.label}</span>
          <div style="min-width: 0;">
            <div style="font-size: 9.5px; font-weight: 700; color: ${COLORS.navy};">${escapeHtml(c.name)}</div>
            <div style="font-size: 8.5px; color: ${COLORS.gray500}; line-height: 1.35;">${escapeHtml(trim(c.why))}</div>
          </div>
        </div>`;
    }).join('') + (held.length ? `
        <div style="font-size: 8.5px; color: ${COLORS.gray500}; padding: 5px 0 0; line-height: 1.4;"><span style="font-size: 7px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: ${COLORS.gray400}; margin-right: 6px;">Hold</span>${escapeHtml(held.join(' · '))}</div>` : '')
    : `<div style="font-size: 9px; color: ${COLORS.gray400}; padding: 6px 0;">No counterparties ranked; the buyer map was not available for this run.</div>`;

  const reviewedBy = opinion
    ? `
      <div style="border: 1px solid ${COLORS.gray200}; border-left: 4px solid ${COLORS.navy}; border-radius: 0 6px 6px 0; padding: 12px 16px; background: ${COLORS.gray50};">
        ${microLabel('Reviewed by')}
        <div style="font-size: 9.5px; color: ${COLORS.gray800}; line-height: 1.6; white-space: pre-line;">${escapeHtml(opinion.text)}</div>
        <div style="margin-top: 8px; display: flex; justify-content: space-between; align-items: baseline;">
          <span style="font-size: 9px; font-weight: 700; color: ${COLORS.navy};">${escapeHtml(opinion.reviewer)}</span>
          <span style="font-size: 8px; color: ${COLORS.gray400};">${escapeHtml(formatShortDate(new Date(opinion.reviewedAt)))}</span>
        </div>
      </div>`
    : `
      <div style="border: 1px dashed ${COLORS.gray300}; border-radius: 6px; padding: 12px 16px; background: ${COLORS.gray50};">
        ${microLabel('Reviewed by')}
        <div style="font-size: 9.5px; color: ${COLORS.gray400}; font-style: italic;">Managing Partner review pending</div>
      </div>`;

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, BRIEF_TITLE)}
      ${head}

      <!-- Recommendation banner -->
      <div style="background: linear-gradient(145deg, ${COLORS.navy} 0%, #252a5e 100%); border-left: 6px solid ${COLORS.teal}; border-radius: 6px; padding: 12px 18px; color: white; margin-bottom: 10px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px;">
          <span style="font-size: 7px; font-weight: 700; letter-spacing: 0.16em; text-transform: uppercase; color: ${COLORS.tealMid};">Recommendation</span>
          <span style="font-size: 7px; color: rgba(255,255,255,0.45); letter-spacing: 0.04em;">as of ${escapeHtml(formatShortDate(new Date(decision.asOf)))}</span>
        </div>
        <div style="font-size: 18px; font-weight: 800; letter-spacing: -0.02em; line-height: 1.15; margin-bottom: 6px;">${escapeHtml(decision.recommendationLabel)}</div>
        <div style="font-size: 10px; color: rgba(255,255,255,0.8); line-height: 1.5;">${escapeHtml(decision.headline)}</div>
      </div>

      <!-- Ask / Floor / Walk-away -->
      <div style="display: grid; grid-template-columns: 1.3fr 1fr 1fr; gap: 10px; margin-bottom: 10px;">
        <div style="border: 1px solid ${COLORS.gray200}; border-top: 3px solid ${COLORS.teal}; border-radius: 6px; padding: 10px 14px;">
          ${microLabel('Ask')}
          <div style="font-size: 24px; font-weight: 800; color: ${COLORS.teal}; letter-spacing: -0.03em; line-height: 1;">${fmtM(decision.ask.totalM)}</div>
          <div style="font-size: 9px; color: ${COLORS.gray600}; margin-top: 4px;"><strong>${fmtM(decision.ask.upfrontM)}</strong> upfront${royalty ? ` &middot; ${escapeHtml(royalty)}` : ''}</div>
        </div>
        <div style="border: 1px solid ${COLORS.gray200}; border-top: 3px solid ${COLORS.amber}; border-radius: 6px; padding: 10px 14px;">
          ${microLabel('Floor')}
          <div style="font-size: 20px; font-weight: 800; color: ${COLORS.navy}; letter-spacing: -0.03em; line-height: 1;">${fmtM(decision.floor.totalM)}</div>
          <div style="font-size: 9px; color: ${COLORS.gray600}; margin-top: 4px;"><strong>${fmtM(decision.floor.upfrontM)}</strong> upfront</div>
        </div>
        <div style="border: 1px solid ${COLORS.gray200}; border-top: 3px solid ${COLORS.rose}; border-radius: 6px; padding: 10px 14px;">
          ${microLabel('Walk-away')}
          <div style="font-size: 20px; font-weight: 800; color: ${COLORS.rose}; letter-spacing: -0.03em; line-height: 1;">${fmtM(decision.walkAwayUpfrontM)}</div>
          <div style="font-size: 9px; color: ${COLORS.gray600}; margin-top: 4px;">upfront, below this we stop</div>
        </div>
      </div>

      <!-- Two columns: why + how (left), who + when (right) -->
      <div style="display: grid; grid-template-columns: 1.15fr 1fr; gap: 18px; margin-bottom: 10px;">
        <div>
          ${microLabel('Why')}
          <ul class="bullet-list" style="font-size: 9px; margin-bottom: 8px; line-height: 1.45;">
            ${decision.rationale.slice(0, 4).map(r => `<li>${escapeHtml(r)}</li>`).join('')}
          </ul>

          ${microLabel('Negotiating levers')}
          <ol style="padding-left: 16px; font-size: 9px; color: ${COLORS.gray800}; margin-bottom: 8px;">
            ${decision.levers.slice(0, 3).map(l => `<li style="margin-bottom: 2px; line-height: 1.4;">${escapeHtml(l)}</li>`).join('')}
          </ol>

          ${microLabel('What would change our view')}
          <ul class="bullet-list" style="font-size: 8.5px; color: ${COLORS.gray600}; line-height: 1.4;">
            ${decision.wouldChangeView.slice(0, 3).map(w => `<li>${escapeHtml(w)}</li>`).join('')}
          </ul>
        </div>

        <div>
          ${microLabel('Counterparties')}
          <div style="margin-bottom: 8px;">${counterpartyRows}</div>

          ${microLabel('Timeline')}
          <table style="width: 100%; border-collapse: collapse; font-size: 8.5px; margin-bottom: 8px;">
            ${decision.timeline.slice(0, 6).map(t => `
              <tr>
                <td style="padding: 3px 6px 3px 0; color: ${COLORS.teal}; font-weight: 700; white-space: nowrap; vertical-align: top; width: 62px;">${escapeHtml(t.week)}</td>
                <td style="padding: 3px 0; color: ${COLORS.gray700}; border-bottom: 1px solid ${COLORS.gray100}; line-height: 1.4;">${escapeHtml(t.step)}</td>
              </tr>`).join('')}
          </table>

          <div style="display: flex; align-items: center; gap: 8px;">
            <span class="badge ${confidenceBadge}">${escapeHtml(decision.confidence)} confidence</span>
            <span style="font-size: 8px; color: ${COLORS.gray500}; line-height: 1.3;">${escapeHtml(decision.confidenceBasis)}</span>
          </div>
        </div>
      </div>

      ${reviewedBy}

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
