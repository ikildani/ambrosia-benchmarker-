// Decision tree: a "Today" root with one branch per inflection option.
// Edge labels carry months, cost and P(reach); leaf boxes carry the expected
// value today and the implied dilution. Recommended branch in teal.

import { COLORS, fmtM, fmtShare, escapeHtml } from '../helpers';
import { recommendedOptionKey } from '@/lib/brief/inflection';
import type { InflectionPath } from '@/lib/brief/types';

const FONT = 'Inter, system-ui, sans-serif';

export function renderDecisionTree(path: InflectionPath, width = 560, height = 230): string {
  const uid = `dt-${Math.random().toString(36).slice(2, 8)}`;
  const options = path.options;
  const recKey = recommendedOptionKey(options);

  const rootX = 22;
  const rootW = 64;
  const rootH = 30;
  const rootCy = height / 2;
  const leafW = 200;
  const leafH = 52;
  const leafX = width - leafW - 6;
  const n = Math.max(options.length, 1);
  const slot = (height - 16) / n;

  const leaves = options.map((o, i) => {
    const cy = 8 + slot * i + slot / 2;
    const isRec = o.key === recKey;
    const stroke = isRec ? COLORS.teal : COLORS.gray300;
    const fill = isRec ? COLORS.tealLight : COLORS.white;
    const edgeColor = isRec ? COLORS.teal : COLORS.gray300;
    const textColor = isRec ? COLORS.teal : COLORS.gray500;
    const x0 = rootX + rootW;
    const x1 = leafX;
    const midX = (x0 + x1) / 2;
    const edge = `<path d="M ${x0} ${rootCy} C ${midX} ${rootCy}, ${midX} ${cy}, ${x1} ${cy}" fill="none" stroke="${edgeColor}" stroke-width="${isRec ? 2 : 1.25}" />`;
    const edgeLabel = o.key === 'deal_now'
      ? 'no spend · today · certain'
      : `${o.months} mo · ${fmtM(o.costM)} · P ${fmtShare(o.pReach)}`;
    const labelY = cy < rootCy ? cy - 6 : cy + 12;
    const dil = o.dilution == null ? 'dilution n/a' : `${fmtShare(o.dilution)} dilution`;
    return `
      <g>
        ${edge}
        <text x="${midX.toFixed(1)}" y="${labelY.toFixed(1)}" text-anchor="middle" font-size="7.5" font-weight="600" fill="${textColor}" font-family="${FONT}">${escapeHtml(edgeLabel)}</text>
        <rect x="${leafX}" y="${(cy - leafH / 2).toFixed(1)}" width="${leafW}" height="${leafH}" rx="5" fill="${fill}" stroke="${stroke}" stroke-width="${isRec ? 1.5 : 1}" />
        <text x="${leafX + 10}" y="${(cy - leafH / 2 + 15).toFixed(1)}" font-size="8.5" font-weight="700" fill="${isRec ? COLORS.navy : COLORS.gray700}" font-family="${FONT}">${escapeHtml(o.label)}${isRec ? ' ·' : ''}<tspan fill="${COLORS.teal}" font-size="7"> ${isRec ? 'RECOMMENDED' : ''}</tspan></text>
        <text x="${leafX + 10}" y="${(cy - leafH / 2 + 31).toFixed(1)}" font-size="12" font-weight="800" fill="${isRec ? COLORS.teal : COLORS.navy}" font-family="${FONT}">${fmtM(o.expectedValueM)}<tspan font-size="7" font-weight="600" fill="${COLORS.gray400}"> expected value today</tspan></text>
        <text x="${leafX + 10}" y="${(cy - leafH / 2 + 44).toFixed(1)}" font-size="7.5" fill="${COLORS.gray500}" font-family="${FONT}">${fmtM(o.upfrontIfReached.median)} upfront if reached · ${escapeHtml(dil)}</text>
      </g>`;
  });

  return `
    <svg id="${uid}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" font-family="${FONT}">
      ${leaves.join('')}
      <rect x="${rootX}" y="${(rootCy - rootH / 2).toFixed(1)}" width="${rootW}" height="${rootH}" rx="15" fill="${COLORS.navy}" />
      <text x="${rootX + rootW / 2}" y="${(rootCy + 3.5).toFixed(1)}" text-anchor="middle" font-size="9" font-weight="700" fill="${COLORS.white}" font-family="${FONT}">Today</text>
    </svg>
  `;
}
