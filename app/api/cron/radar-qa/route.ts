/**
 * Cron: Search & Evaluation QA gate (docs/asset-radar-qa.md)
 *
 * Schedule (vercel.json, owned by the orchestrator): weekly, e.g.
 * "0 6 * * 1" (Monday 06:00 UTC, after the overnight Radar crons), plus
 * on-demand before every launch.
 *
 * Query params:
 *   ?mode=invariants        (default) automated checks over the universe;
 *                           writes radar_qa_runs + radar_qa_findings; Slack
 *                           alert when blockers > 0
 *   ?mode=golden_select     (re)select the 200-asset golden set
 *       &size=200 &seed=radar-launch-2026 &replace=0
 *   ?mode=golden_agreement  claude-opus-4-6 re-derivation over the golden set
 *       &batch=20 &maxRequests=60 &maxCost=15
 *   ?mode=report            latest report (JSON) without running anything
 *   ?dry=1                  do not persist (invariants / golden_agreement)
 *
 * Every mode logs one data_ingestion_log row via logRadarRun with
 * source 'asset_universe' and parameters.stage = 'radar_qa'.
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { createServiceClient } from '@/lib/supabase/server';
import { logRadarRun } from '@/lib/radar/run-log';
import { runInvariants } from '@/lib/radar/qa/invariants';
import { runGoldenAgreement, selectGoldenSet } from '@/lib/radar/qa/golden-set';
import { buildQaReport, renderQaReportMarkdown } from '@/lib/radar/qa/report';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

const MODES = ['invariants', 'golden_select', 'golden_agreement', 'report'] as const;
type Mode = (typeof MODES)[number];
const MODEL_RE = /^claude-[a-z0-9-]{3,60}$/;
const SEED_RE = /^[a-zA-Z0-9._-]{1,64}$/;

function parsePositiveInt(raw: string | null, fallback: number | undefined): number | undefined {
  if (!raw) return fallback;
  const n = Number.parseInt(raw, 10);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function parseFloatParam(raw: string | null, fallback: number | undefined): number | undefined {
  if (!raw) return fallback;
  const n = Number.parseFloat(raw);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

/** Slack alert on blockers. lib/slack/notify.ts has no generic sender (its helpers are billing/signup specific), so post directly to the same webhook. */
async function notifyBlockers(text: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.error(`[radar-qa] ${text}`);
    return;
  }
  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text }),
    });
    if (!res.ok) console.error(`[radar-qa] Slack webhook failed: ${res.status}`);
  } catch (err) {
    console.error(`[radar-qa] Slack webhook error: ${err instanceof Error ? err.message : String(err)}`);
  }
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
  const modeRaw = params.get('mode') ?? 'invariants';
  if (!(MODES as readonly string[]).includes(modeRaw)) {
    return NextResponse.json({ success: false, error: `mode must be one of ${MODES.join(', ')}` }, { status: 400 });
  }
  const mode = modeRaw as Mode;
  const dry = params.get('dry') === '1';
  const supabase = createServiceClient();
  const startedAt = Date.now();

  try {
    if (mode === 'report') {
      const report = await buildQaReport(supabase);
      return NextResponse.json({ success: true, mode, report, markdown: renderQaReportMarkdown(report) });
    }

    if (mode === 'invariants') {
      const result = await runInvariants(supabase, { persist: !dry, notes: dry ? 'dry run' : 'scheduled' });
      const failed = result.checks.filter(c => !c.passed);
      const logged = await logRadarRun(supabase, {
        source: 'asset_universe',
        startedAt,
        status: result.errors.length > 0 ? 'partial' : 'completed',
        runType: dry ? 'manual' : 'scheduled',
        fetched: result.universe_size,
        processed: result.checks.length,
        failed: failed.length,
        errors: result.errors,
        parameters: {
          stage: 'radar_qa',
          mode,
          run_id: result.run_id,
          passed: result.passed,
          blockers: result.blockers,
          majors: result.majors,
          minors: result.minors,
          failed_checks: failed.map(c => c.check_name),
        },
      });
      if (result.blockers > 0) {
        const lines = failed.filter(c => c.severity === 'blocker').map(c => `• ${c.check_name}: ${c.observed}`).slice(0, 10);
        await notifyBlockers(`:rotating_light: Search & Evaluation QA: ${result.blockers} blocker(s), ${result.majors} major(s) — launch gate FAILED\n${lines.join('\n')}\nRun ${result.run_id ?? '(not persisted)'} · /api/radar/qa`);
      }
      return NextResponse.json({
        success: result.errors.length === 0,
        mode,
        run_id: result.run_id,
        passed: result.passed,
        universe_size: result.universe_size,
        blockers: result.blockers,
        majors: result.majors,
        minors: result.minors,
        failed_checks: failed.map(c => ({ check_name: c.check_name, severity: c.severity, expected: c.expected, observed: c.observed, count: c.count, failing_ids: c.failing_ids })),
        errors: result.errors.slice(0, 10),
        duration_ms: result.duration_ms,
        logged,
      });
    }

    if (mode === 'golden_select') {
      const seedRaw = params.get('seed');
      const result = await selectGoldenSet(supabase, {
        size: parsePositiveInt(params.get('size'), undefined),
        seed: seedRaw && SEED_RE.test(seedRaw) ? seedRaw : undefined,
        perStratum: parsePositiveInt(params.get('perStratum'), undefined),
        replace: params.get('replace') !== '0',
      });
      const logged = await logRadarRun(supabase, {
        source: 'asset_universe',
        startedAt,
        status: result.errors.length > 0 ? 'partial' : 'completed',
        runType: 'manual',
        fetched: result.size,
        processed: result.selected,
        inserted: result.selected,
        errors: result.errors,
        parameters: { stage: 'radar_qa', mode, seed: result.seed, shortfall: result.shortfall, removed: result.removed, filled: result.filled },
      });
      return NextResponse.json({ success: result.errors.length === 0, mode, ...result, logged });
    }

    // golden_agreement
    if (!process.env.ANTHROPIC_API_KEY) {
      return NextResponse.json({ success: false, error: 'ANTHROPIC_API_KEY is not set' }, { status: 500 });
    }
    const modelRaw = params.get('model');
    const client = new Anthropic({ maxRetries: 0, timeout: 120_000 });
    const report = await runGoldenAgreement(supabase, client, {
      model: modelRaw && MODEL_RE.test(modelRaw) ? modelRaw : undefined,
      batchSize: parsePositiveInt(params.get('batch'), undefined),
      partnershipBatchSize: parsePositiveInt(params.get('pbatch'), undefined),
      maxRequests: parsePositiveInt(params.get('maxRequests'), undefined),
      maxCostUsd: parseFloatParam(params.get('maxCost'), undefined),
      timeBudgetMs: 240_000,
      persist: !dry,
    });
    const passed = report.run_id ? report.errors.length === 0 : false;
    const logged = await logRadarRun(supabase, {
      source: 'asset_universe',
      startedAt,
      status: report.errors.length > 0 ? 'partial' : 'completed',
      runType: 'manual',
      fetched: report.golden_size,
      processed: report.classified_compared,
      errors: report.errors,
      parameters: {
        stage: 'radar_qa',
        mode,
        run_id: report.run_id,
        model: report.model,
        fields: report.fields,
        partnership: { compared: report.partnership.compared, agreement_pct: report.partnership.agreement_pct, kappa: report.partnership.kappa },
        requests: report.requests,
        tokens: report.tokens,
        estimated_cost_usd: report.estimated_cost_usd,
      },
    });
    return NextResponse.json({
      success: passed || dry,
      mode,
      run_id: report.run_id,
      model: report.model,
      golden_size: report.golden_size,
      classified_compared: report.classified_compared,
      partnership_compared: report.partnership_compared,
      fields: report.fields,
      partnership: { compared: report.partnership.compared, agree: report.partnership.agree, agreement_pct: report.partnership.agreement_pct, kappa: report.partnership.kappa, confusion: report.partnership.confusion },
      disagreements: report.disagreements.slice(0, 50),
      partnership_disagreements: report.partnership_disagreements.slice(0, 50),
      requests: report.requests,
      tokens: report.tokens,
      estimated_cost_usd: report.estimated_cost_usd,
      errors: report.errors.slice(0, 10),
      duration_ms: report.duration_ms,
      logged,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`[radar-qa] Fatal error (${mode}): ${message}`);
    await logRadarRun(supabase, {
      source: 'asset_universe',
      startedAt,
      status: 'failed',
      runType: 'scheduled',
      errors: [message],
      parameters: { stage: 'radar_qa', mode },
    });
    return NextResponse.json({ success: false, mode, error: message }, { status: 500 });
  }
}
