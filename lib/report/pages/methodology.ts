// Page 14: Methodology & Disclaimer
// How the model works, data sources, factors considered, legal disclaimer

import { logoIconColor } from '../logo';
import { pageHeader, pageFooter, COLORS, formatDate, escapeHtml } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';

export function renderMethodologyPage(data: PDFReportData, meta: ReportMeta): string {
  const modifierNames = data.result.modifiers.map(m => m.name);

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, 'Deal Valuation Report')}

      <div class="section-title-lg">Methodology & Disclaimer</div>

      <!-- Two-column layout -->
      <div class="grid-2" style="margin-bottom: 20px;">
        <!-- Left: How the Model Works -->
        <div>
          <div class="section-title">How the Model Works</div>
          <div class="card" style="font-size: 10px; color: ${COLORS.gray700}; line-height: 1.7;">
            <p style="margin-bottom: 7px;">
              The Ambrosia Deal Benchmarker uses a proprietary multi-factor valuation model calibrated against 3,400+ publicly disclosed pharmaceutical licensing transactions from 2017\u20132026.
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
              <strong>Data Sources:</strong> SEC EDGAR filings, ClinicalTrials.gov, company press releases, analyst reports, and proprietary deal databases.
            </p>
            <p style="margin-bottom: 7px;">
              <strong>AI Analysis:</strong> Strategic narrative and negotiation playbook powered by Claude (Anthropic), providing contextual intelligence beyond quantitative benchmarks.
            </p>
            <p>
              <strong>Update Frequency:</strong> Model benchmarks updated quarterly. Real-time deal tracking via SEC EDGAR integration.
            </p>
          </div>
        </div>
      </div>

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
          This report is produced by the Ambrosia Deal Benchmarker, calibrated against 3,000+ verified biopharma transactions from SEC regulatory filings, press releases, and regulatory databases. Benchmark ranges reflect the market distribution for comparable transactions across different market conditions and negotiation dynamics.
        </p>
        <p style="margin-bottom: 5px;">
          Individual deal outcomes depend on asset-specific factors including proprietary clinical data, IP landscape, competitive dynamics, regulatory interactions, and negotiation leverage. These benchmarks provide data-driven anchor points for deal strategy — for definitive structuring, engage qualified financial and legal advisors.
        </p>
        <p>
          Strategic analysis sections are algorithmically generated. This report is confidential and intended solely for the use of the addressee.
        </p>
      </div>

      <!-- Footer -->
      <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 16px; padding-top: 10px; border-top: 1px solid ${COLORS.gray200};">
        <div style="display: flex; align-items: center; gap: 6px;">
          ${logoIconColor(16)}
          <span style="font-size: 9px; font-weight: 700; color: ${COLORS.gray500};">Ambrosia Ventures</span>
        </div>
        <div style="text-align: right;">
          <div style="font-size: 8px; color: ${COLORS.gray400};">calculator.ambrosiaventures.co</div>
          <div style="font-size: 8px; color: ${COLORS.gray400};">${meta.reportId} &middot; \u00A9 ${new Date().getFullYear()} Ambrosia Ventures LLC</div>
        </div>
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
