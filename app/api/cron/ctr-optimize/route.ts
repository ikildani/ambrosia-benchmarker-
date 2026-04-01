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
    // 2. Find candidates
    const candidates = await findOptimizationCandidates(supabase);

    if (candidates.length === 0) {
      console.log('[ctr-optimize] No optimization candidates found');
      await logCronRun(supabase, 'ctr-optimize', {
        processed: 0,
        parameters: { status: 'no_candidates' },
      });
      return NextResponse.json({ message: 'No candidates found', optimized: 0 });
    }

    console.log(`[ctr-optimize] Found ${candidates.length} candidates`);

    // 3. Optimize each candidate
    const results: OptimizationResult[] = [];
    const errors: string[] = [];

    for (const candidate of candidates) {
      if (isTimeBudgetExceeded(startTime, 250_000)) {
        console.warn('[ctr-optimize] Time budget exceeded, stopping');
        break;
      }

      try {
        const result = await optimizePage(candidate);
        await applyOptimization(supabase, result);
        results.push(result);
        console.log(`[ctr-optimize] Optimized: ${candidate.pagePath}`);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        errors.push(`${candidate.pagePath}: ${msg}`);
        console.error(`[ctr-optimize] Failed: ${candidate.pagePath}`, msg);
      }
    }

    // 4. Send Slack notification
    if (results.length > 0 && process.env.SLACK_WEBHOOK_URL) {
      const lines = results.map(
        (r) =>
          `*${r.pagePath}*\n` +
          `  Title: "${r.originalTitle}" -> "${r.newTitle}"\n` +
          `  Trigger: "${r.triggerQuery}" (pos ${r.triggerPosition.toFixed(1)}, CTR ${r.triggerCtr.toFixed(1)}%)`
      );

      try {
        await fetch(process.env.SLACK_WEBHOOK_URL, {
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
      },
    });

    const durationMs = Date.now() - startTime;
    console.log(`[ctr-optimize] Done: ${results.length} optimized in ${durationMs}ms`);

    return NextResponse.json({
      success: true,
      optimized: results.length,
      candidates: candidates.length,
      errors: errors.length,
      durationMs,
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
