/**
 * Asset Radar — Signals API
 *
 * GET /api/radar/signals?asset_id=X
 *   Returns signal breakdown for a specific asset:
 *   - Current factor scores and composite licensing_intent_score
 *   - Individual signal records with evidence
 *   - Score trend over time (from snapshots)
 *
 * GET /api/radar/signals?top=20
 *   Returns the top N assets by licensing_intent_score with their signals.
 *
 * GET /api/radar/signals?company=X
 *   Returns all signals for assets owned by a specific company.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const assetId = searchParams.get('asset_id');
  const companyName = searchParams.get('company');
  const top = parseInt(searchParams.get('top') || '0', 10);
  const signalType = searchParams.get('signal_type');
  const activeOnly = searchParams.get('active') !== 'false';

  const supabase = createServiceClient();

  // ── Single asset detail view ───────────────────────────────────
  if (assetId) {
    const [assetResult, signalsResult, snapshotsResult] = await Promise.all([
      supabase
        .from('clinical_assets')
        .select('id, company_name, asset_name, modality, therapeutic_area, indication_category, phase, trial_status, partnership_status, licensing_intent_score, competitive_heat, deal_readiness_score, confidence_score, trial_count')
        .eq('id', assetId)
        .single(),

      supabase
        .from('licensing_signals')
        .select('*')
        .eq('asset_id', assetId)
        .eq('is_active', activeOnly)
        .order('signal_value', { ascending: false })
        .limit(50),

      supabase
        .from('asset_signal_snapshots')
        .select('licensing_intent_score, competitive_heat, deal_readiness_score, factor_scores, score_delta, trend, snapshot_date')
        .eq('asset_id', assetId)
        .order('snapshot_date', { ascending: false })
        .limit(30),
    ]);

    if (assetResult.error || !assetResult.data) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    // Group signals by type for factor breakdown
    const signalsByType: Record<string, typeof signalsResult.data> = {};
    if (signalsResult.data) {
      for (const sig of signalsResult.data) {
        if (!signalsByType[sig.signal_type]) signalsByType[sig.signal_type] = [];
        signalsByType[sig.signal_type]!.push(sig);
      }
    }

    return NextResponse.json({
      asset: assetResult.data,
      signals: signalsResult.data || [],
      signals_by_type: signalsByType,
      trend: snapshotsResult.data || [],
      current_trend: snapshotsResult.data?.[0]?.trend || 'stable',
      score_delta_7d: computeNDayDelta(snapshotsResult.data || [], 7),
      score_delta_30d: computeNDayDelta(snapshotsResult.data || [], 30),
    });
  }

  // ── Top assets by licensing intent ─────────────────────────────
  if (top > 0) {
    let query = supabase
      .from('clinical_assets')
      .select('id, company_name, asset_name, modality, therapeutic_area, indication_category, phase, trial_status, partnership_status, licensing_intent_score, competitive_heat, deal_readiness_score, confidence_score')
      .gt('licensing_intent_score', 0)
      .order('licensing_intent_score', { ascending: false })
      .limit(Math.min(top, 100));

    if (signalType) {
      // Filter by assets that have a specific signal type above threshold
      const { data: assetIdsWithSignal } = await supabase
        .from('licensing_signals')
        .select('asset_id')
        .eq('signal_type', signalType)
        .eq('is_active', true)
        .gte('signal_value', 30);

      if (assetIdsWithSignal && assetIdsWithSignal.length > 0) {
        const ids = Array.from(new Set(assetIdsWithSignal.map(r => r.asset_id)));
        query = query.in('id', ids);
      }
    }

    const { data: assets, error } = await query;
    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({
      assets: assets || [],
      count: assets?.length || 0,
    });
  }

  // ── Company-level signals ──────────────────────────────────────
  if (companyName) {
    const [assetsResult, signalsResult] = await Promise.all([
      supabase
        .from('clinical_assets')
        .select('id, asset_name, modality, phase, licensing_intent_score, competitive_heat, deal_readiness_score, partnership_status')
        .ilike('company_name', `%${companyName}%`)
        .order('licensing_intent_score', { ascending: false })
        .limit(50),

      supabase
        .from('licensing_signals')
        .select('asset_id, signal_type, signal_value, confidence, direction, evidence_text, detected_at')
        .ilike('company_name', `%${companyName}%`)
        .eq('is_active', true)
        .order('signal_value', { ascending: false })
        .limit(100),
    ]);

    return NextResponse.json({
      company: companyName,
      assets: assetsResult.data || [],
      signals: signalsResult.data || [],
      total_assets: assetsResult.data?.length || 0,
      total_active_signals: signalsResult.data?.length || 0,
    });
  }

  return NextResponse.json({
    error: 'Provide asset_id, company, or top parameter',
    usage: {
      single_asset: '/api/radar/signals?asset_id=UUID',
      top_assets: '/api/radar/signals?top=20',
      by_company: '/api/radar/signals?company=Pfizer',
      by_signal_type: '/api/radar/signals?top=20&signal_type=cash_runway',
    },
  }, { status: 400 });
}

function computeNDayDelta(
  snapshots: Array<{ snapshot_date: string; licensing_intent_score: number }>,
  days: number,
): number {
  if (snapshots.length < 2) return 0;
  const latest = snapshots[0];
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const older = snapshots.find(s => new Date(s.snapshot_date) <= cutoff);
  if (!older) return 0;

  return Math.round(latest.licensing_intent_score - older.licensing_intent_score);
}
