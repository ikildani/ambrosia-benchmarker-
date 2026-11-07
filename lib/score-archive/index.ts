/**
 * Score archive — append-only, time-stamped copy of every score and
 * prediction (migration 139, table `score_archive`).
 *
 *   buildArchiveRow   — validates one entry and turns it into an insert row;
 *                       confidential inputs are replaced by their sha256.
 *   archiveScores     — inserts entries in chunks; never throws.
 *   sealScoreArchive  — seals finished UTC days into chained digests.
 *
 * API routes use archiveAfterResponse (./after-response) so archiving runs
 * after the response is sent. This module stays free of Next.js request
 * APIs so crons, Radar libraries and scripts can import it.
 *
 * recorded_at and row_sha256 are set by the database; the table rejects
 * UPDATE, DELETE and TRUNCATE. Ledger rows (predictions / outcomes) are
 * copied by database triggers, so writers here cover everything else.
 *
 * Confidential rule: anything a client entered in confidence (their asset,
 * their company, their deal inputs) goes in with `confidential: true`. The
 * row then keeps inputs_sha256 plus coarse profile fields only, because
 * nothing in this table can ever be deleted.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

export const SCORE_ARCHIVE_PRODUCTS = ['solidus', 'terrain', 'augur', 'ip_map', 'alaric'] as const;
export type ScoreArchiveProduct = (typeof SCORE_ARCHIVE_PRODUCTS)[number];

export const SCORE_ARCHIVE_ORIGINS = ['platform', 'user', 'api', 'client'] as const;
export type ScoreArchiveOrigin = (typeof SCORE_ARCHIVE_ORIGINS)[number];

export const SCORE_ARCHIVE_ENTITY_TYPES = [
  'asset', 'company', 'deal', 'indication', 'portfolio', 'profile', 'patent', 'prediction',
] as const;
export type ScoreArchiveEntityType = (typeof SCORE_ARCHIVE_ENTITY_TYPES)[number];

const SCORE_TYPE_RE = /^[a-z0-9][a-z0-9_.:-]{0,63}$/;
const INDUSTRY_RE = /^[a-z0-9_]{1,40}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
const CHUNK = 500;
/** Per-row cap on inputs + output JSON; larger payloads are refused, not truncated. */
const MAX_ROW_JSON_BYTES = 64 * 1024;

export interface ScoreArchiveEntry {
  product: ScoreArchiveProduct;
  /** Dotted: radar.licensing_intent, calculator.deal_terms, terrain.demand … */
  scoreType: string;
  modelVersion: string;
  origin: ScoreArchiveOrigin;
  entityType: ScoreArchiveEntityType;
  entityId?: string | null;
  entityLabel?: string | null;
  industry?: string;
  therapeuticArea?: string | null;
  phase?: string | null;
  modality?: string | null;
  indication?: string | null;
  sourceTable?: string | null;
  sourceId?: string | null;
  predictionId?: string | null;
  inputs?: unknown;
  /** Keep only the sha256 of `inputs` and drop entityLabel (client data). */
  confidential?: boolean;
  /** Caller-computed sha256 of inputs it does not want to send at all. */
  inputsSha256?: string | null;
  output: unknown;
  dataAsOf?: string | null;
  /** YYYY-MM-DD by which the prediction can be judged. */
  horizonEnd?: string | null;
}

export interface ScoreArchiveInsert {
  product: ScoreArchiveProduct;
  score_type: string;
  model_version: string;
  industry: string;
  origin: ScoreArchiveOrigin;
  entity_type: ScoreArchiveEntityType;
  entity_id: string | null;
  entity_label: string | null;
  therapeutic_area: string | null;
  phase: string | null;
  modality: string | null;
  indication: string | null;
  source_table: string | null;
  source_id: string | null;
  prediction_id: string | null;
  inputs: unknown | null;
  inputs_sha256: string | null;
  output: unknown;
  data_as_of: string | null;
  horizon_end: string | null;
}

export type BuildResult = { ok: true; row: ScoreArchiveInsert } | { ok: false; error: string };

export interface ArchiveResult {
  inserted: number;
  rejected: number;
  errors: string[];
}

/** JSON with object keys sorted at every level, so equal inputs hash equally. */
export function stableStringify(value: unknown): string {
  if (value === undefined) return 'null';
  if (value === null || typeof value !== 'object') {
    if (typeof value === 'number' && !Number.isFinite(value)) return 'null';
    return JSON.stringify(value) ?? 'null';
  }
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).filter((k) => obj[k] !== undefined).sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${stableStringify(obj[k])}`).join(',')}}`;
}

export function sha256Hex(text: string): string {
  return createHash('sha256').update(text, 'utf8').digest('hex');
}

/** sha256 of the stable JSON of `value` — the inputs_sha256 of a confidential row. */
export function hashInputs(value: unknown): string {
  return sha256Hex(stableStringify(value ?? null));
}

function str(v: string | null | undefined, max = 300): string | null {
  if (typeof v !== 'string') return null;
  const t = v.trim();
  return t ? t.slice(0, max) : null;
}

/** Plain JSON copy (drops undefined, functions, non-finite numbers). */
function toJson(v: unknown): unknown {
  if (v === undefined) return null;
  return JSON.parse(stableStringify(v));
}

export function buildArchiveRow(e: ScoreArchiveEntry): BuildResult {
  if (!SCORE_ARCHIVE_PRODUCTS.includes(e.product)) return { ok: false, error: `unknown product ${String(e.product)}` };
  if (!SCORE_ARCHIVE_ORIGINS.includes(e.origin)) return { ok: false, error: `unknown origin ${String(e.origin)}` };
  if (!SCORE_ARCHIVE_ENTITY_TYPES.includes(e.entityType)) return { ok: false, error: `unknown entity type ${String(e.entityType)}` };
  if (typeof e.scoreType !== 'string' || !SCORE_TYPE_RE.test(e.scoreType)) return { ok: false, error: `bad score type ${String(e.scoreType)}` };
  const modelVersion = str(e.modelVersion, 100);
  if (!modelVersion) return { ok: false, error: 'model version required' };
  const industry = e.industry ?? 'life_sciences';
  if (!INDUSTRY_RE.test(industry)) return { ok: false, error: `bad industry ${industry}` };
  if (e.output === undefined || e.output === null) return { ok: false, error: 'output required' };
  if (e.horizonEnd && !/^\d{4}-\d{2}-\d{2}$/.test(e.horizonEnd)) return { ok: false, error: 'horizonEnd must be YYYY-MM-DD' };

  let inputs: unknown | null = null;
  let inputsSha: string | null = null;
  if (e.confidential || e.inputs === undefined) {
    const presented = e.inputsSha256?.trim().toLowerCase();
    if (presented && !SHA256_RE.test(presented)) return { ok: false, error: 'inputsSha256 must be 64 hex chars' };
    inputsSha = presented || hashInputs(e.inputs ?? null);
  } else {
    inputs = toJson(e.inputs);
  }
  const output = toJson(e.output);

  const bytes = Buffer.byteLength(stableStringify(inputs), 'utf8') + Buffer.byteLength(stableStringify(output), 'utf8');
  if (bytes > MAX_ROW_JSON_BYTES) return { ok: false, error: `row JSON ${bytes} bytes exceeds ${MAX_ROW_JSON_BYTES}` };

  return {
    ok: true,
    row: {
      product: e.product,
      score_type: e.scoreType,
      model_version: modelVersion,
      industry,
      origin: e.origin,
      entity_type: e.entityType,
      entity_id: str(e.entityId, 200),
      entity_label: e.confidential ? null : str(e.entityLabel),
      therapeutic_area: str(e.therapeuticArea, 100),
      phase: str(e.phase, 50),
      modality: str(e.modality, 100),
      indication: str(e.indication),
      source_table: str(e.sourceTable, 100),
      source_id: str(e.sourceId, 200),
      prediction_id: str(e.predictionId, 36),
      inputs,
      inputs_sha256: inputsSha,
      output,
      data_as_of: str(e.dataAsOf, 100),
      horizon_end: e.horizonEnd ?? null,
    },
  };
}

/** Inserts every valid entry; invalid ones are counted and logged. Never throws. */
export async function archiveScores(supabase: SupabaseClient, entries: ScoreArchiveEntry[]): Promise<ArchiveResult> {
  const result: ArchiveResult = { inserted: 0, rejected: 0, errors: [] };
  const rows: ScoreArchiveInsert[] = [];
  for (const e of entries) {
    const built = buildArchiveRow(e);
    if (built.ok) rows.push(built.row);
    else {
      result.rejected++;
      if (result.errors.length < 5) result.errors.push(built.error);
    }
  }
  for (let i = 0; i < rows.length; i += CHUNK) {
    const chunk = rows.slice(i, i + CHUNK);
    try {
      const { error } = await supabase.from('score_archive').insert(chunk);
      if (error) {
        result.rejected += chunk.length;
        if (result.errors.length < 5) result.errors.push(error.message);
      } else {
        result.inserted += chunk.length;
      }
    } catch (err) {
      result.rejected += chunk.length;
      if (result.errors.length < 5) result.errors.push(err instanceof Error ? err.message : String(err));
    }
  }
  if (result.rejected > 0) {
    console.warn(`[ScoreArchive] ${result.rejected} of ${entries.length} not archived: ${result.errors.join('; ')}`);
  }
  return result;
}

// ─── Sealing (called from the nightly outcome phase) ────────────────────────

export interface SealedDay {
  day: string;
  row_count: number;
  chain_sha256: string;
}

/** Seals every finished UTC day into score_archive_digests. Never throws. */
export async function sealScoreArchive(supabase: SupabaseClient): Promise<{ sealed: SealedDay[]; error?: string }> {
  try {
    const { data, error } = await supabase.rpc('seal_score_archive_days');
    if (error) return { sealed: [], error: error.message };
    const sealed = (data ?? []) as SealedDay[];
    for (const d of sealed) {
      // Logged so the chain head also exists outside the database (Vercel logs).
      console.log(`[ScoreArchive] sealed ${d.day}: ${d.row_count} rows, chain ${d.chain_sha256}`);
    }
    return { sealed };
  } catch (err) {
    return { sealed: [], error: err instanceof Error ? err.message : String(err) };
  }
}
