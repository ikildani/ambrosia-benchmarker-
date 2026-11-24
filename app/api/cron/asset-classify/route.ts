/**
 * Cron: Asset Classification
 *
 * Fills therapeutic_area, indication, modality, target, target_class and
 * mechanism on clinical_assets from trial evidence (lib/radar/classify.ts).
 * Every run logs to data_ingestion_log via logRadarRun with
 * source 'asset_universe' and parameters.stage = 'classify'.
 *
 * Schedule (vercel.json, owned by the orchestrator): every 30 minutes during
 * the backfill, e.g. "*\/30 * * * *"; hourly once the unclassified backlog is
 * below one run's worth.
 *
 * Query params (all optional):
 *   ?limit=400          assets per run
 *   ?batch=20           assets per model request (1-25)
 *   ?concurrency=3      concurrent model requests
 *   ?maxRequests=40     hard cap on model requests per run (cost cap)
 *   ?model=claude-sonnet-5
 *   ?scope=core|all      core (default) = the feed universe minus non-owned programs; all = long tail too
 *   ?dedupe=0           disable one-call-per-drug (siblings copied from a representative)
 *   ?only=unclassified,needs_review
 *   ?dry=1              plan and log without writing to clinical_assets
 *   ?validate=200       validation mode: re-run N classified assets through
 *                       claude-opus-4-6 (or ?model=) and return the per-field
 *                       agreement report; writes nothing to assets
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { isLean } from '@/lib/ai/budget';
import { aiBudgetAvailable, backlogActive } from '@/lib/ai/spend-guard';
import { timingSafeEqual } from 'crypto';
import {
  DEFAULT_MODEL,
  VALIDATION_MODEL,
  classifyAssetsBatch,
  validateClassificationSample,
} from '@/lib/radar/classify';
import type { ClassificationStatus } from '@/lib/radar/types';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const STATUSES: ClassificationStatus[] = ['unclassified', 'classified', 'needs_review', 'skipped'];
const MODEL_RE = /^claude-[a-z0-9-]{3,60}$/;

function parsePositiveInt(raw: string | null, fallback: number | undefined): number | undefined {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseModel(raw: string | null, fallback: string): string {
  if (!raw) return fallback;
  return MODEL_RE.test(raw) ? raw : fallback;
}

function parseStatuses(raw: string | null): ClassificationStatus[] | undefined {
  if (!raw) return undefined;
  const list = raw.split(',').map(s => s.trim()).filter((s): s is ClassificationStatus => (STATUSES as string[]).includes(s));
  return list.length > 0 ? list : undefined;
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

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ success: false, error: 'ANTHROPIC_API_KEY is not set' }, { status: 500 });
  }

  const supabase = createServiceClient();
  const params = request.nextUrl.searchParams;
  const validate = parsePositiveInt(params.get('validate'), undefined);
  // Leave headroom under maxDuration for the queue read, evidence gathering and the final upsert/log.
  const timeBudgetMs = 250_000;

  try {
    if (validate) {
      const report = await validateClassificationSample(supabase, {
        sample: Math.min(validate, 1000),
        model: parseModel(params.get('model'), VALIDATION_MODEL),
        batchSize: parsePositiveInt(params.get('batch'), 10),
        maxRequests: parsePositiveInt(params.get('maxRequests'), undefined),
        timeBudgetMs,
      });
      return NextResponse.json({ success: report.errors.length === 0, mode: 'validate', ...report });
    }

    const dry = params.get('dry') === '1';
    // Rule-based therapeutic area for visible programs the model left empty (migration 197b): trial
    // conditions, indication text, the drug's other programs, the name. No AI spend; hourly.
    let taInference: unknown = null;
    if (!dry && new Date().getUTCMinutes() < 30) {
      const { data, error } = await supabase.rpc('radar_infer_ta', { p_limit: 20000 });
      taInference = error ? { error: error.message } : data;
    }

    // Once the AI budget is spent for the day the model stage stops, but rule skips and drug_master
    // reuse need no model: run them on a short queue so rows that need no model call are still
    // classified (and the run log says whether anything was). Lean mode also caps requests per run.
    const budget = await aiBudgetAvailable('asset-classify');
    const requestedMax = parsePositiveInt(params.get('maxRequests'), undefined);
    // Backlog allowance (Oct 29 2026): 40 requests a run across the whole industry queue (core first)
    // until the classifier's share is spent; then back to the lean 10 a run, core only.
    const backlog = budget.ok && await backlogActive('asset-classify');
    const leanMax = backlog ? 40 : 10;
    const result = await classifyAssetsBatch(supabase, {
      limit: budget.ok ? parsePositiveInt(params.get('limit'), undefined) : 200,
      batchSize: parsePositiveInt(params.get('batch'), undefined),
      concurrency: parsePositiveInt(params.get('concurrency'), undefined),
      maxRequests: !budget.ok ? 0 : isLean() ? Math.min(requestedMax ?? leanMax, leanMax) : requestedMax,
      model: parseModel(params.get('model'), DEFAULT_MODEL),
      onlyStatuses: parseStatuses(params.get('only')),
      scope: params.get('scope') === 'all' || (backlog && params.get('scope') !== 'core') ? 'all' : 'core',
      dedupeByDrug: params.get('dedupe') !== '0',
      dryRun: dry,
      timeBudgetMs,
      runType: dry ? 'manual' : 'scheduled',
    });

    return NextResponse.json({
      success: true,
      mode: 'classify',
      ai_budget: budget.ok ? 'available' : budget.reason,
      ta_inference: taInference,
      model: result.model,
      fetched: result.fetched,
      processed: result.processed,
      classified: result.classified,
      from_drug_master: result.fromDrugMaster,
      from_sibling: result.fromSibling,
      needs_review: result.needsReview,
      skipped: result.skipped,
      failed: result.failed,
      requests: result.requests,
      retries: result.retries,
      tokens: result.tokens,
      cache_hit_rate_pct: result.cacheHitRate,
      estimated_cost_usd: result.estimatedCostUsd,
      timed_out: result.timedOut,
      request_cap_hit: result.requestCapHit,
      errors: result.errors.slice(0, 10),
      error_count: result.errors.length,
      logged: result.logged,
      dry_run: result.dryRun,
      ...(result.samplePatches ? { sample_patches: result.samplePatches } : {}),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[asset-classify] Fatal error: ${message}`);
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
