// Brief v3 — Buyer map page: 2×2 quadrant, capacity table, LOE calendar.

import { pageHeader, pageFooter, sectionHead, chartSource, emptyState, microLabel, phaseLabelAny, fmtM, escapeHtml, COLORS, BRIEF_TITLE } from '../helpers';
import { renderBuyerQuadrant } from '../svg-charts/quadrant';
import { renderLoeCalendar } from '../svg-charts/loeCalendar';
import type { PDFReportData, ReportMeta } from '../types';
import type { BuyerCandidate } from '@/lib/brief/types';

const TYPE_LABEL: Record<string, string> = {
  large_pharma: 'Large pharma', mid_pharma: 'Mid pharma', large_biotech: 'Large biotech', mid_biotech: 'Mid biotech', specialty: 'Specialty',
};
const REGION_LABEL: Record<string, string> = {
  north_america: 'N. America', europe: 'Europe', japan: 'Japan', china: 'China', south_korea: 'Korea', latin_america: 'LatAm', asia_pacific: 'APAC', unknown: '—',
};

const usdShort = (v: number | null | undefined): string => {
  if (v == null || !Number.isFinite(v) || v <= 0) return '—';
  if (v >= 1e9) return `$${(v / 1e9).toFixed(1)}B`;
  if (v >= 1e6) return `$${Math.round(v / 1e6)}M`;
  return `$${Math.round(v / 1e3)}K`;
};

function phaseRange(c: BuyerCandidate): string {
  const lo = c.phasePreference.min ? phaseLabelAny(c.phasePreference.min) : null;
  const hi = c.phasePreference.max ? phaseLabelAny(c.phasePreference.max) : null;
  if (lo && hi && lo !== 'Unknown' && hi !== 'Unknown') return lo === hi ? lo : `${lo}–${hi}`;
  if (lo && lo !== 'Unknown') return `${lo}+`;
  if (hi && hi !== 'Unknown') return `to ${hi}`;
  return '—';
}

function verdictCell(v: BuyerCandidate['transactsAtPhase']): string {
  if (v === 'yes') return `<span style="color: ${COLORS.teal}; font-weight: 800;">&#10003;</span>`;
  if (v === 'no') return `<span style="color: ${COLORS.rose}; font-weight: 800;">&#10007;</span>`;
  return `<span style="color: ${COLORS.gray400}; font-weight: 700;">?</span>`;
}

export function renderBuyerMapPage(data: PDFReportData, meta: ReportMeta): string {
  const head = pageHeader(meta.currentPage, meta.pageCount, BRIEF_TITLE);
  const title = sectionHead('Buyer map', 'Who has the fit, the urgency, and the habit of transacting at this stage?');
  const map = data.brief?.buyerMap ?? null;

  if (!map || map.candidates.length === 0) {
    return `
      <div class="report-page">
        ${head}
        ${title}
        ${emptyState('No buyer map for this asset', 'Partner matching returned no candidates for this modality, phase and indication, so there is no fit or urgency evidence to plot. The buyer map is rebuilt when matches exist.')}
        ${pageFooter(meta.reportId)}
      </div>
    `;
  }

  const rows = map.candidates.slice(0, 10);
  const assetPhase = data.brief?.asset?.phase ? phaseLabelAny(data.brief.asset.phase) : 'this phase';
  const asOfYear = new Date(map.source.asOf).getFullYear() || new Date().getFullYear();
  const fromYear = asOfYear;
  const toYear = asOfYear + 8;
  const cliffCount = rows.reduce((s, c) => s + c.patentCliffs.length, 0);

  const th = (label: string, align = 'left') => `<th style="padding: 5px 7px; text-align: ${align}; font-size: 7px;">${escapeHtml(label)}</th>`;
  const td = (html: string, align = 'left', extra = '') => `<td style="padding: 4px 7px; text-align: ${align}; font-size: 8.5px; ${extra}">${html}</td>`;

  const tableRows = rows.map(c => {
    const rar = (c.revenueAtRisk.y2026 ?? 0) + (c.revenueAtRisk.y2027 ?? 0);
    const rarFromCliffs = c.patentCliffs.filter(p => p.expiryYear >= 2026 && p.expiryYear <= 2027).reduce((s, p) => s + (p.revenueUsd ?? 0), 0);
    const rarShown = rar > 0 ? rar : rarFromCliffs;
    const muted = c.transactsAtPhase === 'no' ? `color: ${COLORS.gray400};` : '';
    return `
      <tr>
        ${td(`<span style="font-weight: 700; color: ${c.transactsAtPhase === 'no' ? COLORS.gray400 : COLORS.navy};">${escapeHtml(c.name)}</span>`, 'left', muted)}
        ${td(escapeHtml(c.companyType ? (TYPE_LABEL[c.companyType] ?? c.companyType) : '—'), 'left', muted)}
        ${td(escapeHtml(c.hqRegion ? (REGION_LABEL[c.hqRegion] ?? c.hqRegion) : (c.hqCountry ?? '—')), 'left', muted)}
        ${td(`<span style="font-weight: 700;">${Math.round(c.fit)}</span>`, 'center', muted)}
        ${td(`<span style="font-weight: 700;">${Math.round(c.urgency)}</span>`, 'center', muted)}
        ${td(String(c.dealsLast12mo), 'center', muted)}
        ${td(usdShort(rarShown), 'right', muted)}
        ${td(escapeHtml(phaseRange(c)), 'center', muted)}
        ${td(verdictCell(c.transactsAtPhase), 'center')}
        ${td(c.impliedUpfront ? `<span style="font-weight: 700; color: ${COLORS.navy};">${fmtM(c.impliedUpfront.median)}</span>` : '—', 'right', muted)}
      </tr>`;
  }).join('');

  return `
    <div class="report-page">
      ${head}
      ${title}

      <div class="card" style="padding: 10px 12px 8px; margin-bottom: 10px;">
        ${microLabel(`Fit vs urgency · bubbles filled where the buyer has transacted at ${assetPhase}`)}
        <div class="chart-container" style="margin: 2px 0 0;">${renderBuyerQuadrant(rows, 560, 250)}</div>
        ${chartSource({ source: map.source.source, n: rows.length, asOf: map.source.asOf, note: 'fit from partner matching; urgency = revenue at risk 40, deal cadence 25, intent 25, BD hiring 10' })}
      </div>

      <div class="card" style="padding: 0; overflow: hidden; margin-bottom: 10px;">
        <table class="data-table" style="font-size: 8.5px;">
          <thead>
            <tr>
              ${th('Buyer')}${th('Type')}${th('Region')}${th('Fit', 'center')}${th('Urgency', 'center')}${th('Deals 12m', 'center')}${th('At risk 2026–27', 'right')}${th('Phase range', 'center')}${th(`Transacts at ${assetPhase}`, 'center')}${th('Implied upfront', 'right')}
            </tr>
          </thead>
          <tbody>${tableRows}</tbody>
        </table>
        <div style="padding: 0 10px 8px;">
          ${chartSource({ source: map.source.source, n: map.source.n, asOf: map.source.asOf, note: map.source.note })}
        </div>
      </div>

      <div class="card" style="padding: 10px 12px 8px;">
        ${microLabel(`Loss-of-exclusivity calendar ${fromYear}–${toYear} · marker size = revenue on the expiring product`)}
        <div class="chart-container" style="margin: 2px 0 0;">${renderLoeCalendar(rows, fromYear, toYear, 560)}</div>
        ${chartSource({ source: 'Company filings via Solidus company profiles', n: cliffCount, asOf: map.source.asOf, note: cliffCount === 0 ? 'no disclosed patent cliffs on these buyers' : 'disclosed cliffs only; undisclosed products are not shown' })}
      </div>

      ${pageFooter(meta.reportId)}
    </div>
  `;
}
