/**
 * Asset Radar — Asset Comparison API
 *
 * GET /api/radar/compare?ids=UUID1,UUID2,UUID3
 *   Returns side-by-side comparison data for up to 5 assets:
 *   asset profiles, scores, signals, competitive intel, deal theses.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const idsParam = request.nextUrl.searchParams.get('ids');
  if (!idsParam) {
    return NextResponse.json({ error: 'ids parameter required (comma-separated UUIDs)' }, { status: 400 });
  }

  const ids = idsParam.split(',').map(id => id.trim()).filter(Boolean).slice(0, 5);
  if (ids.length < 2) {
    return NextResponse.json({ error: 'At least 2 asset IDs required for comparison' }, { status: 400 });
  }

  const supabase = createServiceClient();

  // Fetch all asset data in parallel
  const [assetsRes, signalsRes, intelRes, thesesRes] = await Promise.all([
    supabase
      .from('clinical_assets')
      .select('id, company_name, asset_name, modality, therapeutic_area, indication_category, indication_specific, phase, trial_status, trial_count, enrollment_total, partnership_status, partner_company_name, licensing_intent_score, competitive_heat, deal_readiness_score, confidence_score, originator_country, originator_region, territory_rights_available, nct_ids, last_update_date, first_posted_date, regulatory_designations')
      .in('id', ids),

    supabase
      .from('licensing_signals')
      .select('asset_id, signal_type, signal_value, confidence, direction, evidence_text')
      .in('asset_id', ids)
      .eq('is_active', true)
      .order('signal_value', { ascending: false }),

    supabase
      .from('competitive_intel')
      .select('asset_id, intel_type, intensity, competitor_name, evidence_text')
      .in('asset_id', ids)
      .eq('is_active', true)
      .order('intensity', { ascending: false }),

    supabase
      .from('radar_deal_theses')
      .select('asset_id, predicted_upfront_low, predicted_upfront_mid, predicted_upfront_high, predicted_total_low, predicted_total_mid, predicted_total_high, predicted_royalty_low, predicted_royalty_mid, predicted_royalty_high, comp_count, thesis_confidence')
      .in('asset_id', ids),
  ]);

  if (!assetsRes.data || assetsRes.data.length === 0) {
    return NextResponse.json({ error: 'No assets found' }, { status: 404 });
  }

  // Group signals by asset
  const signalsByAsset: Record<string, Record<string, unknown>[]> = {};
  for (const sig of (signalsRes.data || [])) {
    if (!signalsByAsset[sig.asset_id]) signalsByAsset[sig.asset_id] = [];
    signalsByAsset[sig.asset_id].push(sig);
  }

  // Group intel by asset
  const intelByAsset: Record<string, Record<string, unknown>[]> = {};
  for (const intel of (intelRes.data || [])) {
    if (!intelByAsset[intel.asset_id]) intelByAsset[intel.asset_id] = [];
    intelByAsset[intel.asset_id].push(intel);
  }

  // Map theses by asset
  const thesesByAsset: Record<string, Record<string, unknown>> = {};
  for (const thesis of (thesesRes.data || [])) {
    thesesByAsset[thesis.asset_id] = thesis;
  }

  // Build comparison columns (one per asset, in requested order)
  const columns = ids.map(id => {
    const asset = assetsRes.data!.find(a => a.id === id);
    if (!asset) return null;

    const signals = signalsByAsset[id] || [];
    const intel = intelByAsset[id] || [];
    const thesis = thesesByAsset[id] || null;
    const competitorCount = new Set(intel.filter(i => i.competitor_name).map(i => i.competitor_name)).size;

    return {
      asset,
      signals,
      signal_count: signals.length,
      intel,
      competitor_count: competitorCount,
      thesis,
      has_thesis: !!thesis,
    };
  }).filter(Boolean);

  // Compute comparison dimensions
  const dimensions = [
    { key: 'licensing_intent_score', label: 'Licensing Intent', format: 'score' },
    { key: 'deal_readiness_score', label: 'Deal Readiness', format: 'score' },
    { key: 'competitive_heat', label: 'Competitive Heat', format: 'score' },
    { key: 'confidence_score', label: 'Data Confidence', format: 'score' },
    { key: 'trial_count', label: 'Clinical Trials', format: 'number' },
    { key: 'enrollment_total', label: 'Total Enrollment', format: 'number' },
    { key: 'phase', label: 'Phase', format: 'text' },
    { key: 'modality', label: 'Modality', format: 'text' },
    { key: 'therapeutic_area', label: 'Therapeutic Area', format: 'text' },
    { key: 'partnership_status', label: 'Partnership', format: 'text' },
    { key: 'originator_country', label: 'Country', format: 'text' },
  ];

  return NextResponse.json({
    columns,
    dimensions,
    count: columns.length,
  });
}
