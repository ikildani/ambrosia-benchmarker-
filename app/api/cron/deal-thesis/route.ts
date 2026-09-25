/**
 * Search & Evaluation Layer 3 — deal thesis cron.
 *
 * Works through the `radar_thesis_queue` backlog (migration 116): every
 * industry-owned, unpartnered / partially-partnered clinical asset gets a
 * thesis; theses older than `refresh_days` (or whose asset changed) are
 * regenerated. Time-boxed; each run resumes where the last one stopped.
 *
 * Overrides (all optional):
 *   ?limit=N            queue size for this run (1..10000, default 3000)
 *   ?refresh_days=N     regenerate theses older than N days (1..365, default 30)
 *   ?min_age_days=N     minimum thesis age before an asset change re-queues it (0..365, default 7)
 *   ?asset_ids=a,b,c    force these assets regardless of age (max 500)
 * Any override marks the run `manual` in data_ingestion_log.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import {
  generateDealTheses,
  DEFAULT_MIN_AGE_DAYS,
  DEFAULT_REFRESH_DAYS,
  DEFAULT_RUN_LIMIT,
  MIN_COMPS_FOR_TERMS,
} from '@/lib/radar/deal-thesis';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const MAX_RUN_LIMIT = 10_000;
const MAX_ASSET_IDS = 500;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function parseIntParam(raw: string | null, name: string, min: number, max: number): { value?: number; error?: string } {
  if (raw === null) return {};
  const parsed = Number.parseInt(raw, 10);
  if (!Number.isFinite(parsed) || String(parsed) !== raw.trim() || parsed < min || parsed > max) {
    return { error: `${name} must be an integer between ${min} and ${max}` };
  }
  return { value: parsed };
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

  const params = request.nextUrl.searchParams;
  const limit = parseIntParam(params.get('limit'), 'limit', 1, MAX_RUN_LIMIT);
  if (limit.error) return NextResponse.json({ error: limit.error }, { status: 400 });
  const refreshDays = parseIntParam(params.get('refresh_days'), 'refresh_days', 1, 365);
  if (refreshDays.error) return NextResponse.json({ error: refreshDays.error }, { status: 400 });
  const minAgeDays = parseIntParam(params.get('min_age_days'), 'min_age_days', 0, 365);
  if (minAgeDays.error) return NextResponse.json({ error: minAgeDays.error }, { status: 400 });

  let assetIds: string[] | undefined;
  const rawIds = params.get('asset_ids');
  if (rawIds !== null) {
    assetIds = rawIds.split(',').map(s => s.trim()).filter(Boolean);
    if (assetIds.length === 0 || assetIds.length > MAX_ASSET_IDS || assetIds.some(id => !UUID_RE.test(id))) {
      return NextResponse.json({ error: `asset_ids must be 1..${MAX_ASSET_IDS} comma-separated UUIDs` }, { status: 400 });
    }
  }

  const isManual = limit.value !== undefined || refreshDays.value !== undefined || minAgeDays.value !== undefined || assetIds !== undefined;
  const supabase = createServiceClient();

  try {
    const result = await generateDealTheses(supabase, {
      limit: limit.value ?? DEFAULT_RUN_LIMIT,
      refreshDays: refreshDays.value ?? DEFAULT_REFRESH_DAYS,
      minAgeDays: minAgeDays.value ?? DEFAULT_MIN_AGE_DAYS,
      assetIds,
      runType: isManual ? 'manual' : 'scheduled',
    });

    const status = result.errors.length > 0 && result.assetsProcessed === 0 && result.assetsQueued > 0
      ? 'failed'
      : result.errors.length > 0 || result.timedOut
        ? 'partial'
        : 'completed';

    return NextResponse.json({
      success: status !== 'failed',
      status,
      queue_source: result.queueSource,
      assets_queued: result.assetsQueued,
      assets_processed: result.assetsProcessed,
      generated: result.generated,
      refreshed: result.refreshed,
      theses_with_terms: result.thesesWithTerms,
      insufficient_comps: result.insufficientComps,
      profiles_cached: result.profilesCached,
      acquirer_profiles_cached: result.acquirerProfilesCached,
      remaining_backlog: result.remainingBacklog,
      duration_seconds: result.durationSeconds,
      min_comps_for_terms: MIN_COMPS_FOR_TERMS,
      limit: limit.value ?? DEFAULT_RUN_LIMIT,
      refresh_days: refreshDays.value ?? DEFAULT_REFRESH_DAYS,
      min_age_days: minAgeDays.value ?? DEFAULT_MIN_AGE_DAYS,
      error_count: result.errors.length,
      errors: result.errors.slice(0, 10),
      timed_out: result.timedOut,
      log_written: result.logWritten,
    }, { status: status === 'failed' ? 500 : 200 });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[deal-thesis] Fatal error: ${message}`);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
