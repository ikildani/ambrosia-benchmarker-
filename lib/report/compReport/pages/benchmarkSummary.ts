import {
  formatUsd,
  COLORS,
  pageHeader,
  pageFooter,
  escapeHtml,
  parseDealValue,
} from '../../helpers';
import { renderRangeBar } from '../../svg-charts/rangeBar';
import type { CompReportData } from '../types';

export function renderBenchmarkSummaryPage(
  data: CompReportData,
  meta: { reportId: string; currentPage: number; pageCount: number }
): string {
  const { benchmarkRange, narration, comparableDeals, hedonicResults } = data;
  const br = benchmarkRange;

  const tdvMax = br.totalDealValue.p75 * 1.4;
  const upfrontMax = br.upfront.p75 * 1.4;

  const tdvRangeBar = renderRangeBar(
    { low: br.totalDealValue.p25, median: br.totalDealValue.median, high: br.totalDealValue.p75 },
    tdvMax, 460, 44
  );
  const upfrontRangeBar = renderRangeBar(
    { low: br.upfront.p25, median: br.upfront.median, high: br.upfront.p75 },
    upfrontMax, 460, 44
  );

  const positioning = narration?.valuationImplication
    ? escapeHtml(narration.valuationImplication)
    : `Peer median total deal value stands at ${formatUsd(br.totalDealValue.median)}, with upfront payments representing approximately ${Math.round(br.upfrontPctOfTDV)}% of total deal value across the comparable set.`;

  // Deal structure analysis from comp data
  const dealsByType = analyzeDealTypes(hedonicResults.map(h => h.deal));
  const yearDistribution = analyzeYearDistribution(hedonicResults.map(h => h.deal));

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, 'Comparable Transaction Analysis')}

      <div class="section-title-lg" style="margin-bottom: 16px;">Benchmark Summary</div>

      <!-- KPI Cards -->
      <div style="display: grid; grid-template-columns: 1fr 1fr 1fr 1fr; gap: 10px; margin-bottom: 18px;">
        ${kpiCard('Median TDV', formatUsd(br.totalDealValue.median), `P25–P75: ${formatUsd(br.totalDealValue.p25)}–${formatUsd(br.totalDealValue.p75)}`, COLORS.teal)}
        ${kpiCard('Median Upfront', formatUsd(br.upfront.median), `P25–P75: ${formatUsd(br.upfront.p25)}–${formatUsd(br.upfront.p75)}`, COLORS.cyan)}
        ${kpiCard('Comp Count', `n=${br.compCount}`, `${br.yearRange.min}–${br.yearRange.max}`, COLORS.purple)}
        ${kpiCard('Upfront / TDV', `${Math.round(br.upfrontPctOfTDV)}%`, 'Median across comp set', COLORS.amber)}
      </div>

      <!-- Range Bars -->
      <div class="card" style="padding: 16px 20px; margin-bottom: 14px; border-top: 3px solid ${COLORS.navy};">
        <div class="section-title" style="margin-bottom: 12px;">Benchmark Range Distribution</div>

        <div style="margin-bottom: 16px;">
          <div style="font-size: 8px; font-weight: 700; color: ${COLORS.gray500}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 6px;">Total Deal Value</div>
          ${tdvRangeBar}
        </div>

        <div>
          <div style="font-size: 8px; font-weight: 700; color: ${COLORS.gray500}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 6px;">Upfront Payment</div>
          ${upfrontRangeBar}
        </div>

        <div style="margin-top: 8px; font-size: 7.5px; color: ${COLORS.gray400};">
          Diamond markers indicate the median. Shaded region spans the interquartile range (P25–P75).
        </div>
      </div>

      <!-- Deal Structure & Year Distribution side by side -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 14px;">
        <!-- Deal Type Breakdown -->
        <div class="card" style="padding: 14px 18px; border-left: 3px solid ${COLORS.purple};">
          <div style="font-size: 8px; font-weight: 700; color: ${COLORS.gray500}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 10px;">Deal Type Distribution</div>
          ${dealsByType.map(dt => `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <div style="flex: 1; height: 6px; background: ${COLORS.gray100}; border-radius: 3px; overflow: hidden;">
                <div style="width: ${dt.pct}%; height: 100%; background: ${dt.color}; border-radius: 3px;"></div>
              </div>
              <span style="font-size: 8px; font-weight: 700; color: ${COLORS.navy}; min-width: 28px; text-align: right;">${dt.pct}%</span>
              <span style="font-size: 8px; color: ${COLORS.gray600}; min-width: 70px;">${dt.label} (${dt.count})</span>
            </div>
          `).join('')}
        </div>

        <!-- Year Distribution -->
        <div class="card" style="padding: 14px 18px; border-left: 3px solid ${COLORS.cyan};">
          <div style="font-size: 8px; font-weight: 700; color: ${COLORS.gray500}; text-transform: uppercase; letter-spacing: 0.12em; margin-bottom: 10px;">Recency Distribution</div>
          ${yearDistribution.map(yd => `
            <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 6px;">
              <span style="font-size: 8px; font-weight: 600; color: ${COLORS.navy}; min-width: 32px;">${yd.year}</span>
              <div style="flex: 1; height: 6px; background: ${COLORS.gray100}; border-radius: 3px; overflow: hidden;">
                <div style="width: ${yd.pct}%; height: 100%; background: ${yd.color}; border-radius: 3px;"></div>
              </div>
              <span style="font-size: 8px; color: ${COLORS.gray600}; min-width: 40px;">${yd.count} deal${yd.count !== 1 ? 's' : ''}</span>
            </div>
          `).join('')}
        </div>
      </div>

      <!-- Benchmark Positioning -->
      <div class="card" style="padding: 14px 18px; border-left: 3px solid ${COLORS.teal};">
        <div style="font-size: 8px; font-weight: 700; color: ${COLORS.teal}; text-transform: uppercase; letter-spacing: 0.14em; margin-bottom: 8px;">Benchmark Positioning</div>
        <div style="font-size: 10px; color: ${COLORS.gray700}; line-height: 1.7;">
          ${positioning}
        </div>
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}

function kpiCard(label: string, value: string, sub: string, accent: string): string {
  return `
    <div style="
      background: ${COLORS.white};
      border: 1px solid ${COLORS.gray200};
      border-top: 3px solid ${accent};
      border-radius: 0 0 6px 6px;
      padding: 12px 14px;
      text-align: center;
    ">
      <div style="font-size: 18px; font-weight: 800; color: ${COLORS.navy}; line-height: 1.1; letter-spacing: -0.02em;">${value}</div>
      <div style="font-size: 7.5px; font-weight: 700; color: ${COLORS.gray500}; text-transform: uppercase; letter-spacing: 0.12em; margin-top: 5px;">${label}</div>
      <div style="font-size: 7.5px; color: ${COLORS.gray400}; margin-top: 3px;">${sub}</div>
    </div>
  `;
}

interface DealTypeStat { label: string; count: number; pct: number; color: string }

function analyzeDealTypes(deals: Array<{ dealType?: string }>): DealTypeStat[] {
  const counts: Record<string, number> = {};
  for (const d of deals) {
    const dt = d.dealType || 'other';
    counts[dt] = (counts[dt] || 0) + 1;
  }
  const total = deals.length;
  const labels: Record<string, string> = {
    licensing: 'Licensing',
    acquisition: 'Acquisition',
    codevelopment: 'Co-development',
    option: 'Option',
    collaboration: 'Collaboration',
    reformulation: 'Reformulation / 505(b)(2)',
    other: 'Other',
  };
  const colors: Record<string, string> = {
    licensing: COLORS.teal,
    acquisition: COLORS.purple,
    codevelopment: COLORS.cyan,
    option: COLORS.amber,
    collaboration: COLORS.blue,
    other: COLORS.gray400,
  };
  return Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .map(([key, count]) => ({
      label: labels[key] || key,
      count,
      pct: Math.round((count / total) * 100),
      color: colors[key] || COLORS.gray400,
    }));
}

interface YearStat { year: string; count: number; pct: number; color: string }

function analyzeYearDistribution(deals: Array<{ year: number }>): YearStat[] {
  const counts: Record<number, number> = {};
  for (const d of deals) {
    counts[d.year] = (counts[d.year] || 0) + 1;
  }
  const total = deals.length;
  const maxCount = Math.max(...Object.values(counts));
  return Object.entries(counts)
    .sort((a, b) => Number(b[0]) - Number(a[0]))
    .slice(0, 5)
    .map(([year, count]) => ({
      year,
      count,
      pct: Math.round((count / maxCount) * 100),
      color: Number(year) >= 2025 ? COLORS.teal : Number(year) >= 2024 ? COLORS.cyan : COLORS.gray400,
    }));
}
