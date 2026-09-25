/**
 * XLSX export of any asset list (feed selection or watchlist) with a
 * provenance sheet. Server-side only (exceljs, no file-saver). Pure: takes
 * rows, returns a workbook; the route streams it.
 */

import ExcelJS from 'exceljs';
import { label, fmtDate } from './format';
import { peerGroupLabel } from '@/lib/radar/client/score-copy';
import type { ScoreDriver } from '@/lib/radar/types';

export interface ExportAssetRow {
  id: string;
  asset_name: string;
  company_name: string;
  originator_country?: string | null;
  originator_region?: string | null;
  therapeutic_area?: string | null;
  indication_category?: string | null;
  indication_specific?: string | null;
  modality?: string | null;
  target?: string | null;
  mechanism?: string | null;
  phase?: string | null;
  trial_status?: string | null;
  trial_count?: number | null;
  enrollment_total?: number | null;
  partnership_status?: string | null;
  partner_company_name?: string | null;
  territory_rights_available?: string[] | null;
  licensing_intent_score?: number | string | null;
  score_probability?: number | string | null;
  score_pct_peer?: number | string | null;
  score_peer_key?: string | null;
  score_base_rate?: number | string | null;
  score_top_drivers?: ScoreDriver[] | null;
  score_confidence?: number | string | null;
  deal_readiness_score?: number | string | null;
  competitive_heat?: number | string | null;
  last_update_date?: string | null;
  last_scored_at?: string | null;
  nct_ids?: string[] | null;
  /** Watchlist-only columns. */
  priority?: string | null;
  tags?: string[] | null;
  watch_notes?: string | null;
  watch_owner?: string | null;
  added_at?: string | null;
}

export interface ExportProvenance {
  source: 'watchlist' | 'selection' | 'feed';
  scope?: 'mine' | 'team';
  generated_at: string;
  requested_by: string;
  base_url: string;
  filters?: Record<string, string | number | boolean | null | undefined>;
  model_version?: string | null;
  row_count: number;
}

export const ASSET_SHEET = 'Assets';
export const PROVENANCE_SHEET = 'Provenance';

export const ASSET_COLUMNS: Array<{ header: string; key: string; width: number }> = [
  { header: 'Asset', key: 'asset_name', width: 28 },
  { header: 'Company', key: 'company_name', width: 28 },
  { header: 'Country', key: 'country', width: 14 },
  { header: 'Region', key: 'region', width: 14 },
  { header: 'Therapeutic area', key: 'ta', width: 18 },
  { header: 'Indication', key: 'indication', width: 24 },
  { header: 'Modality', key: 'modality', width: 16 },
  { header: 'Target', key: 'target', width: 16 },
  { header: 'Mechanism', key: 'mechanism', width: 22 },
  { header: 'Phase', key: 'phase', width: 12 },
  { header: 'Trial status', key: 'trial_status', width: 16 },
  { header: 'Trials', key: 'trial_count', width: 8 },
  { header: 'Enrollment', key: 'enrollment_total', width: 11 },
  { header: 'Partnership', key: 'partnership', width: 18 },
  { header: 'Partner', key: 'partner', width: 22 },
  { header: 'Rights available', key: 'rights', width: 20 },
  { header: 'Licensing intent (0-100)', key: 'intent', width: 14 },
  { header: 'Peer percentile', key: 'pct_peer', width: 14 },
  { header: 'Peer group', key: 'peer_group', width: 22 },
  { header: '12-month licensing probability', key: 'probability', width: 16 },
  { header: 'Peer base rate', key: 'base_rate', width: 14 },
  { header: 'Top driver', key: 'driver_1', width: 36 },
  { header: 'Second driver', key: 'driver_2', width: 36 },
  { header: 'Score confidence (0-100)', key: 'confidence', width: 14 },
  { header: 'Deal readiness', key: 'readiness', width: 12 },
  { header: 'Competitive heat', key: 'heat', width: 12 },
  { header: 'Last registry update', key: 'last_update', width: 16 },
  { header: 'Last scored', key: 'last_scored', width: 16 },
  { header: 'NCT IDs', key: 'ncts', width: 30 },
  { header: 'Brief URL', key: 'url', width: 44 },
];

export const WATCHLIST_COLUMNS: Array<{ header: string; key: string; width: number }> = [
  { header: 'Priority', key: 'priority', width: 10 },
  { header: 'Tags', key: 'tags', width: 20 },
  { header: 'Watch notes', key: 'watch_notes', width: 32 },
  { header: 'Watched by', key: 'watch_owner', width: 14 },
  { header: 'Added', key: 'added_at', width: 12 },
];

/** "runway_under_12 (+1.2): Runway 9 months per 10-Q" for the driver columns. */
function driverText(d: ScoreDriver | undefined): string | null {
  if (!d) return null;
  const pts = ``;
  return d.evidence ? ` (): ` : ` ()`;
}

function n(v: number | string | null | undefined): number | null {
  if (v == null) return null;
  const x = Number(v);
  return Number.isFinite(x) ? Math.round(x * 10) / 10 : null;
}

export function assetToExportRow(a: ExportAssetRow, baseUrl: string): Record<string, unknown> {
  return {
    asset_name: a.asset_name,
    company_name: a.company_name,
    country: a.originator_country ? label(a.originator_country) : null,
    region: a.originator_region ? label(a.originator_region) : null,
    ta: a.therapeutic_area ? label(a.therapeutic_area) : null,
    indication: a.indication_specific || (a.indication_category ? a.indication_category.replace(/_/g, ' ') : null),
    modality: a.modality ? label(a.modality) : null,
    target: a.target ?? null,
    mechanism: a.mechanism ?? null,
    phase: a.phase ? label(a.phase) : null,
    trial_status: a.trial_status ? a.trial_status.replace(/_/g, ' ') : null,
    trial_count: a.trial_count ?? null,
    enrollment_total: a.enrollment_total ?? null,
    partnership: a.partnership_status ? label(a.partnership_status) : null,
    partner: a.partner_company_name ?? null,
    rights: (a.territory_rights_available || []).join(', ') || null,
    intent: n(a.licensing_intent_score),
    pct_peer: n(a.score_pct_peer),
    peer_group: peerGroupLabel(a.score_peer_key),
    probability: n(a.score_probability),
    base_rate: n(a.score_base_rate),
    driver_1: driverText(a.score_top_drivers?.[0]),
    driver_2: driverText(a.score_top_drivers?.[1]),
    confidence: n(a.score_confidence),
    readiness: n(a.deal_readiness_score),
    heat: n(a.competitive_heat),
    last_update: a.last_update_date ? fmtDate(a.last_update_date) : null,
    last_scored: a.last_scored_at ? fmtDate(a.last_scored_at) : null,
    ncts: (a.nct_ids || []).join(', ') || null,
    url: `${baseUrl}/radar/${a.id}`,
    priority: a.priority ?? null,
    tags: (a.tags || []).join(', ') || null,
    watch_notes: a.watch_notes ?? null,
    watch_owner: a.watch_owner ?? null,
    added_at: a.added_at ? fmtDate(a.added_at) : null,
  };
}

export function buildAssetListWorkbook(rows: ExportAssetRow[], provenance: ExportProvenance): ExcelJS.Workbook {
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Solidus Asset Radar';
  wb.created = new Date(provenance.generated_at);

  const ws = wb.addWorksheet(ASSET_SHEET, { views: [{ state: 'frozen', ySplit: 1 }] });
  const columns = provenance.source === 'watchlist' ? [...WATCHLIST_COLUMNS, ...ASSET_COLUMNS] : ASSET_COLUMNS;
  ws.columns = columns;
  ws.getRow(1).font = { bold: true };
  ws.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE5E7EB' } };
  ws.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: columns.length } };
  for (const r of rows) ws.addRow(assetToExportRow(r, provenance.base_url));
  for (const key of ['intent', 'confidence', 'readiness', 'heat']) {
    const col = ws.getColumn(key);
    if (col) col.numFmt = '0.0';
  }

  const ps = wb.addWorksheet(PROVENANCE_SHEET);
  ps.columns = [{ header: 'Field', key: 'field', width: 28 }, { header: 'Value', key: 'value', width: 80 }];
  ps.getRow(1).font = { bold: true };
  const lines: Array<[string, string]> = [
    ['Generated by', 'Solidus Asset Radar'],
    ['Generated at (UTC)', provenance.generated_at],
    ['Requested by', provenance.requested_by],
    ['Source', provenance.source + (provenance.scope ? ` (${provenance.scope})` : '')],
    ['Rows', String(provenance.row_count)],
    ['Score model', provenance.model_version || 'per-asset; see brief'],
    ['Licensing intent', '0-100 composite of nine evidence factors x phase prior x rights availability. Confidence is evidence completeness, not accuracy.'],
    ['Predicted terms', 'Only from the calculator comparable-deals engine (n >= 5 comps); not included in list exports. Open each brief for comps with sources.'],
    ['Data sources', 'ClinicalTrials.gov and ex-US registries (trials), SEC EDGAR and company press (signals), Solidus deals database (comps), GSRS / ChEMBL (drug identity).'],
    ['Filters', provenance.filters ? Object.entries(provenance.filters).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${k}=${String(v)}`).join('; ') || 'none' : 'none'],
    ['Use', 'Internal committee use. Scores are predictions from public evidence; verify partnership status and rights with the owner before outreach.'],
  ];
  for (const [field, value] of lines) ps.addRow({ field, value });
  ps.getColumn('value').alignment = { wrapText: true, vertical: 'top' };

  return wb;
}
