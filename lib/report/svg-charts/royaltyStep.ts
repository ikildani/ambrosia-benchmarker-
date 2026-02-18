// SVG royalty step chart showing tiered royalty rates
// X: net sales thresholds, Y: royalty %
// Returns pure SVG string — no React, no DOM

import { COLORS } from '../helpers';
import type { TieredRoyalties } from '@/lib/calculations';

export function renderRoyaltyStep(
  royalties: TieredRoyalties,
  width: number = 300,
  height: number = 180
): string {
  const marginLeft = 40;
  const marginRight = 16;
  const marginTop = 16;
  const marginBottom = 40;
  const chartW = width - marginLeft - marginRight;
  const chartH = height - marginTop - marginBottom;

  // Tiers
  const tiers = [
    { label: 'Base', low: royalties.base.low, high: royalties.base.high, xStart: 0, xEnd: 0.33 },
    { label: 'Mid', low: royalties.midTier.low, high: royalties.midTier.high, xStart: 0.33, xEnd: 0.66 },
    { label: 'High', low: royalties.highTier.low, high: royalties.highTier.high, xStart: 0.66, xEnd: 1 },
  ];

  // Y scale (royalty %)
  const allRates = tiers.flatMap(t => [t.low, t.high]);
  const maxRate = Math.ceil(Math.max(...allRates) * 1.2);
  const minRate = 0;
  const scaleY = (v: number) => marginTop + chartH - ((v - minRate) / (maxRate - minRate)) * chartH;
  const scaleX = (frac: number) => marginLeft + frac * chartW;

  // Build step lines (low and high)
  const lowPoints: string[] = [];
  const highPoints: string[] = [];

  tiers.forEach((tier) => {
    const x1 = scaleX(tier.xStart);
    const x2 = scaleX(tier.xEnd);
    const yLow = scaleY(tier.low);
    const yHigh = scaleY(tier.high);

    lowPoints.push(`${x1},${yLow} ${x2},${yLow}`);
    highPoints.push(`${x1},${yHigh} ${x2},${yHigh}`);
  });

  // Shaded area between low and high
  const areaPath: string[] = [];
  // Top line (high rates, left to right)
  tiers.forEach((tier) => {
    areaPath.push(`${scaleX(tier.xStart)},${scaleY(tier.high)}`);
    areaPath.push(`${scaleX(tier.xEnd)},${scaleY(tier.high)}`);
  });
  // Bottom line (low rates, right to left)
  for (let i = tiers.length - 1; i >= 0; i--) {
    areaPath.push(`${scaleX(tiers[i].xEnd)},${scaleY(tiers[i].low)}`);
    areaPath.push(`${scaleX(tiers[i].xStart)},${scaleY(tiers[i].low)}`);
  }

  // Y axis ticks
  const yTicks: string[] = [];
  const tickCount = 4;
  for (let i = 0; i <= tickCount; i++) {
    const val = minRate + (maxRate - minRate) * (i / tickCount);
    const y = scaleY(val);
    yTicks.push(`
      <line x1="${marginLeft}" y1="${y}" x2="${marginLeft + chartW}" y2="${y}" stroke="${COLORS.gray100}" stroke-width="1" />
      <text x="${marginLeft - 6}" y="${y + 3}" text-anchor="end" font-size="8" fill="${COLORS.gray400}">${val.toFixed(0)}%</text>
    `);
  }

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <!-- Grid -->
      ${yTicks.join('')}
      <!-- Shaded area -->
      <polygon points="${areaPath.join(' ')}" fill="${COLORS.teal}" opacity="0.12" />
      <!-- High line -->
      <polyline points="${highPoints.join(' ')}" fill="none" stroke="${COLORS.teal}" stroke-width="2" />
      <!-- Low line -->
      <polyline points="${lowPoints.join(' ')}" fill="none" stroke="${COLORS.navy}" stroke-width="2" stroke-dasharray="4,3" />
      <!-- Tier labels -->
      ${tiers.map((tier) => {
        const x = scaleX((tier.xStart + tier.xEnd) / 2);
        return `
          <text x="${x}" y="${height - 18}" text-anchor="middle" font-size="9" font-weight="500" fill="${COLORS.gray700}">${tier.label} Tier</text>
          <text x="${x}" y="${height - 6}" text-anchor="middle" font-size="8" fill="${COLORS.gray400}">${tier.low}%-${tier.high}%</text>
        `;
      }).join('')}
      <!-- Legend -->
      <line x1="${marginLeft}" y1="${height - 2}" x2="${marginLeft + 16}" y2="${height - 2}" stroke="${COLORS.teal}" stroke-width="2" />
      <text x="${marginLeft + 20}" y="${height}" font-size="7" fill="${COLORS.gray500}">High</text>
      <line x1="${marginLeft + 50}" y1="${height - 2}" x2="${marginLeft + 66}" y2="${height - 2}" stroke="${COLORS.navy}" stroke-width="2" stroke-dasharray="4,3" />
      <text x="${marginLeft + 70}" y="${height}" font-size="7" fill="${COLORS.gray500}">Low</text>
    </svg>
  `;
}
