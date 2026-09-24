// SVG buyer quadrant: x = strategic fit (0–100), y = urgency (0–100).
// Bubble size from a capacity proxy (median prior upfront, else revenue).
// Pure string function — no DOM, no external refs, width ≤ 560.

import { COLORS, escapeHtml } from '../helpers';
import type { BuyerCandidate } from '@/lib/brief/types';

const FONT = 'Inter, system-ui, sans-serif';

interface Box { x1: number; y1: number; x2: number; y2: number }
const overlaps = (a: Box, b: Box): boolean => !(a.x2 < b.x1 || a.x1 > b.x2 || a.y2 < b.y1 || a.y1 > b.y2);

/** Size proxy in $M: median prior-deal upfront, else total revenue / 100, else null. */
function sizeProxy(c: BuyerCandidate): number | null {
  const ups = c.priorDeals.map(d => d.upfrontM).filter((v): v is number => v != null && v > 0).sort((a, b) => a - b);
  if (ups.length) return ups[Math.floor(ups.length / 2)];
  if (c.impliedUpfront?.median) return c.impliedUpfront.median;
  if (c.totalRevenueUsd && c.totalRevenueUsd > 0) return c.totalRevenueUsd / 1e6 / 100;
  return null;
}

export function renderBuyerQuadrant(candidates: BuyerCandidate[], width = 560, height = 300): string {
  const w = Math.min(560, width);
  const h = height;
  const m = { left: 36, right: 14, top: 14, bottom: 30 };
  const pw = w - m.left - m.right;
  const ph = h - m.top - m.bottom;
  const uid = `bq-${Math.random().toString(36).slice(2, 8)}`;

  const clamp = (v: number) => Math.max(0, Math.min(100, Number.isFinite(v) ? v : 0));
  const sx = (fit: number) => m.left + (clamp(fit) / 100) * pw;
  const sy = (urg: number) => m.top + ph - (clamp(urg) / 100) * ph;

  // Radius 5–14px on a sqrt scale of the size proxy.
  const proxies = candidates.map(sizeProxy);
  const maxProxy = Math.max(1, ...proxies.filter((p): p is number => p != null));
  const radius = (p: number | null): number => {
    if (p == null || p <= 0) return 6;
    return 5 + 9 * Math.sqrt(Math.min(1, p / maxProxy));
  };

  const midX = m.left + pw / 2;
  const midY = m.top + ph / 2;

  const quadrantLabel = (text: string, x: number, y: number, anchor: 'start' | 'end') =>
    `<text x="${x}" y="${y}" text-anchor="${anchor}" font-size="7" font-weight="700" letter-spacing="1.2" fill="${COLORS.gray400}" font-family="${FONT}">${text.toUpperCase()}</text>`;

  // Bubbles, drawn small-on-top so nothing hides.
  const items = candidates
    .map((c, i) => ({ c, r: radius(proxies[i]), x: sx(c.fit), y: sy(c.urgency) }))
    .sort((a, b) => b.r - a.r);

  const bubbles = items.map(({ c, r, x, y }) => {
    const title = `${escapeHtml(c.name)} · fit ${Math.round(c.fit)} · urgency ${Math.round(c.urgency)}`;
    if (c.transactsAtPhase === 'yes') {
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${COLORS.navy}" fill-opacity="0.9" stroke="${COLORS.white}" stroke-width="1"><title>${title}</title></circle>`;
    }
    if (c.transactsAtPhase === 'no') {
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${COLORS.roseLight}" stroke="${COLORS.rose}" stroke-width="1.5"><title>${title}</title></circle>`;
    }
    return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${COLORS.white}" stroke="${COLORS.navy}" stroke-width="1.5" stroke-dasharray="3,2"><title>${title}</title></circle>`;
  }).join('');

  // Labels with simple collision avoidance: try right, left, above, below;
  // alternate the first choice so neighbours spread; fall back to a stacked offset.
  const placed: Box[] = items.map(({ x, y, r }) => ({ x1: x - r, y1: y - r, x2: x + r, y2: y + r }));
  const labels: string[] = [];
  const fontSize = 7.5;
  items.forEach(({ c, r, x, y }, idx) => {
    const text = c.name.length > 22 ? `${c.name.slice(0, 21)}…` : c.name;
    const tw = text.length * fontSize * 0.56;
    const th = fontSize + 2;
    const candidatesPos: Array<{ x: number; y: number; anchor: 'start' | 'end' | 'middle' }> = [
      { x: x + r + 3, y: y + 3, anchor: 'start' },
      { x: x - r - 3, y: y + 3, anchor: 'end' },
      { x, y: y - r - 3, anchor: 'middle' },
      { x, y: y + r + fontSize + 1, anchor: 'middle' },
    ];
    if (idx % 2 === 1) candidatesPos.unshift(candidatesPos.splice(1, 1)[0]);
    let chosen = candidatesPos[0];
    let box: Box | null = null;
    for (const pos of candidatesPos) {
      const bx1 = pos.anchor === 'start' ? pos.x : pos.anchor === 'end' ? pos.x - tw : pos.x - tw / 2;
      const b: Box = { x1: bx1, y1: pos.y - th, x2: bx1 + tw, y2: pos.y + 1 };
      const inside = b.x1 >= m.left - 2 && b.x2 <= w - m.right + 2 && b.y1 >= m.top - 2 && b.y2 <= h - m.bottom + 2;
      if (inside && !placed.some(p => overlaps(p, b))) { chosen = pos; box = b; break; }
    }
    if (!box) {
      // Stack below the bubble at increasing offsets until free.
      for (let k = 1; k <= 6 && !box; k++) {
        const pos = { x: x + r + 3, y: y + 3 + k * (th + 1), anchor: 'start' as const };
        const b: Box = { x1: pos.x, y1: pos.y - th, x2: pos.x + tw, y2: pos.y + 1 };
        if (!placed.some(p => overlaps(p, b))) { chosen = pos; box = b; }
      }
      if (!box) { box = { x1: chosen.x, y1: chosen.y - th, x2: chosen.x + tw, y2: chosen.y + 1 }; }
    }
    placed.push(box);
    labels.push(`<text x="${chosen.x.toFixed(1)}" y="${chosen.y.toFixed(1)}" text-anchor="${chosen.anchor}" font-size="${fontSize}" font-weight="600" fill="${COLORS.gray700}" font-family="${FONT}">${escapeHtml(text)}</text>`);
  });

  const ticks = [0, 25, 50, 75, 100];
  const xTicks = ticks.map(t => `<text x="${sx(t).toFixed(1)}" y="${(h - m.bottom + 10).toFixed(1)}" text-anchor="middle" font-size="7" fill="${COLORS.gray400}" font-family="${FONT}">${t}</text>`).join('');
  const yTicks = ticks.map(t => `<text x="${(m.left - 6).toFixed(1)}" y="${(sy(t) + 2.5).toFixed(1)}" text-anchor="end" font-size="7" fill="${COLORS.gray400}" font-family="${FONT}">${t}</text>`).join('');

  const legend = `
    <g transform="translate(${m.left + 4},${h - 8})" font-family="${FONT}" font-size="7" fill="${COLORS.gray500}">
      <circle cx="4" cy="-2.5" r="3.5" fill="${COLORS.navy}" /><text x="11" y="0">Transacts at this phase</text>
      <circle cx="120" cy="-2.5" r="3.5" fill="${COLORS.white}" stroke="${COLORS.navy}" stroke-width="1.2" stroke-dasharray="2,1.5" /><text x="127" y="0">Unknown</text>
      <circle cx="176" cy="-2.5" r="3.5" fill="${COLORS.roseLight}" stroke="${COLORS.rose}" stroke-width="1.2" /><text x="183" y="0">Does not</text>
      <text x="240" y="0" fill="${COLORS.gray400}">Bubble = prior upfront or revenue</text>
    </g>`;

  return `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" id="${uid}">
      <rect x="${midX}" y="${m.top}" width="${pw / 2}" height="${ph / 2}" fill="${COLORS.tealLight}" fill-opacity="0.45" />
      <rect x="${m.left}" y="${m.top}" width="${pw}" height="${ph}" fill="none" stroke="${COLORS.gray200}" />
      <line x1="${midX}" y1="${m.top}" x2="${midX}" y2="${m.top + ph}" stroke="${COLORS.gray300}" stroke-dasharray="3,3" />
      <line x1="${m.left}" y1="${midY}" x2="${m.left + pw}" y2="${midY}" stroke="${COLORS.gray300}" stroke-dasharray="3,3" />
      ${quadrantLabel('Lead', w - m.right - 6, m.top + 11, 'end')}
      ${quadrantLabel('Tension', m.left + 6, m.top + 11, 'start')}
      ${quadrantLabel('Educate', w - m.right - 6, m.top + ph - 5, 'end')}
      ${quadrantLabel('Hold', m.left + 6, m.top + ph - 5, 'start')}
      ${xTicks}${yTicks}
      <text x="${(m.left + pw / 2).toFixed(1)}" y="${(h - m.bottom + 19).toFixed(1)}" text-anchor="middle" font-size="7.5" font-weight="700" fill="${COLORS.gray500}" font-family="${FONT}">STRATEGIC FIT (0–100)</text>
      <text transform="translate(9,${(m.top + ph / 2).toFixed(1)}) rotate(-90)" text-anchor="middle" font-size="7.5" font-weight="700" fill="${COLORS.gray500}" font-family="${FONT}">URGENCY (0–100)</text>
      ${bubbles}
      ${labels.join('')}
      ${legend}
    </svg>
  `;
}
