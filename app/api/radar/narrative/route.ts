/**
 * Search & Evaluation — AI Narrative API
 *
 * GET /api/radar/narrative?asset_id=UUID
 *   One-paragraph institutional analyst brief for an asset, synthesised from
 *   every intelligence layer. Every sentence carries citations like [S1, Q2]
 *   that resolve to the `evidence` rows returned alongside, so the UI can
 *   render them as superscript links. Cached in radar_asset_narratives keyed
 *   by a hash of the inputs; repeated opens do not re-call the model.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveUserTier } from '@/lib/auth/tier-check';
import { getOrGenerateNarrative, isUuid, NARRATIVE_MODEL } from '@/app/api/radar/_lib/radar-api';
import { buildEvidenceRows } from '@/lib/radar/narrative';

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
    const { rows } = buildEvidenceRows(inputs);

    // Attach the evidence URL/date the citation points at (signals only carry
    // one; P/C/Q/T rows are derived and link to the brief section instead).
    const signalsByIndex = inputs.signals.filter(s => s.value >= 10);
    const evidence = rows.map(r => {
      const m = /^S(\d+)$/.exec(r.id);
      const sig = m ? signalsByIndex[Number(m[1]) - 1] : undefined;
      const section = r.id.startsWith('P') ? 'overview'
        : r.id.startsWith('S') ? 'intent'
        : r.id.startsWith('C') ? 'landscape'
        : r.id.startsWith('Q') ? 'acquirers'
        : r.id.startsWith('T') ? 'terms' : 'overview';
      return {
        id: r.id,
        text: r.text,
        section,
        date: sig?.date ?? null,
        source: sig?.source ?? null,
      };
    });

    return NextResponse.json({
      asset_id: assetId,
      narrative,
      cached,
      model: NARRATIVE_MODEL,
      generated_at: new Date().toISOString(),
      evidence,
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
