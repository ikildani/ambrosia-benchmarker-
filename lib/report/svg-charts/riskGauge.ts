// SVG semicircle gauge for risk score (0-100)
// Returns pure SVG string — no React, no DOM

import { COLORS } from '../helpers';

export function renderRiskGauge(score: number, size: number = 120): string {
  const strokeWidth = Math.max(8, size * 0.09);
  // Pad enough to contain round linecaps (strokeWidth/2) plus breathing room
  const pad = Math.ceil(strokeWidth / 2) + 6;
  const cx = size / 2 + pad;
  const cy = size / 2 + pad;
  const r = size / 2 - 10;
  const vbW = size + pad * 2;
  const vbH = size * 0.62 + pad * 2;

  // Arc from 180deg (left) to 0deg (right) — semicircle
  const startAngle = Math.PI;
  const scoreAngle = startAngle - (score / 100) * Math.PI;

  // Background arc (full semicircle)
  const bgX1 = cx + r * Math.cos(startAngle);
  const bgY1 = cy - r * Math.sin(startAngle);
  const bgX2 = cx + r * Math.cos(0);
  const bgY2 = cy - r * Math.sin(0);

  // Score arc
  const sX = cx + r * Math.cos(scoreAngle);
  const sY = cy - r * Math.sin(scoreAngle);
  const largeArc = score > 50 ? 1 : 0;

  // Color based on score
  let color = COLORS.green;
  let label = 'LOW';
  if (score >= 70) { color = COLORS.rose; label = 'HIGH'; }
  else if (score >= 40) { color = COLORS.amber; label = 'MEDIUM'; }

  // Use unique gradient ID to avoid conflicts when multiple gauges on same page
  const gradId = `gauge-${size}`;

  return `
    <svg width="${vbW}" height="${vbH}" viewBox="0 0 ${vbW} ${vbH}" xmlns="http://www.w3.org/2000/svg" overflow="hidden">
      <defs>
        <linearGradient id="${gradId}" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="${COLORS.green}" />
          <stop offset="50%" stop-color="${COLORS.amber}" />
          <stop offset="100%" stop-color="${COLORS.rose}" />
        </linearGradient>
      </defs>
      <!-- Background arc -->
      <path d="M ${bgX1} ${bgY1} A ${r} ${r} 0 0 1 ${bgX2} ${bgY2}"
        fill="none" stroke="${COLORS.gray200}" stroke-width="${strokeWidth}" stroke-linecap="round" />
      <!-- Score arc -->
      ${score > 0 ? `
      <path d="M ${bgX1} ${bgY1} A ${r} ${r} 0 ${largeArc} 1 ${sX} ${sY}"
        fill="none" stroke="url(#${gradId})" stroke-width="${strokeWidth}" stroke-linecap="round" />
      ` : ''}
      <!-- Score value -->
      <text x="${cx}" y="${cy - 4}" text-anchor="middle" font-family="'Inter', sans-serif" font-size="${Math.round(size * 0.26)}" font-weight="800" fill="${color}" letter-spacing="-0.02em">${score}</text>
      <!-- Label -->
      <text x="${cx}" y="${cy + 10}" text-anchor="middle" font-family="'Inter', sans-serif" font-size="${Math.round(size * 0.085)}" font-weight="700" fill="${COLORS.gray400}" letter-spacing="0.14em">${label} RISK</text>
    </svg>
  `;
}
