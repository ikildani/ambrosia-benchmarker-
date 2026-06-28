// Page: FDA Regulatory Risk Analysis
// Semicircle CRL gauge, PDUFA timing distribution, AdComm assessment,
// PRV callout, accelerated approval risk, timeline impact, and narrative.

import { formatPercent, formatUsd, pageHeader, pageFooter, COLORS, escapeHtml } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';

// ---------------------------------------------------------------------------
// SVG: CRL Probability Gauge (semicircle 0-50% range)
// ---------------------------------------------------------------------------

function renderCrlGauge(crlProbability: number): string {
  const w = 200;
  const h = 120;
  const cx = w / 2;
  const cy = 100;
  const r = 72;
  const uid = `crl-${Math.random().toString(36).slice(2, 8)}`;

  // Map 0-50% to 180-degree arc (left to right)
  const pct = Math.min(crlProbability * 100, 50);
  const angle = (pct / 50) * 180;
  const needleRad = ((180 - angle) * Math.PI) / 180;
  const needleX = cx + r * 0.82 * Math.cos(needleRad);
  const needleY = cy - r * 0.82 * Math.sin(needleRad);

  // Zone boundaries: green <10%, amber 10-20%, red >20%
  // Arc path helper: angles measured from left (180deg) to right (0deg)
  const arcPath = (startPct: number, endPct: number): string => {
    const s = ((180 - (startPct / 50) * 180) * Math.PI) / 180;
    const e = ((180 - (endPct / 50) * 180) * Math.PI) / 180;
    const x1 = cx + r * Math.cos(s);
    const y1 = cy - r * Math.sin(s);
    const x2 = cx + r * Math.cos(e);
    const y2 = cy - r * Math.sin(e);
    const largeArc = Math.abs(endPct - startPct) > 25 ? 1 : 0;
    return `M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`;
  };

  // Color for the value text
  const valueColor = pct < 10 ? COLORS.green : pct < 20 ? COLORS.amber : COLORS.rose;

  return `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="${uid}-shadow" x="-10%" y="-10%" width="120%" height="120%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.08" />
        </filter>
      </defs>
      <!-- Track background -->
      <path d="${arcPath(0, 50)}" fill="none" stroke="${COLORS.gray100}" stroke-width="16" stroke-linecap="round" />
      <!-- Green zone: 0-10% -->
      <path d="${arcPath(0, 10)}" fill="none" stroke="${COLORS.green}" stroke-width="14" stroke-linecap="butt" opacity="0.3" />
      <!-- Amber zone: 10-20% -->
      <path d="${arcPath(10, 20)}" fill="none" stroke="${COLORS.amber}" stroke-width="14" stroke-linecap="butt" opacity="0.3" />
      <!-- Red zone: 20-50% -->
      <path d="${arcPath(20, 50)}" fill="none" stroke="${COLORS.rose}" stroke-width="14" stroke-linecap="butt" opacity="0.3" />
      <!-- Needle -->
      <line x1="${cx}" y1="${cy}" x2="${needleX}" y2="${needleY}" stroke="${valueColor}" stroke-width="2.5" stroke-linecap="round" filter="url(#${uid}-shadow)" />
      <circle cx="${cx}" cy="${cy}" r="5" fill="${valueColor}" />
      <!-- Value label -->
      <text x="${cx}" y="${cy - 18}" text-anchor="middle" font-size="20" font-weight="800" fill="${valueColor}" letter-spacing="-0.03em">${formatPercent(crlProbability * 100, 1)}</text>
      <text x="${cx}" y="${cy - 6}" text-anchor="middle" font-size="7" font-weight="700" fill="${COLORS.gray400}" letter-spacing="0.12em" text-transform="uppercase">CRL PROBABILITY</text>
      <!-- Scale labels -->
      <text x="${cx - r - 4}" y="${cy + 10}" text-anchor="middle" font-size="7" fill="${COLORS.gray400}">0%</text>
      <text x="${cx}" y="${cy - r - 6}" text-anchor="middle" font-size="7" fill="${COLORS.gray400}">25%</text>
      <text x="${cx + r + 4}" y="${cy + 10}" text-anchor="middle" font-size="7" fill="${COLORS.gray400}">50%</text>
    </svg>
  `;
}

// ---------------------------------------------------------------------------
// SVG: PDUFA Timing Distribution (3-segment horizontal bar)
// ---------------------------------------------------------------------------

function renderPdufaBar(onTime: number, delay3mo: number, delay6mo: number): string {
  const w = 440;
  const h = 50;
  const barY = 10;
  const barH = 18;
  const padX = 10;
  const barW = w - 2 * padX;
  const uid = `pdufa-${Math.random().toString(36).slice(2, 8)}`;

  const onTimeW = barW * onTime;
  const delay3W = barW * delay3mo;
  const delay6W = barW * delay6mo;

  const onTimeX = padX;
  const delay3X = onTimeX + onTimeW;
  const delay6X = delay3X + delay3W;

  return `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="${uid}-shadow" x="-4%" y="-4%" width="108%" height="112%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.08" />
        </filter>
      </defs>
      <!-- On Time (green) -->
      <rect x="${onTimeX}" y="${barY}" width="${Math.max(onTimeW, 1)}" height="${barH}" rx="${onTimeW > 4 ? 3 : 0}" fill="${COLORS.green}" opacity="0.85" filter="url(#${uid}-shadow)" />
      ${onTimeW > 30 ? `<text x="${onTimeX + onTimeW / 2}" y="${barY + barH / 2 + 3}" text-anchor="middle" font-size="8" font-weight="700" fill="white">${formatPercent(onTime * 100, 0)}</text>` : ''}
      <!-- 3-Month Delay (amber) -->
      <rect x="${delay3X}" y="${barY}" width="${Math.max(delay3W, 1)}" height="${barH}" fill="${COLORS.amber}" opacity="0.85" filter="url(#${uid}-shadow)" />
      ${delay3W > 25 ? `<text x="${delay3X + delay3W / 2}" y="${barY + barH / 2 + 3}" text-anchor="middle" font-size="8" font-weight="700" fill="white">${formatPercent(delay3mo * 100, 0)}</text>` : ''}
      <!-- 6-Month Delay (red) -->
      <rect x="${delay6X}" y="${barY}" width="${Math.max(delay6W, 1)}" height="${barH}" rx="${delay6W > 4 ? 3 : 0}" fill="${COLORS.rose}" opacity="0.85" filter="url(#${uid}-shadow)" />
      ${delay6W > 25 ? `<text x="${delay6X + delay6W / 2}" y="${barY + barH / 2 + 3}" text-anchor="middle" font-size="8" font-weight="700" fill="white">${formatPercent(delay6mo * 100, 0)}</text>` : ''}
      <!-- Legend -->
      <circle cx="${padX + 4}" cy="${barY + barH + 14}" r="4" fill="${COLORS.green}" />
      <text x="${padX + 12}" y="${barY + barH + 17}" font-size="7" font-weight="600" fill="${COLORS.gray500}">On Time (${formatPercent(onTime * 100, 0)})</text>
      <circle cx="${padX + 104}" cy="${barY + barH + 14}" r="4" fill="${COLORS.amber}" />
      <text x="${padX + 112}" y="${barY + barH + 17}" font-size="7" font-weight="600" fill="${COLORS.gray500}">3-Mo Delay (${formatPercent(delay3mo * 100, 0)})</text>
      <circle cx="${padX + 220}" cy="${barY + barH + 14}" r="4" fill="${COLORS.rose}" />
      <text x="${padX + 228}" y="${barY + barH + 17}" font-size="7" font-weight="600" fill="${COLORS.gray500}">6-Mo Delay (${formatPercent(delay6mo * 100, 0)})</text>
    </svg>
  `;
}

// ---------------------------------------------------------------------------
// SVG: AdComm Favorable Vote Probability Bar
// ---------------------------------------------------------------------------

function renderAdcommBar(probability: number): string {
  const w = 300;
  const h = 28;
  const barW = 260;
  const barH = 12;
  const padX = 20;
  const barY = (h - barH) / 2;
  const fillW = barW * probability;

  const color = probability >= 0.70 ? COLORS.green : probability >= 0.50 ? COLORS.amber : COLORS.rose;

  return `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <rect x="${padX}" y="${barY}" width="${barW}" height="${barH}" rx="6" fill="${COLORS.gray100}" />
      <rect x="${padX}" y="${barY}" width="${Math.max(fillW, 2)}" height="${barH}" rx="6" fill="${color}" opacity="0.85" />
      <text x="${padX + fillW + 6}" y="${barY + barH / 2 + 3}" font-size="9" font-weight="700" fill="${color}">${formatPercent(probability * 100, 0)}</text>
    </svg>
  `;
}

// ---------------------------------------------------------------------------
// Main Page Export
// ---------------------------------------------------------------------------

export function renderRegulatoryRiskPage(data: PDFReportData, meta: ReportMeta): string {
  if (!data.regulatoryRisk) return '';

  const rr = data.regulatoryRisk;

  // Timeline impact color and direction
  const timelineIsDelay = rr.timelineImpact_years > 0;
  const timelineColor = timelineIsDelay ? COLORS.rose : COLORS.green;
  const timelineMonths = Math.abs(rr.timelineImpact_years * 12).toFixed(0);
  const timelineLabel = timelineIsDelay ? 'Delay' : 'Acceleration';
  const timelineSign = timelineIsDelay ? '+' : '-';

  // CRL risk level label
  const crlLevel = rr.crlProbability < 0.10 ? 'Low' : rr.crlProbability < 0.20 ? 'Moderate' : 'Elevated';
  const crlColor = rr.crlProbability < 0.10 ? COLORS.green : rr.crlProbability < 0.20 ? COLORS.amber : COLORS.rose;

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, 'Deal Valuation Report')}

      <div class="section-title-lg">FDA Regulatory Risk Analysis</div>

      <!-- Top row: CRL Gauge + Timeline Impact + Risk Level -->
      <div style="display: flex; gap: 10px; margin-bottom: 14px;">
        <!-- CRL Probability Gauge -->
        <div style="flex: 1.2; border: 1px solid ${COLORS.gray200}; border-top: 3px solid ${COLORS.navy}; border-radius: 6px; padding: 12px 14px; background: white; text-align: center;">
          <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 6px;">Complete Response Letter Risk</div>
          <div class="chart-container">
            ${renderCrlGauge(rr.crlProbability)}
          </div>
          <div style="margin-top: 4px;">
            <span style="font-size: 8px; font-weight: 700; color: ${crlColor}; background: ${crlColor}15; padding: 2px 10px; border-radius: 3px;">${crlLevel} Risk</span>
          </div>
        </div>
        <!-- Timeline Impact -->
        <div style="flex: 1; border: 1px solid ${COLORS.gray200}; border-top: 3px solid ${timelineColor}; border-radius: 6px; padding: 16px 14px; background: white; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 6px;">
          <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em;">Net Timeline Impact</div>
          <div style="font-size: 28px; font-weight: 800; color: ${timelineColor}; letter-spacing: -0.03em; line-height: 1;">${timelineSign}${timelineMonths}mo</div>
          <span style="font-size: 8px; font-weight: 700; color: ${timelineColor}; background: ${timelineColor}15; padding: 2px 10px; border-radius: 3px;">${timelineLabel}</span>
          <div style="font-size: 8px; color: ${COLORS.gray500}; margin-top: 2px;">${rr.timelineImpact_years > 0 ? 'Regulatory delays net of designations' : 'Expedited designations net of delays'}</div>
        </div>
        <!-- PDUFA On-Time -->
        <div style="flex: 0.8; border: 1px solid ${COLORS.gray200}; border-top: 3px solid ${COLORS.teal}; border-radius: 6px; padding: 16px 14px; background: white; display: flex; flex-direction: column; justify-content: center; align-items: center; gap: 6px;">
          <div style="font-size: 7px; font-weight: 700; color: ${COLORS.gray400}; text-transform: uppercase; letter-spacing: 0.12em;">PDUFA On-Time</div>
          <div style="font-size: 28px; font-weight: 800; color: ${COLORS.teal}; letter-spacing: -0.03em; line-height: 1;">${formatPercent(rr.pdufahRisk.onTime * 100, 0)}</div>
          <div style="font-size: 8px; color: ${COLORS.gray500};">FDA action by target date</div>
        </div>
      </div>

      <!-- PDUFA Timing Distribution -->
      <div class="section-title">PDUFA Timing Distribution</div>
      <div class="card" style="padding: 12px 16px; margin-bottom: 14px; border-top: 3px solid ${COLORS.navy};">
        <div class="chart-container">
          ${renderPdufaBar(rr.pdufahRisk.onTime, rr.pdufahRisk.delay3mo, rr.pdufahRisk.delay6mo)}
        </div>
      </div>

      <!-- AdComm Section -->
      <div class="section-title">Advisory Committee Assessment</div>
      <div class="card" style="padding: 14px 16px; margin-bottom: 14px; border-top: 3px solid ${COLORS.navy};">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 9px; font-weight: 600; color: ${COLORS.gray600};">AdComm Convening:</span>
            <span style="font-size: 9px; font-weight: 800; color: ${rr.adcommRequired ? COLORS.amber : COLORS.green}; background: ${rr.adcommRequired ? COLORS.amberLight : COLORS.greenLight}; padding: 3px 12px; border-radius: 4px;">${rr.adcommRequired ? 'Likely Required' : 'Unlikely'}</span>
          </div>
          ${rr.adcommRequired ? `
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="font-size: 8px; font-weight: 600; color: ${COLORS.gray500};">Favorable Vote:</span>
            <span style="font-size: 11px; font-weight: 800; color: ${COLORS.navy};">${formatPercent(rr.adcommFavorableVoteProbability * 100, 0)}</span>
          </div>
          ` : ''}
        </div>
        ${rr.adcommRequired ? `
        <div style="margin-top: 4px;">
          ${renderAdcommBar(rr.adcommFavorableVoteProbability)}
        </div>
        ` : `
        <div style="font-size: 9px; color: ${COLORS.gray500}; line-height: 1.5;">
          Based on therapeutic area precedent and mechanism class, FDA is unlikely to convene an advisory committee for this asset profile.
        </div>
        `}
      </div>

      <!-- PRV Callout (if eligible) -->
      ${rr.prvEligible ? `
      <div style="background: linear-gradient(145deg, ${COLORS.navy} 0%, #252a5e 100%); border-radius: 6px; padding: 14px 20px; color: white; margin-bottom: 14px; display: flex; justify-content: space-between; align-items: center;">
        <div>
          <div style="font-size: 7px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.16em; font-weight: 700; margin-bottom: 3px;">Priority Review Voucher</div>
          <div style="font-size: 9px; color: rgba(255,255,255,0.55); line-height: 1.4;">Eligible under FDA rare pediatric / tropical disease PRV program. Voucher may be used or sold to a third party.</div>
        </div>
        <div style="text-align: right; flex-shrink: 0; margin-left: 20px;">
          <div style="font-size: 24px; font-weight: 800; color: ${COLORS.tealMid}; letter-spacing: -0.03em; line-height: 1;">${formatUsd(rr.prvValue_M)}</div>
          <div style="font-size: 7px; color: rgba(255,255,255,0.35); text-transform: uppercase; letter-spacing: 0.1em; margin-top: 3px;">Est. Voucher Value</div>
        </div>
      </div>
      ` : ''}

      <!-- Accelerated Approval Risk (if eligible) -->
      ${rr.acceleratedApprovalRisk.eligible ? `
      <div class="section-title">Accelerated Approval Risk</div>
      <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 14px;">
        <table class="data-table">
          <thead>
            <tr>
              <th>Risk Factor</th>
              <th style="text-align: right;">Probability</th>
              <th>Implication</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td style="font-weight: 600; color: ${COLORS.navy};">Confirmatory Trial Failure</td>
              <td style="text-align: right; font-weight: 700; color: ${rr.acceleratedApprovalRisk.confirmatoryFailureProbability > 0.20 ? COLORS.rose : COLORS.amber};">${formatPercent(rr.acceleratedApprovalRisk.confirmatoryFailureProbability * 100, 0)}</td>
              <td style="font-size: 9px; color: ${COLORS.gray500};">Post-approval confirmatory study fails to verify clinical benefit</td>
            </tr>
            <tr style="background: ${COLORS.gray50}; border-top: 2px solid ${COLORS.navy};">
              <td style="font-weight: 600; color: ${COLORS.navy};">Market Withdrawal</td>
              <td style="text-align: right; font-weight: 700; color: ${COLORS.rose};">${formatPercent(rr.acceleratedApprovalRisk.withdrawalProbability * 100, 0)}</td>
              <td style="font-size: 9px; color: ${COLORS.gray500};">FDA-mandated withdrawal post-AADCA 2023 enforcement authority</td>
            </tr>
          </tbody>
        </table>
      </div>
      ` : ''}

      <!-- Narrative -->
      <div class="callout" style="margin-bottom: 10px;">
        ${escapeHtml(rr.narrative)}
      </div>

      <!-- Methodology -->
      <div class="disclaimer-box">
        <strong>Methodology:</strong> CRL base rates derived from FDA CDER action letters 2015-2024 by therapeutic division. AdComm convening patterns based on FDA public advisory committee calendar 2015-2024 (n=200+ meetings). PDUFA timing distribution from CDER PDUFA VII compliance data. PRV valuations from BioCentury PRV Tracker transaction database. Accelerated approval risk calibrated to GAO-22-105951 and post-AADCA 2023 enforcement statistics.
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
