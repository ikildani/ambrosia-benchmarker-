// Football field: one horizontal range bar per valuation method on a common
// axis, with the ask drawn as a teal vertical line. Pure SVG string.
// Pass only bars of one basis (the page calls it once for total-basis bars and
// once for upfront-basis bars); never mix bases on one axis.

import { COLORS, fmtM, escapeHtml } from '../helpers';
import type { BridgeBar } from '@/lib/brief/types';

const FONT = 'Inter, system-ui, sans-serif';

function niceStep(rough: number): number {
  if (!(rough > 0)) return 1;
  const exp = Math.floor(Math.log10(rough));
  const base = Math.pow(10, exp);
  const f = rough / base;
  const nice = f <= 1 ? 1 : f <= 2 ? 2 : f <= 2.5 ? 2.5 : f <= 5 ? 5 : 10;
  return nice * base;
}

function barColor(key: BridgeBar['key']): string {
  switch (key) {
    case 'comps_total':
    case 'comps_upfront':
      return COLORS.gray400;
    case 'buyer_implied':
      return COLORS.navy;
    case 'headline':
      return COLORS.teal;
    default:
      return COLORS.cyan;
  }
}

export function renderFootballField(
  bars: BridgeBar[],
  ask: number,
  width = 560,
  opts?: { title?: string },
): string {
  const uid = `ff-${Math.random().toString(36).slice(2, 8)}`;
  const rowH = 26;
  const labelW = 168;
  const valueW = 112;
  const padTop = opts?.title ? 34 : 18;
  const padBottom = 22;
  const chartX = labelW;
  const chartW = width - labelW - valueW;
  const height = padTop + bars.length * rowH + padBottom;

  if (bars.length === 0) {
    return `<svg width="${width}" height="60" viewBox="0 0 ${width} 60" xmlns="http://www.w3.org/2000/svg"><text x="${width / 2}" y="34" text-anchor="middle" font-size="9" fill="${COLORS.gray400}" font-family="${FONT}">No valuation bars on this basis</text></svg>`;
  }

  const vals = bars.flatMap(b => [b.low, b.high, b.mid ?? b.low]).concat(Number.isFinite(ask) ? [ask] : []).filter(Number.isFinite);
  const minV = Math.min(...vals);
  const maxV = Math.max(...vals);
  const span = Math.max(maxV - minV, Math.abs(maxV) * 0.1, 1);
  const step = niceStep(span / 4);
  const domainLo = Math.floor((minV - span * 0.08) / step) * step;
  const domainHi = Math.ceil((maxV + span * 0.08) / step) * step;
  const x = (v: number) => chartX + ((v - domainLo) / (domainHi - domainLo)) * chartW;

  // Axis ticks
  const ticks: string[] = [];
  for (let t = domainLo; t <= domainHi + 1e-9; t += step) {
    const tx = x(t);
    ticks.push(`<line x1="${tx.toFixed(1)}" y1="${padTop - 4}" x2="${tx.toFixed(1)}" y2="${height - padBottom + 2}" stroke="${COLORS.gray100}" stroke-width="1" />`);
    ticks.push(`<text x="${tx.toFixed(1)}" y="${height - padBottom + 12}" text-anchor="middle" font-size="7" fill="${COLORS.gray400}" font-family="${FONT}">${fmtM(t)}</text>`);
  }

  // Rows
  const rows = bars.map((b, i) => {
    const y = padTop + i * rowH;
    const cy = y + rowH / 2;
    const x0 = x(Math.min(b.low, b.high));
    const x1 = x(Math.max(b.low, b.high));
    const color = barColor(b.key);
    const mid = b.mid;
    const midMark = mid != null && Number.isFinite(mid)
      ? `<line x1="${x(mid).toFixed(1)}" y1="${(cy - 7).toFixed(1)}" x2="${x(mid).toFixed(1)}" y2="${(cy + 7).toFixed(1)}" stroke="${COLORS.white}" stroke-width="2" /><line x1="${x(mid).toFixed(1)}" y1="${(cy - 7).toFixed(1)}" x2="${x(mid).toFixed(1)}" y2="${(cy + 7).toFixed(1)}" stroke="${color}" stroke-width="1" />`
      : '';
    const nLabel = b.n != null ? `<tspan fill="${COLORS.gray400}" font-weight="400"> n=${b.n.toLocaleString()}</tspan>` : '';
    const valueText = mid != null && Number.isFinite(mid)
      ? `${fmtM(b.low)} – <tspan font-weight="700" fill="${COLORS.navy}">${fmtM(mid)}</tspan> – ${fmtM(b.high)}`
      : `${fmtM(b.low)} – ${fmtM(b.high)}`;
    return `
      <g>
        <text x="${chartX - 8}" y="${(cy + 3).toFixed(1)}" text-anchor="end" font-size="8" font-weight="600" fill="${COLORS.gray700}" font-family="${FONT}">${escapeHtml(b.label)}${nLabel}</text>
        <rect x="${x0.toFixed(1)}" y="${(cy - 6).toFixed(1)}" width="${Math.max(x1 - x0, 2).toFixed(1)}" height="12" rx="3" fill="${color}" opacity="${b.key === 'headline' ? 0.9 : 0.75}" />
        ${midMark}
        <text x="${width - valueW + 8}" y="${(cy + 3).toFixed(1)}" text-anchor="start" font-size="7.5" fill="${COLORS.gray500}" font-family="${FONT}">${valueText}</text>
      </g>`;
  });

  // Ask line
  const askLine = Number.isFinite(ask) ? `
    <line x1="${x(ask).toFixed(1)}" y1="${padTop - 8}" x2="${x(ask).toFixed(1)}" y2="${height - padBottom + 2}" stroke="${COLORS.teal}" stroke-width="1.5" stroke-dasharray="4,3" />
    <rect x="${(x(ask) - 16).toFixed(1)}" y="${padTop - 18}" width="32" height="12" rx="3" fill="${COLORS.teal}" />
    <text x="${x(ask).toFixed(1)}" y="${padTop - 9}" text-anchor="middle" font-size="7" font-weight="700" fill="${COLORS.white}" font-family="${FONT}">Ask</text>
  ` : '';

  const title = opts?.title
    ? `<text x="0" y="11" font-size="8" font-weight="700" fill="${COLORS.gray500}" letter-spacing="1" font-family="${FONT}">${escapeHtml(opts.title.toUpperCase())}</text>`
    : '';

  return `
    <svg id="${uid}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" font-family="${FONT}">
      ${title}
      ${ticks.join('')}
      <line x1="${chartX}" y1="${height - padBottom + 2}" x2="${chartX + chartW}" y2="${height - padBottom + 2}" stroke="${COLORS.gray200}" stroke-width="1" />
      ${rows.join('')}
      ${askLine}
    </svg>
  `;
}
