/**
 * Asset Radar scoring v3 — backtest harness (Supabase side).
 *
 * Driven by /api/cron/score-backtest through a cursor in radar_sync_cursors
 * (source 'score_backtest'). Phases:
 *
 *   labels     Build radar_score_label_events from the deals table (deals-first:
 *              every canonical license/option/acquisition/co_development deal is
 *              matched to the licensor's assets by company + asset name).
 *   snapshots  Walk clinical_assets by company; for every kept asset (all
 *              positive assets + a deterministic 3 % sample of the rest) fetch
 *              the company evidence once and build one feature vector per
 *              monthly as_of (2022-01 .. 2025-09) with the pure builder.
 *              Resumable: cursor = last fully processed company_id.
 *   train      Load the snapshots, train on as_of <= 2024-06, calibrate on
 *              (2024-06, 2024-12], test on 2025; write radar_score_backtests;
 *              activate the model only if it beats the active one on the same
 *              test window (precision@50 and ROC-AUC), or none is active.
 *   done       No-op until reset (?reset=1) or retrain (?phase=train).
 *
 * Time budget per invocation is enforced by the caller (maxDuration 300 s,
 * MAX_RUNTIME_MS below); every phase writes its progress before returning.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { logRadarRun, deriveRunStatus } from '@/lib/radar/run-log';
import {
  FEATURE_VERSION, FEATURE_NAMES, FEATURE_SPECS, SIGN_CONSTRAINTS,
  buildFeatureVector, fetchFeatureBundles,
  type FeatureAsset, type FeatureBundle, type CompanyGroup, type TrialRow,
} from '@/lib/radar/backtest/features';
import {
  buildLabelEvents, labelSnapshot, monthlySnapshotDates, keepNegativeAsset,
  SNAPSHOT_FROM, SNAPSHOT_TO, POSITIVE_DEAL_TYPES, LABEL_WINDOW_MONTHS,
  type LabelAsset, type LabelDeal, type LabelEvent,
} from '@/lib/radar/backtest/labels';
import {
  trainLogistic, fitPlatt, fitIsotonic, buildModelParams, predictBatch, logitBatch, contributionMatrix,
  type ModelParams, type CalibrationParams,
} from '@/lib/radar/backtest/model';
import { computeMetrics, factorImportance, toBacktestSummary, MIN_POSITIVES_FOR_POWER } from '@/lib/radar/backtest/metrics';
import type { ScoreBacktestSummary } from '@/lib/radar/types';

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

export const BACKTEST_CURSOR_SOURCE = 'score_backtest';
/** Asset-level negative subsampling; positives are always kept. */
export const NEGATIVE_ASSET_SAMPLING_RATE = 0.03;
/** Train on as_of <= TRAIN_TO, calibrate on (TRAIN_TO, CALIB_TO], test on > CALIB_TO. */
export const TRAIN_TO = '2024-06-01';
export const CALIB_TO = '2024-12-01';
export const TEST_FROM = '2025-01-01';
export const L2_LAMBDA = 0.02;
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
    const { count: n, error } = await supabase.from(table).select('id', { count: 'exact', head: true });
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
      .in('deal_type', ['license', 'option', 'acquisition', 'co_development'])
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

async function fetchLabelAssets(supabase: SupabaseClient, deals: readonly LabelDeal[]): Promise<LabelAsset[]> {
  const companyIds = new Set<string>();
  const licensorNames = new Set<string>();
  for (const d of deals) {
    if (d.licensor_id) companyIds.add(d.licensor_id);
    else if (d.licensor_name) licensorNames.add(d.licensor_name);
  }
  // Resolve unlinked licensor names through companies.name / name_variations.
  const nameList = Array.from(licensorNames);
  for (const names of chunk(nameList, 200)) {
    const { data, error } = await supabase.from('companies').select('id, name, name_variations').in('name', names);
    if (error) throw new Error(`companies by name: ${error.message}`);
    for (const row of data ?? []) companyIds.add(row.id as string);
  }
  const variations = new Map<string, string[]>();
  const assets: LabelAsset[] = [];
  for (const ids of chunk(Array.from(companyIds), 150)) {
    const [assetsRes, companiesRes] = await Promise.all([
      supabase.from('clinical_assets').select('id, company_id, company_name, asset_name, asset_aliases').in('company_id', ids).limit(5000),
      supabase.from('companies').select('id, name_variations').in('id', ids),
    ]);
    if (assetsRes.error) throw new Error(`clinical_assets by company: ${assetsRes.error.message}`);
    if (companiesRes.error) throw new Error(`companies variations: ${companiesRes.error.message}`);
    for (const c of companiesRes.data ?? []) variations.set(c.id as string, (c.name_variations as string[] | null) ?? []);
    for (const a of assetsRes.data ?? []) {
      assets.push({
        id: a.id as string,
        company_id: a.company_id as string | null,
        company_name: a.company_name as string,
        company_name_variations: a.company_id ? variations.get(a.company_id as string) ?? [] : [],
        asset_name: a.asset_name as string,
        asset_aliases: (a.asset_aliases as string[] | null) ?? [],
      });
    }
  }
  return assets;
}

async function runLabelsPhase(supabase: SupabaseClient, state: BacktestCursorState, now: Date): Promise<{ written: number; errors: string[] }> {
  const errors: string[] = [];
  const deals = await fetchAllDeals(supabase);
  const assets = await fetchLabelAssets(supabase, deals);
  const events = buildLabelEvents(assets, deals);

  // Replace the table wholesale so a rebuild never leaves stale pairs.
  const del = await supabase.from('radar_score_label_events').delete().gte('announced_date', '1900-01-01');
  if (del.error) errors.push(`label_events delete: ${del.error.message}`);
  let written = 0;
  for (const rows of chunk(events, 500)) {
    const { error } = await supabase.from('radar_score_label_events').upsert(rows, { onConflict: 'asset_id,deal_id' });
    if (error) errors.push(`label_events upsert: ${error.message}`);
    else written += rows.length;
  }

  // Label horizon: the newest announced_date in the whole (eligible) deals
  // table, capped at today. Windows ending after it are unobservable.
  const horizonRes = await supabase.from('deals').select('announced_date').not('announced_date', 'is', null).lte('announced_date', now.toISOString().slice(0, 10)).order('announced_date', { ascending: false }).limit(1).maybeSingle();
  const horizon = (horizonRes.data?.announced_date as string | undefined) ?? now.toISOString().slice(0, 10);

  state.label_horizon = horizon;
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
  'id, company_id, company_name, asset_name, asset_aliases, phase, therapeutic_area, indication_category, modality, partnership_status, territory_rights_available, nct_ids, first_posted_date, regulatory_designations, originator_region';

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
    if (!vec.eligible) continue;
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
    const kept = rows.filter(a => eventsByAsset.has(a.id) || keepNegativeAsset(a.id, state.sampling_rate));
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
  row: (number | null)[];
  label: 0 | 1;
  weight: number;
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
      const features = (r.features ?? {}) as Record<string, number | null>;
      const rate = Number(r.sampling_rate) || 1;
      out.push({
        asset_id: r.asset_id as string,
        as_of: r.as_of as string,
        row: FEATURE_NAMES.map(name => (typeof features[name] === 'number' ? (features[name] as number) : null)),
        label: r.label === 1 ? 1 : 0,
        weight: r.label === 1 ? 1 : 1 / rate,
      });
    }
    if ((data?.length ?? 0) < ASSET_PAGE) break;
  }
  return out;
}

export interface TrainOutcome {
  params: ModelParams;
  summary: ReturnType<typeof toBacktestSummary>;
  testPredictions: Array<{ asset_id: string; as_of: string; prediction: number }>;
  notes: string[];
}

/**
 * Pure given the loaded rows: split, train, calibrate, evaluate.
 * Exported so the test suite can run it on synthetic data.
 */
export function trainAndEvaluate(rows: readonly LoadedSnapshot[], version: string, now: Date): TrainOutcome {
  const train = rows.filter(r => r.as_of <= TRAIN_TO);
  const calib = rows.filter(r => r.as_of > TRAIN_TO && r.as_of <= CALIB_TO);
  const test = rows.filter(r => r.as_of >= TEST_FROM);
  const notes: string[] = [];
  if (train.length === 0) throw new Error('trainAndEvaluate: no training rows');

  const posTrain = train.filter(r => r.label === 1).length;
  const fit = trainLogistic(train.map(r => r.row), train.map(r => r.label), {
    l2: L2_LAMBDA,
    classWeightPos: 'balanced',
    signConstraints: [...SIGN_CONSTRAINTS],
    maxIterations: 600,
  });
  const baseParams = { means: fit.means, stds: fit.stds, weights: fit.weights, bias: fit.bias, prior_correction: Math.log(NEGATIVE_ASSET_SAMPLING_RATE) };

  // Calibration on the slice after training, sample-weighted to undo subsampling.
  let calibration: CalibrationParams = { type: 'none' };
  const calibSet = calib.length >= 200 ? calib : train;
  if (calibSet === train) notes.push('calibration fitted in-sample (fewer than 200 rows in the calibration slice)');
  const calibLogits = logitBatch(calibSet.map(r => r.row), baseParams);
  const calibY = calibSet.map(r => r.label);
  const calibW = calibSet.map(r => r.weight);
  const calibPos = calibY.filter(v => v === 1).length;
  if (calibPos >= 100) {
    calibration = fitIsotonic(calibLogits.map(z => 1 / (1 + Math.exp(-z))), calibY, calibW);
    notes.push(`isotonic calibration on ${calibSet.length} rows / ${calibPos} positives`);
  } else if (calibPos >= 5) {
    calibration = fitPlatt(calibLogits, calibY, calibW);
    notes.push(`Platt calibration on ${calibSet.length} rows / ${calibPos} positives`);
  } else {
    notes.push(`no calibration (only ${calibPos} positives available)`);
  }

  const params = buildModelParams({
    version,
    featureVersion: FEATURE_VERSION,
    featureNames: [...FEATURE_NAMES],
    signConstraints: [...SIGN_CONSTRAINTS],
    fit,
    calibration,
    samplingRate: NEGATIVE_ASSET_SAMPLING_RATE,
    l2: L2_LAMBDA,
    trainWindow: { from: train[0].as_of, to: train[train.length - 1].as_of },
    testWindow: { from: test[0]?.as_of ?? TEST_FROM, to: test[test.length - 1]?.as_of ?? TEST_FROM },
    nTrain: train.length,
    positivesTrain: posTrain,
    trainedAt: now,
  });

  const testX = test.map(r => r.row);
  const preds = predictBatch(testX, params);
  const metrics = computeMetrics(preds, test.map(r => r.label), test.map(r => r.weight));
  const importance = factorImportance(FEATURE_NAMES, contributionMatrix(testX, params));
  notes.push(`negatives subsampled at ${NEGATIVE_ASSET_SAMPLING_RATE} per asset; metrics weighted back to the full universe`);
  notes.push(`train positives ${posTrain} / ${train.length} rows; class weight ${fit.classWeightPos.toFixed(1)}; ${fit.iterations} iterations`);
  if (metrics.positives < MIN_POSITIVES_FOR_POWER) notes.push('holdout has too few positives for a stable ranking estimate');

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
    testPredictions: test.map((r, i) => ({ asset_id: r.asset_id, as_of: r.as_of, prediction: preds[i] })),
    notes,
  };
}

export async function loadActiveModel(supabase: SupabaseClient): Promise<ModelParams | null> {
  const { data, error } = await supabase.from('radar_score_models').select('version, params').eq('is_active', true).maybeSingle();
  if (error) throw new Error(`radar_score_models read: ${error.message}`);
  if (!data) return null;
  const params = data.params as ModelParams;
  return { ...params, version: (data.version as string) ?? params.version };
}

async function runTrainPhase(
  supabase: SupabaseClient,
  state: BacktestCursorState,
  now: Date,
): Promise<{ errors: string[]; modelVersion: string; backtestId?: string; activated: boolean; metrics: Record<string, number | boolean> }> {
  const errors: string[] = [];
  const rows = await loadSnapshots(supabase, state.feature_version);
  if (rows.length === 0) throw new Error('train: no snapshots for this feature version');
  const stamp = now.toISOString().replace(/[-:T]/g, '').slice(0, 12);
  const version = `v3.${stamp}`;
  const outcome = trainAndEvaluate(rows, version, now);

  // Compare with the incumbent on the same test rows.
  let activated = false;
  let incumbentNote = 'no active model; activating';
  try {
    const active = await loadActiveModel(supabase);
    if (active && active.feature_version === state.feature_version) {
      const test = rows.filter(r => r.as_of >= TEST_FROM);
      const incPreds = predictBatch(test.map(r => r.row), active);
      const inc = computeMetrics(incPreds, test.map(r => r.label), test.map(r => r.weight));
      // precision@50 is 0 for both models while positives are scarce, so it
      // cannot break ties; PR-AUC can. A low-power candidate never displaces
      // an incumbent that was validated with enough positives.
      const candidateLowPower = outcome.summary.positives_test < MIN_POSITIVES_FOR_POWER;
      const incumbentLowPower = inc.positives < MIN_POSITIVES_FOR_POWER;
      let better: boolean;
      let why: string;
      if (candidateLowPower && !incumbentLowPower) {
        better = false;
        why = 'candidate is low-power, incumbent is not';
      } else {
        better = outcome.summary.roc_auc > inc.roc_auc && outcome.summary.pr_auc > inc.pr_auc;
        why = better ? 'better AUC and PR-AUC' : 'not better on both AUC and PR-AUC';
      }
      incumbentNote = `incumbent ${active.version}: auc ${inc.roc_auc.toFixed(4)} pr-auc ${inc.pr_auc.toFixed(4)} p@50 ${inc.precision_at_50.toFixed(4)}; candidate auc ${outcome.summary.roc_auc.toFixed(4)} pr-auc ${outcome.summary.pr_auc.toFixed(4)} p@50 ${outcome.summary.precision_at_50.toFixed(4)} → ${better ? 'replaces' : 'kept incumbent'} (${why})`;
      activated = better;
    } else if (active) {
      incumbentNote = `incumbent ${active.version} uses feature version ${active.feature_version}; candidate activates on feature version ${state.feature_version}`;
      activated = true;
    } else {
      activated = true;
    }
  } catch (e) {
    errors.push(`incumbent comparison: ${errMsg(e)}`);
  }
  if (outcome.summary.roc_auc < MIN_AUC_TO_ACTIVATE) {
    activated = false;
    incumbentNote += ` | auc below ${MIN_AUC_TO_ACTIVATE}: not activated`;
  }

  // Persist the model.
  const modelRow = {
    version,
    trained_at: now.toISOString(),
    params: outcome.params,
    feature_names: [...FEATURE_NAMES],
    train_window: outcome.params.train_window,
    test_window: outcome.params.test_window,
    is_active: false,
    notes: [incumbentNote, ...outcome.notes].join(' | '),
  };
  const ins = await supabase.from('radar_score_models').insert(modelRow);
  if (ins.error) { errors.push(`model insert: ${ins.error.message}`); activated = false; }

  if (activated) {
    const off = await supabase.from('radar_score_models').update({ is_active: false }).eq('is_active', true);
    if (off.error) errors.push(`deactivate incumbent: ${off.error.message}`);
    const on = await supabase.from('radar_score_models').update({ is_active: true }).eq('version', version);
    if (on.error) { errors.push(`activate ${version}: ${on.error.message}`); activated = false; }
  }

  // Raw predictions sample: top 2,000 by score + every positive, stored on the snapshot rows.
  const sample = [...outcome.testPredictions].sort((a, b) => b.prediction - a.prediction).slice(0, 2000);
  const positives = new Set(rows.filter(r => r.as_of >= TEST_FROM && r.label === 1).map(r => `${r.asset_id}:${r.as_of}`));
  for (const p of outcome.testPredictions) if (positives.has(`${p.asset_id}:${p.as_of}`) && !sample.includes(p)) sample.push(p);
  for (const batch of chunk(sample, 500)) {
    const { error } = await supabase.from('radar_score_snapshots').upsert(
      batch.map(p => ({ asset_id: p.asset_id, as_of: p.as_of, feature_version: state.feature_version, prediction: Math.round(p.prediction * 1e6) / 1e6, prediction_model: version })),
      { onConflict: 'asset_id,as_of,feature_version', ignoreDuplicates: false },
    );
    if (error) { errors.push(`prediction sample: ${error.message}`); break; }
  }

  const backtestRow = {
    ...outcome.summary,
    activated,
    raw_predictions_path: `radar_score_snapshots.prediction where prediction_model = '${version}' (${sample.length} rows)`,
    notes: [outcome.summary.notes, incumbentNote].filter(Boolean).join(' | '),
  };
  const bt = await supabase.from('radar_score_backtests').insert(backtestRow).select('id').single();
  if (bt.error) errors.push(`backtest insert: ${bt.error.message}`);

  state.phase = 'done';
  state.last_model_version = version;
  state.last_backtest_id = (bt.data?.id as string | undefined) ?? null;
  return {
    errors,
    modelVersion: version,
    backtestId: state.last_backtest_id ?? undefined,
    activated,
    metrics: {
      roc_auc: outcome.summary.roc_auc,
      pr_auc: outcome.summary.pr_auc,
      precision_at_50: outcome.summary.precision_at_50,
      precision_at_100: outcome.summary.precision_at_100,
      lift_top_decile: outcome.summary.lift_top_decile,
      brier: outcome.summary.brier,
      n_train: outcome.summary.n_train,
      n_test: outcome.summary.n_test,
      positives_test: outcome.summary.positives_test,
      low_power: outcome.summary.low_power,
    },
  };
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
  if (state.phase === 'done' && !options.phase && !options.reset) {
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
      const r = await runTrainPhase(supabase, state, now);
      errors.push(...r.errors);
      extra = { model_version: r.modelVersion, backtest_id: r.backtestId, activated: r.activated, metrics: r.metrics };
      processed = r.metrics.n_train as number;
      written = 1;
      state.trained_at = now.toISOString();
      try {
        state.source_counts_at_train = await sourceCounts(supabase);
      } catch (e) {
        errors.push(`source counts: ${errMsg(e)}`);
      }
    }
    state.last_error = errors.length ? errors[0] : null;
  } catch (e) {
    const msg = errMsg(e);
    errors.push(msg);
    state.last_error = msg;
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
  if (params) params.feature_names.forEach((name, j) => weightByFeature.set(name, params.weights[j]));

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
        `A canonical, non-rejected deal in the Solidus deals table in which the licensor is the asset's owning company ` +
        `(by company id, or by legal-suffix-insensitive name match against the company's recorded name variations), ` +
        `the deal's asset name matches the asset (exact, development-code or ≥80% word-overlap match), the deal type is ` +
        `${Array.from(POSITIVE_DEAL_TYPES).join(', ')}, and the announcement date falls in the ${LABEL_WINDOW_MONTHS} months after the snapshot date. ` +
        `Negatives are assets that existed at the snapshot date with no such deal on or before it and none in the window.`,
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
    features: FEATURE_SPECS.map(spec => ({
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
