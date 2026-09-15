/**
 * Asset classification pass for the Asset Radar (migration 112).
 *
 * Fills therapeutic_area, indication_category, indication_specific, modality,
 * target, target_class, mechanism and moa_short on clinical_assets from the
 * asset's own trial evidence, with provenance and confidence on every row.
 *
 * Pipeline per run (classifyAssetsBatch):
 *   1. Queue: classification_status = 'unclassified' (industry owners first,
 *      then academic / hospital / government / other, then assets without a
 *      company), then 'needs_review' rows older than 30 days.
 *   2. Pre-classify: placebo, comparator, generic-class and non-drug names are
 *      marked 'skipped' without a model call (lib/radar/drug-name.ts).
 *   3. drug_master reuse: a resolved drug node carrying modality + target at
 *      confidence >= 70 is written as-is (classification_model = 'drug_master')
 *      when the therapeutic area is already known; otherwise the node is passed
 *      to the model as a hint and its modality/target are preferred on write.
 *   4. Model: batches of 20 assets to claude-sonnet-5 with a cached static
 *      system prompt (lib/radar/classify-prompt.ts) and JSON-schema structured
 *      output; every item is re-validated with zod before anything is written.
 *   5. Write policy (planAssetPatch):
 *        confidence < 60            -> needs_review, suggestion parked in
 *                                      classification_evidence, columns untouched
 *        therapeutic_area/modality/ -> fill when NULL (or a generic placeholder);
 *        indication_*                  overwrite a heuristic value only at >= 85
 *        target/target_class/       -> written whenever confidence >= 60
 *        mechanism/moa_short
 *      Out-of-vocabulary output never reaches a data column: the row goes to
 *      needs_review with the raw suggestion and reason 'schema_violation'.
 *   6. Key-uniform batched upserts (see bySignature in asset-universe.ts) and
 *      one data_ingestion_log row via logRadarRun with parameters.stage =
 *      'classify', per-status counts, token usage and estimated cost.
 *
 * validateClassificationSample re-runs already-classified assets through
 * claude-opus-4-6 and reports per-field agreement without writing to assets.
 */

import Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';
import { deriveRunStatus, logRadarRun } from '@/lib/radar/run-log';
import { isNonDrugIntervention, isPlaceboOrGeneric, normalizeKey } from '@/lib/radar/drug-name';
import type { ClassificationStatus, OwnerType } from '@/lib/radar/types';
import {
  ClassificationItemSchema,
  INDICATION_CATEGORIES,
  MAX_INTERVENTIONS_PER_ASSET,
  MAX_TRIALS_PER_ASSET,
  MODALITIES,
  PROMPT_VERSION,
  THERAPEUTIC_AREAS,
  buildOutputJsonSchema,
  buildSystemPrompt,
  buildUserMessage,
  type ClassificationDrugMasterInput,
  type ClassificationInput,
  type ClassificationItem,
} from '@/lib/radar/classify-prompt';

// ═══════════════════════════════════════════════════════════════════════
// CONSTANTS
// ═══════════════════════════════════════════════════════════════════════

export const DEFAULT_MODEL = 'claude-sonnet-5';
export const VALIDATION_MODEL = 'claude-opus-4-6';
export const DEFAULT_LIMIT = 400;
export const DEFAULT_TIME_BUDGET_MS = 250_000;
export const DEFAULT_BATCH_SIZE = 20;
export const DEFAULT_CONCURRENCY = 3;
export const MAX_OUTPUT_TOKENS = 8192;

/** Below this the model's suggestion is parked in classification_evidence and nothing is written. */
export const CONFIDENCE_WRITE_MIN = 60;
/** At or above this a heuristic (ingester-derived) value may be replaced. */
export const CONFIDENCE_OVERWRITE_MIN = 85;
/** drug_master rows at or above this confidence are reused without a model call. */
export const DRUG_MASTER_MIN_CONFIDENCE = 70;
/** needs_review rows are retried after this many days. */
export const NEEDS_REVIEW_RETRY_DAYS = 30;

const PAGE_SIZE = 1000;
const UPSERT_CHUNK_SIZE = 100;
const IN_CHUNK = 150;
const RETRY_MAX_ATTEMPTS = 3;
const RETRY_BASE_MS = 1500;

/** USD per million tokens. Cache write is 1.25x input, cache read 0.1x input. */
export const MODEL_PRICING: Record<string, { input: number; output: number }> = {
  'claude-sonnet-5': { input: 2, output: 10 },
  'claude-sonnet-4-6': { input: 3, output: 15 },
  'claude-opus-5': { input: 5, output: 25 },
  'claude-opus-4-6': { input: 5, output: 25 },
  'claude-haiku-4-5': { input: 1, output: 5 },
};

/**
 * Models that still accept `temperature`. Sonnet 5, Opus 5 and later reject
 * sampling parameters with a 400; there we rely on disabled thinking plus a
 * JSON schema for determinism.
 */
const TEMPERATURE_OK_RE = /^claude-(?:opus-4-6|sonnet-4-6|haiku-4-5|opus-4-5|sonnet-4-5|opus-4-1|opus-4-0|sonnet-4-0|3-)/;
export function supportsTemperature(model: string): boolean {
  return TEMPERATURE_OK_RE.test(model);
}

/** Placeholder values the ingester writes when it cannot tell; treated as NULL by the fill rule. */
const GENERIC_MODALITIES = new Set(['other', 'unknown', '']);
const GENERIC_INDICATION_SPECIFIC = new Set([
  'solid_tumor', 'solid tumor', 'solid tumors', 'cancer', 'hematological', 'other', 'unknown', 'n/a', '',
]);

/** data_sources markers that protect a value from any overwrite. */
const PROTECTED_SOURCES = new Set(['manual', 'curated', 'analyst']);

// ═══════════════════════════════════════════════════════════════════════
// TYPES
// ═══════════════════════════════════════════════════════════════════════

/** The only SDK surface this module uses; tests pass a stub. */
export interface ClassifierClient {
  messages: {
    create(params: Anthropic.MessageCreateParamsNonStreaming): Promise<Anthropic.Message>;
  };
}

export interface TokenUsage {
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
}

export interface ClassifyOptions {
  /** Assets per run (default 400). */
  limit?: number;
  /** Stop starting new model batches after this many ms (default 250 000). */
  timeBudgetMs?: number;
  /** Model id for the bulk pass (default claude-sonnet-5). */
  model?: string;
  /** Restrict the queue to these statuses (default: unclassified then needs_review). */
  onlyStatuses?: ClassificationStatus[];
  /** Assets per model request (default 20; 15-20 recommended). */
  batchSize?: number;
  /** Concurrent model requests (default 3). */
  concurrency?: number;
  /** Hard cap on model requests per run, retries included (cost cap). Default ceil(limit / batchSize) * 2. */
  maxRequests?: number;
  runType?: 'scheduled' | 'manual' | 'backfill';
  /** Plan everything but write nothing to clinical_assets (run log still written with dry_run = true). */
  dryRun?: boolean;
  /** Injected for tests. */
  client?: ClassifierClient;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export interface ClassifyRunResult {
  model: string;
  fetched: number;
  processed: number;
  classified: number;
  fromDrugMaster: number;
  needsReview: number;
  skipped: number;
  failed: number;
  requests: number;
  retries: number;
  tokens: TokenUsage;
  estimatedCostUsd: number;
  cacheHitRate: number;
  timedOut: boolean;
  requestCapHit: boolean;
  errors: string[];
  logged: boolean;
  dryRun: boolean;
  /** Present on dry runs only: the first 20 planned patches for inspection. */
  samplePatches?: AssetPatch[];
}

export interface QueuedAsset {
  id: string;
  company_id: string | null;
  company_name: string;
  asset_name: string;
  asset_aliases: string[] | null;
  indications_all: string[] | null;
  nct_ids: string[] | null;
  lead_nct_id: string | null;
  therapeutic_area: string | null;
  modality: string | null;
  indication_category: string | null;
  indication_specific: string | null;
  target: string | null;
  mechanism: string | null;
  target_class?: string | null;
  moa_short?: string | null;
  data_sources: string[] | null;
  classification_status: ClassificationStatus;
  classification_evidence: Record<string, unknown> | null;
  classification_confidence?: number | null;
  classification_model?: string | null;
  drug_master_id: string | null;
  drug_resolution_status: string | null;
  owner_type: OwnerType | null;
}

export type FieldAction = 'filled' | 'overwritten' | 'kept' | 'unchanged' | 'confirmed';

export interface FieldEvidence {
  /** Value proposed by the model (or drug_master). */
  value: string | null;
  /** Value on the row before this pass. */
  prior: string | null;
  action: FieldAction;
  source: 'model' | 'drug_master';
}

export interface ClassificationEvidence {
  version: string;
  model: string;
  decided_by: string;
  rationale: string | null;
  nct_ids: string[];
  fields: Record<string, FieldEvidence>;
  suggestion?: ClassificationItem | Record<string, unknown>;
  reason?: 'low_confidence' | 'schema_violation' | 'non_drug' | 'placebo_or_generic' | 'model_error';
  drug_master_id?: string;
  [key: string]: unknown;
}

/** One row of the key-uniform upsert. Optional data columns are present only when written. */
export interface AssetPatch {
  id: string;
  company_name: string;
  asset_name: string;
  classification_status: ClassificationStatus;
  classified_at: string;
  classification_confidence: number;
  classification_model: string;
  classification_evidence: ClassificationEvidence;
  updated_at: string;
  therapeutic_area?: string;
  modality?: string;
  indication_category?: string;
  indication_specific?: string;
  target?: string;
  target_class?: string;
  mechanism?: string;
  moa_short?: string;
}

// ═══════════════════════════════════════════════════════════════════════
// COST
// ═══════════════════════════════════════════════════════════════════════

export function emptyUsage(): TokenUsage {
  return { input: 0, output: 0, cacheWrite: 0, cacheRead: 0 };
}

export function addUsage(total: TokenUsage, msg: Pick<Anthropic.Message, 'usage'>): void {
  const u = msg.usage;
  total.input += u.input_tokens ?? 0;
  total.output += u.output_tokens ?? 0;
  total.cacheWrite += u.cache_creation_input_tokens ?? 0;
  total.cacheRead += u.cache_read_input_tokens ?? 0;
}

export function mergeUsage(total: TokenUsage, part: TokenUsage): void {
  total.input += part.input;
  total.output += part.output;
  total.cacheWrite += part.cacheWrite;
  total.cacheRead += part.cacheRead;
}

/** Estimated USD for a run at list price; unknown models fall back to Sonnet 5 pricing. */
export function estimateCostUsd(model: string, usage: TokenUsage): number {
  const p = MODEL_PRICING[model] ?? MODEL_PRICING[DEFAULT_MODEL];
  const perM = 1_000_000;
  const cost =
    (usage.input * p.input) / perM +
    (usage.cacheWrite * p.input * 1.25) / perM +
    (usage.cacheRead * p.input * 0.1) / perM +
    (usage.output * p.output) / perM;
  return Math.round(cost * 10_000) / 10_000;
}

// ═══════════════════════════════════════════════════════════════════════
// PAGING
// ═══════════════════════════════════════════════════════════════════════

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

/** Page through any select with .range(); PostgREST caps a single response at 1,000 rows. */
async function fetchAllPages<T>(label: string, build: (from: number, to: number) => PageResult<T>): Promise<T[]> {
  const out: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await build(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(`${label}: ${error.message}`);
    const rows = data ?? [];
    out.push(...rows);
    if (rows.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return out;
}

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

// ═══════════════════════════════════════════════════════════════════════
// QUEUE
// ═══════════════════════════════════════════════════════════════════════

const QUEUE_COLUMNS =
  'id, company_id, company_name, asset_name, asset_aliases, indications_all, nct_ids, lead_nct_id, therapeutic_area, modality, indication_category, indication_specific, target, mechanism, target_class, moa_short, data_sources, classification_status, classification_evidence, classification_confidence, classification_model, drug_master_id, drug_resolution_status';

/** clinical_assets has two FKs to companies (company_id, partner_company_id); the embed must name the one it wants. */
const COMPANY_EMBED = 'companies!clinical_assets_company_id_fkey';

type CompanyEmbed = { owner_type: OwnerType | null };
/** PostgREST returns a to-one embed as an object; the select-string type parser guesses an array, so accept both. */
type RawQueueRow = Omit<QueuedAsset, 'owner_type'> & { companies?: CompanyEmbed | CompanyEmbed[] | null };

function toQueued(row: RawQueueRow): QueuedAsset {
  const { companies, ...rest } = row;
  const embed = Array.isArray(companies) ? companies[0] : companies;
  return { ...rest, owner_type: embed?.owner_type ?? null };
}

function asRows(data: unknown): RawQueueRow[] {
  return (data ?? []) as RawQueueRow[];
}

/**
 * Queue order: unclassified industry-owned, unclassified other owners,
 * unclassified without a company, then needs_review older than 30 days.
 * Within each group the stalest updated_at first (index
 * idx_clinical_assets_classification_queue).
 */
export async function fetchClassificationQueue(
  supabase: SupabaseClient,
  limit: number,
  onlyStatuses?: ClassificationStatus[],
  now: () => number = Date.now,
): Promise<QueuedAsset[]> {
  const wants = (s: ClassificationStatus) => !onlyStatuses || onlyStatuses.includes(s);
  const out: QueuedAsset[] = [];
  const seen = new Set<string>();
  const push = (rows: RawQueueRow[] | null) => {
    for (const r of rows ?? []) {
      if (seen.has(r.id)) continue;
      seen.add(r.id);
      out.push(toQueued(r));
    }
  };
  const remaining = () => limit - out.length;

  if (wants('unclassified')) {
    const { data: industry, error: e1 } = await supabase
      .from('clinical_assets')
      .select(`${QUEUE_COLUMNS}, ${COMPANY_EMBED}!inner(owner_type)`)
      .eq('classification_status', 'unclassified')
      .eq('companies.owner_type', 'industry')
      .order('updated_at', { ascending: true })
      .limit(remaining());
    if (e1) throw new Error(`classification queue (industry) read failed: ${e1.message}`);
    push(asRows(industry));

    if (remaining() > 0) {
      const { data: others, error: e2 } = await supabase
        .from('clinical_assets')
        .select(`${QUEUE_COLUMNS}, ${COMPANY_EMBED}!inner(owner_type)`)
        .eq('classification_status', 'unclassified')
        .neq('companies.owner_type', 'industry')
        .order('updated_at', { ascending: true })
        .limit(remaining());
      if (e2) throw new Error(`classification queue (other owners) read failed: ${e2.message}`);
      push(asRows(others));
    }

    if (remaining() > 0) {
      const { data: orphans, error: e3 } = await supabase
        .from('clinical_assets')
        .select(QUEUE_COLUMNS)
        .eq('classification_status', 'unclassified')
        .is('company_id', null)
        .order('updated_at', { ascending: true })
        .limit(remaining());
      if (e3) throw new Error(`classification queue (no company) read failed: ${e3.message}`);
      push(asRows(orphans));
    }
  }

  if (wants('needs_review') && remaining() > 0) {
    const cutoff = new Date(now() - NEEDS_REVIEW_RETRY_DAYS * 86_400_000).toISOString();
    const { data: review, error: e4 } = await supabase
      .from('clinical_assets')
      .select(`${QUEUE_COLUMNS}, ${COMPANY_EMBED}(owner_type)`)
      .eq('classification_status', 'needs_review')
      .lt('classified_at', cutoff)
      .order('classified_at', { ascending: true })
      .limit(remaining());
    if (e4) throw new Error(`classification queue (needs_review) read failed: ${e4.message}`);
    push(asRows(review));
  }

  return out;
}

// ═══════════════════════════════════════════════════════════════════════
// PRE-CLASSIFY (no model)
// ═══════════════════════════════════════════════════════════════════════

export type SkipReason = 'non_drug' | 'placebo_or_generic';

/** Names that are not a drug are marked skipped without spending a model call. */
export function preClassify(asset: Pick<QueuedAsset, 'asset_name'>): SkipReason | null {
  const name = asset.asset_name ?? '';
  if (isNonDrugIntervention(name)) return 'non_drug';
  if (isPlaceboOrGeneric(name)) return 'placebo_or_generic';
  return null;
}

// ═══════════════════════════════════════════════════════════════════════
// INPUT GATHERING
// ═══════════════════════════════════════════════════════════════════════

interface DrugMasterRow {
  id: string;
  preferred_name: string;
  modality: string | null;
  target: string | null;
  mechanism: string | null;
  confidence: number;
}

interface TrialRow {
  nct_id: string;
  trial_title: string | null;
  conditions: string[] | null;
  brief_summary: string | null;
}

interface InterventionRow {
  nct_id: string;
  name: string;
  name_normalized: string | null;
  other_names: string[] | null;
  description: string | null;
  arm_role: string | null;
}

function assetNcts(asset: QueuedAsset): string[] {
  const list = [asset.lead_nct_id, ...(asset.nct_ids ?? [])].filter((n): n is string => !!n);
  return [...new Set(list)].slice(0, MAX_TRIALS_PER_ASSET);
}

function assetNameKeys(asset: QueuedAsset): Set<string> {
  const keys = new Set<string>();
  for (const n of [asset.asset_name, ...(asset.asset_aliases ?? [])]) {
    const k = normalizeKey(n ?? '');
    if (k) keys.add(k);
  }
  return keys;
}

/** Fetch drug_master nodes, trials and interventions for a set of assets in a handful of chunked queries. */
export async function gatherClassificationInputs(
  supabase: SupabaseClient,
  assets: QueuedAsset[],
): Promise<Map<string, ClassificationInput>> {
  const drugIds = [...new Set(assets.filter(a => a.drug_master_id && a.drug_resolution_status === 'resolved').map(a => a.drug_master_id!))];
  const drugs = new Map<string, DrugMasterRow>();
  for (const ids of chunk(drugIds, IN_CHUNK)) {
    const rows = await fetchAllPages<DrugMasterRow>('drug_master read failed', (from, to) =>
      supabase.from('drug_master').select('id, preferred_name, modality, target, mechanism, confidence').in('id', ids).order('id').range(from, to),
    );
    for (const r of rows) drugs.set(r.id, r);
  }

  const ncts = [...new Set(assets.flatMap(assetNcts))];
  const trials = new Map<string, TrialRow>();
  const interventions = new Map<string, InterventionRow[]>();
  for (const ids of chunk(ncts, IN_CHUNK)) {
    const trialRows = await fetchAllPages<TrialRow>('company_trials read failed', (from, to) =>
      supabase.from('company_trials').select('nct_id, trial_title, conditions, brief_summary').in('nct_id', ids).order('id').range(from, to),
    );
    for (const t of trialRows) {
      // company_trials holds one row per (company, trial); keep the richest copy.
      const prior = trials.get(t.nct_id);
      if (!prior || (!prior.brief_summary && t.brief_summary)) trials.set(t.nct_id, t);
    }
    const intRows = await fetchAllPages<InterventionRow>('trial_interventions read failed', (from, to) =>
      supabase.from('trial_interventions').select('nct_id, name, name_normalized, other_names, description, arm_role').in('nct_id', ids).order('id').range(from, to),
    );
    for (const i of intRows) {
      if (!interventions.has(i.nct_id)) interventions.set(i.nct_id, []);
      interventions.get(i.nct_id)!.push(i);
    }
  }

  const out = new Map<string, ClassificationInput>();
  for (const asset of assets) {
    const keys = assetNameKeys(asset);
    const nctList = assetNcts(asset);
    const dm = asset.drug_master_id ? drugs.get(asset.drug_master_id) : undefined;
    const matched: InterventionRow[] = [];
    for (const nct of nctList) {
      for (const i of interventions.get(nct) ?? []) {
        const iKeys = [i.name_normalized ?? normalizeKey(i.name), ...(i.other_names ?? []).map(normalizeKey)];
        if (iKeys.some(k => k && keys.has(k))) matched.push(i);
      }
    }
    out.set(asset.id, {
      asset_id: asset.id,
      asset_name: asset.asset_name,
      aliases: (asset.asset_aliases ?? []).filter(a => a && normalizeKey(a) !== normalizeKey(asset.asset_name)),
      company_name: asset.company_name,
      indications_all: asset.indications_all ?? [],
      current: {
        therapeutic_area: asset.therapeutic_area,
        modality: asset.modality,
        indication_category: asset.indication_category,
        indication_specific: asset.indication_specific,
      },
      drug_master: dm
        ? { preferred_name: dm.preferred_name, modality: dm.modality, target: dm.target, mechanism: dm.mechanism, confidence: dm.confidence }
        : null,
      trials: nctList
        .map(n => trials.get(n))
        .filter((t): t is TrialRow => !!t)
        .map(t => ({ nct_id: t.nct_id, title: t.trial_title, conditions: t.conditions ?? [], brief_summary: t.brief_summary })),
      interventions: matched.slice(0, MAX_INTERVENTIONS_PER_ASSET).map(i => ({
        nct_id: i.nct_id,
        name: i.name,
        other_names: i.other_names ?? [],
        description: i.description,
      })),
    });
  }
  return out;
}

// ═══════════════════════════════════════════════════════════════════════
// WRITE POLICY
// ═══════════════════════════════════════════════════════════════════════

function isProtected(asset: Pick<QueuedAsset, 'data_sources'>): boolean {
  return (asset.data_sources ?? []).some(s => PROTECTED_SOURCES.has(String(s).toLowerCase()));
}

function isGenericModality(v: string | null): boolean {
  return v == null || GENERIC_MODALITIES.has(v.trim().toLowerCase());
}

function isGenericIndicationSpecific(v: string | null, category: string | null): boolean {
  if (v == null) return true;
  const s = v.trim().toLowerCase();
  return GENERIC_INDICATION_SPECIFIC.has(s) || (!!category && s === category.trim().toLowerCase());
}

interface DecideArgs {
  existing: string | null;
  proposed: string | null;
  confidence: number;
  /** Treat the existing value as empty (NULL or a generic placeholder). */
  existingIsEmpty: boolean;
  /** Existing value may be replaced at >= CONFIDENCE_OVERWRITE_MIN. */
  overwritable: boolean;
  source: 'model' | 'drug_master';
}

function decideField(a: DecideArgs): { write: string | null; evidence: FieldEvidence } {
  const base = { value: a.proposed, prior: a.existing, source: a.source };
  if (a.proposed == null) return { write: null, evidence: { ...base, action: 'unchanged' } };
  if (a.existingIsEmpty) return { write: a.proposed, evidence: { ...base, action: 'filled' } };
  if (a.existing === a.proposed) return { write: null, evidence: { ...base, action: 'confirmed' } };
  if (a.overwritable && a.confidence >= CONFIDENCE_OVERWRITE_MIN) {
    return { write: a.proposed, evidence: { ...base, action: 'overwritten' } };
  }
  return { write: null, evidence: { ...base, action: 'kept' } };
}

/**
 * Turn one validated model item into the row patch. Pure; unit tested.
 *
 * `dm` (optional) is the resolved drug_master node: when it carries a
 * modality or target at >= DRUG_MASTER_MIN_CONFIDENCE those take precedence
 * over the model's proposal for that field, with source 'drug_master'.
 */
export function planAssetPatch(
  asset: QueuedAsset,
  item: ClassificationItem,
  model: string,
  nowIso: string,
  dm?: ClassificationDrugMasterInput | null,
): AssetPatch {
  const base: AssetPatch = {
    id: asset.id,
    company_name: asset.company_name,
    asset_name: asset.asset_name,
    classification_status: 'classified',
    classified_at: nowIso,
    classification_confidence: item.confidence,
    classification_model: model,
    classification_evidence: {
      version: PROMPT_VERSION,
      model,
      decided_by: item.evidence,
      rationale: item.rationale || null,
      nct_ids: assetNcts(asset),
      fields: {},
    },
    updated_at: nowIso,
  };

  if (item.confidence < CONFIDENCE_WRITE_MIN) {
    base.classification_status = 'needs_review';
    base.classification_evidence.reason = 'low_confidence';
    base.classification_evidence.suggestion = item;
    return base;
  }

  const locked = isProtected(asset);
  const conf = item.confidence;
  const fields = base.classification_evidence.fields;
  const dmTrusted = !!dm && dm.confidence >= DRUG_MASTER_MIN_CONFIDENCE;

  // therapeutic_area / indication_category: fill NULL; overwrite heuristic only at >= 85.
  const ta = decideField({
    existing: asset.therapeutic_area, proposed: item.therapeutic_area, confidence: conf,
    existingIsEmpty: asset.therapeutic_area == null, overwritable: !locked, source: 'model',
  });
  fields.therapeutic_area = ta.evidence;
  if (ta.write) base.therapeutic_area = ta.write;

  const cat = decideField({
    existing: asset.indication_category, proposed: item.indication_category, confidence: conf,
    existingIsEmpty: asset.indication_category == null, overwritable: !locked, source: 'model',
  });
  fields.indication_category = cat.evidence;
  if (cat.write) base.indication_category = cat.write;

  const spec = decideField({
    existing: asset.indication_specific, proposed: item.indication_specific, confidence: conf,
    existingIsEmpty: isGenericIndicationSpecific(asset.indication_specific, asset.indication_category),
    overwritable: !locked, source: 'model',
  });
  fields.indication_specific = spec.evidence;
  if (spec.write) base.indication_specific = spec.write;

  // modality: drug_master (public registry) beats the model when trusted.
  const modalityProposed = dmTrusted && dm!.modality && (MODALITIES as string[]).includes(dm!.modality) ? dm!.modality : item.modality;
  const mod = decideField({
    existing: asset.modality, proposed: modalityProposed, confidence: dmTrusted && dm!.modality ? Math.max(conf, dm!.confidence) : conf,
    existingIsEmpty: isGenericModality(asset.modality), overwritable: !locked,
    source: dmTrusted && dm!.modality ? 'drug_master' : 'model',
  });
  fields.modality = mod.evidence;
  if (mod.write) base.modality = mod.write;

  // target / target_class / mechanism / moa_short: written whenever confidence >= 60 and non-null.
  const targetProposed = dmTrusted && dm!.target ? dm!.target : item.target;
  const targetSource: 'model' | 'drug_master' = dmTrusted && dm!.target ? 'drug_master' : 'model';
  fields.target = { value: targetProposed, prior: asset.target, source: targetSource, action: targetProposed == null ? 'unchanged' : asset.target == null ? 'filled' : asset.target === targetProposed ? 'confirmed' : locked ? 'kept' : 'overwritten' };
  if (targetProposed && !(locked && asset.target)) base.target = targetProposed;

  const tc = item.target_class ?? 'unknown';
  fields.target_class = { value: tc, prior: asset.target_class ?? null, source: 'model', action: asset.target_class == null ? 'filled' : asset.target_class === tc ? 'confirmed' : 'overwritten' };
  base.target_class = tc;

  if (item.moa_short) {
    fields.moa_short = { value: item.moa_short, prior: asset.moa_short ?? null, source: 'model', action: asset.moa_short == null ? 'filled' : 'overwritten' };
    base.moa_short = item.moa_short;
    const mechProposed = dmTrusted && dm!.mechanism ? dm!.mechanism.slice(0, 200) : item.moa_short;
    fields.mechanism = { value: mechProposed, prior: asset.mechanism, source: dmTrusted && dm!.mechanism ? 'drug_master' : 'model', action: asset.mechanism == null ? 'filled' : locked ? 'kept' : 'overwritten' };
    if (!(locked && asset.mechanism)) base.mechanism = mechProposed;
  }

  if (dm) base.classification_evidence.drug_master_id = asset.drug_master_id ?? undefined;
  return base;
}

/** Patch for a name that is not a drug. */
export function planSkipPatch(asset: QueuedAsset, reason: SkipReason, nowIso: string): AssetPatch {
  return {
    id: asset.id,
    company_name: asset.company_name,
    asset_name: asset.asset_name,
    classification_status: 'skipped',
    classified_at: nowIso,
    classification_confidence: 100,
    classification_model: 'rule:drug-name',
    classification_evidence: {
      version: PROMPT_VERSION,
      model: 'rule:drug-name',
      decided_by: 'asset_name',
      rationale: reason === 'non_drug' ? 'isNonDrugIntervention matched the asset name' : 'isPlaceboOrGeneric matched the asset name',
      nct_ids: assetNcts(asset),
      fields: {},
      reason,
    },
    updated_at: nowIso,
  };
}

/**
 * Reuse a resolved drug_master node without a model call. Applies only when
 * the node carries modality + target at >= 70 and the asset already has a
 * therapeutic area (otherwise the model is still needed to fill it and the
 * node is passed as a hint instead).
 */
export function planDrugMasterPatch(asset: QueuedAsset, dm: ClassificationDrugMasterInput, nowIso: string): AssetPatch | null {
  if (!dm.modality || !dm.target || dm.confidence < DRUG_MASTER_MIN_CONFIDENCE) return null;
  if (!(MODALITIES as string[]).includes(dm.modality)) return null;
  if (asset.therapeutic_area == null) return null;
  const item: ClassificationItem = {
    asset_id: asset.id,
    therapeutic_area: null,
    indication_category: null,
    indication_specific: null,
    modality: dm.modality,
    target: dm.target,
    target_class: null,
    moa_short: dm.mechanism ? dm.mechanism.slice(0, 80) : null,
    confidence: dm.confidence,
    evidence: 'drug_master',
    rationale: `drug_master ${dm.preferred_name} carries modality and target at confidence ${dm.confidence}`,
  };
  const patch = planAssetPatch(asset, item, 'drug_master', nowIso, dm);
  // target_class is unknown to drug_master; leave the column NULL rather than assert 'unknown'.
  delete patch.target_class;
  delete patch.classification_evidence.fields.target_class;
  return patch;
}

/** needs_review patch for a model item that failed schema validation or a batch that errored. */
export function planReviewPatch(
  asset: QueuedAsset,
  model: string,
  nowIso: string,
  reason: 'schema_violation' | 'model_error',
  suggestion: Record<string, unknown> | null,
  detail: string,
): AssetPatch {
  return {
    id: asset.id,
    company_name: asset.company_name,
    asset_name: asset.asset_name,
    classification_status: 'needs_review',
    classified_at: nowIso,
    classification_confidence: 0,
    classification_model: model,
    classification_evidence: {
      version: PROMPT_VERSION,
      model,
      decided_by: 'asset_name',
      rationale: detail.slice(0, 300),
      nct_ids: assetNcts(asset),
      fields: {},
      reason,
      ...(suggestion ? { suggestion } : {}),
    },
    updated_at: nowIso,
  };
}

// ═══════════════════════════════════════════════════════════════════════
// UPSERT (key-uniform)
// ═══════════════════════════════════════════════════════════════════════

/** Group patches so every row in a statement carries the same keys (PostgREST writes NULL for missing keys). */
export function groupBySignature(patches: AssetPatch[]): AssetPatch[][] {
  const bySig = new Map<string, AssetPatch[]>();
  for (const p of patches) {
    const sig = Object.keys(p).sort().join(',');
    if (!bySig.has(sig)) bySig.set(sig, []);
    bySig.get(sig)!.push(p);
  }
  const chunks: AssetPatch[][] = [];
  for (const group of bySig.values()) for (const c of chunk(group, UPSERT_CHUNK_SIZE)) chunks.push(c);
  return chunks;
}

/** Upsert by id in key-uniform chunks. Returns the patches that were written; failed chunks are reported in `errors`. */
export async function writePatches(supabase: SupabaseClient, patches: AssetPatch[], errors: string[]): Promise<{ written: AssetPatch[]; failed: number }> {
  const written: AssetPatch[] = [];
  let failed = 0;
  for (const rows of groupBySignature(patches)) {
    const { error } = await supabase.from('clinical_assets').upsert(rows, { onConflict: 'id' });
    if (error) {
      failed += rows.length;
      errors.push(`clinical_assets upsert failed (${rows.length} rows, keys ${Object.keys(rows[0]).length}): ${error.message}`);
      continue;
    }
    written.push(...rows);
  }
  return { written, failed };
}

// ═══════════════════════════════════════════════════════════════════════
// MODEL CALL
// ═══════════════════════════════════════════════════════════════════════

const SYSTEM_PROMPT = buildSystemPrompt();
const OUTPUT_SCHEMA = buildOutputJsonSchema();

export function buildRequestParams(model: string, inputs: ClassificationInput[]): Anthropic.MessageCreateParamsNonStreaming {
  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model,
    max_tokens: MAX_OUTPUT_TOKENS,
    system: [{ type: 'text', text: SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: buildUserMessage(inputs) }],
    output_config: { format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
    thinking: { type: 'disabled' },
  };
  if (supportsTemperature(model)) params.temperature = 0;
  return params;
}

function isRetryable(err: unknown): boolean {
  const e = err as { status?: number; error?: { type?: string }; message?: string };
  if (typeof e?.status === 'number') return e.status === 429 || e.status === 408 || e.status === 409 || e.status >= 500;
  if (e?.error?.type === 'overloaded_error') return true;
  return /overloaded|ECONNRESET|ETIMEDOUT|fetch failed/i.test(e?.message ?? '');
}

function retryAfterMs(err: unknown): number | null {
  const headers = (err as { headers?: Record<string, string> | { get?: (k: string) => string | null } })?.headers;
  if (!headers) return null;
  const raw = typeof (headers as { get?: unknown }).get === 'function'
    ? (headers as { get: (k: string) => string | null }).get('retry-after')
    : (headers as Record<string, string>)['retry-after'];
  const secs = raw ? Number(raw) : NaN;
  return Number.isFinite(secs) ? secs * 1000 : null;
}

export class RequestCapError extends Error {
  constructor(public readonly cap: number) {
    super(`model request cap reached (${cap})`);
  }
}

/** Shared per-run request counter so concurrent workers respect one cap. */
export class RequestBudget {
  requests = 0;
  retries = 0;
  constructor(public readonly maxRequests: number) {}
  tryAcquire(): boolean {
    if (this.requests >= this.maxRequests) return false;
    this.requests++;
    return true;
  }
}

export interface ModelBatchResult {
  items: Map<string, ClassificationItem>;
  /** Items that failed zod validation, keyed by asset_id when one could be read. */
  invalid: Map<string, { raw: Record<string, unknown>; issues: string }>;
  usage: TokenUsage;
  stopReason: string | null;
}

const LooseResponseSchema = z.object({ results: z.array(z.record(z.string(), z.unknown())) });

/** One model request with retries. Throws on non-retryable errors, exhausted retries, or the request cap. */
export async function classifyBatchWithModel(
  client: ClassifierClient,
  model: string,
  inputs: ClassificationInput[],
  budget: RequestBudget,
  sleep: (ms: number) => Promise<void> = ms => new Promise(r => setTimeout(r, ms)),
): Promise<ModelBatchResult> {
  const params = buildRequestParams(model, inputs);
  let lastErr: unknown = null;
  for (let attempt = 0; attempt < RETRY_MAX_ATTEMPTS; attempt++) {
    if (!budget.tryAcquire()) throw new RequestCapError(budget.maxRequests);
    if (attempt > 0) budget.retries++;
    try {
      const msg = await client.messages.create(params);
      const usage = emptyUsage();
      addUsage(usage, msg);
      const text = msg.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text ?? '';
      if (msg.stop_reason === 'max_tokens') throw Object.assign(new Error('response truncated at max_tokens'), { fatal: true });
      if (msg.stop_reason === 'refusal') throw Object.assign(new Error('model refused the batch'), { fatal: true });
      const parsed = LooseResponseSchema.safeParse(JSON.parse(text));
      if (!parsed.success) throw Object.assign(new Error(`response is not {results: [...]}: ${parsed.error.message.slice(0, 200)}`), { fatal: true });

      const items = new Map<string, ClassificationItem>();
      const invalid = new Map<string, { raw: Record<string, unknown>; issues: string }>();
      const wanted = new Set(inputs.map(i => i.asset_id));
      for (const raw of parsed.data.results) {
        const id = typeof raw.asset_id === 'string' ? raw.asset_id : null;
        if (!id || !wanted.has(id) || items.has(id) || invalid.has(id)) continue;
        const v = ClassificationItemSchema.safeParse(raw);
        if (v.success) items.set(id, v.data);
        else invalid.set(id, { raw, issues: v.error.issues.map(i => `${i.path.join('.')}: ${i.message}`).join('; ').slice(0, 400) });
      }
      return { items, invalid, usage, stopReason: msg.stop_reason };
    } catch (err) {
      lastErr = err;
      const fatal = (err as { fatal?: boolean })?.fatal || err instanceof SyntaxError;
      if (fatal || !isRetryable(err) || attempt === RETRY_MAX_ATTEMPTS - 1) throw err;
      const wait = retryAfterMs(err) ?? RETRY_BASE_MS * 2 ** attempt + Math.floor(Math.random() * 500);
      await sleep(Math.min(wait, 20_000));
    }
  }
  throw lastErr instanceof Error ? lastErr : new Error(String(lastErr));
}

// ═══════════════════════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════════════════════

function makeClient(): ClassifierClient {
  // maxRetries 0: this module owns retries so the request cap counts every attempt.
  return new Anthropic({ maxRetries: 0, timeout: 120_000 });
}

export async function classifyAssetsBatch(supabase: SupabaseClient, opts: ClassifyOptions = {}): Promise<ClassifyRunResult> {
  const now = opts.now ?? Date.now;
  const startedAt = now();
  const limit = opts.limit ?? DEFAULT_LIMIT;
  const timeBudgetMs = opts.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
  const model = opts.model ?? DEFAULT_MODEL;
  const batchSize = Math.max(1, Math.min(opts.batchSize ?? DEFAULT_BATCH_SIZE, 25));
  const concurrency = Math.max(1, opts.concurrency ?? DEFAULT_CONCURRENCY);
  const maxRequests = opts.maxRequests ?? Math.ceil(limit / batchSize) * 2;
  const dryRun = opts.dryRun ?? false;
  const errors: string[] = [];
  const usage = emptyUsage();
  const budget = new RequestBudget(maxRequests);

  const result: ClassifyRunResult = {
    model, fetched: 0, processed: 0, classified: 0, fromDrugMaster: 0, needsReview: 0, skipped: 0, failed: 0,
    requests: 0, retries: 0, tokens: usage, estimatedCostUsd: 0, cacheHitRate: 0, timedOut: false, requestCapHit: false,
    errors, logged: false, dryRun,
  };
  const samplePatches: AssetPatch[] = [];

  const finish = async (status: 'completed' | 'partial' | 'failed', notes?: string) => {
    result.requests = budget.requests;
    result.retries = budget.retries;
    result.estimatedCostUsd = estimateCostUsd(model, usage);
    const promptTokens = usage.input + usage.cacheRead + usage.cacheWrite;
    result.cacheHitRate = promptTokens > 0 ? Math.round((usage.cacheRead / promptTokens) * 1000) / 10 : 0;
    result.logged = await logRadarRun(supabase, {
      source: 'asset_universe',
      startedAt,
      status,
      runType: opts.runType ?? 'scheduled',
      fetched: result.fetched,
      processed: result.processed,
      updated: result.classified + result.fromDrugMaster,
      skipped: result.skipped,
      failed: result.failed,
      errors,
      notes,
      parameters: {
        stage: 'classify',
        model,
        prompt_version: PROMPT_VERSION,
        limit,
        batch_size: batchSize,
        concurrency,
        max_requests: maxRequests,
        dry_run: dryRun,
        counts: {
          classified: result.classified,
          from_drug_master: result.fromDrugMaster,
          needs_review: result.needsReview,
          skipped: result.skipped,
          failed: result.failed,
        },
        requests: result.requests,
        retries: result.retries,
        tokens: { ...usage },
        cache_hit_rate_pct: result.cacheHitRate,
        estimated_cost_usd: result.estimatedCostUsd,
        timed_out: result.timedOut,
        request_cap_hit: result.requestCapHit,
      },
    });
    if (dryRun) result.samplePatches = samplePatches.slice(0, 20);
    return result;
  };

  let queue: QueuedAsset[];
  try {
    queue = await fetchClassificationQueue(supabase, limit, opts.onlyStatuses, now);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return finish('failed', 'queue read failed');
  }
  result.fetched = queue.length;
  if (queue.length === 0) return finish('completed', 'queue empty');

  const nowIso = new Date(now()).toISOString();

  // ── Stage A: rule-based skips ─────────────────────────────────────────
  const toModel: QueuedAsset[] = [];
  const immediate: AssetPatch[] = [];
  for (const asset of queue) {
    const skip = preClassify(asset);
    if (skip) {
      immediate.push(planSkipPatch(asset, skip, nowIso));
      continue;
    }
    toModel.push(asset);
  }

  // ── Stage B: gather evidence, reuse drug_master where sufficient ───────
  let inputs: Map<string, ClassificationInput>;
  try {
    inputs = await gatherClassificationInputs(supabase, toModel);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    result.failed = toModel.length;
    return finish('failed', 'evidence gathering failed');
  }
  const modelQueue: QueuedAsset[] = [];
  for (const asset of toModel) {
    const input = inputs.get(asset.id)!;
    const dmPatch = input.drug_master ? planDrugMasterPatch(asset, input.drug_master, nowIso) : null;
    if (dmPatch) {
      immediate.push(dmPatch);
      continue;
    }
    modelQueue.push(asset);
  }

  const applyCounts = (patches: AssetPatch[]) => {
    for (const p of patches) {
      result.processed++;
      if (p.classification_status === 'skipped') result.skipped++;
      else if (p.classification_status === 'needs_review') result.needsReview++;
      else if (p.classification_model === 'drug_master') result.fromDrugMaster++;
      else result.classified++;
    }
  };
  const persist = async (patches: AssetPatch[]) => {
    if (patches.length === 0) return;
    if (dryRun) {
      samplePatches.push(...patches);
      applyCounts(patches);
      return;
    }
    const { written, failed } = await writePatches(supabase, patches, errors);
    // Rows in a failed upsert chunk keep their previous status and are retried next run.
    result.failed += failed;
    applyCounts(written);
  };

  await persist(immediate);

  // ── Stage C: model batches with a worker pool ─────────────────────────
  const client = opts.client ?? makeClient();
  const sleep = opts.sleep;
  const batches = chunk(modelQueue, batchSize);
  let cursor = 0;

  const worker = async () => {
    for (;;) {
      if (now() - startedAt > timeBudgetMs) {
        result.timedOut = true;
        return;
      }
      if (result.requestCapHit) return;
      const index = cursor++;
      if (index >= batches.length) return;
      const batch = batches[index];
      const batchInputs = batch.map(a => inputs.get(a.id)!);
      let outcome: ModelBatchResult;
      try {
        outcome = await classifyBatchWithModel(client, model, batchInputs, budget, sleep);
      } catch (err) {
        if (err instanceof RequestCapError) {
          result.requestCapHit = true;
          errors.push(`${err.message}; ${batches.length - index} batch(es) left for the next run`);
          return;
        }
        const message = err instanceof Error ? err.message : String(err);
        errors.push(`batch ${index + 1}/${batches.length} (${batch.length} assets) failed: ${message}`);
        // Leave the rows at their previous status so the next run retries them.
        result.failed += batch.length;
        continue;
      }
      mergeUsage(usage, outcome.usage);

      const patches: AssetPatch[] = [];
      for (const asset of batch) {
        const item = outcome.items.get(asset.id);
        if (item) {
          patches.push(planAssetPatch(asset, item, model, nowIso, inputs.get(asset.id)?.drug_master ?? null));
          continue;
        }
        const bad = outcome.invalid.get(asset.id);
        if (bad) {
          patches.push(planReviewPatch(asset, model, nowIso, 'schema_violation', bad.raw, bad.issues));
          continue;
        }
        // Model dropped the asset from its answer: leave it for the next run.
        result.failed++;
        errors.push(`model returned no result for asset ${asset.id} (${asset.asset_name})`);
      }
      await persist(patches);
    }
  };

  await Promise.all(Array.from({ length: Math.min(concurrency, batches.length) }, () => worker()));

  const status = deriveRunStatus({
    errors: errors.length,
    timedOut: result.timedOut || result.requestCapHit,
    processed: result.fetched,
    produced: result.processed,
  });
  return finish(status);
}

// ═══════════════════════════════════════════════════════════════════════
// SAMPLE VALIDATION (Opus re-run, no writes)
// ═══════════════════════════════════════════════════════════════════════

export interface ValidateOptions {
  sample?: number;
  model?: string;
  batchSize?: number;
  maxRequests?: number;
  timeBudgetMs?: number;
  client?: ClassifierClient;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
  /** Deterministic sampling offset for tests; default random. */
  offset?: number;
}

export interface FieldAgreement {
  compared: number;
  agree: number;
  agreement_pct: number;
  /** Both models returned null. Counted as agreement. */
  both_null: number;
  /** Validator returned a value where the bulk model returned null. */
  validator_only: number;
  /** Bulk model returned a value where the validator returned null. */
  bulk_only: number;
}

export interface ValidationReport {
  validator_model: string;
  bulk_models: Record<string, number>;
  sampled: number;
  compared: number;
  fields: Record<string, FieldAgreement>;
  confidence: { mean_abs_diff: number; validator_below_60_where_bulk_wrote: number };
  disagreements: { asset_id: string; asset_name: string; field: string; bulk: string | null; validator: string | null; validator_confidence: number }[];
  requests: number;
  tokens: TokenUsage;
  estimated_cost_usd: number;
  errors: string[];
  logged: boolean;
}

const COMPARE_FIELDS = ['therapeutic_area', 'indication_category', 'modality', 'target', 'target_class'] as const;

function bulkValue(asset: QueuedAsset, field: (typeof COMPARE_FIELDS)[number]): string | null {
  const ev = asset.classification_evidence as Partial<ClassificationEvidence> | null;
  const fromEvidence = ev?.fields?.[field]?.value;
  if (fromEvidence !== undefined) return fromEvidence;
  return (asset as unknown as Record<string, string | null>)[field] ?? null;
}

function sameValue(field: string, a: string | null, b: string | null): boolean {
  if (a == null || b == null) return a == null && b == null;
  if (field === 'target') return normalizeKey(a) === normalizeKey(b);
  return a.trim().toLowerCase() === b.trim().toLowerCase();
}

export async function validateClassificationSample(supabase: SupabaseClient, opts: ValidateOptions = {}): Promise<ValidationReport> {
  const now = opts.now ?? Date.now;
  const startedAt = now();
  const sample = Math.max(1, Math.min(opts.sample ?? 200, 1000));
  const model = opts.model ?? VALIDATION_MODEL;
  const batchSize = Math.max(1, Math.min(opts.batchSize ?? 10, 25));
  const budget = new RequestBudget(opts.maxRequests ?? Math.ceil(sample / batchSize) * 2);
  const timeBudgetMs = opts.timeBudgetMs ?? DEFAULT_TIME_BUDGET_MS;
  const usage = emptyUsage();
  const errors: string[] = [];
  const report: ValidationReport = {
    validator_model: model, bulk_models: {}, sampled: 0, compared: 0, fields: {},
    confidence: { mean_abs_diff: 0, validator_below_60_where_bulk_wrote: 0 },
    disagreements: [], requests: 0, tokens: usage, estimated_cost_usd: 0, errors, logged: false,
  };
  for (const f of COMPARE_FIELDS) report.fields[f] = { compared: 0, agree: 0, agreement_pct: 0, both_null: 0, validator_only: 0, bulk_only: 0 };

  const log = async (status: 'completed' | 'partial' | 'failed') => {
    report.requests = budget.requests;
    report.estimated_cost_usd = estimateCostUsd(model, usage);
    report.logged = await logRadarRun(supabase, {
      source: 'asset_universe',
      startedAt,
      status,
      runType: 'manual',
      fetched: report.sampled,
      processed: report.compared,
      errors,
      parameters: {
        stage: 'classify_validate',
        validator_model: model,
        bulk_models: report.bulk_models,
        sampled: report.sampled,
        compared: report.compared,
        fields: report.fields,
        confidence: report.confidence,
        disagreements: report.disagreements.slice(0, 50),
        requests: report.requests,
        tokens: { ...usage },
        estimated_cost_usd: report.estimated_cost_usd,
      },
    });
    return report;
  };

  // Random window over model-classified rows (drug_master reuse is excluded: nothing to validate).
  const { count, error: countErr } = await supabase
    .from('clinical_assets')
    .select('id', { count: 'exact', head: true })
    .eq('classification_status', 'classified')
    .neq('classification_model', 'drug_master');
  if (countErr) {
    errors.push(`count failed: ${countErr.message}`);
    return log('failed');
  }
  const total = count ?? 0;
  if (total === 0) {
    errors.push('no model-classified assets to validate');
    return log('failed');
  }
  const offset = opts.offset ?? Math.floor(Math.random() * Math.max(1, total - sample));
  const { data, error } = await supabase
    .from('clinical_assets')
    .select(`${QUEUE_COLUMNS}, ${COMPANY_EMBED}(owner_type)`)
    .eq('classification_status', 'classified')
    .neq('classification_model', 'drug_master')
    .order('id', { ascending: true })
    .range(offset, offset + sample - 1);
  if (error) {
    errors.push(`sample read failed: ${error.message}`);
    return log('failed');
  }
  const assets = asRows(data).map(toQueued);
  report.sampled = assets.length;
  for (const a of assets) {
    const m = a.classification_model ?? 'unknown';
    report.bulk_models[m] = (report.bulk_models[m] ?? 0) + 1;
  }

  let inputs: Map<string, ClassificationInput>;
  try {
    inputs = await gatherClassificationInputs(supabase, assets);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return log('failed');
  }

  const client = opts.client ?? makeClient();
  let absDiffSum = 0;
  for (const batch of chunk(assets, batchSize)) {
    if (now() - startedAt > timeBudgetMs) {
      errors.push('time budget exhausted before the sample was fully validated');
      break;
    }
    let outcome: ModelBatchResult;
    try {
      outcome = await classifyBatchWithModel(client, model, batch.map(a => inputs.get(a.id)!), budget, opts.sleep);
    } catch (err) {
      errors.push(`validator batch failed: ${err instanceof Error ? err.message : String(err)}`);
      if (err instanceof RequestCapError) break;
      continue;
    }
    mergeUsage(usage, outcome.usage);
    for (const asset of batch) {
      const v = outcome.items.get(asset.id);
      if (!v) continue;
      report.compared++;
      const bulkConf = asset.classification_confidence ?? 0;
      absDiffSum += Math.abs(bulkConf - v.confidence);
      if (v.confidence < CONFIDENCE_WRITE_MIN && bulkConf >= CONFIDENCE_WRITE_MIN) report.confidence.validator_below_60_where_bulk_wrote++;
      for (const f of COMPARE_FIELDS) {
        const b = bulkValue(asset, f);
        const c = v[f] ?? null;
        const agg = report.fields[f];
        agg.compared++;
        if (b == null && c == null) { agg.both_null++; agg.agree++; continue; }
        if (b == null) agg.validator_only++;
        else if (c == null) agg.bulk_only++;
        if (sameValue(f, b, c)) agg.agree++;
        else if (report.disagreements.length < 200) {
          report.disagreements.push({ asset_id: asset.id, asset_name: asset.asset_name, field: f, bulk: b, validator: c, validator_confidence: v.confidence });
        }
      }
    }
  }
  for (const f of COMPARE_FIELDS) {
    const agg = report.fields[f];
    agg.agreement_pct = agg.compared > 0 ? Math.round((agg.agree / agg.compared) * 1000) / 10 : 0;
  }
  report.confidence.mean_abs_diff = report.compared > 0 ? Math.round((absDiffSum / report.compared) * 10) / 10 : 0;

  return log(errors.length > 0 || report.compared < report.sampled ? 'partial' : 'completed');
}

// Re-exported for the route and tests.
export { INDICATION_CATEGORIES, THERAPEUTIC_AREAS, MODALITIES };
