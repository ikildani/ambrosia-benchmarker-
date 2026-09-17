/**
 * Asset Radar QA — the 200-asset golden set.
 *
 *   selectGoldenSet        stratified, deterministic sample (md5(id || seed))
 *                          over owner group × phase bucket × region with
 *                          quotas; freezes a snapshot per asset into
 *                          radar_qa_golden_assets.
 *   runGoldenAgreement     re-derives therapeutic_area / modality / target /
 *                          indication_specific / moa_short with claude-opus-4-6
 *                          through the same request path as the classifier
 *                          (lib/radar/classify.ts) and, independently, asks
 *                          the model whether the asset looks partnered given
 *                          the trials / deals / press rows we hold. Reports
 *                          per-field agreement and Cohen's kappa; never writes
 *                          to clinical_assets.
 *   exportHumanReviewSheet XLSX for a BD analyst (one row per asset × field).
 *   importHumanReviews     loads the filled sheet into radar_qa_human_reviews
 *                          and writes a golden_human run.
 */

import type Anthropic from '@anthropic-ai/sdk';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { z } from 'zod';
import {
  RequestBudget,
  RequestCapError,
  VALIDATION_MODEL,
  classifyBatchWithModel,
  emptyUsage,
  estimateCostUsd,
  gatherClassificationInputs,
  mergeUsage,
  supportsTemperature,
  type ClassifierClient,
  type QueuedAsset,
  type TokenUsage,
} from '@/lib/radar/classify';
import type { ClassificationItem } from '@/lib/radar/classify-prompt';
import { normalizeKey } from '@/lib/radar/drug-name';
import { pgArrayLiteral } from '@/lib/radar/pg-array';
import type { OwnerType } from '@/lib/radar/types';
import { radarLabel } from '@/lib/radar/vocab';

// ═══════════════════════════════════════════════════════════════════════
// STRATIFICATION
// ═══════════════════════════════════════════════════════════════════════

export type OwnerGroup = 'industry' | 'academic_hospital';
export type PhaseBucket = 'p1' | 'p2' | 'p3';
export type RegionBucket = 'north_america' | 'europe' | 'east_asia' | 'other';

export const OWNER_GROUPS: OwnerGroup[] = ['industry', 'academic_hospital'];
export const PHASE_BUCKETS: PhaseBucket[] = ['p1', 'p2', 'p3'];
export const REGION_BUCKETS: RegionBucket[] = ['north_america', 'europe', 'east_asia', 'other'];

/** Quota weights. Owner 70/30 per the launch spec; phase equal thirds; region by expected universe share. */
export const OWNER_WEIGHTS: Record<OwnerGroup, number> = { industry: 0.7, academic_hospital: 0.3 };
export const PHASE_WEIGHTS: Record<PhaseBucket, number> = { p1: 1 / 3, p2: 1 / 3, p3: 1 / 3 };
export const REGION_WEIGHTS: Record<RegionBucket, number> = { north_america: 0.4, europe: 0.3, east_asia: 0.2, other: 0.1 };

export const DEFAULT_GOLDEN_SIZE = 200;
export const DEFAULT_GOLDEN_SEED = 'radar-launch-2026';

export interface GoldenCandidate {
  asset_id: string;
  owner_group: OwnerGroup;
  phase_bucket: PhaseBucket;
  region_bucket: RegionBucket;
  /** md5(asset_id || seed); computed here when absent. */
  hash?: string;
}

export interface GoldenSelection extends GoldenCandidate {
  stratum: string;
  hash: string;
}

export function stratumKey(c: Pick<GoldenCandidate, 'owner_group' | 'phase_bucket' | 'region_bucket'>): string {
  return `${c.owner_group}|${c.phase_bucket}|${c.region_bucket}`;
}

export function goldenHash(assetId: string, seed: string): string {
  return createHash('md5').update(`${assetId}${seed}`).digest('hex');
}

/**
 * Integer quotas per stratum summing exactly to `size` (largest remainder).
 * Deterministic: ties broken by stratum key order.
 */
export function goldenQuotas(size: number): Record<string, number> {
  const raw: { key: string; exact: number }[] = [];
  for (const o of OWNER_GROUPS) for (const p of PHASE_BUCKETS) for (const r of REGION_BUCKETS) {
    raw.push({ key: stratumKey({ owner_group: o, phase_bucket: p, region_bucket: r }), exact: size * OWNER_WEIGHTS[o] * PHASE_WEIGHTS[p] * REGION_WEIGHTS[r] });
  }
  const quotas: Record<string, number> = {};
  let assigned = 0;
  for (const r of raw) { quotas[r.key] = Math.floor(r.exact); assigned += quotas[r.key]; }
  const remainders = raw
    .map(r => ({ key: r.key, rem: r.exact - Math.floor(r.exact) }))
    .sort((a, b) => b.rem - a.rem || a.key.localeCompare(b.key));
  for (let i = 0; assigned < size && i < remainders.length; i++) { quotas[remainders[i].key]++; assigned++; }
  return quotas;
}

/**
 * Pure stratified sampler. Within a stratum the lowest hashes win; when a
 * stratum cannot fill its quota the shortfall is redistributed, round-robin,
 * to the other strata of the same owner group that still have candidates
 * (so the 70/30 owner split holds as long as the pool allows).
 */
export function selectGoldenSample(
  candidates: GoldenCandidate[],
  opts: { size?: number; seed?: string } = {},
): { selected: GoldenSelection[]; quotas: Record<string, number>; filled: Record<string, number>; shortfall: number } {
  const size = opts.size ?? DEFAULT_GOLDEN_SIZE;
  const seed = opts.seed ?? DEFAULT_GOLDEN_SEED;
  const quotas = goldenQuotas(size);

  const byStratum = new Map<string, GoldenSelection[]>();
  const seen = new Set<string>();
  for (const c of candidates) {
    if (seen.has(c.asset_id)) continue;
    seen.add(c.asset_id);
    const key = stratumKey(c);
    if (!(key in quotas)) continue;
    const row: GoldenSelection = { ...c, stratum: key, hash: c.hash ?? goldenHash(c.asset_id, seed) };
    if (!byStratum.has(key)) byStratum.set(key, []);
    byStratum.get(key)!.push(row);
  }
  for (const rows of byStratum.values()) rows.sort((a, b) => a.hash.localeCompare(b.hash) || a.asset_id.localeCompare(b.asset_id));

  const filled: Record<string, number> = {};
  const selected: GoldenSelection[] = [];
  const cursor = new Map<string, number>();
  const take = (key: string): boolean => {
    const rows = byStratum.get(key) ?? [];
    const i = cursor.get(key) ?? 0;
    if (i >= rows.length) return false;
    selected.push(rows[i]);
    cursor.set(key, i + 1);
    filled[key] = (filled[key] ?? 0) + 1;
    return true;
  };

  // Pass 1: quotas.
  let deficit: Record<OwnerGroup, number> = { industry: 0, academic_hospital: 0 };
  for (const key of Object.keys(quotas).sort()) {
    filled[key] = 0;
    for (let k = 0; k < quotas[key]; k++) {
      if (!take(key)) { deficit[key.split('|')[0] as OwnerGroup] += quotas[key] - k; break; }
    }
  }

  // Pass 2: redistribute within owner group, round-robin over strata with spare candidates.
  for (const owner of OWNER_GROUPS) {
    const keys = Object.keys(quotas).filter(k => k.startsWith(`${owner}|`)).sort();
    let progress = true;
    while (deficit[owner] > 0 && progress) {
      progress = false;
      for (const key of keys) {
        if (deficit[owner] === 0) break;
        if (take(key)) { deficit[owner]--; progress = true; }
      }
    }
  }
  // Pass 3: cross-owner spill so the set reaches `size` when one group is thin.
  const totalDeficit = deficit.industry + deficit.academic_hospital;
  if (totalDeficit > 0) {
    let remaining = totalDeficit;
    let progress = true;
    const keys = Object.keys(quotas).sort();
    while (remaining > 0 && progress) {
      progress = false;
      for (const key of keys) {
        if (remaining === 0) break;
        if (take(key)) { remaining--; progress = true; }
      }
    }
    deficit = { industry: 0, academic_hospital: remaining };
  }

  return { selected, quotas, filled, shortfall: size - selected.length };
}

// ═══════════════════════════════════════════════════════════════════════
// SELECT + FREEZE
// ═══════════════════════════════════════════════════════════════════════

const PAGE_SIZE = 1000;
const IN_CHUNK = 100;

function chunk<T>(arr: T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
}

type PageResult<T> = PromiseLike<{ data: T[] | null; error: { message: string } | null }>;

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

export interface FactorContributionLite {
  factor: string;
  points: number;
  score: number;
  weight: number;
  confidence: number;
  evidence_text: string | null;
  evidence_url: string | null;
}

/** Top 9 contributions by |points|, intercept excluded. */
export function topFactors(factorScores: unknown, limit = 9): FactorContributionLite[] {
  if (!Array.isArray(factorScores)) return [];
  return (factorScores as Record<string, unknown>[])
    .filter(f => f && typeof f === 'object' && f.factor !== 'intercept')
    .map(f => ({
      factor: String(f.factor ?? ''),
      points: Number(f.points ?? 0),
      score: Number(f.score ?? 0),
      weight: Number(f.weight ?? 0),
      confidence: Number(f.confidence ?? 0),
      evidence_text: (f.evidence_text as string | null) ?? null,
      evidence_url: (f.evidence_url as string | null) ?? null,
    }))
    .sort((a, b) => Math.abs(b.points) - Math.abs(a.points) || a.factor.localeCompare(b.factor))
    .slice(0, limit);
}

export interface SelectGoldenSetOptions {
  size?: number;
  seed?: string;
  /** Candidates fetched per stratum from the RPC (default 80). */
  perStratum?: number;
  /** Remove golden rows that are not in the new selection (default true). */
  replace?: boolean;
  now?: () => number;
}

export interface SelectGoldenSetResult {
  seed: string;
  size: number;
  selected: number;
  shortfall: number;
  quotas: Record<string, number>;
  filled: Record<string, number>;
  removed: number;
  errors: string[];
}

export async function selectGoldenSet(supabase: SupabaseClient, opts: SelectGoldenSetOptions = {}): Promise<SelectGoldenSetResult> {
  const size = opts.size ?? DEFAULT_GOLDEN_SIZE;
  const seed = opts.seed ?? DEFAULT_GOLDEN_SEED;
  const now = opts.now ?? Date.now;
  const nowIso = new Date(now()).toISOString();
  const errors: string[] = [];

  const { data: candRaw, error: candErr } = await supabase.rpc('radar_qa_golden_candidates', { p_seed: seed, p_per_stratum: opts.perStratum ?? 80 });
  if (candErr) throw new Error(`radar_qa_golden_candidates failed: ${candErr.message}`);
  const candidates = ((candRaw ?? []) as GoldenCandidate[]).map(c => ({ ...c, hash: c.hash ?? goldenHash(c.asset_id, seed) }));
  const { selected, quotas, filled, shortfall } = selectGoldenSample(candidates, { size, seed });
  if (selected.length === 0) throw new Error('golden set: no candidates (assets need trial_count >= 1 and a company with owner_type)');

  const ids = selected.map(s => s.asset_id);
  const assets = new Map<string, Record<string, unknown>>();
  const theses = new Map<string, Record<string, unknown>>();
  const snapshots = new Map<string, FactorContributionLite[]>();
  const drugs = new Map<string, Record<string, unknown>>();

  for (const part of chunk(ids, IN_CHUNK)) {
    const a = await supabase.from('clinical_assets').select('*').in('id', part).range(0, PAGE_SIZE - 1);
    if (a.error) { errors.push(`clinical_assets read: ${a.error.message}`); continue; }
    for (const row of (a.data ?? []) as Record<string, unknown>[]) assets.set(String(row.id), row);

    const t = await supabase.from('radar_deal_theses').select('*').in('asset_id', part).range(0, PAGE_SIZE - 1);
    if (t.error) errors.push(`radar_deal_theses read: ${t.error.message}`);
    else for (const row of (t.data ?? []) as Record<string, unknown>[]) theses.set(String(row.asset_id), row);

    const s = await supabase
      .from('asset_signal_snapshots')
      .select('asset_id, snapshot_date, factor_scores, licensing_intent_score, model_version')
      .in('asset_id', part)
      .order('snapshot_date', { ascending: false })
      .range(0, PAGE_SIZE - 1);
    if (s.error) errors.push(`asset_signal_snapshots read: ${s.error.message}`);
    else for (const row of (s.data ?? []) as Record<string, unknown>[]) {
      const id = String(row.asset_id);
      if (!snapshots.has(id)) snapshots.set(id, topFactors(row.factor_scores));
    }
  }
  const drugIds = [...new Set([...assets.values()].map(a => a.drug_master_id).filter((v): v is string => typeof v === 'string'))];
  for (const part of chunk(drugIds, IN_CHUNK)) {
    const d = await supabase.from('drug_master').select('*').in('id', part).range(0, PAGE_SIZE - 1);
    if (d.error) errors.push(`drug_master read: ${d.error.message}`);
    else for (const row of (d.data ?? []) as Record<string, unknown>[]) drugs.set(String(row.id), row);
  }

  const rows = selected
    .filter(s => assets.has(s.asset_id))
    .map(s => {
      const asset = assets.get(s.asset_id)!;
      return {
        asset_id: s.asset_id,
        stratum: s.stratum,
        seed,
        selected_at: nowIso,
        frozen_snapshot: {
          frozen_at: nowIso,
          asset,
          thesis: theses.get(s.asset_id) ?? null,
          top_factors: snapshots.get(s.asset_id) ?? [],
          drug_master: typeof asset.drug_master_id === 'string' ? drugs.get(asset.drug_master_id) ?? null : null,
          partnership_evidence: asset.partnership_evidence ?? [],
        },
      };
    });

  for (const part of chunk(rows, IN_CHUNK)) {
    const { error } = await supabase.from('radar_qa_golden_assets').upsert(part, { onConflict: 'asset_id' });
    if (error) errors.push(`radar_qa_golden_assets upsert: ${error.message}`);
  }

  let removed = 0;
  if (opts.replace !== false) {
    const { data: existing, error: exErr } = await supabase.from('radar_qa_golden_assets').select('asset_id').range(0, PAGE_SIZE - 1);
    if (exErr) errors.push(`radar_qa_golden_assets read: ${exErr.message}`);
    else {
      const keep = new Set(rows.map(r => r.asset_id));
      const stale = ((existing ?? []) as { asset_id: string }[]).map(r => r.asset_id).filter(id => !keep.has(id));
      for (const part of chunk(stale, IN_CHUNK)) {
        const { error } = await supabase.from('radar_qa_golden_assets').delete().in('asset_id', part);
        if (error) errors.push(`radar_qa_golden_assets delete: ${error.message}`);
        else removed += part.length;
      }
    }
  }

  return { seed, size, selected: rows.length, shortfall: shortfall + (selected.length - rows.length), quotas, filled, removed, errors };
}

// ═══════════════════════════════════════════════════════════════════════
// AGREEMENT MATH (pure)
// ═══════════════════════════════════════════════════════════════════════

export interface FieldAgreementStats {
  compared: number;
  agree: number;
  agreement_pct: number;
  /** Cohen's kappa; null for free-text fields or when undefined (single category). */
  kappa: number | null;
  both_null: number;
  model_only: number;
  stored_only: number;
}

const NULL_TOKEN = '∅';

/** Multi-class Cohen's kappa over (a, b) pairs. Nulls are their own category. */
export function cohensKappa(pairs: [string | null, string | null][]): number | null {
  const N = pairs.length;
  if (N === 0) return null;
  const cats = new Set<string>();
  const rowTotals = new Map<string, number>();
  const colTotals = new Map<string, number>();
  let agree = 0;
  for (const [a0, b0] of pairs) {
    const a = a0 ?? NULL_TOKEN;
    const b = b0 ?? NULL_TOKEN;
    cats.add(a); cats.add(b);
    rowTotals.set(a, (rowTotals.get(a) ?? 0) + 1);
    colTotals.set(b, (colTotals.get(b) ?? 0) + 1);
    if (a === b) agree++;
  }
  const po = agree / N;
  let pe = 0;
  for (const c of cats) pe += ((rowTotals.get(c) ?? 0) / N) * ((colTotals.get(c) ?? 0) / N);
  if (pe >= 1) return null;
  return Math.round(((po - pe) / (1 - pe)) * 1000) / 1000;
}

const TEXT_STOPWORDS = new Set(['the', 'a', 'an', 'of', 'and', 'or', 'with', 'in', 'for', 'to', 'by', 'on', 'at', 'disease', 'disorder', 'patients', 'adult', 'adults']);

export function textTokens(v: string | null | undefined): Set<string> {
  if (!v) return new Set();
  return new Set(
    v.toLowerCase()
      .replace(/[^a-z0-9+/ -]/g, ' ')
      .split(/[\s/-]+/)
      .filter(t => t.length > 1 && !TEXT_STOPWORDS.has(t)),
  );
}

/** Free-text agreement: token Jaccard ≥ 0.5, or overlap coefficient (inter / smaller set) ≥ 0.6. */
export function textSimilar(a: string | null | undefined, b: string | null | undefined): boolean {
  if (a == null || b == null) return a == null && b == null;
  const ta = textTokens(a);
  const tb = textTokens(b);
  if (ta.size === 0 || tb.size === 0) return ta.size === tb.size;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter++;
  const union = ta.size + tb.size - inter;
  if (inter / union >= 0.5) return true;
  return inter / Math.min(ta.size, tb.size) >= 0.6;
}

export type GoldenField = 'therapeutic_area' | 'modality' | 'indication_category' | 'target' | 'target_class' | 'indication_specific' | 'moa_short';
export const CATEGORICAL_FIELDS: GoldenField[] = ['therapeutic_area', 'modality', 'indication_category', 'target_class'];
export const TEXT_FIELDS: GoldenField[] = ['indication_specific', 'moa_short'];
export const GOLDEN_FIELDS: GoldenField[] = ['therapeutic_area', 'modality', 'target', 'indication_specific', 'moa_short', 'indication_category', 'target_class'];

/** Mirrors sameValue() in lib/radar/classify.ts (not exported there) plus fuzzy text fields. */
export function fieldAgrees(field: string, stored: string | null, model: string | null): boolean {
  if (stored == null || model == null) return stored == null && model == null;
  if (field === 'target') return normalizeKey(stored) === normalizeKey(model);
  if ((TEXT_FIELDS as string[]).includes(field)) return textSimilar(stored, model);
  return stored.trim().toLowerCase() === model.trim().toLowerCase();
}

export function emptyFieldStats(): FieldAgreementStats {
  return { compared: 0, agree: 0, agreement_pct: 0, kappa: null, both_null: 0, model_only: 0, stored_only: 0 };
}

export function finalizeFieldStats(stats: FieldAgreementStats, pairs: [string | null, string | null][], categorical: boolean): FieldAgreementStats {
  stats.agreement_pct = stats.compared > 0 ? Math.round((stats.agree / stats.compared) * 1000) / 10 : 0;
  stats.kappa = categorical ? cohensKappa(pairs) : null;
  return stats;
}

// ═══════════════════════════════════════════════════════════════════════
// AGREEMENT RUN
// ═══════════════════════════════════════════════════════════════════════

export interface Disagreement {
  asset_id: string;
  asset_name: string;
  company_name: string;
  field: string;
  stored: string | null;
  model: string | null;
  model_confidence: number | null;
  rationale: string | null;
  evidence: { nct_ids: string[]; urls: string[] };
}

export interface PartnershipVerdict {
  asset_id: string;
  partnership_status: 'unpartnered' | 'partially_partnered' | 'partnered';
  partner_name: string | null;
  confidence: number;
  rationale: string;
  evidence_ids: string[];
}

const PartnershipVerdictSchema = z.object({
  asset_id: z.string().min(1),
  partnership_status: z.enum(['unpartnered', 'partially_partnered', 'partnered']),
  partner_name: z.string().trim().max(120).nullable(),
  confidence: z.number().int().min(0).max(100),
  rationale: z.string().trim().max(240),
  evidence_ids: z.array(z.string().max(80)).max(10),
});
const PartnershipResponseSchema = z.object({ results: z.array(z.record(z.string(), z.unknown())) });

export const PARTNERSHIP_QA_PROMPT_VERSION = 'qa-partnership-v1';

export const PARTNERSHIP_QA_SYSTEM_PROMPT = `You audit partnership status for clinical-stage drug assets in a biopharma licensing database.

For each asset you receive the rows we hold: the asset's trials (lead sponsor, collaborators, sponsor class), licensing / M&A deals involving the owning company, and licensing-related press releases mentioning the company. Decide, from THIS EVIDENCE ONLY, whether the asset is:

- "partnered": an active license, option, co-development or acquisition agreement covers this asset (a deal row or press item names the asset or an unmistakable alias, or the asset is the company's only clinical program and the deal covers "the pipeline").
- "partially_partnered": rights are granted for some territories only, or an industry collaborator (not a CRO, not a drug-supply partner on a combination arm, not academic / government / non-profit) co-runs the trial without a disclosed full license.
- "unpartnered": nothing in the evidence links this asset to a third-party rights holder.

Rules:
1. A pharma supplying a comparator or combination drug (e.g. Merck supplying pembrolizumab) is NOT a partner for this asset.
2. Academic, hospital, government, cooperative-group and non-profit collaborators never make an asset partnered.
3. Terminated or expired deals do not count.
4. A deal for a different asset of the same company does not count unless it is explicitly pipeline-wide.
5. When the evidence is silent, answer "unpartnered" with low confidence rather than guessing.

Return strict JSON only: {"results":[{"asset_id","partnership_status","partner_name","confidence","rationale","evidence_ids"}]}. evidence_ids lists the NCT ids, deal ids or press ids you relied on. rationale ≤ 240 characters.`;

function partnershipOutputSchema(): Record<string, unknown> {
  return {
    type: 'object',
    additionalProperties: false,
    required: ['results'],
    properties: {
      results: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          required: ['asset_id', 'partnership_status', 'partner_name', 'confidence', 'rationale', 'evidence_ids'],
          properties: {
            asset_id: { type: 'string' },
            partnership_status: { type: 'string', enum: ['unpartnered', 'partially_partnered', 'partnered'] },
            partner_name: { type: ['string', 'null'] },
            confidence: { type: 'integer', minimum: 0, maximum: 100 },
            rationale: { type: 'string' },
            evidence_ids: { type: 'array', items: { type: 'string' } },
          },
        },
      },
    },
  };
}

export interface PartnershipQaInput {
  asset_id: string;
  asset_name: string;
  aliases: string[];
  company_name: string;
  stored_status: string | null;
  stored_partner: string | null;
  trials: { nct_id: string; lead_sponsor: string | null; lead_sponsor_class: string | null; collaborators: string[]; status: string | null }[];
  deals: { id: string; licensor: string | null; licensee: string | null; asset_name: string | null; deal_type: string | null; status: string | null; territory: string | null; announced: string | null }[];
  press: { id: string; headline: string; published_at: string | null; url: string | null }[];
}

export function buildPartnershipUserMessage(inputs: PartnershipQaInput[]): string {
  // The stored status is deliberately withheld so the model judges from evidence only.
  const payload = inputs.map(i => ({
    asset_id: i.asset_id,
    asset_name: i.asset_name,
    aliases: i.aliases.slice(0, 8),
    owner: i.company_name,
    trials: i.trials.slice(0, 6),
    deals: i.deals.slice(0, 8),
    press: i.press.slice(0, 8),
  }));
  return `Assets:\n${JSON.stringify(payload)}`;
}

export function buildPartnershipRequestParams(model: string, inputs: PartnershipQaInput[]): Anthropic.MessageCreateParamsNonStreaming {
  const params: Anthropic.MessageCreateParamsNonStreaming = {
    model,
    max_tokens: 4096,
    system: [{ type: 'text', text: PARTNERSHIP_QA_SYSTEM_PROMPT, cache_control: { type: 'ephemeral' } }],
    messages: [{ role: 'user', content: buildPartnershipUserMessage(inputs) }],
    output_config: { format: { type: 'json_schema', schema: partnershipOutputSchema() } },
    thinking: { type: 'disabled' },
  };
  if (supportsTemperature(model)) params.temperature = 0;
  return params;
}

export async function partnershipBatchWithModel(
  client: ClassifierClient,
  model: string,
  inputs: PartnershipQaInput[],
  budget: RequestBudget,
): Promise<{ verdicts: Map<string, PartnershipVerdict>; usage: TokenUsage }> {
  if (!budget.tryAcquire()) throw new RequestCapError(budget.maxRequests);
  const msg = await client.messages.create(buildPartnershipRequestParams(model, inputs));
  const usage = emptyUsage();
  usage.input = msg.usage.input_tokens;
  usage.output = msg.usage.output_tokens;
  usage.cacheWrite = msg.usage.cache_creation_input_tokens ?? 0;
  usage.cacheRead = msg.usage.cache_read_input_tokens ?? 0;
  const text = msg.content.find((b): b is Anthropic.TextBlock => b.type === 'text')?.text ?? '';
  if (msg.stop_reason === 'max_tokens') throw new Error('partnership response truncated at max_tokens');
  const parsed = PartnershipResponseSchema.safeParse(JSON.parse(text));
  if (!parsed.success) throw new Error(`partnership response is not {results: [...]}: ${parsed.error.message.slice(0, 200)}`);
  const wanted = new Set(inputs.map(i => i.asset_id));
  const verdicts = new Map<string, PartnershipVerdict>();
  for (const raw of parsed.data.results) {
    const v = PartnershipVerdictSchema.safeParse(raw);
    if (v.success && wanted.has(v.data.asset_id) && !verdicts.has(v.data.asset_id)) verdicts.set(v.data.asset_id, v.data);
  }
  return { verdicts, usage };
}

export interface GoldenAgreementOptions {
  model?: string;
  /** Assets per classification request (≤ 20). */
  batchSize?: number;
  /** Assets per partnership request (≤ 10). */
  partnershipBatchSize?: number;
  maxRequests?: number;
  /** Stop issuing requests once the estimated spend passes this (USD). */
  maxCostUsd?: number;
  timeBudgetMs?: number;
  persist?: boolean;
  now?: () => number;
  sleep?: (ms: number) => Promise<void>;
}

export interface GoldenAgreementReport {
  run_id: string | null;
  model: string;
  golden_size: number;
  classified_compared: number;
  partnership_compared: number;
  fields: Record<string, FieldAgreementStats>;
  partnership: FieldAgreementStats & { confusion: Record<string, Record<string, number>> };
  disagreements: Disagreement[];
  partnership_disagreements: { asset_id: string; asset_name: string; company_name: string; stored: string | null; model: string; model_partner: string | null; stored_partner: string | null; confidence: number; rationale: string; evidence_ids: string[] }[];
  requests: number;
  tokens: TokenUsage;
  estimated_cost_usd: number;
  errors: string[];
  duration_ms: number;
}

interface GoldenAssetRow {
  asset_id: string;
  stratum: string;
}

const GOLDEN_ASSET_COLUMNS =
  'id, company_id, company_name, asset_name, asset_aliases, indications_all, nct_ids, lead_nct_id, therapeutic_area, modality, indication_category, indication_specific, target, mechanism, target_class, moa_short, data_sources, classification_status, classification_evidence, classification_confidence, classification_model, drug_master_id, drug_resolution_status, partnership_status, partner_company_name, partner_company_id';
const COMPANY_EMBED = 'companies!clinical_assets_company_id_fkey';

type GoldenAsset = QueuedAsset & { partnership_status: string | null; partner_company_name: string | null; partner_company_id: string | null };

async function loadGoldenAssets(supabase: SupabaseClient): Promise<GoldenAsset[]> {
  const golden = await fetchAllPages<GoldenAssetRow>('radar_qa_golden_assets read', (from, to) =>
    supabase.from('radar_qa_golden_assets').select('asset_id, stratum').order('asset_id').range(from, to));
  const out: GoldenAsset[] = [];
  for (const part of chunk(golden.map(g => g.asset_id), IN_CHUNK)) {
    const { data, error } = await supabase
      .from('clinical_assets')
      .select(`${GOLDEN_ASSET_COLUMNS}, ${COMPANY_EMBED}(owner_type)`)
      .in('id', part)
      .range(0, PAGE_SIZE - 1);
    if (error) throw new Error(`clinical_assets read: ${error.message}`);
    for (const raw of (data ?? []) as Record<string, unknown>[]) {
      const { companies, ...rest } = raw;
      const embed = Array.isArray(companies) ? companies[0] : companies;
      out.push({ ...(rest as unknown as GoldenAsset), owner_type: ((embed as { owner_type?: OwnerType } | null)?.owner_type ?? null) });
    }
  }
  return out.sort((a, b) => a.id.localeCompare(b.id));
}

async function gatherPartnershipInputs(supabase: SupabaseClient, assets: GoldenAsset[], errors: string[]): Promise<Map<string, PartnershipQaInput>> {
  const ncts = [...new Set(assets.flatMap(a => a.nct_ids ?? []).filter(Boolean))];
  const trialsByNct = new Map<string, PartnershipQaInput['trials']>();
  for (const part of chunk(ncts, 150)) {
    try {
      const rows = await fetchAllPages<{ nct_id: string; company_name: string; lead_sponsor_name: string | null; lead_sponsor_class: string | null; collaborator_names: string[] | null; status: string | null }>(
        'company_trials read',
        (from, to) => supabase.from('company_trials').select('nct_id, company_name, lead_sponsor_name, lead_sponsor_class, collaborator_names, status').in('nct_id', part).order('id').range(from, to));
      for (const r of rows) {
        if (!trialsByNct.has(r.nct_id)) trialsByNct.set(r.nct_id, []);
        const list = trialsByNct.get(r.nct_id)!;
        if (list.length === 0) list.push({ nct_id: r.nct_id, lead_sponsor: r.lead_sponsor_name ?? r.company_name, lead_sponsor_class: r.lead_sponsor_class, collaborators: r.collaborator_names ?? [], status: r.status });
      }
    } catch (err) { errors.push(err instanceof Error ? err.message : String(err)); }
  }

  const companyIds = [...new Set(assets.map(a => a.company_id).filter((v): v is string => !!v))];
  const dealsByCompany = new Map<string, PartnershipQaInput['deals']>();
  for (const part of chunk(companyIds, 100)) {
    for (const side of ['licensor_id', 'licensee_id'] as const) {
      const { data, error } = await supabase
        .from('deals')
        .select('id, licensor_id, licensee_id, licensor_name, licensee_name, asset_name, deal_type, deal_status, territory, announced_date')
        .in(side, part)
        .order('announced_date', { ascending: false })
        .range(0, PAGE_SIZE - 1);
      if (error) { errors.push(`deals read: ${error.message}`); continue; }
      for (const d of (data ?? []) as Record<string, unknown>[]) {
        const key = String(d[side]);
        if (!dealsByCompany.has(key)) dealsByCompany.set(key, []);
        dealsByCompany.get(key)!.push({
          id: String(d.id), licensor: d.licensor_name as string | null, licensee: d.licensee_name as string | null,
          asset_name: d.asset_name as string | null, deal_type: d.deal_type as string | null, status: d.deal_status as string | null,
          territory: d.territory as string | null, announced: d.announced_date as string | null,
        });
      }
    }
  }

  const names = [...new Set(assets.map(a => a.company_name).filter(Boolean))];
  const pressByName = new Map<string, PartnershipQaInput['press']>();
  const cutoff = new Date(); cutoff.setMonth(cutoff.getMonth() - 36);
  for (const part of chunk(names, 100)) {
    const { data, error } = await supabase
      .from('press_releases')
      .select('id, headline, published_at, source_url, companies_mentioned')
      .overlaps('companies_mentioned', pgArrayLiteral(part))
      .overlaps('categories', ['licensing', 'm&a'])
      .gte('published_at', cutoff.toISOString())
      .order('published_at', { ascending: false })
      .range(0, PAGE_SIZE - 1);
    if (error) { errors.push(`press_releases read: ${error.message}`); continue; }
    for (const p of (data ?? []) as Record<string, unknown>[]) {
      for (const m of (p.companies_mentioned as string[] | null) ?? []) {
        if (!pressByName.has(m)) pressByName.set(m, []);
        pressByName.get(m)!.push({ id: String(p.id), headline: String(p.headline), published_at: p.published_at as string | null, url: p.source_url as string | null });
      }
    }
  }

  const out = new Map<string, PartnershipQaInput>();
  for (const a of assets) {
    out.set(a.id, {
      asset_id: a.id,
      asset_name: a.asset_name,
      aliases: a.asset_aliases ?? [],
      company_name: a.company_name,
      stored_status: a.partnership_status,
      stored_partner: a.partner_company_name,
      trials: (a.nct_ids ?? []).flatMap(n => trialsByNct.get(n) ?? []),
      deals: a.company_id ? (dealsByCompany.get(a.company_id) ?? []) : [],
      press: pressByName.get(a.company_name) ?? [],
    });
  }
  return out;
}

export async function runGoldenAgreement(supabase: SupabaseClient, client: ClassifierClient, opts: GoldenAgreementOptions = {}): Promise<GoldenAgreementReport> {
  const now = opts.now ?? Date.now;
  const started = now();
  const model = opts.model ?? VALIDATION_MODEL;
  const batchSize = Math.max(1, Math.min(opts.batchSize ?? 20, 20));
  const pBatchSize = Math.max(1, Math.min(opts.partnershipBatchSize ?? 10, 10));
  const maxCostUsd = opts.maxCostUsd ?? 15;
  const timeBudgetMs = opts.timeBudgetMs ?? 250_000;
  const errors: string[] = [];
  const usage = emptyUsage();

  const report: GoldenAgreementReport = {
    run_id: null, model, golden_size: 0, classified_compared: 0, partnership_compared: 0,
    fields: {}, partnership: { ...emptyFieldStats(), confusion: {} },
    disagreements: [], partnership_disagreements: [],
    requests: 0, tokens: usage, estimated_cost_usd: 0, errors, duration_ms: 0,
  };
  for (const f of GOLDEN_FIELDS) report.fields[f] = emptyFieldStats();
  const pairs: Record<string, [string | null, string | null][]> = Object.fromEntries(GOLDEN_FIELDS.map(f => [f, []]));
  const partnershipPairs: [string | null, string | null][] = [];
  let budget: RequestBudget | null = null;

  let assets: GoldenAsset[];
  try {
    assets = await loadGoldenAssets(supabase);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return finish();
  }
  report.golden_size = assets.length;
  if (assets.length === 0) { errors.push('golden set is empty; run selectGoldenSet first'); return finish(); }

  budget = new RequestBudget(opts.maxRequests ?? (Math.ceil(assets.length / batchSize) + Math.ceil(assets.length / pBatchSize)) * 2);
  const overBudget = () => estimateCostUsd(model, usage) > maxCostUsd || now() - started > timeBudgetMs;

  // ── 1. Classification re-derivation (same request path as the classifier) ──
  const classifiable = assets.filter(a => a.classification_status !== 'skipped');
  let inputs: Awaited<ReturnType<typeof gatherClassificationInputs>>;
  try {
    inputs = await gatherClassificationInputs(supabase, classifiable);
  } catch (err) {
    errors.push(err instanceof Error ? err.message : String(err));
    return finish();
  }
  for (const batch of chunk(classifiable, batchSize)) {
    if (overBudget()) { errors.push('cost / time budget exhausted during classification agreement'); break; }
    let items: Map<string, ClassificationItem>;
    try {
      const out = await classifyBatchWithModel(client, model, batch.map(a => inputs.get(a.id)!), budget, opts.sleep);
      mergeUsage(usage, out.usage);
      items = out.items;
    } catch (err) {
      errors.push(`classification batch failed: ${err instanceof Error ? err.message : String(err)}`);
      if (err instanceof RequestCapError) break;
      continue;
    }
    for (const a of batch) {
      const v = items.get(a.id);
      if (!v) continue;
      report.classified_compared++;
      const input = inputs.get(a.id);
      for (const f of GOLDEN_FIELDS) {
        const stored = ((a as unknown as Record<string, string | null>)[f] ?? null);
        const modelValue = (v[f] ?? null) as string | null;
        const agg = report.fields[f];
        agg.compared++;
        pairs[f].push([stored, modelValue]);
        if (stored == null && modelValue == null) { agg.both_null++; agg.agree++; continue; }
        if (stored == null) agg.model_only++;
        else if (modelValue == null) agg.stored_only++;
        if (fieldAgrees(f, stored, modelValue)) agg.agree++;
        else if (report.disagreements.length < 400) {
          report.disagreements.push({
            asset_id: a.id, asset_name: a.asset_name, company_name: a.company_name, field: f,
            stored, model: modelValue, model_confidence: v.confidence, rationale: v.rationale ?? null,
            evidence: {
              nct_ids: (input?.trials ?? []).map(t => t.nct_id),
              urls: (input?.trials ?? []).map(t => `https://clinicaltrials.gov/study/${t.nct_id}`),
            },
          });
        }
      }
    }
  }
  for (const f of GOLDEN_FIELDS) finalizeFieldStats(report.fields[f], pairs[f], (CATEGORICAL_FIELDS as string[]).includes(f));

  // ── 2. Independent partnership check ─────────────────────────────────
  const pInputs = await gatherPartnershipInputs(supabase, assets, errors);
  const confusion: Record<string, Record<string, number>> = {};
  for (const batch of chunk(assets, pBatchSize)) {
    if (overBudget()) { errors.push('cost / time budget exhausted during partnership agreement'); break; }
    let verdicts: Map<string, PartnershipVerdict>;
    try {
      const out = await partnershipBatchWithModel(client, model, batch.map(a => pInputs.get(a.id)!), budget);
      mergeUsage(usage, out.usage);
      verdicts = out.verdicts;
    } catch (err) {
      errors.push(`partnership batch failed: ${err instanceof Error ? err.message : String(err)}`);
      if (err instanceof RequestCapError) break;
      continue;
    }
    for (const a of batch) {
      const v = verdicts.get(a.id);
      if (!v) continue;
      report.partnership_compared++;
      const stored = a.partnership_status ?? null;
      const agg = report.partnership;
      agg.compared++;
      partnershipPairs.push([stored, v.partnership_status]);
      const row = stored ?? NULL_TOKEN;
      confusion[row] = confusion[row] ?? {};
      confusion[row][v.partnership_status] = (confusion[row][v.partnership_status] ?? 0) + 1;
      if (stored === v.partnership_status) agg.agree++;
      else if (report.partnership_disagreements.length < 200) {
        report.partnership_disagreements.push({
          asset_id: a.id, asset_name: a.asset_name, company_name: a.company_name,
          stored, model: v.partnership_status, model_partner: v.partner_name, stored_partner: a.partner_company_name,
          confidence: v.confidence, rationale: v.rationale, evidence_ids: v.evidence_ids,
        });
      }
    }
  }
  finalizeFieldStats(report.partnership, partnershipPairs, true);
  report.partnership.confusion = confusion;

  return finish();

  async function finish(): Promise<GoldenAgreementReport> {
    report.requests = budget?.requests ?? 0;
    report.estimated_cost_usd = estimateCostUsd(model, usage);
    report.duration_ms = now() - started;
    if (opts.persist !== false && report.golden_size > 0) {
      const passed = agreementPassed(report);
      const { data, error } = await supabase
        .from('radar_qa_runs')
        .insert({
          kind: 'golden_agreement',
          run_at: new Date(now()).toISOString(),
          universe_size: report.golden_size,
          summary: { ...report, disagreements: report.disagreements.slice(0, 100), partnership_disagreements: report.partnership_disagreements.slice(0, 100) },
          passed,
          blocking_failures: passed ? 0 : 1,
          notes: `model ${model}; ${report.requests} requests; $${report.estimated_cost_usd.toFixed(2)}`,
        })
        .select('id')
        .single();
      if (error) errors.push(`radar_qa_runs insert failed: ${error.message}`);
      else report.run_id = data?.id ?? null;
      if (report.run_id) {
        const findings = [
          ...report.disagreements.map(d => ({
            run_id: report.run_id, asset_id: d.asset_id, check_name: `golden_agreement_${d.field}`,
            severity: (['therapeutic_area', 'modality', 'target'].includes(d.field) ? 'major' : 'minor') as 'major' | 'minor',
            expected: d.stored, observed: d.model,
            details: { model_confidence: d.model_confidence, rationale: d.rationale, evidence: d.evidence, asset_name: d.asset_name, company_name: d.company_name },
          })),
          ...report.partnership_disagreements.map(d => ({
            run_id: report.run_id, asset_id: d.asset_id, check_name: 'golden_agreement_partnership_status',
            severity: 'major' as const, expected: d.stored, observed: d.model,
            details: { model_partner: d.model_partner, stored_partner: d.stored_partner, confidence: d.confidence, rationale: d.rationale, evidence_ids: d.evidence_ids, asset_name: d.asset_name, company_name: d.company_name },
          })),
        ];
        for (const part of chunk(findings, 200)) {
          const { error: fErr } = await supabase.from('radar_qa_findings').insert(part);
          if (fErr) { errors.push(`radar_qa_findings insert failed: ${fErr.message}`); break; }
        }
      }
    }
    return report;
  }
}

/** Launch-gate agreement thresholds (docs/asset-radar-qa.md). */
export const AGREEMENT_GATE = { therapeutic_area: 85, modality: 85, target: 75, partnership_status: 85 } as const;

export function agreementPassed(report: Pick<GoldenAgreementReport, 'fields' | 'partnership' | 'classified_compared'>): boolean {
  if (report.classified_compared === 0) return false;
  for (const [field, min] of Object.entries(AGREEMENT_GATE)) {
    const stats = field === 'partnership_status' ? report.partnership : report.fields[field];
    if (!stats || stats.compared === 0 || stats.agreement_pct < min) return false;
  }
  return true;
}

// ═══════════════════════════════════════════════════════════════════════
// HUMAN REVIEW SHEET
// ═══════════════════════════════════════════════════════════════════════

export const HUMAN_REVIEW_FIELDS = [
  'therapeutic_area', 'modality', 'phase', 'target', 'indication_specific', 'moa_short', 'partnership_status', 'partner_company_name',
] as const;
export type HumanReviewField = (typeof HUMAN_REVIEW_FIELDS)[number];

export const HUMAN_REVIEW_COLUMNS = [
  'asset_id', 'asset_name', 'company_name', 'stratum', 'asset_url', 'field', 'model_value', 'model_label', 'human_value', 'agrees', 'comment', 'evidence',
] as const;

export interface HumanReviewSheetRow {
  asset_id: string;
  asset_name: string;
  company_name: string;
  stratum: string;
  asset_url: string;
  field: HumanReviewField;
  model_value: string | null;
  model_label: string;
  human_value: string | null;
  agrees: string | null;
  comment: string | null;
  evidence: string;
}

export function buildHumanReviewRows(
  golden: { asset_id: string; stratum: string; frozen_snapshot: Record<string, unknown> }[],
  baseUrl = 'https://solidus.ambrosiaventures.co',
): HumanReviewSheetRow[] {
  const rows: HumanReviewSheetRow[] = [];
  for (const g of golden) {
    const asset = (g.frozen_snapshot?.asset ?? {}) as Record<string, unknown>;
    const ncts = Array.isArray(asset.nct_ids) ? (asset.nct_ids as string[]).slice(0, 5) : [];
    const evidenceLinks = ncts.map(n => `https://clinicaltrials.gov/study/${n}`);
    const partnershipEvidence = Array.isArray(g.frozen_snapshot?.partnership_evidence)
      ? (g.frozen_snapshot.partnership_evidence as { type: string; id: string; url?: string; note?: string }[]).map(e => e.url ?? `${e.type}:${e.id}`)
      : [];
    for (const field of HUMAN_REVIEW_FIELDS) {
      const value = asset[field] == null ? null : String(asset[field]);
      const evidence = field === 'partnership_status' || field === 'partner_company_name'
        ? [...partnershipEvidence, ...evidenceLinks].join('\n')
        : evidenceLinks.join('\n');
      rows.push({
        asset_id: g.asset_id,
        asset_name: String(asset.asset_name ?? ''),
        company_name: String(asset.company_name ?? ''),
        stratum: g.stratum,
        asset_url: `${baseUrl}/radar/${g.asset_id}`,
        field,
        model_value: value,
        model_label: field === 'moa_short' || field === 'indication_specific' || field === 'partner_company_name' || field === 'target' ? (value ?? '') : radarLabel(value),
        human_value: null,
        agrees: null,
        comment: null,
        evidence,
      });
    }
  }
  return rows;
}

export async function exportHumanReviewSheet(supabase: SupabaseClient, opts: { baseUrl?: string } = {}): Promise<{ buffer: Buffer; rows: number; assets: number }> {
  const golden = await fetchAllPages<{ asset_id: string; stratum: string; frozen_snapshot: Record<string, unknown> }>('radar_qa_golden_assets read', (from, to) =>
    supabase.from('radar_qa_golden_assets').select('asset_id, stratum, frozen_snapshot').order('stratum').order('asset_id').range(from, to));
  const rows = buildHumanReviewRows(golden, opts.baseUrl);

  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  wb.creator = 'Asset Radar QA';
  const intro = wb.addWorksheet('Instructions');
  intro.getColumn(1).width = 110;
  [
    'Asset Radar golden-set human review',
    '',
    'One row per asset x field. For each row open asset_url (and the evidence links), then:',
    '  human_value  the value you believe is correct, using the same vocabulary as model_value (leave blank if you agree)',
    '  agrees       yes / no',
    '  comment      optional; cite the source when you disagree',
    '',
    'Vocabulary: therapeutic_area, modality, phase and partnership_status use lib/radar/vocab.ts slugs (e.g. oncology, antibody, phase_2, partnered).',
    'target is the HGNC symbol or common target name (PD-1, KRAS G12C). indication_specific is the lead disease. moa_short is a short mechanism phrase.',
    '',
    'Save as .xlsx and import with: npx tsx scripts/radar-qa-report.ts --import <file> --reviewer <name>',
  ].forEach(line => intro.addRow([line]));

  const ws = wb.addWorksheet('Review');
  ws.columns = HUMAN_REVIEW_COLUMNS.map(key => ({
    header: key,
    key,
    width: key === 'evidence' ? 60 : key === 'asset_url' ? 48 : key === 'comment' ? 40 : key === 'asset_id' ? 38 : 22,
  }));
  ws.getRow(1).font = { bold: true };
  ws.views = [{ state: 'frozen', ySplit: 1 }];
  for (const r of rows) ws.addRow(r);
  ws.autoFilter = { from: 'A1', to: `${String.fromCharCode(64 + HUMAN_REVIEW_COLUMNS.length)}1` };
  const buffer = Buffer.from(await wb.xlsx.writeBuffer());
  return { buffer, rows: rows.length, assets: golden.length };
}

export interface HumanReviewInput {
  asset_id: string;
  field: string;
  model_value: string | null;
  human_value: string | null;
  agrees: boolean | null;
  comment: string | null;
}

const YES = new Set(['yes', 'y', 'true', '1', 'agree', 'ok']);
const NO = new Set(['no', 'n', 'false', '0', 'disagree']);

/** Normalise raw sheet cells: agrees parsed from yes/no; blank human_value + blank agrees = not reviewed (dropped). */
export function normalizeHumanReviewRows(raw: Record<string, unknown>[]): HumanReviewInput[] {
  const out: HumanReviewInput[] = [];
  for (const r of raw) {
    const assetId = String(r.asset_id ?? '').trim();
    const field = String(r.field ?? '').trim();
    if (!assetId || !(HUMAN_REVIEW_FIELDS as readonly string[]).includes(field)) continue;
    const str = (v: unknown) => (v == null || String(v).trim() === '' ? null : String(v).trim());
    const modelValue = str(r.model_value);
    const humanValue = str(r.human_value);
    const agreesRaw = str(r.agrees)?.toLowerCase() ?? null;
    let agrees: boolean | null = null;
    if (agreesRaw != null) agrees = YES.has(agreesRaw) ? true : NO.has(agreesRaw) ? false : null;
    if (agrees === null && humanValue != null) agrees = fieldAgrees(field, modelValue, humanValue);
    if (agrees === null) continue;
    out.push({ asset_id: assetId, field, model_value: modelValue, human_value: humanValue ?? (agrees ? modelValue : null), agrees, comment: str(r.comment) });
  }
  return out;
}

export async function parseHumanReviewSheet(buffer: Buffer): Promise<HumanReviewInput[]> {
  const ExcelJS = (await import('exceljs')).default;
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer as unknown as ArrayBuffer);
  const ws = wb.getWorksheet('Review') ?? wb.worksheets[wb.worksheets.length - 1];
  if (!ws) return [];
  const headers: string[] = [];
  ws.getRow(1).eachCell((cell, col) => { headers[col] = String(cell.value ?? '').trim(); });
  const raw: Record<string, unknown>[] = [];
  ws.eachRow((row, idx) => {
    if (idx === 1) return;
    const rec: Record<string, unknown> = {};
    row.eachCell({ includeEmpty: false }, (cell, col) => {
      const key = headers[col];
      if (!key) return;
      const v = cell.value;
      rec[key] = v && typeof v === 'object' && 'text' in (v as object) ? (v as { text: string }).text : v;
    });
    raw.push(rec);
  });
  return normalizeHumanReviewRows(raw);
}

export interface HumanReviewSummary {
  run_id: string | null;
  reviewer: string;
  imported: number;
  fields: Record<string, FieldAgreementStats>;
  errors: string[];
}

/** Per-field agreement from human rows (pure). */
export function summarizeHumanReviews(rows: HumanReviewInput[]): Record<string, FieldAgreementStats> {
  const fields: Record<string, FieldAgreementStats> = {};
  const pairs: Record<string, [string | null, string | null][]> = {};
  for (const r of rows) {
    fields[r.field] = fields[r.field] ?? emptyFieldStats();
    pairs[r.field] = pairs[r.field] ?? [];
    const s = fields[r.field];
    s.compared++;
    if (r.agrees) s.agree++;
    if (r.model_value == null && r.human_value == null) s.both_null++;
    else if (r.model_value == null) s.model_only++;
    else if (r.human_value == null) s.stored_only++;
    pairs[r.field].push([r.model_value, r.agrees ? r.model_value : r.human_value]);
  }
  for (const f of Object.keys(fields)) finalizeFieldStats(fields[f], pairs[f], ['therapeutic_area', 'modality', 'phase', 'partnership_status'].includes(f));
  return fields;
}

export async function importHumanReviews(
  supabase: SupabaseClient,
  rows: HumanReviewInput[],
  reviewer: string,
  opts: { now?: () => number } = {},
): Promise<HumanReviewSummary> {
  const now = opts.now ?? Date.now;
  const nowIso = new Date(now()).toISOString();
  const errors: string[] = [];
  const fields = summarizeHumanReviews(rows);
  const summary: HumanReviewSummary = { run_id: null, reviewer, imported: 0, fields, errors };
  if (rows.length === 0) { errors.push('no reviewed rows (agrees or human_value must be filled)'); return summary; }

  for (const part of chunk(rows, 200)) {
    const { error } = await supabase.from('radar_qa_human_reviews').insert(part.map(r => ({
      asset_id: r.asset_id, reviewer, field: r.field, model_value: r.model_value, human_value: r.human_value,
      agrees: r.agrees, comment: r.comment, reviewed_at: nowIso,
    })));
    if (error) { errors.push(`radar_qa_human_reviews insert failed: ${error.message}`); break; }
    summary.imported += part.length;
  }

  const gate = Object.entries(AGREEMENT_GATE).every(([f, min]) => !fields[f] || fields[f].agreement_pct >= min);
  const { data, error } = await supabase
    .from('radar_qa_runs')
    .insert({
      kind: 'golden_human', run_at: nowIso, universe_size: new Set(rows.map(r => r.asset_id)).size,
      summary: { reviewer, imported: summary.imported, fields },
      passed: gate, blocking_failures: gate ? 0 : 1, notes: `reviewer ${reviewer}`,
    })
    .select('id')
    .single();
  if (error) errors.push(`radar_qa_runs insert failed: ${error.message}`);
  else summary.run_id = data?.id ?? null;
  return summary;
}
