// SVG patient funnel: horizontal bars descending from population to addressable.
// Pure string function.
//
// Widths are LOG-scaled when the largest/smallest step ratio exceeds 100×
// (a linear scale would render every step after "population" as a hairline);
// the chart says so in a footnote so the eye is not misled.

import { COLORS, escapeHtml } from '../helpers';
import type { PatientFunnel } from '@/lib/brief/types';

const FONT = 'Inter, system-ui, sans-serif';

export function renderPatientFunnel(funnel: PatientFunnel, width = 560, height = 200): string {
  const uid = `pf-${Math.random().toString(36).slice(2, 8)}`;
  const steps = funnel.steps.filter(s => Number.isFinite(s.value) && s.value > 0);
  if (steps.length === 0) {
    return `<svg id="${uid}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg"><text x="${width / 2}" y="${height / 2}" text-anchor="middle" font-size="10" fill="${COLORS.gray400}" font-family="${FONT}">No funnel steps</text></svg>`;
  }
  const labelW = 112;
  const valueW = 78;
  const padTop = 6;
  const footH = 14;
  const plotW = width - labelW - valueW - 8;
  const n = steps.length;
  const rowH = (height - padTop - footH) / n;
  const barH = Math.min(18, rowH * 0.62);

  const max = Math.max(...steps.map(s => s.value));
  const min = Math.min(...steps.map(s => s.value));
  const useLog = max / min > 100;
  const floor = min / 10; // smallest bar still gets a visible width under log scaling
  const widthOf = (v: number) => {
    if (!useLog) return Math.max(2, (v / max) * plotW);
    return Math.max(2, (Math.log10(v / floor) / Math.log10(max / floor)) * plotW);
  };

  const parts: string[] = [];
  parts.push(`<defs><linearGradient id="${uid}-g" x1="0" y1="0" x2="1" y2="0"><stop offset="0%" stop-color="${COLORS.teal}" /><stop offset="100%" stop-color="${COLORS.cyan}" /></linearGradient></defs>`);

  steps.forEach((s, i) => {
    const y = padTop + i * rowH;
    const by = y + (rowH - barH) / 2;
    const w = widthOf(s.value);
    const last = i === n - 1;
    parts.push(`<text x="${labelW - 8}" y="${by + barH / 2 + 3}" text-anchor="end" font-size="8.5" font-weight="${last ? 800 : 600}" fill="${last ? COLORS.teal : COLORS.gray700}" font-family="${FONT}">${escapeHtml(s.label)}</text>`);
    parts.push(`<rect x="${labelW}" y="${by}" width="${w}" height="${barH}" rx="3" fill="${last ? COLORS.teal : `url(#${uid}-g)`}" fill-opacity="${last ? 1 : 0.55 + 0.45 * (i / Math.max(1, n - 1))}" />`);
    parts.push(`<text x="${labelW + w + 6}" y="${by + barH / 2 + 3}" font-size="8.5" font-weight="700" fill="${COLORS.navy}" font-family="${FONT}">${Math.round(s.value).toLocaleString('en-US')}</text>`);
    // Conversion from the previous step
    if (i > 0) {
      const conv = s.value / steps[i - 1].value;
      const pct = conv >= 0.1 ? `${(conv * 100).toFixed(0)}%` : conv >= 0.01 ? `${(conv * 100).toFixed(1)}%` : `${(conv * 100).toFixed(2)}%`;
      parts.push(`<text x="${labelW + 4}" y="${by - 2}" font-size="6.5" fill="${COLORS.gray400}" font-family="${FONT}">↓ ${pct}</text>`);
    }
  });

  // Footnote
  const note = useLog ? 'Bar widths are log-scaled: the range spans more than 100×.' : 'Bar widths are proportional.';
  parts.push(`<text x="${labelW}" y="${height - 3}" font-size="6.5" fill="${COLORS.gray400}" font-family="${FONT}">${note}</text>`);

  return `<svg id="${uid}" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg" font-family="${FONT}">${parts.join('')}</svg>`;
}
