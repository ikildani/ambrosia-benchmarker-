// Page: Royalty Stacking Analysis
// Waterfall SVG showing gross-to-net royalty cascade, obligations table,
// retention gauge, deal value impact callout, and analyst narrative.

import { formatPercent, pageHeader, pageFooter, COLORS, escapeHtml } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';

// ---------------------------------------------------------------------------
// SVG: Royalty Waterfall (gross -> obligations -> offset -> net)
// ---------------------------------------------------------------------------

function renderRoyaltyWaterfallSVG(
  grossRate: number,
  obligations: { source: string; rate: number; type: string }[],
  antiStackingOffset: number,
  netRate: number,
): string {
  const w = 520;
  const h = 220;
  const marginTop = 24;
  const marginBottom = 50;
  const marginLeft = 12;
  const marginRight = 12;
  const chartW = w - marginLeft - marginRight;

  const uid = `rs-${Math.random().toString(36).slice(2, 8)}`;

  // Build bar data: gross, each obligation (negative), anti-stacking (positive), net
  type BarEntry = { label: string; value: number; running: number; kind: 'start' | 'neg' | 'pos' | 'end' };
  const bars: BarEntry[] = [];
  let running = grossRate;
  bars.push({ label: 'Gross Royalty', value: grossRate, running, kind: 'start' });

  for (const ob of obligations) {
    running -= ob.rate;
    bars.push({ label: ob.source.length > 16 ? ob.source.substring(0, 14) + '..' : ob.source, value: -ob.rate, running, kind: 'neg' });
  }

  if (antiStackingOffset > 0) {
    running += antiStackingOffset;
    bars.push({ label: 'Anti-Stacking', value: antiStackingOffset, running, kind: 'pos' });
  }

  bars.push({ label: 'Net Royalty', value: netRate, running: netRate, kind: 'end' });

  const barCount = bars.length;
  const barGap = 6;
  const barW = Math.min(64, (chartW - barGap * (barCount - 1)) / barCount);
  const totalBarsW = barCount * barW + (barCount - 1) * barGap;
  const offsetX = marginLeft + (chartW - totalBarsW) / 2;

  // Scale
  const allVals = bars.map(b => b.running);
  allVals.push(0);
  const maxVal = Math.max(...allVals) * 1.20;
  const minVal = Math.min(...allVals, 0);
  const range = maxVal - minVal || 0.01;
  const chartH = h - marginTop - marginBottom;
  const scaleY = (v: number) => marginTop + ((maxVal - v) / range) * chartH;
  const baselineY = scaleY(0);

  const parts: string[] = [];

  // Gridlines
  const gridSteps = 4;
  for (let i = 0; i <= gridSteps; i++) {
    const val = minVal + (i / gridSteps) * range;
    const gy = scaleY(val);
    parts.push(`<line x1="${marginLeft}" y1="${gy}" x2="${w - marginRight}" y2="${gy}" stroke="${COLORS.gray100}" stroke-width="0.5" />`);
    parts.push(`<text x="${marginLeft - 2}" y="${gy + 3}" text-anchor="end" font-size="7" fill="${COLORS.gray300}">${(val * 100).toFixed(1)}%</text>`);
  }

  let prevRunning = 0;

  bars.forEach((bar, i) => {
    const cx = offsetX + i * (barW + barGap) + barW / 2;
    const x = offsetX + i * (barW + barGap);
    const isStart = bar.kind === 'start';
    const isEnd = bar.kind === 'end';

    if (isStart || isEnd) {
      const topY = scaleY(bar.running);
      const botY = baselineY;
      const barH = Math.max(Math.abs(botY - topY), 2);
      const yPos = Math.min(topY, botY);
      const gradId = isStart ? `url(#${uid}-base)` : `url(#${uid}-final)`;
      const labelColor = isEnd ? '#0f766e' : COLORS.gray600;

      parts.push(`
        <rect x="${x}" y="${yPos}" width="${barW}" height="${barH}" rx="3" fill="${gradId}" filter="url(#${uid}-shadow)" />
        <text x="${cx}" y="${yPos - 5}" text-anchor="middle" font-size="9" font-weight="700" fill="${labelColor}">${(bar.running * 100).toFixed(1)}%</text>
      `);
    } else {
      const isPositive = bar.value >= 0;
      const topY = scaleY(Math.max(prevRunning, bar.running));
      const botY = scaleY(Math.min(prevRunning, bar.running));
      const barH = Math.max(Math.abs(botY - topY), 2);
      const gradId = isPositive ? `url(#${uid}-teal)` : `url(#${uid}-rose)`;

      // Connector
      const prevX = offsetX + (i - 1) * (barW + barGap) + barW;
      const connY = scaleY(prevRunning);
      parts.push(`<line x1="${prevX}" y1="${connY}" x2="${x}" y2="${connY}" stroke="${COLORS.gray300}" stroke-width="1" stroke-dasharray="3,2" />`);

      const sign = isPositive ? '+' : '';
      parts.push(`
        <rect x="${x}" y="${topY}" width="${barW}" height="${barH}" rx="3" fill="${gradId}" filter="url(#${uid}-shadow)" />
        <text x="${cx}" y="${topY - 5}" text-anchor="middle" font-size="8" font-weight="700" fill="${isPositive ? COLORS.teal : COLORS.rose}">${sign}${(bar.value * 100).toFixed(1)}%</text>
      `);
    }

    // Bottom label
    const labelY = h - marginBottom + 14;
    parts.push(`<text x="${cx}" y="${labelY}" text-anchor="middle" font-size="8" font-weight="600" fill="${COLORS.gray600}" transform="rotate(-25, ${cx}, ${labelY})">${escapeHtml(bar.label)}</text>`);

    prevRunning = bar.running;
  });

  return `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="${uid}-base" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#64748b" />
          <stop offset="100%" stop-color="#94a3b8" />
        </linearGradient>
        <linearGradient id="${uid}-final" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0f766e" />
          <stop offset="100%" stop-color="#0d9488" />
        </linearGradient>
        <linearGradient id="${uid}-teal" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="#0d9488" />
          <stop offset="100%" stop-color="#06b6d4" />
        </linearGradient>
        <linearGradient id="${uid}-rose" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stop-color="${COLORS.rose}" />
          <stop offset="100%" stop-color="#fb7185" />
        </linearGradient>
        <filter id="${uid}-shadow" x="-4%" y="-4%" width="108%" height="112%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.08" />
        </filter>
      </defs>
      <line x1="${marginLeft}" y1="${baselineY}" x2="${w - marginRight}" y2="${baselineY}" stroke="${COLORS.gray200}" stroke-width="1" />
      ${parts.join('')}
    </svg>
  `;
}

// ---------------------------------------------------------------------------
// SVG: Retention Gauge (semicircle 0-100%)
// ---------------------------------------------------------------------------

function renderRetentionGauge(retention: number): string {
  const w = 200;
  const h = 120;
  const cx = w / 2;
  const cy = 100;
  const r = 72;
  const uid = `rg-${Math.random().toString(36).slice(2, 8)}`;

  const pct = Math.min(retention * 100, 100);
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

  const valueColor = pct >= 70 ? COLORS.green : pct >= 50 ? COLORS.amber : COLORS.rose;

  return `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="${uid}-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.08" />
        </filter>
      </defs>
      <path d="${arcPath(0, 100)}" fill="none" stroke="${COLORS.gray100}" stroke-width="16" stroke-linecap="round" />
      <path d="${arcPath(0, 40)}" fill="none" stroke="${COLORS.rose}" stroke-width="14" stroke-linecap="butt" opacity="0.3" />
      <path d="${arcPath(40, 70)}" fill="none" stroke="${COLORS.amber}" stroke-width="14" stroke-linecap="butt" opacity="0.3" />
      <path d="${arcPath(70, 100)}" fill="none" stroke="${COLORS.green}" stroke-width="14" stroke-linecap="butt" opacity="0.3" />
      <line x1="${cx}" y1="${cy}" x2="${needleX}" y2="${needleY}" stroke="${valueColor}" stroke-width="2.5" stroke-linecap="round" filter="url(#${uid}-shadow)" />
      <circle cx="${cx}" cy="${cy}" r="5" fill="${valueColor}" />
      <text x="${cx}" y="${cy - 18}" text-anchor="middle" font-size="20" font-weight="800" fill="${valueColor}" letter-spacing="-0.03em">${formatPercent(pct, 1)}</text>
      <text x="${cx}" y="${cy - 6}" text-anchor="middle" font-size="7" font-weight="700" fill="${COLORS.gray400}" letter-spacing="0.12em">ROYALTY RETAINED</text>
      <text x="${cx - r - 4}" y="${cy + 10}" text-anchor="middle" font-size="7" fill="${COLORS.gray400}">0%</text>
      <text x="${cx}" y="${cy - r - 6}" text-anchor="middle" font-size="7" fill="${COLORS.gray400}">50%</text>
      <text x="${cx + r + 4}" y="${cy + 10}" text-anchor="middle" font-size="7" fill="${COLORS.gray400}">100%</text>
    </svg>
  `;
}

// ---------------------------------------------------------------------------
// Main Page Export
// ---------------------------------------------------------------------------

export function renderRoyaltyStackingPage(data: PDFReportData, meta: ReportMeta): string {
  if (!data.royaltyStacking) return '';

  const rs = data.royaltyStacking;

  // Derive gross royalty rate: net + adjustedBurden, where adjustedBurden = totalUpstreamBurden - antiStackingOffset
  const adjustedBurden = rs.totalUpstreamBurden - rs.antiStackingOffset;
  const grossRate = rs.netRoyaltyRate + adjustedBurden;

  const retentionLevel = rs.effectiveRetention >= 0.70 ? 'Strong' : rs.effectiveRetention >= 0.50 ? 'Moderate' : 'Weak';
  const retentionColor = rs.effectiveRetention >= 0.70 ? COLORS.green : rs.effectiveRetention >= 0.50 ? COLORS.amber : COLORS.rose;

  const impactColor = rs.impactOnDealValue_pct <= 0.05 ? COLORS.amber : COLORS.rose;

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, 'Deal Valuation Report')}

      <div class="section-title-lg">Royalty Stacking Analysis</div>

      <!-- Waterfall Chart -->
      <div class="section-title">Gross-to-Net Royalty Cascade</div>
      <div class="card" style="padding: 14px 16px; margin-bottom: 14px; border-top: 3px solid ${COLORS.navy};">
        <div class="chart-container">
          ${renderRoyaltyWaterfallSVG(grossRate, rs.stackedObligations, rs.antiStackingOffset, rs.netRoyaltyRate)}
        </div>
      </div>

      <!-- Top metrics row: Gross, Net, Retention Gauge -->
      <div style="display: flex; gap: 10px; margin-bottom: 14px;">
        <div style="flex: 1; border: 1px solid ${COLORS.gray200}; border-top: 3px solid ${COLORS.navy}; border-radius: 6px; padding: 14px 14px; background: white;">
          <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 6px;">Gross Royalty</div>
          <div style="font-size: 22px; font-weight: 800; color: ${COLORS.navy}; letter-spacing: -0.03em; line-height: 1;">${formatPercent(grossRate * 100, 1)}</div>
          <div style="font-size: 8px; color: ${COLORS.gray500}; margin-top: 4px;">Contractual rate</div>
        </div>
        <div style="flex: 1; border: 1px solid ${COLORS.gray200}; border-top: 3px solid ${COLORS.teal}; border-radius: 6px; padding: 14px 14px; background: white;">
          <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 6px;">Net Royalty</div>
          <div style="font-size: 22px; font-weight: 800; color: #0f766e; letter-spacing: -0.03em; line-height: 1;">${formatPercent(rs.netRoyaltyRate * 100, 1)}</div>
          <div style="font-size: 8px; color: ${COLORS.gray500}; margin-top: 4px;">After stacking</div>
        </div>
        <div style="flex: 1.2; border: 1px solid ${COLORS.gray200}; border-top: 3px solid ${retentionColor}; border-radius: 6px; padding: 10px 14px; background: white; text-align: center;">
          <div class="chart-container">
            ${renderRetentionGauge(rs.effectiveRetention)}
          </div>
          <span style="font-size: 8px; font-weight: 700; color: ${retentionColor}; background: ${retentionColor}15; padding: 2px 10px; border-radius: 3px;">${retentionLevel} Retention</span>
        </div>
      </div>

      <!-- Upstream Obligations Table -->
      <div class="section-title">Upstream IP Obligations</div>
      <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 14px;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Source</th>
              <th style="text-align: right;">Rate</th>
              <th>IP Type</th>
            </tr>
          </thead>
          <tbody>
            ${rs.stackedObligations.map((ob, i) => `
              <tr${i === rs.stackedObligations.length - 1 ? ` style="border-bottom: none;"` : ''}>
                <td style="font-weight: 600; color: ${COLORS.navy};">${escapeHtml(ob.source)}</td>
                <td style="text-align: right; font-weight: 700; color: ${COLORS.rose};">-${formatPercent(ob.rate * 100, 2)}</td>
                <td style="font-size: 9px; color: ${COLORS.gray500}; text-transform: capitalize;">${escapeHtml(ob.type)}</td>
              </tr>
            `).join('')}
            <tr style="background: ${COLORS.gray50}; border-top: 2px solid ${COLORS.navy};">
              <td style="font-weight: 700;">Total Upstream Burden</td>
              <td style="text-align: right; font-weight: 700; color: ${COLORS.rose};">-${formatPercent(rs.totalUpstreamBurden * 100, 2)}</td>
              <td style="font-size: 9px; color: ${COLORS.gray500};">${rs.antiStackingOffset > 0 ? `Offset: +${formatPercent(rs.antiStackingOffset * 100, 2)}` : 'No offset'}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Deal Value Impact Callout -->
      <div style="background: linear-gradient(145deg, ${COLORS.navy} 0%, #252a5e 100%); border-radius: 6px; padding: 14px 20px; color: white; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 7px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.16em; font-weight: 700; margin-bottom: 3px;">Deal Value Impact</div>
          <div style="font-size: 9px; color: rgba(255,255,255,0.55); line-height: 1.4;">Royalty erosion reduces effective deal value. Stacking burden of ${formatPercent(adjustedBurden * 100, 1)}pp on gross royalty translates to an estimated reduction in total deal economics.</div>
        </div>
        <div style="text-align: right; flex-shrink: 0; margin-left: 20px;">
          <div style="font-size: 24px; font-weight: 800; color: ${impactColor}; letter-spacing: -0.03em; line-height: 1;">-${formatPercent(rs.impactOnDealValue_pct * 100, 1)}</div>
          <div style="font-size: 7px; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 0.1em; margin-top: 3px;">Est. Value Reduction</div>
        </div>
      </div>

      <!-- Narrative -->
      <div class="callout" style="margin-bottom: 10px;">
        ${escapeHtml(rs.narrative)}
      </div>

      <!-- Methodology -->
      <div class="disclaimer-box">
        <strong>Methodology:</strong> Upstream IP obligations sourced from platform license terms and patent pool disclosures. Anti-stacking provisions modeled per contractual language (floor, cap, or pro-rata). Retention impact on deal value estimated at ~50% royalty share of total deal economics, consistent with DealForma pharmaceutical licensing database (2018-2025). Rates shown are post-provision adjusted figures.
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
