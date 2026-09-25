// Brief v3 — Buyer stage behaviour page: prior deals per buyer, excluded list, process.

import { pageHeader, pageFooter, sectionHead, chartSource, emptyState, microLabel, phaseLabelAny, fmtM, escapeHtml, COLORS, BRIEF_TITLE } from '../helpers';
import type { PDFReportData, ReportMeta } from '../types';
import type { BuyerCandidate, BuyerPriorDeal } from '@/lib/brief/types';
import { isLargeBucket, isMidBucket } from '@/lib/brief/buyer-map';

const TYPE_LABEL: Record<string, string> = {
  large_pharma: 'Large pharma', mid_pharma: 'Mid pharma', large_biotech: 'Large biotech', mid_biotech: 'Mid biotech', specialty: 'Specialty',
};

/** "Large pharma · large-cap" / "Mid biotech · mid-sized" / "Mid-sized (by revenue)" when the type is undisclosed. */
function sizeTag(c: BuyerCandidate): string {
  const size = isMidBucket(c.sizeBucket) ? 'mid-sized' : isLargeBucket(c.sizeBucket) ? 'large-cap' : null;
  const type = c.companyType ? (TYPE_LABEL[c.companyType] ?? c.companyType) : null;
  const text = type && size ? `${type} · ${size}` : size ? `${size[0].toUpperCase()}${size.slice(1)} (by revenue)` : type ?? 'Size undisclosed';
  const color = isMidBucket(c.sizeBucket) ? COLORS.teal : COLORS.gray500;
  return `<span style="font-size: 6.5px; font-weight: 700; letter-spacing: 0.06em; text-transform: uppercase; color: ${color}; margin-left: 6px; white-space: nowrap;">${escapeHtml(text)}</span>`;
}

const STRUCTURE_LABEL: Record<string, string> = {
  license: 'License', option: 'Option', acquisition: 'Acquisition', collaboration: 'Collaboration', co_development: 'Co-dev', co_promotion: 'Co-promo', other: 'Other',
};

function sourceHost(url: string | null): string {
  if (!url) return '—';
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url.replace(/^https?:\/\//, '').split('/')[0] || '—';
  }
}

function priorDealsTable(deals: BuyerPriorDeal[]): string {
  const th = (t: string, align = 'left') => `<th style="padding: 3px 5px; font-size: 6.5px; text-align: ${align}; letter-spacing: 0.06em;">${escapeHtml(t)}</th>`;
  const td = (html: string, align = 'left') => `<td style="padding: 3px 4px; font-size: 7.5px; text-align: ${align}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${html}</td>`;
  if (deals.length === 0) {
    return `<div style="font-size: 8.5px; color: ${COLORS.gray400}; font-style: italic; padding: 6px 0 2px;">No disclosed prior deals in our data for this buyer.</div>`;
  }
  const rows = deals.slice(0, 3).map(d => {
    const parties = d.parties.split(' → ')[0] || d.parties;
    return `
      <tr>
        ${td(d.year != null ? String(d.year) : '—', 'center')}
        ${td(`<span title="${escapeHtml(d.parties)}">${escapeHtml(parties)}</span>${d.sameTA ? ` <span style="color: ${COLORS.teal}; font-weight: 700;" title="same therapeutic area">&#9679;</span>` : ''}`)}
        ${td(escapeHtml(phaseLabelAny(d.phase)), 'center')}
        ${td(escapeHtml(STRUCTURE_LABEL[d.structure] ?? d.structure), 'center')}
        ${td(fmtM(d.upfrontM), 'right')}
        ${td(fmtM(d.totalM), 'right')}
        ${td(`<span style="color: ${COLORS.gray400};">${escapeHtml(sourceHost(d.sourceUrl))}</span>`)}
      </tr>`;
  }).join('');
  return `
    <table class="data-table" style="font-size: 7.5px; margin-top: 4px; table-layout: fixed; width: 100%;">
      <colgroup><col style="width: 11%"><col style="width: 29%"><col style="width: 13%"><col style="width: 15%"><col style="width: 11%"><col style="width: 10%"><col style="width: 11%"></colgroup>
      <thead><tr>${th('Year', 'center')}${th('Licensor')}${th('Phase', 'center')}${th('Structure', 'center')}${th('Upfront', 'right')}${th('Total', 'right')}${th('Source')}</tr></thead>
      <tbody>${rows}</tbody>
    </table>`;
}

function buyerCard(c: BuyerCandidate, rank: number): string {
  const verdictColor = c.transactsAtPhase === 'yes' ? COLORS.teal : c.transactsAtPhase === 'no' ? COLORS.rose : COLORS.gray400;
  const verdictText = c.transactsAtPhase === 'yes' ? 'Transacts at stage' : c.transactsAtPhase === 'no' ? 'Not at this stage' : 'Stage unproven';
  const premium = c.counterpartyPremium && c.counterpartyPremium.confidence !== 'low'
    ? `<span style="font-size: 7px; color: ${COLORS.gray500}; margin-left: 6px;">pays ${c.counterpartyPremium.multiplier.toFixed(2)}× market (n=${c.counterpartyPremium.n})</span>`
    : '';
  return `
    <div class="card" style="padding: 8px 10px; border-top: 3px solid ${verdictColor}; page-break-inside: avoid; min-width: 0; overflow: hidden;">
      <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 3px;">
        <div style="font-size: 10px; font-weight: 800; color: ${COLORS.navy}; letter-spacing: -0.01em;">${rank}. ${escapeHtml(c.name)}${sizeTag(c)}${premium}${c.source === 'deal_history' ? `<span style="font-size: 6.5px; font-weight: 600; color: ${COLORS.gray400}; letter-spacing: 0.04em; margin-left: 4px; white-space: nowrap;">from deal history</span>` : ''}</div>
        <div style="font-size: 6.5px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: ${verdictColor}; white-space: nowrap;">${verdictText}</div>
      </div>
      <div style="font-size: 8.5px; color: ${COLORS.gray700}; line-height: 1.4; margin-bottom: 2px;"><span style="font-weight: 700; color: ${COLORS.gray500};">Why now.</span> ${escapeHtml(c.whyNow)}</div>
      <div style="font-size: 8.5px; color: ${COLORS.gray700}; line-height: 1.4;"><span style="font-weight: 700; color: ${COLORS.gray500};">How to engage.</span> ${escapeHtml(c.howToEngage)}</div>
      ${priorDealsTable(c.priorDeals)}
    </div>`;
}

export function renderBuyerBehaviourPage(data: PDFReportData, meta: ReportMeta): string {
  const head = pageHeader(meta.currentPage, meta.pageCount, BRIEF_TITLE);
  const title = sectionHead('Buyer stage behaviour', 'What has each buyer actually paid for assets at this stage, and how do we sequence the approach?');
  const map = data.brief?.buyerMap ?? null;

  if (!map || map.candidates.length === 0) {
    return `
      <div class="report-page">
        ${head}
        ${title}
        ${emptyState('No buyer behaviour to report', 'Without partner matches there are no buyers to look up in the deal database, so prior-deal evidence, exclusions and a process sequence cannot be shown.')}
        ${pageFooter(meta.reportId)}
      </div>
    `;
  }

  const top = map.candidates.slice(0, 6);
  const assetPhase = data.brief?.asset?.phase ? phaseLabelAny(data.brief.asset.phase) : 'this phase';
  const list = (names: string[]) => names.length
    ? names.map(n => `<span style="display: inline-block; background: ${COLORS.gray100}; color: ${COLORS.navy}; font-weight: 600; font-size: 8px; padding: 1px 6px; border-radius: 3px; margin: 0 3px 3px 0;">${escapeHtml(n)}</span>`).join('')
    : `<span style="font-size: 8px; color: ${COLORS.gray400};">none</span>`;
  const processRow = (label: string, names: string[], color: string) => `
    <div style="display: flex; gap: 8px; align-items: flex-start; margin-bottom: 4px;">
      <div style="width: 48px; flex-shrink: 0; font-size: 7px; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: ${color}; padding-top: 2px;">${escapeHtml(label)}</div>
      <div style="flex: 1;">${list(names)}</div>
    </div>`;

  const excludedHtml = map.excluded.length
    ? map.excluded.slice(0, 6).map(e => `
        <div style="display: flex; gap: 6px; margin-bottom: 4px; font-size: 8.5px; line-height: 1.35;">
          <span style="color: ${COLORS.rose}; font-weight: 800; flex-shrink: 0;">&#10007;</span>
          <span><span style="font-weight: 700; color: ${COLORS.navy};">${escapeHtml(e.name)}</span> <span style="color: ${COLORS.gray600};">— ${escapeHtml(e.reason)}</span></span>
        </div>`).join('')
    : `<div style="font-size: 8.5px; color: ${COLORS.gray500}; font-style: italic;">Every matched buyer either transacts at ${escapeHtml(assetPhase)} or has no evidence against it; nobody is excluded on stage.</div>`;

  return `
    <div class="report-page">
      ${head}
      ${title}

      <div class="grid-2" style="grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 8px; margin-bottom: 8px;">
        ${top.map((c, i) => buyerCard(c, i + 1)).join('')}
      </div>
      ${chartSource({ source: map.source.source, n: map.source.n, asOf: map.source.asOf, note: `up to three prior deals per buyer, same-area deals marked •; ${map.source.note ?? ''}`.trim() })}

      <div class="grid-2" style="grid-template-columns: minmax(0, 1fr) minmax(0, 1fr); gap: 10px; margin-top: 8px;">
        <div class="card" style="padding: 10px 12px; border-left: 4px solid ${COLORS.rose};">
          ${microLabel('Not on the list')}
          ${excludedHtml}
        </div>
        <div class="card-highlight" style="padding: 10px 12px;">
          ${microLabel('Process')}
          ${processRow('Lead', map.process.lead, COLORS.teal)}
          ${processRow('Tension', map.process.tension, COLORS.navy)}
          ${processRow('Hold', map.process.hold, COLORS.gray500)}
          <div style="font-size: 8.5px; color: ${COLORS.gray700}; line-height: 1.4; margin-top: 4px;">${escapeHtml(map.process.rationale)}</div>
        </div>
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
