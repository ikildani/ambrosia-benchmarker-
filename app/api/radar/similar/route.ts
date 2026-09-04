/**
 * Asset Radar — Similarity Search
 *
 * GET /api/radar/similar?asset_id=UUID&limit=10
 *   Returns assets similar to the given one, scored by feature overlap:
 *   same modality, same TA, same phase bucket, same indication, same region.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

const PHASE_BUCKET: Record<string, string> = {
  early_phase1: 'early', phase1: 'early', phase_1: 'early',
  phase1_phase2: 'mid', phase_1_2: 'mid', phase2: 'mid', phase_2: 'mid',
  phase2_phase3: 'late', phase_2_3: 'late', phase3: 'late', phase_3: 'late',
  phase4: 'approved', phase_4: 'approved', approved: 'approved',
};

function phaseBucket(phase: string | null): string {
  if (!phase) return 'unknown';
  return PHASE_BUCKET[phase.toLowerCase().replace(/\s+/g, '').replace(/-/g, '_')] || 'unknown';
}

export async function GET(request: NextRequest) {
  const assetId = request.nextUrl.searchParams.get('asset_id');
  const limit = Math.min(parseInt(request.nextUrl.searchParams.get('limit') || '10', 10), 30);

  if (!assetId) {
    return NextResponse.json({ error: 'asset_id required' }, { status: 400 });
  }

  const supabase = createServiceClient();

  const { data: sourceAsset } = await supabase
    .from('clinical_assets')
    .select('id, company_name, asset_name, modality, therapeutic_area, indication_category, indication_specific, phase, originator_country, originator_region, partnership_status')
    .eq('id', assetId)
    .single();

  if (!sourceAsset) {
    return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
  }

  // Fetch candidates — same TA or same modality (broad net)
  const conditions: string[] = [];
  if (sourceAsset.therapeutic_area) conditions.push(`therapeutic_area.eq.${sourceAsset.therapeutic_area}`);
  if (sourceAsset.modality) conditions.push(`modality.eq.${sourceAsset.modality}`);
  if (sourceAsset.indication_category) conditions.push(`indication_category.eq.${sourceAsset.indication_category}`);

  if (conditions.length === 0) {
    return NextResponse.json({ source: sourceAsset, similar: [], total: 0 });
  }

  const { data: candidates } = await supabase
    .from('clinical_assets')
    .select('id, company_name, asset_name, modality, therapeutic_area, indication_category, indication_specific, phase, trial_status, trial_count, partnership_status, licensing_intent_score, competitive_heat, deal_readiness_score, confidence_score, originator_country, originator_region, enrollment_total, nct_ids, territory_rights_available, last_update_date')
    .or(conditions.join(','))
    .neq('id', assetId)
    .limit(100);

  if (!candidates || candidates.length === 0) {
    return NextResponse.json({ source: sourceAsset, similar: [], total: 0 });
  }

  // Score similarity
  const sourcePhaseBucket = phaseBucket(sourceAsset.phase);
  const scored = candidates.map(c => {
    let similarity = 0;

    if (c.modality === sourceAsset.modality) similarity += 30;
    if (c.therapeutic_area === sourceAsset.therapeutic_area) similarity += 25;
    if (c.indication_category === sourceAsset.indication_category) similarity += 20;
    if (c.indication_specific === sourceAsset.indication_specific) similarity += 10;
    if (phaseBucket(c.phase) === sourcePhaseBucket) similarity += 10;
    if (c.originator_region === sourceAsset.originator_region) similarity += 5;

    // Penalize partnered if source is unpartnered
    if (sourceAsset.partnership_status === 'unpartnered' && c.partnership_status === 'partnered') {
      similarity -= 10;
    }

    return { ...c, similarity_score: Math.max(0, Math.min(100, similarity)) };
  });

  const sorted = scored
    .filter(s => s.similarity_score >= 20)
    .sort((a, b) => b.similarity_score - a.similarity_score)
    .slice(0, limit);

  return NextResponse.json({
    source: sourceAsset,
    similar: sorted,
    total: sorted.length,
  });
}
