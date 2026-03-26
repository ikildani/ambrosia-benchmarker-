import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { runCompletenessAudit } from '@/lib/ingestion/completeness-audit';
import { logCronRun } from '@/lib/cron-utils';

export const maxDuration = 300;
export const dynamic = 'force-dynamic';

async function postToSlack(attachments: object[], text: string): Promise<void> {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.log('[Slack] SLACK_WEBHOOK_URL not configured, skipping notification');
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
  // Security: Require cron secret
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.error('CRON_SECRET environment variable is not set');
    return NextResponse.json({ error: 'Server configuration error' }, { status: 500 });
  }

  const expectedToken = `Bearer ${cronSecret}`;
  const providedToken = authHeader || '';

  const isValidLength = providedToken.length === expectedToken.length;
  const tokenToCompare = isValidLength ? providedToken : expectedToken;

  const isValid = isValidLength && timingSafeEqual(
    Buffer.from(tokenToCompare),
    Buffer.from(expectedToken)
  );

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const perplexityApiKey = process.env.PERPLEXITY_API_KEY;
  const anthropicApiKey = process.env.ANTHROPIC_API_KEY;

  if (!perplexityApiKey || !anthropicApiKey) {
    return NextResponse.json(
      { error: 'PERPLEXITY_API_KEY or ANTHROPIC_API_KEY not configured' },
      { status: 500 }
    );
  }

  try {
    const supabase = createServiceClient();

    const result = await runCompletenessAudit(supabase, perplexityApiKey, anthropicApiKey, {
      timeBudgetMs: 250_000,
    });

    // Calculate before/after completeness
    const beforePct = result.deals_found_public > 0
      ? Math.round((result.deals_in_db / result.deals_found_public) * 100)
      : 100;
    const afterPct = result.deals_found_public > 0
      ? Math.round(((result.deals_in_db + result.deals_auto_ingested) / result.deals_found_public) * 100)
      : 100;

    // Determine color based on before-completeness
    let color: string;
    if (beforePct >= 90) {
      color = '#22c55e'; // green
    } else if (beforePct >= 70) {
      color = '#f59e0b'; // amber
    } else {
      color = '#ef4444'; // red
    }

    // Calculate week_start and week_end for display
    const now = new Date();
    const dayOfWeek = now.getUTCDay();
    const daysToLastMonday = dayOfWeek === 0 ? 8 : dayOfWeek + 6;
    const lastMonday = new Date(now);
    lastMonday.setUTCDate(now.getUTCDate() - daysToLastMonday);
    const lastSunday = new Date(lastMonday);
    lastSunday.setUTCDate(lastMonday.getUTCDate() + 6);
    const weekStart = lastMonday.toISOString().split('T')[0];
    const weekEnd = lastSunday.toISOString().split('T')[0];

    // Build Slack message
    const lines = [
      `*Deals found in public sources:* ${result.deals_found_public}`,
      `*Deals already in our DB:*       ${result.deals_in_db} (${beforePct}%)`,
      `*Deals missing (auto-ingested):* ${result.deals_auto_ingested}`,
    ];

    if (result.missing_deals.length > 0) {
      lines.push('');
      lines.push('*Missing deals added:*');
      for (const deal of result.missing_deals.slice(0, 15)) {
        lines.push(`\u2022 ${deal.licensor} / ${deal.licensee} (${deal.value}) \u2014 ${deal.ta}, ${deal.type}`);
      }
      if (result.missing_deals.length > 15) {
        lines.push(`_...and ${result.missing_deals.length - 15} more_`);
      }
    }

    lines.push('');
    lines.push(`*Completeness:* ${beforePct}% \u2192 ${afterPct}%`);

    if (result.errors.length > 0) {
      lines.push('');
      lines.push(`_${result.errors.length} error(s) during audit_`);
    }

    await postToSlack(
      [{
        color,
        blocks: [
          {
            type: 'header',
            text: {
              type: 'plain_text',
              text: `\ud83d\udcca Weekly Deal Completeness \u2014 ${weekStart} to ${weekEnd}`,
              emoji: true,
            },
          },
          {
            type: 'section',
            text: {
              type: 'mrkdwn',
              text: lines.join('\n'),
            },
          },
        ],
      }],
      `Deal completeness: ${beforePct}% \u2192 ${afterPct}% (${result.deals_found_public} public, ${result.deals_auto_ingested} ingested)`
    );

    // Log the cron run
    await logCronRun(supabase, 'deal_completeness', {
      fetched: result.deals_found_public,
      processed: result.deals_found_public,
      inserted: result.deals_auto_ingested,
      errors: result.errors,
      parameters: {
        week_start: weekStart,
        week_end: weekEnd,
        completeness_before: beforePct,
        completeness_after: afterPct,
      },
    });

    return NextResponse.json({
      success: true,
      weekStart,
      weekEnd,
      ...result,
      completeness_before: beforePct,
      completeness_after: afterPct,
    });
  } catch (error) {
    console.error('Deal completeness audit error:', error);
    return NextResponse.json({ error: 'Deal completeness audit failed' }, { status: 500 });
  }
}
