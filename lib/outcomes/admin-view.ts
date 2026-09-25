/**
 * Outcome ledger — admin view helpers (pure).
 *
 * Shapes ledger rows for /admin/outcomes and the public methodology page:
 *
 *   formatQueueRow     — pending 0.5–0.8 match → prediction / candidate deal / evidence
 *   evidenceItems      — match_evidence jsonb → labelled per-component lines
 *   formatLedgerRow    — accepted outcome → predicted vs actual, APE, band, buyer
 *   accuracyGate       — AccuracyWindowSummary → rates, or the "publishes at N" copy
 *
 * Money is in $M throughout (the `deals` embed is USD and converted here).
 * No React, no Supabase: everything is testable with fixtures.
 */

import { formatCurrency } from '@/lib/format';
import { formatMedianError } from './statements';
import type { AccuracyWindowSummary } from './statements';
import { AUTO_RESOLVE_THRESHOLD, MATCH_WEIGHTS, REVIEW_QUEUE_THRESHOLD } from './matcher';
import type { MatchEvidence, MatchedBy, PredictionSource, RollupWindow } from './types';

// ─── selects (shared with app/api/admin/outcomes) ──────────────────────────

export const QUEUE_SELECT = [
  'id', 'prediction_id', 'deal_id', 'match_confidence', 'match_evidence', 'upfront_m', 'total_m', 'licensee_name', 'signed_date', 'deal_type',
  'abs_pct_error_upfront', 'abs_pct_error_total', 'within_band_upfront', 'within_band_total', 'buyer_hit', 'window_hit', 'created_at',
  'predictions(id,source,source_id,user_id,licensor_name,asset_name,indication,therapeutic_area,phase,upfront_low,upfront_mid,upfront_high,total_low,total_mid,total_high,predicted_buyers,predicted_window_start,predicted_window_end,created_at)',
  'deals(id,licensor_name,licensee_name,asset_name,announced_date,phase_at_signing,indication_specific,indication_category,therapeutic_area,upfront_usd,total_deal_value_usd,source_url)',
].join(',');

export const LEDGER_SELECT = [
  'id', 'prediction_id', 'deal_id', 'matched_by', 'match_confidence', 'upfront_m', 'total_m', 'licensee_name', 'signed_date',
  'abs_pct_error_upfront', 'abs_pct_error_total', 'within_band_upfront', 'within_band_total', 'buyer_hit', 'window_hit', 'value_captured_m',
  'first_offer_upfront_m', 'first_offer_total_m', 'our_ask_upfront_m', 'our_ask_total_m', 'resolved_at', 'reviewed_by', 'notes',
  'predictions(id,source,licensor_name,asset_name,indication,therapeutic_area,phase,upfront_low,upfront_mid,upfront_high,total_low,total_mid,total_high,predicted_buyers)',
  'deals(id,licensor_name,licensee_name,announced_date,source_url)',
].join(',');

// ─── row shapes (what the selects above return) ────────────────────────────

export interface QueuePrediction {
  id: string;
  source: PredictionSource;
  source_id: string | null;
  user_id: string | null;
  licensor_name: string | null;
  asset_name: string | null;
  indication: string | null;
  therapeutic_area: string | null;
  phase: string | null;
  upfront_low: number | null;
  upfront_mid: number | null;
  upfront_high: number | null;
  total_low: number | null;
  total_mid: number | null;
  total_high: number | null;
  predicted_buyers: string[] | null;
  predicted_window_start: string | null;
  predicted_window_end: string | null;
  created_at: string;
}

export interface QueueDeal {
  id: string;
  licensor_name: string | null;
  licensee_name: string | null;
  asset_name: string | null;
  announced_date: string | null;
  phase_at_signing: string | null;
  indication_specific: string | null;
  indication_category: string | null;
  therapeutic_area: string | null;
  upfront_usd: number | null;
  total_deal_value_usd: number | null;
  source_url: string | null;
}

export interface QueueRow {
  id: string;
  prediction_id: string;
  deal_id: string | null;
  match_confidence: number | null;
  match_evidence: Record<string, unknown> | null;
  upfront_m: number | null;
  total_m: number | null;
  licensee_name: string | null;
  signed_date: string | null;
  deal_type: string | null;
  abs_pct_error_upfront: number | null;
  abs_pct_error_total: number | null;
  within_band_upfront: boolean | null;
  within_band_total: boolean | null;
  buyer_hit: boolean | null;
  window_hit: boolean | null;
  created_at: string;
  predictions: QueuePrediction | null;
  deals: QueueDeal | null;
}

export interface LedgerPrediction {
  id: string;
  source: PredictionSource;
  licensor_name: string | null;
  asset_name: string | null;
  indication: string | null;
  therapeutic_area: string | null;
  phase: string | null;
  upfront_low: number | null;
  upfront_mid: number | null;
  upfront_high: number | null;
  total_low: number | null;
  total_mid: number | null;
  total_high: number | null;
  predicted_buyers: string[] | null;
}

export interface LedgerRow {
  id: string;
  prediction_id: string;
  deal_id: string | null;
  matched_by: MatchedBy;
  match_confidence: number | null;
  upfront_m: number | null;
  total_m: number | null;
  licensee_name: string | null;
  signed_date: string | null;
  abs_pct_error_upfront: number | null;
  abs_pct_error_total: number | null;
  within_band_upfront: boolean | null;
  within_band_total: boolean | null;
  buyer_hit: boolean | null;
  window_hit: boolean | null;
  value_captured_m: number | null;
  first_offer_upfront_m: number | null;
  first_offer_total_m: number | null;
  our_ask_upfront_m: number | null;
  our_ask_total_m: number | null;
  resolved_at: string | null;
  reviewed_by: string | null;
  notes: string | null;
  predictions: LedgerPrediction | null;
  deals: { id: string; licensor_name: string | null; licensee_name: string | null; announced_date: string | null; source_url: string | null } | null;
}

// ─── labels & primitive formatters ─────────────────────────────────────────

export const SOURCE_LABELS: Record<PredictionSource, string> = {
  calculator: 'Calculator',
  brief: 'Brief',
  radar: 'Radar',
  share: 'Shared calculation',
};

export const MATCHED_BY_LABELS: Record<MatchedBy, string> = {
  auto: 'Resolver',
  manual: 'Reviewed',
  client: 'Client-reported',
};

export const WINDOW_LABELS: Record<RollupWindow, string> = {
  '90d': 'Last 90 days',
  '365d': 'Last 12 months',
  all: 'All time',
};

/** $M in → "$25M"; null / NaN → "—". Uses the canonical formatter. */
export function moneyM(value: number | null | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) return '—';
  return formatCurrency(value);
}

/** USD in → $M string ("—" when unknown). */
export function usdToM(usd: number | null | undefined): number | null {
  if (typeof usd !== 'number' || !Number.isFinite(usd)) return null;
  return usd / 1_000_000;
}

/** Predicted band "low–high (mid)" in $M; "—" when nothing was predicted. */
export function formatBand(low: number | null, mid: number | null, high: number | null): string {
  const hasLow = typeof low === 'number';
  const hasHigh = typeof high === 'number';
  const hasMid = typeof mid === 'number';
  if (hasLow && hasHigh) return `${moneyM(low)}–${moneyM(high)}${hasMid ? ` (mid ${moneyM(mid)})` : ''}`;
  if (hasMid) return moneyM(mid);
  if (hasLow) return `≥ ${moneyM(low)}`;
  if (hasHigh) return `≤ ${moneyM(high)}`;
  return '—';
}

/** ISO timestamp / date → YYYY-MM-DD; "—" when missing. */
export function dateOnly(iso: string | null | undefined): string {
  if (!iso || iso.length < 10 || !Number.isFinite(Date.parse(iso))) return '—';
  return iso.slice(0, 10);
}

/** "https://www.sec.gov/Archives/…" → "sec.gov"; null when unparsable. */
export function sourceHost(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host.replace(/^www\./, '') || null;
  } catch {
    return null;
  }
}

/** 0.234 → "±23%"; null → "—". */
export function apeText(ape: number | null | undefined): string {
  return formatMedianError(ape) ?? '—';
}

/** true → "yes", false → "no", null → "—". */
export function boolText(value: boolean | null | undefined): string {
  if (value === true) return 'yes';
  if (value === false) return 'no';
  return '—';
}

export type ScoreTone = 'high' | 'mid' | 'low';

/** Match score → 2-dp string and a tone for the review queue badge. */
export function formatScore(score: number | null | undefined): { text: string; tone: ScoreTone } {
  if (typeof score !== 'number' || !Number.isFinite(score)) return { text: '—', tone: 'low' };
  const tone: ScoreTone = score >= AUTO_RESOLVE_THRESHOLD ? 'high' : score >= (AUTO_RESOLVE_THRESHOLD + REVIEW_QUEUE_THRESHOLD) / 2 ? 'mid' : 'low';
  return { text: score.toFixed(2), tone };
}

// ─── match evidence ────────────────────────────────────────────────────────

export interface EvidenceItem {
  /** Component name: Licensor / Indication / Phase / Timing / Asset. */
  label: string;
  /** What matched, in words. */
  value: string;
  /** "0.85 × 0.45" — component score × weight; "" for evidence-only items. */
  weight: string;
  /** true = supports the match, false = against, null = neutral / unknown. */
  ok: boolean | null;
}

const IDENTITY_TEXT: Record<MatchEvidence['identity'], string> = {
  company_id: 'same company id',
  name: 'same normalised name',
  alias: 'known name variation',
  asset: 'asset name only',
  fuzzy: 'fuzzy name match',
  none: 'no licensor match',
};

const INDICATION_TEXT: Record<MatchEvidence['indication'], string> = {
  indication: 'same indication',
  ta: 'same therapeutic area',
  none: 'no indication overlap',
};

function num(v: unknown): number | null {
  return typeof v === 'number' && Number.isFinite(v) ? v : null;
}

function str(v: unknown): string | null {
  return typeof v === 'string' && v.trim() ? v : null;
}

function w(score: number | null, weight: number): string {
  return score == null ? '' : `${score.toFixed(2)} × ${weight.toFixed(2)}`;
}

/**
 * Renders the resolver's match_evidence jsonb as labelled lines. Tolerates
 * partial or foreign shapes (client-reported rows carry none).
 */
export function evidenceItems(raw: Record<string, unknown> | null | undefined): EvidenceItem[] {
  if (!raw || typeof raw !== 'object') return [];
  const e = raw as Partial<Record<keyof MatchEvidence, unknown>>;
  const items: EvidenceItem[] = [];

  const identity = str(e.identity) as MatchEvidence['identity'] | null;
  if (identity && identity in IDENTITY_TEXT) {
    const from = str(e.predictionLicensor);
    const to = str(e.dealLicensor);
    const pair = from || to ? ` (${from ?? '?'} → ${to ?? '?'})` : '';
    items.push({ label: 'Licensor', value: `${IDENTITY_TEXT[identity]}${pair}`, weight: w(num(e.identityScore), MATCH_WEIGHTS.identity), ok: identity !== 'none' });
  }

  const indication = str(e.indication) as MatchEvidence['indication'] | null;
  if (indication && indication in INDICATION_TEXT) {
    const weight = indication === 'indication' ? MATCH_WEIGHTS.indication : indication === 'ta' ? MATCH_WEIGHTS.taOnly : MATCH_WEIGHTS.indication;
    items.push({ label: 'Indication', value: INDICATION_TEXT[indication], weight: w(num(e.indicationScore), weight), ok: indication !== 'none' });
  }

  if ('phaseSteps' in e || 'phaseScore' in e) {
    const steps = num(e.phaseSteps);
    const value = steps == null ? 'phase unknown on one side' : steps === 0 ? 'same phase' : steps === 1 ? 'one phase step apart' : `${steps} phase steps apart`;
    const weight = steps == null ? MATCH_WEIGHTS.phaseUnknown : steps === 0 ? MATCH_WEIGHTS.phaseExact : MATCH_WEIGHTS.phaseOneStep;
    items.push({ label: 'Phase', value, weight: w(num(e.phaseScore), weight), ok: steps == null ? null : steps <= 1 });
  }

  if (typeof e.afterResolveAfter === 'boolean') {
    items.push({
      label: 'Timing',
      value: e.afterResolveAfter ? 'announced after the resolve-after date' : 'announced before the resolve-after date',
      weight: w(num(e.gateScore), MATCH_WEIGHTS.resolveAfterGate),
      ok: e.afterResolveAfter,
    });
  }

  if (e.assetNameMatch === true) {
    items.push({ label: 'Asset', value: 'asset name matches (evidence only)', weight: '', ok: true });
  }

  return items;
}

// ─── review queue ──────────────────────────────────────────────────────────

export interface QueueView {
  id: string;
  predictionId: string;
  dealId: string | null;
  score: { text: string; tone: ScoreTone };
  evidence: EvidenceItem[];
  prediction: {
    source: PredictionSource | null;
    sourceLabel: string;
    licensor: string;
    asset: string | null;
    indication: string;
    therapeuticArea: string | null;
    phase: string;
    upfrontBand: string;
    totalBand: string;
    buyers: string[];
    window: string | null;
    createdAt: string;
  };
  deal: {
    parties: string;
    licensor: string;
    licensee: string;
    asset: string | null;
    date: string;
    phase: string;
    indication: string | null;
    dealType: string | null;
    upfront: string;
    total: string;
    sourceUrl: string | null;
    sourceHost: string | null;
  };
  metrics: {
    apeUpfront: string;
    apeTotal: string;
    withinBandUpfront: string;
    withinBandTotal: string;
    buyerHit: string;
  };
}

export function formatQueueRow(row: QueueRow): QueueView {
  const p = row.predictions;
  const d = row.deals;
  const window = p?.predicted_window_start || p?.predicted_window_end
    ? `${dateOnly(p?.predicted_window_start)} → ${dateOnly(p?.predicted_window_end)}`
    : null;
  const licensor = d?.licensor_name ?? '?';
  const licensee = d?.licensee_name ?? row.licensee_name ?? '?';
  return {
    id: row.id,
    predictionId: row.prediction_id,
    dealId: row.deal_id,
    score: formatScore(row.match_confidence),
    evidence: evidenceItems(row.match_evidence),
    prediction: {
      source: p?.source ?? null,
      sourceLabel: p ? SOURCE_LABELS[p.source] ?? p.source : '—',
      licensor: p?.licensor_name ?? '—',
      asset: p?.asset_name ?? null,
      indication: p?.indication ?? p?.therapeutic_area ?? '—',
      therapeuticArea: p?.therapeutic_area ?? null,
      phase: p?.phase ?? '—',
      upfrontBand: formatBand(p?.upfront_low ?? null, p?.upfront_mid ?? null, p?.upfront_high ?? null),
      totalBand: formatBand(p?.total_low ?? null, p?.total_mid ?? null, p?.total_high ?? null),
      buyers: p?.predicted_buyers ?? [],
      window,
      createdAt: dateOnly(p?.created_at),
    },
    deal: {
      parties: `${licensor} → ${licensee}`,
      licensor,
      licensee,
      asset: d?.asset_name ?? null,
      date: dateOnly(d?.announced_date ?? row.signed_date),
      phase: d?.phase_at_signing ?? '—',
      indication: d?.indication_specific ?? d?.indication_category ?? d?.therapeutic_area ?? null,
      dealType: row.deal_type,
      upfront: moneyM(row.upfront_m ?? usdToM(d?.upfront_usd)),
      total: moneyM(row.total_m ?? usdToM(d?.total_deal_value_usd)),
      sourceUrl: d?.source_url ?? null,
      sourceHost: sourceHost(d?.source_url),
    },
    metrics: {
      apeUpfront: apeText(row.abs_pct_error_upfront),
      apeTotal: apeText(row.abs_pct_error_total),
      withinBandUpfront: boolText(row.within_band_upfront),
      withinBandTotal: boolText(row.within_band_total),
      buyerHit: boolText(row.buyer_hit),
    },
  };
}

// ─── resolved ledger ───────────────────────────────────────────────────────

export interface LedgerView {
  id: string;
  resolvedAt: string;
  sourceLabel: string;
  matchedBy: MatchedBy;
  matchedByLabel: string;
  confidence: string;
  licensor: string;
  licensee: string;
  asset: string | null;
  indication: string;
  phase: string;
  signedDate: string;
  predictedUpfront: string;
  actualUpfront: string;
  predictedTotal: string;
  actualTotal: string;
  apeUpfront: string;
  apeTotal: string;
  withinBandUpfront: string;
  withinBandTotal: string;
  buyerHit: string;
  windowHit: string;
  /** Present only for client-reported rows. */
  client: { firstOfferUpfront: string; firstOfferTotal: string; ourAskUpfront: string; ourAskTotal: string; valueCaptured: string } | null;
  sourceUrl: string | null;
  sourceHost: string | null;
  reviewedBy: string | null;
  notes: string | null;
}

export function formatLedgerRow(row: LedgerRow): LedgerView {
  const p = row.predictions;
  const d = row.deals;
  const isClient = row.matched_by === 'client';
  return {
    id: row.id,
    resolvedAt: dateOnly(row.resolved_at),
    sourceLabel: p ? SOURCE_LABELS[p.source] ?? p.source : '—',
    matchedBy: row.matched_by,
    matchedByLabel: MATCHED_BY_LABELS[row.matched_by] ?? row.matched_by,
    confidence: typeof row.match_confidence === 'number' ? row.match_confidence.toFixed(2) : '—',
    licensor: p?.licensor_name ?? d?.licensor_name ?? '—',
    licensee: row.licensee_name ?? d?.licensee_name ?? '—',
    asset: p?.asset_name ?? null,
    indication: p?.indication ?? p?.therapeutic_area ?? '—',
    phase: p?.phase ?? '—',
    signedDate: dateOnly(row.signed_date ?? d?.announced_date),
    predictedUpfront: formatBand(p?.upfront_low ?? null, p?.upfront_mid ?? null, p?.upfront_high ?? null),
    actualUpfront: moneyM(row.upfront_m),
    predictedTotal: formatBand(p?.total_low ?? null, p?.total_mid ?? null, p?.total_high ?? null),
    actualTotal: moneyM(row.total_m),
    apeUpfront: apeText(row.abs_pct_error_upfront),
    apeTotal: apeText(row.abs_pct_error_total),
    withinBandUpfront: boolText(row.within_band_upfront),
    withinBandTotal: boolText(row.within_band_total),
    buyerHit: boolText(row.buyer_hit),
    windowHit: boolText(row.window_hit),
    client: isClient
      ? {
          firstOfferUpfront: moneyM(row.first_offer_upfront_m),
          firstOfferTotal: moneyM(row.first_offer_total_m),
          ourAskUpfront: moneyM(row.our_ask_upfront_m),
          ourAskTotal: moneyM(row.our_ask_total_m),
          valueCaptured: moneyM(row.value_captured_m),
        }
      : null,
    sourceUrl: d?.source_url ?? null,
    sourceHost: sourceHost(d?.source_url),
    reviewedBy: row.reviewed_by,
    notes: row.notes,
  };
}

// ─── accuracy gating ───────────────────────────────────────────────────────

export interface AccuracyCells {
  /** "12" — always printed. */
  n: string;
  /** "3 expired" or null. */
  expired: string | null;
  /** True when the rates below are printed; false when only the copy is. */
  meaningful: boolean;
  /** "4 resolved so far; figures publish at 10" when not meaningful, else null. */
  copy: string | null;
  medianErrorUpfront: string;
  medianErrorTotal: string;
  withinBandUpfront: string;
  withinBandTotal: string;
  buyerHitRate: string;
  windowHitRate: string;
  /** Sum of client-reported value captured, $M; "—" when zero. Printed regardless of n: it is a total, not an estimate. */
  valueCaptured: string;
}

/** Copy printed in place of the rates when a cell is below the threshold. */
export function belowThresholdCopy(n: number, minN: number): string {
  return `${n} resolved so far; figures publish at ${minN}`;
}

/**
 * Turns one window summary into the strings a table prints. Below `minN`
 * every rate is "—" and `copy` carries the honest sentence; the summary's
 * own `meaningful` flag is the source of truth (statements.ts sets it).
 */
export function accuracyGate(win: AccuracyWindowSummary, minN: number): AccuracyCells {
  const meaningful = win.meaningful && win.n >= minN;
  const dash = '—';
  return {
    n: String(win.n),
    expired: win.nExpired > 0 ? `${win.nExpired} expired` : null,
    meaningful,
    copy: meaningful ? null : belowThresholdCopy(win.n, minN),
    medianErrorUpfront: meaningful ? win.medianErrorUpfront ?? dash : dash,
    medianErrorTotal: meaningful ? win.medianErrorTotal ?? dash : dash,
    withinBandUpfront: meaningful ? win.withinBandUpfront ?? dash : dash,
    withinBandTotal: meaningful ? win.withinBandTotal ?? dash : dash,
    buyerHitRate: meaningful ? win.buyerHitRate ?? dash : dash,
    windowHitRate: meaningful ? win.windowHitRate ?? dash : dash,
    valueCaptured: win.valueCapturedM ? moneyM(win.valueCapturedM) : dash,
  };
}
