// SVG horizontal range bar (low-median-high) with diamond marker
// Returns pure SVG string — no React, no DOM

import { COLORS, formatUsd } from '../helpers';

interface RangeBarInput {
  low: number;
  median: number;
  high: number;
}

export function renderRangeBar(
  range: RangeBarInput,
  maxValue: number,
  width: number = 300,
  height: number = 40,
  showLabels: boolean = true
): string {
  const padding = 4;
  const barY = showLabels ? 6 : height / 2 - 4;
  const barH = 8;
  const trackW = width - padding * 2;

  const scale = (v: number) => padding + (v / maxValue) * trackW;

  const lowX = scale(range.low);
  const medX = scale(range.median);
  const highX = scale(range.high);

  const svgHeight = showLabels ? height + 2 : height;
  // Unique IDs to avoid SVG gradient conflicts when multiple range bars on same page
  const uid = `rb-${Math.round(range.low)}-${Math.round(range.median)}`;

  return `
    <svg width="${width}" height="${svgHeight}" viewBox="0 0 ${width} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="${uid}-g" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="#99f6e4" />
          <stop offset="100%" stop-color="#5eead4" />
        </linearGradient>
        <filter id="${uid}-f" x="-30%" y="-30%" width="160%" height="160%">
          <feDropShadow dx="0" dy="0.5" stdDeviation="1.5" flood-color="${COLORS.teal}" flood-opacity="0.25" />
        </filter>
      </defs>
      <!-- Track -->
      <rect x="${padding}" y="${barY}" width="${trackW}" height="${barH}" rx="4" fill="${COLORS.gray100}" />
      <!-- Range fill -->
      <rect x="${lowX}" y="${barY}" width="${highX - lowX}" height="${barH}" rx="4" fill="url(#${uid}-g)" />
      <!-- Median diamond -->
      <polygon points="${medX},${barY - 2} ${medX + 4},${barY + barH / 2} ${medX},${barY + barH + 2} ${medX - 4},${barY + barH / 2}"
        fill="${COLORS.teal}" filter="url(#${uid}-f)" />
      ${showLabels ? `
      <!-- Labels -->
      <text x="${lowX}" y="${barY + barH + 14}" font-size="9" fill="${COLORS.gray400}" text-anchor="start">${formatUsd(range.low)}</text>
      <text x="${medX}" y="${barY + barH + 14}" font-size="9" fill="${COLORS.navy}" font-weight="600" text-anchor="middle">${formatUsd(range.median)}</text>
      <text x="${highX}" y="${barY + barH + 14}" font-size="9" fill="${COLORS.gray400}" text-anchor="end">${formatUsd(range.high)}</text>
      ` : ''}
    </svg>
  `;
}
