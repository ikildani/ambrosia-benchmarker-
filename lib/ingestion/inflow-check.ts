/**
 * Deal inflow check.
 *
 * Counts cited deal rows inserted in the last 24 hours (source_url,
 * press_release_url or source_filing_id present, not synthetic), compares
 * to the trailing 7-day daily floor, and posts to Slack when the number is
 * zero or below the floor. Also lists every productive source whose runs in
 * the window fetched nothing. On Sundays it also posts the coverage-by-year
 * report.
 *
 * Why: between 26 Aug and 17 Sep 2026 every live deal source inserted
 * nothing while logging status 'completed'. Nobody was looking at the
 * numbers that would have shown it. This looks every day.
 *
 * Sep 23 2026: moved out of /api/cron/deal-inflow-check into a library so
 * the hourly api-credit-check sentinel can run it at 13:00 UTC. Vercel caps
 * a project at 100 cron entries and the two monitors now share one.
 */
import type { SupabaseClient } from '@supabase/supabase-js';
import { notifyDealInflow, notifyDealCoverage } from '../slack/notify';
import { SOURCES_EXPECTING_RECORDS, logCronRun } from '../cron-utils';

const CITED = 'source_url.not.is.null,press_release_url.not.is.null,source_filing_id.not.is.null';

export interface CoverageRow { year: number; total: number; cited: number; verified: number }

export interface QualityReport {
  /** Verifier, last 24h. */
  verified: number;
  flagged: number;
  reverified: number;
  regressions: number;
  rolesSwapped: number;
  /** Inserts refused as likely duplicates across every pipeline, last 24h (funnel insert_duplicate + duplicate_same_day). */
  duplicatesBlocked: number;
  /** Rows superseded by the dedupe pass, last 24h. */
  superseded: number;
  /** Corpus totals right now. */
  realRows: number;
  verifiedRows: number;
  citedRows: number;
  pendingRows: number;
}

export interface InflowReport {
  severity: 'ok' | 'low' | 'zero';
  quality: QualityReport;
  last24h: number;
  floor7d: number;
  avg7d: number;
  bySource24h: Record<string, number>;
  zeroFetchSources: string[];
  coverage: CoverageRow[] | null;
}

export async function runDealInflowCheck(supabase: SupabaseClient, now: Date = new Date()): Promise<InflowReport> {
  const dayAgo = new Date(now.getTime() - 86_400_000).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 86_400_000).toISOString();

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

  // Quality, last 24h: verifier counters and duplicate refusals from the run log, plus corpus totals.
  const quality: QualityReport = { verified: 0, flagged: 0, reverified: 0, regressions: 0, rolesSwapped: 0, duplicatesBlocked: 0, superseded: 0, realRows: 0, verifiedRows: 0, citedRows: 0, pendingRows: 0 };
  try {
    const { data: vruns } = await supabase.from('data_ingestion_log').select('records_inserted, records_processed, parameters').eq('source', 'deal_verification').gte('started_at', dayAgo);
    for (const r of vruns ?? []) {
      const p = (r.parameters ?? {}) as Record<string, number>;
      quality.verified += r.records_inserted ?? 0;
      quality.flagged += Math.max(0, (r.records_processed ?? 0) - (r.records_inserted ?? 0));
      quality.reverified += p.reverified ?? 0;
      quality.regressions += p.regressions ?? 0;
      quality.rolesSwapped += p.rolesSwapped ?? 0;
    }
    const { data: allRuns } = await supabase.from('data_ingestion_log').select('parameters').gte('started_at', dayAgo).not('parameters->funnel', 'is', null);
    for (const r of allRuns ?? []) {
      const stages = ((r.parameters as Record<string, unknown>)?.funnel as { stages?: Record<string, number> } | undefined)?.stages ?? {};
      quality.duplicatesBlocked += (stages.insert_duplicate ?? 0) + (stages.duplicate_same_day ?? 0);
    }
    const [sup, real, ver, cited, pend] = await Promise.all([
      supabase.from('deals').select('*', { count: 'exact', head: true }).not('duplicate_of', 'is', null).gte('updated_at', dayAgo),
      supabase.from('deals').select('*', { count: 'exact', head: true }).eq('is_synthetic', false),
      supabase.from('deals').select('*', { count: 'exact', head: true }).eq('is_synthetic', false).eq('verification_status', 'verified'),
      supabase.from('deals').select('*', { count: 'exact', head: true }).eq('is_synthetic', false).or(CITED),
      supabase.from('deals').select('*', { count: 'exact', head: true }).eq('is_synthetic', false).eq('verification_status', 'pending'),
    ]);
    quality.superseded = sup.count ?? 0; quality.realRows = real.count ?? 0; quality.verifiedRows = ver.count ?? 0; quality.citedRows = cited.count ?? 0; quality.pendingRows = pend.count ?? 0;
  } catch (e) { console.error('[inflow-check] quality block failed (non-fatal):', e); }

  await notifyDealInflow({ last24h: count24h, floor7d, avg7d, bySource24h, zeroFetchSources, severity, quality });

  let coverage: CoverageRow[] | null = null;
  if (now.getUTCDay() === 0) {
    const { data: rows } = await supabase.from('deals').select('announced_date, source_url, press_release_url, source_filing_id, verified, created_at')
      .eq('is_synthetic', false).gte('announced_date', '2017-01-01');
    const byYear = new Map<number, CoverageRow>();
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
    parameters: { severity, floor7d, avg7d, bySource24h, zeroFetchSources, coverage, quality },
    notes: severity === 'ok' ? undefined : `inflow ${severity}: ${count24h} cited rows in 24h`,
  });

  return { severity, quality, last24h: count24h, floor7d, avg7d, bySource24h, zeroFetchSources, coverage };
}
