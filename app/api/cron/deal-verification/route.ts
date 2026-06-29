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
import { autoAcceptVerifiedDeals, autoRejectLowConfidenceDeals } from '@/lib/ingestion/auto-remediate';
import { runCronIntelligence } from '@/lib/cron-intelligence';

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

  const result = await verifyPendingDeals(supabase, perplexityApiKey, anthropicApiKey, {
    maxDeals: 50,
    timeBudgetMs: 250_000,
  });

  // Auto-remediation: accept high-confidence verified deals, reject low-confidence flagged deals
  const acceptResult = await autoAcceptVerifiedDeals(supabase);
  const rejectResult = await autoRejectLowConfidenceDeals(supabase);

  // Notify Slack if any deals were flagged
  if (result.flagged > 0) {
    // Fetch the flagged deals for the notification
    const { data: flaggedDeals } = await supabase
      .from('deals')
      .select('licensor_name, licensee_name, verification_notes')
      .in('verification_status', ['flagged', 'rejected'])
      .order('updated_at', { ascending: false })
      .limit(result.flagged);

    const dealLines = (flaggedDeals || []).map(
      (d) => `${d.licensor_name} \u2192 ${d.licensee_name}: ${d.verification_notes || 'No details'}`
    );

    await postToSlack(
      [{
        color: '#f59e0b',
        blocks: [
          {
            type: 'header',
            text: { type: 'plain_text', text: `\u26a0\ufe0f ${result.flagged} Deals Flagged for Review`, emoji: true },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: dealLines.map((line) => `\u2022 ${line}`).join('\n'),
            },
          },
          {
            type: 'context',
            elements: [
              {
                type: 'mrkdwn',
                text: `Verified: ${result.verified} (${acceptResult.fixed} auto-accepted) | Flagged: ${result.flagged} | Rejected: ${rejectResult.fixed} auto-rejected | Unchanged: ${result.unchanged} | Errors: ${result.errors.length}`,
              },
            ],
          },
        ],
      }],
      `\u26a0\ufe0f ${result.flagged} deals flagged for review`,
    );
  }

  // Log cron run
  await logCronRun(supabase, 'deal_verification', {
    fetched: result.verified + result.flagged + result.unchanged,
    processed: result.verified + result.flagged,
    inserted: result.verified,
    errors: result.errors,
    parameters: { maxDeals: 20, timeBudgetMs: 250_000 },
  });

  // Intelligence tracking
  try {
    await runCronIntelligence(supabase, 'deal-verification', {
      processed: result.verified + result.flagged + result.unchanged,
      inserted: result.verified,
    });
  } catch {}

  return NextResponse.json({
    success: true,
    verified: result.verified,
    flagged: result.flagged,
    unchanged: result.unchanged,
    errors: result.errors.length,
  });
}
