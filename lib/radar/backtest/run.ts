/**
 * Search & Evaluation scoring v3 — backtest harness (Supabase side).
 *
 * Driven by /api/cron/score-backtest through a cursor in radar_sync_cursors
 * (source 'score_backtest'). Phases:
 *
 *   labels     Build radar_score_label_events from the deals table (deals-first:
 *              every canonical license/option/acquisition/co_development/collaboration
 *              deal is matched to the licensor family's assets by company + asset
 *              name), plus the deal ledger (radar_deal_program_links), propagated to
 *              every row of the matched program.
 *   snapshots  Walk clinical_assets by company; for every kept asset of the feed
 *              population (all positive programs + a deterministic 8 % sample of
 *              the rest; industry owners, primary rows) fetch
 *              the company evidence once and build one feature vector per
 *              monthly as_of (2022-01 .. 2025-09) with the pure builder.
 *              Resumable: cursor = last fully processed company_id.
 *   train      Load the snapshots, fit the additive boosted-stump model (gam.ts) on
 *              as_of <= 2024-06 with early stopping + Platt calibration on
 *              (2024-06, 2024-12], test on 2025 by the feed protocol (industry
 *              programs, primary rows, ranked per month); write radar_score_models
 *              and radar_score_backtests. The gate (gateDecision) passes only when
 *              the candidate beats the active model on precision@100, top-decile
 *              lift AND AUC on the same rows; activation needs activate=1 (or
 *              activateStoredModel), never a scheduled run alone. dry_run=1 trains
 *              and reports without writing.
 *   done       No-op until reset (?reset=1) or retrain (?phase=train).
 *
 * Time budget per invocation is enforced by the caller (maxDuration 300 s,
 * MAX_RUNTIME_MS below); every phase writes its progress before returning.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { logRadarRun, deriveRunStatus } from '@/lib/radar/run-log';
import {
  FEATURE_VERSION, FEATURE_SPECS, CANDIDATE_FEATURE_SPECS, MODEL_FEATURE_NAMES,
  buildFeatureVector, fetchFeatureBundles,
  type FeatureAsset, type FeatureBundle, type CompanyGroup, type TrialRow,
} from '@/lib/radar/backtest/features';
import {
  buildLabelEvents, dealNameKeys, labelSnapshot, monthlySnapshotDates, keepNegativeAsset,
  ledgerEvents, mergeAndPropagate,
  SNAPSHOT_FROM, SNAPSHOT_TO, POSITIVE_DEAL_TYPES, LABEL_WINDOW_MONTHS,
  type LabelAsset, type LabelDeal, type LabelEvent, type LedgerLink,
} from '@/lib/radar/backtest/labels';
import {
  fitPlatt, buildModelParams, logitBatch, contributionMatrix, applyCalibration, isGamModel,
  type ModelParams,
} from '@/lib/radar/backtest/model';
import { trainGam } from '@/lib/radar/backtest/gam';
import {
  computeMetrics, computeMonthlyMetrics, factorImportance, gateDecision, toBacktestSummary,
  EVAL_PROTOCOL, MIN_POSITIVES_FOR_POWER, type MonthlyFeedMetrics,
} from '@/lib/radar/backtest/metrics';
import type { ScoreBacktestSummary } from '@/lib/radar/types';

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

export const BACKTEST_CURSOR_SOURCE = 'score_backtest';
/**
 * Asset-level negative subsampling; positives are always kept. 0.08 since v5 (was 0.03 over
 * all owners): restricted to the feed population this is a similar number of assets, and a
 * negative row now weighs 12.5 programs instead of 33, so "top 100" spans ~8 sampled negatives
 * rather than 3 and precision@100 stops being a coin flip.
 */
export const NEGATIVE_ASSET_SAMPLING_RATE = 0.08;
/** Train on as_of <= TRAIN_TO, calibrate on (TRAIN_TO, CALIB_TO], test on > CALIB_TO. */
export const TRAIN_TO = '2024-06-01';
export const CALIB_TO = '2024-12-01';
export const TEST_FROM = '2025-01-01';
/** ROC-AUC below this never activates, whatever the incumbent. */
export const MIN_AUC_TO_ACTIVATE = 0.55;
const MAX_RUNTIME_MS = 240_000;
const ASSET_PAGE = 1000;
const WAVE_ASSETS = 80;

export type BacktestPhase = 'labels' | 'snapshots' | 'train' | 'done';

export interface BacktestCursorState {
  phase: BacktestPhase;
  feature_version: string;
  sampling_rate: number;
  label_horizon: string | null;
  label_events: number;
  positive_assets: number;
  last_company_id: string | null;
  companies_done: number;
  assets_kept: number;
  snapshots_written: number;
  snapshot_from: string;
  snapshot_to: string;
  started_at: string | null;
  snapshots_finished_at: string | null;
  last_model_version: string | null;
  last_backtest_id: string | null;
  last_error: string | null;
  /** When the last train phase finished; drives the age-based rebuild. */
  trained_at?: string | null;
  /** Source-table row counts at the last train; drives the density-based rebuild. */
  source_counts_at_train?: SourceCounts | null;
  /** Where the positives came from (v5 labels phase). */
  label_sources?: { name_match: number; ledger_links: number; events: number; by_kind: Record<string, number> } | null;
  /** Population counters of the snapshots phase (v5). */
  population?: { kept_positive: number; kept_negative: number; skipped_owner: number; skipped_non_primary: number } | null;
}

/** Row counts of the tables that feed the feature vector and the labels. */
export type SourceCounts = Record<'financials' | 'intent' | 'patents' | 'labels' | 'press', number>;

/** A source growing by this share since the last train triggers a rebuild. */
export const REBUILD_GROWTH_SHARE = 0.25;
/** A model older than this is rebuilt regardless. */
export const REBUILD_MAX_AGE_DAYS = 30;

/**
 * Should the finished backtest be rebuilt from labels? The feature vector is
 * as-of-dated, so denser financial, intent, patent or press data changes the
 * historical snapshots too; only a rebuild lets the model see it. Pure, so it
 * is tested without a database.
 */
export function rebuildDecision(args: {
  countsNow: SourceCounts;
  countsThen: SourceCounts | null | undefined;
  trainedAt: string | null | undefined;
  now: Date;
}): { rebuild: boolean; reason: string | null } {
  const { countsNow, countsThen, trainedAt, now } = args;
  if (!trainedAt) return { rebuild: false, reason: null }; // nothing recorded yet: the next train stamps it
  const ageDays = (now.getTime() - Date.parse(trainedAt)) / 86_400_000;
  if (Number.isFinite(ageDays) && ageDays >= REBUILD_MAX_AGE_DAYS) {
    return { rebuild: true, reason: `model is ${Math.floor(ageDays)} days old` };
  }
  if (!countsThen) return { rebuild: false, reason: null };
  for (const key of Object.keys(countsNow) as (keyof SourceCounts)[]) {
    const then = countsThen[key] ?? 0;
    const nowN = countsNow[key] ?? 0;
    // From nothing to something counts once it is material (100 rows), not on the first row.
    const grew = then === 0 ? nowN >= 100 : (nowN - then) / then >= REBUILD_GROWTH_SHARE;
    if (grew) return { rebuild: true, reason: `${key} rows ${then} → ${nowN}` };
  }
  return { rebuild: false, reason: null };
}

async function sourceCounts(supabase: SupabaseClient): Promise<SourceCounts> {
  const count = async (table: string): Promise<number> => {
    // '*' not 'id': radar_score_label_events has no id column, and a head
    // count on a missing column fails with an empty message.
    const { count: n, error } = await supabase.from(table).select('*', { count: 'exact', head: true });
    if (error) throw new Error(`${table} count: ${error.message}`);
    return n ?? 0;
  };
  const [financials, intent, patents, labels, press] = await Promise.all([
    count('company_financials'),
    count('company_intent_signals'),
    count('company_patents'),
    count('radar_score_label_events'),
    count('press_releases'),
  ]);
  return { financials, intent, patents, labels, press };
}

export interface BacktestRunResult {
  dry_run?: boolean;
  gate_passed?: boolean;
  gate?: string[];
  incumbent?: Record<string, number | string> | null;
  phase_before: BacktestPhase;
  phase_after: BacktestPhase;
  processed: number;
  written: number;
  errors: string[];
  timed_out: boolean;
  duration_ms: number;
  model_version?: string;
  backtest_id?: string;
  activated?: boolean;
  metrics?: Record<string, number | boolean>;
  logged: boolean;
}

export interface BacktestRunOptions {
  /** Force a phase (e.g. 'train' to retrain on existing snapshots). */
  phase?: BacktestPhase;
  /** Drop the cursor and start from 'labels'. */
  reset?: boolean;
  runType?: 'scheduled' | 'manual' | 'backfill';
  now?: Date;
  /** Train on the stored snapshots and report the gate without writing anything (phase 'train' only). */
  dryRun?: boolean;
  /**
   * Activate the trained model when it passes the gate. Off by default since v5: a scheduled run
   * stores the model and the verdict, and activation is a rollout step (activate=1 or
   * activateStoredModel).
   */
  activate?: boolean;
}

function defaultState(): BacktestCursorState {
  return {
    phase: 'labels',
    feature_version: FEATURE_VERSION,
    sampling_rate: NEGATIVE_ASSET_SAMPLING_RATE,
    label_horizon: null,
    label_events: 0,
    positive_assets: 0,
    last_company_id: null,
    companies_done: 0,
    assets_kept: 0,
    snapshots_written: 0,
    snapshot_from: SNAPSHOT_FROM,
    snapshot_to: SNAPSHOT_TO,
    started_at: null,
    snapshots_finished_at: null,
    last_model_version: null,
    last_backtest_id: null,
    last_error: null,
  };
}

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}

function chunk<T>(arr: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ═══════════════════════════════════════════════════════════════════════
// CURSOR
// ═══════════════════════════════════════════════════════════════════════

export async function loadCursor(supabase: SupabaseClient): Promise<BacktestCursorState> {
  const { data, error } = await supabase.from('radar_sync_cursors').select('state').eq('source', BACKTEST_CURSOR_SOURCE).maybeSingle();
  if (error) throw new Error(`radar_sync_cursors read: ${error.message}`);
  const state = (data?.state ?? {}) as Partial<BacktestCursorState>;
  return { ...defaultState(), ...state };
}

async function saveCursor(supabase: SupabaseClient, state: BacktestCursorState, now: Date): Promise<string | null> {
  const { error } = await supabase.from('radar_sync_cursors').upsert({
    source: BACKTEST_CURSOR_SOURCE,
    cursor: state.phase === 'snapshots' ? state.last_company_id : state.phase,
    state,
    last_run_at: now.toISOString(),
    updated_at: now.toISOString(),
  }, { onConflict: 'source' });
  return error ? error.message : null;
}

// ═══════════════════════════════════════════════════════════════════════
// PHASE 1 — LABELS
// ═══════════════════════════════════════════════════════════════════════

const DEAL_COLUMNS = 'id, licensor_id, licensor_name, asset_name, deal_type, announced_date, source_url, verification_status, is_synthetic, is_canonical';

async function fetchAllDeals(supabase: SupabaseClient): Promise<LabelDeal[]> {
  const out: LabelDeal[] = [];
  for (let from = 0; ; from += ASSET_PAGE) {
    const { data, error } = await supabase
      .from('deals')
      .select(DEAL_COLUMNS)
      .in('deal_type', Array.from(POSITIVE_DEAL_TYPES))
      .not('announced_date', 'is', null)
      .gte('announced_date', '2015-01-01')
      .or('is_canonical.is.null,is_canonical.eq.true')
      .or('verification_status.is.null,verification_status.not.in.("rejected","flagged")')
      .order('announced_date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + ASSET_PAGE - 1);
    if (error) throw new Error(`deals fetch: ${error.message}`);
    const rows = (data ?? []) as LabelDeal[];
    out.push(...rows);
    if (rows.length < ASSET_PAGE) break;
  }
  return out;
}

const LABEL_ASSET_COLUMNS = 'id, company_id, company_name, asset_name, asset_aliases, drug_master_id, program_key';

function toLabelAsset(a: Record<string, unknown>, variations: ReadonlyMap<string, string[]>, family: ReadonlyMap<string, string | null>): LabelAsset {
  const cid = a.company_id as string | null;
  return {
    id: a.id as string,
    company_id: cid,
    company_name: a.company_name as string,
    company_name_variations: cid ? variations.get(cid) ?? [] : [],
    asset_name: a.asset_name as string,
    asset_aliases: (a.asset_aliases as string[] | null) ?? [],
    drug_master_id: (a.drug_master_id as string | null) ?? null,
    family_id: cid ? family.get(cid) ?? null : null,
    program_key: (a.program_key as string | null) ?? null,
  };
}

/** Licensor company -> family root, and every member company of those families (migration 193). */
async function fetchLicensorFamilies(supabase: SupabaseClient, deals: LabelDeal[]): Promise<Set<string>> {
  const licensorIds = Array.from(new Set(deals.map(d => d.licensor_id).filter((x): x is string => !!x)));
  const familyOf = new Map<string, string>();
  for (const ids of chunk(licensorIds, 200)) {
    const { data, error } = await supabase.from('companies').select('id, family_id').in('id', ids).not('family_id', 'is', null);
    // family_id arrives with migration 193; without it, labels fall back to company matching.
    if (error) { if (/family_id/.test(error.message)) return new Set(); throw new Error(`licensor families: ${error.message}`); }
    for (const r of data ?? []) familyOf.set(r.id as string, r.family_id as string);
  }
  for (const d of deals) if (d.licensor_id && familyOf.has(d.licensor_id)) d.licensor_family_id = familyOf.get(d.licensor_id);
  const families = Array.from(new Set(familyOf.values()));
  const members = new Set<string>();
  for (const fams of chunk(families, 200)) {
    const { data, error } = await supabase.from('companies').select('id').in('family_id', fams);
    if (error) throw new Error(`family members: ${error.message}`);
    for (const r of data ?? []) members.add(r.id as string);
  }
  return members;
}

async function fetchLabelAssets(supabase: SupabaseClient, deals: LabelDeal[]): Promise<LabelAsset[]> {
  const companyIds = new Set<string>();
  const licensorNames = new Set<string>();
  for (const d of deals) {
    if (d.licensor_id) companyIds.add(d.licensor_id);
    else if (d.licensor_name) licensorNames.add(d.licensor_name);
  }
  for (const id of await fetchLicensorFamilies(supabase, deals)) companyIds.add(id);
  // Resolve unlinked licensor names through companies.name / name_variations.
  const nameList = Array.from(licensorNames);
  for (const names of chunk(nameList, 200)) {
    const { data, error } = await supabase.from('companies').select('id, name, name_variations').in('name', names);
    if (error) throw new Error(`companies by name: ${error.message}`);
    for (const row of data ?? []) companyIds.add(row.id as string);
  }
  const variations = new Map<string, string[]>();
  const family = new Map<string, string | null>();
  const assets: LabelAsset[] = [];
  for (const ids of chunk(Array.from(companyIds), 150)) {
    const companiesRes = await supabase.from('companies').select('id, name_variations, family_id').in('id', ids);
    if (companiesRes.error) throw new Error(`companies variations: ${companiesRes.error.message}`);
    for (const c of companiesRes.data ?? []) {
      variations.set(c.id as string, (c.name_variations as string[] | null) ?? []);
      family.set(c.id as string, (c.family_id as string | null) ?? null);
    }
    // Paged: a 150-company chunk holds 1,500-6,700 assets and PostgREST returns at most 1,000 rows per
    // request, so the old `.limit(5000)` read dropped ~25k of 34k licensor assets. Their deals never became
    // labels (107 of 1,197 eligible deals, Nov 3 2026) and licensed assets were scored as negatives.
    const rows: Array<Record<string, unknown>> = [];
    for (let from = 0; ; from += ASSET_PAGE) {
      const { data, error } = await supabase.from('clinical_assets').select(LABEL_ASSET_COLUMNS)
        .in('company_id', ids).order('id', { ascending: true }).range(from, from + ASSET_PAGE - 1);
      if (error) throw new Error(`clinical_assets by company: ${error.message}`);
      rows.push(...(data ?? []));
      if ((data ?? []).length < ASSET_PAGE) break;
    }
    for (const a of rows) assets.push(toLabelAsset(a, variations, family));
  }
  return assets;
}

/** Every row of the given programs (for ledger events and program propagation). */
async function fetchAssetsByProgram(supabase: SupabaseClient, programKeys: readonly string[]): Promise<Map<string, LabelAsset[]>> {
  const out = new Map<string, LabelAsset[]>();
  const empty = new Map<string, string[]>();
  const noFamily = new Map<string, string | null>();
  for (const keys of chunk(Array.from(new Set(programKeys)), 150)) {
    for (let from = 0; ; from += ASSET_PAGE) {
      const { data, error } = await supabase.from('clinical_assets').select(LABEL_ASSET_COLUMNS)
        .in('program_key', keys).order('id', { ascending: true }).range(from, from + ASSET_PAGE - 1);
      if (error) throw new Error(`clinical_assets by program: ${error.message}`);
      for (const a of data ?? []) {
        const la = toLabelAsset(a as Record<string, unknown>, empty, noFamily);
        const list = out.get(la.program_key as string) ?? [];
        list.push(la);
        out.set(la.program_key as string, list);
      }
      if ((data ?? []).length < ASSET_PAGE) break;
    }
  }
  return out;
}

/** radar_deal_program_links (migration 192); absent table -> no ledger events. */
async function fetchLedgerLinks(supabase: SupabaseClient): Promise<LedgerLink[]> {
  const out: LedgerLink[] = [];
  for (let from = 0; ; from += ASSET_PAGE) {
    const { data, error } = await supabase.from('radar_deal_program_links').select('deal_id, program_key').order('id').range(from, from + ASSET_PAGE - 1);
    if (error) { if (/radar_deal_program_links/.test(error.message)) return []; throw new Error(`deal ledger: ${error.message}`); }
    out.push(...((data ?? []) as LedgerLink[]));
    if ((data ?? []).length < ASSET_PAGE) break;
  }
  return out;
}

/** drug_aliases lookup for every segment of every deal's asset name (brand / INN / code -> drug_master). */
async function fetchDealDrugIds(supabase: SupabaseClient, deals: readonly LabelDeal[]): Promise<Map<string, string>> {
  const keys = new Set<string>();
  for (const d of deals) for (const k of dealNameKeys(d.asset_name)) keys.add(k);
  const out = new Map<string, string>();
  for (const batch of chunk(Array.from(keys), 200)) {
    const { data, error } = await supabase.from('drug_aliases').select('drug_id, alias_normalized').in('alias_normalized', batch);
    if (error) throw new Error(`drug_aliases by key: ${error.message}`);
    for (const row of data ?? []) {
      const k = String(row.alias_normalized);
      if (!out.has(k)) out.set(k, String(row.drug_id));
    }
  }
  return out;
}

export interface BuiltLabels {
  events: LabelEvent[];
  horizon: string;
  sources: NonNullable<BacktestCursorState['label_sources']>;
}

/** Read-only: every positive (asset, deal) event and the label horizon. */
export async function buildLabelsFromDb(supabase: SupabaseClient, now: Date): Promise<BuiltLabels> {
  const deals = await fetchAllDeals(supabase);
  const [assets, drugIdByKey, links] = await Promise.all([fetchLabelAssets(supabase, deals), fetchDealDrugIds(supabase, deals), fetchLedgerLinks(supabase)]);
  const nameEvents = buildLabelEvents(assets, deals, { drugIdByKey });
  // Ledger + program propagation (v5): every row of a licensed program is a positive.
  const dealById = new Map(deals.map(d => [d.id, d] as const));
  const assetById = new Map(assets.map(a => [a.id, a] as const));
  const programKeys = new Set<string>(links.filter(l => dealById.has(l.deal_id)).map(l => l.program_key));
  for (const e of nameEvents) { const pk = assetById.get(e.asset_id)?.program_key; if (pk) programKeys.add(pk); }
  const assetsByProgram = await fetchAssetsByProgram(supabase, Array.from(programKeys));
  const programOf = new Map<string, string | null>();
  for (const a of assets) programOf.set(a.id, a.program_key ?? null);
  for (const list of assetsByProgram.values()) for (const a of list) programOf.set(a.id, a.program_key ?? null);
  const events = mergeAndPropagate([nameEvents, ledgerEvents(links, dealById, assetsByProgram)], programOf, assetsByProgram);

  // Label horizon: the newest announced_date in the whole (eligible) deals
  // table, capped at today. Windows ending after it are unobservable.
  const horizonRes = await supabase.from('deals').select('announced_date').not('announced_date', 'is', null).lte('announced_date', now.toISOString().slice(0, 10)).order('announced_date', { ascending: false }).limit(1).maybeSingle();
  const horizon = (horizonRes.data?.announced_date as string | undefined) ?? now.toISOString().slice(0, 10);
  return {
    events,
    horizon,
    sources: {
      name_match: nameEvents.length,
      ledger_links: links.length,
      events: events.length,
      by_kind: events.reduce<Record<string, number>>((acc, e) => { acc[e.match_kind] = (acc[e.match_kind] ?? 0) + 1; return acc; }, {}),
    },
  };
}

async function runLabelsPhase(supabase: SupabaseClient, state: BacktestCursorState, now: Date): Promise<{ written: number; errors: string[] }> {
  const errors: string[] = [];
  const { events, horizon, sources } = await buildLabelsFromDb(supabase, now);
  state.label_sources = sources;

  // Replace the table wholesale so a rebuild never leaves stale pairs.
  const del = await supabase.from('radar_score_label_events').delete().gte('announced_date', '1900-01-01');
  if (del.error) errors.push(`label_events delete: ${del.error.message}`);
  let written = 0;
  for (const rows of chunk(events, 500)) {
    const { error } = await supabase.from('radar_score_label_events').upsert(rows, { onConflict: 'asset_id,deal_id' });
    if (error) errors.push(`label_events upsert: ${error.message}`);
    else written += rows.length;
  }

  state.label_horizon = horizon;
  state.population = null;
  state.label_events = events.length;
  state.positive_assets = new Set(events.map(e => e.asset_id)).size;
  state.phase = 'snapshots';
  state.last_company_id = null;
  state.companies_done = 0;
  state.assets_kept = 0;
  state.snapshots_written = 0;
  state.started_at = state.started_at ?? now.toISOString();
  return { written, errors };
}

// ═══════════════════════════════════════════════════════════════════════
// PHASE 2 — SNAPSHOTS
// ═══════════════════════════════════════════════════════════════════════

const ASSET_COLUMNS =
  'id, company_id, company_name, asset_name, asset_aliases, phase, therapeutic_area, indication_category, modality, partnership_status, territory_rights_available, nct_ids, first_posted_date, regulatory_designations, originator_region, program_primary, owner_type';

/**
 * v5 population = what the default feed ranks: industry-owned programs, one (primary) row per
 * program. Academic / hospital sponsors made v3-v4 negatives easy (owner_industry alone separated
 * them) and duplicate rows of one program split its label.
 */
export function inFeedPopulation(asset: { program_primary?: boolean | null; owner_type?: string | null }): boolean {
  return asset.program_primary === true && (asset.owner_type ?? '').toLowerCase() === 'industry';
}

interface SnapshotRow {
  asset_id: string;
  as_of: string;
  feature_version: string;
  company_id: string | null;
  phase: string | null;
  features: Record<string, number | null>;
  completeness: number;
  label: 0 | 1;
  label_deal_id: string | null;
  label_deal_date: string | null;
  is_positive_asset: boolean;
  sampling_rate: number;
}

async function loadLabelEventsByAsset(supabase: SupabaseClient): Promise<Map<string, LabelEvent[]>> {
  const byAsset = new Map<string, LabelEvent[]>();
  for (let from = 0; ; from += ASSET_PAGE) {
    const { data, error } = await supabase.from('radar_score_label_events').select('asset_id, deal_id, announced_date, deal_type, match_kind, licensor_match').order('asset_id').order('deal_id').range(from, from + ASSET_PAGE - 1);
    if (error) throw new Error(`label_events read: ${error.message}`);
    for (const row of (data ?? []) as LabelEvent[]) {
      const list = byAsset.get(row.asset_id) ?? [];
      list.push(row);
      byAsset.set(row.asset_id, list);
    }
    if ((data?.length ?? 0) < ASSET_PAGE) break;
  }
  return byAsset;
}

/**
 * Build every monthly snapshot row for one asset from its bundle (pure apart
 * from the inputs). Rows are emitted only for months where the asset existed,
 * was unpartnered by the deals record, and whose label window is observable.
 */
export function snapshotRowsForAsset(
  asset: FeatureAsset,
  bundle: FeatureBundle,
  events: readonly LabelEvent[],
  months: readonly string[],
  labelHorizon: string,
  samplingRate: number,
): SnapshotRow[] {
  const isPositiveAsset = events.length > 0;
  const rows: SnapshotRow[] = [];
  for (const asOf of months) {
    const lab = labelSnapshot(events, asOf, labelHorizon);
    if (!lab.unpartnered_at_asof || !lab.observable) continue;
    const vec = buildFeatureVector(bundle, new Date(`${asOf}T00:00:00Z`));
    // Approved molecules are not in the feed (phase_4 is hidden), so they are not ranked here either.
    if (!vec.eligible || vec.phase_at_asof === 'phase_4') continue;
    rows.push({
      asset_id: asset.id,
      as_of: asOf,
      feature_version: vec.version,
      company_id: asset.company_id,
      phase: vec.phase_at_asof,
      features: vec.values,
      completeness: Math.round(vec.completeness * 1e4) / 1e4,
      label: lab.label,
      label_deal_id: lab.deal_id,
      label_deal_date: lab.deal_date,
      is_positive_asset: isPositiveAsset,
      sampling_rate: isPositiveAsset ? 1 : samplingRate,
    });
  }
  return rows;
}

async function runSnapshotsPhase(
  supabase: SupabaseClient,
  state: BacktestCursorState,
  now: Date,
  startMs: number,
): Promise<{ processed: number; written: number; errors: string[]; timedOut: boolean }> {
  const errors: string[] = [];
  let processed = 0;
  let written = 0;
  let timedOut = false;
  const months = monthlySnapshotDates(state.snapshot_from, state.snapshot_to);
  const labelHorizon = state.label_horizon ?? now.toISOString().slice(0, 10);
  const eventsByAsset = await loadLabelEventsByAsset(supabase);
  const terminationCache = new Map<string, { rows: TrialRow[]; error?: string }>();

  while (Date.now() - startMs < MAX_RUNTIME_MS) {
    let q = supabase.from('clinical_assets').select(ASSET_COLUMNS).not('company_id', 'is', null).order('company_id').order('id');
    if (state.last_company_id) q = q.gt('company_id', state.last_company_id);
    const { data, error } = await q.range(0, ASSET_PAGE - 1);
    if (error) { errors.push(`assets page: ${error.message}`); break; }
    const page = (data ?? []) as (FeatureAsset & { company_id: string })[];
    if (page.length === 0) {
      state.phase = 'train';
      state.snapshots_finished_at = now.toISOString();
      break;
    }
    // A full page may split its last company across the boundary; hold it back
    // unless the page is a single (very large) company.
    let rows = page;
    const lastCompany = page[page.length - 1].company_id;
    if (page.length === ASSET_PAGE && page[0].company_id !== lastCompany) {
      rows = page.filter(a => a.company_id !== lastCompany);
    }
    // The feed shows industry programs, one primary row each (clinical_assets.owner_type / program_primary).
    const pop = state.population ?? { kept_positive: 0, kept_negative: 0, skipped_owner: 0, skipped_non_primary: 0 };
    const kept: typeof rows = [];
    for (const a of rows) {
      if ((a as { program_primary?: boolean | null }).program_primary !== true) { pop.skipped_non_primary++; continue; }
      if (!inFeedPopulation(a as FeatureAsset & { program_primary?: boolean | null })) { pop.skipped_owner++; continue; }
      if (eventsByAsset.has(a.id)) { kept.push(a); pop.kept_positive++; }
      else if (keepNegativeAsset(a.id, state.sampling_rate)) { kept.push(a); pop.kept_negative++; }
    }
    state.population = pop;
    processed += rows.length;
    const writtenBeforePage = written;

    // Group kept assets by company and score in waves.
    const byCompany = new Map<string, CompanyGroup>();
    for (const a of kept) {
      const g = byCompany.get(a.company_id) ?? { company_id: a.company_id, company_name: a.company_name, assets: [] };
      g.assets.push(a);
      byCompany.set(a.company_id, g);
    }
    const groups = Array.from(byCompany.values());
    const waves: CompanyGroup[][] = [];
    let cur: CompanyGroup[] = [];
    let n = 0;
    for (const g of groups) { cur.push(g); n += g.assets.length; if (n >= WAVE_ASSETS) { waves.push(cur); cur = []; n = 0; } }
    if (cur.length) waves.push(cur);

    for (const wave of waves) {
      if (Date.now() - startMs > MAX_RUNTIME_MS) { timedOut = true; break; }
      try {
        const { bundles, sourceErrorCounts } = await fetchFeatureBundles(supabase, wave, {
          asOf: now, historyMonths: 144, includePublications: true, terminationCache,
        });
        for (const [table, count] of Object.entries(sourceErrorCounts)) {
          if (count > 0 && !errors.some(e => e.startsWith(`source ${table}`))) errors.push(`source ${table} failed for ${count} compan${count === 1 ? 'y' : 'ies'} (features null)`);
        }
        const out: SnapshotRow[] = [];
        for (const g of wave) {
          for (const a of g.assets) {
            const b = bundles.get(a.id);
            if (!b) continue;
            out.push(...snapshotRowsForAsset(a, b, eventsByAsset.get(a.id) ?? [], months, labelHorizon, state.sampling_rate));
          }
        }
        for (const batch of chunk(out, 400)) {
          const { error: upErr } = await supabase.from('radar_score_snapshots').upsert(batch, { onConflict: 'asset_id,as_of,feature_version' });
          if (upErr) errors.push(`snapshots upsert: ${upErr.message}`);
          else written += batch.length;
        }
        state.assets_kept += wave.reduce((s, g) => s + g.assets.length, 0);
      } catch (e) {
        errors.push(`wave failed: ${errMsg(e)}`);
      }
    }
    if (timedOut) break;

    state.companies_done += groups.length;
    state.snapshots_written += written - writtenBeforePage;
    state.last_company_id = rows[rows.length - 1].company_id;
    if (page.length < ASSET_PAGE) {
      state.phase = 'train';
      state.snapshots_finished_at = now.toISOString();
      break;
    }
  }
  if (state.phase === 'snapshots' && Date.now() - startMs >= MAX_RUNTIME_MS) timedOut = true;
  return { processed, written, errors, timedOut };
}

// ═══════════════════════════════════════════════════════════════════════
// PHASE 3 — TRAIN, EVALUATE, ACTIVATE
// ═══════════════════════════════════════════════════════════════════════

export interface LoadedSnapshot {
  asset_id: string;
  as_of: string;
  /** Every stored feature (models pick their own feature_names). */
  features: Record<string, number | null>;
  label: 0 | 1;
  weight: number;
}

/** Feature row in a model's order; missing names are null (imputed / missing bin). */
export function rowFor(features: Record<string, number | null>, names: readonly string[], neutralize: ReadonlySet<string> = new Set()): (number | null)[] {
  return names.map(n => (!neutralize.has(n) && typeof features[n] === 'number' ? (features[n] as number) : null));
}

async function loadSnapshots(supabase: SupabaseClient, featureVersion: string): Promise<LoadedSnapshot[]> {
  const out: LoadedSnapshot[] = [];
  for (let from = 0; ; from += ASSET_PAGE) {
    const { data, error } = await supabase
      .from('radar_score_snapshots')
      .select('asset_id, as_of, features, label, sampling_rate')
      .eq('feature_version', featureVersion)
      .order('as_of').order('asset_id')
      .range(from, from + ASSET_PAGE - 1);
    if (error) throw new Error(`snapshots read: ${error.message}`);
    for (const r of data ?? []) {
      const rate = Number(r.sampling_rate) || 1;
      out.push({
        asset_id: r.asset_id as string,
        as_of: r.as_of as string,
        features: (r.features ?? {}) as Record<string, number | null>,
        label: r.label === 1 ? 1 : 0,
        weight: r.label === 1 ? 1 : 1 / rate,
      });
    }
    if ((data?.length ?? 0) < ASSET_PAGE) break;
  }
  return out;
}

export interface GamSettings { learningRate: number; lambda: number; maxBins: number; maxRounds: number; patience: number }

/**
 * Boosting settings. Rounds are chosen by early stopping on the 2024-H2 slice; the rest were
 * checked for stability, not tuned to the test months (Nov 2026 rebuild: lr 0.05 / λ 10 / 16 bins
 * all within ±0.002 AUC of these).
 */
export const GAM_SETTINGS: Readonly<GamSettings> = { learningRate: 0.1, lambda: 1, maxBins: 24, maxRounds: 800, patience: 60 };

/**
 * Features zeroed when an incumbent v3/v4 model is re-scored on v5 snapshots. availability reads
 * today's partnership status (MODEL_EXCLUDED_FEATURES); feeding it would score the incumbent on the
 * leak instead of on what it saw in training (a constant 1.0).
 */
const INCUMBENT_NEUTRALIZED: ReadonlySet<string> = new Set(['availability']);

export interface TrainOutcome {
  params: ModelParams;
  summary: ReturnType<typeof toBacktestSummary>;
  monthly: MonthlyFeedMetrics;
  testPredictions: Array<{ asset_id: string; as_of: string; prediction: number }>;
  notes: string[];
}

/**
 * Pure given the loaded rows: time split, fit the additive model with early stopping on the
 * validation slice, Platt-calibrate on the same slice, evaluate on the test slice by the feed
 * protocol. The deployed model is exactly the evaluated one (no refit on the test months).
 * Exported so the test suite can run it on synthetic data.
 */
export function trainAndEvaluate(
  rows: readonly LoadedSnapshot[],
  version: string,
  now: Date,
  opts: { featureNames?: readonly string[]; settings?: Partial<GamSettings> } = {},
): TrainOutcome {
  const names = [...(opts.featureNames ?? MODEL_FEATURE_NAMES)];
  const settings = { ...GAM_SETTINGS, ...(opts.settings ?? {}) };
  const train = rows.filter(r => r.as_of <= TRAIN_TO);
  const calib = rows.filter(r => r.as_of > TRAIN_TO && r.as_of <= CALIB_TO);
  const test = rows.filter(r => r.as_of >= TEST_FROM);
  const notes: string[] = [];
  if (train.length === 0) throw new Error('trainAndEvaluate: no training rows');
  const X = (rs: readonly LoadedSnapshot[]) => rs.map(r => rowFor(r.features, names));

  const posTrain = train.filter(r => r.label === 1).length;
  const calibX = X(calib);
  const fit = trainGam(X(train), train.map(r => r.label), {
    learningRate: settings.learningRate,
    lambda: settings.lambda,
    maxBins: settings.maxBins,
    maxRounds: settings.maxRounds,
    patience: settings.patience,
    rowWeights: train.map(r => r.weight),
    classWeightPos: 'balanced',
    valid: calib.length ? { X: calibX, y: calib.map(r => r.label), w: calib.map(r => r.weight) } : undefined,
  });
  // Training weights = class weight × (1 / sampling rate); ln(class weight) moves the intercept back
  // to the universe's odds before calibration.
  const priorCorrection = -Math.log(fit.classWeightPos || 1);
  const d = names.length;
  const params: ModelParams = {
    ...buildModelParams({
      version,
      featureVersion: FEATURE_VERSION,
      featureNames: names,
      signConstraints: names.map(() => 0 as const),
      fit: { weights: new Array(d).fill(0), bias: fit.bias, means: new Array(d).fill(0), stds: new Array(d).fill(1), iterations: fit.rounds, finalLoss: fit.bestValidLoss ?? 0, classWeightPos: fit.classWeightPos },
      calibration: { type: 'none' },
      samplingRate: 1,
      l2: settings.lambda,
      trainWindow: { from: train[0].as_of, to: train[train.length - 1].as_of },
      testWindow: { from: test[0]?.as_of ?? TEST_FROM, to: test[test.length - 1]?.as_of ?? TEST_FROM },
      nTrain: train.length,
      positivesTrain: posTrain,
      trainedAt: now,
    }),
    prior_correction: priorCorrection,
    model_type: 'gam',
    gam: fit.params,
  };
  notes.push(`additive boosted stumps: ${fit.rounds} rounds (lr ${settings.learningRate}, λ ${settings.lambda}, ${settings.maxBins} bins), early stopping on ${calib.length} rows of ${TRAIN_TO.slice(0, 7)}..${CALIB_TO.slice(0, 7)}`);

  // Platt (monotone, no ties) on the validation slice, weighted to undo subsampling.
  const calibPos = calib.filter(r => r.label === 1).length;
  if (calibPos >= 5) {
    params.calibration = fitPlatt(logitBatch(calibX, params), calib.map(r => r.label), calib.map(r => r.weight));
    notes.push(`Platt calibration on ${calib.length} rows / ${calibPos} positives`);
  } else {
    notes.push(`no calibration (only ${calibPos} validation positives)`);
  }

  const testX = X(test);
  const logits = logitBatch(testX, params);
  const preds = logits.map(z => applyCalibration(params.calibration, z, 1 / (1 + Math.exp(-z))));
  const labels = test.map(r => r.label);
  const weights = test.map(r => r.weight);
  const pooled = computeMetrics(preds, labels, weights, logits);
  const monthly = computeMonthlyMetrics(test.map(r => r.as_of), logits, labels, weights);
  const importance = factorImportance(names, contributionMatrix(testX, params));
  notes.push(`population: industry programs, primary rows; negatives subsampled at ${NEGATIVE_ASSET_SAMPLING_RATE}; metrics ranked per month (${EVAL_PROTOCOL})`);
  notes.push(`train positives ${posTrain} / ${train.length} rows; class weight ${fit.classWeightPos.toFixed(1)}`);
  notes.push(`pooled (v4 protocol) auc ${pooled.roc_auc.toFixed(4)} p@100 ${pooled.precision_at_100.toFixed(4)} lift ${pooled.lift_top_decile.toFixed(3)}`);
  if (pooled.positives < MIN_POSITIVES_FOR_POWER) notes.push('holdout has too few positives for a stable ranking estimate');

  // Ranking columns carry the feed protocol; Brier / calibration / PR-AUC stay pooled.
  const metrics = {
    ...pooled,
    roc_auc: monthly.roc_auc,
    precision_at_50: monthly.precision_at_50,
    precision_at_100: monthly.precision_at_100,
    lift_top_decile: monthly.lift_top_decile,
  };
  const summary = toBacktestSummary({
    modelVersion: version,
    runAt: now,
    trainWindow: params.train_window,
    testWindow: params.test_window,
    nTrain: train.length,
    metrics,
    importance,
    notes,
  });
  return {
    params,
    summary,
    monthly,
    testPredictions: test.map((r, i) => ({ asset_id: r.asset_id, as_of: r.as_of, prediction: preds[i] })),
    notes,
  };
}

/** Re-score a stored model (any version) on the v5 test rows by the same protocol. */
export function evaluateModelOnRows(params: ModelParams, rows: readonly LoadedSnapshot[]): MonthlyFeedMetrics {
  const test = rows.filter(r => r.as_of >= TEST_FROM);
  const X = test.map(r => rowFor(r.features, params.feature_names, isGamModel(params) ? new Set() : INCUMBENT_NEUTRALIZED));
  return computeMonthlyMetrics(test.map(r => r.as_of), logitBatch(X, params), test.map(r => r.label), test.map(r => r.weight));
}

export async function loadActiveModel(supabase: SupabaseClient): Promise<ModelParams | null> {
  const { data, error } = await supabase.from('radar_score_models').select('version, params').eq('is_active', true).maybeSingle();
  if (error) throw new Error(`radar_score_models read: ${error.message}`);
  if (!data) return null;
  const params = data.params as ModelParams;
  return { ...params, version: (data.version as string) ?? params.version };
}

export interface TrainPhaseResult {
  errors: string[];
  modelVersion: string;
  backtestId?: string;
  activated: boolean;
  gatePassed: boolean;
  metrics: Record<string, number | boolean>;
  incumbent?: MonthlyFeedMetrics & { version: string };
  gate: string[];
}

async function runTrainPhase(
  supabase: SupabaseClient,
  state: BacktestCursorState,
  now: Date,
  opts: { dryRun: boolean; activate: boolean },
): Promise<TrainPhaseResult> {
  const errors: string[] = [];
  const rows = await loadSnapshots(supabase, state.feature_version);
  if (rows.length === 0) throw new Error('train: no snapshots for this feature version');
  const stamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 12);
  const version = `v5.${stamp}`;
  const outcome = trainAndEvaluate(rows, version, now);

  // Gate: re-score the incumbent on the same rows by the same protocol.
  let incumbent: (MonthlyFeedMetrics & { version: string }) | undefined;
  let gate = { activate: false, reasons: [] as string[] };
  try {
    const active = await loadActiveModel(supabase);
    if (active) {
      incumbent = { ...evaluateModelOnRows(active, rows), version: active.version };
      gate = gateDecision(outcome.monthly, incumbent);
    } else {
      gate = gateDecision(outcome.monthly, null);
    }
  } catch (e) {
    errors.push(`incumbent comparison: ${errMsg(e)}`);
  }
  if (outcome.monthly.roc_auc < MIN_AUC_TO_ACTIVATE) {
    gate.activate = false;
    gate.reasons.push(`auc below ${MIN_AUC_TO_ACTIVATE}`);
  }
  if (outcome.summary.low_power) {
    gate.activate = false;
    gate.reasons.push('low power');
  }
  const gatePassed = gate.activate;
  const activate = gatePassed && opts.activate && !opts.dryRun;
  const gateNote = `gate ${gatePassed ? 'PASSED' : 'failed'} vs ${incumbent?.version ?? 'none'} (${gate.reasons.join('; ')})${gatePassed && !activate ? '; not activated (run with activate=1)' : ''}`;

  const metrics: Record<string, number | boolean> = {
    roc_auc: outcome.monthly.roc_auc,
    precision_at_100: outcome.monthly.precision_at_100,
    precision_at_50: outcome.monthly.precision_at_50,
    lift_at_100: outcome.monthly.lift_at_100,
    lift_top_decile: outcome.monthly.lift_top_decile,
    base_rate: outcome.monthly.base_rate,
    recall_top_1pct: outcome.monthly.recall_top_1pct,
    pr_auc: outcome.summary.pr_auc,
    brier: outcome.summary.brier,
    n_train: outcome.summary.n_train,
    n_test: outcome.summary.n_test,
    positives_test: outcome.summary.positives_test,
    low_power: outcome.summary.low_power,
    gate_passed: gatePassed,
  };
  if (opts.dryRun) {
    return { errors, modelVersion: version, activated: false, gatePassed, metrics, incumbent, gate: gate.reasons };
  }

  const modelRow = {
    version,
    trained_at: now.toISOString(),
    params: outcome.params,
    feature_names: [...outcome.params.feature_names],
    train_window: outcome.params.train_window,
    test_window: outcome.params.test_window,
    is_active: false,
    notes: [gateNote, ...outcome.notes].join(' | '),
  };
  let activated = false;
  const ins = await supabase.from('radar_score_models').insert(modelRow);
  if (ins.error) errors.push(`model insert: ${ins.error.message}`);
  else if (activate) activated = await activateModel(supabase, version, errors);

  // Raw predictions sample: top 2,000 by score + every positive, stored on the snapshot rows.
  const sample = [...outcome.testPredictions].sort((a, b) => b.prediction - a.prediction).slice(0, 2000);
  const positives = new Set(rows.filter(r => r.as_of >= TEST_FROM && r.label === 1).map(r => `${r.asset_id}:${r.as_of}`));
  const inSample = new Set(sample.map(p => `${p.asset_id}:${p.as_of}`));
  for (const p of outcome.testPredictions) if (positives.has(`${p.asset_id}:${p.as_of}`) && !inSample.has(`${p.asset_id}:${p.as_of}`)) sample.push(p);
  // UPDATE in place (RPC, migration 144): a partial upsert fails the NOT NULL
  // check on `features` before ON CONFLICT is considered.
  for (const batch of chunk(sample, 500)) {
    const { error } = await supabase.rpc('radar_snapshot_set_predictions', {
      rows: batch.map(p => ({ asset_id: p.asset_id, as_of: p.as_of, feature_version: state.feature_version, prediction: Math.round(p.prediction * 1e6) / 1e6 })),
      model_version: version,
    });
    if (error) { errors.push(`prediction sample: ${error.message}`); break; }
  }

  const backtestRow = {
    ...outcome.summary,
    activated,
    raw_predictions_path: `radar_score_snapshots.prediction where prediction_model = '${version}' (${sample.length} rows)`,
    notes: [outcome.summary.notes, gateNote].filter(Boolean).join(' | '),
    // Migration 196 columns.
    base_rate: round6(outcome.monthly.base_rate),
    lift_at_100: Math.round(outcome.monthly.lift_at_100 * 1000) / 1000,
    eval_protocol: EVAL_PROTOCOL,
    metrics: { monthly: outcome.monthly, incumbent: incumbent ?? null, gate: gate.reasons, gate_passed: gatePassed, label_sources: state.label_sources ?? null, population: state.population ?? null },
  };
  let bt = await supabase.from('radar_score_backtests').insert(backtestRow).select('id').single();
  if (bt.error && /base_rate|lift_at_100|eval_protocol|metrics/.test(bt.error.message)) {
    // Before migration 196: keep the row, drop the new columns.
    const { base_rate: _b, lift_at_100: _l, eval_protocol: _e, metrics: _m, ...legacy } = backtestRow;
    bt = await supabase.from('radar_score_backtests').insert(legacy).select('id').single();
  }
  if (bt.error) errors.push(`backtest insert: ${bt.error.message}`);

  state.phase = 'done';
  state.last_model_version = version;
  state.last_backtest_id = (bt.data?.id as string | undefined) ?? null;
  return { errors, modelVersion: version, backtestId: state.last_backtest_id ?? undefined, activated, gatePassed, metrics, incumbent, gate: gate.reasons };
}

/** Make `version` the only active model. */
export async function activateModel(supabase: SupabaseClient, version: string, errors: string[]): Promise<boolean> {
  const off = await supabase.from('radar_score_models').update({ is_active: false }).eq('is_active', true);
  if (off.error) { errors.push(`deactivate incumbent: ${off.error.message}`); return false; }
  const on = await supabase.from('radar_score_models').update({ is_active: true }).eq('version', version);
  if (on.error) { errors.push(`activate ${version}: ${on.error.message}`); return false; }
  const bt = await supabase.from('radar_score_backtests').update({ activated: true }).eq('model_version', version);
  if (bt.error) errors.push(`backtest activated flag: ${bt.error.message}`);
  return true;
}

function round6(v: number): number {
  return Math.round(v * 1e6) / 1e6;
}

/**
 * Rollout step: activate a stored model whose backtest passed the v5 gate. Refuses models
 * without a passing feed-protocol backtest unless `force` (the gate verdict is in the
 * backtest row, so a reviewer can see what was overridden).
 */
export async function activateStoredModel(
  supabase: SupabaseClient,
  version: string,
  opts: { force?: boolean } = {},
): Promise<{ activated: boolean; errors: string[]; gate_passed: boolean | null }> {
  const errors: string[] = [];
  const { data: model, error } = await supabase.from('radar_score_models').select('version, is_active').eq('version', version).maybeSingle();
  if (error) return { activated: false, errors: [`model read: ${error.message}`], gate_passed: null };
  if (!model) return { activated: false, errors: [`no stored model ${version}`], gate_passed: null };
  if (model.is_active) return { activated: true, errors: [], gate_passed: null };
  const { data: bt, error: btErr } = await supabase.from('radar_score_backtests').select('metrics, eval_protocol')
    .eq('model_version', version).order('created_at', { ascending: false }).limit(1).maybeSingle();
  if (btErr) return { activated: false, errors: [`backtest read: ${btErr.message}`], gate_passed: null };
  const gatePassed = (bt?.metrics as { gate_passed?: boolean } | null)?.gate_passed === true && bt?.eval_protocol === EVAL_PROTOCOL;
  if (!gatePassed && !opts.force) {
    return { activated: false, errors: [`${version} has no passing ${EVAL_PROTOCOL} gate (pass force=1 to override)`], gate_passed: gatePassed };
  }
  const activated = await activateModel(supabase, version, errors);
  return { activated, errors, gate_passed: gatePassed };
}

// ═══════════════════════════════════════════════════════════════════════
// ENTRY POINT
// ═══════════════════════════════════════════════════════════════════════

export async function runScoreBacktest(supabase: SupabaseClient, options: BacktestRunOptions = {}): Promise<BacktestRunResult> {
  const now = options.now ?? new Date();
  const startMs = Date.now();
  const runType = options.runType ?? 'scheduled';
  const errors: string[] = [];
  let processed = 0;
  let written = 0;
  let timedOut = false;
  let extra: Partial<BacktestRunResult> = {};

  const dryRun = options.dryRun === true;
  if (dryRun && (options.reset || options.phase !== 'train')) {
    throw new Error('dry_run supports only phase=train (training on the stored snapshots); other phases write by design');
  }
  let state: BacktestCursorState;
  if (options.reset) {
    state = defaultState();
    const wipe = await supabase.from('radar_score_snapshots').delete().eq('feature_version', FEATURE_VERSION);
    if (wipe.error) errors.push(`snapshots wipe: ${wipe.error.message}`);
  } else {
    state = await loadCursor(supabase);
  }
  if (state.feature_version !== FEATURE_VERSION) {
    // Feature schema changed: rebuild from scratch on the new version.
    state = { ...defaultState(), last_model_version: state.last_model_version };
  }
  if (options.phase) state.phase = options.phase;

  // Finished backtests retrain themselves when the sources got materially
  // denser or the model is a month old (feature vectors are as-of-dated, so
  // only a rebuild from labels lets the model see new history).
  let rebuildReason: string | null = null;
  let countsNow: SourceCounts | null = null;
  if (state.phase === 'done' && !options.phase && !options.reset && !dryRun) {
    try {
      countsNow = await sourceCounts(supabase);
      const decision = rebuildDecision({ countsNow, countsThen: state.source_counts_at_train, trainedAt: state.trained_at, now });
      if (decision.rebuild) {
        rebuildReason = decision.reason;
        const wipe = await supabase.from('radar_score_snapshots').delete().eq('feature_version', FEATURE_VERSION);
        if (wipe.error) errors.push(`snapshots wipe: ${wipe.error.message}`);
        state = { ...defaultState(), last_model_version: state.last_model_version, trained_at: state.trained_at, source_counts_at_train: state.source_counts_at_train };
      } else if (!state.trained_at) {
        // First run after this code shipped: stamp the baseline so growth is measured from here.
        state.trained_at = now.toISOString();
        state.source_counts_at_train = countsNow;
      }
    } catch (e) {
      errors.push(`rebuild check: ${errMsg(e)}`);
    }
  }
  const phaseBefore = state.phase;

  try {
    if (state.phase === 'labels') {
      const r = await runLabelsPhase(supabase, state, now);
      written += r.written; errors.push(...r.errors); processed = state.label_events;
    } else if (state.phase === 'snapshots') {
      const r = await runSnapshotsPhase(supabase, state, now, startMs);
      processed += r.processed; written += r.written; errors.push(...r.errors); timedOut = r.timedOut;
    } else if (state.phase === 'train') {
      const r = await runTrainPhase(supabase, state, now, { dryRun, activate: options.activate === true });
      errors.push(...r.errors);
      extra = {
        model_version: r.modelVersion, backtest_id: r.backtestId, activated: r.activated, metrics: r.metrics,
        dry_run: dryRun, gate_passed: r.gatePassed, gate: r.gate,
        incumbent: r.incumbent ? { version: r.incumbent.version, roc_auc: r.incumbent.roc_auc, precision_at_100: r.incumbent.precision_at_100, lift_at_100: r.incumbent.lift_at_100, lift_top_decile: r.incumbent.lift_top_decile } : null,
      };
      processed = r.metrics.n_train as number;
      written = dryRun ? 0 : 1;
      if (!dryRun) {
        state.trained_at = now.toISOString();
        try {
          state.source_counts_at_train = await sourceCounts(supabase);
        } catch (e) {
          errors.push(`source counts: ${errMsg(e)}`);
        }
      }
    }
    state.last_error = errors.length ? errors[0] : null;
  } catch (e) {
    const msg = errMsg(e);
    errors.push(msg);
    state.last_error = msg;
  }

  if (dryRun) {
    return {
      phase_before: phaseBefore, phase_after: phaseBefore, processed, written: 0, errors, timed_out: false,
      duration_ms: Date.now() - startMs, logged: false, ...extra,
    };
  }
  const cursorErr = await saveCursor(supabase, state, now);
  if (cursorErr) errors.push(`cursor save: ${cursorErr}`);

  const durationMs = Date.now() - startMs;
  const status = state.phase === 'done' && phaseBefore === 'done'
    ? 'completed'
    : deriveRunStatus({ errors: errors.length, timedOut, processed, produced: written });
  // data_ingestion_log shares the licensing_signals source with a stage
  // marker, the same convention the asset_universe sweeps use.
  const logged = await logRadarRun(supabase, {
    source: 'licensing_signals',
    startedAt: startMs,
    status,
    runType,
    fetched: processed,
    processed,
    inserted: written,
    errors,
    parameters: {
      stage: BACKTEST_CURSOR_SOURCE,
      phase_before: phaseBefore,
      phase_after: state.phase,
      feature_version: FEATURE_VERSION,
      sampling_rate: state.sampling_rate,
      companies_done: state.companies_done,
      snapshots_written: state.snapshots_written,
      timed_out: timedOut,
      ...(countsNow ? { source_counts: countsNow } : {}),
      ...(rebuildReason ? { rebuild_reason: rebuildReason } : {}),
      ...(extra.model_version ? { model_version: extra.model_version, activated: extra.activated, metrics: extra.metrics } : {}),
    },
    notes: rebuildReason
      ? `rebuilding from labels: ${rebuildReason}`
      : phaseBefore === 'done' && state.phase === 'done'
        ? 'idle (backtest complete; rebuilds itself when sources grow 25% or the model is 30 days old; ?phase=train or ?reset=1 to force)'
        : undefined,
  });

  return {
    phase_before: phaseBefore,
    phase_after: state.phase,
    processed,
    written,
    errors,
    timed_out: timedOut,
    duration_ms: durationMs,
    logged,
    ...extra,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// METHODOLOGY SUMMARY (read by /api/radar/methodology and /radar/methodology)
// ═══════════════════════════════════════════════════════════════════════

export interface MethodologyFeature {
  name: string;
  label: string;
  description: string;
  sources: string[];
  sign: -1 | 0 | 1;
  unit: string;
  /** Standardized coefficient of the active model (null when no model). */
  weight: number | null;
  /** Share of mean |contribution| on the latest test set (null when no backtest). */
  importance: number | null;
}

export interface MethodologySummary {
  generated_at: string;
  feature_version: string;
  label: {
    definition: string;
    window_months: number;
    positive_deal_types: string[];
    snapshot_range: { from: string; to: string };
    negative_sampling_rate: number;
    train_to: string;
    calibration_to: string;
    test_from: string;
  };
  model: {
    version: string;
    trained_at: string;
    feature_version: string;
    train_window: { from: string; to: string };
    test_window: { from: string; to: string };
    n_train: number;
    positives_train: number;
    calibration: string;
    class_weight_pos: number;
    l2: number;
    notes: string | null;
  } | null;
  backtest: (ScoreBacktestSummary & { low_power: boolean; activated: boolean }) | null;
  /** Latest backtest rows, newest first (max 12), for the history table. */
  history: Array<Pick<ScoreBacktestSummary, 'model_version' | 'run_at' | 'roc_auc' | 'pr_auc' | 'precision_at_50' | 'brier' | 'positives_test'> & { activated: boolean; low_power: boolean }>;
  features: MethodologyFeature[];
  fallback_active: boolean;
  /** Only with includeParams (Pro). */
  params?: ModelParams;
}

export async function loadMethodologySummary(supabase: SupabaseClient, opts: { includeParams?: boolean } = {}): Promise<MethodologySummary> {
  const [modelRes, backtestRes] = await Promise.all([
    supabase.from('radar_score_models').select('version, trained_at, params, train_window, test_window, notes').eq('is_active', true).maybeSingle(),
    supabase.from('radar_score_backtests').select('*').order('run_at', { ascending: false }).limit(12),
  ]);
  // Both tables come from migration 115; before it is applied, report "no model" instead of failing.
  const modelRow = modelRes.error ? null : modelRes.data;
  const backtests = backtestRes.error ? [] : (backtestRes.data ?? []);
  const params = (modelRow?.params ?? null) as ModelParams | null;

  // Prefer the backtest that produced the active model; else the newest.
  const activeBacktest = (params ? backtests.find(b => b.model_version === params.version) : undefined) ?? backtests[0] ?? null;
  const importanceByFactor = new Map<string, number>();
  if (activeBacktest) {
    for (const f of (activeBacktest.factor_importance ?? []) as { factor: string; importance: number }[]) importanceByFactor.set(f.factor, f.importance);
  }
  const weightByFeature = new Map<string, number>();
  if (params && isGamModel(params)) {
    // Additive model: report each feature's table range (largest swing in log-odds it can cause).
    params.feature_names.forEach((name, j) => {
      const v = [...params.gam.values[j], params.gam.missing[j]];
      weightByFeature.set(name, Math.max(...v) - Math.min(...v));
    });
  } else if (params) {
    params.feature_names.forEach((name, j) => weightByFeature.set(name, params.weights[j]));
  }

  const toSummary = (b: Record<string, unknown>): ScoreBacktestSummary & { low_power: boolean; activated: boolean } => ({
    id: String(b.id),
    model_version: String(b.model_version),
    run_at: String(b.run_at),
    train_window: b.train_window as { from: string; to: string },
    test_window: b.test_window as { from: string; to: string },
    n_train: Number(b.n_train),
    n_test: Number(b.n_test),
    positives_test: Number(b.positives_test),
    roc_auc: Number(b.roc_auc),
    pr_auc: Number(b.pr_auc),
    precision_at_50: Number(b.precision_at_50),
    precision_at_100: Number(b.precision_at_100),
    lift_top_decile: Number(b.lift_top_decile),
    brier: Number(b.brier),
    calibration_bins: (b.calibration_bins ?? []) as ScoreBacktestSummary['calibration_bins'],
    factor_importance: (b.factor_importance ?? []) as ScoreBacktestSummary['factor_importance'],
    notes: (b.notes as string | null) ?? null,
    low_power: Boolean(b.low_power),
    activated: Boolean(b.activated),
  });

  return {
    generated_at: new Date().toISOString(),
    feature_version: FEATURE_VERSION,
    label: {
      definition:
        `A canonical, non-rejected deal in the Solidus deals table in which the licensor is the program's owning company or ` +
        `a member of its corporate family (by company id, family, or legal-suffix-insensitive name match), ` +
        `the deal's asset name matches the program (exact, development-code, drug-alias or ≥80% word-overlap match) or the deal ` +
        `is linked to the program in the deal ledger, the deal type is ` +
        `${Array.from(POSITIVE_DEAL_TYPES).join(', ')}, and the announcement date falls in the ${LABEL_WINDOW_MONTHS} months after the snapshot date. ` +
        `A match on any row of a program counts for the whole program. The evaluated population is what the feed ranks: industry-owned ` +
        `programs, one row per program, not approved. Negatives are programs that existed at the snapshot date with no such deal on or ` +
        `before it and none in the window. Ranking metrics are computed within each month and averaged.`,
      window_months: LABEL_WINDOW_MONTHS,
      positive_deal_types: Array.from(POSITIVE_DEAL_TYPES),
      snapshot_range: { from: SNAPSHOT_FROM, to: SNAPSHOT_TO },
      negative_sampling_rate: NEGATIVE_ASSET_SAMPLING_RATE,
      train_to: TRAIN_TO,
      calibration_to: CALIB_TO,
      test_from: TEST_FROM,
    },
    model: params && modelRow
      ? {
          version: String(modelRow.version),
          trained_at: String(modelRow.trained_at),
          feature_version: params.feature_version,
          train_window: params.train_window,
          test_window: params.test_window,
          n_train: params.n_train,
          positives_train: params.positives_train,
          calibration: params.calibration.type,
          class_weight_pos: params.class_weight_pos,
          l2: params.l2,
          notes: (modelRow.notes as string | null) ?? null,
        }
      : null,
    backtest: activeBacktest ? toSummary(activeBacktest as Record<string, unknown>) : null,
    history: backtests.map(b => {
      const s = toSummary(b as Record<string, unknown>);
      return { model_version: s.model_version, run_at: s.run_at, roc_auc: s.roc_auc, pr_auc: s.pr_auc, precision_at_50: s.precision_at_50, brier: s.brier, positives_test: s.positives_test, activated: s.activated, low_power: s.low_power };
    }),
    features: [...FEATURE_SPECS, ...CANDIDATE_FEATURE_SPECS].map(spec => ({
      name: spec.name,
      label: spec.label,
      description: spec.description,
      sources: spec.sources,
      sign: spec.sign,
      unit: spec.unit,
      weight: weightByFeature.has(spec.name) ? Math.round((weightByFeature.get(spec.name) as number) * 1e4) / 1e4 : null,
      importance: importanceByFactor.has(spec.name) ? importanceByFactor.get(spec.name) as number : null,
    })),
    fallback_active: !params,
    ...(opts.includeParams && params ? { params } : {}),
  };
}
