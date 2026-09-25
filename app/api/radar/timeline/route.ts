/**
 * Search & Evaluation — Timeline API
 *
 * GET /api/radar/timeline?asset_id=UUID
 *   Chronology for one asset: trial starts and primary completions (joined by
 *   the asset's own nct_ids, not a name match), score moves from snapshots,
 *   strong licensing signals, and catalysts from asset_catalysts when that
 *   table exists. Split into past / future with the next milestone.
 *
 * GET /api/radar/timeline?watchlist=true
 *   Upcoming primary completions (next 90 days) for the caller's watched
 *   assets, including team-shared rows.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { resolveUserTier } from '@/lib/auth/tier-check';
import { isUuid } from '@/app/api/radar/_lib/radar-api';

export const dynamic = 'force-dynamic';

interface TimelineEvent {
  date: string;
  type: 'trial_completion' | 'trial_start' | 'last_update' | 'score_snapshot' | 'signal_detected' | 'regulatory' | 'catalyst';
  title: string;
  detail: string;
  nct_id?: string;
  url?: string;
  asset_id?: string;
  asset_name?: string;
  company_name?: string;
}

type Row = Record<string, unknown>;

function isoDate(v: unknown): string | null {
  if (!v) return null;
  const d = new Date(String(v));
  return Number.isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
}

export async function GET(request: NextRequest) {
  // Auth-only (not Pro), matching the watchlist it feeds.
  const auth = await resolveUserTier();
  if (!auth.userId) {
    return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
  }

  const assetId = request.nextUrl.searchParams.get('asset_id');
  if (assetId && !isUuid(assetId)) {
    return NextResponse.json({ error: 'asset_id must be a UUID' }, { status: 400 });
  }
  const isWatchlist = request.nextUrl.searchParams.get('watchlist') === 'true';

  const supabase = createServiceClient();
  const today = new Date().toISOString().slice(0, 10);

  // ── Single asset timeline ──────────────────────────
  if (assetId) {
    const { data: asset } = await supabase
      .from('clinical_assets')
      .select('asset_name, company_name, nct_ids, first_posted_date, last_update_date, fda_approval_date, ema_approval_date')
      .eq('id', assetId)
      .maybeSingle();

    if (!asset) return NextResponse.json({ error: 'Asset not found' }, { status: 404 });

    const nctIds: string[] = Array.isArray(asset.nct_ids) ? asset.nct_ids : [];

    const [trialsRes, snapshotsRes, signalsRes, catalystsRes] = await Promise.all([
      nctIds.length > 0
        ? supabase
            .from('company_trials')
            .select('nct_id, trial_title, phase, status, start_date, primary_completion_date, last_update_posted')
            .in('nct_id', nctIds.slice(0, 200))
            .order('primary_completion_date', { ascending: true })
        : Promise.resolve({ data: [] as Row[] }),
      supabase
        .from('asset_signal_snapshots')
        .select('snapshot_date, licensing_intent_score, trend, score_delta')
        .eq('asset_id', assetId)
        .order('snapshot_date', { ascending: true })
        .limit(120),
      supabase
        .from('licensing_signals')
        .select('signal_type, signal_value, direction, evidence_text, evidence_url, evidence_date, detected_at')
        .eq('asset_id', assetId)
        .gte('signal_value', 30)
        .order('detected_at', { ascending: true })
        .limit(20),
      supabase
        .from('asset_catalysts')
        .select('id, catalyst_date, catalyst_type, title, detail, nct_id, source_url')
        .eq('asset_id', assetId)
        .order('catalyst_date', { ascending: true })
        .limit(40)
        .then(r => r, () => ({ data: null })),
    ]);

    const events: TimelineEvent[] = [];

    for (const trial of (trialsRes.data || []) as Row[]) {
      const nct = String(trial.nct_id);
      const pcd = isoDate(trial.primary_completion_date);
      if (pcd) {
        events.push({
          date: pcd,
          type: 'trial_completion',
          title: `Primary completion: ${nct}`,
          detail: `${trial.trial_title || 'Trial'} — ${String(trial.phase || 'unknown phase').replace(/_/g, ' ')} (${String(trial.status || 'unknown status').replace(/_/g, ' ')})`,
          nct_id: nct,
          url: `https://clinicaltrials.gov/study/${nct}`,
        });
      }
      const start = isoDate(trial.start_date);
      if (start) {
        events.push({
          date: start,
          type: 'trial_start',
          title: `Trial started: ${nct}`,
          detail: `${trial.trial_title || 'Trial'} — ${String(trial.phase || 'unknown phase').replace(/_/g, ' ')}`,
          nct_id: nct,
          url: `https://clinicaltrials.gov/study/${nct}`,
        });
      }
    }

    for (const snap of (snapshotsRes.data || []) as Row[]) {
      const delta = Number(snap.score_delta) || 0;
      if (delta === 0) continue;
      events.push({
        date: String(snap.snapshot_date),
        type: 'score_snapshot',
        title: `Intent score: ${Math.round(Number(snap.licensing_intent_score))} (${snap.trend})`,
        detail: `Change: ${delta > 0 ? '+' : ''}${Math.round(delta)} points`,
      });
    }

    for (const sig of (signalsRes.data || []) as Row[]) {
      const date = isoDate(sig.evidence_date) || isoDate(sig.detected_at);
      if (!date) continue;
      events.push({
        date,
        type: 'signal_detected',
        title: `${String(sig.signal_type).replace(/_/g, ' ')} signal (${Math.round(Number(sig.signal_value))})`,
        detail: String(sig.evidence_text || '').slice(0, 160),
        url: (sig.evidence_url as string | null) || undefined,
      });
    }

    for (const c of ((catalystsRes as { data: Row[] | null }).data || [])) {
      const date = isoDate(c.catalyst_date);
      if (!date) continue;
      events.push({
        date,
        type: 'catalyst',
        title: String(c.title || c.catalyst_type || 'Catalyst'),
        detail: String(c.detail || ''),
        nct_id: (c.nct_id as string | null) || undefined,
        url: (c.source_url as string | null) || undefined,
      });
    }

    const fda = isoDate(asset.fda_approval_date);
    if (fda) events.push({ date: fda, type: 'regulatory', title: 'FDA approval', detail: asset.asset_name });
    const ema = isoDate(asset.ema_approval_date);
    if (ema) events.push({ date: ema, type: 'regulatory', title: 'EMA approval', detail: asset.asset_name });

    events.sort((a, b) => a.date.localeCompare(b.date));

    const past = events.filter(e => e.date <= today);
    const future = events.filter(e => e.date > today);

    return NextResponse.json({
      asset: { name: asset.asset_name, company: asset.company_name },
      timeline: events,
      past: past.slice(-30),
      future,
      next_milestone: future[0] || null,
    });
  }

  // ── Watchlist timeline ─────────────────────────────
  if (isWatchlist) {
    const { data: membership } = await supabase
      .from('team_members')
      .select('team_id')
      .eq('user_id', auth.userId)
      .eq('status', 'active')
      .limit(1)
      .maybeSingle();
    const teamId = (membership as { team_id?: string } | null)?.team_id ?? null;

    let watchQuery = supabase.from('radar_watchlist').select('asset_id');
    watchQuery = teamId
      ? watchQuery.or(`user_id.eq.${auth.userId},team_id.eq.${teamId}`)
      : watchQuery.eq('user_id', auth.userId);
    const { data: watchlist } = await watchQuery;

    if (!watchlist || watchlist.length === 0) {
      return NextResponse.json({ events: [], total: 0 });
    }

    const assetIds = Array.from(new Set(watchlist.map(w => w.asset_id as string)));

    const { data: assets } = await supabase
      .from('clinical_assets')
      .select('id, asset_name, company_name, nct_ids')
      .in('id', assetIds);

    const nctToAsset = new Map<string, { id: string; asset_name: string; company_name: string }>();
    for (const a of (assets || []) as Row[]) {
      for (const nct of (Array.isArray(a.nct_ids) ? a.nct_ids : []) as string[]) {
        nctToAsset.set(nct, { id: String(a.id), asset_name: String(a.asset_name), company_name: String(a.company_name) });
      }
    }
    const allNct = Array.from(nctToAsset.keys()).slice(0, 500);

    const horizon = new Date();
    horizon.setUTCDate(horizon.getUTCDate() + 90);

    const { data: trials } = allNct.length > 0
      ? await supabase
          .from('company_trials')
          .select('nct_id, trial_title, phase, primary_completion_date')
          .in('nct_id', allNct)
          .gte('primary_completion_date', today)
          .lte('primary_completion_date', horizon.toISOString().slice(0, 10))
          .order('primary_completion_date', { ascending: true })
          .limit(60)
      : { data: [] as Row[] };

    const events: TimelineEvent[] = [];
    for (const trial of (trials || []) as Row[]) {
      const a = nctToAsset.get(String(trial.nct_id));
      if (!a) continue;
      events.push({
        date: String(trial.primary_completion_date),
        type: 'trial_completion',
        title: `${a.asset_name} — ${trial.nct_id}`,
        detail: `${trial.trial_title || ''} (${String(trial.phase || 'unknown').replace(/_/g, ' ')})`,
        nct_id: String(trial.nct_id),
        url: `https://clinicaltrials.gov/study/${trial.nct_id}`,
        asset_id: a.id,
        asset_name: a.asset_name,
        company_name: a.company_name,
      });
    }

    return NextResponse.json({ events: events.slice(0, 30), total: events.length });
  }

  return NextResponse.json({
    error: 'Provide asset_id or watchlist=true',
    usage: {
      single_asset: '/api/radar/timeline?asset_id=UUID',
      watchlist: '/api/radar/timeline?watchlist=true',
    },
  }, { status: 400 });
}
