import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Public coverage stats for the home-page panel.
 *
 * Sep 25 2026: one definition for every number, and that definition is
 * "primary-sourced": a regulator/exchange filing id, an issuer press-release
 * URL, or a source URL written by a primary pipeline. The site promises no
 * secondary data, so rows without such a citation are reported as a
 * re-sourcing backlog, not as deals. Computed in one call by
 * deal_coverage_stats() (migrations 126–127).
 */
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
  sourceTypes: number;
  countries: number;
  lastAddedAt: string | null;
}

export async function GET() {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase.rpc('deal_coverage_stats');
    if (error || !data) throw new Error(error?.message ?? 'no data');
    const d = data as Record<string, unknown>;
    const obj = (k: string) => (d[k] as Record<string, number> | undefined) ?? {};
    const body: DealCoverageStats = {
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
      sourceTypes: Number(d.source_types ?? 0),
      countries: Number(d.countries ?? 0),
      lastAddedAt: (d.last_added_at as string | null) ?? null,
    };
    return NextResponse.json(body, {
      headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' },
    });
  } catch {
    return NextResponse.json({ total: 0, primary: 0, primaryVerified: 0, backlog: 0, verified: 0, cited: 0, byTAAll: {}, byTA: {}, byTAVerified: {}, byPhase: {}, byType: {}, byYear: {}, byRegion: {}, sourceTypes: 0, countries: 0, lastAddedAt: null }, { status: 500 });
  }
}
