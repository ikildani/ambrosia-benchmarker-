import { pageHeader, pageFooter, COLORS } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';

export function renderMolecularTargetPage(data: PDFReportData, meta: ReportMeta): string {
  const tra = (data as any).financialModel?.targetRouteAnalysis;
  if (!tra || tra.targets.length === 0) return '';

  const targets: Array<{
    slug: string;
    displayName: string;
    validated: boolean;
    posModifier: number;
    peakSalesModifier: number;
    dealPremium: number;
  }> = tra.targets;
  const combo = tra.combination;
  const validatedCount = targets.filter((t: { validated: boolean }) => t.validated).length;

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, 'Deal Valuation Report')}

      <div class="section-title-lg">Molecular Target Analysis</div>

      <!-- Hero KPIs -->
      <div style="display: flex; gap: 10px; margin-bottom: 16px;">
        <div style="flex: 1; border: 1px solid ${COLORS.gray200}; border-top: 3px solid ${COLORS.teal}; border-radius: 6px; padding: 14px; background: white; text-align: center;">
          <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 6px;">Composite PoS Impact</div>
          <div style="font-size: 26px; font-weight: 800; color: ${tra.compositePoSImpact >= 1.0 ? COLORS.teal : COLORS.amber}; letter-spacing: -0.03em;">
            ${tra.compositePoSImpact >= 1.0 ? '+' : ''}${((tra.compositePoSImpact - 1) * 100).toFixed(1)}%
          </div>
          <div style="font-size: 8px; color: ${COLORS.gray400}; margin-top: 4px;">vs. modality baseline</div>
        </div>
        <div style="flex: 1; border: 1px solid ${COLORS.gray200}; border-top: 3px solid ${COLORS.navy}; border-radius: 6px; padding: 14px; background: white; text-align: center;">
          <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 6px;">Peak Sales Impact</div>
          <div style="font-size: 26px; font-weight: 800; color: ${tra.compositePeakSalesImpact >= 1.0 ? COLORS.teal : COLORS.amber}; letter-spacing: -0.03em;">
            ${tra.compositePeakSalesImpact >= 1.0 ? '+' : ''}${((tra.compositePeakSalesImpact - 1) * 100).toFixed(1)}%
          </div>
          <div style="font-size: 8px; color: ${COLORS.gray400}; margin-top: 4px;">market capture adjustment</div>
        </div>
        <div style="flex: 1; border: 1px solid ${COLORS.gray200}; border-top: 3px solid ${COLORS.blue}; border-radius: 6px; padding: 14px; background: white; text-align: center;">
          <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 6px;">Deal Premium</div>
          <div style="font-size: 26px; font-weight: 800; color: ${COLORS.blue}; letter-spacing: -0.03em;">
            +${(tra.compositeDealPremium * 100).toFixed(0)}%
          </div>
          <div style="font-size: 8px; color: ${COLORS.gray400}; margin-top: 4px;">empirical multiplier uplift</div>
        </div>
        <div style="flex: 1; border: 1px solid ${COLORS.gray200}; border-top: 3px solid ${validatedCount === targets.length ? COLORS.green : COLORS.amber}; border-radius: 6px; padding: 14px; background: white; text-align: center;">
          <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 6px;">Target Validation</div>
          <div style="font-size: 26px; font-weight: 800; color: ${COLORS.navy}; letter-spacing: -0.03em;">
            ${validatedCount}/${targets.length}
          </div>
          <div style="font-size: 8px; color: ${COLORS.gray400}; margin-top: 4px;">targets with approved drug</div>
        </div>
      </div>

      <!-- Target Breakdown Table -->
      <div class="section-title">Per-Target Impact Analysis</div>
      <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 14px; border-top: 3px solid ${COLORS.navy};">
        <table class="data-table">
          <thead>
            <tr>
              <th>Target</th>
              <th style="text-align: center;">Validation</th>
              <th style="text-align: right;">PoS Modifier</th>
              <th style="text-align: right;">Peak Sales</th>
              <th style="text-align: right;">Deal Premium</th>
            </tr>
          </thead>
          <tbody>
            ${targets.map((t: typeof targets[0]) => `
              <tr>
                <td style="font-weight: 700; color: ${COLORS.navy};">${t.displayName}</td>
                <td style="text-align: center;">
                  <span style="display: inline-block; padding: 2px 8px; border-radius: 3px; font-size: 8px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; ${t.validated ? `background: #dcfce7; color: #15803d;` : `background: #fef3c7; color: #b45309;`}">
                    ${t.validated ? 'Validated' : 'Novel'}
                  </span>
                </td>
                <td style="text-align: right; font-weight: 700; color: ${t.posModifier >= 1.0 ? COLORS.teal : COLORS.amber};">
                  ${t.posModifier >= 1.0 ? '+' : ''}${((t.posModifier - 1) * 100).toFixed(0)}%
                </td>
                <td style="text-align: right; font-weight: 700; color: ${t.peakSalesModifier >= 1.0 ? COLORS.teal : COLORS.amber};">
                  ${t.peakSalesModifier >= 1.0 ? '+' : ''}${((t.peakSalesModifier - 1) * 100).toFixed(0)}%
                </td>
                <td style="text-align: right; font-weight: 700; color: ${COLORS.blue};">
                  +${(t.dealPremium * 100).toFixed(0)}%
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      ${combo ? `
      <!-- Validated Combination Callout -->
      <div class="card-highlight" style="margin-bottom: 14px;">
        <div style="display: flex; align-items: center; gap: 6px; margin-bottom: 6px;">
          <svg width="14" height="14" viewBox="0 0 20 20" fill="${COLORS.teal}"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.857-9.809a.75.75 0 00-1.214-.882l-3.483 4.79-1.88-1.88a.75.75 0 10-1.06 1.061l2.5 2.5a.75.75 0 001.137-.089l4-5.5z" clip-rule="evenodd" /></svg>
          <span style="font-size: 9px; font-weight: 700; color: ${COLORS.teal}; text-transform: uppercase; letter-spacing: 0.1em;">Validated Combination: ${combo.key.replace(/\+/g, ' + ')}</span>
        </div>
        ${combo.precedentDrug ? `<div style="font-size: 10px; color: ${COLORS.navy}; font-weight: 600; margin-bottom: 4px;">Precedent: ${combo.precedentDrug}</div>` : ''}
        <div style="font-size: 9px; color: ${COLORS.gray600}; line-height: 1.6;">${combo.rationale}</div>
        <div style="display: flex; gap: 12px; margin-top: 8px; font-size: 9px;">
          <div>Net Effect: <strong style="color: ${COLORS.teal};">${combo.netEffect.toFixed(2)}x</strong></div>
        </div>
      </div>
      ` : `
      <div class="callout-amber" style="margin-bottom: 14px;">
        <strong>Multi-Target Complexity:</strong> This combination has no established precedent drug. Default modifiers reflect the general complexity premium for ${targets.length}-target assets: PoS penalty from increased development risk, partially offset by broader market capture and strategic premium.
      </div>
      `}

      <!-- Methodology -->
      <div style="margin-top: 10px; font-size: 8px; color: ${COLORS.gray400}; line-height: 1.6;">
        <strong>Target Validation Methodology:</strong> PoS modifiers grounded in target-class approval history from FDA/EMA databases (2014&ndash;2026). Validated targets (at least one approved drug) receive a positive PoS uplift (1.05&ndash;1.30x) reflecting reduced biological risk. Novel targets receive a penalty (0.45&ndash;0.80x) reflecting higher attrition rates for first-in-target programs. Deal premiums derived from matched-pair analysis of target-enriched vs. undifferentiated deals in the Ambrosia transaction database (1,600+ deals). Combination effects calibrated against approved multi-target drugs and disclosed bispecific/ADC deal economics.
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
