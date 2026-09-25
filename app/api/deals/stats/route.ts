import { NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

/**
 * Public coverage stats for the home-page panel.
 *
 * Sep 25 2026: one definition for every number. Before, the per-area bars
 * excluded flagged and rejected rows (475) while the headline used a constant
 * (1,900+) — two definitions on one panel. Everything here is over real rows
 * (is_synthetic = false), computed in one call by deal_coverage_stats()
 * (migration 126), with verified counts shown alongside.
 */
export interface DealCoverageStats {
  total: number;
  verified: number;
  cited: number;
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
      verified: Number(d.verified ?? 0),
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
    return NextResponse.json({ total: 0, verified: 0, cited: 0, byTA: {}, byTAVerified: {}, byPhase: {}, byType: {}, byYear: {}, byRegion: {}, sourceTypes: 0, countries: 0, lastAddedAt: null }, { status: 500 });
  }
}
