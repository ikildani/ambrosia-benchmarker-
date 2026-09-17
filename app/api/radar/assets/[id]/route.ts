/**
 * Asset Radar — Asset brief API
 *
 * GET /api/radar/assets/:id
 *   The full one-page deal brief (components/radar/asset/brief-loader.ts):
 *   ownership, drug identity, score waterfall, trend, predicted terms with
 *   comps and provenance, trials, catalysts, competitive intel, acquirers.
 *
 *   The legacy top-level keys (asset, linkedDeals, comparableDeals,
 *   comparables, trials, thesis) are kept for components that still read
 *   them; new consumers read `brief`.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveUserTier } from '@/lib/auth/tier-check';
import { isUuid } from '@/app/api/radar/_lib/radar-api';
import { loadAssetBrief } from '@/components/radar/asset/brief-loader';

export const dynamic = 'force-dynamic';

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const auth = await resolveUserTier();
  if (!auth.hasProAccess) {
    return NextResponse.json({ error: 'Pro access required' }, { status: 403 });
  }

  const { id } = await params;
  if (!isUuid(id)) {
    return NextResponse.json({ error: 'Invalid asset ID' }, { status: 400 });
  }

  const supabase = createServiceClient();
  const brief = await loadAssetBrief(supabase, id);
  if (!brief) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  return NextResponse.json({
    brief,
    // Legacy shape (AssetDetailModal / RadarWatchlist)
    asset: brief.asset,
    linkedDeals: brief.linked_deals,
    comparableDeals: brief.terms.comps.map(c => ({ ...c, announcement_date: c.announced_date })),
    comparables: {
      n: brief.terms.n,
      relaxation: brief.terms.relaxation,
      insufficient_comps: brief.terms.insufficient,
      min_comps: brief.terms.min_comps,
      excluded_approved_ma: brief.terms.excluded_approved_ma,
    },
    trials: brief.trials,
    thesis: brief.terms.thesis,
  }, {
    headers: { 'Cache-Control': 'private, no-store' },
  });
}
