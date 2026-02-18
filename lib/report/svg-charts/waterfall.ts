// SVG waterfall chart showing modifier impact on deal value
// Ported from components/charts/ModifierWaterfall.tsx logic
// Returns pure SVG string — no React, no DOM

import { COLORS, formatUsd } from '../helpers';

interface Modifier {
  name: string;
  multiplier: number;
  context?: string;
}

interface WaterfallBar {
  name: string;
  value: number;
  impact: number;
  fill: string;
  y: number;
  height: number;
  isBase?: boolean;
  isFinal?: boolean;
}

export function renderWaterfall(
  modifiers: Modifier[],
  baseValue: number,
  width: number = 680,
  height: number = 280
): string {
  // Build data
  let runningValue = baseValue;
  const items: { name: string; value: number; impact: number; fill: string; start: number; isBase?: boolean; isFinal?: boolean }[] = [];

  items.push({ name: 'Base Value', value: baseValue, impact: 0, fill: COLORS.gray500, start: 0, isBase: true });

  modifiers.forEach((mod) => {
    const impact = runningValue * (mod.multiplier - 1);
    const newValue = runningValue + impact;
    items.push({
      name: mod.name.length > 18 ? mod.name.substring(0, 16) + '...' : mod.name,
      value: Math.abs(impact),
      impact,
      fill: mod.multiplier > 1 ? COLORS.teal : COLORS.amber,
      start: Math.min(runningValue, newValue),
    });
    runningValue = newValue;
  });

  items.push({ name: 'Final Value', value: runningValue, impact: 0, fill: '#0f766e', start: 0, isFinal: true });

  // Scales
  const marginLeft = 120;
  const marginRight = 20;
  const marginTop = 10;
  const marginBottom = 10;
  const chartW = width - marginLeft - marginRight;
  const barCount = items.length;
  const barGap = 6;
  const barH = Math.min(28, (height - marginTop - marginBottom - barGap * (barCount - 1)) / barCount);
  const chartH = barCount * (barH + barGap);

  // Find max value for scale
  const allValues = items.map(i => i.isBase || i.isFinal ? i.value : i.start + i.value);
  allValues.push(...items.map(i => i.isBase || i.isFinal ? 0 : i.start));
  const maxVal = Math.max(...allValues) * 1.1;

  const scaleX = (v: number) => marginLeft + (v / maxVal) * chartW;

  // Build bars
  const bars: string[] = [];
  let prevEnd = scaleX(baseValue);

  items.forEach((item, i) => {
    const y = marginTop + i * (barH + barGap);

    if (item.isBase || item.isFinal) {
      const barW = scaleX(item.value) - marginLeft;
      bars.push(`
        <!-- ${item.name} -->
        <text x="${marginLeft - 8}" y="${y + barH / 2 + 3}" text-anchor="end" font-size="9" font-weight="500" fill="${COLORS.gray700}">${item.name}</text>
        <rect x="${marginLeft}" y="${y}" width="${Math.max(barW, 1)}" height="${barH}" rx="3" fill="${item.fill}" />
        <text x="${scaleX(item.value) + 6}" y="${y + barH / 2 + 3}" font-size="9" font-weight="600" fill="${item.fill}">${formatUsd(item.value)}</text>
      `);
      prevEnd = scaleX(item.value);
    } else {
      const startX = scaleX(item.start);
      const barW = Math.max((item.value / maxVal) * chartW, 2);
      const sign = item.impact >= 0 ? '+' : '';
      const labelColor = item.impact >= 0 ? COLORS.teal : COLORS.amber;

      // Connector line from previous bar end
      bars.push(`
        <line x1="${prevEnd}" y1="${y - barGap / 2}" x2="${prevEnd}" y2="${y + barH / 2}" stroke="${COLORS.gray300}" stroke-width="1" stroke-dasharray="3,2" />
      `);

      bars.push(`
        <!-- ${item.name} -->
        <text x="${marginLeft - 8}" y="${y + barH / 2 + 3}" text-anchor="end" font-size="9" font-weight="500" fill="${COLORS.gray700}">${item.name}</text>
        <rect x="${startX}" y="${y}" width="${barW}" height="${barH}" rx="3" fill="${item.fill}" opacity="0.85" />
        <text x="${startX + barW + 6}" y="${y + barH / 2 + 3}" font-size="9" font-weight="600" fill="${labelColor}">${sign}${formatUsd(item.impact)}</text>
      `);
      prevEnd = startX + barW;
    }
  });

  // Zero line
  const zeroX = marginLeft;

  return `
    <svg width="${width}" height="${chartH + marginTop + marginBottom}" viewBox="0 0 ${width} ${chartH + marginTop + marginBottom}" xmlns="http://www.w3.org/2000/svg">
      <!-- Zero baseline -->
      <line x1="${zeroX}" y1="${marginTop}" x2="${zeroX}" y2="${chartH + marginTop}" stroke="${COLORS.gray200}" stroke-width="1" />
      ${bars.join('')}
    </svg>
  `;
}
