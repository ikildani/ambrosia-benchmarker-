/**
 * Asset Radar — Regulatory Timeline API
 *
 * GET /api/radar/timeline?asset_id=UUID
 *   Forward-looking milestone timeline for one asset:
 *   trial completion dates, regulatory events, score snapshots.
 *
 * GET /api/radar/timeline?watchlist=true
 *   Timeline for all watched assets (upcoming milestones in next 90 days).
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveUserTier } from '@/lib/auth/tier-check';

export const dynamic = 'force-dynamic';

interface TimelineEvent {
  date: string;
  type: 'trial_completion' | 'trial_start' | 'last_update' | 'score_snapshot' | 'signal_detected' | 'regulatory';
  title: string;
  detail: string;
  asset_id?: string;
  asset_name?: string;
  company_name?: string;
}

export async function GET(request: NextRequest) {
  const assetId = request.nextUrl.searchParams.get('asset_id');
  const isWatchlist = request.nextUrl.searchParams.get('watchlist') === 'true';

  const supabase = createServiceClient();

  // ── Single asset timeline ──────────────────────────
  if (assetId) {
    const events: TimelineEvent[] = [];

    // Get asset
    const { data: asset } = await supabase
      .from('clinical_assets')
      .select('asset_name, company_name, first_posted_date, last_update_date')
      .eq('id', assetId)
      .single();

    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    // Trial milestones
    const { data: trials } = await supabase
      .from('company_trials')
      .select('nct_id, trial_title, phase, status, start_date, primary_completion_date, last_update_posted')
      .ilike('intervention_name', `%${asset.asset_name}%`)
      .order('primary_completion_date', { ascending: true })
      .limit(20);

    if (trials) {
      for (const trial of trials) {
        if (trial.primary_completion_date) {
          events.push({
            date: trial.primary_completion_date,
            type: new Date(trial.primary_completion_date) > new Date() ? 'trial_completion' : 'trial_completion',
            title: `Primary completion: ${trial.nct_id}`,
            detail: `${trial.trial_title || 'Trial'} — ${trial.phase || 'unknown phase'} (${trial.status || 'unknown status'})`,
          });
        }
        if (trial.start_date) {
          events.push({
            date: trial.start_date,
            type: 'trial_start',
            title: `Trial started: ${trial.nct_id}`,
            detail: `${trial.trial_title || 'Trial'} — ${trial.phase || 'unknown phase'}`,
          });
        }
      }
    }

    // Score history (snapshots)
    const { data: snapshots } = await supabase
      .from('asset_signal_snapshots')
      .select('snapshot_date, licensing_intent_score, trend, score_delta')
      .eq('asset_id', assetId)
      .order('snapshot_date', { ascending: true })
      .limit(30);

    if (snapshots) {
      for (const snap of snapshots) {
        if (Number(snap.score_delta) !== 0) {
          events.push({
            date: snap.snapshot_date,
            type: 'score_snapshot',
            title: `Intent score: ${Math.round(Number(snap.licensing_intent_score))} (${snap.trend})`,
            detail: `Change: ${Number(snap.score_delta) > 0 ? '+' : ''}${Math.round(Number(snap.score_delta))} points`,
          });
        }
      }
    }

    // Licensing signals
    const { data: signals } = await supabase
      .from('licensing_signals')
      .select('signal_type, signal_value, direction, evidence_text, detected_at')
      .eq('asset_id', assetId)
      .gte('signal_value', 30)
      .order('detected_at', { ascending: true })
      .limit(20);

    if (signals) {
      for (const sig of signals) {
        events.push({
          date: new Date(sig.detected_at).toISOString().split('T')[0],
          type: 'signal_detected',
          title: `${sig.signal_type.replace(/_/g, ' ')} signal (${Math.round(Number(sig.signal_value))})`,
          detail: sig.evidence_text?.slice(0, 120) || '',
        });
      }
    }

    // Sort chronologically
    events.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    // Split into past and future
    const now = new Date().toISOString().split('T')[0];
    const past = events.filter(e => e.date <= now);
    const future = events.filter(e => e.date > now);

    return NextResponse.json({
      asset: { name: asset.asset_name, company: asset.company_name },
      timeline: events,
      past: past.slice(-20),
      future,
      next_milestone: future[0] || null,
    });
  }

  // ── Watchlist timeline ─────────────────────────────
  if (isWatchlist) {
    const auth = await resolveUserTier();
    if (!auth.userId) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const { data: watchlist } = await supabase
      .from('radar_watchlist')
      .select('asset_id')
      .eq('user_id', auth.userId);

    if (!watchlist || watchlist.length === 0) {
      return NextResponse.json({ events: [], total: 0 });
    }

    const assetIds = watchlist.map(w => w.asset_id);

    // Get asset names
    const { data: assets } = await supabase
      .from('clinical_assets')
      .select('id, asset_name, company_name')
      .in('id', assetIds);

    const assetMap = new Map((assets || []).map(a => [a.id, a]));

    // Get upcoming trial completions for watched assets
    const { data: trials } = await supabase
      .from('company_trials')
      .select('company_name, intervention_name, nct_id, trial_title, phase, primary_completion_date')
      .not('primary_completion_date', 'is', null)
      .gte('primary_completion_date', new Date().toISOString().split('T')[0])
      .order('primary_completion_date', { ascending: true })
      .limit(50);

    const events: TimelineEvent[] = [];
    if (trials) {
      for (const trial of trials) {
        const matchedAsset = assets?.find(a =>
          trial.intervention_name?.toLowerCase().includes(a.asset_name.toLowerCase())
        );
        if (matchedAsset) {
          events.push({
            date: trial.primary_completion_date!,
            type: 'trial_completion',
            title: `${matchedAsset.asset_name} — ${trial.nct_id}`,
            detail: `${trial.trial_title || ''} (${trial.phase || 'unknown'})`,
            asset_id: matchedAsset.id,
            asset_name: matchedAsset.asset_name,
            company_name: matchedAsset.company_name,
          });
        }
      }
    }

    return NextResponse.json({
      events: events.slice(0, 30),
      total: events.length,
    });
  }

  return NextResponse.json({
    error: 'Provide asset_id or watchlist=true',
    usage: {
      single_asset: '/api/radar/timeline?asset_id=UUID',
      watchlist: '/api/radar/timeline?watchlist=true',
    },
  }, { status: 400 });
}
