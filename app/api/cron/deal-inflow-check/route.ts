/**
 * Cron: deal inflow check. Daily.
 *
 * Counts cited deal rows inserted in the last 24 hours (source_url,
 * press_release_url or source_filing_id present, not synthetic), compares
 * to the trailing 7-day daily floor, and posts to Slack when the number is
 * zero or below the floor. Also lists every productive source whose runs in
 * the window fetched nothing.
 *
 * On Sundays it also posts the coverage-by-year report.
 *
 * Why: between 26 Aug and 17 Sep 2026 every live deal source inserted
 * nothing while logging status 'completed'. Nobody was looking at the
 * numbers that would have shown it. This route looks every day.
 */
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { notifyDealInflow, notifyDealCoverage } from '@/lib/slack/notify';
import { SOURCES_EXPECTING_RECORDS, logCronRun } from '@/lib/cron-utils';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const CITED = 'source_url.not.is.null,press_release_url.not.is.null,source_filing_id.not.is.null';

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  const expected = `Bearer ${cronSecret}`;
  const provided = authHeader || '';
  const ok = provided.length === expected.length && timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const supabase = createServiceClient();
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 86_400_000).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();

  try {
    const { data: last24 } = await supabase.from('deals').select('source_type, created_at')
      .gte('created_at', dayAgo).eq('is_synthetic', false).or(CITED);
    const { data: last7 } = await supabase.from('deals').select('created_at')
      .gte('created_at', weekAgo).lt('created_at', dayAgo).eq('is_synthetic', false).or(CITED);

    const bySource24h: Record<string, number> = {};
    for (const r of last24 ?? []) bySource24h[r.source_type ?? 'unknown'] = (bySource24h[r.source_type ?? 'unknown'] ?? 0) + 1;
    const perDay = new Array(6).fill(0);
    for (const r of last7 ?? []) {
      const ageDays = Math.floor((now.getTime() - new Date(r.created_at).getTime()) / 86_400_000) - 1;
      if (ageDays >= 0 && ageDays < 6) perDay[ageDays]++;
    }
    const avg7d = perDay.reduce((s, n) => s + n, 0) / perDay.length;
    const floor7d = Math.max(1, Math.floor(avg7d * 0.5));
    const count24h = (last24 ?? []).length;

    const { data: runs } = await supabase.from('data_ingestion_log').select('source, records_fetched')
      .gte('started_at', dayAgo);
    const fetchedBySource: Record<string, number> = {};
    for (const r of runs ?? []) fetchedBySource[r.source] = (fetchedBySource[r.source] ?? 0) + (r.records_fetched ?? 0);
    const zeroFetchSources = [...SOURCES_EXPECTING_RECORDS].filter(s => s in fetchedBySource && fetchedBySource[s] === 0);

    const severity: 'ok' | 'low' | 'zero' = count24h === 0 ? 'zero' : count24h < floor7d ? 'low' : 'ok';
    await notifyDealInflow({ last24h: count24h, floor7d, avg7d, bySource24h, zeroFetchSources, severity });

    let coverage: Array<{ year: number; total: number; cited: number; verified: number }> | null = null;
    if (now.getUTCDay() === 0) {
      const { data: rows } = await supabase.from('deals').select('announced_date, source_url, press_release_url, source_filing_id, verified, created_at')
        .eq('is_synthetic', false).gte('announced_date', '2017-01-01');
      const byYear = new Map<number, { year: number; total: number; cited: number; verified: number }>();
      const deltas: Record<number, number> = {};
      for (const r of rows ?? []) {
        const y = Number(String(r.announced_date).slice(0, 4));
        if (!Number.isFinite(y)) continue;
        const b = byYear.get(y) ?? { year: y, total: 0, cited: 0, verified: 0 };
        b.total++;
        const cited = !!(r.source_url || r.press_release_url || r.source_filing_id);
        if (cited) b.cited++;
        if (r.verified) b.verified++;
        if (cited && r.created_at >= weekAgo) deltas[y] = (deltas[y] ?? 0) + 1;
        byYear.set(y, b);
      }
      coverage = [...byYear.values()].sort((a, b) => a.year - b.year);
      await notifyDealCoverage(coverage, deltas);
    }

    await logCronRun(supabase, 'deal_inflow_check', {
      fetched: count24h, processed: 0, inserted: 0, expectRecords: false,
      parameters: { severity, floor7d, avg7d, bySource24h, zeroFetchSources, coverage },
      notes: severity === 'ok' ? undefined : `inflow ${severity}: ${count24h} cited rows in 24h`,
    });
    return NextResponse.json({ success: true, severity, last24h: count24h, floor7d, avg7d, bySource24h, zeroFetchSources, coverage });
  } catch (error) {
    console.error('[deal-inflow-check] failed:', error);
    return NextResponse.json({ error: 'deal inflow check failed' }, { status: 500 });
  }
}
