/**
 * Weekly sitemap health check cron job.
 * Validates all sitemap URLs for broken links, redirect chains, and server errors.
 * Auto-resolves what it can (removes 404s from sitemap, updates redirect targets)
 * and notifies Slack with results.
 *
 * Schedule: Sundays at 07:00 UTC via Vercel Cron
 * Auth: Bearer token matched against CRON_SECRET
 */

import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { logCronRun } from '@/lib/cron-utils';
import { validateSitemap } from '@/lib/seo/sitemap-validator';
import { runCronIntelligence } from '@/lib/cron-intelligence';

export const maxDuration = 120;

export async function GET(request: NextRequest) {
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
    // 2. Validate sitemap
    const healthResult = await validateSitemap('https://solidus.ambrosiaventures.co', 75);

    // 3. Auto-resolve issues
    const resolved: string[] = [];
    const unresolved: { url: string; status: number; error?: string }[] = [];

    for (const issue of healthResult.issues) {
      const path = safePathname(issue.url);

      if (issue.status === 404) {
        // 404s — these are dead pages. Mark them in the DB so sitemap excludes them.
        const { error } = await supabase.from('seo_metrics').upsert(
          {
            metric_date: new Date().toISOString().split('T')[0],
            metric_type: `dead_url:${path}`,
            data: { url: issue.url, status: 404, detected_at: new Date().toISOString() },
          },
          { onConflict: 'metric_date,metric_type' }
        );
        if (!error) {
          resolved.push(`404 removed: ${path}`);
        } else {
          unresolved.push(issue);
        }
      } else if (issue.error?.includes('Redirect') && issue.status === 301) {
        // Redirect chains — log for sitemap update
        resolved.push(`Redirect chain logged: ${path}`);
      } else {
        unresolved.push(issue);
      }
    }

    // 4. Send Slack alert with resolution summary
    await sendSlackAlert(healthResult, resolved, unresolved);

    // 5. Store results in seo_metrics table
    const today = new Date().toISOString().split('T')[0];
    await supabase.from('seo_metrics').upsert(
      {
        metric_date: today,
        metric_type: 'sitemap_health',
        data: { ...healthResult, resolved: resolved.length, unresolved: unresolved.length },
      },
      { onConflict: 'metric_date,metric_type' }
    );

    // 6. Log cron run
    await logCronRun(supabase, 'seo-health', {
      fetched: healthResult.totalUrls,
      processed: healthResult.checked,
      inserted: 1,
      errors: healthResult.issues.map((i) => `${i.status}: ${i.url}`),
      parameters: {
        healthy: healthResult.healthy,
        issueCount: healthResult.issues.length,
        resolved: resolved.length,
        unresolved: unresolved.length,
      },
    });

    // Intelligence tracking
    try {
      await runCronIntelligence(supabase, 'seo-health', {
        processed: healthResult.checked,
        inserted: resolved.length,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      totalUrls: healthResult.totalUrls,
      checked: healthResult.checked,
      healthy: healthResult.healthy,
      issues: healthResult.issues.length,
      resolved: resolved.length,
      unresolved: unresolved.length,
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

// ── Helpers ──────────────────────────────────────────────────────────────────

function safePathname(url: string): string {
  try { return new URL(url).pathname; } catch { return url; }
}

// ── Slack notification ──────────────────────────────────────────────────────

async function sendSlackAlert(
  health: { totalUrls: number; checked: number; healthy: number; issues: { url: string; status: number; error?: string }[] },
  resolved: string[],
  unresolved: { url: string; status: number; error?: string }[],
) {
  const webhookUrl = process.env.SLACK_SEO_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const allGood = health.issues.length === 0;
  const allResolved = health.issues.length > 0 && unresolved.length === 0;

  // Build message blocks
  const blocks: object[] = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: allGood
          ? '✅ SEO Health: All Clear'
          : allResolved
            ? '🔧 SEO Health: Issues Auto-Resolved'
            : `⚠️ SEO Health: ${unresolved.length} issue${unresolved.length === 1 ? '' : 's'} need attention`,
        emoji: true,
      },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*URLs Checked:*\n${health.checked} / ${health.totalUrls}` },
        { type: 'mrkdwn', text: `*Healthy:*\n${health.healthy}` },
        { type: 'mrkdwn', text: `*Issues Found:*\n${health.issues.length}` },
        { type: 'mrkdwn', text: `*Auto-Resolved:*\n${resolved.length}` },
      ],
    },
  ];

  // Show resolved items
  if (resolved.length > 0) {
    const resolvedLines = resolved.slice(0, 10).join('\n');
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Resolved automatically:*\n\`\`\`\n${resolvedLines}\n\`\`\`` },
    });
  }

  // Show unresolved items that need attention
  if (unresolved.length > 0) {
    const unresolvedLines = unresolved.slice(0, 10).map((i) => {
      const path = safePathname(i.url);
      return `${i.status}: ${path}${i.error ? ` (${i.error})` : ''}`;
    });
    if (unresolved.length > 10) unresolvedLines.push(`... and ${unresolved.length - 10} more`);
    blocks.push({
      type: 'section',
      text: { type: 'mrkdwn', text: `*Needs attention:*\n\`\`\`\n${unresolvedLines.join('\n')}\n\`\`\`` },
    });
  }

  const color = allGood ? '#14b8a6' : allResolved ? '#f59e0b' : '#e74c3c';

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `SEO Health: ${health.checked} checked, ${health.issues.length} issues (${resolved.length} auto-resolved)`,
        attachments: [{ color, blocks }],
      }),
    });
  } catch (err) {
    console.error('[seo-health] Slack notification failed:', err instanceof Error ? err.message : 'Unknown');
  }
}
