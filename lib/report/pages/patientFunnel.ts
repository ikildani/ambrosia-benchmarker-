// Brief v3 — Patient funnel page.
// Where does the peak-sales number come from?

import { pageHeader, pageFooter, sectionHead, chartSource, emptyState, microLabel, fmtM, fmtShare, escapeHtml, territoryLabels, getLabel, COLORS, BRIEF_TITLE } from '../helpers';
import { renderPatientFunnel } from '../svg-charts/funnel';
import type { PDFReportData, ReportMeta } from '../types';
import type { PatientFunnel } from '@/lib/brief/types';

const ASSUMPTIONS: Record<string, string> = {
  'Population': 'Territory population',
  'Prevalent patients': 'Prevalence per million × population',
  'Diagnosed': 'Diagnosis rate in the territory',
  'Treated': 'Share of diagnosed patients on any therapy',
  'Drug-eligible': 'Label, line of therapy and contraindications',
  'Addressable': 'Eligible patients the asset can realistically reach',
};

function fmtInt(v: number): string {
  return Math.round(v).toLocaleString('en-US');
}

export function renderPatientFunnelPage(data: PDFReportData, meta: ReportMeta): string {
  const funnel: PatientFunnel | null | undefined = data.brief?.landscape?.funnel;
  const head = sectionHead('Patient funnel', 'Where does the peak-sales number come from?');

  if (!funnel || funnel.steps.length < 2) {
    return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, BRIEF_TITLE)}
      ${head}
      ${emptyState('No patient funnel for this indication', 'The epidemiology model has no prevalence, diagnosis or treatment rates for this indication and territory, so peak sales cannot be built bottom-up. The financial model uses its phase-multiplier peak-sales range instead, and the financial model page states that figure.')}
      ${pageFooter(meta.reportId)}
    </div>`;
  }

  const territory = getLabel(funnel.territory, territoryLabels);
  const source = { ...funnel.source, note: funnel.source.note ?? territory };
  const last = funnel.steps[funnel.steps.length - 1];
  const share = funnel.peakShare;
  const fromModel = funnel.peakSalesBasis === 'model';

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, BRIEF_TITLE)}
      ${head}

      <div class="card" style="padding: 12px 12px 8px;">
        <div style="display: flex; justify-content: space-between; align-items: baseline;">
          ${microLabel(`Patients, ${territory}`)}
          <div style="font-size: 8px; color: ${COLORS.gray500};">Addressable = ${fmtInt(last.value)} patients</div>
        </div>
        <div class="chart-container" style="margin: 0;">${renderPatientFunnel(funnel, 560, 200)}</div>
        ${chartSource(source)}
      </div>

      <div class="grid-3" style="margin-top: 12px; gap: 10px;">
        <div class="kpi-card" style="padding: 10px 8px; border-top-color: ${COLORS.gray400};">
          <div class="kpi-value" style="font-size: 20px; color: ${COLORS.gray500};">${fmtM(funnel.peakSalesM.low)}</div>
          <div class="kpi-label">Peak sales · low</div>
          <div class="kpi-sub">${share ? `${fmtShare(share.low)} share` : 'low scenario'}</div>
        </div>
        <div class="kpi-card" style="padding: 10px 8px;">
          <div class="kpi-value" style="font-size: 24px;">${fmtM(funnel.peakSalesM.median)}</div>
          <div class="kpi-label">Peak sales · median</div>
          <div class="kpi-sub">${share ? `${fmtShare(share.median)} share` : 'base scenario'}</div>
        </div>
        <div class="kpi-card" style="padding: 10px 8px; border-top-color: ${COLORS.gray400};">
          <div class="kpi-value" style="font-size: 20px; color: ${COLORS.gray500};">${fmtM(funnel.peakSalesM.high)}</div>
          <div class="kpi-label">Peak sales · high</div>
          <div class="kpi-sub">${share ? `${fmtShare(share.high)} share` : 'high scenario'}</div>
        </div>
      </div>

      <div class="card" style="padding: 0; overflow: hidden; margin-top: 12px;">
        <table class="data-table" style="font-size: 9px;">
          <thead>
            <tr>
              <th>Step</th>
              <th style="text-align: right;">Patients</th>
              <th style="text-align: right;">Conversion</th>
              <th>Assumption</th>
            </tr>
          </thead>
          <tbody>
            ${funnel.steps.map((s, i) => {
              const conv = i === 0 ? null : s.value / funnel.steps[i - 1].value;
              const isLast = i === funnel.steps.length - 1;
              return `
              <tr>
                <td style="font-weight: ${isLast ? 800 : 600}; color: ${isLast ? COLORS.teal : COLORS.navy}; padding: 6px 12px;">${escapeHtml(s.label)}</td>
                <td style="text-align: right; font-weight: 700; padding: 6px 12px;">${fmtInt(s.value)}</td>
                <td style="text-align: right; color: ${COLORS.gray500}; padding: 6px 12px;">${conv == null ? '—' : fmtShare(conv, conv < 0.1 ? 1 : 0)}</td>
                <td style="color: ${COLORS.gray600}; padding: 6px 12px;">${escapeHtml(ASSUMPTIONS[s.label] ?? 'Model assumption')}</td>
              </tr>`;
            }).join('')}
            <tr>
              <td style="font-weight: 600; padding: 6px 12px;">Net price per patient-year</td>
              <td style="text-align: right; font-weight: 700; padding: 6px 12px;">${funnel.pricePerYearUsd ? `$${fmtInt(funnel.pricePerYearUsd)}` : '—'}</td>
              <td style="text-align: right; color: ${COLORS.gray500}; padding: 6px 12px;">—</td>
              <td style="color: ${COLORS.gray600}; padding: 6px 12px;">Territory-adjusted net revenue per treated patient</td>
            </tr>
            ${share ? `
            <tr>
              <td style="font-weight: 600; padding: 6px 12px;">Peak share of addressable</td>
              <td style="text-align: right; font-weight: 700; padding: 6px 12px;">${fmtShare(share.median)}</td>
              <td style="text-align: right; color: ${COLORS.gray500}; padding: 6px 12px;">${fmtShare(share.low)}–${fmtShare(share.high)}</td>
              <td style="color: ${COLORS.gray600}; padding: 6px 12px;">${fromModel ? `Share of addressable patients implied by the modelled peak sales of ${fmtM(funnel.peakSalesM.median)} at the net price above` : 'Competitive density and order of entry'}</td>
            </tr>` : ''}
          </tbody>
        </table>
        ${chartSource(source)}
      </div>

      <div class="callout" style="margin-top: 10px; padding: 8px 14px;">
        <div style="font-size: 9.5px; line-height: 1.5;"><strong>How this feeds the valuation.</strong> ${fromModel ? 'The peak-sales figures above are the ones the rNPV model ran with, after its market-size ceiling and modifiers; the same median appears on the financial model page and in the scenario set. The share row shows what that peak implies against the addressable population and net price.' : 'The peak-sales figures above come from the epidemiology estimate; no rNPV result was available to reconcile them, so treat them as the top-down input rather than the modelled outcome.'}</div>
      </div>

      ${pageFooter(meta.reportId)}
    </div>`;
}
