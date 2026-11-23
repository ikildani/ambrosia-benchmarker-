/**
 * Verified comparable deals, server half: reads primary-sourced rows from
 * `deals_verified` for one therapeutic area and hands them to the pure ranking
 * in lib/comps/verified-comps.ts.
 *
 * Primary-sourced = `source_filing_id` or `press_release_url` present (CLAUDE.md),
 * plus a deep link we can show the user (press release first, then the filing URL).
 *
 * Import ONLY from API routes / server code.
 *
 * @module lib/comps/verified-comps.server
 */

import { createServiceClient } from '@/lib/supabase/server';
import { selectVerifiedComps, type CompCandidateRow, type CompsQuery, type CompsSelection } from './verified-comps';

export const VERIFIED_COMPS_CACHE_TTL_MS = 10 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;

interface CacheEntry { expiresAt: number; rows: CompCandidateRow[] }
/** Rows per therapeutic area: every query in that area ranks the same few hundred rows. */
const rowCache = new Map<string, CacheEntry>();

export function clearVerifiedCompsCache(): void {
  rowCache.clear();
}

const SOURCE_LABELS: Record<string, string> = {
  sec_8k: 'SEC 8-K',
  sec_6k: 'SEC 6-K',
  sec_10k: 'SEC 10-K',
  sec_10q: 'SEC 10-Q',
  hkex: 'HKEX filing',
  cninfo: 'CNINFO filing',
  asx: 'ASX announcement',
  tdnet: 'TDnet filing',
  dart: 'DART filing',
  mfn: 'MFN release',
};

/** A link a user can open: http(s) with a path, not a bare domain. */
export function isDeepLink(url: string | null | undefined): url is string {
  return !!url && /^https?:\/\/[^/\s]+\/\S+/i.test(url.trim());
}

export function pickSourceLink(row: { press_release_url?: string | null; source_url?: string | null; source_type?: string | null }): { url: string; label: string } | null {
  if (isDeepLink(row.press_release_url)) {
    return { url: row.press_release_url.trim(), label: 'Press release' };
  }
  if (isDeepLink(row.source_url)) {
    const url = row.source_url.trim();
    const type = (row.source_type ?? '').toLowerCase();
    const label = SOURCE_LABELS[type] ?? (/sec\.gov\/Archives/i.test(url) ? 'SEC filing' : 'Press release');
    return { url, label };
  }
  return null;
}

interface DealRow {
  id: string;
  licensor_name: string | null;
  licensee_name: string | null;
  asset_name: string | null;
  announced_date: string | null;
  therapeutic_area: string | null;
  phase_at_signing: string | null;
  modality: string | null;
  indication_category: string | null;
  indication_specific: string | null;
  deal_type: string | null;
  territory: string | null;
  upfront_usd: number | string | null;
  total_deal_value_usd: number | string | null;
  royalty_low_pct: number | string | null;
  royalty_high_pct: number | string | null;
  source_url: string | null;
  press_release_url: string | null;
  source_type: string | null;
  source_filing_id: string | null;
}

export function toCandidate(d: DealRow): CompCandidateRow | null {
  if (!d.source_filing_id && !d.press_release_url) return null;
  const link = pickSourceLink(d);
  if (!link) return null;
  const upfront = Number(d.upfront_usd ?? 0);
  if (!(upfront > 0)) return null;
  const total = d.total_deal_value_usd != null ? Number(d.total_deal_value_usd) : null;
  const year = d.announced_date ? Number(String(d.announced_date).slice(0, 4)) : NaN;
  if (!Number.isFinite(year)) return null;
  const num = (v: number | string | null) => (v == null || v === '' ? null : Number(v));
  return {
    id: String(d.id),
    licensor: d.licensor_name || 'Undisclosed',
    licensee: d.licensee_name || 'Undisclosed',
    asset: d.asset_name || null,
    year,
    announcedDate: d.announced_date,
    therapeuticArea: d.therapeutic_area,
    phase: d.phase_at_signing,
    modality: d.modality,
    indicationCategory: d.indication_category,
    indicationSpecific: d.indication_specific,
    dealType: d.deal_type,
    territory: d.territory,
    upfrontM: Math.round((upfront / 1_000_000) * 10) / 10,
    totalM: total && total > 0 ? Math.round((total / 1_000_000) * 10) / 10 : null,
    royaltyLowPct: num(d.royalty_low_pct),
    royaltyHighPct: num(d.royalty_high_pct),
    sourceUrl: link.url,
    sourceLabel: link.label,
  };
}

async function loadRows(therapeuticArea: string): Promise<CompCandidateRow[]> {
  const now = Date.now();
  const hit = rowCache.get(therapeuticArea);
  if (hit && hit.expiresAt > now) return hit.rows;

  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('deals_verified')
    .select('id, licensor_name, licensee_name, asset_name, announced_date, therapeutic_area, phase_at_signing, modality, indication_category, indication_specific, deal_type, territory, upfront_usd, total_deal_value_usd, royalty_low_pct, royalty_high_pct, source_url, press_release_url, source_type, source_filing_id')
    .eq('therapeutic_area', therapeuticArea)
    .gt('upfront_usd', 0)
    .or('source_filing_id.not.is.null,press_release_url.not.is.null')
    .order('announced_date', { ascending: false })
    .limit(2000);
  if (error) throw new Error(`deals_verified read failed: ${error.message}`);

  const rows = ((data ?? []) as DealRow[]).map(toCandidate).filter((r): r is CompCandidateRow => r != null);
  if (rowCache.size >= CACHE_MAX_ENTRIES) rowCache.clear();
  rowCache.set(therapeuticArea, { expiresAt: now + VERIFIED_COMPS_CACHE_TTL_MS, rows });
  return rows;
}

export async function findVerifiedComps(query: CompsQuery): Promise<CompsSelection> {
  const rows = await loadRows(query.therapeuticArea);
  return selectVerifiedComps(query, rows);
}
