// Page 8: Partner Landscape
// Partner cards with match score bars, evaluation matrix

import { pageHeader, pageFooter, COLORS, escapeHtml } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';

export function renderPartnersPage(data: PDFReportData, meta: ReportMeta): string {
  const partners = data.partnerMatches;

  if (!partners || partners.length === 0) {
    return `
      <div class="report-page">
        ${pageHeader(meta.currentPage, meta.pageCount, 'Deal Valuation Report')}
        <div class="section-title-lg">Partner Landscape</div>
        <div class="card" style="text-align: center; padding: 40px;">
          <div style="font-size: 12px; color: ${COLORS.gray400}; margin-bottom: 6px;">Partner matching not available for this report.</div>
          <div style="font-size: 10px; color: ${COLORS.gray400};">Visit calculator.ambrosiaventures.co to run the full partner analysis.</div>
        </div>
        ${pageFooter(meta.reportId)}
      </div>
    `;
  }

  const topPartners = partners.slice(0, 8);

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, 'Deal Valuation Report')}

      <div class="section-title-lg">Partner Landscape</div>
      <p style="font-size: 11px; color: ${COLORS.gray500}; margin-bottom: 18px; line-height: 1.5;">
        Top ${topPartners.length} potential partners ranked by algorithmic match score based on therapeutic focus, deal activity, and strategic fit.
      </p>

      <!-- Partner Cards -->
      <div class="grid-2" style="margin-bottom: 20px;">
        ${topPartners.map((p, i) => {
          const scoreColor = p.match_score >= 80 ? COLORS.teal : p.match_score >= 60 ? COLORS.cyan : COLORS.amber;
          const isTop = i < 2;
          return `
          <div class="card" style="border-top: 3px solid ${isTop ? scoreColor : COLORS.gray200};">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 6px;">
              <div>
                <div style="font-size: 11px; font-weight: 700; color: ${COLORS.navy};">${escapeHtml(p.company_name)}</div>
                ${p.hq_country ? `<div style="font-size: 8px; color: ${COLORS.gray400};">${escapeHtml(p.hq_country)}</div>` : ''}
              </div>
              <div style="text-align: right;">
                <div style="font-size: 20px; font-weight: 800; color: ${scoreColor}; letter-spacing: -0.02em;">${p.match_score}%</div>
                <div style="font-size: 7px; color: ${COLORS.gray400}; font-weight: 700; letter-spacing: 0.1em;">MATCH</div>
              </div>
            </div>
            <!-- Score bar -->
            <div class="score-bar" style="margin-bottom: 6px;">
              <div class="score-bar-fill" style="width: ${p.match_score}%; background: ${scoreColor};"></div>
            </div>
            <!-- Match reasons -->
            <div style="display: flex; flex-wrap: wrap; gap: 3px; margin-bottom: 4px;">
              ${p.match_reasons.slice(0, 3).map(r => {
                const cls = r.strength === 'strong' ? 'badge-teal' : 'badge-gray';
                return `<span class="badge ${cls}">${escapeHtml(r.reason)}</span>`;
              }).join('')}
            </div>
            <div style="font-size: 8px; color: ${COLORS.gray500};">${p.deals_last_12mo} deals in last 12 months</div>
          </div>
          `;
        }).join('')}
      </div>

      <!-- Evaluation Matrix -->
      <div class="section-title">Partner Evaluation Matrix</div>
      <div class="card" style="padding: 0; overflow: hidden; page-break-inside: avoid;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Partner</th>
              <th style="text-align: center;">Match Score</th>
              <th style="text-align: center;">Intent Score</th>
              <th style="text-align: center;">Deal Activity</th>
              <th style="text-align: center;">HQ</th>
              <th style="text-align: center;">Top Signal</th>
            </tr>
          </thead>
          <tbody>
            ${topPartners.slice(0, 6).map(p => {
              const cellBg = p.match_score >= 80 ? COLORS.tealLight : p.match_score >= 60 ? '#e0f2fe' : COLORS.amberLight;
              const intentScore = (p as any).pharma_intent?.intentScore;
              const intentColor = intentScore >= 70 ? COLORS.teal : intentScore >= 40 ? COLORS.amber : COLORS.gray400;
              const intentTier = (p as any).pharma_intent?.intentTier;
              return `
              <tr>
                <td style="font-weight: 600;">${escapeHtml(p.company_name)}</td>
                <td style="text-align: center; background: ${cellBg}; font-weight: 700; color: ${COLORS.navy};">${p.match_score}%</td>
                <td style="text-align: center; font-weight: 700; color: ${intentColor};">${intentScore != null ? `${intentScore}%` : '—'}</td>
                <td style="text-align: center;">${p.deals_last_12mo}</td>
                <td style="text-align: center; font-size: 9px;">${escapeHtml(p.hq_country || 'N/A')}</td>
                <td style="text-align: center; font-size: 9px;">${p.match_reasons[0] ? escapeHtml(p.match_reasons[0].reason) : 'N/A'}</td>
              </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      ${topPartners.length > 6 ? `
      <div style="font-size: 9px; color: ${COLORS.gray400}; margin-top: 6px; text-align: center;">
        + ${topPartners.length - 6} additional partners available in the full platform analysis
      </div>
      ` : ''}

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
