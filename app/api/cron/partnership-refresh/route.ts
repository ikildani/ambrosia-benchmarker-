/**
 * Cron: Partnership Refresh (Search & Evaluation, Phase 2 item 7)
 *
 * Re-derives partnership_status / partner / territory split / evidence for
 * clinical_assets using lib/radar/partnership.ts (deals constrained to the
 * asset's company, trial collaborators, press releases).
 *
 * Modes (auto-selected unless ?mode= is given):
 *   backlog      never-checked assets, oldest first, 5,000 per run; assets
 *                whose company has no signal source at all are stamped
 *                unpartnered in bulk first (migration 113).
 *   incremental  only assets whose company gained a deal, press mention or
 *                trial row since they were last checked, plus a rolling
 *                30-day re-check.
 *
 * Schedule (vercel.json): backlog `45 * * * *` (hourly) until the run log
 * reports backlog.never_checked = 0; then `45 4 * * *` (daily, after
 * deals-update at 3 AM and the press-release persist runs).
 *
 * Query params (optional):
 *   ?limit=5000               assets per run
 *   ?mode=backlog|incremental force a mode
 *   ?budget=240000            wall-clock budget in ms (max 280000)
 *   ?mode=families            corporate families only (lib/entities/company-family-run.ts,
 *                             migration 193); &dry_run=1 proposes without writing, &model_calls=N
 *
 * Corporate families also run once a day ahead of the deal ledger (the 00:45 UTC run), with a
 * short budget and at most FAMILY_DAILY_MODEL_CALLS model adjudications.
 */

import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { refreshPartnershipBatch, type RefreshMode } from '@/lib/radar/partnership';
import { logRadarRun, deriveRunStatus } from '@/lib/radar/run-log';
import { withSpendGuard } from '@/lib/ai/spend-guard';
import { runCompanyFamilies, type FamilyModelClient } from '@/lib/entities/company-family-run';

const FAMILY_DAILY_MODEL_CALLS = 30;

function familyClient(): FamilyModelClient | null {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  return apiKey ? (new Anthropic(withSpendGuard('company-family', { apiKey })) as unknown as FamilyModelClient) : null;
}

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

function parsePositiveInt(raw: string | null, fallback: number | undefined): number | undefined {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseMode(raw: string | null): RefreshMode | 'auto' {
  return raw === 'backlog' || raw === 'incremental' ? raw : 'auto';
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
  const mode = parseMode(params.get('mode'));
  const timeBudgetMs = Math.min(parsePositiveInt(params.get('budget'), 240_000) ?? 240_000, 280_000);
  const manual = params.has('mode') || params.has('budget');
  const startedAt = Date.now();

  if (params.get('mode') === 'families') {
    const dryRun = params.get('dry_run') === '1' || params.get('dry_run') === 'true';
    try {
      const fam = await runCompanyFamilies(supabase, {
        dryRun,
        client: familyClient(),
        maxModelCalls: parsePositiveInt(params.get('model_calls'), 60),
        timeBudgetMs: timeBudgetMs - 20_000,
      });
      await logRadarRun(supabase, {
        source: 'asset_universe',
        startedAt,
        status: deriveRunStatus({ errors: fam.errors.length, timedOut: fam.timed_out, processed: fam.written + fam.model_calls, produced: fam.written }),
        runType: 'manual',
        inserted: fam.written,
        errors: fam.errors,
        parameters: { stage: 'company_families', ...fam, sample: fam.sample.slice(0, 10) },
      });
      return NextResponse.json({ success: true, mode: 'families', ...fam });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      await logRadarRun(supabase, { source: 'asset_universe', startedAt, status: 'failed', errors: [message], parameters: { stage: 'company_families', dry_run: dryRun } });
      return NextResponse.json({ success: false, mode: 'families', error: message }, { status: 500 });
    }
  }

  try {
    // Corporate families once a day, before the ledger, so deals link to a licensor's subsidiary
    // or Chinese-name twin the same day (migration 193). Never fails the run.
    let families: Record<string, unknown> | null = null;
    const familyErrors: string[] = [];
    if (!manual && new Date().getUTCHours() === 0) {
      try {
        const fam = await runCompanyFamilies(supabase, { client: familyClient(), maxModelCalls: FAMILY_DAILY_MODEL_CALLS, timeBudgetMs: 90_000 });
        families = { written: fam.written, proposals: fam.proposals, model_calls: fam.model_calls, pending: fam.model_subjects_pending, families: fam.families };
        familyErrors.push(...fam.errors.slice(0, 5).map(e => `company_families: ${e}`));
      } catch (err) {
        familyErrors.push(`company_families failed (is migration 193 applied?): ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Deal -> program ledger first (migration 192): links deals to the licensor's program by drug
    // identifier and creates deal-only programs, so this run's derive sees them. Never fails the run.
    let dealLinks: Record<string, unknown> | null = null;
    let dealLinksError: string | null = null;
    {
      const { data, error } = await supabase.rpc('radar_link_deals');
      if (error) dealLinksError = `radar_link_deals failed (is migration 192 applied?): ${error.message}`;
      else dealLinks = (data ?? null) as Record<string, unknown> | null;
    }

    const result = await refreshPartnershipBatch(supabase, { limit, mode, timeBudgetMs: Math.max(30_000, timeBudgetMs - (Date.now() - startedAt)) });
    if (dealLinksError) result.errors.push(dealLinksError);
    result.errors.push(...familyErrors);

    // Ownership attribution rides on the same cadence: rows whose drug
    // resolution or enrichment moved since their last check get re-derived
    // (radar_apply_ownership, migration 125). Cheap and set-based, so a
    // failure is reported but never fails the partnership run.
    let ownership: Record<string, unknown> | null = null;
    if (Date.now() - startedAt < timeBudgetMs) {
      const { data, error } = await supabase.rpc('radar_apply_ownership', { p_limit: 5000, p_recheck_days: 30 });
      if (error) result.errors.push(`radar_apply_ownership failed (is migration 125 applied?): ${error.message}`);
      else ownership = (data ?? null) as Record<string, unknown> | null;
    }

    const status = deriveRunStatus({
      errors: result.errors.length,
      timedOut: result.timedOut,
      processed: result.processed + result.stampedUnpartnered,
      produced: result.processed + result.stampedUnpartnered,
    });

    const logged = await logRadarRun(supabase, {
      source: 'asset_universe',
      startedAt,
      status,
      runType: manual ? 'manual' : 'scheduled',
      fetched: result.dealsFetched + result.collaboratorRowsFetched + result.pressHitsFetched,
      processed: result.processed + result.stampedUnpartnered,
      updated: result.updated + result.stampedUnpartnered,
      skipped: result.unchanged,
      failed: result.failed,
      errors: result.errors,
      parameters: {
        stage: 'partnership_refresh',
        mode: result.mode,
        limit: limit ?? 5000,
        slices: result.slices,
        transitions: result.transitions,
        status_counts: result.statusCounts,
        stamped_unpartnered: result.stampedUnpartnered,
        stamped_by_previous_status: result.stampedByPreviousStatus,
        changed_detected: result.changedDetected,
        rolling_rechecked: result.rollingRechecked,
        deals_fetched: result.dealsFetched,
        collaborator_rows_fetched: result.collaboratorRowsFetched,
        press_hits_fetched: result.pressHitsFetched,
        backlog: {
          never_checked: result.backlog.neverChecked,
          checked: result.backlog.checked,
          stale_30d: result.backlog.stale30d,
          estimated_runs_remaining: result.backlog.estimatedRunsRemaining,
        },
        timed_out: result.timedOut,
        deal_links: dealLinks,
        families,
        ownership,
      },
      notes: [
        `${result.mode}: ${result.processed} derived, ${result.stampedUnpartnered} bulk-stamped unpartnered`,
        Object.entries(result.transitions).map(([k, v]) => `${k}: ${v}`).join(', ') || null,
        result.backlog.neverChecked !== null ? `backlog ${result.backlog.neverChecked} never checked` : null,
      ].filter(Boolean).join('; '),
    });

    return NextResponse.json({
      success: true,
      mode: result.mode,
      processed: result.processed,
      updated: result.updated,
      unchanged: result.unchanged,
      failed: result.failed,
      stamped_unpartnered: result.stampedUnpartnered,
      stamped_by_previous_status: result.stampedByPreviousStatus,
      changed_detected: result.changedDetected,
      rolling_rechecked: result.rollingRechecked,
      slices: result.slices,
      transitions: result.transitions,
      status_counts: result.statusCounts,
      deals_fetched: result.dealsFetched,
      collaborator_rows_fetched: result.collaboratorRowsFetched,
      press_hits_fetched: result.pressHitsFetched,
      backlog: result.backlog,
      ownership,
      errors: result.errors.slice(0, 10),
      error_count: result.errors.length,
      timed_out: result.timedOut,
      duration_ms: result.durationMs,
      logged,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[partnership-refresh] Fatal error: ${message}`);
    await logRadarRun(supabase, {
      source: 'asset_universe',
      startedAt,
      status: 'failed',
      errors: [message],
      parameters: { stage: 'partnership_refresh', mode },
    });
    return NextResponse.json({ success: false, error: message }, { status: 500 });
  }
}
