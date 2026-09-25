// Brief v3 — Pipeline map page.
// Who else is developing for this indication, how far along are they, and where does this asset sit?

import { pageHeader, pageFooter, sectionHead, chartSource, emptyState, microLabel, phaseLabelAny, escapeHtml, COLORS, BRIEF_TITLE } from '../helpers';
import { renderPipelineGrid } from '../svg-charts/pipelineGrid';
import type { PDFReportData, ReportMeta } from '../types';
import type { DealPhase, PipelineMap } from '@/lib/brief/types';

const PHASE_ORDER: DealPhase[] = ['preclinical', 'phase_1', 'phase_2', 'phase_3', 'approved'];

function kpi(value: string, label: string, sub?: string, accent = COLORS.teal): string {
  return `
    <div class="kpi-card" style="padding: 10px 8px; border-top-color: ${accent};">
      <div class="kpi-value" style="font-size: 22px; color: ${accent};">${escapeHtml(value)}</div>
      <div class="kpi-label">${escapeHtml(label)}</div>
      ${sub ? `<div class="kpi-sub">${escapeHtml(sub)}</div>` : ''}
    </div>`;
}

export function renderPipelineMapPage(data: PDFReportData, meta: ReportMeta): string {
  const map: PipelineMap | null | undefined = data.brief?.landscape?.pipeline;
  const head = sectionHead('Pipeline map', 'Who else is developing for this indication, how far along are they, and where does this asset sit?');

  if (!map) {
    return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, BRIEF_TITLE)}
      ${head}
      ${emptyState('No pipeline map for this indication', 'Fewer than three active industry or academic programs matched the indication in the trial registry, and the Terrain demand layer had no key programs to fall back on, so a bucket-by-phase map would not be meaningful. The comparable set and buyer map still apply.')}
      ${pageFooter(meta.reportId)}
    </div>`;
  }

  const allPrograms = map.rows.flatMap(r => r.cells.flatMap(c => c.programs.map(p => ({ ...p, bucket: r.bucket, phase: c.phase }))));
  const assetBucket = map.assetPosition?.bucket ?? null;
  const assetPhase = map.assetPosition?.phase ?? null;
  const assetRank = assetPhase ? PHASE_ORDER.indexOf(assetPhase) : -1;

  const atOrAhead = assetBucket && assetRank >= 0
    ? allPrograms.filter(p => p.bucket === assetBucket && PHASE_ORDER.indexOf(p.phase) >= assetRank).length
    : null;
  const buyerSponsors = new Set(allPrograms.filter(p => p.isBuyerCandidate).map(p => p.sponsor.toLowerCase()));
  const sponsorCount = new Set(allPrograms.map(p => p.sponsor.toLowerCase())).size;

  // Most advanced programs in the asset's bucket (fallback: across the map when no asset position)
  const pool = assetBucket ? allPrograms.filter(p => p.bucket === assetBucket) : allPrograms;
  const advanced = [...pool]
    .sort((a, b) => PHASE_ORDER.indexOf(b.phase) - PHASE_ORDER.indexOf(a.phase) || Number(b.isBuyerCandidate) - Number(a.isBuyerCandidate) || a.sponsor.localeCompare(b.sponsor))
    .slice(0, 4);

  const crowding = map.crowdingScore;
  const crowdingLabel = crowding == null ? '—' : crowding >= 70 ? 'Crowded' : crowding >= 40 ? 'Contested' : 'Open';
  const crowdingColor = crowding == null ? COLORS.gray400 : crowding >= 70 ? COLORS.rose : crowding >= 40 ? COLORS.amber : COLORS.teal;
  const crowdingMethod = map.crowdingBasis === 'terrain_density'
    ? "Terrain competitive density score (1–10, scaled to 100) over its full competitor database for the indication; the local trial-map formula could not be computed."
    : "Sixty points saturate at ten same-mechanism programs at or ahead of our phase; forty scale with that bucket's share of the whole map.";

  const positionLine = map.assetPosition
    ? `This asset sits in <strong>${escapeHtml(map.assetPosition.bucket)}</strong> at <strong>${escapeHtml(phaseLabelAny(map.assetPosition.phase))}</strong> (teal outline, diamond). Buyer candidates with a program are in bold navy.`
    : 'The asset\'s phase could not be placed on the grid; buyer candidates with a program are in bold navy.';

  return `
    <div class="report-page">
      ${pageHeader(meta.currentPage, meta.pageCount, BRIEF_TITLE)}
      ${head}

      <div class="card" style="padding: 12px 12px 8px;">
        <div style="display: flex; justify-content: space-between; align-items: baseline; margin-bottom: 4px;">
          ${microLabel('Active programs by mechanism bucket and phase')}
          <div style="font-size: 8px; color: ${COLORS.gray500};">Cell shade = program count</div>
        </div>
        <div class="chart-container" style="margin: 0;">${renderPipelineGrid(map, 560)}</div>
        <div style="font-size: 8.5px; color: ${COLORS.gray600}; margin-top: 6px; line-height: 1.5;">${positionLine}</div>
        ${chartSource(map.source)}
      </div>

      <div class="grid-3" style="margin-top: 12px; gap: 10px;">
        ${kpi(atOrAhead == null ? '—' : String(atOrAhead), 'At or ahead of our phase', assetBucket ? `${assetBucket} programs` : 'asset bucket unknown', COLORS.navy)}
        ${kpi(String(sponsorCount), 'Distinct sponsors', `${map.source.n} programs on the map`)}
        ${kpi(String(buyerSponsors.size), 'Buyer candidates with a program', buyerSponsors.size > 0 ? 'they know the space; expect a fast read' : 'no candidate is in the indication yet', COLORS.navy)}
      </div>

      <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 12px; margin-top: 12px;">
        <div class="card" style="padding: 0; overflow: hidden;">
          <table class="data-table" style="font-size: 9px;">
            <thead>
              <tr>
                <th>Most advanced in ${escapeHtml(assetBucket ?? 'the indication')}</th>
                <th>Intervention</th>
                <th>Phase</th>
                <th>Registry</th>
              </tr>
            </thead>
            <tbody>
              ${advanced.length === 0 ? `<tr><td colspan="4" style="color: ${COLORS.gray400};">No other active program in this bucket.</td></tr>` : advanced.map(p => `
              <tr>
                <td style="font-weight: ${p.isBuyerCandidate ? 800 : 600}; color: ${COLORS.navy};">${escapeHtml(p.sponsor)}${p.isBuyerCandidate ? ' <span class="badge badge-navy" style="font-size: 6.5px; padding: 1px 5px;">Buyer</span>' : ''}</td>
                <td>${escapeHtml(p.intervention)}</td>
                <td style="font-weight: 700; color: ${COLORS.teal};">${escapeHtml(phaseLabelAny(p.phase))}</td>
                <td style="font-family: ui-monospace, Menlo, monospace; font-size: 8px; color: ${COLORS.gray500};">${escapeHtml(p.nctId ?? '—')}</td>
              </tr>`).join('')}
            </tbody>
          </table>
        </div>
        <div class="card-sm" style="border-left: 3px solid ${crowdingColor}; display: flex; flex-direction: column; justify-content: center;">
          ${microLabel('Crowding score')}
          <div style="font-size: 26px; font-weight: 800; color: ${crowdingColor}; line-height: 1;">${crowding == null ? '—' : crowding}<span style="font-size: 10px; color: ${COLORS.gray400}; font-weight: 600;"> / 100</span></div>
          <div style="font-size: 9px; font-weight: 700; color: ${COLORS.gray700}; margin-top: 4px;">${escapeHtml(crowdingLabel)}</div>
          <div style="font-size: 8px; color: ${COLORS.gray500}; margin-top: 4px; line-height: 1.45;">${escapeHtml(crowdingMethod)}</div>
        </div>
      </div>

      ${pageFooter(meta.reportId)}
    </div>`;
}
