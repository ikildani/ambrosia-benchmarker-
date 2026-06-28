// Page: Patent / LOE Dynamics
// Patent timeline SVG, effective LOE headline, generic erosion curve,
// Paragraph IV risk indicator, authorized generic impact, and narrative.

import { formatPercent, pageHeader, pageFooter, COLORS, escapeHtml } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';

// SVG: Patent Timeline — horizontal stacked bar with extension segments + LOE marker
function renderPatentTimelineSVG(
  base: number, pta: number, pte: number, pediatric: number,
  orphan: number, nce: number, biologic: number, effectiveLOE: number,
): string {
  const w = 520, h = 110, padL = 40, padR = 20, barY = 36, barH = 28;
  const chartW = w - padL - padR;
  const totalSpan = Math.max(effectiveLOE * 1.15, base + pta + pte + pediatric + orphan + nce + biologic + 2, 22);
  const scaleX = (yr: number) => (yr / totalSpan) * chartW;
  const uid = `pt-${Math.random().toString(36).slice(2, 8)}`;
  const segments = [
    { label: 'Base Patent (20yr)', years: base, color: COLORS.navy },
    { label: 'PTA', years: pta, color: COLORS.teal },
    { label: 'PTE', years: pte, color: COLORS.cyan },
    { label: 'Pediatric', years: pediatric, color: COLORS.purple },
    { label: 'Orphan', years: orphan, color: COLORS.amber },
    { label: 'NCE', years: nce, color: COLORS.blue },
    { label: 'Biologic', years: biologic, color: COLORS.green },
  ].filter(s => s.years > 0);

  let offsetYears = 0;
  const parts: string[] = [];
  for (let yr = 0; yr <= Math.ceil(totalSpan); yr += 5) {
    const gx = padL + scaleX(yr);
    parts.push(`<line x1="${gx}" y1="${barY - 6}" x2="${gx}" y2="${barY + barH + 6}" stroke="${COLORS.gray200}" stroke-width="0.5" />`);
    parts.push(`<text x="${gx}" y="${barY + barH + 18}" text-anchor="middle" font-size="7" font-weight="600" fill="${COLORS.gray400}">${yr}yr</text>`);
  }
  segments.forEach((seg) => {
    const sx = padL + scaleX(offsetYears), sw = Math.max(scaleX(seg.years), 2);
    parts.push(`<rect x="${sx}" y="${barY}" width="${sw}" height="${barH}" rx="3" fill="${seg.color}" filter="url(#${uid}-shadow)" />`);
    if (sw > 24) parts.push(`<text x="${sx + sw / 2}" y="${barY + barH / 2 + 3}" text-anchor="middle" font-size="7" font-weight="700" fill="white">${seg.label}</text>`);
    offsetYears += seg.years;
  });
  const loeX = padL + scaleX(effectiveLOE);
  parts.push(`<line x1="${loeX}" y1="${barY - 10}" x2="${loeX}" y2="${barY + barH + 10}" stroke="${COLORS.rose}" stroke-width="2" stroke-dasharray="4,2" />`);
  parts.push(`<text x="${loeX}" y="${barY - 13}" text-anchor="middle" font-size="8" font-weight="800" fill="${COLORS.rose}">LOE ${effectiveLOE.toFixed(1)}yr</text>`);

  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
    <defs><filter id="${uid}-shadow" x="-4%" y="-4%" width="108%" height="112%"><feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.08" /></filter></defs>
    ${parts.join('')}
  </svg>`;
}

// SVG: Generic Erosion — 4-bar chart (year1, year2, year3, steady-state)
function renderErosionBarsSVG(y1: number, y2: number, y3: number, ss: number): string {
  const w = 520, h = 150, padL = 50, padR = 20, padTop = 20, padBot = 30;
  const chartH = h - padTop - padBot, chartW = w - padL - padR;
  const uid = `ge-${Math.random().toString(36).slice(2, 8)}`;
  const values = [
    { label: 'Year 1', value: y1 * 100, color: COLORS.amber },
    { label: 'Year 2', value: y2 * 100, color: COLORS.rose },
    { label: 'Year 3', value: y3 * 100, color: '#dc2626' },
    { label: 'Steady State', value: ss * 100, color: COLORS.navy },
  ];
  const maxVal = Math.max(...values.map(v => v.value), 100) * 1.1;
  const barGap = 24, barW = Math.min(72, (chartW - barGap * 3) / 4);
  const totalBarsW = 4 * barW + 3 * barGap;
  const offsetX = padL + (chartW - totalBarsW) / 2;
  const scaleY = (v: number) => padTop + ((maxVal - v) / maxVal) * chartH;
  const baseY = scaleY(0);
  const elems: string[] = [];
  for (let pct = 0; pct <= maxVal; pct += 20) {
    const gy = scaleY(pct);
    elems.push(`<line x1="${padL}" y1="${gy}" x2="${w - padR}" y2="${gy}" stroke="${COLORS.gray100}" stroke-width="0.5" />`);
    elems.push(`<text x="${padL - 4}" y="${gy + 3}" text-anchor="end" font-size="7" fill="${COLORS.gray300}">${pct}%</text>`);
  }
  values.forEach((v, i) => {
    const bx = offsetX + i * (barW + barGap), cx = bx + barW / 2;
    const topY = scaleY(v.value), bh = Math.max(baseY - topY, 2);
    elems.push(`<rect x="${bx}" y="${topY}" width="${barW}" height="${bh}" rx="3" fill="${v.color}" filter="url(#${uid}-shadow)" />`);
    elems.push(`<text x="${cx}" y="${topY - 5}" text-anchor="middle" font-size="9" font-weight="700" fill="${v.color}">${v.value.toFixed(0)}%</text>`);
    elems.push(`<text x="${cx}" y="${baseY + 14}" text-anchor="middle" font-size="8" font-weight="600" fill="${COLORS.gray600}">${v.label}</text>`);
  });
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
    <defs><filter id="${uid}-shadow" x="-4%" y="-4%" width="108%" height="112%"><feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.08" /></filter></defs>
    ${elems.join('')}
  </svg>`;
}

// Table row helper for exclusivity breakdown
function extRow(label: string, years: number, color: string, desc: string): string {
  if (years <= 0) return '';
  return `<tr>
    <td style="font-weight: 500;">${label}</td>
    <td style="text-align: right; font-weight: 700; color: ${color};">+${years.toFixed(1)}</td>
    <td style="font-size: 9px; color: ${COLORS.gray500};">${desc}</td>
  </tr>`;
}

export function renderPatentDynamicsPage(data: PDFReportData, meta: ReportMeta): string {
  if (!data.patentDynamics) return '';

  const pd = data.patentDynamics;
  const gp = pd.genericEntryProfile;
  const piv = pd.paragraphIVRisk;
  const pivColor = piv.probability >= 0.5 ? COLORS.rose : piv.probability >= 0.25 ? COLORS.amber : COLORS.teal;
  const pivLabel = piv.probability >= 0.5 ? 'High' : piv.probability >= 0.25 ? 'Moderate' : 'Low';
  const pivBg = piv.probability >= 0.5 ? COLORS.roseLight : piv.probability >= 0.25 ? COLORS.amberLight : COLORS.tealLight;
  const totalExt = pd.ptaAdjustment_years + pd.pteAdjustment_years + pd.pediatricExclusivity_years + pd.orphanExclusivity_years + pd.nceExclusivity_years + pd.biologicExclusivity_years;
  const yearValues = [pd.basePatentLife_years, pd.ptaAdjustment_years, pd.pteAdjustment_years, pd.pediatricExclusivity_years, pd.orphanExclusivity_years, pd.nceExclusivity_years, pd.biologicExclusivity_years];
  const legendItems = [
    { label: 'Base Patent', color: COLORS.navy }, { label: 'PTA', color: COLORS.teal },
    { label: 'PTE', color: COLORS.cyan }, { label: 'Pediatric', color: COLORS.purple },
    { label: 'Orphan', color: COLORS.amber }, { label: 'NCE', color: COLORS.blue },
    { label: 'Biologic', color: COLORS.green },
  ];

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, 'Deal Valuation Report')}

      <div class="section-title-lg">Patent &amp; LOE Dynamics</div>

      <!-- Effective LOE Headline KPI -->
      <div class="section-title">Effective Loss of Exclusivity</div>
      <div style="display: flex; gap: 10px; margin-bottom: 16px;">
        <div style="flex: 1; border: 1px solid ${COLORS.gray200}; border-top: 4px solid ${COLORS.navy}; border-radius: 6px; padding: 14px 16px; background: white;">
          <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 4px;">Effective LOE</div>
          <div style="font-size: 32px; font-weight: 800; color: ${COLORS.navy}; letter-spacing: -0.03em; line-height: 1;">${pd.effectiveLOE_yearsFromApproval.toFixed(1)}<span style="font-size: 14px; font-weight: 600; color: ${COLORS.gray400}; margin-left: 4px;">years from approval</span></div>
        </div>
        <div style="flex: 1; border: 1px solid ${COLORS.gray200}; border-top: 4px solid ${COLORS.teal}; border-radius: 6px; padding: 14px 16px; background: white;">
          <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 4px;">Base Patent Life</div>
          <div style="font-size: 22px; font-weight: 800; color: ${COLORS.teal}; letter-spacing: -0.02em; line-height: 1;">${pd.basePatentLife_years}<span style="font-size: 12px; font-weight: 600; color: ${COLORS.gray400}; margin-left: 4px;">years</span></div>
        </div>
        <div style="flex: 1; border: 1px solid ${COLORS.gray200}; border-top: 4px solid ${COLORS.purple}; border-radius: 6px; padding: 14px 16px; background: white;">
          <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 4px;">Total Extensions</div>
          <div style="font-size: 22px; font-weight: 800; color: ${COLORS.purple}; letter-spacing: -0.02em; line-height: 1;">+${totalExt.toFixed(1)}<span style="font-size: 12px; font-weight: 600; color: ${COLORS.gray400}; margin-left: 4px;">years</span></div>
        </div>
      </div>

      <!-- Patent Timeline SVG -->
      <div class="section-title">Patent &amp; Exclusivity Timeline</div>
      <div class="card" style="padding: 14px 16px; margin-bottom: 16px; border-top: 3px solid ${COLORS.navy};">
        <div class="chart-container">
          ${renderPatentTimelineSVG(pd.basePatentLife_years, pd.ptaAdjustment_years, pd.pteAdjustment_years, pd.pediatricExclusivity_years, pd.orphanExclusivity_years, pd.nceExclusivity_years, pd.biologicExclusivity_years, pd.effectiveLOE_yearsFromApproval)}
        </div>
        <div style="display: flex; flex-wrap: wrap; justify-content: center; gap: 12px; margin-top: 6px;">
          ${legendItems.filter((_, i) => yearValues[i] > 0).map(s => `<div style="display: flex; align-items: center; gap: 4px;"><span style="width: 8px; height: 8px; border-radius: 2px; background: ${s.color};"></span><span style="font-size: 7px; color: ${COLORS.gray400}; font-weight: 600;">${s.label}</span></div>`).join('')}
          <div style="display: flex; align-items: center; gap: 4px;"><span style="width: 12px; height: 2px; background: ${COLORS.rose}; border-radius: 1px;"></span><span style="font-size: 7px; color: ${COLORS.gray400}; font-weight: 600;">Effective LOE</span></div>
        </div>
      </div>

      <!-- Extension Breakdown Table -->
      <div class="section-title">Exclusivity Breakdown</div>
      <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 16px;">
        <table class="data-table">
          <thead><tr><th>Component</th><th style="text-align: right;">Duration (years)</th><th>Description</th></tr></thead>
          <tbody>
            <tr><td style="font-weight: 600;">Base Patent</td><td style="text-align: right; font-weight: 700; color: ${COLORS.navy};">${pd.basePatentLife_years}</td><td style="font-size: 9px; color: ${COLORS.gray500};">Standard 20-year utility patent from filing date</td></tr>
            ${extRow('Patent Term Adjustment', pd.ptaAdjustment_years, COLORS.teal, 'USPTO examination delay compensation')}
            ${extRow('Patent Term Extension', pd.pteAdjustment_years, COLORS.cyan, 'Hatch-Waxman regulatory review compensation (max 5yr)')}
            ${extRow('Pediatric Exclusivity', pd.pediatricExclusivity_years, COLORS.purple, 'FDA pediatric study completion (6-month standard)')}
            ${extRow('Orphan Drug Exclusivity', pd.orphanExclusivity_years, COLORS.amber, 'ODA market exclusivity for rare disease indication')}
            ${extRow('NCE Exclusivity', pd.nceExclusivity_years, COLORS.blue, 'New Chemical Entity data exclusivity')}
            ${extRow('Biologic Exclusivity', pd.biologicExclusivity_years, COLORS.green, 'BPCIA reference product exclusivity (12yr standard)')}
            <tr style="background: ${COLORS.gray50}; border-top: 2px solid ${COLORS.navy};"><td style="font-weight: 700;">Effective LOE</td><td style="text-align: right; font-weight: 700; color: #0f766e;">${pd.effectiveLOE_yearsFromApproval.toFixed(1)}</td><td style="font-size: 9px; color: ${COLORS.gray500};">Years from approval to loss of exclusivity</td></tr>
          </tbody>
        </table>
      </div>

      <!-- Generic Erosion Curve -->
      <div class="section-title">Post-LOE Generic Erosion Profile</div>
      <div class="card" style="padding: 14px 16px; margin-bottom: 16px; border-top: 3px solid ${COLORS.navy};">
        <div class="chart-container">
          ${renderErosionBarsSVG(gp.year1erosion, gp.year2erosion, gp.year3erosion, gp.steadyStateGenericShare)}
        </div>
      </div>

      <!-- Paragraph IV Risk + Authorized Generic -->
      <div class="section-title">Generic Entry Risk</div>
      <div style="display: flex; gap: 10px; margin-bottom: 14px;">
        <div style="flex: 1; border: 1px solid ${COLORS.gray200}; border-top: 4px solid ${pivColor}; border-radius: 6px; padding: 14px 16px; background: white;">
          <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 4px;">Paragraph IV Challenge Risk</div>
          <div style="display: flex; align-items: baseline; gap: 8px;">
            <span style="font-size: 26px; font-weight: 800; color: ${pivColor}; letter-spacing: -0.03em; line-height: 1;">${formatPercent(piv.probability * 100, 0)}</span>
            <span style="font-size: 10px; font-weight: 700; color: ${pivColor}; background: ${pivBg}; padding: 2px 8px; border-radius: 3px;">${pivLabel}</span>
          </div>
          <div style="margin-top: 8px; padding-top: 8px; border-top: 1px solid ${COLORS.gray200};">
            <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.1em; margin-bottom: 2px;">Expected Entry Timing</div>
            <div style="font-size: 14px; font-weight: 800; color: ${COLORS.navy};">${piv.expectedEntryTiming_years.toFixed(1)} <span style="font-size: 10px; font-weight: 600; color: ${COLORS.gray400};">years before LOE</span></div>
          </div>
        </div>
        <div style="flex: 1; border: 1px solid ${COLORS.gray200}; border-top: 4px solid ${COLORS.cyan}; border-radius: 6px; padding: 14px 16px; background: white;">
          <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 4px;">Authorized Generic Impact</div>
          <div style="font-size: 26px; font-weight: 800; color: ${COLORS.cyan}; letter-spacing: -0.03em; line-height: 1;">${formatPercent(pd.authorizedGenericImpact * 100, 0)}</div>
          <div style="font-size: 9px; color: ${COLORS.gray500}; margin-top: 6px; line-height: 1.5;">Revenue retained via authorized generic strategy relative to unmanaged LOE erosion.</div>
        </div>
      </div>

      <!-- Narrative -->
      <div class="callout">${escapeHtml(pd.narrative)}</div>

      <!-- Methodology note -->
      <div style="margin-top: 10px; font-size: 8px; color: ${COLORS.gray400}; line-height: 1.6;">
        <strong>Methodology:</strong> Patent term calculations follow USPTO/Hatch-Waxman statutory frameworks. Generic erosion curves calibrated to IMS Health/IQVIA post-LOE market share data (2015-2025, n=200+ small molecule LOE events). Paragraph IV risk modeled from historical ANDA filing rates by therapeutic area and patent portfolio complexity.
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
