/**
 * Cron: Drug Master Resolver
 *
 * Resolves clinical_assets rows to drug_master nodes (migration 107) in two
 * passes per invocation (lib/radar/drug-master.ts resolveAssetsBatch):
 *
 *   local     up to 5,000 queued assets, no network: batched drug_aliases
 *             lookups, placebo / procedure names closed as non-drug, unmatched
 *             industry-owned names minted as internal rows in bulk.
 *   external  internal drug rows still unchecked, industry-owned and
 *             late-phase first, against NCATS GSRS / ChEMBL / PubChem with
 *             per-host limiters and a 30-day negative cache (migration 113).
 *
 * Schedule (vercel.json): backlog `20 * * * *` (hourly) until the run log
 * reports backlog.unresolved_never_attempted = 0 and
 * backlog.internal_pending_external < ~1,000; then `20 3 * * *` (daily, after
 * asset-universe). Time budget 250 s.
 *
 * Query params (all optional):
 *   ?limit=5000         assets the local pass takes per run
 *   ?external=0|1       skip / run the external pass (default 1)
 *   ?external_limit=900 internal drug rows the external pass takes per run
 *   ?concurrency=4      drug rows resolved concurrently in the external pass (1-8)
 *   ?retry=0            do not re-check internal rows whose last external check is > 30 days old
 *   ?budget=250000      wall-clock budget in ms (max 280000)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { resolveAssetsBatch } from '@/lib/radar/drug-master';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

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

  const supabase = createServiceClient();
  const params = request.nextUrl.searchParams;
  const limit = parsePositiveInt(params.get('limit'), undefined);
  const externalLimit = parsePositiveInt(params.get('external_limit'), undefined);
  const externalConcurrency = parsePositiveInt(params.get('concurrency'), undefined);
  const timeBudgetMs = Math.min(parsePositiveInt(params.get('budget'), 250_000) ?? 250_000, 280_000);
  const allowExternal = params.get('external') !== '0';
  // ?retry=0 restricts the external pass to never-checked internal rows.
  const recheckDays = params.get('retry') === '0' ? 36_500 : undefined;
  const manual = ['limit', 'external', 'external_limit', 'concurrency', 'retry', 'budget'].some(k => params.has(k));

  try {
    const result = await resolveAssetsBatch(supabase, {
      limit,
      timeBudgetMs,
      allowExternal,
      externalLimit,
      externalConcurrency,
      recheckDays,
      runType: manual ? 'manual' : 'scheduled',
    });

    return NextResponse.json({
      success: true,
      fetched: result.fetched,
      processed: result.processed,
      resolved: result.resolved,
      ambiguous: result.ambiguous,
      unresolvable: result.unresolvable,
      non_drug: result.nonDrug,
      failed: result.failed,
      combinations: result.combinations,
      drugs_created: result.drugsCreated,
      aliases_recorded: result.aliasesRecorded,
      owners_written: result.ownersWritten,
      external_calls: result.externalCalls,
      local: result.local,
      external: result.external,
      backlog: result.backlog,
      cross_company_duplicates: result.crossCompanyDuplicates.count,
      duplicate_groups: result.crossCompanyDuplicates.groups.slice(0, 20),
      errors: result.errors.slice(0, 10),
      error_count: result.errors.length,
      timed_out: result.timedOut,
      duration_ms: result.durationMs,
      logged: result.logged,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[drug-resolve] Fatal error: ${message}`);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
