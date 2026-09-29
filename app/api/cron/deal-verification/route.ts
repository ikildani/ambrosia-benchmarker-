/**
 * Cron: Deal Auto-Verification
 *
 * Cross-references pending deals against web sources to verify accuracy.
 * Uses Perplexity search + Claude analysis to mark deals as verified/flagged/rejected.
 *
 * Processes ~20 deals per run. Flagged deals trigger Slack notifications.
 *
 * Schedule: daily (recommended 06:00 UTC — after deal-enrichment, before business hours)
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { logCronRun } from '@/lib/cron-utils';
import { verifyPendingDeals } from '@/lib/ingestion/deal-verifier';
import { checkDealStatuses, type DealStatusResult } from '@/lib/ingestion/deal-status';
import { autoAcceptVerifiedDeals, autoRejectLowConfidenceDeals } from '@/lib/ingestion/auto-remediate';
import { runCronIntelligence, getCronIntelligenceBus } from '@/lib/cron-intelligence';
import { runOutcomePhase } from '@/lib/outcomes/cron';
import { buildFlagResolutionSlack } from '@/lib/ingestion/flag-resolution-report';
import { fixFlaggedDeals, type FlagFixResult } from '@/lib/ingestion/flag-fixer';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

async function postToSlack(attachments: object[], text: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    return;
  }

  try {
    const response = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, attachments }),
    });

    if (!response.ok) {
      const body = await response.text();
      console.error('[Slack] Webhook failed:', response.status, body);
    }
  } catch (error) {
    console.error('[Slack] Webhook error:', error);
  }
}

export async function GET(request: NextRequest) {
  // Auth: timing-safe compare against CRON_SECRET
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });

  const expectedToken = `Bearer ${cronSecret}`;
  const providedToken = authHeader || '';
  const isValidLength = providedToken.length === expectedToken.length;
  const tokenToCompare = isValidLength ? providedToken : expectedToken;
  const isValid = isValidLength && timingSafeEqual(Buffer.from(tokenToCompare), Buffer.from(expectedToken));

  if (!isValid) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const perplexityApiKey = process.env.PERPLEXITY_API_KEY;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
  if (!perplexityApiKey || !anthropicApiKey) {
    return NextResponse.json({ error: 'API keys not configured' }, { status: 500 });
  }

  const supabase = createServiceClient();

  // Read demand signals to prioritize verification of user-demanded TAs
  let priorityTAs: string[] = [];
  try {
    const bus = await getCronIntelligenceBus(supabase);
    priorityTAs = bus.priorityTAs || [];
  } catch {
    // Non-fatal
  }

  // Also read user demand signals for TA priority
  if (priorityTAs.length === 0) {
    try {
      const { data: signalsRow } = await supabase
        .from('system_config')
        .select('value')
        .eq('key', 'user_demand_signals')
        .single();
      const signals = signalsRow?.value as { topTherapeuticAreas?: Array<{ta: string; count: number}> } | null;
      priorityTAs = (signals?.topTherapeuticAreas || []).slice(0, 5).map(s => s.ta);
    } catch {}
  }

  // ?retryFlaggedDays=N re-adjudicates flagged rows untouched for N days (default 1).
  // ?sourceBackfill=N caps the URL-only pass on verified rows without a citation.
  const params = request.nextUrl.searchParams;
  const retryParam = Number(params.get('retryFlaggedDays'));
  const flaggedRetryAfterDays = params.has('retryFlaggedDays') && Number.isFinite(retryParam) && retryParam >= 0 ? retryParam : 1;
  const backfillParam = Number(params.get('sourceBackfill'));
  const sourceBackfillSlots = params.has('sourceBackfill') && Number.isFinite(backfillParam) && backfillParam >= 0 ? Math.min(50, backfillParam) : 15;

  // Deal-status pass: is each cited precedent still in force? Weekly on the
  // first run after 02:00 UTC on Mondays, or on demand with ?dealStatus=N.
  // Comps used in recent briefs go first. It takes at most half the budget.
  const statusParam = Number(params.get('dealStatus'));
  const nowUtc = new Date();
  const weeklyWindow = nowUtc.getUTCDay() === 1 && nowUtc.getUTCHours() === 2 && nowUtc.getUTCMinutes() < 20;
  const statusSlots = params.has('dealStatus') && Number.isFinite(statusParam) && statusParam > 0 ? Math.min(60, statusParam) : weeklyWindow ? 40 : 0;
  let statusResult: DealStatusResult | null = null;
  const passStart = Date.now();
  if (statusSlots > 0) {
    try {
      statusResult = await checkDealStatuses(supabase, perplexityApiKey, anthropicApiKey, { maxDeals: statusSlots, timeBudgetMs: 120_000 });
      console.log(`[deal-status] checked ${statusResult.checked}, updated ${statusResult.updated}`, statusResult.byStatus);
    } catch (e) {
      console.error('[deal-status] failed:', e instanceof Error ? e.message : e);
    }
  }

  // Flag-and-fix (lib/ingestion/flag-fixer.ts) rides on the :40 run each hour
  // because vercel.json is at the 100-cron cap: verification gets a smaller
  // budget on that run and the fixer takes the rest. ?flagFix=N runs it now.
  const flagFixParam = Number(params.get('flagFix'));
  const flagFixSlots = params.has('flagFix') && Number.isFinite(flagFixParam) && flagFixParam > 0
    ? Math.min(10, flagFixParam)
    : nowUtc.getUTCMinutes() >= 40 ? 4 : 0;
  const FLAG_FIX_BUDGET_MS = 110_000;

  const result = await verifyPendingDeals(supabase, perplexityApiKey, anthropicApiKey, {
    maxDeals: 50,
    timeBudgetMs: Math.max(60_000, 250_000 - (flagFixSlots > 0 ? FLAG_FIX_BUDGET_MS : 0) - (Date.now() - passStart)),
    priorityTAs,
    // Fill source_url on already-verified deals with leftover budget (URL-only, verdict untouched)
    sourceBackfillSlots,
    flaggedRetryAfterDays,
  });

  // Every deal flagged in this pass is handed to the flag-fixer now, not posted for review
  // (Issa, Sep 29 2026: "I shouldn't have to review it"). Whatever the budget does not reach
  // is taken by the next hourly fixer slot and reported then. The :40 slot also drains the
  // older backlog.
  let flagFix: FlagFixResult | null = null;
  const mergeFix = (a: FlagFixResult | null, b: FlagFixResult): FlagFixResult => a ? {
    attempted: a.attempted + b.attempted, fixed: a.fixed + b.fixed, duplicates: a.duplicates + b.duplicates,
    rejected: a.rejected + b.rejected, unresolved: a.unresolved + b.unresolved,
    outcomes: [...a.outcomes, ...b.outcomes], errors: [...a.errors, ...b.errors],
  } : b;
  const justFlagged = result.flaggedDeals.map(d => d.id);
  if (justFlagged.length > 0) {
    try {
      flagFix = mergeFix(flagFix, await fixFlaggedDeals(supabase, perplexityApiKey, anthropicApiKey, {
        ids: justFlagged,
        maxDeals: Math.min(justFlagged.length, 8),
        timeBudgetMs: Math.max(30_000, 270_000 - (Date.now() - passStart)),
      }));
    } catch (e) {
      console.error('[flag-fixer] same-run fix failed:', e instanceof Error ? e.message : e);
    }
  }
  if (flagFixSlots > 0 && 270_000 - (Date.now() - passStart) > 40_000) {
    try {
      flagFix = mergeFix(flagFix, await fixFlaggedDeals(supabase, perplexityApiKey, anthropicApiKey, {
        maxDeals: flagFixSlots,
        timeBudgetMs: Math.max(30_000, 270_000 - (Date.now() - passStart)),
      }));
    } catch (e) {
      console.error('[flag-fixer] failed inside deal-verification:', e instanceof Error ? e.message : e);
    }
  }

  // Auto-remediation: accept high-confidence verified deals, reject low-confidence flagged deals
  const acceptResult = await autoAcceptVerifiedDeals(supabase);
  const rejectResult = await autoRejectLowConfidenceDeals(supabase);

  // Canonical recompute: deals.is_canonical defaults to false and only
  // recompute_deal_dedupe() promotes the best row of each dedupe group. Nothing
  // called it after Sep 25 2026, so 2,300 rows (911 verified) sat outside the
  // comparable pool. Run it whenever a verdict changed.
  if (result.verified + result.reverified + result.flagged + acceptResult.fixed + (flagFix ? flagFix.fixed + flagFix.duplicates : 0) > 0 || (statusResult?.updated ?? 0) > 0) {
    const { error: recomputeErr } = await supabase.rpc('recompute_deal_dedupe');
    if (recomputeErr) console.error('[deal-verification] recompute_deal_dedupe failed:', recomputeErr.message);
  }

  // Slack: flagged deals and what was done about each. Never a review request.
  {
    const reached = new Set((flagFix?.outcomes ?? []).map(o => o.dealId));
    const report = buildFlagResolutionSlack({
      outcomes: flagFix?.outcomes ?? [],
      queued: result.flaggedDeals.filter(d => !reached.has(d.id)).map(d => ({ label: d.label, reason: d.reason })),
      errors: flagFix?.errors ?? [],
    });
    if (report) await postToSlack(report.attachments, report.text);
  }

  // Log cron run
  await logCronRun(supabase, 'deal_verification', {
    fetched: result.verified + result.flagged + result.unchanged,
    processed: result.verified + result.flagged,
    inserted: result.verified,
    errors: result.errors,
    parameters: { maxDeals: 50, timeBudgetMs: 250_000, sourceBackfillSlots: 15, sourceUrlsAdded: result.sourceUrlsAdded, reverified: result.reverified, regressions: result.regressions, rolesSwapped: result.rolesSwapped, dealStatus: statusResult ? { checked: statusResult.checked, updated: statusResult.updated, byStatus: statusResult.byStatus, errors: statusResult.errors.length } : null, flagFix: flagFix ? { attempted: flagFix.attempted, fixed: flagFix.fixed, duplicates: flagFix.duplicates, unresolved: flagFix.unresolved, errors: flagFix.errors.length } : null },
    notes: result.regressions > 0 ? `BACKTEST: ${result.regressions} previously verified row(s) no longer hold` : undefined,
  });

  // Intelligence tracking
  try {
    await runCronIntelligence(supabase, 'deal-verification', {
      processed: result.verified + result.flagged + result.unchanged,
      inserted: result.verified,
    });
  } catch {}

  // Outcome ledger phase (Alaric WS1). Lives here because vercel.json is at the
  // 100-cron cap: resolves open predictions against deals ingested since the
  // last run; at 02:00 UTC also runs the Radar writer + accuracy rollups and
  // sends the day-45 / day-120 brief outcome follow-up emails (WS2).
  // Isolated — a failure here never fails verification.
  let outcomes: { autoResolved: number; queued: number; expired: number; followupsSent: number | null; errors: number } | null = null;
  try {
    const phase = await runOutcomePhase(supabase, { rollupHour: 2 });
    outcomes = { autoResolved: phase.resolver.autoResolved, queued: phase.resolver.queued, expired: phase.resolver.expired, followupsSent: phase.followups?.sent ?? null, errors: phase.errors.length };
  } catch (error) {
    console.error('[Outcomes] phase failed inside deal-verification:', error instanceof Error ? error.message : error);
  }

  return NextResponse.json({
    success: true,
    verified: result.verified,
    flagged: result.flagged,
    unchanged: result.unchanged,
    sourceUrlsAdded: result.sourceUrlsAdded,
    errors: result.errors.length,
    outcomes,
  });
}
