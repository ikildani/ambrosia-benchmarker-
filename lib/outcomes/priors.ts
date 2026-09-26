/**
 * Outcome-informed priors (Alaric outcomes program, test 6: "compounds
 * across participants").
 *
 * A client's reported signed terms — an accepted `outcomes` row with
 * matched_by = 'client' and no deal_id — is evidence the public deal set does
 * not have. Two priors read it back:
 *
 *   baselines  — `observationsToDealRows` maps the observations to the row
 *                shape `runBenchmarkCalibration` groups; the weekly cron
 *                passes them as `extraObservations` (k-anonymity guards live
 *                in lib/ingestion/benchmark-calibration.ts).
 *   premiums   — `blendBuyerPremiums` folds each buyer's client outcomes into
 *                its counterparty_premiums row: premium = signed total ÷ the
 *                public peer median (never ÷ our ask — the ask is
 *                max(headline, comps p50), so actual ÷ ask is a biased
 *                residual), recency-weighted, blended against the existing
 *                sample and clamped to [0.7, 1.5]. `refreshOutcomePriors`
 *                runs it nightly and writes a new row only when something
 *                changed, so the 02:00 / 02:20 / 02:40 runs are idempotent.
 *
 * Outcomes linked to a deal are already in `deals`; they are never counted
 * here (deal_id IS NULL, and a client row whose prediction also has an
 * accepted deal-linked outcome is dropped).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import {
  DEFAULT_OPTIONS as PREMIUM_OPTIONS,
  confidenceFromN,
  findPeerMedian,
  type DealRow as PremiumDealRow,
} from '@/lib/financial/counterparty-premiums';
import { recencyWeight } from '@/lib/financial/calibration';
import { normalizePhase } from '@/lib/brief/comp-set';
import { OBSERVATION_ID_PREFIX, type DealRow as CalibrationDealRow } from '@/lib/ingestion/benchmark-calibration';
import { aliasSet, expandAliases } from './matcher';
import type { CompanyAlias } from './types';

// ─── Types ─────────────────────────────────────────────────────────────────

/** One accepted client-reported outcome joined to its prediction. */
export interface ClientObservation {
  outcomeId: string;
  predictionId: string;
  /** Engine TA key from the prediction (oncology, neurology, …). */
  therapeuticArea: string | null;
  /** Engine phase key from the prediction (phase_2, …). */
  phase: string | null;
  modality: string | null;
  licensorName: string | null;
  assetName: string | null;
  indication: string | null;
  /** $M */
  upfrontM: number | null;
  totalM: number | null;
  royaltyLow: number | null;
  royaltyHigh: number | null;
  licenseeName: string | null;
  licenseeId: string | null;
  /** YYYY-MM-DD */
  signedDate: string | null;
  dealType: string | null;
  resolvedAt: string | null;
}

/**
 * The `deals`-shaped row an observation becomes for the baseline calibration.
 * The id is prefixed `outcome_` and must never be written to
 * benchmark_calibrations.deal_ids (computePhaseBaselines enforces it).
 */
export interface ObservationDealRow extends CalibrationDealRow {
  id: string;
  announced_date: string | null;
  verification_status: 'verified';
  confidence_score: 90;
  is_synthetic: false;
  is_canonical: true;
  licensee_id: string | null;
  licensee_name: string | null;
  indication_category: null;
}

/** counterparty_premiums row (read and written). */
export interface PremiumRow {
  id?: string;
  company_id: string;
  company_name: string;
  premium_multiplier: number;
  sample_size: number;
  confidence: string;
  by_therapeutic_area?: Record<string, { premium: number; n: number }> | null;
  by_phase?: Record<string, { premium: number; n: number }> | null;
  calculation_notes?: string | null;
  as_of_date: string;
}

export type PremiumUpsertRow = Omit<PremiumRow, 'id'> & { confidence: 'high' | 'medium' | 'low' };

export interface BlendReport {
  /** Rows to upsert (one per buyer whose premium changed). */
  rows: PremiumUpsertRow[];
  buyersTouched: number;
  observationsUsed: number;
  notes: string[];
}

export interface PriorsRunOptions {
  now?: Date;
  dryRun?: boolean;
  /** Only observations resolved on/after this ISO timestamp. */
  since?: string;
}

export interface PriorsRunReport {
  observations: number;
  buyersTouched: number;
  /** Baseline cells are touched by the weekly benchmark-calibration cron, not here. */
  cellsTouched: number;
  notes: string[];
  errors: string[];
  dryRun: boolean;
  ms: number;
}

/** Minimum client outcomes per buyer before its premium is blended. */
export const MIN_OBSERVATIONS_PER_BUYER = 2;
export const PREMIUM_CLAMP: [number, number] = [0.7, 1.5];
/** Marker the blended rows carry in calculation_notes (used to find the un-blended base row). */
export const BLEND_NOTE_RE = /\bblended \d+ client outcomes? on \d{4}-\d{2}-\d{2}/;

// ─── Helpers ───────────────────────────────────────────────────────────────

function num(v: unknown): number | null {
  const n = typeof v === 'string' ? Number(v) : v;
  return typeof n === 'number' && Number.isFinite(n) ? n : null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v.trim() : null;
}

function clamp(value: number, [lo, hi]: [number, number]): number {
  return Math.max(lo, Math.min(hi, value));
}

function round3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

/** Deals-table phase spelling (`phase_2`) — the key PHASE_MAP and normalizePhaseForDB accept — or null. */
export function observationPhase(phase: string | null | undefined): string | null {
  const p = normalizePhase(phase);
  return p === 'unknown' ? null : p;
}

export function observationYear(o: Pick<ClientObservation, 'signedDate' | 'resolvedAt'>, now: Date): number {
  const from = o.signedDate ?? o.resolvedAt;
  const ms = from ? Date.parse(from) : NaN;
  return Number.isFinite(ms) ? new Date(ms).getUTCFullYear() : now.getUTCFullYear();
}

export function isBlendedRow(row: Pick<PremiumRow, 'calculation_notes'>): boolean {
  return BLEND_NOTE_RE.test(row.calculation_notes ?? '');
}

/**
 * The buyer's companies.id for an observation: the stored licensee_id, else
 * the company whose name / name_variations include the reported licensee
 * name (through expandAliases, so "Eli Lilly and Company" → Eli Lilly).
 */
export function resolveBuyerId(o: Pick<ClientObservation, 'licenseeName' | 'licenseeId'>, companies: CompanyAlias[]): string | null {
  if (o.licenseeId) return o.licenseeId;
  if (!o.licenseeName) return null;
  const names = expandAliases(o.licenseeName, null, companies);
  if (!names.size) return null;
  const match = companies.find((c) => { for (const a of aliasSet(c)) if (names.has(a)) return true; return false; });
  return match?.id ?? null;
}

// ─── Loader ────────────────────────────────────────────────────────────────

interface OutcomeJoinRow {
  id: string;
  prediction_id: string;
  upfront_m: number | string | null;
  total_m: number | string | null;
  royalty_low: number | string | null;
  royalty_high: number | string | null;
  licensee_name: string | null;
  licensee_id: string | null;
  signed_date: string | null;
  deal_type: string | null;
  resolved_at: string | null;
  prediction: {
    id: string;
    therapeutic_area: string | null;
    phase: string | null;
    modality: string | null;
    licensor_name: string | null;
    asset_name: string | null;
    indication: string | null;
  } | Array<{
    id: string;
    therapeutic_area: string | null;
    phase: string | null;
    modality: string | null;
    licensor_name: string | null;
    asset_name: string | null;
    indication: string | null;
  }> | null;
}

export const OBSERVATION_COLUMNS =
  'id,prediction_id,upfront_m,total_m,royalty_low,royalty_high,licensee_name,licensee_id,signed_date,deal_type,resolved_at,' +
  'prediction:predictions(id,therapeutic_area,phase,modality,licensor_name,asset_name,indication)';

/**
 * Accepted client-reported outcomes with no deal row, joined to their
 * prediction. Never counts an outcome twice: predictions that also carry an
 * accepted deal-linked outcome are excluded (that deal is already in `deals`).
 */
export async function loadClientObservations(supabase: SupabaseClient, opts: { since?: string } = {}): Promise<ClientObservation[]> {
  let q = supabase
    .from('outcomes')
    .select(OBSERVATION_COLUMNS)
    .eq('matched_by', 'client')
    .eq('status', 'accepted')
    .is('deal_id', null)
    .order('resolved_at', { ascending: false })
    .limit(2000);
  if (opts.since) q = q.gte('resolved_at', opts.since);
  const { data, error } = await q;
  if (error) throw new Error(`outcomes: ${error.message}`);
  const rows = (data ?? []) as unknown as OutcomeJoinRow[];
  if (!rows.length) return [];

  const predictionIds = [...new Set(rows.map((r) => r.prediction_id))];
  const { data: linked, error: linkedErr } = await supabase
    .from('outcomes')
    .select('prediction_id')
    .in('prediction_id', predictionIds)
    .eq('status', 'accepted')
    .not('deal_id', 'is', null);
  if (linkedErr) throw new Error(`linked outcomes: ${linkedErr.message}`);
  const hasDeal = new Set(((linked ?? []) as Array<{ prediction_id: string }>).map((r) => r.prediction_id));

  const out: ClientObservation[] = [];
  for (const r of rows) {
    if (hasDeal.has(r.prediction_id)) continue;
    const p = Array.isArray(r.prediction) ? r.prediction[0] ?? null : r.prediction;
    out.push({
      outcomeId: r.id,
      predictionId: r.prediction_id,
      therapeuticArea: str(p?.therapeutic_area),
      phase: str(p?.phase),
      modality: str(p?.modality),
      licensorName: str(p?.licensor_name),
      assetName: str(p?.asset_name),
      indication: str(p?.indication),
      upfrontM: num(r.upfront_m),
      totalM: num(r.total_m),
      royaltyLow: num(r.royalty_low),
      royaltyHigh: num(r.royalty_high),
      licenseeName: str(r.licensee_name),
      licenseeId: str(r.licensee_id),
      signedDate: str(r.signed_date),
      dealType: str(r.deal_type),
      resolvedAt: str(r.resolved_at),
    });
  }
  return out;
}

// ─── Baselines: observation → deal row ─────────────────────────────────────

/**
 * Map observations to the row shape `runBenchmarkCalibration` groups on
 * ($M → USD, engine phase → deals phase). Rows without a TA or a mappable
 * phase are dropped by the calibration itself.
 */
export function observationsToDealRows(observations: ClientObservation[]): ObservationDealRow[] {
  const rows: ObservationDealRow[] = [];
  for (const o of observations) {
    if (o.upfrontM == null && o.totalM == null && o.royaltyLow == null && o.royaltyHigh == null) continue;
    rows.push({
      id: `${OBSERVATION_ID_PREFIX}${o.outcomeId}`,
      upfront_usd: o.upfrontM != null ? o.upfrontM * 1e6 : null,
      total_deal_value_usd: o.totalM != null ? o.totalM * 1e6 : null,
      royalty_low_pct: o.royaltyLow,
      royalty_high_pct: o.royaltyHigh,
      phase_at_signing: observationPhase(o.phase),
      therapeutic_area: o.therapeuticArea,
      modality: o.modality,
      announced_date: o.signedDate ?? (o.resolvedAt ? o.resolvedAt.slice(0, 10) : null),
      verification_status: 'verified',
      confidence_score: 90,
      is_synthetic: false,
      is_canonical: true,
      licensee_id: o.licenseeId,
      licensee_name: o.licenseeName,
      indication_category: null,
    });
  }
  return rows;
}

// ─── Premiums: blend ───────────────────────────────────────────────────────

/**
 * Pure. For each buyer with ≥ MIN_OBSERVATIONS_PER_BUYER client outcomes:
 *   premium_i = signed total ÷ findPeerMedian(public deals, same TA ± 1 phase)
 *   w_i       = recencyWeight(signed year, now's year)
 *   new       = clamp((n·old + Σ w_i·p_i) / (n + Σ w_i), 0.7, 1.5)
 *   n'        = n + k, confidence = confidenceFromN(n')
 * where (old, n) come from the buyer's newest UN-blended counterparty_premiums
 * row, so re-running on the same observations reproduces the same row (and
 * nothing is written). Buyers without a base row are skipped: two client
 * reports are not enough to create a premium from nothing.
 */
export function blendBuyerPremiums(
  existingRows: PremiumRow[],
  observations: ClientObservation[],
  companies: CompanyAlias[],
  now: Date,
  publicDeals: PremiumDealRow[],
): BlendReport {
  const today = now.toISOString().slice(0, 10);
  const year = now.getUTCFullYear();
  const notes: string[] = [];
  const rows: PremiumUpsertRow[] = [];
  let observationsUsed = 0;

  const byBuyer = new Map<string, ClientObservation[]>();
  let unresolved = 0;
  for (const o of observations) {
    const id = resolveBuyerId(o, companies);
    if (!id) { unresolved++; continue; }
    const list = byBuyer.get(id) ?? [];
    list.push(o);
    byBuyer.set(id, list);
  }
  if (unresolved) notes.push(`${unresolved} observation${unresolved === 1 ? '' : 's'} without a resolvable buyer`);

  const newest = (list: PremiumRow[]) => [...list].sort((a, b) => b.as_of_date.localeCompare(a.as_of_date))[0] ?? null;

  for (const [buyerId, obs] of byBuyer) {
    if (obs.length < MIN_OBSERVATIONS_PER_BUYER) {
      notes.push(`${buyerId}: ${obs.length} observation (need ${MIN_OBSERVATIONS_PER_BUYER})`);
      continue;
    }
    const buyerRows = existingRows.filter((r) => r.company_id === buyerId);
    const base = newest(buyerRows.filter((r) => !isBlendedRow(r)));
    const latest = newest(buyerRows);
    if (!base) {
      notes.push(`${buyerId}: no counterparty_premiums base row — skipped`);
      continue;
    }

    let sumW = 0;
    let sumWP = 0;
    let used = 0;
    for (const o of obs) {
      const total = o.totalM != null && o.totalM > 0 ? o.totalM * 1e6 : null;
      if (total == null) continue;
      const target: PremiumDealRow = {
        id: `${OBSERVATION_ID_PREFIX}${o.outcomeId}`,
        licensee_id: buyerId,
        licensee_name: o.licenseeName,
        indication_category: null,
        phase_at_signing: observationPhase(o.phase),
        total_deal_value_usd: total,
        therapeutic_area: o.therapeuticArea,
      };
      const peer = findPeerMedian(target, publicDeals, PREMIUM_OPTIONS);
      if (peer == null || peer <= 0) continue;
      const premium = total / peer;
      if (!Number.isFinite(premium) || premium <= 0 || premium > 5) continue;
      const w = recencyWeight(observationYear(o, now), year);
      sumW += w;
      sumWP += w * premium;
      used++;
    }
    if (used < MIN_OBSERVATIONS_PER_BUYER) {
      notes.push(`${base.company_name}: ${used} of ${obs.length} observations had a peer median (need ${MIN_OBSERVATIONS_PER_BUYER})`);
      continue;
    }

    const n = Math.max(0, Number(base.sample_size) || 0);
    const old = Number(base.premium_multiplier);
    const blended = round3(clamp((n * old + sumWP) / (n + sumW), PREMIUM_CLAMP));
    const newN = n + used;
    const confidence = confidenceFromN(newN);

    if (latest && isBlendedRow(latest) && Math.abs(Number(latest.premium_multiplier) - blended) < 0.0005 && Number(latest.sample_size) === newN) {
      notes.push(`${base.company_name}: unchanged (${blended} from ${used} client outcomes)`);
      continue;
    }

    observationsUsed += used;
    rows.push({
      company_id: buyerId,
      company_name: base.company_name,
      premium_multiplier: blended,
      sample_size: newN,
      confidence,
      by_therapeutic_area: base.by_therapeutic_area ?? {},
      by_phase: base.by_phase ?? {},
      calculation_notes:
        `blended ${used} client outcomes on ${today}: base ${base.as_of_date} ${old.toFixed(3)} × n=${n}, ` +
        `client weighted premium ${(sumWP / sumW).toFixed(3)} (Σw=${sumW.toFixed(2)}), clamped to [${PREMIUM_CLAMP[0]}, ${PREMIUM_CLAMP[1]}].`,
      as_of_date: today,
    });
    notes.push(`${base.company_name}: ${old.toFixed(3)} → ${blended} (${used} client outcomes, n ${n} → ${newN})`);
  }

  return { rows, buyersTouched: rows.length, observationsUsed, notes };
}

// ─── Runner ────────────────────────────────────────────────────────────────

const orValue = (s: string) => `"${s.replace(/[",()]/g, ' ').trim()}"`;

/**
 * Nightly: load the client observations, blend the buyer premiums, write the
 * changed rows and one outcome_prior_runs row (when anything changed).
 * Baselines are refreshed weekly by /api/cron/benchmark-calibration, which
 * passes the same observations. Never throws.
 */
export async function refreshOutcomePriors(supabase: SupabaseClient, opts: PriorsRunOptions = {}): Promise<PriorsRunReport> {
  const started = Date.now();
  const now = opts.now ?? new Date();
  const dryRun = opts.dryRun === true;
  const report: PriorsRunReport = { observations: 0, buyersTouched: 0, cellsTouched: 0, notes: [], errors: [], dryRun, ms: 0 };
  try {
    const observations = await loadClientObservations(supabase, { since: opts.since });
    report.observations = observations.length;
    if (!observations.length) return report;

    // Companies for name → id resolution (ids already stored plus name/alias hits).
    const ids = [...new Set(observations.map((o) => o.licenseeId).filter((x): x is string => !!x))];
    const names = [...new Set(observations.filter((o) => !o.licenseeId && o.licenseeName).map((o) => o.licenseeName as string))];
    let companies: CompanyAlias[] = [];
    if (ids.length || names.length) {
      const filters = [
        ...(ids.length ? [`id.in.(${ids.join(',')})`] : []),
        ...names.flatMap((n) => [`name.ilike.${orValue(n)}`, `name_variations.cs.{${orValue(n)}}`]),
      ];
      const { data, error } = await supabase.from('companies').select('id,name,name_variations').or(filters.join(',')).limit(200);
      if (error) throw new Error(`companies: ${error.message}`);
      companies = (data ?? []) as CompanyAlias[];
    }

    // Candidate buyers: ≥ MIN_OBSERVATIONS_PER_BUYER observations.
    const counts = new Map<string, number>();
    for (const o of observations) {
      const id = resolveBuyerId(o, companies);
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1);
    }
    const candidates = [...counts.entries()].filter(([, n]) => n >= MIN_OBSERVATIONS_PER_BUYER).map(([id]) => id);
    if (!candidates.length) {
      report.notes.push(`no buyer has ${MIN_OBSERVATIONS_PER_BUYER}+ client outcomes`);
      return report;
    }

    const { data: premiumData, error: premiumErr } = await supabase
      .from('counterparty_premiums')
      .select('id,company_id,company_name,premium_multiplier,sample_size,confidence,by_therapeutic_area,by_phase,calculation_notes,as_of_date')
      .in('company_id', candidates)
      .order('as_of_date', { ascending: false });
    if (premiumErr) throw new Error(`counterparty_premiums: ${premiumErr.message}`);
    const existing = (premiumData ?? []) as PremiumRow[];

    // Public deals for the peer medians — the same pool the quarterly cron uses.
    const { data: dealData, error: dealErr } = await supabase
      .from('deals')
      .select('id, licensee_id, licensee_name, indication_category, indication_specific, phase_at_signing, total_deal_value_usd, upfront_usd, modality, therapeutic_area')
      .eq('is_synthetic', false)
      .not('verification_status', 'in', '("rejected","flagged")')
      .not('total_deal_value_usd', 'is', null)
      .not('licensee_id', 'is', null)
      .limit(5000);
    if (dealErr) throw new Error(`deals: ${dealErr.message}`);
    const publicDeals = (dealData ?? []) as PremiumDealRow[];

    const blend = blendBuyerPremiums(existing, observations, companies, now, publicDeals);
    report.notes.push(...blend.notes);
    report.buyersTouched = blend.buyersTouched;

    if (blend.rows.length && !dryRun) {
      const { error: upsertErr } = await supabase
        .from('counterparty_premiums')
        .upsert(blend.rows, { onConflict: 'company_id,as_of_date' });
      if (upsertErr) throw new Error(`upsert counterparty_premiums: ${upsertErr.message}`);

      const { error: auditErr } = await supabase.from('outcome_prior_runs').insert({
        ran_at: now.toISOString(),
        observations_used: blend.observationsUsed,
        cells_touched: 0,
        buyers_touched: blend.buyersTouched,
        notes: ['nightly buyer premium blend', ...blend.notes].join('\n'),
      });
      if (auditErr) report.errors.push(`outcome_prior_runs: ${auditErr.message}`);
    }
  } catch (e) {
    report.errors.push(e instanceof Error ? e.message : String(e));
  }
  report.ms = Date.now() - started;
  console.log(
    `[Outcomes] priors: observations=${report.observations} buyers=${report.buyersTouched}${dryRun ? ' (dry run)' : ''} | ${report.ms}ms` +
    (report.errors.length ? ` | errors=${report.errors.length}: ${report.errors.slice(0, 3).join('; ')}` : ''),
  );
  return report;
}
