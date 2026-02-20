// SVG donut/ring chart for value distribution
// Returns pure SVG string — no React, no DOM

export interface DonutSegment {
  label: string;
  value: number;
  color: string;
}

export function renderDonut(segments: DonutSegment[], size: number = 200): string {
  const cx = size / 2;
  const cy = size / 2;
  const outerR = size / 2 - 8;
  const innerR = outerR * 0.58;
  const total = segments.reduce((sum, s) => sum + s.value, 0);

  if (total === 0) {
    return `<svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" xmlns="http://www.w3.org/2000/svg">
      <circle cx="${cx}" cy="${cy}" r="${outerR}" fill="none" stroke="#e2e8f0" stroke-width="3" />
      <text x="${cx}" y="${cy}" text-anchor="middle" dominant-baseline="middle" font-size="12" fill="#94a3b8">No data</text>
    </svg>`;
  }

  let currentAngle = -Math.PI / 2; // Start from top
  const paths: string[] = [];
  const legendItems: string[] = [];

  segments.forEach((seg, i) => {
    const pct = seg.value / total;
    if (pct === 0) return;
    const angle = pct * 2 * Math.PI;
    const endAngle = currentAngle + angle;
    const largeArc = angle > Math.PI ? 1 : 0;

    const x1o = cx + outerR * Math.cos(currentAngle);
    const y1o = cy + outerR * Math.sin(currentAngle);
    const x2o = cx + outerR * Math.cos(endAngle);
    const y2o = cy + outerR * Math.sin(endAngle);
    const x1i = cx + innerR * Math.cos(endAngle);
    const y1i = cy + innerR * Math.sin(endAngle);
    const x2i = cx + innerR * Math.cos(currentAngle);
    const y2i = cy + innerR * Math.sin(currentAngle);

    paths.push(`
      <path d="M ${x1o} ${y1o} A ${outerR} ${outerR} 0 ${largeArc} 1 ${x2o} ${y2o} L ${x1i} ${y1i} A ${innerR} ${innerR} 0 ${largeArc} 0 ${x2i} ${y2i} Z"
        fill="${seg.color}" filter="url(#donutShadow)" />
    `);

    // Legend
    const ly = size + 18 + i * 18;
    legendItems.push(`
      <rect x="8" y="${ly - 8}" width="10" height="10" rx="2" fill="${seg.color}" />
      <text x="24" y="${ly}" font-size="11" fill="#475569">${seg.label}</text>
      <text x="${size - 8}" y="${ly}" font-size="11" fill="#1a1e42" font-weight="600" text-anchor="end">${(pct * 100).toFixed(0)}%</text>
    `);

    currentAngle = endAngle;
  });

  const legendHeight = segments.filter(s => s.value > 0).length * 18 + 24;

  return `
    <svg width="${size}" height="${size + legendHeight}" viewBox="0 0 ${size} ${size + legendHeight}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <filter id="donutShadow" x="-4%" y="-4%" width="108%" height="108%">
          <feDropShadow dx="0" dy="1" stdDeviation="2" flood-opacity="0.06" />
        </filter>
      </defs>
      ${paths.join('')}
      <!-- Inner white ring for depth -->
      <circle cx="${cx}" cy="${cy}" r="${innerR + 1}" fill="none" stroke="white" stroke-width="2" />
      <!-- Center label -->
      <text x="${cx}" y="${cy - 6}" text-anchor="middle" font-size="11" font-weight="600" fill="#64748b">TOTAL</text>
      <text x="${cx}" y="${cy + 14}" text-anchor="middle" font-size="16" font-weight="700" fill="#1a1e42">100%</text>
      <!-- Legend -->
      ${legendItems.join('')}
    </svg>
  `;
}
