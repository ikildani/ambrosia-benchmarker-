// Page: Strategic analysis
// Deal memo (executive summary, valuation rationale, market context, risk
// factors, negotiation priorities). When only a playbook exists the page shows
// an excerpt of it instead; when both exist the playbook is not repeated here
// because the Negotiation strategy section renders it in full.
// Risk factors and priorities run full width; a very long memo flows the two
// lists onto a "(continued)" page rather than off the sheet.

import { pageHeader, pageFooter, COLORS, escapeHtml, BRIEF_TITLE } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';

type Memo = NonNullable<PDFReportData['memoData']>;
type Playbook = NonNullable<PDFReportData['playbookData']>;

const RISKS_MAX = 3;
const PRIORITIES_MAX = 3;
const SNIPPET_MAX = 200;

/** Usable px below the page title, conservative (true max ≈ 936). */
const PAGE_BUDGET = 860;

const lines = (s: string, perLine: number) => Math.max(1, Math.ceil(s.length / perLine));

/**
 * Layout units. The two lists are packed item by item so a card can continue
 * onto the next page ("Risk Factors (continued)") instead of overflowing when
 * a single list is taller than a sheet.
 */
type Block =
  | { kind: 'summary' }
  | { kind: 'context' }
  | { kind: 'risks'; items: string[]; from: number }
  | { kind: 'priorities'; items: string[]; from: number };

const LIST_CARD_OVERHEAD = 10 + 19 + 10 + 10; // card padding + heading + margin
const listItemH = (t: string) => lines(t, 118) * 15 + 3;

function estimateSummary(memo: Memo): number {
  return 20 + 24 + 8 + lines(memo.executive_summary, 118) * 18.7 + 14;
}
function estimateContext(memo: Memo): number {
  const snippet = (t: string) => lines(t.slice(0, SNIPPET_MAX + 3), 56) * 16;
  return 10 + 18 + Math.max(snippet(memo.valuation_rationale), snippet(memo.market_context)) + 10 + 14;
}

/** Greedy packing of the memo, in reading order, by estimated height. */
export function layoutAIMemoPages(memo: Memo): Block[][] {
  const pages: Block[][] = [];
  let cur: Block[] = [];
  let used = 0;
  const flush = () => { if (cur.length > 0) { pages.push(cur); cur = []; used = 0; } };
  const place = (b: Block, h: number) => { if (cur.length > 0 && used + h > PAGE_BUDGET) flush(); cur.push(b); used += h; };

  place({ kind: 'summary' }, estimateSummary(memo));
  place({ kind: 'context' }, estimateContext(memo));

  const packList = (kind: 'risks' | 'priorities', all: string[]) => {
    let i = 0;
    while (i < all.length) {
      let avail = PAGE_BUDGET - used - LIST_CARD_OVERHEAD;
      let take = 0;
      let h = 0;
      while (i + take < all.length && h + listItemH(all[i + take]) <= avail) { h += listItemH(all[i + take]); take++; }
      if (take === 0) {
        if (cur.length > 0) { flush(); continue; }
        take = 1; h = listItemH(all[i]); // a single item taller than a page: place it anyway
      }
      cur.push({ kind, items: all.slice(i, i + take), from: i });
      used += LIST_CARD_OVERHEAD + h;
      i += take;
      avail = 0;
    }
  };
  packList('risks', memo.risk_factors.slice(0, RISKS_MAX));
  packList('priorities', memo.negotiation_priorities.slice(0, PRIORITIES_MAX));
  flush();
  return pages;
}

/** Physical pages the memo section produces (always at least the placeholder). */
export function countAIMemoPages(data: PDFReportData): number {
  const memo = data.memoData;
  if (!memo) return 1;
  return layoutAIMemoPages(memo).length;
}

function renderSummaryBlock(memo: Memo): string {
  return `
    <!-- Executive Summary -->
    <div style="background: linear-gradient(145deg, ${COLORS.navy} 0%, #252a5e 100%); border-radius: 6px; padding: 18px 22px; color: white; margin-bottom: 14px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <div style="font-size: 7px; color: rgba(255,255,255,0.4); text-transform: uppercase; letter-spacing: 0.16em; font-weight: 700;">Executive Summary</div>
        <span class="badge ${memo.confidence_level === 'high' ? 'badge-teal' : memo.confidence_level === 'medium' ? 'badge-amber' : 'badge-rose'}">
          ${memo.confidence_level.toUpperCase()} CONFIDENCE
        </span>
      </div>
      <div style="font-size: 11px; color: rgba(255,255,255,0.75); line-height: 1.7;">${escapeHtml(memo.executive_summary)}</div>
    </div>`;
}

function renderContextBlock(memo: Memo): string {
  return `
    <!-- Valuation Rationale + Market Context -->
    <div class="grid-2" style="margin-bottom: 14px;">
      <div class="card-sm">
        <div style="font-size: 10px; font-weight: 700; color: ${COLORS.navy}; margin-bottom: 4px;">Valuation Rationale</div>
        <div style="font-size: 10px; color: ${COLORS.gray600}; line-height: 1.6;">${escapeHtml(memo.valuation_rationale.length > SNIPPET_MAX ? memo.valuation_rationale.substring(0, SNIPPET_MAX) + '...' : memo.valuation_rationale)}</div>
      </div>
      <div class="card-sm">
        <div style="font-size: 10px; font-weight: 700; color: ${COLORS.navy}; margin-bottom: 4px;">Market Context</div>
        <div style="font-size: 10px; color: ${COLORS.gray600}; line-height: 1.6;">${escapeHtml(memo.market_context.length > SNIPPET_MAX ? memo.market_context.substring(0, SNIPPET_MAX) + '...' : memo.market_context)}</div>
      </div>
    </div>`;
}

function renderListCard(label: string, color: string, items: string[], continued: boolean): string {
  return `
    <div class="card-sm" style="border-left: 3px solid ${color}; margin-bottom: 10px;">
      <div style="font-size: 9px; font-weight: 700; color: ${color}; text-transform: uppercase; letter-spacing: 0.08em; margin-bottom: 5px;">${label}${continued ? ' (continued)' : ''}</div>
      <ul class="bullet-list" style="font-size: 10px;">
        ${items.map(r => `<li>${escapeHtml(r)}</li>`).join('')}
      </ul>
    </div>`;
}

function renderBlock(memo: Memo, block: Block): string {
  switch (block.kind) {
    case 'summary': return renderSummaryBlock(memo);
    case 'context': return renderContextBlock(memo);
    case 'risks': return renderListCard('Risk Factors', COLORS.rose, block.items, block.from > 0);
    case 'priorities': return renderListCard('Negotiation Priorities', COLORS.teal, block.items, block.from > 0);
  }
}

function renderPlaybookExcerpt(playbook: Playbook): string {
  const sections = playbook.sections;
  const sectionEntries = [
    { key: 'openingPosition', data: sections.openingPosition },
    { key: 'structureStrategy', data: sections.structureStrategy },
    { key: 'royaltyFloor', data: sections.royaltyFloor },
    { key: 'competitiveIntelligence', data: sections.competitiveIntelligence },
    { key: 'partnerTactics', data: sections.partnerTactics },
  ];

  return `
    <div class="section-title" style="margin-top: 4px;">Negotiation Playbook</div>
    <div class="grid-2">
      ${sectionEntries.slice(0, 4).map(s => `
        <div class="card-sm" style="border-left: 3px solid ${COLORS.navy};">
          <div style="font-size: 10px; font-weight: 700; color: ${COLORS.navy}; margin-bottom: 4px;">${escapeHtml(s.data.title)}</div>
          <div style="font-size: 10px; color: ${COLORS.gray600}; line-height: 1.5; margin-bottom: 5px;">${escapeHtml(s.data.content.substring(0, 250))}${s.data.content.length > 250 ? '...' : ''}</div>
          ${s.data.highlight ? `
          <div class="callout" style="padding: 5px 8px; font-size: 8px;">
            <strong>Key:</strong> ${escapeHtml(s.data.highlight)}
          </div>
          ` : ''}
        </div>
      `).join('')}
    </div>
    `;
}

const titleBlock = (continued: boolean) => `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px;">
        <div class="section-title-lg" style="margin-bottom: 0;">Strategic analysis${continued ? ` <span style="font-size: 11px; font-weight: 600; color: ${COLORS.gray400};">(continued)</span>` : ''}</div>
      </div>`;

/** Multi-page renderer: one `.report-page` per physical page, numbered from meta.currentPage. */
export function renderAIMemoPages(data: PDFReportData, meta: ReportMeta): string[] {
  const { memoData, playbookData } = data;

  // Fallback if no analysis is available
  if (!memoData && !playbookData) {
    return [`
      <div class="report-page">
        ${pageHeader(meta.currentPage, meta.pageCount, BRIEF_TITLE)}
        ${titleBlock(false)}
        <div class="card" style="text-align: center; padding: 40px;">
          <div style="font-size: 12px; color: ${COLORS.gray400}; margin-bottom: 6px;">Deal analysis not yet generated for this report.</div>
          <div style="font-size: 10px; color: ${COLORS.gray400};">Visit solidus.ambrosiaventures.co to generate a negotiation playbook and deal memo.</div>
        </div>
        ${pageFooter(meta.reportId)}
      </div>
    `];
  }

  // Playbook only: the excerpt is the page (the full playbook follows in Negotiation strategy).
  if (!memoData && playbookData) {
    return [`
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, BRIEF_TITLE)}
      ${titleBlock(false)}
      ${renderPlaybookExcerpt(playbookData)}
      ${pageFooter(meta.reportId)}
    </div>
  `];
  }

  const memo = memoData as Memo;
  return layoutAIMemoPages(memo).map((blocks, i) => `
    <div class="report-page">
      ${pageHeader(meta.currentPage + i, meta.pageCount, BRIEF_TITLE)}
      ${titleBlock(i > 0)}
      ${blocks.map(b => renderBlock(memo, b)).join('')}
      ${pageFooter(meta.reportId)}
    </div>
  `);
}

/** Legacy single-string entry point — joins the physical pages. Prefer renderAIMemoPages. */
export function renderAIMemoPage(data: PDFReportData, meta: ReportMeta): string {
  return renderAIMemoPages(data, meta).join('\n');
}
