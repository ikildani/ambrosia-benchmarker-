/**
 * Daily CTR optimization cron job.
 * Finds pages ranking positions 8-20 with low CTR, generates improved
 * meta titles and descriptions via Claude, and applies them.
 *
 * Schedule: Daily at 10:00 UTC via Vercel Cron
 * Auth: Bearer token matched against CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { isTimeBudgetExceeded, logCronRun } from '@/lib/cron-utils';
import { getAdaptiveThreshold, runCronIntelligence } from '@/lib/cron-intelligence';
import {
  findOptimizationCandidates,
  optimizePage,
  applyOptimization,
  type OptimizationResult,
} from '@/lib/seo/ctr-optimizer';

export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const startTime = Date.now();

  // 1. Auth
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

  try {
    // 2. Get adaptive thresholds
    const minImpressions = await getAdaptiveThreshold(supabase, 'ctr-optimize', 'min_impressions', 100, {
      minValue: 20, maxValue: 500, stepDown: 25, stepUp: 50,
    });
    const maxCtr = await getAdaptiveThreshold(supabase, 'ctr-optimize', 'max_ctr', 3, {
      minValue: 1, maxValue: 8, stepDown: 0.5, stepUp: 1,
    });
    const minPosition = await getAdaptiveThreshold(supabase, 'ctr-optimize', 'min_position', 8, {
      minValue: 3, maxValue: 15, stepDown: 1, stepUp: 2,
    });
    const maxPosition = await getAdaptiveThreshold(supabase, 'ctr-optimize', 'max_position', 20, {
      minValue: 15, maxValue: 50, stepDown: 5, stepUp: 5,
    });

    // 3. Find candidates using adaptive thresholds
    const candidates = await findOptimizationCandidates(supabase, {
      minImpressions,
      maxCtr,
      minPosition,
      maxPosition,
    });

    if (candidates.length === 0) {
      await logCronRun(supabase, 'ctr-optimize', {
        processed: 0,
        parameters: { status: 'no_candidates', thresholds: { minImpressions, maxCtr, minPosition, maxPosition } },
      });

      // Run intelligence even on empty runs — this detects stalls
      await runCronIntelligence(supabase, 'ctr-optimize', {
        processed: 0,
        inserted: 0,
        skipped: 0,
        errors: 0,
        thresholds: { min_impressions: minImpressions, max_ctr: maxCtr, min_position: minPosition, max_position: maxPosition },
      });

      return NextResponse.json({ message: 'No candidates found', optimized: 0, thresholds: { minImpressions, maxCtr, minPosition, maxPosition } });
    }

    // 3. Optimize each candidate
    const results: OptimizationResult[] = [];
    const errors: string[] = [];

    for (const candidate of candidates) {
      if (isTimeBudgetExceeded(startTime, 250_000)) {
        break;
      }

      try {
        const result = await optimizePage(candidate);
        await applyOptimization(supabase, result);
        results.push(result);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${candidate.pagePath}: ${msg}`);
        console.error(`[ctr-optimize] Failed: ${candidate.pagePath}`, msg);
      }
    }

    // 4. Send Slack notification
    const seoWebhook = process.env.SLACK_SEO_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
    if (results.length > 0 && seoWebhook) {
      const lines = results.map(
        (r) =>
          `*${r.pagePath}*\n` +
          `  Title: "${r.originalTitle}" -> "${r.newTitle}"\n` +
          `  Trigger: "${r.triggerQuery}" (pos ${r.triggerPosition.toFixed(1)}, CTR ${r.triggerCtr.toFixed(1)}%)`
      );

      try {
        await fetch(seoWebhook, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            text: `CTR Optimization: ${results.length} page(s) updated`,
            attachments: [
              {
                color: '#2ecc71',
                title: `CTR Optimization: ${results.length} meta tag(s) rewritten`,
                text: lines.join('\n\n'),
                fallback: `CTR optimization updated ${results.length} pages`,
              },
            ],
          }),
        });
      } catch (slackErr) {
        console.error('[ctr-optimize] Slack notification failed:', slackErr);
      }
    }

    // 5. Log cron run
    await logCronRun(supabase, 'ctr-optimize', {
      fetched: candidates.length,
      processed: results.length + errors.length,
      inserted: results.length,
      errors,
      parameters: {
        candidateCount: candidates.length,
        optimizedPages: results.map((r) => r.pagePath),
        thresholds: { minImpressions, maxCtr, minPosition, maxPosition },
      },
    });

    // 6. Run cron intelligence
    const healthReport = await runCronIntelligence(supabase, 'ctr-optimize', {
      processed: results.length + errors.length,
      inserted: results.length,
      skipped: candidates.length - results.length - errors.length,
      errors: errors.length,
      thresholds: { min_impressions: minImpressions, max_ctr: maxCtr, min_position: minPosition, max_position: maxPosition },
    });

    const durationMs = Date.now() - startTime;

    return NextResponse.json({
      success: true,
      optimized: results.length,
      candidates: candidates.length,
      errors: errors.length,
      durationMs,
      thresholds: { minImpressions, maxCtr, minPosition, maxPosition },
      health: healthReport.status,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[ctr-optimize] Error:', message);

    await logCronRun(supabase, 'ctr-optimize', {
      errors: [message],
      parameters: { stage: 'top-level' },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
