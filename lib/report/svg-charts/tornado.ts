// SVG tornado/butterfly chart for sensitivity analysis
// Shows parameter impact as horizontal bars extending left (negative) and right (positive)
// Returns pure SVG string — no React, no DOM

import { COLORS, formatUsd } from '../helpers';
import type { ParameterSensitivity } from '@/lib/sensitivity';

export function renderTornado(
  parameters: ParameterSensitivity[],
  width: number = 680,
  height: number = 300
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

  const marginLeft = 130;
  const marginRight = 80;
  const marginTop = 20;
  const marginBottom = 30;
  const barGap = 6;
  const barCount = sorted.length;
  const barH = Math.min(26, (height - marginTop - marginBottom - barGap * (barCount - 1)) / barCount);
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
    const label = param.label.length > 18 ? param.label.substring(0, 16) + '...' : param.label;
    bars.push(`
      <text x="${marginLeft - 8}" y="${y + barH / 2 + 3}" text-anchor="end" font-size="9" font-weight="500" fill="${COLORS.gray700}">${label}</text>
    `);

    // Negative bar (left from center)
    if (param.maxNegativeDelta < 0) {
      const negW = scaleDelta(Math.abs(param.maxNegativeDelta));
      bars.push(`
        <rect x="${centerX - negW}" y="${y}" width="${negW}" height="${barH}" rx="3" fill="${COLORS.navy}" opacity="0.8" />
        <text x="${centerX - negW - 4}" y="${y + barH / 2 + 3}" text-anchor="end" font-size="8" fill="${COLORS.navy}" font-weight="500">${formatUsd(param.maxNegativeDelta)}</text>
      `);
    }

    // Positive bar (right from center)
    if (param.maxPositiveDelta > 0) {
      const posW = scaleDelta(param.maxPositiveDelta);
      bars.push(`
        <rect x="${centerX}" y="${y}" width="${posW}" height="${barH}" rx="3" fill="${COLORS.teal}" opacity="0.85" />
        <text x="${centerX + posW + 4}" y="${y + barH / 2 + 3}" text-anchor="start" font-size="8" fill="${COLORS.teal}" font-weight="500">+${formatUsd(param.maxPositiveDelta)}</text>
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

  return `
    <svg width="${width}" height="${totalH}" viewBox="0 0 ${width} ${totalH}" xmlns="http://www.w3.org/2000/svg">
      <!-- Center zero line -->
      <line x1="${centerX}" y1="${marginTop - 5}" x2="${centerX}" y2="${chartH + marginTop + 5}" stroke="${COLORS.gray300}" stroke-width="1" />
      <!-- Axis labels -->
      <text x="${centerX}" y="${totalH - 6}" text-anchor="middle" font-size="8" fill="${COLORS.gray400}">Current Value</text>
      <text x="${marginLeft + 20}" y="${totalH - 6}" text-anchor="start" font-size="8" fill="${COLORS.navy}">Worst Case</text>
      <text x="${width - marginRight - 20}" y="${totalH - 6}" text-anchor="end" font-size="8" fill="${COLORS.teal}">Best Case</text>
      <!-- Bars -->
      ${bars.join('')}
    </svg>
  `;
}
