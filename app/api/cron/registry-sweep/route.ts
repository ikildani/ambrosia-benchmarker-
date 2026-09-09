/**
 * Cron: ex-ClinicalTrials.gov registry sweep (Asset Radar Phase 2 item 5).
 *
 * Round-robins through the registry adapters that can run from Vercel
 * (capability api/bulk with their env present), least-recently-run first,
 * giving each a slice of a 250 s budget, resuming from radar_sync_cursors
 * (`registry:<id>`). Scrape-required registries (PACTR, MyTrial, CDE, ChiCTR,
 * CTRI) are skipped here and fed by the off-Vercel worker.
 *
 * Query params (all optional):
 *   ?registry=ctis        run one adapter only (also allows scrape_required ids to report why they skip)
 *   ?limit=25             per-page record cap passed to the adapter
 *   ?since=2026-01-01     incremental lower bound (adapter-specific)
 *   ?budget=120           per-adapter budget in seconds when round-robining (default 120)
 *   ?pages=3              max pages per adapter
 *
 * Suggested schedule (vercel.json is owned by the orchestrator):
 *   every 2 h  → "0 *\/2 * * *"  keeps ISRCTN/CTIS/Health Canada current and walks the
 *   id-based registries (IRCT, DRKS, CRIS, jRCT, ReBEC) at ~30 pages/day each.
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { logRadarRun, deriveRunStatus } from '@/lib/radar/run-log';
import {
  cursorSource,
  getRegistryAdapter,
  runRegistrySweep,
  sweepableAdapters,
  type AnyRegistryAdapter,
  type SweepResult,
} from '@/lib/ingestion/registries';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const TOTAL_BUDGET_MS = 250_000;
const MIN_SLICE_MS = 15_000;

function parsePositiveInt(raw: string | null, fallback: number | undefined): number | undefined {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

export async function GET(request: NextRequest) {
  const cronSecret = request.headers.get('authorization')?.replace('Bearer ', '');
  const expected = process.env.CRON_SECRET;
  if (!expected || !cronSecret) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    if (!timingSafeEqual(Buffer.from(cronSecret), Buffer.from(expected))) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const startedAt = Date.now();
  const supabase = createServiceClient();
  const params = request.nextUrl.searchParams;
  const only = params.get('registry');
  const limit = parsePositiveInt(params.get('limit'), undefined);
  const maxPages = parsePositiveInt(params.get('pages'), undefined);
  const sinceRaw = params.get('since');
  const since = sinceRaw && /^\d{4}-\d{2}-\d{2}$/.test(sinceRaw) ? sinceRaw : undefined;
  const perAdapterBudgetMs = (parsePositiveInt(params.get('budget'), 120) ?? 120) * 1000;

  let adapters: AnyRegistryAdapter[];
  if (only) {
    const adapter = getRegistryAdapter(only);
    if (!adapter) {
      return NextResponse.json({ success: false, error: `Unknown registry '${only}'` }, { status: 400 });
    }
    adapters = [adapter];
  } else {
    adapters = sweepableAdapters();
    // Least recently run first.
    const lastRun = new Map<string, string>();
    try {
      const { data } = await supabase
        .from('radar_sync_cursors')
        .select('source, last_run_at')
        .in('source', adapters.map(a => cursorSource(a.registry)));
      for (const row of data ?? []) lastRun.set(String(row.source), String(row.last_run_at ?? ''));
    } catch {
      /* first run */
    }
    adapters.sort((a, b) => (lastRun.get(cursorSource(a.registry)) ?? '').localeCompare(lastRun.get(cursorSource(b.registry)) ?? ''));
  }

  const results: SweepResult[] = [];
  const controller = new AbortController();
  const hardStop = setTimeout(() => controller.abort(), TOTAL_BUDGET_MS + 20_000);

  try {
    for (const adapter of adapters) {
      const remaining = TOTAL_BUDGET_MS - (Date.now() - startedAt);
      if (remaining < MIN_SLICE_MS) break;
      const budgetMs = only ? remaining : Math.min(remaining, perAdapterBudgetMs);
      try {
        results.push(await runRegistrySweep(supabase, adapter, { budgetMs, limit, since, maxPages, signal: controller.signal }));
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        results.push({
          registry: adapter.registry, pages: 0, done: false, cursor: null, warnings: [], timedOut: false,
          fetched: 0, stored: 0, bridged: 0, mapped: 0, skipped: 0, companiesCreated: 0, errors: [message], droppedColumns: [],
        });
      }
    }
  } finally {
    clearTimeout(hardStop);
  }

  const totals = results.reduce(
    (acc, r) => ({
      fetched: acc.fetched + r.fetched,
      stored: acc.stored + r.stored,
      bridged: acc.bridged + r.bridged,
      mapped: acc.mapped + r.mapped,
      skipped: acc.skipped + r.skipped,
      companiesCreated: acc.companiesCreated + r.companiesCreated,
      errors: acc.errors + r.errors.length,
    }),
    { fetched: 0, stored: 0, bridged: 0, mapped: 0, skipped: 0, companiesCreated: 0, errors: 0 },
  );
  const timedOut = results.some(r => r.timedOut) || Date.now() - startedAt > TOTAL_BUDGET_MS;
  const perRegistry: Record<string, unknown> = {};
  for (const r of results) {
    perRegistry[r.registry] = {
      pages: r.pages, fetched: r.fetched, stored: r.stored, inserted: r.mapped, bridged: r.bridged, skipped: r.skipped,
      companies_created: r.companiesCreated, errors: r.errors.length, done: r.done, timed_out: r.timedOut,
      unavailable: r.unavailable ?? null, cursor: r.cursor, dropped_columns: r.droppedColumns,
    };
  }

  const logged = await logRadarRun(supabase, {
    source: 'asset_universe',
    startedAt,
    status: deriveRunStatus({ errors: totals.errors, timedOut, processed: totals.fetched, produced: totals.stored }),
    runType: only ? 'manual' : 'scheduled',
    fetched: totals.fetched,
    processed: totals.fetched,
    inserted: totals.mapped,
    updated: totals.bridged,
    skipped: totals.skipped,
    failed: totals.errors,
    errors: results.flatMap(r => r.errors.map(e => `[${r.registry}] ${e}`)),
    parameters: {
      stage: 'registry_sweep',
      registry: only ?? null,
      since: since ?? null,
      registries: perRegistry,
      companies_created: totals.companiesCreated,
      timed_out: timedOut,
    },
    notes: `registry sweep: ${results.map(r => `${r.registry}=${r.mapped}+${r.bridged}b${r.unavailable ? ' (unavailable)' : ''}`).join(', ')}`,
  });

  return NextResponse.json({
    success: true,
    registries: perRegistry,
    totals,
    timed_out: timedOut,
    duration_seconds: Math.round((Date.now() - startedAt) / 1000),
    logged,
    warnings: results.flatMap(r => r.warnings.map(w => `[${r.registry}] ${w}`)).slice(0, 20),
  });
}
