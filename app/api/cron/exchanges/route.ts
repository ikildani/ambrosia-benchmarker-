/**
 * Cron: global exchange and issuer-release adapters, rotating.
 *
 * One cron entry (Vercel caps a project at 100), every 30 minutes. Each run:
 *   1. polls MFN (Nordic + EQS-relayed European issuer releases) — the feed only
 *      holds the latest 48 items, so it is checked on every run;
 *   2. runs adapters from a rotation cursor for as long as the budget allows,
 *      each with its own budget, and persists the cursor after each one.
 * With seven adapters and 48 runs a day every adapter runs several times a day.
 *
 * Adapters: hkex_daily, tdnet (Japan), asx (Australia), dart (Korea, needs
 * DART_API_KEY), cninfo (mainland China), hkex_backfill (2017→), mfn (every run).
 * Manual: ?only=<key>&dryRun=true runs one adapter.
 */
import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import { createServiceClient } from '@/lib/supabase/server';
import { logCronRun } from '@/lib/cron-utils';
import { readSyncCursor, writeSyncCursor } from '@/lib/radar/sync-cursor';
import { runHkexIngestion } from '@/lib/ingestion/exchanges/hkex';
import { runTdnetIngestion } from '@/lib/ingestion/exchanges/tdnet';
import { runAsxIngestion } from '@/lib/ingestion/exchanges/asx';
import { runDartIngestion } from '@/lib/ingestion/exchanges/dart';
import { runCninfoIngestion } from '@/lib/ingestion/exchanges/cninfo';
import { runMfnIngestion } from '@/lib/ingestion/exchanges/mfn';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const TOTAL_BUDGET_MS = 250_000;
const ROTATION_CURSOR = 'exchanges_rotation';

interface AdapterLog {
  fetched: number; processed: number; inserted: number; errors: string[];
  funnel?: Record<string, unknown>; parameters?: Record<string, unknown>; expectRecords?: boolean;
  status?: 'completed' | 'partial' | 'failed'; notes?: string;
}
interface Adapter {
  key: string;
  source: string;
  budgetMs: number;
  run: (supabase: SupabaseClient, ctx: { anthropicApiKey: string; dryRun: boolean; budgetMs: number }) => Promise<AdapterLog>;
}

const ADAPTERS: Adapter[] = [
  {
    key: 'hkex_daily', source: 'hkex_announcements', budgetMs: 70_000,
    run: async (sb, c) => { const r = await runHkexIngestion(sb, { anthropicApiKey: c.anthropicApiKey, dryRun: c.dryRun, mode: 'daily', timeBudgetMs: c.budgetMs });
      return { fetched: r.announcements, processed: r.extracted, inserted: r.inserted, errors: r.errors, funnel: r.funnel as Record<string, unknown> | undefined, parameters: { mode: 'daily', window: r.window, dealTitles: r.dealTitles, throttled: r.throttled }, status: r.throttled ? 'partial' : undefined }; },
  },
  {
    key: 'tdnet', source: 'tdnet_announcements', budgetMs: 60_000,
    run: async (sb, c) => { const r = await runTdnetIngestion(sb, { anthropicApiKey: c.anthropicApiKey, dryRun: c.dryRun, timeBudgetMs: c.budgetMs });
      return { fetched: r.disclosures, processed: r.extracted, inserted: r.inserted, errors: r.errors, funnel: r.funnel as Record<string, unknown> | undefined, parameters: { dates: r.dates, dealTitles: r.dealTitles }, expectRecords: r.disclosures > 0 }; },
  },
  {
    key: 'asx', source: 'asx_announcements', budgetMs: 90_000,
    run: async (sb, c) => { const r = await runAsxIngestion(sb, { anthropicApiKey: c.anthropicApiKey, dryRun: c.dryRun, timeBudgetMs: c.budgetMs });
      return { fetched: r.announcements, processed: r.extracted, inserted: r.inserted, errors: r.errors, funnel: r.funnel as Record<string, unknown> | undefined, parameters: { codesScanned: r.codesScanned, deepCode: r.deepCode, dealHeadlines: r.dealHeadlines }, expectRecords: r.codesScanned > 0 }; },
  },
  {
    key: 'dart', source: 'dart_announcements', budgetMs: 80_000,
    run: async (sb, c) => { const r = await runDartIngestion(sb, { anthropicApiKey: c.anthropicApiKey, dryRun: c.dryRun, timeBudgetMs: c.budgetMs });
      return { fetched: r.disclosures, processed: r.extracted, inserted: r.inserted, errors: r.errors, funnel: r.funnel as Record<string, unknown> | undefined, parameters: { window: r.window, configured: r.configured, dealReports: r.dealReports }, expectRecords: r.configured, notes: r.configured ? undefined : 'DART_API_KEY not configured' }; },
  },
  {
    key: 'cninfo', source: 'cninfo_announcements', budgetMs: 110_000,
    run: async (sb, c) => { const r = await runCninfoIngestion(sb, { anthropicApiKey: c.anthropicApiKey, dryRun: c.dryRun, timeBudgetMs: c.budgetMs });
      return { fetched: r.fetched, processed: r.extracted, inserted: r.inserted, errors: r.errors, funnel: r.funnel as Record<string, unknown> | undefined, parameters: { candidates: r.candidates, ...(r.parameters ?? {}) }, expectRecords: r.expectRecords }; },
  },
  {
    key: 'hkex_backfill', source: 'hkex_backfill', budgetMs: 120_000,
    run: async (sb, c) => { const r = await runHkexIngestion(sb, { anthropicApiKey: c.anthropicApiKey, dryRun: c.dryRun, mode: 'backfill', timeBudgetMs: c.budgetMs });
      return { fetched: r.announcements, processed: r.extracted, inserted: r.inserted, errors: r.errors, funnel: r.funnel as Record<string, unknown> | undefined, parameters: { mode: 'backfill', window: r.window, dealTitles: r.dealTitles, next: r.next ?? null, throttled: r.throttled }, status: r.throttled ? 'partial' : undefined, expectRecords: !r.throttled }; },
  },
];

const MFN: Adapter = {
  key: 'mfn', source: 'mfn_announcements', budgetMs: 40_000,
  run: async (sb, c) => { const r = await runMfnIngestion(sb, { anthropicApiKey: c.anthropicApiKey, dryRun: c.dryRun, timeBudgetMs: c.budgetMs });
    return { fetched: r.fetched, processed: r.extracted, inserted: r.inserted, errors: r.errors, funnel: r.funnel as Record<string, unknown> | undefined, parameters: { candidates: r.candidates }, expectRecords: r.expectRecords }; },
};

async function runOne(supabase: SupabaseClient, a: Adapter, ctx: { anthropicApiKey: string; dryRun: boolean; budgetMs: number }): Promise<Record<string, unknown>> {
  const started = Date.now();
  try {
    const r = await a.run(supabase, ctx);
    if (!ctx.dryRun) {
      await logCronRun(supabase, a.source, {
        fetched: r.fetched, processed: r.processed, inserted: r.inserted, errors: r.errors, funnel: r.funnel,
        parameters: { adapter: a.key, budgetMs: ctx.budgetMs, ...(r.parameters ?? {}) },
        expectRecords: r.expectRecords, status: r.status, notes: r.notes,
      });
    }
    return { adapter: a.key, ms: Date.now() - started, fetched: r.fetched, extracted: r.processed, inserted: r.inserted, errors: r.errors.slice(0, 5) };
  } catch (error) {
    console.error(`[exchanges] ${a.key} failed:`, error);
    try { if (!ctx.dryRun) await logCronRun(supabase, a.source, { fetched: 0, processed: 0, inserted: 0, errors: [String(error)], status: 'failed' }); } catch {}
    return { adapter: a.key, ms: Date.now() - started, error: String(error).slice(0, 200) };
  }
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  const expected = `Bearer ${cronSecret}`;
  const provided = authHeader || '';
  const ok = provided.length === expected.length && timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
  if (!ok) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!anthropicApiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY not configured' }, { status: 500 });

  const supabase = createServiceClient();
  const dryRun = request.nextUrl.searchParams.get('dryRun') === 'true';
  const only = request.nextUrl.searchParams.get('only');
  const start = Date.now();
  const ran: Record<string, unknown>[] = [];

  if (only) {
    const a = [MFN, ...ADAPTERS].find(x => x.key === only);
    if (!a) return NextResponse.json({ error: `unknown adapter ${only}`, adapters: [MFN, ...ADAPTERS].map(x => x.key) }, { status: 400 });
    ran.push(await runOne(supabase, a, { anthropicApiKey, dryRun, budgetMs: Math.min(a.budgetMs * 2, TOTAL_BUDGET_MS) }));
    return NextResponse.json({ success: true, dryRun, ran });
  }

  // 1. MFN on every run.
  ran.push(await runOne(supabase, MFN, { anthropicApiKey, dryRun, budgetMs: MFN.budgetMs }));

  // 2. Rotation.
  const cur = await readSyncCursor<{ index?: number }>(supabase, ROTATION_CURSOR);
  let index = (cur.state.index ?? 0) % ADAPTERS.length;
  let steps = 0;
  while (steps < ADAPTERS.length) {
    const a = ADAPTERS[index];
    const remaining = TOTAL_BUDGET_MS - (Date.now() - start);
    if (remaining < Math.min(a.budgetMs, 45_000)) break;
    ran.push(await runOne(supabase, a, { anthropicApiKey, dryRun, budgetMs: Math.min(a.budgetMs, remaining - 5_000) }));
    index = (index + 1) % ADAPTERS.length;
    steps++;
    if (!dryRun) await writeSyncCursor(supabase, ROTATION_CURSOR, String(index), { index, lastAdapter: a.key });
  }

  return NextResponse.json({ success: true, dryRun, ran, nextIndex: index, nextAdapter: ADAPTERS[index].key, ms: Date.now() - start });
}
