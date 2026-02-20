// SVG semicircle gauge for risk score (0-100)
// Returns pure SVG string — no React, no DOM

import { COLORS } from '../helpers';

export function renderRiskGauge(score: number, size: number = 120): string {
  // Pad viewBox to prevent stroke/glow from clipping
  const pad = 14;
  const cx = size / 2 + pad;
  const cy = size / 2 + pad;
  const r = size / 2 - 12;
  const strokeWidth = 12;
  const vbW = size + pad * 2;
  const vbH = size * 0.55 + pad * 2;

  // Arc from 180deg (left) to 0deg (right) — semicircle
  const startAngle = Math.PI;
  const endAngle = 0;
  const totalArc = Math.PI;
  const scoreAngle = startAngle - (score / 100) * totalArc;

  // Background arc (full semicircle)
  const bgX1 = cx + r * Math.cos(startAngle);
  const bgY1 = cy - r * Math.sin(startAngle);
  const bgX2 = cx + r * Math.cos(endAngle);
  const bgY2 = cy - r * Math.sin(endAngle);

  // Score arc
  const sX = cx + r * Math.cos(scoreAngle);
  const sY = cy - r * Math.sin(scoreAngle);
  const largeArc = score > 50 ? 1 : 0;

  // Color based on score
  let color = COLORS.green;
  let label = 'LOW';
  if (score >= 70) { color = COLORS.rose; label = 'HIGH'; }
  else if (score >= 40) { color = COLORS.amber; label = 'MEDIUM'; }

  return `
    <svg width="${size}" height="${Math.round(size * 0.7)}" viewBox="0 0 ${vbW} ${vbH}" xmlns="http://www.w3.org/2000/svg" overflow="hidden">
      <defs>
        <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
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
        fill="none" stroke="url(#gaugeGrad)" stroke-width="${strokeWidth}" stroke-linecap="round" />
      ` : ''}
      <!-- Score value -->
      <text x="${cx}" y="${cy - 6}" text-anchor="middle" font-size="${size * 0.28}" font-weight="700" fill="${color}">${score}</text>
      <!-- Label -->
      <text x="${cx}" y="${cy + 12}" text-anchor="middle" font-size="${size * 0.10}" font-weight="600" fill="${COLORS.gray500}" letter-spacing="0.1em">${label} RISK</text>
    </svg>
  `;
}
