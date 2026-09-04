/**
 * Asset Radar — Competitive Intelligence API
 *
 * GET /api/radar/intel?asset_id=X
 *   Full competitive landscape for one asset.
 *
 * GET /api/radar/intel?hottest=20
 *   Top N assets by competitive_heat.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const assetId = searchParams.get('asset_id');
  const hottest = parseInt(searchParams.get('hottest') || '0', 10);

  const supabase = createServiceClient();

  if (assetId) {
    const [assetResult, intelResult] = await Promise.all([
      supabase
        .from('clinical_assets')
        .select('id, company_name, asset_name, modality, therapeutic_area, indication_category, phase, competitive_heat, licensing_intent_score, deal_readiness_score')
        .eq('id', assetId)
        .single(),

      supabase
        .from('competitive_intel')
        .select('*')
        .eq('asset_id', assetId)
        .eq('is_active', true)
        .order('intensity', { ascending: false })
        .limit(30),
    ]);

    if (assetResult.error || !assetResult.data) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // Group by intel type
    const byType: Record<string, typeof intelResult.data> = {};
    if (intelResult.data) {
      for (const sig of intelResult.data) {
        if (!byType[sig.intel_type]) byType[sig.intel_type] = [];
        byType[sig.intel_type].push(sig);
      }
    }

    // Extract competitor names
    const competitors = (intelResult.data || [])
      .filter(s => s.competitor_name)
      .map(s => ({ name: s.competitor_name, type: s.intel_type, intensity: s.intensity }));

    return NextResponse.json({
      asset: assetResult.data,
      intel: intelResult.data || [],
      by_type: byType,
      competitors,
      total_signals: intelResult.data?.length || 0,
    });
  }

  if (hottest > 0) {
    const { data: assets } = await supabase
      .from('clinical_assets')
      .select('id, company_name, asset_name, modality, therapeutic_area, indication_category, phase, competitive_heat, licensing_intent_score, deal_readiness_score, partnership_status')
      .gt('competitive_heat', 0)
      .order('competitive_heat', { ascending: false })
      .limit(Math.min(hottest, 100));

    return NextResponse.json({
      assets: assets || [],
      count: assets?.length || 0,
    });
  }

  return NextResponse.json({
    error: 'Provide asset_id or hottest parameter',
    usage: {
      single_asset: '/api/radar/intel?asset_id=UUID',
      hottest: '/api/radar/intel?hottest=20',
    },
  }, { status: 400 });
}
