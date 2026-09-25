/**
 * Live count of preclinical and discovery-stage deals that can appear in the
 * calculator's comparable panel, by therapeutic area. Server-side only,
 * cached 15 minutes.
 *
 * Why (Sep 25 2026): a prospect asked how many transactions sit behind a
 * preclinical valuation. The honest answer is a small number per area, and it
 * moves as the verifier confirms rows, so the methodology page reads it live
 * rather than quoting a snapshot.
 *
 * The filter chain mirrors lib/comparableDeals.server.ts (disclosed terms,
 * non-synthetic, canonical, not rejected or flagged, positive total). Keep the
 * two in step: this page must describe the pool the product actually uses.
 */
import { unstable_cache } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';

export interface PreclinicalPoolRow {
  therapeuticArea: string;
  /** Rows that pass the comparable-panel filter. */
  deals: number;
  /** Of those, confirmed by the verifier against a web source. */
  verified: number;
  /** Of those, carrying a primary-source URL. */
  cited: number;
}

export interface PreclinicalPool {
  /** ISO date the counts describe. */
  asOf: string;
  rows: PreclinicalPoolRow[];
  total: number;
  /** True when the numbers are the committed snapshot, not a live query. */
  fallback: boolean;
}

/** Snapshot taken Sep 25 2026, after the September verifier sweep. */
const SNAPSHOT: PreclinicalPool = {
  asOf: '2026-09-25',
  rows: [
    { therapeuticArea: 'neurology', deals: 7, verified: 6, cited: 4 },
    { therapeuticArea: 'oncology', deals: 5, verified: 5, cited: 3 },
    { therapeuticArea: 'other', deals: 4, verified: 4, cited: 0 },
    { therapeuticArea: 'immunology', deals: 3, verified: 3, cited: 1 },
    { therapeuticArea: 'cardiovascular', deals: 2, verified: 2, cited: 2 },
    { therapeuticArea: 'metabolic', deals: 2, verified: 2, cited: 2 },
    { therapeuticArea: 'rareDisease', deals: 2, verified: 2, cited: 1 },
    { therapeuticArea: 'gastroenterology', deals: 1, verified: 1, cited: 1 },
    { therapeuticArea: 'womensHealth', deals: 1, verified: 1, cited: 0 },
    { therapeuticArea: 'infectiousDisease', deals: 1, verified: 0, cited: 0 },
  ],
  total: 28,
  fallback: true,
};

async function queryPreclinicalPool(): Promise<PreclinicalPool> {
  const supabase = createServiceClient();
  const { data, error } = await supabase
    .from('deals')
    .select('therapeutic_area, verification_status, source_url, press_release_url, source_filing_id')
    .eq('terms_disclosed', true)
    .eq('is_synthetic', false)
    .or('is_canonical.is.null,is_canonical.eq.true')
    .or('verification_status.is.null,verification_status.not.in.("rejected","flagged")')
    .in('phase_at_signing', ['preclinical', 'discovery'])
    .not('total_deal_value_usd', 'is', null)
    .gt('total_deal_value_usd', 0)
    .limit(5000);
  if (error) throw new Error(error.message);

  const byTA = new Map<string, PreclinicalPoolRow>();
  for (const d of data ?? []) {
    const ta = (d.therapeutic_area as string | null) || 'other';
    const row = byTA.get(ta) ?? { therapeuticArea: ta, deals: 0, verified: 0, cited: 0 };
    row.deals++;
    if (d.verification_status === 'verified') row.verified++;
    if (d.source_url || d.press_release_url || d.source_filing_id) row.cited++;
    byTA.set(ta, row);
  }
  const rows = [...byTA.values()].sort((a, b) => b.deals - a.deals || a.therapeuticArea.localeCompare(b.therapeuticArea));
  return {
    asOf: new Date().toISOString().slice(0, 10),
    rows,
    total: rows.reduce((s, r) => s + r.deals, 0),
    fallback: false,
  };
}

const cached = unstable_cache(queryPreclinicalPool, ['preclinical-pool-v1'], { revalidate: 900, tags: ['deal-stats'] });

/** Cached 15 minutes; never throws — falls back to the committed snapshot. */
export async function getPreclinicalPool(): Promise<PreclinicalPool> {
  try {
    return await cached();
  } catch (e) {
    console.error('[preclinical-pool] live query failed, using snapshot:', e);
    return SNAPSHOT;
  }
}

const TA_LABELS: Record<string, string> = {
  oncology: 'Oncology',
  neurology: 'Neurology',
  immunology: 'Immunology',
  cardiovascular: 'Cardiovascular',
  metabolic: 'Metabolic',
  rareDisease: 'Rare disease',
  infectiousDisease: 'Infectious disease',
  hematology: 'Hematology',
  ophthalmology: 'Ophthalmology',
  dermatology: 'Dermatology',
  gastroenterology: 'Gastroenterology',
  womensHealth: "Women's health",
  respiratory: 'Respiratory',
  other: 'Other',
};

export function taLabel(ta: string): string {
  return TA_LABELS[ta] ?? ta.replace(/([A-Z])/g, ' $1').replace(/^./, c => c.toUpperCase());
}
