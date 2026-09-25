// Page: Path to next inflection — partner now, or fund to the next data point?

import { renderDecisionTree } from '../svg-charts/decisionTree';
import { recommendedOptionKey } from '@/lib/brief/inflection';
import { pageHeader, pageFooter, sectionHead, chartSource, emptyState, fmtM, fmtShare, microLabel, escapeHtml, COLORS, BRIEF_TITLE } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';

export function renderInflectionPathPage(data: PDFReportData, meta: ReportMeta): string {
  const path = data.brief?.inflection;
  const head = sectionHead('Path to next inflection', 'Partner now, or fund to the next data point and partner then?');

  if (!path || path.options.length === 0) {
    return `
      <div class="report-page">
        ${pageHeader(meta.currentPage, meta.pageCount, BRIEF_TITLE)}
        ${head}
        ${emptyState('Inflection path not available', 'The path needs the phase-transition table from the financial model and a development phase before approval. One of those was missing for this profile.')}
        ${pageFooter(meta.reportId)}
      </div>
    `;
  }

  const recKey = recommendedOptionKey(path.options);
  const rows = path.options.map(o => {
    const rec = o.key === recKey;
    return `
      <tr style="${rec ? `background: ${COLORS.tealLight};` : ''}">
        <td style="font-weight: 700; color: ${COLORS.navy};">${escapeHtml(o.label)}</td>
        <td style="text-align: right;">${o.months}</td>
        <td style="text-align: right;">${fmtM(o.costM)}</td>
        <td style="text-align: right;">${fmtShare(o.pReach)}</td>
        <td style="text-align: right;">${fmtM(o.upfrontIfReached.median)}</td>
        <td style="text-align: right; font-weight: 700; color: ${rec ? COLORS.teal : COLORS.navy};">${fmtM(o.expectedUpfrontM)}</td>
        <td style="text-align: right;">${o.dilution == null ? '—' : fmtShare(o.dilution)}</td>
        <td style="color: ${COLORS.gray600}; font-size: 8px;">${escapeHtml(o.verdict)}</td>
      </tr>`;
  }).join('');

  const f = path.financing;
  const financingCard = f ? `
    <div class="card-sm" style="border-left: 3px solid ${COLORS.navy};">
      ${microLabel('Financing alternative')}
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px 14px; font-size: 9px;">
        <div><span style="color: ${COLORS.gray500};">Pre-money</span><div style="font-weight: 700; color: ${COLORS.navy};">${fmtM(f.preMoneyM)}</div><div style="font-size: 7.5px; color: ${COLORS.gray400};">${escapeHtml(f.basis)}</div></div>
        <div><span style="color: ${COLORS.gray500};">Raise</span><div style="font-weight: 700; color: ${COLORS.navy};">${fmtM(f.raiseM)}</div><div style="font-size: 7.5px; color: ${COLORS.gray400};">${fmtShare(f.dilution)} dilution</div></div>
        <div><span style="color: ${COLORS.gray500};">Retained value if financed</span><div style="font-weight: 700; color: ${COLORS.navy};">${fmtM(f.retainedValueIfFinanceM)}</div><div style="font-size: 7.5px; color: ${COLORS.gray400};">(1 − dilution) × total if reached × P(reach)</div></div>
        <div><span style="color: ${COLORS.gray500};">Retained value if licensed now</span><div style="font-weight: 700; color: ${COLORS.teal};">${fmtM(f.retainedValueIfLicenseM)}</div><div style="font-size: 7.5px; color: ${COLORS.gray400};">upfront + 45% of milestone face value</div></div>
      </div>
    </div>` : `
    <div class="card-sm" style="border-left: 3px solid ${COLORS.gray300};">
      ${microLabel('Financing alternative')}
      <div style="font-size: 9px; color: ${COLORS.gray400};">No pre-money basis available; the dilution comparison needs a risk-adjusted NPV or a headline total.</div>
    </div>`;

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, BRIEF_TITLE)}
      ${head}

      <div class="card" style="padding: 10px 12px 6px; margin-bottom: 10px;">
        <div class="chart-container" style="margin: 0;">${renderDecisionTree(path, 560, 230)}</div>
        ${chartSource({ source: 'Financial engine phase transitions and Solidus phase step-up calibration', n: path.options.length, asOf: path.asOf, note: 'expected upfront = P(reach) × upfront if reached − development cost' })}
      </div>

      <table class="data-table" style="font-size: 8.5px; margin-bottom: 10px;">
        <thead>
          <tr>
            <th>Option</th><th style="text-align: right;">Months</th><th style="text-align: right;">Cost</th><th style="text-align: right;">P(reach)</th>
            <th style="text-align: right;">Upfront if reached</th><th style="text-align: right;">Expected upfront today</th><th style="text-align: right;">Dilution</th><th>Verdict</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
        ${financingCard}
        <div class="callout">
          <div style="font-size: 7px; font-weight: 700; color: ${COLORS.teal}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 4px;">Recommendation</div>
          <div style="font-size: 9.5px; line-height: 1.55;">${escapeHtml(path.recommendation)}</div>
        </div>
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
