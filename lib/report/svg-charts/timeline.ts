// SVG Gantt-style deal timeline chart
// Shows estimated milestones from signing to commercial launch

import { COLORS } from '../helpers';

interface TimelineMilestone {
  label: string;
  startMonth: number;
  durationMonths: number;
  color: string;
  value?: string;
}

export function renderDealTimeline(phase: string, milestones: TimelineMilestone[]): string {
  const width = 500;
  const height = milestones.length * 40 + 60;
  const leftMargin = 130;
  const rightMargin = 20;
  const topMargin = 30;
  const barHeight = 20;
  const rowHeight = 40;
  const chartWidth = width - leftMargin - rightMargin;

  // Find max month for scale
  const maxMonth = Math.max(...milestones.map(m => m.startMonth + m.durationMonths));
  const scale = chartWidth / maxMonth;

  // Build gradient defs for each unique color
  const uniqueColors = [...new Set(milestones.map(m => m.color))];
  const gradientDefs = uniqueColors.map((c, i) => {
    // Lighten the color by mixing toward white
    return `
      <linearGradient id="tlGrad${i}" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stop-color="${c}" />
        <stop offset="100%" stop-color="${c}" stop-opacity="0.7" />
      </linearGradient>
    `;
  }).join('');
  const colorToGrad = (c: string) => `url(#tlGrad${uniqueColors.indexOf(c)})`;

  // Year gridlines
  const yearLines: string[] = [];
  for (let year = 1; year <= Math.ceil(maxMonth / 12); year++) {
    const x = leftMargin + year * 12 * scale;
    yearLines.push(`
      <line x1="${x}" y1="${topMargin - 5}" x2="${x}" y2="${topMargin + milestones.length * rowHeight}" stroke="${COLORS.gray200}" stroke-dasharray="3,3" />
      <text x="${x}" y="${topMargin - 10}" text-anchor="middle" font-size="9" fill="${COLORS.gray400}" font-weight="600">Year ${year}</text>
    `);
  }

  // Milestone bars
  const bars = milestones.map((m, i) => {
    const y = topMargin + i * rowHeight;
    const x = leftMargin + m.startMonth * scale;
    const w = Math.max(m.durationMonths * scale, 2);
    const textY = y + barHeight / 2 + 3.5;

    return `
      <text x="${leftMargin - 8}" y="${textY}" text-anchor="end" font-size="10" fill="${COLORS.gray600}" font-weight="600">${m.label}</text>
      <rect x="${x}" y="${y}" width="${w}" height="${barHeight}" rx="3" fill="${colorToGrad(m.color)}" filter="url(#tlShadow)" />
      ${m.value ? `<text x="${x + w + 5}" y="${textY}" font-size="9" fill="${COLORS.gray500}" font-weight="600">${m.value}</text>` : ''}
    `;
  }).join('');

  return `
    <svg width="${width}" height="${height}" viewBox="0 0 ${width} ${height}" xmlns="http://www.w3.org/2000/svg">
      <defs>
        ${gradientDefs}
        <filter id="tlShadow" x="-2%" y="-4%" width="104%" height="112%">
          <feDropShadow dx="0" dy="1" stdDeviation="1.5" flood-opacity="0.08" />
        </filter>
      </defs>
      <!-- Axis line -->
      <line x1="${leftMargin}" y1="${topMargin - 5}" x2="${leftMargin}" y2="${topMargin + milestones.length * rowHeight}" stroke="${COLORS.gray300}" />
      <!-- Year gridlines -->
      ${yearLines.join('')}
      <!-- Milestone bars -->
      ${bars}
      <!-- Start label -->
      <text x="${leftMargin}" y="${topMargin - 10}" text-anchor="middle" font-size="9" fill="${COLORS.gray400}" font-weight="600">Signing</text>
    </svg>
  `;
}

export function getDefaultMilestones(phase: string, therapeuticArea: string): TimelineMilestone[] {
  const milestones: TimelineMilestone[] = [];

  // Phase-dependent timeline
  switch (phase) {
    case 'preclinical':
      milestones.push(
        { label: 'IND-Enabling', startMonth: 0, durationMonths: 12, color: COLORS.purple },
        { label: 'IND Filing', startMonth: 12, durationMonths: 3, color: COLORS.blue },
        { label: 'Phase 1', startMonth: 15, durationMonths: 18, color: COLORS.teal },
        { label: 'Phase 2', startMonth: 33, durationMonths: 24, color: COLORS.teal },
        { label: 'Phase 3', startMonth: 57, durationMonths: 30, color: COLORS.cyan },
        { label: 'NDA/BLA', startMonth: 87, durationMonths: 12, color: COLORS.amber },
        { label: 'Commercial', startMonth: 99, durationMonths: 12, color: COLORS.green },
      );
      break;
    case 'phase1':
      milestones.push(
        { label: 'Phase 1 Comp.', startMonth: 0, durationMonths: 12, color: COLORS.teal },
        { label: 'Phase 2', startMonth: 12, durationMonths: 24, color: COLORS.teal },
        { label: 'Phase 3', startMonth: 36, durationMonths: 30, color: COLORS.cyan },
        { label: 'NDA/BLA', startMonth: 66, durationMonths: 12, color: COLORS.amber },
        { label: 'Commercial', startMonth: 78, durationMonths: 12, color: COLORS.green },
      );
      break;
    case 'phase2':
      milestones.push(
        { label: 'Phase 2 Comp.', startMonth: 0, durationMonths: 12, color: COLORS.teal },
        { label: 'Phase 3', startMonth: 12, durationMonths: 30, color: COLORS.cyan },
        { label: 'NDA/BLA', startMonth: 42, durationMonths: 12, color: COLORS.amber },
        { label: 'Commercial', startMonth: 54, durationMonths: 12, color: COLORS.green },
      );
      break;
    case 'phase3':
      milestones.push(
        { label: 'Phase 3 Comp.', startMonth: 0, durationMonths: 18, color: COLORS.cyan },
        { label: 'NDA/BLA', startMonth: 18, durationMonths: 12, color: COLORS.amber },
        { label: 'Approval', startMonth: 30, durationMonths: 3, color: COLORS.green },
        { label: 'Commercial', startMonth: 33, durationMonths: 12, color: COLORS.green },
      );
      break;
    case 'approved':
      milestones.push(
        { label: 'Launch Prep', startMonth: 0, durationMonths: 6, color: COLORS.amber },
        { label: 'Commercial', startMonth: 6, durationMonths: 24, color: COLORS.green },
        { label: 'Peak Sales', startMonth: 30, durationMonths: 36, color: COLORS.teal },
      );
      break;
    default:
      milestones.push(
        { label: 'Development', startMonth: 0, durationMonths: 24, color: COLORS.teal },
        { label: 'Regulatory', startMonth: 24, durationMonths: 12, color: COLORS.amber },
        { label: 'Commercial', startMonth: 36, durationMonths: 12, color: COLORS.green },
      );
  }

  return milestones;
}
