import { NextResponse } from 'next/server';
import { getMethodologyStats } from '@/lib/methodology-stats';

/**
 * GET /api/methodology/stats
 *
 * The live figures behind /methodology: deals tracked, sourced, verified with
 * a citation, quarantined, and the engine's accuracy against the verified
 * cohort. Cached one hour server-side; the same object the page renders,
 * so the homepage or a partner can quote it without drift.
 */
export const revalidate = 3600;

export async function GET() {
  try {
    const stats = await getMethodologyStats();
    return NextResponse.json(stats, {
      headers: { 'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400' },
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'stats unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
