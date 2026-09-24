// Distribution strips: one row per bucket showing p25–p75 as a bar with a
// p50 tick, an optional teal diamond marker (the asset's ask), and n at the
// right. Null stats print "—". Shared linear axis across buckets.
// Pure string function — no DOM.

import { COLORS, escapeHtml } from '../helpers';

export interface StripBucket {
  label: string;
  stats: { p25: number; p50: number; p75: number } | null;
  n: number;
}

const FONT = 'Inter, system-ui, sans-serif';

function fmt(v: number, unit: '$M' | '%'): string {
  if (unit === '%') return `${v.toFixed(v < 10 ? 1 : 0)}%`;
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

let stripSeq = 0;

export function renderDistributionStrips(
  buckets: StripBucket[],
  marker: number | null,
  width = 560,
  unit: '$M' | '%' = '$M',
): string {
  const uid = `ds${++stripSeq}-${Math.random().toString(36).slice(2, 7)}`;
  const labelW = 74, nW = 34, rowH = 18, top = 6, axisH = 16;
  const x0 = labelW, x1 = width - nW - 6;
  const height = top + buckets.length * rowH + axisH;

  const vals = buckets.flatMap((b) => (b.stats ? [b.stats.p75] : []));
  if (marker != null && Number.isFinite(marker)) vals.push(marker);
  const max = niceMax(Math.max(...vals, 1) * 1.05);
  const pos = (v: number) => x0 + (Math.max(0, Math.min(v, max)) / max) * (x1 - x0);

  const ticks = [0, 0.25, 0.5, 0.75, 1].map((f) => f * max);
  const axisY = top + buckets.length * rowH + 10;
  const axis = ticks.map((t) => `
    <line x1="${pos(t).toFixed(1)}" y1="${top}" x2="${pos(t).toFixed(1)}" y2="${axisY - 8}" stroke="${COLORS.gray200}" stroke-width="1"/>
    <text x="${pos(t).toFixed(1)}" y="${axisY}" text-anchor="middle" font-size="7" fill="${COLORS.gray400}" font-family="${FONT}">${fmt(t, unit)}</text>`).join('');

  const rowsSvg = buckets.map((b, i) => {
    const cy = top + i * rowH + rowH / 2;
    const label = `<text x="${x0 - 6}" y="${(cy + 2.5).toFixed(1)}" text-anchor="end" font-size="8" font-weight="600" fill="${COLORS.gray700}" font-family="${FONT}">${escapeHtml(b.label)}</text>`;
    const nText = `<text x="${width - 4}" y="${(cy + 2.5).toFixed(1)}" text-anchor="end" font-size="7.5" fill="${COLORS.gray500}" font-family="${FONT}">n=${b.n}</text>`;
    if (!b.stats) {
      return `${label}<text x="${x0 + 4}" y="${(cy + 2.5).toFixed(1)}" font-size="8" fill="${COLORS.gray400}" font-family="${FONT}">—</text>${nText}`;
    }
    const a = pos(b.stats.p25), c = pos(b.stats.p75), m = pos(b.stats.p50);
    return `${label}
      <rect x="${a.toFixed(1)}" y="${(cy - 5).toFixed(1)}" width="${Math.max(c - a, 2).toFixed(1)}" height="10" rx="2" fill="${COLORS.cyan}" fill-opacity="0.3"/>
      <line x1="${m.toFixed(1)}" y1="${(cy - 6).toFixed(1)}" x2="${m.toFixed(1)}" y2="${(cy + 6).toFixed(1)}" stroke="${COLORS.cyan}" stroke-width="2"/>
      <text x="${(c + 4).toFixed(1)}" y="${(cy + 2.5).toFixed(1)}" font-size="7" fill="${COLORS.gray500}" font-family="${FONT}">${fmt(b.stats.p50, unit)}</text>
      ${nText}`;
  }).join('');

  const markerSvg = marker != null && Number.isFinite(marker)
    ? `<line x1="${pos(marker).toFixed(1)}" y1="${top}" x2="${pos(marker).toFixed(1)}" y2="${axisY - 8}" stroke="${COLORS.teal}" stroke-width="1" stroke-dasharray="3,2"/>
       ${buckets.map((_, i) => { const cy = top + i * rowH + rowH / 2; const x = pos(marker); return `<polygon points="${x},${cy - 5} ${x + 5},${cy} ${x},${cy + 5} ${x - 5},${cy}" fill="${COLORS.teal}" stroke="${COLORS.white}" stroke-width="1"/>`; }).join('')}`
    : '';

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Distribution by bucket" data-uid="${uid}">
      ${axis}
      ${rowsSvg}
      ${markerSvg}
    </svg>
  `;
}
