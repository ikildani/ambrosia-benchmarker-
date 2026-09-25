// Page: Negotiation strategy — the negotiation playbook, paginated.
// Sections are packed onto physical A4 pages by estimated height, so a short
// playbook stays on one page and a long one flows onto a "(continued)" page
// with the caveats and preparation note at the end.

import { pageHeader, pageFooter, COLORS, escapeHtml, formatShortDate, BRIEF_TITLE } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';

type Playbook = NonNullable<PDFReportData['playbookData']>;
type SectionKey = keyof Playbook['sections'];

const SECTION_ORDER: { key: SectionKey; icon: string; color: string }[] = [
  { key: 'openingPosition', icon: '01', color: COLORS.teal },
  { key: 'structureStrategy', icon: '02', color: COLORS.blue },
  { key: 'royaltyFloor', icon: '03', color: COLORS.purple },
  { key: 'competitiveIntelligence', icon: '04', color: COLORS.amber },
  { key: 'partnerTactics', icon: '05', color: COLORS.rose },
];

const CONTENT_MAX = 180;
const BULLETS_MAX = 2;
const CAVEATS_MAX = 3;

/**
 * Usable px below the title block. True maximum is ≈ 868 on the first page
 * (A4 content 1031 − header 56 − title block 107) and ≈ 938 on continuation
 * pages; the estimates below run 3–5% heavy against measured cards, so 830
 * keeps a safety margin on the first page.
 */
const PAGE_BUDGET = 830;

const lines = (s: string, perLine: number) => Math.max(1, Math.ceil(s.length / perLine));

// Text column is ≈ 640px wide at 10px Inter (≈ 115 chars per line).
function estimateSection(section: Playbook['sections'][SectionKey]): number {
  const contentLen = Math.min(section.content.length, CONTENT_MAX + 3);
  let h = 18 + lines(section.content.slice(0, contentLen), 115) * 16 + 6;
  for (const b of section.bullets.slice(0, BULLETS_MAX)) h += lines(b, 112) * 16 + 3;
  if (section.highlight) h += 12 + lines(`Key Insight: ${section.highlight}`, 110) * 15;
  return h + 16; // card margin
}

function estimateTrailer(playbook: Playbook): number {
  const caveats = playbook.keyCaveats.slice(0, CAVEATS_MAX);
  const caveatsH = caveats.length > 0 ? 12 + 24 + 16 + caveats.reduce((s, c) => s + lines(c, 100) * 15 + 2, 0) : 0;
  return caveatsH + 12 + 48;
}

interface NegotiationLayout {
  /** Section keys per page, in order. */
  pages: SectionKey[][];
}

export function layoutNegotiationPages(playbook: Playbook): NegotiationLayout {
  const pages: SectionKey[][] = [];
  let cur: SectionKey[] = [];
  let used = 0;
  for (const { key } of SECTION_ORDER) {
    const section = playbook.sections[key];
    if (!section) continue;
    const h = estimateSection(section);
    if (cur.length > 0 && used + h > PAGE_BUDGET) { pages.push(cur); cur = []; used = 0; }
    cur.push(key);
    used += h;
  }
  // The caveats and preparation note follow the last section; if they do not
  // fit, the last section moves with them so no page ends with a bare trailer.
  if (used + estimateTrailer(playbook) > PAGE_BUDGET && cur.length > 1) {
    const last = cur.pop() as SectionKey;
    pages.push(cur);
    cur = [last];
  }
  pages.push(cur);
  return { pages };
}

/** Physical pages the negotiation section produces (1 for the placeholder when no playbook exists). */
export function countNegotiationPages(data: PDFReportData): number {
  return data.playbookData ? layoutNegotiationPages(data.playbookData).pages.length : 1;
}

function renderSectionCard(playbook: Playbook, key: SectionKey): string {
  const section = playbook.sections[key];
  if (!section) return '';
  const { icon, color } = SECTION_ORDER.find(s => s.key === key)!;

  const bulletsHtml = section.bullets.length > 0
    ? `<ul style="margin: 6px 0 0 0; padding-left: 14px; list-style: disc;">
         ${section.bullets.slice(0, BULLETS_MAX).map(b => `<li style="font-size: 10px; color: ${COLORS.gray600}; line-height: 1.6; margin-bottom: 3px;">${escapeHtml(b)}</li>`).join('')}
       </ul>`
    : '';

  return `
      <div style="margin-bottom: 16px; page-break-inside: avoid;">
        <div style="display: flex; align-items: flex-start; gap: 12px;">
          <div style="flex-shrink: 0; width: 30px; height: 30px; border-radius: 6px; background: ${color}; display: flex; align-items: center; justify-content: center;">
            <span style="font-size: 10px; font-weight: 700; color: white;">${icon}</span>
          </div>
          <div style="flex: 1;">
            <div style="font-size: 11px; font-weight: 700; color: ${COLORS.navy}; margin-bottom: 4px;">${escapeHtml(section.title)}</div>
            <div style="font-size: 10px; color: ${COLORS.gray500}; line-height: 1.6;">${escapeHtml(section.content.length > CONTENT_MAX ? section.content.substring(0, CONTENT_MAX) + '...' : section.content)}</div>
            ${bulletsHtml}
            ${section.highlight ? `
              <div style="margin-top: 6px; padding: 5px 8px; background: ${color}10; border-left: 2px solid ${color}; border-radius: 0 3px 3px 0;">
                <span style="font-size: 9px; font-weight: 700; color: ${color}; text-transform: uppercase; letter-spacing: 0.05em;">Key Insight:</span>
                <span style="font-size: 10px; color: ${COLORS.gray600}; margin-left: 4px;">${escapeHtml(section.highlight)}</span>
              </div>
            ` : ''}
          </div>
        </div>
      </div>
  `;
}

function preparedDate(iso: string | undefined): string {
  const d = iso ? new Date(iso) : new Date();
  return formatShortDate(Number.isNaN(d.getTime()) ? new Date() : d);
}

function renderTrailer(playbook: Playbook): string {
  const { keyCaveats } = playbook;
  const caveatsHtml = keyCaveats.length > 0
    ? `<div class="callout-amber" style="margin-top: 12px;">
         <strong>Key Caveats:</strong>
         <ul style="margin: 4px 0 0 0; padding-left: 14px; list-style: disc;">
           ${keyCaveats.slice(0, CAVEATS_MAX).map(c => `<li style="font-size: 10px; line-height: 1.5;">${escapeHtml(c)}</li>`).join('')}
         </ul>
       </div>`
    : '';
  return `
      ${caveatsHtml}
      <div style="margin-top: 12px; padding: 6px 10px; background: ${COLORS.gray50}; border-radius: 4px; border: 1px solid ${COLORS.gray200};">
        <span style="font-size: 9px; color: ${COLORS.gray400};">
          Prepared ${escapeHtml(preparedDate(playbook.generatedAt))}. This playbook is for informational
          purposes only and should not substitute for professional legal or business counsel.
        </span>
      </div>
  `;
}

/** Multi-page renderer: one `.report-page` per physical page, numbered from meta.currentPage. */
export function renderNegotiationPages(data: PDFReportData, meta: ReportMeta): string[] {
  const playbook = data.playbookData;

  // No playbook: a single honest placeholder page.
  if (!playbook) {
    return [`
      <div class="report-page">
        ${pageHeader(meta.currentPage, meta.pageCount, BRIEF_TITLE)}

        <div class="section-title">NEGOTIATION PLAYBOOK</div>
        <div class="section-title-lg">Negotiation strategy</div>

        <div class="callout" style="margin-top: 24px;">
          <strong>Not Available:</strong> The Negotiation Playbook was not generated for this analysis.
          Visit solidus.ambrosiaventures.co to generate a negotiation strategy tailored to your deal parameters.
        </div>

        ${pageFooter(meta.reportId)}
      </div>
    `];
  }

  const { pages } = layoutNegotiationPages(playbook);
  const last = pages.length - 1;

  return pages.map((keys, i) => {
    const continued = i > 0;
    const titleBlock = continued
      ? `<div class="section-title-lg" style="margin-bottom: 14px;">Negotiation strategy <span style="font-size: 11px; font-weight: 600; color: ${COLORS.gray400};">(continued)</span></div>`
      : `
      <div class="section-title">NEGOTIATION PLAYBOOK</div>
      <div class="section-title-lg">Negotiation strategy</div>

      <p style="font-size: 11px; color: ${COLORS.gray500}; line-height: 1.6; margin-bottom: 18px;">
        Strategy grounded in comparable deal structures and market dynamics.
      </p>`;

    return `
    <div class="report-page">
      ${pageHeader(meta.currentPage + i, meta.pageCount, BRIEF_TITLE)}
      ${titleBlock}
      ${keys.map(k => renderSectionCard(playbook, k)).join('')}
      ${i === last ? renderTrailer(playbook) : ''}
      ${pageFooter(meta.reportId)}
    </div>
  `;
  });
}

/** Legacy single-string entry point — joins the physical pages. Prefer renderNegotiationPages. */
export function renderNegotiationPage(data: PDFReportData, meta: ReportMeta): string {
  return renderNegotiationPages(data, meta).join('\n');
}
