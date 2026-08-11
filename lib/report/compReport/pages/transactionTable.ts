import {
  COLORS,
  pageHeader,
  pageFooter,
  escapeHtml,
  formatUsd,
  parseDealValue,
} from '../../helpers';
import type { CompReportData } from '../types';

export function renderTransactionTablePage(
  data: CompReportData,
  meta: { reportId: string; currentPage: number; pageCount: number }
): string {
  const { comparableDeals, hedonicResults } = data;
  const maxRows = 12;
  const deals = comparableDeals.slice(0, maxRows);

  if (deals.length === 0) {
    return `
      <div class="report-page">
        ${pageHeader(meta.currentPage, meta.pageCount, 'Comparable Transaction Analysis')}
        <div class="section-title-lg">Comparable Transactions</div>
        <div class="card" style="text-align: center; padding: 60px;">
          <div style="font-size: 12px; color: ${COLORS.gray400};">No comparable deals available for this asset profile.</div>
        </div>
        ${pageFooter(meta.reportId)}
      </div>
    `;
  }

  const scoreMap = new Map(hedonicResults.map(h => [h.id, h.score]));
  const dealTypeMap = new Map(hedonicResults.map(h => [h.id, h.deal.dealType]));

  const medianValues = computeMedianValues(deals);

  const dealTypeLabels: Record<string, string> = {
    licensing: 'License',
    acquisition: 'M&A',
    codevelopment: 'Co-dev',
    option: 'Option',
    collaboration: 'Collab',
    reformulation: 'Reformulation / 505(b)(2)',
  };

  const rows = deals.map((deal, i) => {
    const score = scoreMap.get(deal.id);
    const weightedScore = score?.weightedScore ?? 0;
    const maxScore = hedonicResults[0]?.score?.weightedScore ?? 1;
    const normalizedScore = Math.round((weightedScore / maxScore) * 100);

    const tdvNum = parseDealValue(deal.totalValue);
    const upfrontNum = deal.upfront ? parseDealValue(deal.upfront) : null;
    const upfrontPct = (tdvNum && upfrontNum) ? `${Math.round((upfrontNum / tdvNum) * 100)}%` : '—';

    const bgColor = i % 2 === 0 ? COLORS.white : COLORS.gray50;
    const scoreColor = normalizedScore >= 80 ? COLORS.teal
      : normalizedScore >= 60 ? COLORS.cyan
      : normalizedScore >= 40 ? COLORS.amber
      : COLORS.gray400;

    const phaseText = deal.phase ? escapeHtml(deal.phase) : '—';
    const dealType = dealTypeMap.get(deal.id);
    const dealTypeText = dealType ? (dealTypeLabels[dealType] || dealType) : '—';

    return `
      <tr style="background: ${bgColor};">
        <td style="padding: 6px 6px; font-size: 9px; font-weight: 600; color: ${COLORS.navy}; max-width: 130px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(deal.parties)}</td>
        <td style="padding: 6px 4px; font-size: 9px; color: ${COLORS.gray700}; text-align: center;">${deal.year}</td>
        <td style="padding: 6px 4px; font-size: 8.5px; color: ${COLORS.gray600}; text-align: center;">${phaseText}</td>
        <td style="padding: 6px 4px; font-size: 8.5px; color: ${COLORS.gray600}; text-align: center;">${dealTypeText}</td>
        <td style="padding: 6px 4px; font-size: 9px; color: ${COLORS.gray700}; text-align: right; font-weight: 600;">${upfrontNum != null ? formatUsd(upfrontNum) : '—'}</td>
        <td style="padding: 6px 4px; font-size: 9px; color: ${COLORS.navy}; text-align: right; font-weight: 700;">${tdvNum != null ? formatUsd(tdvNum) : escapeHtml(deal.totalValue)}</td>
        <td style="padding: 6px 4px; font-size: 8.5px; color: ${COLORS.gray500}; text-align: center;">${upfrontPct}</td>
        <td style="padding: 6px 6px; text-align: center;">
          <div style="display: inline-flex; align-items: center; gap: 3px;">
            <div style="width: 6px; height: 6px; border-radius: 50%; background: ${scoreColor};"></div>
            <span style="font-size: 8px; font-weight: 700; color: ${scoreColor};">${normalizedScore}</span>
          </div>
        </td>
      </tr>
    `;
  }).join('');

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, 'Comparable Transaction Analysis')}

      <div class="section-title-lg" style="margin-bottom: 14px;">Comparable Transactions</div>

      <div style="border: 1px solid ${COLORS.gray200}; border-radius: 6px; overflow: hidden; margin-bottom: 14px;">
        <table style="width: 100%; border-collapse: collapse; font-family: 'Inter', system-ui, sans-serif;">
          <thead>
            <tr style="background: ${COLORS.navy};">
              <th style="padding: 8px 6px; font-size: 7px; font-weight: 700; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 0.1em; text-align: left;">Deal Parties</th>
              <th style="padding: 8px 4px; font-size: 7px; font-weight: 700; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 0.1em; text-align: center;">Year</th>
              <th style="padding: 8px 4px; font-size: 7px; font-weight: 700; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 0.1em; text-align: center;">Phase</th>
              <th style="padding: 8px 4px; font-size: 7px; font-weight: 700; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 0.1em; text-align: center;">Type</th>
              <th style="padding: 8px 4px; font-size: 7px; font-weight: 700; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 0.1em; text-align: right;">Upfront</th>
              <th style="padding: 8px 4px; font-size: 7px; font-weight: 700; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 0.1em; text-align: right;">Total Value</th>
              <th style="padding: 8px 4px; font-size: 7px; font-weight: 700; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 0.1em; text-align: center;">UF%</th>
              <th style="padding: 8px 6px; font-size: 7px; font-weight: 700; color: rgba(255,255,255,0.8); text-transform: uppercase; letter-spacing: 0.1em; text-align: center;">Match</th>
            </tr>
          </thead>
          <tbody>
            ${rows}
          </tbody>
          <tfoot>
            <tr style="background: ${COLORS.gray100}; border-top: 2px solid ${COLORS.gray300};">
              <td style="padding: 8px 6px; font-size: 8px; font-weight: 800; color: ${COLORS.navy}; text-transform: uppercase; letter-spacing: 0.08em;" colspan="4">Peer Median</td>
              <td style="padding: 8px 4px; font-size: 9px; font-weight: 800; color: ${COLORS.teal}; text-align: right;">${medianValues.upfront ? formatUsd(medianValues.upfront) : '—'}</td>
              <td style="padding: 8px 4px; font-size: 9px; font-weight: 800; color: ${COLORS.teal}; text-align: right;">${formatUsd(medianValues.totalValue)}</td>
              <td style="padding: 8px 4px; font-size: 9px; font-weight: 800; color: ${COLORS.teal}; text-align: center;">${medianValues.upfrontPct ?? '—'}</td>
              <td style="padding: 8px 6px;"></td>
            </tr>
          </tfoot>
        </table>
      </div>

      <!-- Match Score Legend -->
      <div style="display: flex; align-items: center; gap: 14px; margin-bottom: 10px;">
        <span style="font-size: 7.5px; font-weight: 700; color: ${COLORS.gray500}; text-transform: uppercase; letter-spacing: 0.1em;">Match Quality:</span>
        ${scoreLegendItem(COLORS.teal, '80–100 Very Close')}
        ${scoreLegendItem(COLORS.cyan, '60–79 Close')}
        ${scoreLegendItem(COLORS.amber, '40–59 Directional')}
        ${scoreLegendItem(COLORS.gray400, '<40 Loose')}
      </div>

      <div style="font-size: 7.5px; color: ${COLORS.gray400}; line-height: 1.6;">
        Deals scored using a six-dimension hedonic regression model (phase, modality, therapeutic area, indication, territory, deal type) with recency weighting. Match scores normalized to top comparable. UF% = upfront as percentage of total deal value. Values in $M unless indicated.
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}

function scoreLegendItem(color: string, text: string): string {
  return `
    <div style="display: flex; align-items: center; gap: 3px;">
      <div style="width: 5px; height: 5px; border-radius: 50%; background: ${color};"></div>
      <span style="font-size: 7.5px; color: ${COLORS.gray500};">${text}</span>
    </div>
  `;
}

function computeMedianValues(deals: { totalValue: string; upfront?: string }[]): { totalValue: number; upfront: number | null; upfrontPct: string | null } {
  const tdvs = deals.map(d => parseDealValue(d.totalValue)).filter((v): v is number => v != null && v > 0).sort((a, b) => a - b);
  const upfronts = deals.map(d => d.upfront ? parseDealValue(d.upfront) : null).filter((v): v is number => v != null && v > 0).sort((a, b) => a - b);

  const median = (arr: number[]) => {
    if (arr.length === 0) return 0;
    const mid = Math.floor(arr.length / 2);
    return arr.length % 2 !== 0 ? arr[mid] : (arr[mid - 1] + arr[mid]) / 2;
  };

  const medTdv = median(tdvs);
  const medUpfront = upfronts.length > 0 ? median(upfronts) : null;

  return {
    totalValue: medTdv,
    upfront: medUpfront,
    upfrontPct: (medTdv > 0 && medUpfront) ? `${Math.round((medUpfront / medTdv) * 100)}%` : null,
  };
}
