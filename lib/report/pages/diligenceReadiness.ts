// Page: Diligence readiness — what a buyer's diligence team will ask for.

import { pageHeader, pageFooter, sectionHead, emptyState, escapeHtml, phaseLabelAny, COLORS, BRIEF_TITLE } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';
import type { DiligenceItem } from '@/lib/brief/types';

const STATUS: Record<DiligenceItem['status'], { bg: string; fg: string; label: string }> = {
  ready: { bg: COLORS.tealLight, fg: COLORS.teal, label: 'Ready' },
  gap: { bg: COLORS.roseLight, fg: '#be123c', label: 'Gap' },
  unknown: { bg: COLORS.gray100, fg: COLORS.gray500, label: 'Unknown' },
};

export function renderDiligenceReadinessPage(data: PDFReportData, meta: ReportMeta): string {
  const dl = data.brief?.diligence;
  const head = sectionHead('Diligence readiness', 'What a buyer’s diligence team will ask for, and what to close before outreach.');

  if (!dl || dl.items.length === 0) {
    return `
      <div class="report-page">
        ${pageHeader(meta.currentPage, meta.pageCount, BRIEF_TITLE)}
        ${head}
        ${emptyState('Checklist not available', 'The checklist is built from the asset’s phase and modality. The intake did not carry a modality for this run.')}
        ${pageFooter(meta.reportId)}
      </div>
    `;
  }

  const areas = Array.from(new Set(dl.items.map(i => i.area)));
  const counts = {
    ready: dl.items.filter(i => i.status === 'ready').length,
    gap: dl.items.filter(i => i.status === 'gap').length,
    expected: dl.items.filter(i => i.expectedAtPhase).length,
  };

  const groups = areas.map(area => {
    const items = dl.items.filter(i => i.area === area);
    return `
      <div style="break-inside: avoid; margin-bottom: 6px;">
        <div style="font-size: 8px; font-weight: 700; color: ${COLORS.navy}; text-transform: uppercase; letter-spacing: 0.1em; padding: 3px 0; border-bottom: 1px solid ${COLORS.gray200}; margin-bottom: 2px;">${escapeHtml(area)}</div>
        ${items.map(i => {
          const s = STATUS[i.status];
          return `
          <div style="display: flex; gap: 6px; align-items: flex-start; padding: 2px 0; font-size: 8px; line-height: 1.35; ${i.expectedAtPhase ? '' : `color: ${COLORS.gray400};`}">
            <span style="flex-shrink: 0; display: inline-block; width: 44px; text-align: center; padding: 1px 0; border-radius: 3px; font-size: 6.5px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.06em; background: ${s.bg}; color: ${s.fg};">${s.label}</span>
            <span style="flex: 1; color: ${i.expectedAtPhase ? COLORS.gray800 : COLORS.gray400};">${escapeHtml(i.item)}</span>
            ${i.expectedAtPhase ? `<span title="expected at this phase" style="flex-shrink: 0; color: ${COLORS.teal}; font-weight: 800; font-size: 8px;">&#9679;</span>` : `<span style="flex-shrink: 0; color: ${COLORS.gray300}; font-size: 8px;">&#9675;</span>`}
          </div>`;
        }).join('')}
      </div>`;
  });

  const left = groups.slice(0, Math.ceil(groups.length / 2)).join('');
  const right = groups.slice(Math.ceil(groups.length / 2)).join('');

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, BRIEF_TITLE)}
      ${head}

      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; font-size: 8.5px; color: ${COLORS.gray500};">
        <span>${escapeHtml(phaseLabelAny(dl.phase))} &middot; ${escapeHtml(dl.modality.replace(/_/g, ' '))} &middot; ${counts.expected} items expected at this phase</span>
        <span><span style="color: ${COLORS.teal}; font-weight: 700;">${counts.ready} ready</span> &middot; <span style="color: #be123c; font-weight: 700;">${counts.gap} gaps</span> &middot; <span style="color: ${COLORS.teal};">&#9679;</span> expected at this phase</span>
      </div>

      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 10px;">
        <div>${left}</div>
        <div>${right}</div>
      </div>

      <div class="${dl.gaps.length > 0 ? 'callout-amber' : 'callout'}" style="font-size: 9px;">
        <div style="font-size: 7px; font-weight: 700; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 4px;">Close before outreach</div>
        ${dl.gaps.length > 0
          ? `<ul style="margin: 0; padding-left: 14px;">${dl.gaps.slice(0, 6).map(g => `<li style="line-height: 1.45; margin-bottom: 2px;">${escapeHtml(g)}</li>`).join('')}</ul>`
          : 'Every item expected at this phase is marked ready. Confirm the data room mirrors this list before the first CDA.'}
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
