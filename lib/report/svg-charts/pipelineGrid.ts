// SVG pipeline grid: modality buckets (rows) × development phases (columns).
// Pure string function. Sponsor and intervention names are untrusted → escaped.

import { COLORS, escapeHtml, phaseLabelAny } from '../helpers';
import type { PipelineMap, DealPhase } from '@/lib/brief/types';

const FONT = 'Inter, system-ui, sans-serif';
const PHASES: DealPhase[] = ['preclinical', 'phase_1', 'phase_2', 'phase_3', 'approved'];

function truncate(s: string, max: number): string {
  return s.length > max ? s.slice(0, Math.max(1, max - 1)) + '…' : s;
}

/** Cell background by program count: gray50 → tealLight → tealMid → cyan. */
function cellFill(count: number): string {
  if (count <= 0) return COLORS.gray50;
  if (count <= 2) return COLORS.tealLight;
  if (count <= 5) return COLORS.tealMid;
  return COLORS.cyan;
}

export function renderPipelineGrid(map: PipelineMap, width = 560): string {
  const uid = `pg-${Math.random().toString(36).slice(2, 8)}`;
  const labelW = 96;
  const totalW = 36;
  const headerH = 20;
  const footerH = 18;
  const cellH = 46;
  const gridW = width - labelW - totalW;
  const cellW = gridW / PHASES.length;
  const rows = map.rows;
  const height = headerH + rows.length * cellH + footerH + 4;
  const maxChars = Math.max(6, Math.floor((cellW - 10) / 4.4));

  const parts: string[] = [];

  // Column headers
  PHASES.forEach((ph, i) => {
    const x = labelW + i * cellW + cellW / 2;
    parts.push(`<text x="${x}" y="${headerH - 7}" text-anchor="middle" font-size="7" font-weight="700" letter-spacing="0.1em" fill="${COLORS.gray500}" font-family="${FONT}">${escapeHtml(phaseLabelAny(ph).toUpperCase())}</text>`);
  });
  parts.push(`<text x="${labelW + gridW + totalW - 2}" y="${headerH - 7}" text-anchor="end" font-size="7" font-weight="700" letter-spacing="0.1em" fill="${COLORS.gray500}" font-family="${FONT}">TOTAL</text>`);

  rows.forEach((row, ri) => {
    const y = headerH + ri * cellH;
    const isAssetRow = map.assetPosition?.bucket === row.bucket;
    // Row label
    parts.push(`<text x="${labelW - 8}" y="${y + cellH / 2 + 3}" text-anchor="end" font-size="8.5" font-weight="${isAssetRow ? 700 : 600}" fill="${isAssetRow ? COLORS.teal : COLORS.gray700}" font-family="${FONT}">${escapeHtml(truncate(row.bucket, 18))}</text>`);

    PHASES.forEach((ph, ci) => {
      const cell = row.cells.find(c => c.phase === ph);
      const programs = cell?.programs ?? [];
      const count = programs.length;
      const x = labelW + ci * cellW;
      const isAssetCell = isAssetRow && map.assetPosition?.phase === ph;
      const fill = cellFill(count);
      const dark = count > 5;

      parts.push(`<rect x="${x + 1}" y="${y + 1}" width="${cellW - 2}" height="${cellH - 2}" rx="3" fill="${fill}" stroke="${isAssetCell ? COLORS.teal : COLORS.white}" stroke-width="${isAssetCell ? 2 : 1}" />`);

      // Count chip
      if (count > 0) {
        parts.push(`<rect x="${x + 5}" y="${y + 5}" width="16" height="11" rx="5.5" fill="${dark ? COLORS.white : COLORS.navy}" />`);
        parts.push(`<text x="${x + 13}" y="${y + 13.2}" text-anchor="middle" font-size="7.5" font-weight="800" fill="${dark ? COLORS.navy : COLORS.white}" font-family="${FONT}">${count}</text>`);
      }

      // Asset diamond
      if (isAssetCell) {
        const dx = x + cellW - 10; const dy = y + 10;
        parts.push(`<path d="M${dx} ${dy - 5} L${dx + 5} ${dy} L${dx} ${dy + 5} L${dx - 5} ${dy} Z" fill="${COLORS.teal}" stroke="${COLORS.white}" stroke-width="1" />`);
      }

      // Up to 3 unique sponsor names, buyer candidates first
      const seen = new Set<string>();
      const sponsors: Array<{ name: string; buyer: boolean }> = [];
      for (const p of programs) {
        const k = p.sponsor.toLowerCase();
        if (seen.has(k)) continue;
        seen.add(k);
        sponsors.push({ name: p.sponsor, buyer: p.isBuyerCandidate });
      }
      sponsors.sort((a, b) => Number(b.buyer) - Number(a.buyer));
      const shown = sponsors.slice(0, 3);
      shown.forEach((s, li) => {
        const ty = y + 24 + li * 8.5;
        const color = s.buyer ? COLORS.navy : dark ? COLORS.white : COLORS.gray700;
        parts.push(`<text x="${x + 5}" y="${ty}" font-size="6.8" font-weight="${s.buyer ? 800 : 500}" fill="${color}" font-family="${FONT}">${escapeHtml(truncate(s.name, maxChars))}</text>`);
      });
      if (sponsors.length > 3) {
        parts.push(`<text x="${x + cellW - 5}" y="${y + cellH - 5}" text-anchor="end" font-size="6.5" font-weight="700" fill="${dark ? COLORS.white : COLORS.gray500}" font-family="${FONT}">+${sponsors.length - 3}</text>`);
      }
    });

    // Row total
    parts.push(`<text x="${labelW + gridW + totalW - 2}" y="${y + cellH / 2 + 3}" text-anchor="end" font-size="9" font-weight="800" fill="${COLORS.navy}" font-family="${FONT}">${row.total}</text>`);
  });

  // Column totals
  const fy = headerH + rows.length * cellH + 12;
  parts.push(`<line x1="${labelW}" y1="${fy - 9}" x2="${labelW + gridW + totalW}" y2="${fy - 9}" stroke="${COLORS.gray200}" stroke-width="1" />`);
  PHASES.forEach((ph, i) => {
    const x = labelW + i * cellW + cellW / 2;
    parts.push(`<text x="${x}" y="${fy + 2}" text-anchor="middle" font-size="8.5" font-weight="800" fill="${COLORS.navy}" font-family="${FONT}">${map.totals[ph] ?? 0}</text>`);
  });
  const grand = PHASES.reduce((s, ph) => s + (map.totals[ph] ?? 0), 0);
  parts.push(`<text x="${labelW + gridW + totalW - 2}" y="${fy + 2}" text-anchor="end" font-size="9" font-weight="800" fill="${COLORS.teal}" font-family="${FONT}">${grand}</text>`);
  parts.push(`<text x="${labelW - 8}" y="${fy + 2}" text-anchor="end" font-size="7" font-weight="700" letter-spacing="0.1em" fill="${COLORS.gray500}" font-family="${FONT}">PROGRAMS</text>`);

  return `<svg id="${uid}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" font-family="${FONT}">${parts.join('')}</svg>`;
}
