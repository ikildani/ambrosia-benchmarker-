// SVG loss-of-exclusivity calendar: one row per buyer, a year axis, a marker
// per patent cliff sized by revenue, revenue-at-risk total at the right.
// Pure string function — width ≤ 560, unique ids, no external refs.

import { COLORS, escapeHtml } from '../helpers';
import type { BuyerCandidate } from '@/lib/brief/types';

const FONT = 'Inter, system-ui, sans-serif';

const usdShort = (v: number | null | undefined): string => {
  if (v == null || !Number.isFinite(v) || v <= 0) return '—';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${Math.round(v / 1e6)}M`;
  return `$${Math.round(v / 1e3)}K`;
};

/** Height the calendar will occupy for `n` rows (so the page can budget space). */
export function loeCalendarHeight(rows: number): number {
  return 22 + Math.max(1, rows) * 24 + 6;
}

export function renderLoeCalendar(candidates: BuyerCandidate[], fromYear: number, toYear: number, width = 560): string {
  const w = Math.min(560, width);
  const rows = candidates.slice(0, 8);
  const rowH = 24;
  const top = 22;
  const labelW = 118;
  const totalW = 70;
  const plotX = labelW;
  const plotW = w - labelW - totalW;
  const h = loeCalendarHeight(rows.length);
  const uid = `loe-${Math.random().toString(36).slice(2, 8)}`;
  const from = Math.min(fromYear, toYear);
  const to = Math.max(fromYear, toYear, from + 1);
  const span = to - from;
  const xFor = (year: number) => plotX + ((year - from) / span) * plotW;

  const allRev = rows.flatMap(c => c.patentCliffs.map(p => p.revenueUsd ?? 0));
  const maxRev = Math.max(1, ...allRev);
  const rFor = (rev: number | null) => (rev && rev > 0 ? 3.5 + 5.5 * Math.sqrt(rev / maxRev) : 3);

  // Year axis: label every year when span ≤ 8, else every other year.
  const step = span <= 8 ? 1 : 2;
  const axis: string[] = [];
  for (let y = from; y <= to; y += step) {
    const x = xFor(y);
    axis.push(`<line x1="${x.toFixed(1)}" y1="${top - 4}" x2="${x.toFixed(1)}" y2="${h - 6}" stroke="${COLORS.gray200}" stroke-dasharray="2,3" />`);
    axis.push(`<text x="${x.toFixed(1)}" y="${top - 8}" text-anchor="middle" font-size="7" font-weight="600" fill="${COLORS.gray400}" font-family="${FONT}">${y}</text>`);
  }

  const body = rows.map((c, i) => {
    const y = top + i * rowH + rowH / 2;
    const name = c.name.length > 20 ? `${c.name.slice(0, 19)}…` : c.name;
    const parts: string[] = [];
    if (i % 2 === 1) parts.push(`<rect x="0" y="${(y - rowH / 2).toFixed(1)}" width="${w}" height="${rowH}" fill="${COLORS.gray50}" />`);
    parts.push(`<text x="${labelW - 8}" y="${(y + 2.5).toFixed(1)}" text-anchor="end" font-size="8" font-weight="600" fill="${COLORS.navy}" font-family="${FONT}">${escapeHtml(name)}</text>`);

    const inWindow = c.patentCliffs.filter(p => p.expiryYear >= from && p.expiryYear <= to).sort((a, b) => a.expiryYear - b.expiryYear);
    const later = c.patentCliffs.filter(p => p.expiryYear > to).sort((a, b) => a.expiryYear - b.expiryYear);
    if (inWindow.length === 0) {
      const msg = later.length ? `no cliffs in window; next ${escapeHtml(later[0].drug)} ${later[0].expiryYear}` : 'no disclosed cliffs';
      parts.push(`<text x="${(plotX + 6).toFixed(1)}" y="${(y + 2.5).toFixed(1)}" font-size="7" font-style="italic" fill="${COLORS.gray400}" font-family="${FONT}">${msg}</text>`);
    } else {
      let lastLabelEnd = -Infinity;
      inWindow.forEach((p, k) => {
        const x = xFor(p.expiryYear);
        const r = rFor(p.revenueUsd);
        parts.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${r.toFixed(1)}" fill="${COLORS.rose}" fill-opacity="0.85" stroke="${COLORS.white}" stroke-width="1"><title>${escapeHtml(p.drug)} · ${p.expiryYear} · ${usdShort(p.revenueUsd)}</title></circle>`);
        const label = p.drug.length > 14 ? `${p.drug.slice(0, 13)}…` : p.drug;
        const tw = label.length * 6.5 * 0.56;
        // Alternate label above/below when the previous label would collide.
        const above = x - tw / 2 > lastLabelEnd || k === 0;
        const ly = above ? y - r - 2.5 : y + r + 8;
        if (above) lastLabelEnd = x + tw / 2 + 4;
        parts.push(`<text x="${x.toFixed(1)}" y="${ly.toFixed(1)}" text-anchor="middle" font-size="6.5" fill="${COLORS.gray600}" font-family="${FONT}">${escapeHtml(label)}</text>`);
      });
    }

    const rar = (c.revenueAtRisk.y2026 ?? 0) + (c.revenueAtRisk.y2027 ?? 0);
    const cliffRev = inWindow.reduce((s, p) => s + (p.revenueUsd ?? 0), 0);
    const total = rar > 0 ? rar : cliffRev;
    parts.push(`<text x="${(w - 4).toFixed(1)}" y="${(y + 2.5).toFixed(1)}" text-anchor="end" font-size="8" font-weight="700" fill="${total > 0 ? COLORS.rose : COLORS.gray400}" font-family="${FONT}">${usdShort(total)}</text>`);
    return parts.join('');
  }).join('');

  return `
    <svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg" id="${uid}">
      ${axis.join('')}
      <text x="${(w - 4).toFixed(1)}" y="${top - 8}" text-anchor="end" font-size="6.5" font-weight="700" letter-spacing="0.8" fill="${COLORS.gray400}" font-family="${FONT}">AT RISK</text>
      <line x1="${plotX}" y1="${top - 4}" x2="${plotX}" y2="${h - 6}" stroke="${COLORS.gray300}" />
      ${body}
    </svg>
  `;
}
