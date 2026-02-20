// SVG tornado/butterfly chart for sensitivity analysis
// Shows parameter impact as horizontal bars extending left (negative) and right (positive)
// Returns pure SVG string — no React, no DOM

import { COLORS, formatUsd } from '../helpers';
import type { ParameterSensitivity } from '@/lib/sensitivity';

export function renderTornado(
  parameters: ParameterSensitivity[],
  width: number = 680,
  height: number = 340
): string {
  // Sort by impact range (highest first), take top 8
  const sorted = [...parameters]
    .sort((a, b) => b.impactRange - a.impactRange)
    .slice(0, 8);

  if (sorted.length === 0) {
    return `<svg width="${width}" height="60" viewBox="0 0 ${width} 60" xmlns="http://www.w3.org/2000/svg">
      <text x="${width / 2}" y="30" text-anchor="middle" font-size="12" fill="${COLORS.gray400}">No sensitivity data available</text>
    </svg>`;
  }

  const marginLeft = 150;
  const marginRight = 80;
  const marginTop = 20;
  const marginBottom = 30;
  const barGap = 8;
  const barCount = sorted.length;
  const barH = Math.min(30, (height - marginTop - marginBottom - barGap * (barCount - 1)) / barCount);
  const chartH = barCount * (barH + barGap);
  const chartW = width - marginLeft - marginRight;
  const centerX = marginLeft + chartW / 2;

  // Find max absolute delta for symmetric scale
  const maxDelta = Math.max(
    ...sorted.map(p => Math.max(Math.abs(p.maxPositiveDelta), Math.abs(p.maxNegativeDelta)))
  );
  const scaleHalf = chartW / 2;

  const scaleDelta = (delta: number) => (delta / maxDelta) * scaleHalf;

  const bars: string[] = [];

  sorted.forEach((param, i) => {
    const y = marginTop + i * (barH + barGap);

    // Label
    const label = param.label.length > 24 ? param.label.substring(0, 22) + '...' : param.label;
    bars.push(`
      <text x="${marginLeft - 8}" y="${y + barH / 2 + 3}" text-anchor="end" font-size="10" font-weight="500" fill="${COLORS.gray700}">${label}</text>
    `);

    // Negative bar (left from center)
    if (param.maxNegativeDelta < 0) {
      const negW = scaleDelta(Math.abs(param.maxNegativeDelta));
      bars.push(`
        <rect x="${centerX - negW}" y="${y}" width="${negW}" height="${barH}" rx="3" fill="url(#tnNavyGrad)" filter="url(#tnShadow)" />
        <text x="${centerX - negW - 4}" y="${y + barH / 2 + 3}" text-anchor="end" font-size="10" fill="${COLORS.navy}" font-weight="500">${formatUsd(param.maxNegativeDelta)}</text>
      `);
    }

    // Positive bar (right from center)
    if (param.maxPositiveDelta > 0) {
      const posW = scaleDelta(param.maxPositiveDelta);
      bars.push(`
        <rect x="${centerX}" y="${y}" width="${posW}" height="${barH}" rx="3" fill="url(#tnTealGrad)" filter="url(#tnShadow)" />
        <text x="${centerX + posW + 4}" y="${y + barH / 2 + 3}" text-anchor="start" font-size="10" fill="${COLORS.teal}" font-weight="500">+${formatUsd(param.maxPositiveDelta)}</text>
      `);
    }

    // Impact badge
    const badgeColors: Record<string, string> = {
      'VERY HIGH': '#dc2626',
      'HIGH': '#d97706',
      'MEDIUM': '#2563eb',
      'LOW': '#16a34a',
    };
    const badgeColor = badgeColors[param.impactLevel] || COLORS.gray500;
    bars.push(`
      <circle cx="${width - 40}" cy="${y + barH / 2}" r="4" fill="${badgeColor}" />
    `);
  });

  const totalH = chartH + marginTop + marginBottom;

  // Subtle vertical gridlines
  const gridlines: string[] = [];
  const gridSteps = [0.25, 0.5, 0.75];
  gridSteps.forEach(frac => {
    const leftX = centerX - frac * scaleHalf;
    const rightX = centerX + frac * scaleHalf;
    gridlines.push(`<line x1="${leftX}" y1="${marginTop}" x2="${leftX}" y2="${chartH + marginTop}" stroke="${COLORS.gray100}" stroke-width="1" />`);
    gridlines.push(`<line x1="${rightX}" y1="${marginTop}" x2="${rightX}" y2="${chartH + marginTop}" stroke="${COLORS.gray100}" stroke-width="1" />`);
  });

  return `
    <svg width="${width}" height="${totalH}" viewBox="0 0 ${width} ${totalH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="tnTealGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#0d9488" />
          <stop offset="100%" stop-color="#06b6d4" />
        </linearGradient>
        <linearGradient id="tnNavyGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#334155" />
          <stop offset="100%" stop-color="#1a1e42" />
        </linearGradient>
        <filter id="tnShadow" x="-2%" y="-4%" width="104%" height="112%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.08" />
        </filter>
      </defs>
      <!-- Gridlines -->
      ${gridlines.join('')}
      <!-- Center zero line -->
      <line x1="${centerX}" y1="${marginTop - 5}" x2="${centerX}" y2="${chartH + marginTop + 5}" stroke="${COLORS.gray300}" stroke-width="1" />
      <!-- Axis labels -->
      <text x="${centerX}" y="${totalH - 6}" text-anchor="middle" font-size="9" fill="${COLORS.gray400}">Current Value</text>
      <text x="${marginLeft + 20}" y="${totalH - 6}" text-anchor="start" font-size="9" fill="${COLORS.navy}">Worst Case</text>
      <text x="${width - marginRight - 20}" y="${totalH - 6}" text-anchor="end" font-size="9" fill="${COLORS.teal}">Best Case</text>
      <!-- Bars -->
      ${bars.join('')}
    </svg>
  `;
}
