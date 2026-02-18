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

  return `
    <svg width="${width}" height="${svgHeight}" viewBox="0 0 ${width} ${svgHeight}" xmlns="http://www.w3.org/2000/svg">
      <!-- Track -->
      <rect x="${padding}" y="${barY}" width="${trackW}" height="${barH}" rx="4" fill="${COLORS.gray100}" />
      <!-- Range fill -->
      <rect x="${lowX}" y="${barY}" width="${highX - lowX}" height="${barH}" rx="4" fill="${COLORS.tealLight}" />
      <!-- Median diamond -->
      <polygon points="${medX},${barY - 2} ${medX + 5},${barY + barH / 2} ${medX},${barY + barH + 2} ${medX - 5},${barY + barH / 2}"
        fill="${COLORS.teal}" />
      ${showLabels ? `
      <!-- Labels -->
      <text x="${lowX}" y="${barY + barH + 14}" font-size="8" fill="${COLORS.gray400}" text-anchor="start">${formatUsd(range.low)}</text>
      <text x="${medX}" y="${barY + barH + 14}" font-size="8" fill="${COLORS.teal}" font-weight="600" text-anchor="middle">${formatUsd(range.median)}</text>
      <text x="${highX}" y="${barY + barH + 14}" font-size="8" fill="${COLORS.gray400}" text-anchor="end">${formatUsd(range.high)}</text>
      ` : ''}
    </svg>
  `;
}
