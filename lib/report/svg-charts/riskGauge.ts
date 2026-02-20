// SVG semicircle gauge for risk score (0-100)
// Returns pure SVG string — no React, no DOM

import { COLORS } from '../helpers';

export function renderRiskGauge(score: number, size: number = 120): string {
  const cx = size / 2;
  const cy = size / 2 + 10;
  const r = size / 2 - 12;
  const strokeWidth = 12;

  // Arc from 180deg (left) to 0deg (right) — semicircle
  const startAngle = Math.PI; // left
  const endAngle = 0; // right
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
    <svg width="${size}" height="${size * 0.7}" viewBox="0 0 ${size} ${size * 0.7}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="gaugeGrad" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0%" stop-color="${COLORS.green}" />
          <stop offset="50%" stop-color="${COLORS.amber}" />
          <stop offset="100%" stop-color="${COLORS.rose}" />
        </linearGradient>
        <filter id="gaugeGlow" x="-10%" y="-10%" width="120%" height="120%">
          <feGaussianBlur in="SourceGraphic" stdDeviation="3" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      <!-- Background arc -->
      <path d="M ${bgX1} ${bgY1} A ${r} ${r} 0 0 1 ${bgX2} ${bgY2}"
        fill="none" stroke="${COLORS.gray200}" stroke-width="${strokeWidth}" stroke-linecap="round" />
      <!-- Score arc -->
      ${score > 0 ? `
      <path d="M ${bgX1} ${bgY1} A ${r} ${r} 0 ${largeArc} 1 ${sX} ${sY}"
        fill="none" stroke="url(#gaugeGrad)" stroke-width="${strokeWidth}" stroke-linecap="round" filter="url(#gaugeGlow)" />
      ` : ''}
      <!-- Score value -->
      <text x="${cx}" y="${cy - 8}" text-anchor="middle" font-size="${size * 0.30}" font-weight="700" fill="${color}">${score}</text>
      <!-- Label -->
      <text x="${cx}" y="${cy + 10}" text-anchor="middle" font-size="${size * 0.10}" font-weight="600" fill="${COLORS.gray500}" letter-spacing="0.1em">${label} RISK</text>
    </svg>
  `;
}
