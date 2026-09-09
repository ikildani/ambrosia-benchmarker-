/**
 * Asset Radar — AI Narrative API
 *
 * GET /api/radar/narrative?asset_id=UUID
 *   Returns a one-paragraph institutional analyst brief for an asset,
 *   synthesised from all 6 layers of intelligence. Narratives are cached in
 *   radar_asset_narratives keyed by a hash of their inputs, so repeated opens
 *   do not re-call the model until the underlying data changes.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveUserTier } from '@/lib/auth/tier-check';
import { getOrGenerateNarrative, isUuid } from '@/app/api/radar/_lib/radar-api';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  // Each cache miss is an Opus call: Pro-only, and rate-limited in
  // middleware.ts under the aiGeneration bucket.
  const auth = await resolveUserTier();
  if (!auth.hasProAccess) {
    return NextResponse.json({ error: 'Pro access required' }, { status: 403 });
  }

  const assetId = request.nextUrl.searchParams.get('asset_id');
  if (!assetId) {
    return NextResponse.json({ error: 'asset_id required' }, { status: 400 });
  }
  if (!isUuid(assetId)) {
    return NextResponse.json({ error: 'asset_id must be a UUID' }, { status: 400 });
  }

  const supabase = createServiceClient();

  try {
    const result = await getOrGenerateNarrative(supabase, assetId);
    if (!result) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const { narrative, cached, inputs } = result;

    return NextResponse.json({
      asset_id: assetId,
      narrative,
      cached,
      generated_at: new Date().toISOString(),
      inputs_summary: {
        signals_count: inputs.signals.length,
        competitors_count: inputs.competitors.length,
        acquirers_count: inputs.proposedAcquirers.length,
        has_thesis: !!inputs.thesis,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[radar/narrative] Error: ${message}`);
    return NextResponse.json({ error: 'Failed to generate narrative' }, { status: 500 });
  }
}
