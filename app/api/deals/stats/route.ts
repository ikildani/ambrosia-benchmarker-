import { NextResponse } from 'next/server';
import { getDealCoverageStats, type DealCoverageStats } from '@/lib/deal-coverage';

export const dynamic = 'force-dynamic';
export type { DealCoverageStats };

const EMPTY: DealCoverageStats = { total: 0, primary: 0, primaryVerified: 0, backlog: 0, verified: 0, cited: 0, byTAAll: {}, byTA: {}, byTAVerified: {}, byPhase: {}, byType: {}, byYear: {}, byRegion: {}, byCompanyType: {}, companies: 0, sourceTypes: 0, countries: 0, lastAddedAt: null };

/** Public coverage stats; the home page now renders these server-side via lib/deal-coverage. */
export async function GET() {
  const stats = await getDealCoverageStats();
  if (!stats) return NextResponse.json(EMPTY, { status: 500 });
  return NextResponse.json(stats, {
    headers: { 'Cache-Control': 'public, s-maxage=900, stale-while-revalidate=3600' },
  });
}
