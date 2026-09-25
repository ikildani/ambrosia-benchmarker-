// Page 14: Methodology & Disclaimer
// How the model works, data sources, factors considered, legal disclaimer

import { logoIconColor } from '../logo';
import { pageHeader, pageFooter, COLORS, formatDate, formatShortDate, escapeHtml, BRIEF_TITLE, microLabel } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';

export function renderMethodologyPage(data: PDFReportData, meta: ReportMeta): string {
  const modifierNames = data.result.modifiers.map(m => m.name);
  const cov = data.brief?.coverage ?? null;
  const asOf = cov ? formatShortDate(new Date(cov.asOf)) : formatShortDate();
  const calibrationClaim = cov
    ? `${cov.trackedDeals.toLocaleString()} tracked transactions, of which ${cov.verifiedDeals.toLocaleString()} are verified against a primary source`
    : 'the Solidus transaction database';
  const kpi = (label: string, value: string, sub: string) => `
    <div class="kpi-card" style="padding: 10px 12px;">
      ${microLabel(label)}
      <div style="font-size: 20px; font-weight: 800; color: ${COLORS.navy}; letter-spacing: -0.02em; line-height: 1;">${value}</div>
      <div style="font-size: 8px; color: ${COLORS.gray400}; margin-top: 3px;">${escapeHtml(sub)}</div>
    </div>`;
  const coverageBlock = cov ? `
      <div style="margin-bottom: 18px;">
        <div class="section-title">Coverage and accuracy</div>
        <div class="grid-4" style="margin-bottom: 8px;">
          ${kpi('Tracked deals', cov.trackedDeals.toLocaleString(), 'quality-filtered rows')}
          ${kpi('Verified with citation', cov.verifiedDeals.toLocaleString(), 'primary source on file')}
          ${kpi('This therapeutic area', cov.taDeals.toLocaleString(), `${cov.indicationDeals.toLocaleString()} same indication`)}
          ${kpi('Comps used here', cov.compsUsed.toLocaleString(), 'see appendix')}
        </div>
        ${cov.accuracy ? `
        <div class="callout" style="font-size: 9.5px;">
          <strong>${escapeHtml(cov.accuracy.metric)}:</strong> ${escapeHtml(cov.accuracy.value)} (n = ${cov.accuracy.n}). ${escapeHtml(cov.accuracy.note)}
        </div>` : `
        <div style="font-size: 9px; color: ${COLORS.gray500};">
          Accuracy is measured on verified deals only. A backtest statement is printed here when the cohort for this therapeutic area is large enough to be meaningful; it is omitted rather than estimated.
        </div>`}
        <div style="font-size: 7.5px; color: ${COLORS.gray400}; margin-top: 6px;">Source: Solidus deal database &middot; as of ${asOf}</div>
      </div>` : '';

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, BRIEF_TITLE)}

      <div class="section-title-lg">Methodology & Disclaimer</div>

      <!-- Two-column layout -->
      <div class="grid-2" style="margin-bottom: 20px;">
        <!-- Left: How the Model Works -->
        <div>
          <div class="section-title">How the Model Works</div>
          <div class="card" style="font-size: 10px; color: ${COLORS.gray700}; line-height: 1.7;">
            <p style="margin-bottom: 7px;">
              Solidus uses a multi-factor valuation model calibrated against ${calibrationClaim}, disclosed between 2017 and ${new Date().getFullYear()}.
            </p>
            <p style="margin-bottom: 7px;">
              <strong>Base Valuation:</strong> Initial deal value ranges are established using therapeutic area-specific benchmarks derived from actual transaction data, stratified by development phase.
            </p>
            <p style="margin-bottom: 7px;">
              <strong>Modifier System:</strong> The base valuation is adjusted through multiplicative modifiers reflecting asset-specific characteristics including modality, indication, competitive landscape, and data quality.
            </p>
            <p>
              <strong>Sensitivity Analysis:</strong> Each input parameter is systematically varied while holding others constant to quantify marginal impact on deal value, identifying the highest-leverage negotiation levers.
            </p>
          </div>
        </div>

        <!-- Right: About the Model -->
        <div>
          <div class="section-title">About the Model</div>
          <div class="card" style="font-size: 10px; color: ${COLORS.gray700}; line-height: 1.7;">
            <p style="margin-bottom: 7px;">
              <strong>Parameters:</strong> ${modifierNames.length + 5} input variables across asset profile, competitive dynamics, and deal structure factors.
            </p>
            <p style="margin-bottom: 7px;">
              <strong>Coverage:</strong> 12 therapeutic areas — Oncology (solid tumor + hematology), Neurology (CNS), Immunology/Autoimmune, Metabolic/Obesity, Cardiovascular, Infectious Disease, Ophthalmology, Women&rsquo;s Health, Rare Disease, Dermatology, Pulmonology, and Gastroenterology.
            </p>
            <p style="margin-bottom: 7px;">
              <strong>Data Sources:</strong> SEC EDGAR filings, FTC premerger filings, ClinicalTrials.gov, company press releases, analyst reports, and proprietary deal databases.
            </p>
            <p style="margin-bottom: 7px;">
              <strong>Strategic analysis:</strong> Narrative sections are drafted from the model outputs and the comparable set, then reviewed by the Managing Partner before delivery. The Decision page carries the signed opinion.
            </p>
            <p>
              <strong>Update Frequency:</strong> Model benchmarks updated quarterly. Real-time deal tracking via SEC EDGAR integration.
            </p>
          </div>
        </div>
      </div>

      ${coverageBlock}

      <!-- Factors Considered -->
      <div style="margin-bottom: 20px;">
        <div class="section-title">Factors Considered in This Analysis</div>
        <div class="card">
          <div style="display: flex; flex-wrap: wrap; gap: 4px;">
            ${modifierNames.map(name => `<span class="badge badge-gray">${escapeHtml(name)}</span>`).join('')}
            <span class="badge badge-gray">Phase</span>
            <span class="badge badge-gray">Territory</span>
            <span class="badge badge-gray">Competitive Position</span>
            <span class="badge badge-gray">Data Quality</span>
            <span class="badge badge-gray">Therapeutic Area</span>
          </div>
        </div>
      </div>

      <!-- Full-width Disclaimer -->
      <div class="disclaimer-box">
        <div style="font-weight: 700; margin-bottom: 6px; font-size: 10px; color: ${COLORS.gray600};">ABOUT THESE BENCHMARKS</div>
        <p style="margin-bottom: 5px;">
          This brief is produced by Solidus, calibrated against ${calibrationClaim}, sourced from SEC filings, FTC premerger filings, press releases, and regulatory databases. Benchmark ranges reflect the market distribution for comparable transactions across different market conditions and negotiation dynamics.
        </p>
        <p style="margin-bottom: 5px;">
          Individual deal outcomes depend on asset-specific factors including proprietary clinical data, IP landscape, competitive dynamics, regulatory interactions, and negotiation leverage. These benchmarks provide data-driven anchor points for deal strategy — for definitive structuring, engage qualified financial and legal advisors.
        </p>
        <p>
          Strategic analysis sections are drafted from model outputs and reviewed before delivery. This brief is confidential and intended solely for the use of the addressee.
        </p>
      </div>

      <!-- Footer -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px; padding-top: 10px; border-top: 1px solid ${COLORS.gray200};">
        <div style="display: flex; align-items: center; gap: 6px;">
          ${logoIconColor(16)}
          <span style="font-size: 9px; font-weight: 700; color: ${COLORS.gray500};">Ambrosia Ventures</span>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 8px; color: ${COLORS.gray400};">solidus.ambrosiaventures.co</div>
          <div style="font-size: 8px; color: ${COLORS.gray400};">${meta.reportId} &middot; \u00A9 ${new Date().getFullYear()} Ambrosia Ventures LLC</div>
        </div>
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
