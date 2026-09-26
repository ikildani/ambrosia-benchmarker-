/**
 * Outcome ledger — prediction writers.
 *
 *   recordCalculatorPrediction — every saved calculation with a signed-in user;
 *                                deduped on (user, fingerprint) per 24 h.
 *   recordBriefPrediction      — one row per brief generation from bridge.ask /
 *                                floor, buyerMap.process.lead + tension and the
 *                                catalyst window; deduped on request id per 24 h.
 *   recordRadarPredictions     — nightly: top-decile unpartnered clinical_assets
 *                                by licensing_intent_score get a 12-month window
 *                                prediction (no term forecast). Behind the
 *                                OUTCOMES_RADAR_WRITER=true env flag.
 *
 * None of these throw: callers fire-and-forget (`void record…`) and a failure is
 * logged with the [Outcomes] prefix.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import type { BriefIntelligence } from '@/lib/brief/types';
import { normalizePhase } from '@/lib/brief/comp-set';
import type { PredictionInsert, RadarWriterReport } from './types';

export const CALCULATOR_MODEL_VERSION = 'calculator-1.0.0';
/** brief-v3.1 (Sep 2026): outcome-informed priors — the snapshot used is recorded in priors_as_of, never here. */
export const BRIEF_MODEL_VERSION = 'brief-v3.1';
export const RADAR_MODEL_VERSION = 'radar-intent-v3';
const DEDUPE_WINDOW_MS = 24 * 60 * 60 * 1000;
const RADAR_MAX_ASSETS = 300;

export type WriterResult =
  | { ok: true; id: string }
  | { ok: false; reason: 'deduped' | 'no_user' | 'no_terms' | 'error'; error?: string };

function num(v: number | null | undefined): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function log(msg: string): void {
  console.log(`[Outcomes] ${msg}`);
}

function warn(msg: string, e?: unknown): void {
  console.warn(`[Outcomes] ${msg}`, e instanceof Error ? e.message : e ?? '');
}

async function alreadyRecorded(supabase: SupabaseClient, where: { source: string; user_id?: string | null; fingerprint?: string | null; source_id?: string | null }, now: Date): Promise<boolean> {
  let q = supabase
    .from('predictions')
    .select('id')
    .eq('source', where.source)
    .gte('created_at', new Date(now.getTime() - DEDUPE_WINDOW_MS).toISOString())
    .limit(1);
  if (where.user_id !== undefined) q = where.user_id ? q.eq('user_id', where.user_id) : q.is('user_id', null);
  if (where.fingerprint !== undefined && where.fingerprint) q = q.eq('fingerprint', where.fingerprint);
  if (where.source_id !== undefined && where.source_id) q = q.eq('source_id', where.source_id);
  const { data, error } = await q;
  if (error) throw new Error(error.message);
  return (data ?? []).length > 0;
}

async function insertPrediction(supabase: SupabaseClient, row: PredictionInsert): Promise<WriterResult> {
  const { data, error } = await supabase.from('predictions').insert(row).select('id').single();
  if (error || !data) return { ok: false, reason: 'error', error: error?.message ?? 'insert returned no row' };
  return { ok: true, id: (data as { id: string }).id };
}

// ─── Calculator ────────────────────────────────────────────────────────────

export interface CalculatorPredictionInput {
  userId: string | null | undefined;
  calculationId: string;
  /** Client-supplied calculation_fingerprint; when absent one is derived from the inputs. */
  fingerprint?: string | null;
  therapeuticArea: string | null | undefined;
  modality: string | null | undefined;
  phase: string | null | undefined;
  indication: string | null | undefined;
  dealType?: string | null;
  territory?: string | null;
  /** The user's company (user_profiles.company_name) — the licensor when they sell. */
  licensorName?: string | null;
  /** $M, as stored on calculations.output_*; royalty in %. */
  outputs: {
    upfront_low?: number | null; upfront_mid?: number | null; upfront_high?: number | null;
    total_deal_value_low?: number | null; total_deal_value_high?: number | null;
    royalty_low?: number | null; royalty_high?: number | null;
  } | null | undefined;
  modelVersion?: string;
}

export function calculatorFingerprint(i: CalculatorPredictionInput): string {
  if (i.fingerprint?.trim()) return i.fingerprint.trim();
  const key = [i.therapeuticArea, i.modality, i.phase, i.indication, i.dealType, i.territory]
    .map((s) => (s ?? '').toString().trim().toLowerCase())
    .join('|');
  return `calc:${createHash('sha1').update(key).digest('hex').slice(0, 24)}`;
}

export function buildCalculatorPrediction(i: CalculatorPredictionInput, now: Date = new Date()): PredictionInsert | null {
  if (!i.userId) return null;
  const o = i.outputs ?? {};
  const upfrontLow = num(o.upfront_low);
  const upfrontHigh = num(o.upfront_high);
  const totalLow = num(o.total_deal_value_low);
  const totalHigh = num(o.total_deal_value_high);
  if (upfrontLow == null && upfrontHigh == null && totalLow == null && totalHigh == null) return null;
  const mid = (lo: number | null, hi: number | null) => (lo != null && hi != null ? (lo + hi) / 2 : null);
  return {
    source: 'calculator',
    source_id: i.calculationId,
    user_id: i.userId,
    company_id: null,
    asset_id: null,
    licensor_name: i.licensorName?.trim() || null,
    asset_name: null,
    indication: i.indication?.trim() || null,
    therapeutic_area: i.therapeuticArea?.trim() || null,
    phase: i.phase ? normalizePhase(i.phase) : null,
    modality: i.modality?.trim() || null,
    deal_type: i.dealType?.trim() || null,
    territory: i.territory?.trim() || null,
    upfront_low: upfrontLow,
    upfront_mid: num(o.upfront_mid) ?? mid(upfrontLow, upfrontHigh),
    upfront_high: upfrontHigh,
    total_low: totalLow,
    total_mid: mid(totalLow, totalHigh),
    total_high: totalHigh,
    royalty_low: num(o.royalty_low),
    royalty_high: num(o.royalty_high),
    predicted_buyers: [],
    predicted_window_start: null,
    predicted_window_end: null,
    model_version: i.modelVersion ?? CALCULATOR_MODEL_VERSION,
    fingerprint: calculatorFingerprint(i),
    resolve_after: new Date(now.getTime() + 30 * 86_400_000).toISOString(),
  };
}

export async function recordCalculatorPrediction(supabase: SupabaseClient, input: CalculatorPredictionInput, now: Date = new Date()): Promise<WriterResult> {
  try {
    if (!input.userId) return { ok: false, reason: 'no_user' };
    const row = buildCalculatorPrediction(input, now);
    if (!row) return { ok: false, reason: 'no_terms' };
    if (await alreadyRecorded(supabase, { source: 'calculator', user_id: input.userId, fingerprint: row.fingerprint }, now)) {
      return { ok: false, reason: 'deduped' };
    }
    const res = await insertPrediction(supabase, row);
    if (res.ok) log(`calculator prediction ${res.id} for calculation ${input.calculationId}`);
    else warn(`calculator prediction failed for ${input.calculationId}`, res.error);
    return res;
  } catch (e) {
    warn(`calculator prediction threw for ${input.calculationId}`, e);
    return { ok: false, reason: 'error', error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Brief ─────────────────────────────────────────────────────────────────

export interface BriefPredictionContext {
  requestId: string;
  userId: string | null | undefined;
  modelVersion?: string;
  /** From lib/outcomes/priors-snapshot.ts — "<calibrated_at date>|<premium as_of_date>". */
  priorsAsOf?: string | null;
}

/** "2027-03" → "2027-03-01" (start) / "2027-03-28" (end); full dates pass through. */
function windowDate(s: string | null | undefined, edge: 'start' | 'end'): string | null {
  if (!s) return null;
  const t = s.trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
  if (/^\d{4}-\d{2}$/.test(t)) return `${t}-${edge === 'start' ? '01' : '28'}`;
  if (/^\d{4}$/.test(t)) return `${t}-${edge === 'start' ? '01-01' : '12-31'}`;
  const ms = Date.parse(t);
  return Number.isFinite(ms) ? new Date(ms).toISOString().slice(0, 10) : null;
}

/**
 * Pure: BriefIntelligence → prediction row. The band is floor (low) → ask (mid)
 * → the widest bridge bar high on the same basis (high), never below the ask;
 * when no bar carries that basis, high = ask × 1.2.
 */
export function buildBriefPrediction(brief: BriefIntelligence, ctx: BriefPredictionContext, now: Date = new Date()): PredictionInsert | null {
  const bridge = brief.bridge;
  if (!bridge) return null;
  const bars = bridge.bars ?? [];
  const barHigh = (basis: 'upfront' | 'total') => {
    const highs = bars.filter((b) => b.basis === basis && Number.isFinite(b.high)).map((b) => b.high);
    return highs.length ? Math.max(...highs) : null;
  };
  const highFor = (ask: number, basis: 'upfront' | 'total') => Math.max(ask, barHigh(basis) ?? ask * 1.2);

  const process = brief.buyerMap?.process;
  const buyers = [...new Set([...(process?.lead ?? []), ...(process?.tension ?? [])].map((b) => b.trim()).filter(Boolean))];
  const window = brief.landscape?.catalysts?.recommendedWindow ?? null;
  const royalty = brief.decision?.ask?.royaltyPct ?? null;
  const a = brief.asset;

  return {
    source: 'brief',
    source_id: ctx.requestId,
    user_id: ctx.userId ?? null,
    company_id: null,
    asset_id: null,
    licensor_name: a.company?.trim() || null,
    asset_name: a.assetName?.trim() || null,
    indication: a.indication?.trim() || null,
    therapeutic_area: a.therapeuticArea?.trim() || null,
    phase: normalizePhase(a.phase),
    modality: a.modality?.trim() || null,
    deal_type: a.targetDealType?.trim() || null,
    territory: a.territory?.trim() || null,
    upfront_low: bridge.floor.upfrontM,
    upfront_mid: bridge.ask.upfrontM,
    upfront_high: highFor(bridge.ask.upfrontM, 'upfront'),
    total_low: bridge.floor.totalM,
    total_mid: bridge.ask.totalM,
    total_high: highFor(bridge.ask.totalM, 'total'),
    royalty_low: royalty ? royalty.low : null,
    royalty_high: royalty ? royalty.high : null,
    predicted_buyers: buyers,
    predicted_window_start: windowDate(window?.start, 'start'),
    predicted_window_end: windowDate(window?.end, 'end'),
    model_version: ctx.modelVersion ?? BRIEF_MODEL_VERSION,
    fingerprint: `brief:${ctx.requestId}`,
    priors_as_of: ctx.priorsAsOf?.trim() || null,
    resolve_after: new Date(now.getTime() + 30 * 86_400_000).toISOString(),
  };
}

export async function recordBriefPrediction(supabase: SupabaseClient, brief: BriefIntelligence, ctx: BriefPredictionContext, now: Date = new Date()): Promise<WriterResult> {
  try {
    const row = buildBriefPrediction(brief, ctx, now);
    if (!row) return { ok: false, reason: 'no_terms' };
    if (await alreadyRecorded(supabase, { source: 'brief', source_id: ctx.requestId }, now)) {
      return { ok: false, reason: 'deduped' };
    }
    const res = await insertPrediction(supabase, row);
    if (res.ok) log(`brief prediction ${res.id} for request ${ctx.requestId}`);
    else warn(`brief prediction failed for ${ctx.requestId}`, res.error);
    return res;
  } catch (e) {
    warn(`brief prediction threw for ${ctx.requestId}`, e);
    return { ok: false, reason: 'error', error: e instanceof Error ? e.message : String(e) };
  }
}

// ─── Radar ─────────────────────────────────────────────────────────────────

interface RadarAssetRow {
  id: string;
  company_id: string | null;
  company_name: string;
  asset_name: string;
  indication_specific: string | null;
  indication_category: string | null;
  therapeutic_area: string | null;
  phase: string | null;
  modality: string | null;
  licensing_intent_score: number | null;
}

export function isRadarWriterEnabled(): boolean {
  return process.env.OUTCOMES_RADAR_WRITER === 'true';
}

export interface RadarWriterOptions {
  now?: Date;
  /** Run even when OUTCOMES_RADAR_WRITER is not set (manual runs). */
  force?: boolean;
  maxAssets?: number;
}

/**
 * Top-decile unpartnered assets by clinical_assets.licensing_intent_score (the
 * live Radar score; radar_score_snapshots.prediction is only filled for backtest
 * rows, so it is not usable as "latest prediction"). One open radar prediction
 * per asset; the window is the next 12 months.
 */
export async function recordRadarPredictions(supabase: SupabaseClient, opts: RadarWriterOptions = {}): Promise<RadarWriterReport> {
  const now = opts.now ?? new Date();
  const report: RadarWriterReport = { enabled: opts.force || isRadarWriterEnabled(), candidates: 0, inserted: 0, skipped: 0, errors: [] };
  if (!report.enabled) return report;
  try {
    const scored = supabase
      .from('clinical_assets')
      .select('id', { count: 'exact', head: true })
      .in('partnership_status', ['unpartnered', 'partially_partnered'])
      .gt('licensing_intent_score', 0);
    const { count, error: countErr } = await scored;
    if (countErr) throw new Error(`count: ${countErr.message}`);
    const take = Math.min(opts.maxAssets ?? RADAR_MAX_ASSETS, Math.max(1, Math.ceil((count ?? 0) / 10)));
    if (!count) return report;

    const { data, error } = await supabase
      .from('clinical_assets')
      .select('id,company_id,company_name,asset_name,indication_specific,indication_category,therapeutic_area,phase,modality,licensing_intent_score')
      .in('partnership_status', ['unpartnered', 'partially_partnered'])
      .gt('licensing_intent_score', 0)
      .order('licensing_intent_score', { ascending: false })
      .limit(take);
    if (error) throw new Error(`assets: ${error.message}`);
    const assets = (data ?? []) as RadarAssetRow[];
    report.candidates = assets.length;
    if (!assets.length) return report;

    const { data: open, error: openErr } = await supabase
      .from('predictions')
      .select('asset_id')
      .eq('source', 'radar')
      .eq('status', 'open')
      .in('asset_id', assets.map((a) => a.id));
    if (openErr) throw new Error(`open radar predictions: ${openErr.message}`);
    const has = new Set(((open ?? []) as Array<{ asset_id: string | null }>).map((r) => r.asset_id));

    const start = now.toISOString().slice(0, 10);
    const end = new Date(Date.UTC(now.getUTCFullYear() + 1, now.getUTCMonth(), now.getUTCDate())).toISOString().slice(0, 10);
    const rows: PredictionInsert[] = [];
    for (const a of assets) {
      if (has.has(a.id)) { report.skipped++; continue; }
      rows.push({
        source: 'radar',
        source_id: a.id,
        user_id: null,
        company_id: a.company_id,
        asset_id: a.id,
        licensor_name: a.company_name,
        asset_name: a.asset_name,
        indication: a.indication_specific || a.indication_category || null,
        therapeutic_area: a.therapeutic_area,
        phase: a.phase ? normalizePhase(a.phase) : null,
        modality: a.modality,
        deal_type: null,
        territory: null,
        upfront_low: null, upfront_mid: null, upfront_high: null,
        total_low: null, total_mid: null, total_high: null,
        royalty_low: null, royalty_high: null,
        predicted_buyers: [],
        predicted_window_start: start,
        predicted_window_end: end,
        model_version: RADAR_MODEL_VERSION,
        fingerprint: `radar:${a.id}:${start.slice(0, 7)}`,
        resolve_after: new Date(now.getTime() + 30 * 86_400_000).toISOString(),
      });
    }
    for (let i = 0; i < rows.length; i += 200) {
      const chunk = rows.slice(i, i + 200);
      const { error: insErr } = await supabase.from('predictions').insert(chunk);
      if (insErr) report.errors.push(`insert: ${insErr.message}`);
      else report.inserted += chunk.length;
    }
    log(`radar writer: ${report.inserted} inserted, ${report.skipped} already open, of ${report.candidates} top-decile assets`);
  } catch (e) {
    report.errors.push(e instanceof Error ? e.message : String(e));
    warn('radar writer failed', e);
  }
  return report;
}
