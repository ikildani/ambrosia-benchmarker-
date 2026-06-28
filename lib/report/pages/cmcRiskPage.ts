// Page: CMC / Manufacturing Risk
// KPI boxes (timeline delay, cost multiplier, supply risk, scalability),
// scalability gauge SVG, clinical hold probability bar, regulatory complexity
// badge, and narrative.

import { formatPercent, pageHeader, pageFooter, COLORS, escapeHtml } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';

// ---------------------------------------------------------------------------
// SVG: Scalability Gauge (semicircle 0-100)
// ---------------------------------------------------------------------------

function renderScalabilityGauge(score: number): string {
  const w = 200;
  const h = 120;
  const cx = w / 2;
  const cy = 100;
  const r = 72;
  const uid = `sg-${Math.random().toString(36).slice(2, 8)}`;

  const clamped = Math.max(0, Math.min(score, 100));
  const angle = (clamped / 100) * 180;
  const needleRad = ((180 - angle) * Math.PI) / 180;
  const needleX = cx + r * 0.82 * Math.cos(needleRad);
  const needleY = cy - r * 0.82 * Math.sin(needleRad);

  // Arc path helper: 0 at left (180deg), 100 at right (0deg)
  const arcPath = (startPct: number, endPct: number): string => {
    const s = ((180 - (startPct / 100) * 180) * Math.PI) / 180;
    const e = ((180 - (endPct / 100) * 180) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(s);
    const y1 = cy - r * Math.sin(s);
    const x2 = cx + r * Math.cos(e);
    const y2 = cy - r * Math.sin(e);
    const largeArc = Math.abs(endPct - startPct) > 50 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  // Color bands: red 0-30, amber 30-60, green 60-100
  const valueColor = clamped >= 60 ? COLORS.green : clamped >= 30 ? COLORS.amber : COLORS.rose;

  return `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="${uid}-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.08" />
        </filter>
      </defs>
      <!-- Track background -->
      <path d="${arcPath(0, 100)}" fill="none" stroke="${COLORS.gray100}" stroke-width="16" stroke-linecap="round" />
      <!-- Red zone: 0-30 -->
      <path d="${arcPath(0, 30)}" fill="none" stroke="${COLORS.rose}" stroke-width="14" stroke-linecap="butt" opacity="0.3" />
      <!-- Amber zone: 30-60 -->
      <path d="${arcPath(30, 60)}" fill="none" stroke="${COLORS.amber}" stroke-width="14" stroke-linecap="butt" opacity="0.3" />
      <!-- Green zone: 60-100 -->
      <path d="${arcPath(60, 100)}" fill="none" stroke="${COLORS.green}" stroke-width="14" stroke-linecap="butt" opacity="0.3" />
      <!-- Needle -->
      <line x1="${cx}" y1="${cy}" x2="${needleX}" y2="${needleY}" stroke="${valueColor}" stroke-width="2.5" stroke-linecap="round" filter="url(#${uid}-shadow)" />
      <circle cx="${cx}" cy="${cy}" r="5" fill="${valueColor}" />
      <!-- Value label -->
      <text x="${cx}" y="${cy - 18}" text-anchor="middle" font-size="20" font-weight="800" fill="${valueColor}" letter-spacing="-0.03em">${clamped}</text>
      <text x="${cx}" y="${cy - 6}" text-anchor="middle" font-size="7" font-weight="700" fill="${COLORS.gray400}" letter-spacing="0.12em" text-transform="uppercase">SCALABILITY</text>
      <!-- Scale labels -->
      <text x="${cx - r - 4}" y="${cy + 10}" text-anchor="middle" font-size="7" fill="${COLORS.gray400}">0</text>
      <text x="${cx}" y="${cy - r - 6}" text-anchor="middle" font-size="7" fill="${COLORS.gray400}">50</text>
      <text x="${cx + r + 4}" y="${cy + 10}" text-anchor="middle" font-size="7" fill="${COLORS.gray400}">100</text>
    </svg>
  `;
}

// ---------------------------------------------------------------------------
// SVG: Clinical Hold Probability Bar
// ---------------------------------------------------------------------------

function renderClinicalHoldBar(probability: number): string {
  const w = 440;
  const h = 36;
  const barW = 380;
  const barH = 14;
  const padX = 10;
  const barY = (h - barH) / 2;
  const fillW = barW * Math.min(probability, 1);

  const color = probability >= 0.15 ? COLORS.rose : probability >= 0.08 ? COLORS.amber : COLORS.green;

  return `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${padX}" y="${barY}" width="${barW}" height="${barH}" rx="7" fill="${COLORS.gray100}" />
      <rect x="${padX}" y="${barY}" width="${Math.max(fillW, 2)}" height="${barH}" rx="7" fill="${color}" opacity="0.85" />
      <text x="${padX + fillW + 8}" y="${barY + barH / 2 + 3}" font-size="9" font-weight="700" fill="${color}">${formatPercent(probability * 100, 1)}</text>
      <text x="${padX + barW + 14}" y="${barY + barH / 2 + 3}" font-size="7" font-weight="600" fill="${COLORS.gray400}">clinical hold</text>
    </svg>
  `;
}

// ---------------------------------------------------------------------------
// Main Page Export
// ---------------------------------------------------------------------------

export function renderCMCRiskPage(data: PDFReportData, meta: ReportMeta): string {
  if (!data.cmcRisk) return '';

  const cmc = data.cmcRisk;

  // Derived labels and colors
  const delayMonths = Math.abs(cmc.additionalTimeline_years * 12).toFixed(0);
  const delayColor = cmc.additionalTimeline_years > 1 ? COLORS.rose : cmc.additionalTimeline_years > 0.5 ? COLORS.amber : COLORS.green;

  const costColor = cmc.manufacturingCostMultiplier >= 2.0 ? COLORS.rose : cmc.manufacturingCostMultiplier >= 1.5 ? COLORS.amber : COLORS.green;

  const supplyColors: Record<string, { color: string; bg: string }> = {
    low: { color: COLORS.green, bg: COLORS.greenLight },
    medium: { color: COLORS.amber, bg: COLORS.amberLight },
    high: { color: COLORS.rose, bg: COLORS.roseLight },
    critical: { color: COLORS.rose, bg: COLORS.roseLight },
  };
  const supply = supplyColors[cmc.supplyChainRisk] ?? supplyColors.medium;

  const scalabilityColor = cmc.scalabilityScore >= 60 ? COLORS.green : cmc.scalabilityScore >= 30 ? COLORS.amber : COLORS.rose;

  const complexityColors: Record<string, { color: string; bg: string }> = {
    standard: { color: COLORS.green, bg: COLORS.greenLight },
    elevated: { color: COLORS.amber, bg: COLORS.amberLight },
    complex: { color: COLORS.rose, bg: COLORS.roseLight },
    unprecedented: { color: COLORS.rose, bg: COLORS.roseLight },
  };
  const complexity = complexityColors[cmc.regulatoryComplexity] ?? complexityColors.elevated;

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, 'Deal Valuation Report')}

      <div class="section-title-lg">CMC / Manufacturing Risk</div>

      <!-- KPI Row: 4 boxes -->
      <div style="display: flex; gap: 10px; margin-bottom: 14px;">
        <!-- Timeline Delay -->
        <div style="flex: 1; border: 1px solid ${COLORS.gray200}; border-top: 3px solid ${delayColor}; border-radius: 6px; padding: 14px 12px; background: white; text-align: center;">
          <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 6px;">Timeline Delay</div>
          <div style="font-size: 28px; font-weight: 800; color: ${delayColor}; letter-spacing: -0.03em; line-height: 1;">+${delayMonths}mo</div>
          <div style="font-size: 8px; color: ${COLORS.gray500}; margin-top: 4px;">CMC-driven delay</div>
        </div>
        <!-- Cost Multiplier -->
        <div style="flex: 1; border: 1px solid ${COLORS.gray200}; border-top: 3px solid ${costColor}; border-radius: 6px; padding: 14px 12px; background: white; text-align: center;">
          <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 6px;">Cost Multiplier</div>
          <div style="font-size: 28px; font-weight: 800; color: ${costColor}; letter-spacing: -0.03em; line-height: 1;">${cmc.manufacturingCostMultiplier.toFixed(1)}x</div>
          <div style="font-size: 8px; color: ${COLORS.gray500}; margin-top: 4px;">vs. small molecule baseline</div>
        </div>
        <!-- Supply Chain Risk -->
        <div style="flex: 1; border: 1px solid ${COLORS.gray200}; border-top: 3px solid ${supply.color}; border-radius: 6px; padding: 14px 12px; background: white; text-align: center;">
          <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 6px;">Supply Chain Risk</div>
          <div style="margin-top: 8px;">
            <span style="font-size: 11px; font-weight: 800; color: ${supply.color}; background: ${supply.bg}; padding: 4px 14px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.08em;">${cmc.supplyChainRisk}</span>
          </div>
          <div style="font-size: 8px; color: ${COLORS.gray500}; margin-top: 8px;">sourcing complexity</div>
        </div>
        <!-- Scalability Score -->
        <div style="flex: 1; border: 1px solid ${COLORS.gray200}; border-top: 3px solid ${scalabilityColor}; border-radius: 6px; padding: 14px 12px; background: white; text-align: center;">
          <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 6px;">Scalability Score</div>
          <div style="font-size: 28px; font-weight: 800; color: ${scalabilityColor}; letter-spacing: -0.03em; line-height: 1;">${cmc.scalabilityScore}</div>
          <div style="font-size: 8px; color: ${COLORS.gray500}; margin-top: 4px;">out of 100</div>
        </div>
      </div>

      <!-- Scalability Gauge -->
      <div class="section-title">Scalability Assessment</div>
      <div class="card" style="padding: 12px 16px; margin-bottom: 14px; border-top: 3px solid ${COLORS.navy}; text-align: center;">
        <div class="chart-container">
          ${renderScalabilityGauge(cmc.scalabilityScore)}
        </div>
        <div style="font-size: 8px; color: ${COLORS.gray500}; margin-top: 4px;">
          ${cmc.scalabilityScore >= 75 ? 'Well-established manufacturing at commercial scale' : cmc.scalabilityScore >= 50 ? 'Moderate scale-up challenges expected' : cmc.scalabilityScore >= 30 ? 'Significant manufacturing scale-up risk' : 'Highly constrained manufacturing; patient-specific or single-site production likely'}
        </div>
      </div>

      <!-- Clinical Hold Probability -->
      <div class="section-title">CMC-Related Clinical Hold Probability</div>
      <div class="card" style="padding: 14px 16px; margin-bottom: 14px; border-top: 3px solid ${COLORS.navy};">
        <div class="chart-container">
          ${renderClinicalHoldBar(cmc.clinicalHoldProbability)}
        </div>
        <div style="display: flex; gap: 20px; margin-top: 8px;">
          <div style="display: flex; align-items: center; gap: 4px;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${COLORS.green}; display: inline-block;"></span>
            <span style="font-size: 7px; font-weight: 600; color: ${COLORS.gray500};">&lt; 8% Low</span>
          </div>
          <div style="display: flex; align-items: center; gap: 4px;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${COLORS.amber}; display: inline-block;"></span>
            <span style="font-size: 7px; font-weight: 600; color: ${COLORS.gray500};">8-15% Moderate</span>
          </div>
          <div style="display: flex; align-items: center; gap: 4px;">
            <span style="width: 8px; height: 8px; border-radius: 50%; background: ${COLORS.rose}; display: inline-block;"></span>
            <span style="font-size: 7px; font-weight: 600; color: ${COLORS.gray500};">&gt; 15% Elevated</span>
          </div>
        </div>
      </div>

      <!-- Regulatory Complexity Badge -->
      <div class="section-title">CMC Regulatory Complexity</div>
      <div class="card" style="padding: 14px 16px; margin-bottom: 14px; border-top: 3px solid ${COLORS.navy}; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <span style="font-size: 11px; font-weight: 800; color: ${complexity.color}; background: ${complexity.bg}; padding: 4px 16px; border-radius: 4px; text-transform: uppercase; letter-spacing: 0.08em;">${cmc.regulatoryComplexity}</span>
        </div>
        <div style="font-size: 8px; color: ${COLORS.gray500}; max-width: 320px; text-align: right; line-height: 1.5;">
          ${cmc.regulatoryComplexity === 'standard' ? 'Standard CMC dossier requirements; well-characterized manufacturing process.' : cmc.regulatoryComplexity === 'elevated' ? 'Additional CMC studies or comparability data likely required; potential for FDA information requests.' : cmc.regulatoryComplexity === 'complex' ? 'Complex dossier with novel excipients, devices, or delivery systems; pre-BLA/NDA CMC meetings recommended.' : 'Unprecedented manufacturing platform; expect extensive FDA engagement and potential advisory committee review of CMC data.'}
        </div>
      </div>

      <!-- Narrative -->
      <div class="callout" style="margin-bottom: 10px;">
        ${escapeHtml(cmc.narrative)}
      </div>

      <!-- Methodology -->
      <div class="disclaimer-box">
        <strong>Methodology:</strong> CMC risk parameters derived from FDA CDER/CBER manufacturing supplement review timelines 2015-2024 by modality class. Scalability scores calibrated against commercial-stage CDMO capacity surveys (BioPlan Annual Report). Clinical hold probabilities based on FDA clinical hold database for CMC-related actions (21 CFR 312.42(b)(1)). Cost multipliers benchmarked to published COGS analyses by modality (Kelley, Nat Biotechnol 2024).
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
