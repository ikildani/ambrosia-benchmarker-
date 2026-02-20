// Page 9: AI Strategic Analysis
// AI-generated deal memo + negotiation playbook sections

import { pageHeader, pageFooter, COLORS, escapeHtml } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';

export function renderAIMemoPage(data: PDFReportData, meta: ReportMeta): string {
  const { memoData, playbookData } = data;

  // Fallback if no AI data available
  if (!memoData && !playbookData) {
    return `
      <div class="report-page">
        ${pageHeader(9, meta.pageCount, 'Deal Valuation Report')}
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
          <div class="section-title-lg" style="margin-bottom: 0;">AI Strategic Analysis</div>
          <span class="ai-badge">AI-GENERATED</span>
        </div>
        <div class="card" style="text-align: center; padding: 40px;">
          <div style="font-size: 12px; color: ${COLORS.gray400}; margin-bottom: 6px;">AI analysis not yet generated for this report.</div>
          <div style="font-size: 10px; color: ${COLORS.gray400};">Visit calculator.ambrosiaventures.co to generate an AI-powered negotiation playbook and deal memo.</div>
        </div>
        ${pageFooter(meta.reportId)}
      </div>
    `;
  }

  // Build memo section
  const memoSection = memoData ? `
    <!-- Executive Summary -->
    <div class="card" style="margin-bottom: 10px; border-left: 3px solid ${COLORS.teal};">
      <div style="font-size: 8px; font-weight: 700; color: ${COLORS.teal}; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 5px;">Executive Summary</div>
      <div style="font-size: 10px; color: ${COLORS.gray700}; line-height: 1.7;">${escapeHtml(memoData.executive_summary)}</div>
      <div style="margin-top: 6px;">
        <span class="badge ${memoData.confidence_level === 'high' ? 'badge-teal' : memoData.confidence_level === 'medium' ? 'badge-amber' : 'badge-rose'}">
          ${memoData.confidence_level.toUpperCase()} CONFIDENCE
        </span>
      </div>
    </div>

    <!-- Valuation Rationale + Market Context -->
    <div class="grid-2" style="margin-bottom: 10px;">
      <div class="card-sm">
        <div style="font-size: 9px; font-weight: 700; color: ${COLORS.navy}; margin-bottom: 3px;">Valuation Rationale</div>
        <div style="font-size: 9px; color: ${COLORS.gray600}; line-height: 1.6;">${escapeHtml(memoData.valuation_rationale)}</div>
      </div>
      <div class="card-sm">
        <div style="font-size: 9px; font-weight: 700; color: ${COLORS.navy}; margin-bottom: 3px;">Market Context</div>
        <div style="font-size: 9px; color: ${COLORS.gray600}; line-height: 1.6;">${escapeHtml(memoData.market_context)}</div>
      </div>
    </div>

    <!-- Risk Factors + Negotiation Priorities -->
    <div class="grid-2" style="margin-bottom: 10px;">
      <div class="card-sm">
        <div style="font-size: 9px; font-weight: 700; color: ${COLORS.rose}; margin-bottom: 4px;">Risk Factors</div>
        <ul class="bullet-list" style="font-size: 9px;">
          ${memoData.risk_factors.slice(0, 4).map(r => `<li>${escapeHtml(r)}</li>`).join('')}
        </ul>
      </div>
      <div class="card-sm">
        <div style="font-size: 9px; font-weight: 700; color: ${COLORS.teal}; margin-bottom: 4px;">Negotiation Priorities</div>
        <ul class="bullet-list" style="font-size: 9px;">
          ${memoData.negotiation_priorities.slice(0, 4).map(p => `<li>${escapeHtml(p)}</li>`).join('')}
        </ul>
      </div>
    </div>
  ` : '';

  // Build playbook section
  const playbookSection = playbookData ? (() => {
    const sections = playbookData.sections;
    const sectionEntries = [
      { key: 'openingPosition', data: sections.openingPosition },
      { key: 'structureStrategy', data: sections.structureStrategy },
      { key: 'royaltyFloor', data: sections.royaltyFloor },
      { key: 'competitiveIntelligence', data: sections.competitiveIntelligence },
      { key: 'partnerTactics', data: sections.partnerTactics },
    ];

    // Show 2-3 playbook sections depending on memo availability
    const maxSections = memoData ? 2 : 4;

    return `
    <div class="section-title" style="margin-top: 4px;">Negotiation Playbook</div>
    <div class="grid-2">
      ${sectionEntries.slice(0, maxSections).map(s => `
        <div class="card-sm" style="border-left: 3px solid ${COLORS.navy};">
          <div style="font-size: 9px; font-weight: 700; color: ${COLORS.navy}; margin-bottom: 3px;">${escapeHtml(s.data.title)}</div>
          <div style="font-size: 8px; color: ${COLORS.gray600}; line-height: 1.5; margin-bottom: 4px;">${escapeHtml(s.data.content.substring(0, 180))}${s.data.content.length > 180 ? '...' : ''}</div>
          ${s.data.highlight ? `
          <div class="callout" style="padding: 5px 8px; font-size: 8px;">
            <strong>Key:</strong> ${escapeHtml(s.data.highlight)}
          </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
    `;
  })() : '';

  return `
    <div class="report-page">
      ${pageHeader(9, meta.pageCount, 'Deal Valuation Report')}

      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
        <div class="section-title-lg" style="margin-bottom: 0;">AI Strategic Analysis</div>
        <span class="ai-badge">AI-GENERATED</span>
      </div>

      ${memoSection}
      ${playbookSection}

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
