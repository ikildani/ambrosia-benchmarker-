/**
 * Cron: Drug Master Resolver
 *
 * Resolves clinical_assets rows to drug_master nodes (migration 107) using
 * the alias table first and free public sources (NCATS GSRS, ChEMBL, PubChem)
 * on a miss. Writes drug_master_id / drug_resolution_status / confidence on
 * the asset, records owners in drug_owners, and reports cross-company
 * duplicate groups in the run log.
 *
 * Schedule: every 2 hours until the backlog clears, then daily after
 * asset-universe (see vercel.json). Time budget 250 s, ~3 external req/s.
 *
 * Query params (all optional):
 *   ?limit=400        assets per run
 *   ?external=0       skip GSRS/ChEMBL/PubChem (alias + internal rows only)
 *   ?retry=1          also retry internal 'unresolvable' rows older than 30 days
 *   ?budget=250000    wall-clock budget in ms
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
  const timeBudgetMs = Math.min(parsePositiveInt(params.get('budget'), 250_000) ?? 250_000, 280_000);
  const allowExternal = params.get('external') !== '0';
  const retryUnresolvable = params.get('retry') === '1';

  try {
    const result = await resolveAssetsBatch(supabase, {
      limit,
      timeBudgetMs,
      allowExternal,
      retryUnresolvable,
      runType: params.has('limit') || params.has('retry') ? 'manual' : 'scheduled',
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
