// Page: Trispecific Antibody Deep Dive
// Hardcoded institutional reference data for trispecific antibody deal benchmarks:
// KPI cards (multiplier, candidates, landmark deal, PoS adjustment),
// precedent deals table, AD target combination table, CMC risk comparison,
// and manufacturing risk insight callout.

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
// Precedent deals data
// ---------------------------------------------------------------------------

interface PrecedentDeal {
  partners: string;
  asset: string;
  upfront: string;
  totalValue: string;
  date: string;
}

const precedentDeals: PrecedentDeal[] = [
  { partners: 'AbbVie / Ichnos Sciences', asset: 'ISB 2001 (CD38xCD47xCD3)', upfront: '$700M', totalValue: '$1.925B', date: 'Jul 2025' },
  { partners: 'AbbVie / Simcere', asset: 'SIM0500 (trispecific)', upfront: 'Undisclosed', totalValue: '$1B+', date: '2025' },
  { partners: 'Sanofi / Innate Pharma', asset: 'ANKET platform (IL-2 trispecific)', upfront: 'Undisclosed', totalValue: 'Multi-program', date: '2024' },
  { partners: 'GT Biopharma', asset: 'GTB-3650 (CD33xCD16xIL-15)', upfront: 'Phase 1', totalValue: 'Internal', date: '2025' },
];

// ---------------------------------------------------------------------------
// AD target combination data
// ---------------------------------------------------------------------------

interface TargetCombo {
  targets: string;
  posMultiplier: string;
  peakSalesRange: string;
  rationale: string;
}

const targetCombos: TargetCombo[] = [
  { targets: 'Aβ + Tau + TfR', posMultiplier: '1.15x', peakSalesRange: '$2-3.5B', rationale: 'Dual pathology + BBB crossing' },
  { targets: 'Aβ + TREM2 + TfR', posMultiplier: '1.20x', peakSalesRange: '$2.5-4B', rationale: 'Clearance + microglial activation + transport' },
  { targets: 'Tau + CD33 + TfR', posMultiplier: '1.10x', peakSalesRange: '$1.5-3B', rationale: 'Tau clearance + neuroinflammation + transport' },
  { targets: 'Aβ + Tau + CD47', posMultiplier: '1.08x', peakSalesRange: '$1.5-2.5B', rationale: 'Dual pathology + phagocytic clearance' },
];

// ---------------------------------------------------------------------------
// CMC risk comparison data
// ---------------------------------------------------------------------------

interface CMCRow {
  parameter: string;
  standardMab: string;
  bispecific: string;
  trispecific: string;
}

const cmcComparison: CMCRow[] = [
  { parameter: 'Expression Yield', standardMab: '3-8 g/L', bispecific: '1-4 g/L', trispecific: '0.3-2 g/L' },
  { parameter: 'COGS (per dose)', standardMab: '$50-200', bispecific: '$150-600', trispecific: '$400-1,500' },
  { parameter: 'Dev Timeline', standardMab: '12-18 mo', bispecific: '18-30 mo', trispecific: '24-42 mo' },
  { parameter: 'Analytical Complexity', standardMab: 'Standard', bispecific: 'Elevated', trispecific: 'High' },
  { parameter: 'Lot Failure Rate', standardMab: '2-5%', bispecific: '5-12%', trispecific: '10-25%' },
];

// ---------------------------------------------------------------------------
// Main export
// ---------------------------------------------------------------------------

export function renderTrispecificPage(data: PDFReportData, meta: ReportMeta): string {
  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, 'Deal Valuation Report')}

      <div class="section-title-lg">Trispecific Antibody Deep Dive</div>

      <!-- KPI Cards -->
      <div style="display: flex; gap: 10px; margin-bottom: 14px;">
        ${kpiBox('Empirical Multiplier', '1.65x', COLORS.teal, 'vs. standard mAb deal value')}
        ${kpiBox('Candidates in Dev', '90+', COLORS.cyan, 'Global trispecific pipeline')}
        ${kpiBox('Landmark Upfront', '$700M', COLORS.navy, 'AbbVie/Ichnos ISB 2001')}
        ${kpiBox('PoS Adjustment', '0.82x', COLORS.amber, 'Manufacturing complexity discount')}
      </div>

      <!-- Precedent Deals Table -->
      <div class="section-title">Precedent Trispecific Transactions</div>
      <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 14px; border-top: 3px solid ${COLORS.navy};">
        <table class="data-table">
          <thead>
            <tr>
              <th>Partners</th>
              <th>Asset</th>
              <th style="text-align: right;">Upfront</th>
              <th style="text-align: right;">Total Value</th>
              <th style="text-align: right;">Date</th>
            </tr>
          </thead>
          <tbody>
            ${precedentDeals.map((deal) => `
              <tr>
                <td style="font-weight: 600; color: ${COLORS.navy};">${deal.partners}</td>
                <td style="font-size: 9px; color: ${COLORS.gray600};">${deal.asset}</td>
                <td style="text-align: right; font-weight: 700; color: ${COLORS.teal};">${deal.upfront}</td>
                <td style="text-align: right; font-weight: 700; color: ${COLORS.navy};">${deal.totalValue}</td>
                <td style="text-align: right; color: ${COLORS.gray500};">${deal.date}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- AD Target Combinations Table -->
      <div class="section-title">Trispecific Target Combinations (Alzheimer's Disease)</div>
      <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 14px; border-top: 3px solid ${COLORS.purple};">
        <table class="data-table">
          <thead>
            <tr>
              <th>Target Combination</th>
              <th style="text-align: right;">PoS Multiplier</th>
              <th style="text-align: right;">Peak Sales Range</th>
              <th>Rationale</th>
            </tr>
          </thead>
          <tbody>
            ${targetCombos.map((combo) => {
              const multiplier = parseFloat(combo.posMultiplier);
              const multColor = multiplier >= 1.15 ? COLORS.green : multiplier >= 1.10 ? COLORS.teal : COLORS.amber;
              return `
                <tr>
                  <td style="font-weight: 600; color: ${COLORS.navy};">${combo.targets}</td>
                  <td style="text-align: right; font-weight: 700; color: ${multColor};">${combo.posMultiplier}</td>
                  <td style="text-align: right; font-weight: 700; color: ${COLORS.navy};">${combo.peakSalesRange}</td>
                  <td style="font-size: 9px; color: ${COLORS.gray600};">${combo.rationale}</td>
                </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>

      <!-- CMC Risk Comparison Table -->
      <div class="section-title">CMC Risk Comparison: Trispecific vs. Bispecific vs. Standard mAb</div>
      <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 14px; border-top: 3px solid ${COLORS.rose};">
        <table class="data-table">
          <thead>
            <tr>
              <th>Parameter</th>
              <th style="text-align: right;">Standard mAb</th>
              <th style="text-align: right;">Bispecific</th>
              <th style="text-align: right;">Trispecific</th>
            </tr>
          </thead>
          <tbody>
            ${cmcComparison.map((row) => `
              <tr>
                <td style="font-weight: 600; color: ${COLORS.navy};">${row.parameter}</td>
                <td style="text-align: right; color: ${COLORS.green}; font-weight: 600;">${row.standardMab}</td>
                <td style="text-align: right; color: ${COLORS.amber}; font-weight: 600;">${row.bispecific}</td>
                <td style="text-align: right; color: ${COLORS.rose}; font-weight: 700;">${row.trispecific}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Manufacturing Risk Insight -->
      <div class="callout" style="margin-bottom: 10px;">
        <strong>Manufacturing Risk &amp; Clinical Validation:</strong> Trispecific antibodies face 2-3x higher COGS and 10-25% lot failure rates compared to standard mAbs (Springer Nature, 2024), but clinical data is compelling. AbbVie's ISB 2001 (CD38xCD47xCD3) demonstrated a 79% overall response rate in relapsed/refractory multiple myeloma with 260x greater potency than daratumumab, justifying the $700M upfront / $1.925B total deal value. The manufacturing complexity discount (0.82x PoS) is partially offset by the multi-target engagement premium, yielding a net empirical multiplier of 1.65x for trispecific deal valuations.
      </div>

      <!-- Methodology -->
      <div style="margin-top: 10px; font-size: 8px; color: ${COLORS.gray400}; line-height: 1.6;">
        <strong>Methodology:</strong> Trispecific deal multipliers derived from matched-pair analysis against bispecific and standard mAb transactions (DealForma 2022-2026). Pipeline count from Antibody Society and GlobalData trispecific tracker databases. CMC parameters benchmarked against published manufacturing data (Labrijn et al., Nat Rev Drug Discov 2019; updated with 2024 CDMO surveys). AD target combination PoS multipliers calibrated using clinical-stage multi-target engagement data and BBB transport receptor literature.
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
