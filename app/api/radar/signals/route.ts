/**
 * Search & Evaluation — Signals API
 *
 * GET /api/radar/signals?asset_id=X
 *   Score decomposition for one asset: all nine factor contributions
 *   (ScoreFactorContribution[], zero-score factors included with the sources
 *   checked), the waterfall from weighted evidence through the phase and
 *   availability multipliers to the composite, model version, the raw
 *   licensing_signals rows, and the 7/30/90-day trend from snapshots.
 *
 * GET /api/radar/signals?top=20
 *   Top N assets by licensing_intent_score.
 *
 * GET /api/radar/signals?company=X
 *   All signals for assets owned by a company.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveUserTier } from '@/lib/auth/tier-check';
import { isUuid, sanitizeSearchTerm } from '@/app/api/radar/_lib/radar-api';
import { buildScoreBreakdown, deltaOverDays, type SignalEvidenceRow, type SnapshotLike } from '@/components/radar/asset/score-breakdown';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  // Search & Evaluation intelligence is Pro-only: this endpoint returns scored data
  // from the asset universe, so anonymous and free-tier callers are rejected.
  const auth = await resolveUserTier();
  if (!auth.hasProAccess) {
    return NextResponse.json({ error: 'Pro access required' }, { status: 403 });
  }

  const { searchParams } = new URL(request.url);
  const assetId = searchParams.get('asset_id');
  if (assetId && !isUuid(assetId)) {
    return NextResponse.json({ error: 'asset_id must be a UUID' }, { status: 400 });
  }
  // Free text goes into ilike patterns; signal_type is a slug in `.eq()`.
  const companyName = sanitizeSearchTerm(searchParams.get('company')) || null;
  const top = parseInt(searchParams.get('top') || '0', 10);
  const rawSignalType = searchParams.get('signal_type');
  const signalType = rawSignalType && /^[a-z_]{1,50}$/.test(rawSignalType) ? rawSignalType : null;
  const activeOnly = searchParams.get('active') !== 'false';

  const supabase = createServiceClient();

  // ── Single asset detail view ───────────────────────────────────
  if (assetId) {
    const since = new Date();
    since.setUTCDate(since.getUTCDate() - 90);

    const [assetResult, signalsResult, snapshotsResult] = await Promise.all([
      supabase
        .from('clinical_assets')
        .select('id, company_name, asset_name, modality, therapeutic_area, indication_category, phase, trial_status, partnership_status, territory_rights_available, licensing_intent_score, score_confidence, competitive_heat, deal_readiness_score, confidence_score, trial_count, last_scored_at')
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
        .select('*')
        .eq('asset_id', assetId)
        .gte('snapshot_date', since.toISOString().slice(0, 10))
        .order('snapshot_date', { ascending: false })
        .limit(120),
    ]);

    if (assetResult.error || !assetResult.data) {
      return NextResponse.json({ error: 'Asset not found' }, { status: 404 });
    }

    const signals = (signalsResult.data || []) as Array<Record<string, unknown>>;
    const snapshots = (snapshotsResult.data || []) as Array<Record<string, unknown>>;

    // Group signals by type for factor breakdown
    const signalsByType: Record<string, typeof signals> = {};
    for (const sig of signals) {
      const t = String(sig.signal_type);
      if (!signalsByType[t]) signalsByType[t] = [];
      signalsByType[t]!.push(sig);
    }

    const breakdown = buildScoreBreakdown({
      currentScore: assetResult.data.licensing_intent_score,
      currentConfidence: assetResult.data.score_confidence ?? assetResult.data.confidence_score,
      snapshot: (snapshots[0] as unknown as SnapshotLike | undefined) ?? null,
      signals: signals as unknown as SignalEvidenceRow[],
    });

    const points = snapshots.map(s => ({
      date: String(s.snapshot_date),
      score: Number(s.licensing_intent_score) || 0,
      delta: Number(s.score_delta) || 0,
      trend: (s.trend as string | null) ?? null,
    }));

    return NextResponse.json({
      asset: assetResult.data,
      score: breakdown,
      contributions: breakdown.contributions,
      waterfall: breakdown.waterfall,
      model_version: breakdown.model_version,
      signals,
      signals_by_type: signalsByType,
      trend: snapshots.map(s => ({
        licensing_intent_score: s.licensing_intent_score,
        competitive_heat: s.competitive_heat,
        deal_readiness_score: s.deal_readiness_score,
        score_delta: s.score_delta,
        trend: s.trend,
        snapshot_date: s.snapshot_date,
      })),
      current_trend: points[0]?.trend || 'stable',
      score_delta_7d: deltaOverDays(points, 7) ?? 0,
      score_delta_30d: deltaOverDays(points, 30) ?? 0,
      score_delta_90d: deltaOverDays(points, 90) ?? 0,
    });
  }

  // ── Top assets by licensing intent ─────────────────────────────
  if (top > 0) {
    let query = supabase
      .from('clinical_assets')
      .select('id, company_name, asset_name, modality, therapeutic_area, indication_category, phase, trial_status, partnership_status, licensing_intent_score, score_confidence, competitive_heat, deal_readiness_score, confidence_score')
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
      console.error('[radar/signals] Query error:', error.message);
      return NextResponse.json({ error: 'Failed to fetch signals' }, { status: 500 });
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
