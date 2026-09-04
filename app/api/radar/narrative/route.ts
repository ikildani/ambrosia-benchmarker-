/**
 * Asset Radar — AI Narrative API
 *
 * GET /api/radar/narrative?asset_id=UUID
 *   Generates a one-paragraph institutional analyst brief for an asset
 *   by synthesizing all 6 layers of intelligence.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { fetchNarrativeInputs, generateNarrative } from '@/lib/radar/narrative';

export const dynamic = 'force-dynamic';
export const maxDuration = 30;

export async function GET(request: NextRequest) {
  const assetId = request.nextUrl.searchParams.get('asset_id');
  if (!assetId) {
    return NextResponse.json({ error: 'asset_id required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  try {
    const inputs = await fetchNarrativeInputs(supabase, assetId);
    if (!inputs) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const narrative = await generateNarrative(inputs);

    return NextResponse.json({
      asset_id: assetId,
      narrative,
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
