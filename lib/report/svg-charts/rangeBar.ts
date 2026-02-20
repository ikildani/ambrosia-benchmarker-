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
  const barH = 8;
  const trackW = width - padding * 2;

  const scale = (v: number) => padding + (v / maxValue) * trackW;

  const lowX = scale(range.low);
  const medX = scale(range.median);
  const highX = scale(range.high);

  // Unique IDs to avoid SVG gradient conflicts when multiple range bars on same page
  const uid = `rb-${Math.round(range.low)}-${Math.round(range.median)}`;

  if (!showLabels) {
    // Simple mode: bar only, no labels
    const barY = height / 2 - 4;
    return `
      <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="${uid}-g" x1="0" y1="0" x2="1" y2="0">
            <stop offset="0%" stop-color="#99f6e4" />
            <stop offset="100%" stop-color="#5eead4" />
          </linearGradient>
          <filter id="${uid}-f" x="-30%" y="-30%" width="160%" height="160%">
            <feDropShadow dx="0" dy="0.5" stdDeviation="1.5" flood-color="${COLORS.teal}" flood-opacity="0.25" />
          </filter>
        </defs>
        <rect x="${padding}" y="${barY}" width="${trackW}" height="${barH}" rx="4" fill="${COLORS.gray100}" />
        <rect x="${lowX}" y="${barY}" width="${Math.max(highX - lowX, 2)}" height="${barH}" rx="4" fill="url(#${uid}-g)" />
        <polygon points="${medX},${barY - 2} ${medX + 4},${barY + barH / 2} ${medX},${barY + barH + 2} ${medX - 4},${barY + barH / 2}"
          fill="${COLORS.teal}" filter="url(#${uid}-f)" />
      </svg>
    `;
  }

  // Labels mode: median label above, low/high below — avoids overlap
  const barY = 18; // Leave room for median label above
  const svgHeight = barY + barH + 18; // Room for bottom labels

  // Format labels
  const lowLabel = formatUsd(range.low);
  const medLabel = formatUsd(range.median);
  const highLabel = formatUsd(range.high);

  // Median label goes above the bar
  const medLabelY = barY - 6;

  // Low and high labels go below the bar
  const bottomLabelY = barY + barH + 12;

  // Clamp label X positions to prevent overflow
  const lowLabelX = Math.max(padding, lowX);
  const highLabelX = Math.min(width - padding, highX);
  const medLabelX = Math.max(padding + 15, Math.min(width - padding - 15, medX));

  // Check if low and high labels would overlap (within ~40px of each other)
  const lowHighOverlap = (highLabelX - lowLabelX) < 45;

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
      <rect x="${lowX}" y="${barY}" width="${Math.max(highX - lowX, 2)}" height="${barH}" rx="4" fill="url(#${uid}-g)" />
      <!-- Median diamond -->
      <polygon points="${medX},${barY - 2} ${medX + 4},${barY + barH / 2} ${medX},${barY + barH + 2} ${medX - 4},${barY + barH / 2}"
        fill="${COLORS.teal}" filter="url(#${uid}-f)" />
      <!-- Median label ABOVE bar -->
      <text x="${medLabelX}" y="${medLabelY}" font-size="9" fill="${COLORS.navy}" font-weight="700" text-anchor="middle" font-family="Inter, system-ui, sans-serif">${medLabel}</text>
      <!-- Low label below bar (left-aligned) -->
      <text x="${lowLabelX}" y="${bottomLabelY}" font-size="8" fill="${COLORS.gray400}" text-anchor="start" font-family="Inter, system-ui, sans-serif">${lowLabel}</text>
      <!-- High label below bar (right-aligned), skip if overlaps with low -->
      ${lowHighOverlap ? '' : `<text x="${highLabelX}" y="${bottomLabelY}" font-size="8" fill="${COLORS.gray400}" text-anchor="end" font-family="Inter, system-ui, sans-serif">${highLabel}</text>`}
    </svg>
  `;
}
