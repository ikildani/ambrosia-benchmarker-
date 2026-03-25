/**
 * Weekly sitemap health check cron job.
 * Validates all sitemap URLs for broken links, redirect chains, and server errors.
 *
 * Schedule: Sundays at 07:00 UTC via Vercel Cron
 * Auth: Bearer token matched against CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { logCronRun } from '@/lib/cron-utils';
import { validateSitemap } from '@/lib/seo/sitemap-validator';

export const maxDuration = 120;

export async function POST(request: NextRequest) {
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
    console.log('[seo-health] Starting weekly sitemap health check...');

    // 2. Validate sitemap
    const healthResult = await validateSitemap('https://calculator.ambrosiaventures.co', 75);

    console.log(
      `[seo-health] Checked ${healthResult.checked}/${healthResult.totalUrls} URLs — ` +
        `${healthResult.healthy} healthy, ${healthResult.issues.length} issues`
    );

    // 3. Store results in seo_metrics table
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('seo_metrics').upsert(
      {
        metric_date: today,
        metric_type: 'sitemap_health',
        data: healthResult,
      },
      { onConflict: 'metric_date,metric_type' }
    );

    // 4. Send Slack alert if issues found
    if (healthResult.issues.length > 0) {
      await sendSlackAlert(healthResult.issues);
    }

    // 5. Log cron run
    await logCronRun(supabase, 'seo-health', {
      fetched: healthResult.totalUrls,
      processed: healthResult.checked,
      inserted: 1,
      errors: healthResult.issues.map((i) => `${i.status}: ${i.url}`),
      parameters: {
        healthy: healthResult.healthy,
        issueCount: healthResult.issues.length,
      },
    });

    return NextResponse.json({
      success: true,
      totalUrls: healthResult.totalUrls,
      checked: healthResult.checked,
      healthy: healthResult.healthy,
      issues: healthResult.issues.length,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[seo-health] Error:', message);

    await logCronRun(supabase, 'seo-health', {
      errors: [message],
      parameters: { stage: 'sitemap_validation' },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}

// ── Slack notification ──────────────────────────────────────────────────────

async function sendSlackAlert(issues: { url: string; status: number; error?: string }[]) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) {
    console.warn('[seo-health] SLACK_WEBHOOK_URL not configured — skipping alert');
    return;
  }

  const issueLines = issues.slice(0, 20).map((i) => {
    const path = new URL(i.url).pathname;
    if (i.error?.includes('Redirect loop') || i.error?.includes('Redirect chain')) {
      return `Redirect loop: ${path}`;
    }
    return `${i.status}: ${path}${i.error ? ` (${i.error})` : ''}`;
  });

  if (issues.length > 20) {
    issueLines.push(`... and ${issues.length - 20} more`);
  }

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `SEO Health Alert: ${issues.length} issues found`,
        attachments: [
          {
            color: '#e74c3c',
            blocks: [
              {
                type: 'section',
                text: {
                  type: 'mrkdwn',
                  text: `*SEO Health Alert: ${issues.length} issues found*\n\`\`\`\n${issueLines.join('\n')}\n\`\`\``,
                },
              },
            ],
          },
        ],
      }),
    });
  } catch (err) {
    console.error('[seo-health] Slack notification failed:', err instanceof Error ? err.message : 'Unknown');
  }
}
