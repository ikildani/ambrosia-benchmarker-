/**
 * Search & Evaluation scoring v3 — labels (pure).
 *
 * Positive: a canonical, non-rejected, non-synthetic deal in `deals` where
 *   (a) the licensor resolves to the asset's company — licensor_id equals
 *       company_id, or the licensor name equals the company name or one of
 *       its name_variations after legal-suffix normalisation (sameCompany from
 *       lib/radar/partnership.ts; never substring),
 *   (b) the deal's asset_name matches the asset (matchAssetName: exact,
 *       code-token or ≥80 % word overlap; short names never substring-match),
 *   (c) deal_type ∈ {license, option, acquisition, co_development}, and
 *   (d) announced_date ∈ (as_of, as_of + 12 months].
 *
 * Negative: an asset that existed at as_of (a trial posted on or before it),
 * had no matching deal announced on or before as_of (i.e. unpartnered by the
 * deals record), and no positive in the window.
 *
 * Censoring: snapshots whose 12-month window runs past the label horizon
 * (the newest announced_date the deals table can be trusted to cover) are
 * excluded rather than labelled negative.
 *
 * Leakage: labels only look at announced_date; features only look at rows
 * dated <= as_of (features.ts). Nothing in this module reads a feature.
 */

import { matchAssetName, sameCompany, isEligibleDeal, type PartnershipDeal, type NameMatchKind } from '@/lib/radar/partnership';

export const LABEL_WINDOW_MONTHS = 12;
export const POSITIVE_DEAL_TYPES: ReadonlySet<string> = new Set(['license', 'option', 'acquisition', 'co_development']);
export const SNAPSHOT_FROM = '2022-01-01';
export const SNAPSHOT_TO = '2025-09-01';

export interface LabelDeal extends Pick<PartnershipDeal, 'id' | 'licensor_id' | 'licensor_name' | 'asset_name' | 'deal_type' | 'verification_status' | 'is_synthetic' | 'is_canonical'> {
  announced_date: string | null;
  source_url?: string | null;
}

export interface LabelAsset {
  id: string;
  company_id: string | null;
  company_name: string;
  company_name_variations?: string[] | null;
  asset_name: string;
  asset_aliases?: string[] | null;
}

export interface LabelEvent {
  asset_id: string;
  deal_id: string;
  announced_date: string;
  deal_type: string | null;
  match_kind: NameMatchKind;
  licensor_match: 'id' | 'name';
}

export interface SnapshotLabel {
  label: 0 | 1;
  /** The earliest qualifying deal in the window, when label = 1. */
  deal_id: string | null;
  deal_date: string | null;
  /** False when the asset was already partnered at as_of (a matching deal announced on or before it). */
  unpartnered_at_asof: boolean;
  /** False when the window extends past the label horizon. */
  observable: boolean;
}

/** First day of each month from `from` to `to` inclusive (both 'YYYY-MM-DD' or 'YYYY-MM'). */
export function monthlySnapshotDates(from = SNAPSHOT_FROM, to = SNAPSHOT_TO): string[] {
  const [fy, fm] = from.slice(0, 7).split('-').map(Number);
  const [ty, tm] = to.slice(0, 7).split('-').map(Number);
  const out: string[] = [];
  let y = fy;
  let m = fm;
  while (y < ty || (y === ty && m <= tm)) {
    out.push(`${y}-${String(m).padStart(2, '0')}-01`);
    m++;
    if (m > 12) { m = 1; y++; }
  }
  return out;
}

/** as_of + n months as 'YYYY-MM-DD' (UTC, end-of-month safe via Date arithmetic). */
export function addMonths(isoDate: string, months: number): string {
  const d = new Date(isoDate);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** Does this deal's licensor resolve to the asset's company? */
export function licensorMatches(asset: LabelAsset, deal: Pick<LabelDeal, 'licensor_id' | 'licensor_name'>): 'id' | 'name' | null {
  if (deal.licensor_id && asset.company_id && deal.licensor_id === asset.company_id) return 'id';
  const names = [asset.company_name, ...(asset.company_name_variations ?? [])].filter(Boolean);
  if (names.some(n => sameCompany(n, deal.licensor_name))) return 'name';
  return null;
}

/** Deal-level eligibility, independent of dates. */
export function isPositiveDealType(deal: Pick<LabelDeal, 'deal_type'>): boolean {
  return !!deal.deal_type && POSITIVE_DEAL_TYPES.has(deal.deal_type.toLowerCase());
}

/**
 * Every (asset, deal) pair that can ever be a positive, regardless of as_of.
 * Run once over the deals table; the per-snapshot label is then a date test.
 */
export function buildLabelEvents(assets: readonly LabelAsset[], deals: readonly LabelDeal[]): LabelEvent[] {
  const byCompanyId = new Map<string, LabelAsset[]>();
  const all = assets;
  for (const a of assets) {
    if (!a.company_id) continue;
    const list = byCompanyId.get(a.company_id) ?? [];
    list.push(a);
    byCompanyId.set(a.company_id, list);
  }
  const events: LabelEvent[] = [];
  const seen = new Set<string>();
  for (const deal of deals) {
    if (!deal.announced_date || !isPositiveDealType(deal) || !isEligibleDeal(deal as PartnershipDeal)) continue;
    // Candidate assets: same licensor_id first (cheap), then name equality across all.
    const candidates = deal.licensor_id ? byCompanyId.get(deal.licensor_id) ?? [] : [];
    const pool = candidates.length ? candidates : all;
    for (const asset of pool) {
      const lm = licensorMatches(asset, deal);
      if (!lm) continue;
      const kind = matchAssetName([asset.asset_name, ...(asset.asset_aliases ?? [])], deal.asset_name);
      if (!kind) continue;
      const key = `${asset.id}:${deal.id}`;
      if (seen.has(key)) continue;
      seen.add(key);
      events.push({ asset_id: asset.id, deal_id: deal.id, announced_date: deal.announced_date.slice(0, 10), deal_type: deal.deal_type ?? null, match_kind: kind, licensor_match: lm });
    }
  }
  return events.sort((a, b) => a.announced_date.localeCompare(b.announced_date));
}

/**
 * Label one asset at one as_of from its label events.
 * `labelHorizon` = the latest announced_date the deals table reliably covers
 * (typically the max announced_date seen); windows past it are unobservable.
 */
export function labelSnapshot(events: readonly LabelEvent[], asOf: string, labelHorizon: string): SnapshotLabel {
  const windowEnd = addMonths(asOf, LABEL_WINDOW_MONTHS);
  let unpartnered = true;
  let first: LabelEvent | null = null;
  for (const e of events) {
    if (e.announced_date <= asOf) { unpartnered = false; continue; }
    if (e.announced_date <= windowEnd && (!first || e.announced_date < first.announced_date)) first = e;
  }
  const observable = windowEnd <= labelHorizon;
  return {
    label: first ? 1 : 0,
    deal_id: first?.deal_id ?? null,
    deal_date: first?.announced_date ?? null,
    unpartnered_at_asof: unpartnered,
    observable,
  };
}

/**
 * Deterministic asset-level negative subsampling: keep an asset when its id
 * hashes below `rate`. Positives are always kept by the caller. Same asset →
 * same decision across runs so the cursor can resume.
 */
export function keepNegativeAsset(assetId: string, rate: number): boolean {
  if (rate >= 1) return true;
  if (rate <= 0) return false;
  // FNV-1a 32-bit
  let h = 0x811c9dc5;
  for (let i = 0; i < assetId.length; i++) {
    h ^= assetId.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h / 0x100000000 < rate;
}
