// Page: M&A Acquisition Benchmarks
// Hardcoded institutional reference data for acquisition deal structures:
// KPI cards (total acquisition value, upfront, earnouts, CVR),
// milestone earnout schedule table, CVR structure cards, and M&A vs Licensing callout.

import { pageHeader, pageFooter, COLORS } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';

// ---------------------------------------------------------------------------
// KPI box helper (matches earnoutPage / cmcRiskPage pattern)
// ---------------------------------------------------------------------------

function kpiBox(
  label: string,
  value: string,
  accentColor: string,
  subtitle?: string,
): string {
  return `
    <div style="flex: 1; border: 1px solid ${COLORS.gray200}; border-top: 3px solid ${accentColor}; border-radius: 6px; padding: 12px 14px; background: white;">
      <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 6px;">${label}</div>
      <div style="font-size: 22px; font-weight: 800; color: ${COLORS.navy}; letter-spacing: -0.03em; line-height: 1;">${value}</div>
      ${subtitle ? `<div style="font-size: 8px; font-weight: 500; color: ${COLORS.gray400}; margin-top: 4px;">${subtitle}</div>` : ''}
    </div>
  `;
}

// ---------------------------------------------------------------------------
// Milestone earnout schedule data
// ---------------------------------------------------------------------------

interface MilestoneRow {
  milestone: string;
  range: string;
  pos: string;
  expectedValue: string;
}

const milestoneSchedule: MilestoneRow[] = [
  { milestone: 'IND Filing', range: '$15-30M', pos: '85%', expectedValue: '$13-26M' },
  { milestone: 'Phase 1 Start', range: '$20-40M', pos: '80%', expectedValue: '$16-32M' },
  { milestone: 'Phase 1 Data', range: '$25-50M', pos: '55%', expectedValue: '$14-28M' },
  { milestone: 'Phase 2 Start', range: '$15-30M', pos: '38%', expectedValue: '$6-11M' },
  { milestone: 'Phase 2 PoC', range: '$30-60M', pos: '23%', expectedValue: '$7-14M' },
  { milestone: 'Phase 3 Start', range: '$20-40M', pos: '15%', expectedValue: '$3-6M' },
  { milestone: 'NDA Filing', range: '$15-30M', pos: '5%', expectedValue: '$1-2M' },
  { milestone: 'FDA Approval', range: '$25-50M', pos: '3.5%', expectedValue: '$1-2M' },
];

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function renderMAAcquisitionPage(data: PDFReportData, meta: ReportMeta): string {
  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, 'Deal Valuation Report')}

      <div class="section-title-lg">M&amp;A Acquisition Benchmarks</div>

      <!-- KPI Cards -->
      <div class="section-title">Acquisition Deal Structure Overview</div>
      <div style="display: flex; gap: 10px; margin-bottom: 14px;">
        ${kpiBox('Total Acquisition Value', '$350-600M', COLORS.navy, 'Typical preclinical-to-Phase 2 range')}
        ${kpiBox('Upfront Cash', '$80-180M', COLORS.teal, '20-30% of total deal value')}
        ${kpiBox('Development Earnouts', '$150-280M', COLORS.cyan, 'Milestone-triggered payments')}
        ${kpiBox('CVR Face Value', '$100-200M', COLORS.purple, 'Contingent value rights')}
      </div>

      <!-- Milestone Earnout Schedule Table -->
      <div class="section-title">M&amp;A Milestone Earnout Schedule</div>
      <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 14px; border-top: 3px solid ${COLORS.navy};">
        <table class="data-table">
          <thead>
            <tr>
              <th>Milestone</th>
              <th style="text-align: right;">Payment Range</th>
              <th style="text-align: right;">Probability of Success</th>
              <th style="text-align: right;">Expected Value</th>
            </tr>
          </thead>
          <tbody>
            ${milestoneSchedule.map((row, i) => {
              const posNum = parseFloat(row.pos);
              const posColor = posNum >= 50 ? COLORS.green : posNum >= 15 ? COLORS.amber : COLORS.rose;
              return `
                <tr>
                  <td style="font-weight: 600; color: ${COLORS.navy};">${row.milestone}</td>
                  <td style="text-align: right; font-weight: 700; color: ${COLORS.navy};">${row.range}</td>
                  <td style="text-align: right; font-weight: 700; color: ${posColor};">${row.pos}</td>
                  <td style="text-align: right; font-weight: 700; color: ${COLORS.teal};">${row.expectedValue}</td>
                </tr>
              `;
            }).join('')}
            <tr style="background: ${COLORS.gray50}; border-top: 2px solid ${COLORS.navy};">
              <td style="font-weight: 700;">Total</td>
              <td style="text-align: right; font-weight: 700; color: ${COLORS.navy};">$165-330M nominal</td>
              <td style="text-align: right;"></td>
              <td style="text-align: right; font-weight: 700; color: ${COLORS.teal};">$64-120M expected</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- CVR Structure -->
      <div class="section-title">Contingent Value Right (CVR) Structure</div>
      <div style="display: flex; gap: 10px; margin-bottom: 14px;">
        ${kpiBox('Approval CVR', '$50-100M', COLORS.teal, 'Binary FDA approval trigger')}
        ${kpiBox('Revenue CVR ($500M)', '$15-30M', COLORS.cyan, 'First commercial threshold')}
        ${kpiBox('Revenue CVR ($1B)', '$20-40M', COLORS.blue, 'Blockbuster threshold')}
        ${kpiBox('Revenue CVR ($2B)', '$15-30M', COLORS.purple, 'Mega-blockbuster threshold')}
      </div>

      <!-- M&A vs Licensing Insight -->
      <div class="callout" style="margin-bottom: 10px;">
        <strong>M&amp;A vs. Licensing Premium:</strong> Full acquisitions command a 1.3-1.6x premium over equivalent licensing deals, reflecting control value and eliminated optionality for the seller. Precedent: AbbVie/Aliada Therapeutics ($1.4B, Dec 2024) demonstrated the upper bound for preclinical neuroscience assets with differentiated BBB-crossing platform technology. Buyers justify the premium through pipeline consolidation, manufacturing control, and elimination of future renegotiation risk at each development milestone.
      </div>

      <!-- Methodology -->
      <div style="margin-top: 10px; font-size: 8px; color: ${COLORS.gray400}; line-height: 1.6;">
        <strong>Methodology:</strong> Acquisition benchmarks derived from DealForma M&amp;A database (2020-2026, n=450+ transactions). Upfront percentages calibrated to preclinical-through-Phase 2 stage deals. Milestone PoS rates from BIO/QLS phase transition probability tables (2024 update). CVR structures benchmarked against SEC-filed CVR agreements with publicly disclosed terms.
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
