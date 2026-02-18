// SVG grouped bar chart comparing comparable deals
// Horizontal bars for each deal, with a dashed line at user's estimated value
// Returns pure SVG string — no React, no DOM

import { COLORS, parseDealValue } from '../helpers';
import type { ComparableDealForUI } from '@/lib/comparableDeals';

export function renderDealComparison(
  deals: ComparableDealForUI[],
  userMedianValue: number,
  width: number = 680,
  height: number = 200
): string {
  if (deals.length === 0) {
    return `<svg width="${width}" height="60" viewBox="0 0 ${width} 60" xmlns="http://www.w3.org/2000/svg">
      <text x="${width / 2}" y="30" text-anchor="middle" font-size="12" fill="${COLORS.gray400}">No comparable deals available</text>
    </svg>`;
  }

  const marginLeft = 160;
  const marginRight = 80;
  const marginTop = 20;
  const marginBottom = 20;
  const chartW = width - marginLeft - marginRight;
  const barGap = 6;
  const maxBars = Math.min(deals.length, 8);
  const barH = Math.min(22, (height - marginTop - marginBottom - barGap * (maxBars - 1)) / maxBars);
  const chartH = maxBars * (barH + barGap);

  // Parse deal values to numbers
  const dealData = deals.slice(0, maxBars).map(d => ({
    ...d,
    numValue: parseDealValue(d.totalValue) || 0,
  }));

  const allValues = [...dealData.map(d => d.numValue), userMedianValue];
  const maxVal = Math.max(...allValues) * 1.15;
  const scaleX = (v: number) => marginLeft + (v / maxVal) * chartW;

  // Bars with gradient colors based on relevance
  const barColors = [
    COLORS.teal, '#0ea5e9', '#6366f1', '#8b5cf6',
    '#a855f7', '#ec4899', '#f43f5e', '#f97316',
  ];

  const bars: string[] = [];

  dealData.forEach((deal, i) => {
    const y = marginTop + i * (barH + barGap);
    const barW = Math.max(scaleX(deal.numValue) - marginLeft, 2);
    const color = barColors[i % barColors.length];

    // Label (parties)
    const label = deal.parties.length > 22 ? deal.parties.substring(0, 20) + '...' : deal.parties;
    bars.push(`
      <text x="${marginLeft - 8}" y="${y + barH / 2 + 3}" text-anchor="end" font-size="9" font-weight="500" fill="${COLORS.gray700}">${label}</text>
      <rect x="${marginLeft}" y="${y}" width="${barW}" height="${barH}" rx="3" fill="${color}" opacity="0.8" />
      <text x="${marginLeft + barW + 6}" y="${y + barH / 2 + 3}" font-size="9" font-weight="600" fill="${color}">${deal.totalValue}</text>
    `);
  });

  // User value dashed line
  const userX = scaleX(userMedianValue);
  const totalH = chartH + marginTop + marginBottom;

  return `
    <svg width="${width}" height="${totalH}" viewBox="0 0 ${width} ${totalH}" xmlns="http://www.w3.org/2000/svg">
      <!-- Bars -->
      ${bars.join('')}
      <!-- User estimated value line -->
      <line x1="${userX}" y1="${marginTop - 5}" x2="${userX}" y2="${chartH + marginTop + 5}" stroke="${COLORS.rose}" stroke-width="1.5" stroke-dasharray="5,3" />
      <text x="${userX}" y="${marginTop - 8}" text-anchor="middle" font-size="8" font-weight="600" fill="${COLORS.rose}">Your Estimate</text>
    </svg>
  `;
}
