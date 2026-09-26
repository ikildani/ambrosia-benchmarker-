/**
 * Public coverage stats for the home-page panel, computed by deal_coverage_stats()
 * (migrations 126–127) and cached 15 minutes. Server-side only.
 *
 * One definition for every number, and that definition is "primary-sourced": a
 * regulator/exchange filing id, an issuer press-release URL, or a source URL
 * written by a primary pipeline. Rows without such a citation are a re-sourcing
 * backlog, not deals.
 */
import { unstable_cache } from 'next/cache';
import { createServiceClient } from '@/lib/supabase/server';

export interface DealCoverageStats {
  /** Every real row. */
  total: number;
  /** Rows with a primary citation: exchange/regulator filing id, issuer release URL, or a URL from a primary pipeline. */
  primary: number;
  primaryVerified: number;
  /** Real rows without a primary citation — a re-sourcing backlog, not counted in the headline. */
  backlog: number;
  verified: number;
  cited: number;
  /** Per-area totals over every real row (the bars use primary-only counts in byTA). */
  byTAAll: Record<string, number>;
  byTA: Record<string, number>;
  byTAVerified: Record<string, number>;
  byPhase: Record<string, number>;
  byType: Record<string, number>;
  byYear: Record<string, number>;
  byRegion: Record<string, number>;
  /** Distinct counterparties on primary-sourced deals, by companies.company_type ('unclassified' when null). */
  byCompanyType: Record<string, number>;
  companies: number;
  sourceTypes: number;
  countries: number;
  lastAddedAt: string | null;
}

async function queryDealCoverageStats(): Promise<DealCoverageStats> {
  const supabase = createServiceClient();
  const { data, error } = await supabase.rpc('deal_coverage_stats');
  if (error || !data) throw new Error(error?.message ?? 'no data');
  const d = data as Record<string, unknown>;
  const obj = (k: string) => (d[k] as Record<string, number> | undefined) ?? {};
  return {
    total: Number(d.total ?? 0),
    primary: Number(d.primary ?? 0),
    primaryVerified: Number(d.primary_verified ?? 0),
    backlog: Number(d.backlog ?? 0),
    verified: Number(d.verified ?? 0),
    byTAAll: obj('by_ta_all'),
    cited: Number(d.cited ?? 0),
    byTA: obj('by_ta'),
    byTAVerified: obj('by_ta_verified'),
    byPhase: obj('by_phase'),
    byType: obj('by_type'),
    byYear: obj('by_year'),
    byRegion: obj('by_region'),
    byCompanyType: obj('by_company_type'),
    companies: Number(d.companies ?? 0),
    sourceTypes: Number(d.source_types ?? 0),
    countries: Number(d.countries ?? 0),
    lastAddedAt: (d.last_added_at as string | null) ?? null,
  };
}

const cached = unstable_cache(queryDealCoverageStats, ['deal-coverage-stats-v1'], { revalidate: 900, tags: ['deal-stats'] });

/** Cached 15 minutes; returns null instead of throwing so pages degrade to hiding the panel. */
export async function getDealCoverageStats(): Promise<DealCoverageStats | null> {
  try {
    return await cached();
  } catch (e) {
    console.error('[deal-coverage] query failed:', e);
    return null;
  }
}
