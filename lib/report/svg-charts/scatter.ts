// Comparable-set scatter: x = total deal value ($M), y = upfront ($M).
// Bubble radius from royalty midpoint, fill by phase, outliers hollow/dashed,
// the asset's ask as a teal diamond. Pure string function — no DOM.
//
// Scale decision: deal totals in one TA routinely span three orders of
// magnitude ($20M options next to $5B acquisitions). A linear axis collapses
// 80% of the set into the left 10% of the plot, so each axis switches to
// log10 when max/min of its positive values exceeds 50 and stays linear
// otherwise. Ticks are 1·10^k / 2·10^k / 5·10^k on log axes and 1-2-5 "nice"
// steps on linear axes. Rows with a null total or upfront are not plotted
// (the count is printed in the corner). Zero values on a log axis are drawn
// at the axis floor.

import { COLORS, escapeHtml } from '../helpers';
import type { CompRow, DealPhase } from '@/lib/brief/types';

export const PHASE_FILL: Record<DealPhase, string> = {
  discovery: COLORS.gray300,
  preclinical: COLORS.gray400,
  phase_1: COLORS.cyan,
  phase_2: COLORS.blue,
  phase_3: COLORS.purple,
  approved: COLORS.navy,
  unknown: COLORS.gray300,
};

const PHASE_LEGEND: Array<[DealPhase, string]> = [
  ['preclinical', 'Preclinical'], ['phase_1', 'Phase 1'], ['phase_2', 'Phase 2'], ['phase_3', 'Phase 3'], ['approved', 'Approved'],
];

const FONT = 'Inter, system-ui, sans-serif';

function fmtAxis(v: number): string {
  if (v >= 1000) return `$${(v / 1000).toFixed(v % 1000 === 0 ? 0 : 1)}B`;
  if (v >= 1) return `$${Math.round(v)}M`;
  return `$${v.toFixed(1)}M`;
}

interface Scale { pos: (v: number) => number; ticks: number[]; isLog: boolean }

function niceStep(range: number, target: number): number {
  const raw = range / Math.max(1, target);
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const r = raw / mag;
  const step = r <= 1 ? 1 : r <= 2 ? 2 : r <= 5 ? 5 : 10;
  return step * mag;
}

function makeScale(values: number[], px0: number, px1: number): Scale {
  const pos = values.filter((v) => Number.isFinite(v) && v > 0);
  const min = pos.length ? Math.min(...pos) : 1;
  const max = values.length ? Math.max(...values, 1) : 1;
  const isLog = pos.length >= 2 && max / min > 50;
  if (isLog) {
    const lo = Math.pow(10, Math.floor(Math.log10(min)));
    const hi = Math.pow(10, Math.ceil(Math.log10(max)));
    const l0 = Math.log10(lo), l1 = Math.log10(hi);
    const ticks: number[] = [];
    for (let e = Math.log10(lo); e < l1; e += 1) {
      [1, 2, 5].forEach((m) => { const t = m * Math.pow(10, e); if (t >= lo && t <= hi) ticks.push(t); });
    }
    ticks.push(hi);
    // Headroom: a fifth of a decade above the top tick so the largest bubble
    // and its label sit inside the plot instead of on the frame.
    const span = Math.max(l1 - l0, 1) + 0.2;
    const decades = l1 - l0;
    const shown = decades > 3 ? ticks.filter((t) => Math.log10(t) % 1 === 0) : ticks;
    return {
      isLog,
      ticks: shown,
      pos: (v: number) => px0 + ((Math.log10(Math.max(v, lo)) - l0) / span) * (px1 - px0),
    };
  }
  const step = niceStep(max, 5);
  const top = (Math.ceil(max / step) * step || step) * 1.08;
  const ticks: number[] = [];
  for (let t = 0; t <= top + 1e-9; t += step) ticks.push(Number(t.toFixed(6)));
  return { isLog, ticks, pos: (v: number) => px0 + (Math.max(v, 0) / top) * (px1 - px0) };
}

function royaltyRadius(row: CompRow): number {
  const lo = row.royaltyLowPct, hi = row.royaltyHighPct;
  const mid = lo != null && hi != null ? (lo + hi) / 2 : lo ?? hi;
  if (mid == null) return 5;
  return 4 + Math.max(0, Math.min(1, mid / 25)) * 7;
}

function shortName(s: string, max = 16): string {
  const t = s.replace(/,? (inc|ltd|llc|plc|sa|ag|co|corp|corporation|limited|pharmaceuticals?|therapeutics|biosciences?)\.?$/i, '').trim();
  return t.length > max ? `${t.slice(0, max - 1)}…` : t;
}

let scatterSeq = 0;

export function renderCompScatter(
  rows: CompRow[],
  asset: { upfrontM: number; totalM: number; label: string },
  width = 560,
  height = 260,
): string {
  const uid = `cs${++scatterSeq}-${Math.random().toString(36).slice(2, 7)}`;
  const mL = 52, mR = 16, mT = 14, mB = 52;
  const px0 = mL, px1 = width - mR, py0 = height - mB, py1 = mT;

  const plotted = rows.filter((r) => r.totalM != null && r.upfrontM != null && r.totalM > 0);
  const skipped = rows.length - plotted.length;
  const xs = makeScale([...plotted.map((r) => r.totalM as number), asset.totalM], px0, px1);
  const ys = makeScale([...plotted.map((r) => r.upfrontM as number), asset.upfrontM], py0, py1);

  const grid = [
    ...xs.ticks.map((t) => `<line x1="${xs.pos(t).toFixed(1)}" y1="${py1}" x2="${xs.pos(t).toFixed(1)}" y2="${py0}" stroke="${COLORS.gray200}" stroke-width="1"/>
      <text x="${xs.pos(t).toFixed(1)}" y="${py0 + 12}" text-anchor="middle" font-size="7.5" fill="${COLORS.gray500}" font-family="${FONT}">${fmtAxis(t)}</text>`),
    ...ys.ticks.map((t) => `<line x1="${px0}" y1="${ys.pos(t).toFixed(1)}" x2="${px1}" y2="${ys.pos(t).toFixed(1)}" stroke="${COLORS.gray200}" stroke-width="1"/>
      <text x="${px0 - 5}" y="${(ys.pos(t) + 2.5).toFixed(1)}" text-anchor="end" font-size="7.5" fill="${COLORS.gray500}" font-family="${FONT}">${fmtAxis(t)}</text>`),
  ].join('');

  const sorted = [...plotted].sort((a, b) => royaltyRadius(b) - royaltyRadius(a));
  const bubbles = sorted.map((r) => {
    const cx = xs.pos(r.totalM as number).toFixed(1), cy = ys.pos(r.upfrontM as number).toFixed(1);
    const rad = royaltyRadius(r).toFixed(1);
    const fill = PHASE_FILL[r.phase] ?? COLORS.gray300;
    return r.outlier
      ? `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="${COLORS.white}" stroke="${fill}" stroke-width="1.5" stroke-dasharray="2,2"/>`
      : `<circle cx="${cx}" cy="${cy}" r="${rad}" fill="${fill}" fill-opacity="0.85" stroke="${COLORS.white}" stroke-width="1"/>`;
  }).join('');

  const ax = xs.pos(asset.totalM), ay = ys.pos(asset.upfrontM);

  // Label the three most relevant plotted rows. A label goes above its bubble
  // unless that would leave the plot, and is dropped when it would sit on the
  // ask marker's label or on a label already placed.
  const top3 = [...plotted].sort((a, b) => b.relevance - a.relevance).slice(0, 3);
  const placed: Array<{ x: number; y: number; w: number }> = [{ x: ax, y: ay, w: asset.label.length * 4.6 + 14 }];
  const labels = top3.map((r) => {
    const x = xs.pos(r.totalM as number), y = ys.pos(r.upfrontM as number);
    const rad = royaltyRadius(r);
    const text = shortName(r.licensee);
    const w = text.length * 4.4;
    const anchor = x > width * 0.75 ? 'end' : 'start';
    const lx = anchor === 'end' ? x - rad - 3 : x + rad + 3;
    const above = y - rad - 10 > py1;
    const ly = above ? y - rad - 2 : y + rad + 9;
    const cx = anchor === 'end' ? lx - w / 2 : lx + w / 2;
    const clash = placed.some((p) => Math.abs(p.y - ly) < 10 && Math.abs(p.x - cx) < (p.w + w) / 2);
    if (clash) return '';
    placed.push({ x: cx, y: ly, w });
    return `<text x="${lx.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="${anchor}" font-size="7.5" font-weight="600" fill="${COLORS.gray700}" font-family="${FONT}">${escapeHtml(text)}</text>`;
  }).join('');
  const d = 7;
  const askAnchor = ax > width * 0.75 ? 'end' : 'start';
  const askX = askAnchor === 'end' ? ax - d - 3 : ax + d + 3;
  const ask = `
    <polygon points="${ax},${ay - d} ${ax + d},${ay} ${ax},${ay + d} ${ax - d},${ay}" fill="${COLORS.teal}" stroke="${COLORS.white}" stroke-width="1.5"/>
    <text x="${askX.toFixed(1)}" y="${(ay + 3).toFixed(1)}" text-anchor="${askAnchor}" font-size="8" font-weight="700" fill="${COLORS.teal}" font-family="${FONT}">${escapeHtml(asset.label)}</text>`;

  // Legend row at the bottom
  let lx = px0;
  const ly = height - 10;
  const legendItems: string[] = [];
  PHASE_LEGEND.forEach(([k, label]) => {
    legendItems.push(`<circle cx="${lx + 4}" cy="${ly - 3}" r="3.5" fill="${PHASE_FILL[k]}"/><text x="${lx + 11}" y="${ly}" font-size="7" fill="${COLORS.gray600}" font-family="${FONT}">${label}</text>`);
    lx += 11 + label.length * 4.2 + 10;
  });
  legendItems.push(`<circle cx="${lx + 4}" cy="${ly - 3}" r="3.5" fill="${COLORS.white}" stroke="${COLORS.gray500}" stroke-dasharray="2,1.5"/><text x="${lx + 11}" y="${ly}" font-size="7" fill="${COLORS.gray600}" font-family="${FONT}">Outlier</text>`);
  lx += 11 + 7 * 4.2 + 10;
  legendItems.push(`<polygon points="${lx + 4},${ly - 7} ${lx + 8},${ly - 3} ${lx + 4},${ly + 1} ${lx},${ly - 3}" fill="${COLORS.teal}"/><text x="${lx + 11}" y="${ly}" font-size="7" fill="${COLORS.gray600}" font-family="${FONT}">${escapeHtml(asset.label)}</text>`);
  lx += 11 + asset.label.length * 4.2 + 10;
  legendItems.push(`<text x="${lx}" y="${ly}" font-size="7" fill="${COLORS.gray400}" font-family="${FONT}">Bubble size = royalty midpoint</text>`);

  // Undisclosed-terms count sits on the axis-title line, right-aligned, clear of the plot.
  const skippedNote = skipped > 0
    ? `<text x="${px1}" y="${py0 + 24}" text-anchor="end" font-size="7" fill="${COLORS.gray400}" font-family="${FONT}">${skipped} row${skipped === 1 ? '' : 's'} with undisclosed terms not plotted</text>`
    : '';

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Comparable deals: upfront vs total value">
      <defs><clipPath id="${uid}-clip"><rect x="${px0 - 12}" y="${py1 - 12}" width="${px1 - px0 + 24}" height="${py0 - py1 + 24}"/></clipPath></defs>
      ${grid}
      <line x1="${px0}" y1="${py0}" x2="${px1}" y2="${py0}" stroke="${COLORS.gray300}" stroke-width="1"/>
      <line x1="${px0}" y1="${py1}" x2="${px0}" y2="${py0}" stroke="${COLORS.gray300}" stroke-width="1"/>
      <text x="${(px0 + px1) / 2}" y="${py0 + 24}" text-anchor="middle" font-size="7.5" font-weight="600" fill="${COLORS.gray500}" font-family="${FONT}">Total deal value${xs.isLog ? ' (log scale)' : ''}</text>
      <text x="12" y="${(py0 + py1) / 2}" text-anchor="middle" font-size="7.5" font-weight="600" fill="${COLORS.gray500}" font-family="${FONT}" transform="rotate(-90 12 ${(py0 + py1) / 2})">Upfront${ys.isLog ? ' (log scale)' : ''}</text>
      <g clip-path="url(#${uid}-clip)">${bubbles}${labels}${ask}</g>
      ${skippedNote}
      ${legendItems.join('')}
    </svg>
  `;
}
