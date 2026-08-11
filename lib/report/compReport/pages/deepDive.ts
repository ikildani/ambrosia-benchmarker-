import {
  COLORS,
  pageHeader,
  pageFooter,
  escapeHtml,
  formatUsd,
  parseDealValue,
} from '../../helpers';
import type { CompReportData } from '../types';
import type { NarratedComparable } from '@/lib/ai/comparable-narrator';

export function renderDeepDivePage(
  data: CompReportData,
  meta: { reportId: string; currentPage: number; pageCount: number }
): string {
  const { comparableDeals, narration, hedonicResults } = data;
  const narratedDeals = narration?.narratedDeals ?? [];
  const topDeals = comparableDeals.slice(0, 5);

  if (topDeals.length === 0) {
    return `
      <div class="report-page">
        ${pageHeader(meta.currentPage, meta.pageCount, 'Comparable Transaction Analysis')}
        <div class="section-title-lg">Comparable Deep Dive</div>
        <div class="card" style="text-align: center; padding: 60px;">
          <div style="font-size: 12px; color: ${COLORS.gray400};">No comparable deals to analyze.</div>
        </div>
        ${pageFooter(meta.reportId)}
      </div>
    `;
  }

  const dealMap = new Map(hedonicResults.map(h => [h.id, h.deal]));

  const cards = topDeals.map((deal, i) => {
    const narrated = narratedDeals.find(n => n.dealId === deal.id) ?? narratedDeals[i];
    const rawDeal = dealMap.get(deal.id);
    return renderCompCard(deal, narrated, rawDeal, i);
  });

  // Value distribution mini-chart: horizontal bars for top 5 comps
  const valueChart = renderValueDistribution(topDeals);

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, 'Comparable Transaction Analysis')}
      <div class="section-title-lg" style="margin-bottom: 12px;">Comparable Deep Dive</div>

      <div style="display: flex; flex-direction: column; gap: 10px; margin-bottom: 16px;">
        ${cards.join('')}
      </div>

      <!-- Value Distribution Chart -->
      <div class="card" style="padding: 16px 20px; border-top: 3px solid ${COLORS.navy};">
        <div style="font-size: 8px; font-weight: 700; color: ${COLORS.gray500}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 12px;">Value Distribution — Top 5 Comparables</div>
        ${valueChart}
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}

function renderCompCard(
  deal: { id: string; parties: string; totalValue: string; upfront?: string; year: number; phase?: string; relevanceReasons: string[] },
  narrated: NarratedComparable | undefined,
  rawDeal: { relevance?: string; dealType?: string; royaltyRange?: string; territory?: string } | undefined,
  index: number
): string {
  const accentColor = index < 2 ? COLORS.teal : index < 4 ? COLORS.cyan : COLORS.purple;
  const tdvNum = parseDealValue(deal.totalValue);
  const upfrontNum = deal.upfront ? parseDealValue(deal.upfront) : null;
  const upfrontPct = (tdvNum && upfrontNum) ? Math.round((upfrontNum / tdvNum) * 100) : null;

  const adjustments = narrated?.adjustments ?? [];
  const netAdj = narrated?.netAdjustment_pct ?? 0;
  const oneLiner = narrated?.oneLineSummary ?? '';
  const hasAdjustments = adjustments.length > 0;

  const relevanceText = rawDeal?.relevance || '';
  const royaltyText = rawDeal?.royaltyRange || '';
  const dealTypeLabels: Record<string, string> = { licensing: 'License', acquisition: 'M&A', codevelopment: 'Co-dev', option: 'Option', collaboration: 'Collab', reformulation: 'Reformulation / 505(b)(2)' };
  const dealTypeText = rawDeal?.dealType ? (dealTypeLabels[rawDeal.dealType] || rawDeal.dealType) : '';

  const contextParts: string[] = [];
  if (relevanceText) contextParts.push(relevanceText);
  if (royaltyText) contextParts.push(`Royalties: ${royaltyText}`);
  const contextLine = oneLiner || contextParts.join(' · ');

  return `
    <div style="
      border: 1px solid ${COLORS.gray200};
      border-left: 4px solid ${accentColor};
      border-radius: 0 6px 6px 0;
      padding: 10px 16px 10px 14px;
      background: ${COLORS.white};
    ">
      <!-- Row 1: Header -->
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <div style="display: flex; align-items: center; gap: 6px; flex: 1; min-width: 0;">
          <div style="font-size: 10.5px; font-weight: 700; color: ${COLORS.navy}; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 185px;">${escapeHtml(deal.parties)}</div>
          <span class="badge badge-navy" style="font-size: 7px; padding: 2px 5px;">${deal.year}</span>
          ${deal.phase ? `<span class="badge badge-gray" style="font-size: 7px; padding: 2px 5px;">${escapeHtml(deal.phase)}</span>` : ''}
          ${dealTypeText ? `<span style="font-size: 7.5px; color: ${COLORS.gray500}; font-weight: 500;">${dealTypeText}</span>` : ''}
          ${deal.relevanceReasons.slice(0, 2).map(r => `<span class="badge badge-teal" style="font-size: 6.5px; padding: 1px 4px;">${escapeHtml(r)}</span>`).join('')}
        </div>
        <div style="display: flex; align-items: center; gap: 10px; flex-shrink: 0; margin-left: 10px;">
          ${deal.upfront ? `<span style="font-size: 8.5px; color: ${COLORS.gray500};">${escapeHtml(deal.upfront)} upfront${upfrontPct ? ` (${upfrontPct}%)` : ''}</span>` : ''}
          <span style="font-size: 14px; font-weight: 800; color: ${COLORS.teal};">${escapeHtml(deal.totalValue)}</span>
        </div>
      </div>

      <!-- Row 2: Context + Adjustments -->
      ${contextLine || hasAdjustments ? `
        <div style="display: flex; align-items: center; gap: 8px; margin-top: 5px;">
          ${contextLine ? `<div style="font-size: 8.5px; color: ${COLORS.gray600}; flex: 1; line-height: 1.4; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">${escapeHtml(contextLine)}</div>` : '<div style="flex:1;"></div>'}
          ${hasAdjustments ? `
            <div style="display: flex; align-items: center; gap: 4px; flex-shrink: 0;">
              ${adjustments.slice(0, 3).map(adj => {
                const arrow = adj.direction === 'premium' ? '▲' : adj.direction === 'discount' ? '▼' : '●';
                const color = adj.direction === 'premium' ? COLORS.teal : adj.direction === 'discount' ? COLORS.rose : COLORS.gray400;
                return `<span style="font-size: 7px; color: ${color}; font-weight: 600; background: ${COLORS.gray50}; padding: 1px 4px; border-radius: 2px;">${arrow}${adj.magnitude_pct > 0 ? '+' : ''}${adj.magnitude_pct}% ${escapeHtml(adj.factor)}</span>`;
              }).join('')}
              <span style="font-size: 7.5px; font-weight: 800; color: ${netAdj >= 0 ? COLORS.teal : COLORS.rose}; padding: 1px 5px; background: ${COLORS.gray50}; border: 1px solid ${COLORS.gray200}; border-radius: 2px;">Net: ${netAdj > 0 ? '+' : ''}${netAdj}%</span>
            </div>
          ` : ''}
        </div>
      ` : ''}
    </div>
  `;
}

function renderValueDistribution(deals: { parties: string; totalValue: string; upfront?: string }[]): string {
  const parsed = deals.map(d => ({
    label: d.parties.length > 30 ? d.parties.slice(0, 28) + '...' : d.parties,
    tdv: parseDealValue(d.totalValue) || 0,
    upfront: d.upfront ? parseDealValue(d.upfront) || 0 : 0,
  }));

  const maxVal = Math.max(...parsed.map(p => p.tdv), 1);
  const barMaxW = 340;
  const barH = 14;
  const rowH = 22;
  const labelW = 150;
  const valueW = 50;
  const svgH = parsed.length * rowH + 4;

  const bars = parsed.map((d, i) => {
    const y = i * rowH + 2;
    const tdvW = (d.tdv / maxVal) * barMaxW;
    const upfrontW = (d.upfront / maxVal) * barMaxW;
    return `
      <text x="0" y="${y + barH - 3}" font-size="8" fill="${COLORS.navy}" font-weight="500" font-family="Inter, system-ui, sans-serif">${d.label}</text>
      <rect x="${labelW}" y="${y}" width="${tdvW}" height="${barH}" rx="2" fill="${COLORS.gray200}" />
      ${upfrontW > 0 ? `<rect x="${labelW}" y="${y}" width="${upfrontW}" height="${barH}" rx="2" fill="${COLORS.teal}" opacity="0.7" />` : ''}
      <text x="${labelW + tdvW + 6}" y="${y + barH - 3}" font-size="8" fill="${COLORS.navy}" font-weight="700" font-family="Inter, system-ui, sans-serif">${formatUsd(d.tdv)}</text>
    `;
  }).join('');

  return `
    <svg width="100%" height="${svgH}" viewBox="0 0 560 ${svgH}" xmlns="http://www.w3.org/2000/svg">
      ${bars}
    </svg>
    <div style="display: flex; align-items: center; gap: 12px; margin-top: 6px;">
      <div style="display: flex; align-items: center; gap: 4px;">
        <div style="width: 10px; height: 6px; border-radius: 2px; background: ${COLORS.gray200};"></div>
        <span style="font-size: 7px; color: ${COLORS.gray500};">Total Deal Value</span>
      </div>
      <div style="display: flex; align-items: center; gap: 4px;">
        <div style="width: 10px; height: 6px; border-radius: 2px; background: ${COLORS.teal}; opacity: 0.7;"></div>
        <span style="font-size: 7px; color: ${COLORS.gray500};">Upfront Component</span>
      </div>
    </div>
  `;
}
