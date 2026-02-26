// Page: Defensive Analysis & Walk-Away Thresholds
// Worst/best case scenarios, defensive floor, walk-away threshold, risk/opportunity breakdown

import { formatUsd, formatPercent, pageHeader, pageFooter, COLORS, escapeHtml } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';
import type { ScenarioResult } from '@/lib/financial/types';

/**
 * Renders an SVG horizontal range bar showing the valuation range
 * from worst case to best case, with markers for defensive floor
 * and walk-away threshold.
 */
function renderRangeVisualization(
  worstCase: number,
  bestCase: number,
  defensiveFloor: number,
  walkAwayThreshold: number,
  baseRNPV: number,
): string {
  const width = 540;
  const height = 72;
  const barY = 28;
  const barH = 16;
  const padding = 20;

  // Scale from worst to best
  const minVal = Math.min(worstCase, walkAwayThreshold) * 0.95;
  const maxVal = bestCase * 1.05;
  const range = Math.max(maxVal - minVal, 1);

  const toX = (val: number) => padding + ((val - minVal) / range) * (width - 2 * padding);

  const worstX = toX(worstCase);
  const bestX = toX(bestCase);
  const floorX = toX(defensiveFloor);
  const walkX = toX(walkAwayThreshold);
  const baseX = toX(baseRNPV);

  return `
    <svg viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" style="width: 100%; height: auto;">
      <!-- Full range bar background -->
      <rect x="${worstX}" y="${barY}" width="${bestX - worstX}" height="${barH}" rx="3" fill="${COLORS.gray100}" />

      <!-- Red zone: worst to walk-away -->
      <rect x="${worstX}" y="${barY}" width="${Math.max(0, walkX - worstX)}" height="${barH}" rx="3" fill="${COLORS.roseLight}" />

      <!-- Amber zone: walk-away to defensive floor -->
      <rect x="${walkX}" y="${barY}" width="${Math.max(0, floorX - walkX)}" height="${barH}" rx="0" fill="${COLORS.amberLight}" />

      <!-- Green zone: defensive floor to best -->
      <rect x="${floorX}" y="${barY}" width="${Math.max(0, bestX - floorX)}" height="${barH}" rx="0" fill="${COLORS.greenLight}" />

      <!-- Walk-away threshold marker -->
      <line x1="${walkX}" y1="${barY - 4}" x2="${walkX}" y2="${barY + barH + 4}" stroke="${COLORS.rose}" stroke-width="2" stroke-dasharray="3,2" />
      <text x="${walkX}" y="${barY - 7}" text-anchor="middle" font-size="7" font-weight="700" fill="${COLORS.rose}">Walk-Away</text>

      <!-- Defensive floor marker -->
      <line x1="${floorX}" y1="${barY - 4}" x2="${floorX}" y2="${barY + barH + 4}" stroke="${COLORS.amber}" stroke-width="2" />
      <text x="${floorX}" y="${barY - 7}" text-anchor="middle" font-size="7" font-weight="700" fill="${COLORS.amber}">Floor</text>

      <!-- Base case marker -->
      <circle cx="${baseX}" cy="${barY + barH / 2}" r="5" fill="${COLORS.teal}" stroke="${COLORS.white}" stroke-width="1.5" />
      <text x="${baseX}" y="${barY + barH + 14}" text-anchor="middle" font-size="7" font-weight="700" fill="${COLORS.teal}">Base rNPV</text>

      <!-- Value labels at extremes -->
      <text x="${worstX}" y="${barY + barH + 14}" text-anchor="start" font-size="7" fill="${COLORS.gray400}">${formatUsd(worstCase)}</text>
      <text x="${bestX}" y="${barY + barH + 14}" text-anchor="end" font-size="7" fill="${COLORS.gray400}">${formatUsd(bestCase)}</text>
    </svg>
  `;
}

function renderScenarioCard(scenario: ScenarioResult, type: 'risk' | 'opportunity'): string {
  const isRisk = type === 'risk';
  const borderColor = isRisk ? COLORS.rose : COLORS.green;
  const badgeClass = isRisk ? 'badge-rose' : 'badge-teal';
  const deltaColor = isRisk ? COLORS.rose : COLORS.green;
  const deltaPrefix = scenario.impactDelta >= 0 ? '+' : '';

  return `
    <div class="card-sm" style="border-left: 3px solid ${borderColor};">
      <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 4px;">
        <div style="font-size: 10px; font-weight: 700; color: ${COLORS.navy}; line-height: 1.3;">${escapeHtml(scenario.scenario.name)}</div>
        <span class="badge ${badgeClass}" style="flex-shrink: 0; margin-left: 6px;">${escapeHtml(scenario.scenario.category)}</span>
      </div>
      <div style="display: flex; align-items: baseline; gap: 8px; margin-bottom: 4px;">
        <span style="font-size: 14px; font-weight: 800; color: ${deltaColor};">${deltaPrefix}${formatUsd(scenario.impactDelta)}</span>
        <span style="font-size: 9px; color: ${COLORS.gray400};">(${deltaPrefix}${formatPercent(scenario.impactPercent, 1)})</span>
      </div>
      <div style="font-size: 9px; color: ${COLORS.gray500}; line-height: 1.5;">${escapeHtml(scenario.narrative)}</div>
    </div>
  `;
}

export function renderDefensiveAdvicePage(data: PDFReportData, meta: ReportMeta): string {
  if (!data.defensiveAnalysis) return '';

  const da = data.defensiveAnalysis;
  const scenarios = data.scenarioResults || [];

  // Sort scenarios by impact: most negative first for risks, most positive for opportunities
  const risks = [...scenarios]
    .filter(s => s.impactDelta < 0)
    .sort((a, b) => a.impactDelta - b.impactDelta)
    .slice(0, 3);

  const opportunities = [...scenarios]
    .filter(s => s.impactDelta > 0)
    .sort((a, b) => b.impactDelta - a.impactDelta)
    .slice(0, 3);

  const baseRNPV = da.worstCase.baseRNPV;

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, 'Deal Valuation Report')}

      <div class="section-title-lg">Defensive Analysis &amp; Walk-Away Thresholds</div>

      <!-- Worst/Best Case Hero -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 18px;">
        <div style="background: linear-gradient(145deg, #4c1d2e 0%, #6b2040 100%); border-radius: 6px; padding: 18px; color: white;">
          <div style="font-size: 7px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.16em; font-weight: 700; margin-bottom: 6px;">Worst Case Scenario</div>
          <div style="font-size: 12px; font-weight: 700; color: #fecdd3; margin-bottom: 4px;">${escapeHtml(da.worstCase.scenario.name)}</div>
          <div style="font-size: 24px; font-weight: 800; color: #fff; margin-bottom: 6px;">${formatUsd(da.worstCase.adjustedRNPV)}</div>
          <div style="font-size: 9px; color: rgba(255,255,255,0.55); line-height: 1.5;">${escapeHtml(da.worstCase.narrative)}</div>
        </div>
        <div style="background: linear-gradient(145deg, #14532d 0%, #166534 100%); border-radius: 6px; padding: 18px; color: white;">
          <div style="font-size: 7px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.16em; font-weight: 700; margin-bottom: 6px;">Best Case Scenario</div>
          <div style="font-size: 12px; font-weight: 700; color: #bbf7d0; margin-bottom: 4px;">${escapeHtml(da.bestCase.scenario.name)}</div>
          <div style="font-size: 24px; font-weight: 800; color: #fff; margin-bottom: 6px;">${formatUsd(da.bestCase.adjustedRNPV)}</div>
          <div style="font-size: 9px; color: rgba(255,255,255,0.55); line-height: 1.5;">${escapeHtml(da.bestCase.narrative)}</div>
        </div>
      </div>

      <!-- Thresholds KPIs -->
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px; margin-bottom: 18px;">
        <div class="kpi-card">
          <div class="kpi-value">${formatUsd(baseRNPV)}</div>
          <div class="kpi-label">Base rNPV</div>
        </div>
        <div class="kpi-card" style="border-top-color: ${COLORS.amber};">
          <div class="kpi-value" style="color: ${COLORS.amber};">${formatUsd(da.defensiveFloor)}</div>
          <div class="kpi-label">Defensive Floor</div>
        </div>
        <div class="kpi-card" style="border-top-color: ${COLORS.rose};">
          <div class="kpi-value" style="color: ${COLORS.rose};">${formatUsd(da.walkAwayThreshold)}</div>
          <div class="kpi-label">Walk-Away Threshold</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-value" style="color: ${COLORS.navy};">${formatUsd(da.bestCase.adjustedRNPV - da.worstCase.adjustedRNPV)}</div>
          <div class="kpi-label">Total Range</div>
        </div>
      </div>

      <!-- Range Visualization -->
      <div class="section-title">Valuation Range</div>
      <div class="card" style="padding: 14px; margin-bottom: 18px;">
        <div class="chart-container">
          ${renderRangeVisualization(
            da.worstCase.adjustedRNPV,
            da.bestCase.adjustedRNPV,
            da.defensiveFloor,
            da.walkAwayThreshold,
            baseRNPV,
          )}
        </div>
        <div style="display: flex; justify-content: center; gap: 16px; margin-top: 8px;">
          <div style="display: flex; align-items: center; gap: 4px;">
            <div style="width: 10px; height: 6px; background: ${COLORS.roseLight}; border: 1px solid ${COLORS.rose}; border-radius: 1px;"></div>
            <span style="font-size: 7px; color: ${COLORS.gray400};">Below Walk-Away</span>
          </div>
          <div style="display: flex; align-items: center; gap: 4px;">
            <div style="width: 10px; height: 6px; background: ${COLORS.amberLight}; border: 1px solid ${COLORS.amber}; border-radius: 1px;"></div>
            <span style="font-size: 7px; color: ${COLORS.gray400};">Caution Zone</span>
          </div>
          <div style="display: flex; align-items: center; gap: 4px;">
            <div style="width: 10px; height: 6px; background: ${COLORS.greenLight}; border: 1px solid ${COLORS.green}; border-radius: 1px;"></div>
            <span style="font-size: 7px; color: ${COLORS.gray400};">Acceptable Range</span>
          </div>
        </div>
      </div>

      <!-- Key Risks & Opportunities -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 16px;">
        <div>
          <div class="section-title">Key Risks</div>
          ${risks.length > 0
            ? risks.map(s => renderScenarioCard(s, 'risk')).join('<div style="height: 8px;"></div>')
            : `<div class="card-sm" style="text-align: center; color: ${COLORS.gray400}; font-size: 10px;">No downside scenarios identified.</div>`
          }
        </div>
        <div>
          <div class="section-title">Key Opportunities</div>
          ${opportunities.length > 0
            ? opportunities.map(s => renderScenarioCard(s, 'opportunity')).join('<div style="height: 8px;"></div>')
            : `<div class="card-sm" style="text-align: center; color: ${COLORS.gray400}; font-size: 10px;">No upside scenarios identified.</div>`
          }
        </div>
      </div>

      <!-- Deal Advice Narrative -->
      <div class="callout" style="margin-top: 4px;">
        <div style="font-size: 8px; font-weight: 700; color: ${COLORS.teal}; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 4px;">Deal Advice</div>
        <div style="font-size: 10px; color: #134e4a; line-height: 1.65;">${escapeHtml(da.narrative)}</div>
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
