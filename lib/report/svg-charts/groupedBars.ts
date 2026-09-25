// Grouped vertical bars: one group per category (e.g. region), one bar per
// series (e.g. median upfront, median total). Null values print "—" at the
// baseline. Series colours are fixed in order (cyan, gray400, navy) — comps
// palette per the Brief format rules. Pure string function — no DOM.

import { COLORS, escapeHtml } from '../helpers';

export interface BarGroup {
  label: string;
  values: Array<{ label: string; value: number | null }>;
}

const FONT = 'Inter, system-ui, sans-serif';
const SERIES = [COLORS.cyan, COLORS.gray400, COLORS.navy, COLORS.gray300];

function fmt(v: number): string {
  if (v >= 1000) return `$${(v / 1000).toFixed(1)}B`;
  return `$${Math.round(v)}M`;
}

function niceMax(v: number): number {
  if (v <= 0) return 1;
  const mag = Math.pow(10, Math.floor(Math.log10(v)));
  const r = v / mag;
  const m = r <= 1 ? 1 : r <= 2 ? 2 : r <= 2.5 ? 2.5 : r <= 5 ? 5 : 10;
  return m * mag;
}

let gbSeq = 0;

export function renderGroupedBars(groups: BarGroup[], width = 560, height = 200): string {
  const uid = `gb${++gbSeq}-${Math.random().toString(36).slice(2, 7)}`;
  const mL = 46, mR = 10, mT = 24, mB = 28;
  const px0 = mL, px1 = width - mR, py0 = height - mB, py1 = mT;
  const seriesLabels = groups[0]?.values.map((v) => v.label) ?? [];
  const nSeries = Math.max(1, seriesLabels.length);

  const allVals = groups.flatMap((g) => g.values.map((v) => v.value)).filter((v): v is number => v != null && Number.isFinite(v));
  const max = niceMax(Math.max(...allVals, 1) * 1.1);
  const y = (v: number) => py0 - (Math.max(0, v) / max) * (py0 - py1);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const grid = ticks.map((t) => `
    <line x1="${px0}" y1="${y(t).toFixed(1)}" x2="${px1}" y2="${y(t).toFixed(1)}" stroke="${COLORS.gray200}" stroke-width="1"/>
    <text x="${px0 - 4}" y="${(y(t) + 2.5).toFixed(1)}" text-anchor="end" font-size="7" fill="${COLORS.gray400}" font-family="${FONT}">${fmt(t)}</text>`).join('');

  const groupW = groups.length ? (px1 - px0) / groups.length : px1 - px0;
  const gap = 2, innerPad = Math.min(14, groupW * 0.2);
  const barW = Math.max(4, (groupW - innerPad * 2 - gap * (nSeries - 1)) / nSeries);

  const bars = groups.map((g, gi) => {
    const gx = px0 + gi * groupW;
    const cells = g.values.map((v, si) => {
      const x = gx + innerPad + si * (barW + gap);
      const color = SERIES[si % SERIES.length];
      if (v.value == null || !Number.isFinite(v.value)) {
        return `<text x="${(x + barW / 2).toFixed(1)}" y="${(py0 - 3).toFixed(1)}" text-anchor="middle" font-size="7.5" fill="${COLORS.gray400}" font-family="${FONT}">—</text>`;
      }
      const top = y(v.value);
      const h = Math.max(py0 - top, 1);
      return `<rect x="${x.toFixed(1)}" y="${top.toFixed(1)}" width="${barW.toFixed(1)}" height="${h.toFixed(1)}" rx="2" fill="${color}"/>
        <text x="${(x + barW / 2).toFixed(1)}" y="${(top - 3).toFixed(1)}" text-anchor="middle" font-size="7" fill="${COLORS.gray600}" font-family="${FONT}">${fmt(v.value)}</text>`;
    }).join('');
    const label = `<text x="${(gx + groupW / 2).toFixed(1)}" y="${py0 + 12}" text-anchor="middle" font-size="7.5" font-weight="600" fill="${COLORS.gray700}" font-family="${FONT}">${escapeHtml(g.label)}</text>`;
    return cells + label;
  }).join('');

  let lx = px1;
  const legend = seriesLabels.slice().reverse().map((l, ri) => {
    const si = seriesLabels.length - 1 - ri;
    const w = l.length * 4.2 + 14;
    lx -= w + 8;
    return `<rect x="${lx}" y="6" width="8" height="8" rx="2" fill="${SERIES[si % SERIES.length]}"/><text x="${lx + 11}" y="13" font-size="7" fill="${COLORS.gray600}" font-family="${FONT}">${escapeHtml(l)}</text>`;
  }).join('');

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Grouped bars" data-uid="${uid}">
      ${grid}
      <line x1="${px0}" y1="${py0}" x2="${px1}" y2="${py0}" stroke="${COLORS.gray300}" stroke-width="1"/>
      ${bars}
      ${legend}
    </svg>
  `;
}
