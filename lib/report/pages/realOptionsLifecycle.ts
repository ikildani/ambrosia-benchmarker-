// Page: Real Options + Competitive Dynamics + Lifecycle Extensions
// Combined institutional-grade page for advanced rNPV upgrade analytics

import { formatUsd, formatPercent, pageHeader, pageFooter, COLORS, escapeHtml } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';

/** Render a compact KPI box with accent top border. */
function kpiBox(value: string, label: string, sub: string, color: string): string {
  return `
    <div style="flex: 1; border: 1px solid ${COLORS.gray200}; border-top: 3px solid ${color}; border-radius: 6px; padding: 12px 10px; text-align: center; background: white;">
      <div style="font-size: 22px; font-weight: 800; color: ${color}; letter-spacing: -0.03em; line-height: 1;">${value}</div>
      <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; margin-top: 5px;">${label}</div>
      ${sub ? `<div style="font-size: 8px; color: ${COLORS.gray400}; margin-top: 2px;">${sub}</div>` : ''}
    </div>
  `;
}

/** Map competitor type to a human-readable label. */
function competitorTypeLabel(type: string): string {
  const map: Record<string, string> = {
    generic: 'Generic',
    biosimilar: 'Biosimilar',
    nextGen: 'Next-Gen',
    classCompetitor: 'Class Competitor',
  };
  return map[type] || type;
}

/** Map competitor type to badge class. */
function competitorTypeBadge(type: string): string {
  const map: Record<string, string> = {
    generic: 'badge-gray',
    biosimilar: 'badge-blue',
    nextGen: 'badge-amber',
    classCompetitor: 'badge-rose',
  };
  return map[type] || 'badge-gray';
}

/** Map lifecycle extension type to label. */
function extensionTypeLabel(type: string): string {
  const map: Record<string, string> = {
    labelExpansion: 'Label Expansion',
    pediatricExclusivity: 'Pediatric Exclusivity',
    combinationApproval: 'Combination Approval',
  };
  return map[type] || type;
}

/** Map lifecycle extension type to accent color. */
function extensionTypeColor(type: string): string {
  const map: Record<string, string> = {
    labelExpansion: COLORS.teal,
    pediatricExclusivity: COLORS.purple,
    combinationApproval: COLORS.cyan,
  };
  return map[type] || COLORS.teal;
}

export function renderRealOptionsLifecyclePage(data: PDFReportData, meta: ReportMeta): string {
  const ro = data.realOptions;
  const cd = data.competitiveDynamics;
  const le = data.lifecycleExtensions;

  // Require at least one section to render
  if (!ro && !cd && !le) return '';

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, 'Deal Valuation Report')}

      <div class="section-title-lg">Advanced Analytics</div>

      ${ro ? `
      <!-- ============================================================ -->
      <!-- REAL OPTIONS VALUATION -->
      <!-- ============================================================ -->
      <div class="section-title">Real Options Valuation</div>

      <!-- KPI Row -->
      <div style="display: flex; gap: 10px; margin-bottom: 10px;">
        ${kpiBox(formatUsd(ro.totalOptionValue), 'Option Value', 'Compound option', COLORS.teal)}
        ${kpiBox(formatPercent(ro.volatilityUsed * 100, 0), 'Implied Volatility', 'MC-derived', COLORS.navy)}
        ${kpiBox(
          (ro.flexibilityPremium >= 0 ? '+' : '') + formatUsd(ro.flexibilityPremium),
          'Flexibility Premium',
          formatPercent(ro.flexibilityPremiumPercent, 1) + ' above rNPV',
          ro.flexibilityPremium >= 0 ? COLORS.green : COLORS.rose,
        )}
      </div>

      <!-- Phase-by-Phase Table -->
      ${ro.optionValueByPhase.length > 0 ? `
      <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 8px;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Phase</th>
              <th style="text-align: right;">Option Value</th>
              <th style="text-align: right;">Intrinsic</th>
              <th style="text-align: right;">Time Value</th>
            </tr>
          </thead>
          <tbody>
            ${ro.optionValueByPhase.map(p => {
              const phaseLabel = p.phase.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase()).replace(/_/g, '/');
              return `
              <tr>
                <td style="font-weight: 600; color: ${COLORS.navy};">${escapeHtml(phaseLabel)}</td>
                <td class="value-cell">${formatUsd(p.optionValue)}</td>
                <td style="text-align: right; color: ${COLORS.gray600};">${formatUsd(p.intrinsicValue)}</td>
                <td style="text-align: right; color: ${p.timeValue > 0 ? COLORS.teal : COLORS.gray400}; font-weight: ${p.timeValue > 0 ? '700' : '400'};">${formatUsd(p.timeValue)}</td>
              </tr>
              `;
            }).join('')}
          </tbody>
        </table>
      </div>
      ` : ''}

      <div style="font-size: 8px; color: ${COLORS.gray400}; line-height: 1.5; margin-bottom: 14px;">
        <strong>Method:</strong> CRR binomial lattice (${ro.latticeSteps} steps/phase), risk-free rate ${formatPercent(ro.riskFreeRate * 100, 1)}, volatility derived from Monte Carlo P10/P90 spread. Source: Cox, Ross &amp; Rubinstein (1979).
      </div>
      ` : ''}

      ${cd ? `
      <!-- ============================================================ -->
      <!-- COMPETITIVE DYNAMICS -->
      <!-- ============================================================ -->
      <div class="section-title" style="${ro ? 'margin-top: 6px;' : ''}">Competitive Dynamics</div>

      <!-- KPI Row -->
      <div style="display: flex; gap: 10px; margin-bottom: 10px;">
        ${kpiBox(
          String(cd.competitorTimeline.length),
          'Competitors',
          'Anticipated entrants',
          COLORS.navy,
        )}
        ${kpiBox(
          formatPercent(cd.peakShareErosion * 100, 1),
          'Peak Erosion',
          'Maximum share loss',
          cd.peakShareErosion > 0.3 ? COLORS.rose : cd.peakShareErosion > 0.15 ? COLORS.amber : COLORS.green,
        )}
        ${kpiBox(
          '-' + formatUsd(cd.revenueImpact),
          'Revenue Impact',
          'Lifetime loss',
          COLORS.rose,
        )}
      </div>

      <!-- Competitor Timeline Table -->
      <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 8px;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Entry Year</th>
              <th>Type</th>
              <th style="text-align: right;">Share Impact</th>
              <th style="text-align: right;">Ramp (yrs)</th>
            </tr>
          </thead>
          <tbody>
            ${cd.competitorTimeline.map(c => `
              <tr>
                <td style="font-weight: 700; color: ${COLORS.navy};">${c.entryYear}</td>
                <td><span class="badge ${competitorTypeBadge(c.type)}">${competitorTypeLabel(c.type)}</span></td>
                <td style="text-align: right; font-weight: 700; color: ${COLORS.rose};">-${formatPercent(c.shareImpact * 100, 0)}</td>
                <td style="text-align: right; color: ${COLORS.gray600};">${c.rampYears}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      <!-- Competitive narrative -->
      <div class="callout" style="margin-bottom: 14px; font-size: 9px;">
        ${escapeHtml(cd.narrative)}
      </div>
      ` : ''}

      ${le ? `
      <!-- ============================================================ -->
      <!-- LIFECYCLE EXTENSIONS -->
      <!-- ============================================================ -->
      <div class="section-title" style="${ro || cd ? 'margin-top: 6px;' : ''}">Lifecycle Extensions</div>

      <!-- Base vs Extended Comparison -->
      <div style="display: flex; gap: 12px; align-items: center; margin-bottom: 12px;">
        <div style="flex: 1; border: 1px solid ${COLORS.gray200}; border-top: 3px solid ${COLORS.navy}; border-radius: 6px; padding: 12px 14px; text-align: center; background: white;">
          <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 4px;">Base rNPV</div>
          <div style="font-size: 22px; font-weight: 800; color: ${COLORS.navy}; letter-spacing: -0.03em;">${formatUsd(le.baseRNPV)}</div>
        </div>
        <div style="flex-shrink: 0; text-align: center;">
          <div style="font-size: 22px; font-weight: 800; color: ${le.incrementalValue >= 0 ? COLORS.green : COLORS.rose};">
            ${le.incrementalValue >= 0 ? '+' : ''}${formatUsd(le.incrementalValue)}
          </div>
          <div style="font-size: 7px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600;">
            ${le.incrementalPercent >= 0 ? '+' : ''}${formatPercent(le.incrementalPercent, 1)}
          </div>
        </div>
        <div style="flex: 1; border: 1px solid #bbf7d0; border-top: 3px solid ${COLORS.green}; border-radius: 6px; padding: 12px 14px; text-align: center; background: #f0fdf4;">
          <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 4px;">Extended rNPV</div>
          <div style="font-size: 22px; font-weight: 800; color: ${COLORS.green}; letter-spacing: -0.03em;">${formatUsd(le.extendedRNPV)}</div>
        </div>
      </div>

      <!-- Extension Cards -->
      <div style="display: flex; gap: 8px; margin-bottom: 8px;">
        ${le.extensions.map(ext => {
          const color = extensionTypeColor(ext.type);
          return `
          <div style="flex: 1; border: 1px solid ${COLORS.gray200}; border-left: 4px solid ${color}; border-radius: 0 6px 6px 0; padding: 10px 12px; background: white;">
            <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 4px;">
              <span style="font-size: 9px; font-weight: 700; color: ${COLORS.navy};">${extensionTypeLabel(ext.type)}</span>
              <span style="font-size: 8px; font-weight: 700; color: ${color}; background: ${COLORS.gray50}; padding: 1px 6px; border-radius: 3px;">+${formatPercent(ext.incrementalPeakSalesPercent, 0)}</span>
            </div>
            <div style="display: flex; gap: 12px; margin-bottom: 4px;">
              <div>
                <div style="font-size: 7px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600;">Probability</div>
                <div style="font-size: 11px; font-weight: 700; color: ${COLORS.navy};">${formatPercent(ext.probability * 100, 0)}</div>
              </div>
              <div>
                <div style="font-size: 7px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600;">Lag</div>
                <div style="font-size: 11px; font-weight: 700; color: ${COLORS.navy};">${ext.lagYearsFromApproval}yr</div>
              </div>
              <div>
                <div style="font-size: 7px; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.08em; font-weight: 600;">Excl.</div>
                <div style="font-size: 11px; font-weight: 700; color: ${COLORS.navy};">+${ext.additionalExclusivityYears}yr</div>
              </div>
            </div>
            <div style="font-size: 8px; color: ${COLORS.gray500}; line-height: 1.5;">${escapeHtml(ext.narrative)}</div>
          </div>
          `;
        }).join('')}
      </div>
      ` : ''}

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
