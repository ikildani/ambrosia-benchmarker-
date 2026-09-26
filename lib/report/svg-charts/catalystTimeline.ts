// SVG catalyst timeline: month axis over the window, events as markers by kind,
// coloured by direction, with the recommended go-to-market window shaded.
// Pure string function. Titles are untrusted → escaped.

import { COLORS, escapeHtml } from '../helpers';
import type { CatalystCalendar, CatalystEvent } from '@/lib/brief/types';

const FONT = 'Inter, system-ui, sans-serif';
const MONTH_MS = 1000 * 60 * 60 * 24 * 30.44;

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, Math.max(1, max - 1)) + '…' : s;
}

function directionColor(d: CatalystEvent['direction']): string {
  if (d === 'up') return COLORS.teal;
  if (d === 'down') return COLORS.rose;
  return COLORS.gray500;
}

function marker(kind: CatalystEvent['kind'], x: number, y: number, fill: string, stroke: string, strokeW: number): string {
  const r = 5;
  switch (kind) {
    case 'readout':
      return `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}" />`;
    case 'loe':
      return `<rect x="${x - r}" y="${y - r}" width="${r * 2}" height="${r * 2}" rx="1" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}" />`;
    case 'regulatory':
      return `<path d="M${x} ${y - r - 1} L${x + r + 1} ${y + r} L${x - r - 1} ${y + r} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}" />`;
    case 'buyer_event':
    default:
      return `<path d="M${x} ${y - r - 1} L${x + r + 1} ${y} L${x} ${y + r + 1} L${x - r - 1} ${y} Z" fill="${fill}" stroke="${stroke}" stroke-width="${strokeW}" />`;
  }
}

/** Short label: "Sponsor · Intervention" for readouts, first clause otherwise. */
function shortLabel(e: CatalystEvent): string {
  const bits = e.title.split(' · ');
  if (e.kind === 'readout' && bits.length >= 2) return `${bits[0]} · ${bits[1]}`;
  return bits[0];
}

export function renderCatalystTimeline(cal: CatalystCalendar, width = 560, height = 230): string {
  const uid = `ct-${Math.random().toString(36).slice(2, 8)}`;
  const padL = 14; const padR = 14;
  const axisY = Math.round(height * 0.56);
  const start = new Date(cal.source.asOf).getTime();
  const months = cal.windowMonths;
  const end = start + months * MONTH_MS;
  const plotW = width - padL - padR;
  const xOf = (iso: string) => {
    const t = new Date(iso).getTime();
    const f = Math.max(0, Math.min(1, (t - start) / (end - start)));
    return padL + f * plotW;
  };

  const parts: string[] = [];

  // Recommended window shading
  if (cal.recommendedWindow) {
    const x1 = xOf(cal.recommendedWindow.start);
    const x2 = Math.max(x1 + 6, xOf(cal.recommendedWindow.end));
    parts.push(`<rect x="${x1}" y="${axisY - 58}" width="${x2 - x1}" height="116" rx="4" fill="${COLORS.tealLight}" fill-opacity="0.8" />`);
    parts.push(`<text x="${x1 + 4}" y="${axisY - 62}" font-size="6.5" font-weight="700" letter-spacing="0.1em" fill="${COLORS.teal}" font-family="${FONT}">GO-TO-MARKET WINDOW</text>`);
  }

  // Axis
  parts.push(`<line x1="${padL}" y1="${axisY}" x2="${padL + plotW}" y2="${axisY}" stroke="${COLORS.gray300}" stroke-width="1.2" />`);

  // Quarter ticks
  const s = new Date(cal.source.asOf);
  const tick = new Date(Date.UTC(s.getUTCFullYear(), Math.floor(s.getUTCMonth() / 3) * 3 + 3, 1));
  while (tick.getTime() <= end) {
    const x = xOf(tick.toISOString());
    const q = Math.floor(tick.getUTCMonth() / 3) + 1;
    parts.push(`<line x1="${x}" y1="${axisY - 4}" x2="${x}" y2="${axisY + 4}" stroke="${COLORS.gray400}" stroke-width="1" />`);
    parts.push(`<line x1="${x}" y1="${axisY - 52}" x2="${x}" y2="${axisY + 52}" stroke="${COLORS.gray200}" stroke-width="0.6" stroke-dasharray="2,3" />`);
    // The first quarter label is dropped when it would sit under "Today".
    if (x - padL > 30) parts.push(`<text x="${x}" y="${axisY + 14}" text-anchor="middle" font-size="7" font-weight="600" fill="${COLORS.gray500}" font-family="${FONT}">Q${q} ${String(tick.getUTCFullYear()).slice(2)}</text>`);
    tick.setUTCMonth(tick.getUTCMonth() + 3);
  }
  // Start / end labels
  parts.push(`<text x="${padL}" y="${axisY + 14}" text-anchor="start" font-size="7" font-weight="700" fill="${COLORS.navy}" font-family="${FONT}">Today</text>`);
  parts.push(`<text x="${padL + plotW}" y="${axisY + 14}" text-anchor="end" font-size="7" font-weight="600" fill="${COLORS.gray500}" font-family="${FONT}">+${months}m</text>`);

  // Events with alternating labels and simple lane-based overlap avoidance.
  // Lanes: above near, below near, above far, below far. A label is placed in the
  // first lane whose last label ends before this x; otherwise the marker is drawn unlabelled.
  const lanes = [
    { dy: -22, lastEnd: -Infinity },
    { dy: 30, lastEnd: -Infinity },
    { dy: -40, lastEnd: -Infinity },
    { dy: 48, lastEnd: -Infinity },
  ];
  const sorted = [...cal.events].sort((a, b) => a.date.localeCompare(b.date));
  const charW = 3.6;
  sorted.forEach((e, i) => {
    const x = xOf(e.date);
    const col = directionColor(e.direction);
    const stroke = e.isBuyerCandidate ? COLORS.navy : COLORS.white;
    const strokeW = e.isBuyerCandidate ? 2 : 1;
    const label = truncate(shortLabel(e), 24);
    const labelW = label.length * charW;

    // Prefer alternating: even → above, odd → below; fall back through lanes.
    const order = i % 2 === 0 ? [0, 1, 2, 3] : [1, 0, 3, 2];
    let lane: (typeof lanes)[number] | null = null;
    for (const li of order) {
      const cand = lanes[li];
      const startX = Math.max(padL, Math.min(x - labelW / 2, padL + plotW - labelW));
      if (startX > cand.lastEnd + 4) { lane = cand; cand.lastEnd = startX + labelW; break; }
    }

    parts.push(marker(e.kind, x, axisY, col, stroke, strokeW));
    if (lane) {
      const startX = Math.max(padL, Math.min(x - labelW / 2, padL + plotW - labelW));
      const ly = axisY + lane.dy;
      const connectorEnd = lane.dy < 0 ? ly + 3 : ly - 7;
      parts.push(`<line x1="${x}" y1="${axisY + (lane.dy < 0 ? -6 : 6)}" x2="${x}" y2="${connectorEnd}" stroke="${COLORS.gray300}" stroke-width="0.7" />`);
      parts.push(`<text x="${startX}" y="${ly}" font-size="6.8" font-weight="${e.isBuyerCandidate ? 800 : 500}" fill="${e.isBuyerCandidate ? COLORS.navy : COLORS.gray700}" font-family="${FONT}">${escapeHtml(label)}</text>`);
    }
  });

  // Legend
  const ly = height - 8;
  const legend: Array<[CatalystEvent['kind'], string]> = [['readout', 'Readout'], ['loe', 'Exclusivity loss'], ['regulatory', 'Regulatory'], ['buyer_event', 'Buyer event']];
  let lx = padL;
  legend.forEach(([kind, text]) => {
    parts.push(marker(kind, lx + 5, ly - 3, COLORS.gray400, COLORS.white, 1));
    parts.push(`<text x="${lx + 14}" y="${ly}" font-size="6.8" fill="${COLORS.gray500}" font-family="${FONT}">${text}</text>`);
    lx += 14 + text.length * charW + 14;
  });
  const dirs: Array<[string, string]> = [[COLORS.teal, 'Reprices up'], [COLORS.rose, 'Reprices down'], [COLORS.gray500, 'Mixed']];
  dirs.forEach(([c, text]) => {
    parts.push(`<rect x="${lx}" y="${ly - 8}" width="8" height="8" rx="2" fill="${c}" />`);
    parts.push(`<text x="${lx + 12}" y="${ly}" font-size="6.8" fill="${COLORS.gray500}" font-family="${FONT}">${text}</text>`);
    lx += 12 + text.length * charW + 12;
  });
  parts.push(`<circle cx="${lx + 5}" cy="${ly - 4}" r="4" fill="${COLORS.gray400}" stroke="${COLORS.navy}" stroke-width="2" />`);
  parts.push(`<text x="${lx + 14}" y="${ly}" font-size="6.8" fill="${COLORS.gray500}" font-family="${FONT}">Buyer candidate</text>`);

  return `<svg id="${uid}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" font-family="${FONT}">${parts.join('')}</svg>`;
}
