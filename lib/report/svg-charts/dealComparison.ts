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

  const marginLeft = 170;
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

  // Bar colors with gradient pairs (base → lighter)
  const barColors = [
    ['#0d9488', '#06b6d4'],
    ['#0ea5e9', '#38bdf8'],
    ['#6366f1', '#818cf8'],
    ['#8b5cf6', '#a78bfa'],
    ['#a855f7', '#c084fc'],
    ['#ec4899', '#f472b6'],
    ['#f43f5e', '#fb7185'],
    ['#f97316', '#fb923c'],
  ];

  // Unique ID prefix to avoid gradient collisions
  const uid = `dc-${Math.random().toString(36).slice(2, 8)}`;

  // Build gradient defs
  const gradientDefs = barColors.map((pair, i) => `
    <linearGradient id="${uid}-g${i}" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%" stop-color="${pair[0]}" />
      <stop offset="100%" stop-color="${pair[1]}" />
    </linearGradient>
  `).join('');

  const bars: string[] = [];

  dealData.forEach((deal, i) => {
    const y = marginTop + i * (barH + barGap);
    const barW = Math.max(scaleX(deal.numValue) - marginLeft, 2);

    // Label (parties)
    const label = deal.parties.length > 26 ? deal.parties.substring(0, 24) + '...' : deal.parties;
    bars.push(`
      <text x="${marginLeft - 8}" y="${y + barH / 2 + 3}" text-anchor="end" font-size="10" font-weight="500" fill="${COLORS.gray700}">${label}</text>
      <rect x="${marginLeft}" y="${y}" width="${barW}" height="${barH}" rx="3" fill="url(#${uid}-g${i % barColors.length})" filter="url(#${uid}-shadow)" />
      <text x="${marginLeft + barW + 6}" y="${y + barH / 2 + 3}" font-size="10" font-weight="600" fill="${barColors[i % barColors.length][0]}">${deal.totalValue}</text>
    `);
  });

  // User value dashed line
  const userX = scaleX(userMedianValue);
  const totalH = chartH + marginTop + marginBottom;

  return `
    <svg width="${width}" height="${totalH}" viewBox="0 0 ${width} ${totalH}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        ${gradientDefs}
        <filter id="${uid}-shadow" x="-2%" y="-4%" width="104%" height="112%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.08" />
        </filter>
      </defs>
      <!-- Bars -->
      ${bars.join('')}
      <!-- User estimated value line -->
      <line x1="${userX}" y1="${marginTop - 5}" x2="${userX}" y2="${chartH + marginTop + 5}" stroke="${COLORS.rose}" stroke-width="1.5" stroke-dasharray="5,3" />
      <text x="${userX}" y="${marginTop - 8}" text-anchor="middle" font-size="9" font-weight="600" fill="${COLORS.rose}">Your Estimate</text>
    </svg>
  `;
}
