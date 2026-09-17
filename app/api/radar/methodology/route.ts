/**
 * GET /api/radar/methodology
 *
 * Summary of the active licensing-intent model and its latest backtest.
 *
 * Access: the summary (what the score predicts, feature list with sign
 * constraints and sources, backtest scorecard, calibration bins, factor
 * importance, model version and dates) is readable by any authenticated
 * user — it contains no asset-level data and exists so a reader can judge
 * the score before paying for it. The trained coefficients, standardisation
 * constants and calibration knots (`?detail=1`) are Pro-only: they are the
 * model. Anonymous callers get 401 either way, matching every other Radar
 * route.
 *
 * Reads go through the service client because radar_score_models and
 * radar_score_backtests are service-role-only tables (migration 115).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveUserTier } from '@/lib/auth/tier-check';
import { loadMethodologySummary, type MethodologySummary } from '@/lib/radar/backtest/run';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const auth = await resolveUserTier();
  if (!auth.isAuthenticated) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }
  const wantDetail = request.nextUrl.searchParams.get('detail') === '1';
  if (wantDetail && !auth.hasProAccess) {
    return NextResponse.json({ error: 'Pro access required for model parameters' }, { status: 403 });
  }

  try {
    const supabase = createServiceClient();
    const summary: MethodologySummary = await loadMethodologySummary(supabase, { includeParams: wantDetail });
    return NextResponse.json(summary, {
      headers: { 'Cache-Control': 'private, max-age=300' },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[radar/methodology] ${message}`);
    return NextResponse.json({ error: 'Failed to load methodology' }, { status: 500 });
  }
}
