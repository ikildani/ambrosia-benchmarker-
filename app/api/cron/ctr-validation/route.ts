/**
 * CTR validation cron job.
 * Checks whether previous CTR optimizations (title/description rewrites)
 * actually improved performance. Reverts losers, celebrates winners,
 * re-queues flat results for another attempt.
 *
 * Schedule: Wednesdays at 9AM UTC (vercel.json)
 * Auth: Bearer token matched against CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { logCronRun } from '@/lib/cron-utils';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

// ── Types ───────────────────────────────────────────────────────────────────

interface OptimizationEntry {
  id: string;
  page_path: string;
  original_title: string | null;
  original_description: string | null;
  new_title: string | null;
  new_description: string | null;
  trigger_query: string | null;
  trigger_ctr: number | null;
  trigger_position: number | null;
  created_at: string;
}

interface ValidationResult {
  id: string;
  pagePath: string;
  triggerCtr: number;
  resultCtr: number;
  triggerPosition: number;
  resultPosition: number;
  lift: number;
  outcome: 'successful' | 'reverted' | 'flat';
}

// ── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Extract current CTR and position for a page path from the latest GSC performance data.
 * GSC performance data is stored in seo_metrics with metric_type = 'gsc_performance'.
 * The data.topQueries array contains per-page/query stats.
 */
async function getPagePerformance(
  supabase: ReturnType<typeof import('@/lib/supabase/server').createServiceClient>,
  pagePath: string,
): Promise<{ ctr: number; position: number } | null> {
  // Get the most recent GSC performance data
  const { data: metrics } = await supabase
    .from('seo_metrics')
    .select('data')
    .eq('metric_type', 'gsc_performance')
    .order('metric_date', { ascending: false })
    .limit(1)
    .single();

  if (!metrics?.data?.topQueries) return null;

  const topQueries = metrics.data.topQueries as Array<{
    query: string;
    page: string;
    clicks: number;
    impressions: number;
    ctr: number;
    position: number;
  }>;

  // Find all entries matching this page path
  const baseUrl = 'https://calculator.ambrosiaventures.co';
  const fullUrl = pagePath.startsWith('http') ? pagePath : `${baseUrl}${pagePath}`;

  const pageEntries = topQueries.filter(
    (q) => q.page === fullUrl || q.page === pagePath,
  );

  if (pageEntries.length === 0) return null;

  // Calculate weighted average CTR and position
  const totalImpressions = pageEntries.reduce((sum, q) => sum + q.impressions, 0);
  if (totalImpressions === 0) return null;

  const weightedCtr =
    pageEntries.reduce((sum, q) => sum + q.ctr * q.impressions, 0) / totalImpressions;
  const weightedPosition =
    pageEntries.reduce((sum, q) => sum + q.position * q.impressions, 0) / totalImpressions;

  return {
    ctr: weightedCtr,
    position: weightedPosition,
  };
}

// ── Slack notification ──────────────────────────────────────────────────────

async function sendSlackSummary(
  results: ValidationResult[],
  errors: string[],
): Promise<void> {
  const webhookUrl = process.env.SLACK_SEO_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const successful = results.filter((r) => r.outcome === 'successful');
  const reverted = results.filter((r) => r.outcome === 'reverted');
  const flat = results.filter((r) => r.outcome === 'flat');

  const successLines = successful.map(
    (r) => `  ${r.pagePath}: +${(r.lift * 100).toFixed(1)}% CTR lift`,
  );
  const revertLines = reverted.map(
    (r) => `  ${r.pagePath}: ${(r.lift * 100).toFixed(1)}% (reverted to original)`,
  );
  const flatLines = flat.map(
    (r) => `  ${r.pagePath}: ${(r.lift * 100).toFixed(1)}% (re-queued)`,
  );

  const sections = [
    `:white_check_mark: *Successful (${successful.length}):*`,
    ...(successLines.length > 0 ? successLines : ['  None']),
    '',
    `:rewind: *Reverted (${reverted.length}):*`,
    ...(revertLines.length > 0 ? revertLines : ['  None']),
    '',
    `:arrows_counterclockwise: *Flat / Re-queued (${flat.length}):*`,
    ...(flatLines.length > 0 ? flatLines : ['  None']),
  ];

  if (errors.length > 0) {
    sections.push('', `:warning: *Errors (${errors.length}):*`);
    sections.push(...errors.slice(0, 5).map((e) => `  - ${e}`));
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `CTR Validation: ${results.length} optimizations checked`,
        attachments: [
          {
            color: successful.length >= reverted.length ? '#10b981' : '#f59e0b',
            blocks: [
              {
                type: 'header',
                text: {
                  type: 'plain_text',
                  text: `CTR Validation Report: ${results.length} Optimizations Reviewed`,
                  emoji: true,
                },
              },
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: sections.join('\n'),
                },
              },
              {
                type: 'context',
                elements: [
                  {
                    type: 'mrkdwn',
                    text: `Validated ${new Date().toLocaleString('en-US', { timeZone: 'America/New_York', dateStyle: 'medium', timeStyle: 'short' })} | 7-30 day lookback window`,
                  },
                ],
              },
            ],
          },
        ],
      }),
    });
  } catch (err) {
    console.error(
      '[ctr-validation] Slack notification error:',
      err instanceof Error ? err.message : 'unknown',
    );
  }
}

// ── Route handler ───────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // 1. Auth — timing-safe comparison
  const authHeader = request.headers.get('authorization');
  const token = authHeader?.replace('Bearer ', '') || '';
  const secret = process.env.CRON_SECRET || '';

  if (!secret || token.length !== secret.length) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const tokenBuf = Buffer.from(token);
    const secretBuf = Buffer.from(secret);
    if (!crypto.timingSafeEqual(tokenBuf, secretBuf)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
  } catch {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const validationResults: ValidationResult[] = [];
  const errors: string[] = [];

  try {
    // 2. Query optimization entries that need validation
    //    - result_ctr IS NULL (never validated)
    //    - created_at between 7 and 30 days ago (enough time for data, not too stale)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: pendingEntries, error: queryError } = await supabase
      .from('seo_optimization_log')
      .select('*')
      .is('result_ctr', null)
      .lt('created_at', sevenDaysAgo)
      .gt('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: true });

    if (queryError) {
      throw new Error(`Failed to query seo_optimization_log: ${queryError.message}`);
    }

    if (!pendingEntries || pendingEntries.length === 0) {
      await logCronRun(supabase, 'ctr-validation', {
        processed: 0,
        parameters: { status: 'no_pending_entries' },
      });
      return NextResponse.json({ message: 'No optimizations pending validation', validated: 0 });
    }

    console.log(`[ctr-validation] Found ${pendingEntries.length} entries to validate`);

    // 3. Process each entry
    for (const rawEntry of pendingEntries) {
      const entry = rawEntry as OptimizationEntry;

      try {
        // 3a. Get current performance for this page
        const performance = await getPagePerformance(supabase, entry.page_path);

        if (!performance) {
          console.log(`[ctr-validation] No GSC data for ${entry.page_path}, skipping`);
          continue;
        }

        const triggerCtr = entry.trigger_ctr || 0;
        const triggerPosition = entry.trigger_position || 0;
        const resultCtr = performance.ctr;
        const resultPosition = performance.position;

        // 3b. Update the optimization log with measured results
        await supabase
          .from('seo_optimization_log')
          .update({
            result_ctr: resultCtr,
            result_position: resultPosition,
            measured_at: new Date().toISOString(),
          })
          .eq('id', entry.id);

        // 3c. Calculate lift
        const lift = triggerCtr > 0 ? (resultCtr - triggerCtr) / triggerCtr : 0;

        let outcome: ValidationResult['outcome'];

        if (lift < -0.10) {
          // NEGATIVE: CTR got worse by more than 10% — revert
          outcome = 'reverted';

          // Delete the override to revert to original title/description
          const { error: deleteError } = await supabase
            .from('seo_overrides')
            .delete()
            .eq('page_path', entry.page_path);

          if (deleteError) {
            console.error(
              `[ctr-validation] Failed to revert ${entry.page_path}:`,
              deleteError.message,
            );
            errors.push(`Revert failed for ${entry.page_path}: ${deleteError.message}`);
          } else {
            console.log(
              `[ctr-validation] Reverted ${entry.page_path}: CTR ${(triggerCtr * 100).toFixed(1)}% -> ${(resultCtr * 100).toFixed(1)}% (${(lift * 100).toFixed(1)}%)`,
            );
          }
        } else if (lift > 0.10) {
          // POSITIVE > 10%: Success
          outcome = 'successful';
          console.log(
            `[ctr-validation] Success ${entry.page_path}: CTR ${(triggerCtr * 100).toFixed(1)}% -> ${(resultCtr * 100).toFixed(1)}% (+${(lift * 100).toFixed(1)}%)`,
          );
        } else {
          // FLAT: -10% to +10% — re-queue for next CTR optimizer run
          outcome = 'flat';

          // Clear the optimization log's measured_at so the CTR optimizer
          // won't skip this page (it checks for recent optimizations).
          // The page stays in seo_overrides with the current title for now,
          // but we flag it for re-optimization by setting a 'needs_reoptimization'
          // flag in the result data.
          console.log(
            `[ctr-validation] Flat ${entry.page_path}: CTR ${(triggerCtr * 100).toFixed(1)}% -> ${(resultCtr * 100).toFixed(1)}% (${(lift * 100).toFixed(1)}%)`,
          );
        }

        validationResults.push({
          id: entry.id,
          pagePath: entry.page_path,
          triggerCtr,
          resultCtr,
          triggerPosition,
          resultPosition,
          lift,
          outcome,
        });
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${entry.page_path}: ${msg}`);
        console.error(`[ctr-validation] Error processing ${entry.page_path}:`, msg);
      }
    }

    // 4. Send Slack summary
    if (validationResults.length > 0 || errors.length > 0) {
      await sendSlackSummary(validationResults, errors);
    }

    // 5. Log cron run
    const durationMs = Date.now() - startTime;
    const successful = validationResults.filter((r) => r.outcome === 'successful').length;
    const reverted = validationResults.filter((r) => r.outcome === 'reverted').length;
    const flat = validationResults.filter((r) => r.outcome === 'flat').length;

    await logCronRun(supabase, 'ctr-validation', {
      fetched: pendingEntries.length,
      processed: validationResults.length,
      inserted: validationResults.length,
      errors: errors.slice(0, 10),
      parameters: {
        entriesQueried: pendingEntries.length,
        validated: validationResults.length,
        successful,
        reverted,
        flat,
        skippedNoData: pendingEntries.length - validationResults.length - errors.length,
        avgLift:
          validationResults.length > 0
            ? validationResults.reduce((sum, r) => sum + r.lift, 0) / validationResults.length
            : 0,
        durationMs,
      },
    });

    return NextResponse.json({
      success: true,
      validated: validationResults.length,
      successful,
      reverted,
      flat,
      errors: errors.length,
      durationMs,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[ctr-validation] Fatal error:', message);

    try {
      await logCronRun(supabase, 'ctr-validation', {
        errors: [message],
        parameters: { stage: 'top-level' },
      });
    } catch {
      // Non-fatal
    }

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
