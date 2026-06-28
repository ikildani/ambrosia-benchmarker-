// Page: Pricing & Reimbursement Analysis
// ICER threshold gauge, international pricing comparison, IRA timeline,
// payer mix donut, access barriers list, and analyst narrative.

import { formatPercent, pageHeader, pageFooter, COLORS, escapeHtml } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';

// ---------------------------------------------------------------------------
// SVG: ICER Threshold Gauge (semicircle WTP vs drug price)
// ---------------------------------------------------------------------------

function renderIcerGauge(icerRisk: string, thresholdPerQALY: number): string {
  const w = 200;
  const h = 120;
  const cx = w / 2;
  const cy = 100;
  const r = 72;
  const uid = `icer-${Math.random().toString(36).slice(2, 8)}`;

  // Map risk to needle position: favorable=25%, borderline=55%, unfavorable=85%
  const pctMap: Record<string, number> = { favorable: 25, borderline: 55, unfavorable: 85 };
  const pct = pctMap[icerRisk] ?? 50;
  const angle = (pct / 100) * 180;
  const needleRad = ((180 - angle) * Math.PI) / 180;
  const needleX = cx + r * 0.82 * Math.cos(needleRad);
  const needleY = cy - r * 0.82 * Math.sin(needleRad);

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

  const valueColor = icerRisk === 'favorable' ? COLORS.green : icerRisk === 'borderline' ? COLORS.amber : COLORS.rose;
  const riskLabel = icerRisk === 'favorable' ? 'Favorable' : icerRisk === 'borderline' ? 'Borderline' : 'Unfavorable';
  const thresholdStr = thresholdPerQALY >= 1000 ? `$${(thresholdPerQALY / 1000).toFixed(0)}K` : `$${thresholdPerQALY}`;

  return `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="${uid}-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.08" />
        </filter>
      </defs>
      <!-- Track background -->
      <path d="${arcPath(0, 100)}" fill="none" stroke="${COLORS.gray100}" stroke-width="16" stroke-linecap="round" />
      <!-- Green zone: 0-40% (favorable) -->
      <path d="${arcPath(0, 40)}" fill="none" stroke="${COLORS.green}" stroke-width="14" stroke-linecap="butt" opacity="0.3" />
      <!-- Amber zone: 40-65% (borderline) -->
      <path d="${arcPath(40, 65)}" fill="none" stroke="${COLORS.amber}" stroke-width="14" stroke-linecap="butt" opacity="0.3" />
      <!-- Red zone: 65-100% (unfavorable) -->
      <path d="${arcPath(65, 100)}" fill="none" stroke="${COLORS.rose}" stroke-width="14" stroke-linecap="butt" opacity="0.3" />
      <!-- Needle -->
      <line x1="${cx}" y1="${cy}" x2="${needleX}" y2="${needleY}" stroke="${valueColor}" stroke-width="2.5" stroke-linecap="round" filter="url(#${uid}-shadow)" />
      <circle cx="${cx}" cy="${cy}" r="5" fill="${valueColor}" />
      <!-- Value label -->
      <text x="${cx}" y="${cy - 20}" text-anchor="middle" font-size="14" font-weight="800" fill="${valueColor}" letter-spacing="-0.02em">${riskLabel}</text>
      <text x="${cx}" y="${cy - 6}" text-anchor="middle" font-size="7" font-weight="700" fill="${COLORS.gray400}" letter-spacing="0.12em">${thresholdStr}/QALY</text>
      <!-- Scale labels -->
      <text x="${cx - r - 4}" y="${cy + 10}" text-anchor="middle" font-size="7" fill="${COLORS.gray400}">Low</text>
      <text x="${cx + r + 4}" y="${cy + 10}" text-anchor="middle" font-size="7" fill="${COLORS.gray400}">High</text>
    </svg>
  `;
}

// ---------------------------------------------------------------------------
// SVG: International Pricing Comparison (horizontal bar chart)
// ---------------------------------------------------------------------------

function renderInternationalPricingBars(territories: { territory: string; pricePctOfUS: number }[]): string {
  const sorted = [...territories].sort((a, b) => b.pricePctOfUS - a.pricePctOfUS);
  const w = 520;
  const barH = 16;
  const gap = 6;
  const labelW = 80;
  const valueW = 50;
  const chartX = labelW;
  const chartW = w - labelW - valueW - 10;
  const h = sorted.length * (barH + gap) + 20;
  const uid = `irp-${Math.random().toString(36).slice(2, 8)}`;

  const bars = sorted.map((t, i) => {
    const y = 10 + i * (barH + gap);
    const fillW = Math.max(chartW * t.pricePctOfUS, 2);
    const isUS = t.territory.toUpperCase() === 'US' || t.territory.toUpperCase() === 'USA';
    const color = isUS ? COLORS.navy : t.pricePctOfUS >= 0.8 ? COLORS.teal : t.pricePctOfUS >= 0.5 ? COLORS.amber : COLORS.rose;

    return `
      <text x="${labelW - 6}" y="${y + barH / 2 + 3}" text-anchor="end" font-size="8" font-weight="600" fill="${COLORS.gray600}">${escapeHtml(t.territory)}</text>
      <rect x="${chartX}" y="${y}" width="${fillW}" height="${barH}" rx="3" fill="${color}" opacity="0.85" filter="url(#${uid}-shadow)" />
      <text x="${chartX + fillW + 4}" y="${y + barH / 2 + 3}" font-size="8" font-weight="700" fill="${color}">${formatPercent(t.pricePctOfUS * 100, 0)}</text>
    `;
  }).join('');

  return `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="${uid}-shadow" x="-4%" y="-4%" width="108%" height="112%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.08" />
        </filter>
      </defs>
      <!-- US baseline reference line at 100% -->
      <line x1="${chartX + chartW}" y1="4" x2="${chartX + chartW}" y2="${h - 4}" stroke="${COLORS.gray200}" stroke-width="1" stroke-dasharray="3,2" />
      <text x="${chartX + chartW}" y="8" text-anchor="middle" font-size="6" fill="${COLORS.gray300}">100%</text>
      ${bars}
    </svg>
  `;
}

// ---------------------------------------------------------------------------
// SVG: IRA Exposure Timeline
// ---------------------------------------------------------------------------

function renderIraTimeline(negotiationYear: number | null, reductionPct: number): string {
  if (!negotiationYear) return '';
  const w = 520;
  const h = 60;
  const padX = 30;
  const currentYear = new Date().getFullYear();
  const startYear = currentYear;
  const endYear = Math.max(negotiationYear + 3, currentYear + 10);
  const years = endYear - startYear;
  const uid = `ira-${Math.random().toString(36).slice(2, 8)}`;

  const xPos = (yr: number) => padX + ((yr - startYear) / years) * (w - 2 * padX);
  const lineY = 28;

  return `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="${uid}-shadow" x="-4%" y="-4%" width="108%" height="112%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.08" />
        </filter>
      </defs>
      <!-- Timeline baseline -->
      <line x1="${padX}" y1="${lineY}" x2="${w - padX}" y2="${lineY}" stroke="${COLORS.gray200}" stroke-width="2" />
      <!-- Pre-negotiation (safe) zone -->
      <rect x="${padX}" y="${lineY - 4}" width="${xPos(negotiationYear) - padX}" height="8" rx="4" fill="${COLORS.green}" opacity="0.2" />
      <!-- Post-negotiation (exposure) zone -->
      <rect x="${xPos(negotiationYear)}" y="${lineY - 4}" width="${w - padX - xPos(negotiationYear)}" height="8" rx="4" fill="${COLORS.rose}" opacity="0.2" />
      <!-- Negotiation marker -->
      <circle cx="${xPos(negotiationYear)}" cy="${lineY}" r="6" fill="${COLORS.rose}" filter="url(#${uid}-shadow)" />
      <text x="${xPos(negotiationYear)}" y="${lineY - 12}" text-anchor="middle" font-size="8" font-weight="700" fill="${COLORS.rose}">${negotiationYear}</text>
      <text x="${xPos(negotiationYear)}" y="${lineY + 18}" text-anchor="middle" font-size="7" font-weight="600" fill="${COLORS.gray500}">Negotiation Start</text>
      <!-- Reduction label -->
      <text x="${xPos(negotiationYear) + 40}" y="${lineY + 18}" text-anchor="start" font-size="7" font-weight="700" fill="${COLORS.rose}">-${formatPercent(reductionPct * 100, 0)} price impact</text>
      <!-- Year labels -->
      <text x="${padX}" y="${h - 4}" font-size="7" fill="${COLORS.gray400}">${startYear}</text>
      <text x="${w - padX}" y="${h - 4}" text-anchor="end" font-size="7" fill="${COLORS.gray400}">${endYear}</text>
    </svg>
  `;
}

// ---------------------------------------------------------------------------
// SVG: Payer Mix Donut
// ---------------------------------------------------------------------------

function renderPayerMixDonut(commercial: number, medicare: number, medicaid: number, managedCare: number): string {
  const w = 180;
  const h = 180;
  const cx = w / 2;
  const cy = h / 2;
  const r = 60;
  const innerR = 36;
  const uid = `pm-${Math.random().toString(36).slice(2, 8)}`;

  const segments = [
    { label: 'Commercial', pct: commercial, color: COLORS.teal },
    { label: 'Medicare', pct: medicare, color: COLORS.blue },
    { label: 'Medicaid', pct: medicaid, color: COLORS.amber },
    { label: 'Managed Care', pct: managedCare, color: COLORS.purple },
  ].filter(s => s.pct > 0);

  let currentAngle = -Math.PI / 2; // start at top
  const arcs = segments.map(seg => {
    const sweep = seg.pct * 2 * Math.PI;
    const startAngle = currentAngle;
    const endAngle = currentAngle + sweep;
    currentAngle = endAngle;

    const largeArc = sweep > Math.PI ? 1 : 0;
    const outerX1 = cx + r * Math.cos(startAngle);
    const outerY1 = cy + r * Math.sin(startAngle);
    const outerX2 = cx + r * Math.cos(endAngle);
    const outerY2 = cy + r * Math.sin(endAngle);
    const innerX1 = cx + innerR * Math.cos(endAngle);
    const innerY1 = cy + innerR * Math.sin(endAngle);
    const innerX2 = cx + innerR * Math.cos(startAngle);
    const innerY2 = cy + innerR * Math.sin(startAngle);

    const path = `M ${outerX1} ${outerY1} A ${r} ${r} 0 ${largeArc} 1 ${outerX2} ${outerY2} L ${innerX1} ${innerY1} A ${innerR} ${innerR} 0 ${largeArc} 0 ${innerX2} ${innerY2} Z`;

    return `<path d="${path}" fill="${seg.color}" opacity="0.85" filter="url(#${uid}-shadow)" />`;
  }).join('');

  return `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="${uid}-shadow" x="-4%" y="-4%" width="108%" height="112%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.08" />
        </filter>
      </defs>
      ${arcs}
      <!-- Center label -->
      <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-size="8" font-weight="700" fill="${COLORS.gray400}" letter-spacing="0.1em">PAYER</text>
      <text x="${cx}" y="${cy + 8}" text-anchor="middle" font-size="8" font-weight="700" fill="${COLORS.gray400}" letter-spacing="0.1em">MIX</text>
    </svg>
  `;
}

// ---------------------------------------------------------------------------
// Access Barrier Icon (small SVG inline icon)
// ---------------------------------------------------------------------------

function barrierIcon(): string {
  return `<svg width="10" height="10" viewBox="0 0 10 10" style="vertical-align: middle; margin-right: 4px;">
    <circle cx="5" cy="5" r="4" fill="${COLORS.rose}" opacity="0.2" />
    <text x="5" y="7.5" text-anchor="middle" font-size="7" font-weight="800" fill="${COLORS.rose}">!</text>
  </svg>`;
}

// ---------------------------------------------------------------------------
// Main Page Export
// ---------------------------------------------------------------------------

export function renderPricingAccessPage(data: PDFReportData, meta: ReportMeta): string {
  if (!data.pricingConstraints) return '';

  const pc = data.pricingConstraints;

  // NICE recommendation label + color
  const niceLabels: Record<string, { label: string; color: string }> = {
    recommended: { label: 'Recommended', color: COLORS.green },
    optimized: { label: 'Optimized', color: COLORS.teal },
    restricted: { label: 'Restricted', color: COLORS.amber },
    not_recommended: { label: 'Not Recommended', color: COLORS.rose },
  };
  const nice = niceLabels[pc.niceRecommendation] ?? { label: pc.niceRecommendation, color: COLORS.gray500 };

  // Formulary tier label + color
  const tierLabels: Record<string, { label: string; color: string }> = {
    specialty: { label: 'Specialty', color: COLORS.purple },
    preferred_brand: { label: 'Preferred Brand', color: COLORS.teal },
    non_preferred: { label: 'Non-Preferred', color: COLORS.amber },
    restricted: { label: 'Restricted', color: COLORS.rose },
  };
  const tier = tierLabels[pc.formularyTier] ?? { label: pc.formularyTier, color: COLORS.gray500 };

  // Peak sales adjustment direction
  const adjPct = pc.peakSalesAdjustment_pct;
  const adjColor = adjPct >= 0 ? COLORS.green : COLORS.rose;
  const adjSign = adjPct >= 0 ? '+' : '';

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, 'Deal Valuation Report')}

      <div class="section-title-lg">Pricing &amp; Reimbursement Analysis</div>

      <!-- Top row: ICER Gauge + NICE + Formulary + Peak Sales Impact -->
      <div style="display: flex; gap: 10px; margin-bottom: 14px;">
        <!-- ICER Gauge -->
        <div style="flex: 1.2; border: 1px solid ${COLORS.gray200}; border-top: 3px solid ${COLORS.navy}; border-radius: 6px; padding: 12px 14px; background: white; text-align: center;">
          <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 6px;">ICER Cost-Effectiveness</div>
          <div class="chart-container">
            ${renderIcerGauge(pc.icerRisk, pc.icerThreshold)}
          </div>
        </div>
        <!-- NICE + Formulary -->
        <div style="flex: 0.8; display: flex; flex-direction: column; gap: 10px;">
          <div style="flex: 1; border: 1px solid ${COLORS.gray200}; border-top: 3px solid ${nice.color}; border-radius: 6px; padding: 14px; background: white; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 4px;">
            <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em;">NICE Recommendation</div>
            <div style="font-size: 14px; font-weight: 800; color: ${nice.color};">${nice.label}</div>
          </div>
          <div style="flex: 1; border: 1px solid ${COLORS.gray200}; border-top: 3px solid ${tier.color}; border-radius: 6px; padding: 14px; background: white; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 4px;">
            <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em;">Formulary Tier</div>
            <div style="font-size: 14px; font-weight: 800; color: ${tier.color};">${tier.label}</div>
          </div>
        </div>
        <!-- Peak Sales Adjustment -->
        <div style="flex: 0.8; border: 1px solid ${COLORS.gray200}; border-top: 3px solid ${adjColor}; border-radius: 6px; padding: 16px 14px; background: white; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 6px;">
          <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em;">Peak Sales Impact</div>
          <div style="font-size: 28px; font-weight: 800; color: ${adjColor}; letter-spacing: -0.03em; line-height: 1;">${adjSign}${formatPercent(adjPct * 100, 1)}</div>
          <span style="font-size: 8px; font-weight: 700; color: ${adjColor}; background: ${adjColor}15; padding: 2px 10px; border-radius: 3px;">Net Adjustment</span>
        </div>
      </div>

      <!-- International Reference Pricing -->
      <div class="section-title">International Reference Pricing</div>
      <div class="card" style="padding: 12px 16px; margin-bottom: 14px; border-top: 3px solid ${COLORS.navy};">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <span style="font-size: 8px; font-weight: 600; color: ${COLORS.gray500};">Territory Prices as % of US WAC</span>
          <span style="font-size: 9px; font-weight: 800; color: ${COLORS.navy};">Avg: ${formatPercent(pc.internationalReferencePricing.avgPriceVsUS * 100, 0)} of US</span>
        </div>
        <div class="chart-container">
          ${renderInternationalPricingBars(pc.internationalReferencePricing.territories)}
        </div>
      </div>

      <!-- IRA Exposure Timeline (if eligible) -->
      ${pc.iraExposure.eligible ? `
      <div class="section-title">IRA Medicare Negotiation Exposure</div>
      <div class="card" style="padding: 12px 16px; margin-bottom: 14px; border-top: 3px solid ${COLORS.rose};">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
          <div>
            <span style="font-size: 9px; font-weight: 800; color: ${COLORS.rose}; background: ${COLORS.roseLight}; padding: 3px 12px; border-radius: 4px;">IRA Eligible</span>
          </div>
          <div style="font-size: 8px; color: ${COLORS.gray500};">
            Negotiation: <strong style="color: ${COLORS.navy};">${pc.iraExposure.negotiationYear ?? 'TBD'}</strong>
            &nbsp;&bull;&nbsp;
            Expected Reduction: <strong style="color: ${COLORS.rose};">-${formatPercent(pc.iraExposure.expectedPriceReduction_pct * 100, 0)}</strong>
          </div>
        </div>
        <div class="chart-container">
          ${renderIraTimeline(pc.iraExposure.negotiationYear, pc.iraExposure.expectedPriceReduction_pct)}
        </div>
      </div>
      ` : ''}

      <!-- Payer Mix + Access Barriers row -->
      <div style="display: flex; gap: 10px; margin-bottom: 14px;">
        <!-- Payer Mix Donut -->
        <div style="flex: 1; border: 1px solid ${COLORS.gray200}; border-top: 3px solid ${COLORS.navy}; border-radius: 6px; padding: 14px; background: white;">
          <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 8px;">Payer Mix Distribution</div>
          <div style="display: flex; align-items: center; gap: 14px;">
            <div class="chart-container">
              ${renderPayerMixDonut(pc.payerMixImpact.commercialPct, pc.payerMixImpact.medicarePct, pc.payerMixImpact.medicaidPct, pc.payerMixImpact.managedCarePct)}
            </div>
            <div style="display: flex; flex-direction: column; gap: 6px;">
              ${[
                { label: 'Commercial', pct: pc.payerMixImpact.commercialPct, color: COLORS.teal },
                { label: 'Medicare', pct: pc.payerMixImpact.medicarePct, color: COLORS.blue },
                { label: 'Medicaid', pct: pc.payerMixImpact.medicaidPct, color: COLORS.amber },
                { label: 'Managed Care', pct: pc.payerMixImpact.managedCarePct, color: COLORS.purple },
              ].map(s => `
                <div style="display: flex; align-items: center; gap: 6px;">
                  <span style="width: 8px; height: 8px; border-radius: 2px; background: ${s.color}; flex-shrink: 0;"></span>
                  <span style="font-size: 8px; font-weight: 600; color: ${COLORS.gray600}; white-space: nowrap;">${s.label}</span>
                  <span style="font-size: 9px; font-weight: 800; color: ${COLORS.navy};">${formatPercent(s.pct * 100, 0)}</span>
                </div>
              `).join('')}
            </div>
          </div>
        </div>
        <!-- Access Barriers -->
        <div style="flex: 1; border: 1px solid ${COLORS.gray200}; border-top: 3px solid ${COLORS.rose}; border-radius: 6px; padding: 14px; background: white;">
          <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 8px;">Patient Access Barriers</div>
          ${pc.patientAccessBarriers.length > 0 ? `
            <div style="display: flex; flex-direction: column; gap: 5px;">
              ${pc.patientAccessBarriers.map(b => `
                <div style="display: flex; align-items: center; font-size: 9px; color: ${COLORS.gray600}; line-height: 1.4;">
                  ${barrierIcon()}
                  <span>${escapeHtml(b)}</span>
                </div>
              `).join('')}
            </div>
          ` : `
            <div style="font-size: 9px; color: ${COLORS.gray500}; line-height: 1.5;">No significant patient access barriers identified for this asset profile.</div>
          `}
        </div>
      </div>

      <!-- Narrative -->
      <div class="callout" style="margin-bottom: 10px;">
        ${escapeHtml(pc.narrative)}
      </div>

      <!-- Methodology -->
      <div class="disclaimer-box">
        <strong>Methodology:</strong> ICER thresholds calibrated to Value Assessment Framework 2020-2024 evidence reports and US payer WTP surveys. NICE recommendations modeled against Single Technology Appraisal outcomes (2018-2024, n=300+). IRA exposure per CMS Final Rule implementation timeline and CBO scoring. International reference pricing indices from IQVIA MIDAS database. Payer mix distributions derived from IQVIA National Sales Perspectives and CMS enrollment data.
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
