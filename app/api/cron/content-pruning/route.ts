/**
 * Cron: Content Pruning
 *
 * Monthly cron that identifies underperforming blog content and de-indexes it.
 * Targets thin licensing pages with zero clicks and low impressions that
 * actively hurt domain quality in Google's eyes.
 *
 * Rules:
 * - Pages older than 60 days with gsc_clicks = 0 AND gsc_impressions < 10 get archived
 * - Pages with ANY clicks or impressions > 50 are kept (possible momentum)
 * - Archived pages get noindex = true and status = 'archived' but are NOT deleted
 * - Sends Slack summary of actions taken
 *
 * Schedule: 1st of month, 6am UTC
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { logCronRun } from '@/lib/cron-utils';
import { runCronIntelligence } from '@/lib/cron-intelligence';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

async function notifyContentPruning(
  archivedCount: number,
  keptCount: number,
  archivedTitles: string[],
): Promise<void> {
  const webhookUrl = process.env.SLACK_SEO_WEBHOOK_URL || process.env.SLACK_WEBHOOK_URL;
  if (!webhookUrl) return;

  const titleList = archivedTitles.slice(0, 15).map((t) => `- ${t}`).join('\n');
  const moreCount = archivedTitles.length > 15 ? `\n...and ${archivedTitles.length - 15} more` : '';

  try {
    await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        text: `Content pruning: ${archivedCount} pages archived, ${keptCount} kept`,
        attachments: [
          {
            color: archivedCount > 0 ? '#f59e0b' : '#10b981',
            blocks: [
              {
                type: 'header',
                text: {
                  type: 'plain_text',
                  text: `Content Pruning: ${archivedCount} Pages De-indexed`,
                  emoji: true,
                },
              },
              {
                type: 'section',
                fields: [
                  { type: 'mrkdwn', text: `*Archived:*\n${archivedCount}` },
                  { type: 'mrkdwn', text: `*Kept (has traction):*\n${keptCount}` },
                ],
              },
              ...(archivedCount > 0
                ? [
                    {
                      type: 'section',
                      text: {
                        type: 'mrkdwn',
                        text: `*Archived pages:*\n${titleList}${moreCount}`,
                      },
                    },
                  ]
                : []),
              {
                type: 'context',
                elements: [
                  {
                    type: 'mrkdwn',
                    text: 'Archived pages are de-indexed (noindex) but not deleted. They can be restored by setting status back to published.',
                  },
                ],
              },
            ],
          },
        ],
      }),
    });
  } catch (err) {
    console.error('[content-pruning] Slack notification failed:', err);
  }
}

export async function GET(request: NextRequest) {
  // Auth
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  const expectedToken = `Bearer ${cronSecret}`;
  const providedToken = authHeader || '';
  const isValidLength = providedToken.length === expectedToken.length;
  const tokenToCompare = isValidLength ? providedToken : expectedToken;
  const isValid =
    isValidLength && timingSafeEqual(Buffer.from(tokenToCompare), Buffer.from(expectedToken));

  if (!isValid) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createServiceClient();
  const sixtyDaysAgo = new Date(Date.now() - 60 * 24 * 60 * 60 * 1000).toISOString();

  try {
    // 1. Find underperforming pages: older than 60 days, zero clicks, < 10 impressions
    const { data: candidates, error: queryError } = await supabase
      .from('blog_posts')
      .select('id, title, slug, gsc_clicks, gsc_impressions, created_at')
      .eq('status', 'published')
      .lt('created_at', sixtyDaysAgo)
      .or('gsc_clicks.is.null,gsc_clicks.eq.0')
      .or('gsc_impressions.is.null,gsc_impressions.lt.10');

    if (queryError) {
      throw new Error(`Query failed: ${queryError.message}`);
    }

    const allCandidates = candidates || [];

    // 2. Split: archive thin pages, keep pages with any traction
    const toArchive: typeof allCandidates = [];
    const toKeep: typeof allCandidates = [];

    for (const page of allCandidates) {
      const clicks = page.gsc_clicks || 0;
      const impressions = page.gsc_impressions || 0;

      // Keep pages with ANY clicks or impressions > 50 (possible momentum)
      if (clicks > 0 || impressions > 50) {
        toKeep.push(page);
      } else {
        toArchive.push(page);
      }
    }

    // 3. Archive underperforming pages (set noindex + status archived)
    const archivedTitles: string[] = [];
    let archivedCount = 0;

    if (toArchive.length > 0) {
      const archiveIds = toArchive.map((p) => p.id);

      const { error: updateError } = await supabase
        .from('blog_posts')
        .update({
          status: 'archived',
          noindex: true,
          archived_at: new Date().toISOString(),
        })
        .in('id', archiveIds);

      if (updateError) {
        throw new Error(`Archive update failed: ${updateError.message}`);
      }

      archivedCount = toArchive.length;
      archivedTitles.push(...toArchive.map((p) => p.title || p.slug));
    }

    // 4. Notify via Slack
    await notifyContentPruning(archivedCount, toKeep.length, archivedTitles);

    // 5. Log cron run
    await logCronRun(supabase, 'content-pruning', {
      processed: allCandidates.length,
      inserted: archivedCount,
      errors: [],
      parameters: {
        candidatesFound: allCandidates.length,
        archived: archivedCount,
        keptWithTraction: toKeep.length,
        archivedSlugs: toArchive.slice(0, 50).map((p) => p.slug),
      },
    });

    // Intelligence tracking
    try {
      await runCronIntelligence(supabase, 'content-pruning', {
        processed: allCandidates.length,
        inserted: archivedCount,
      });
    } catch {}

    return NextResponse.json({
      success: true,
      candidates: allCandidates.length,
      archived: archivedCount,
      kept: toKeep.length,
      archivedSlugs: toArchive.slice(0, 20).map((p) => p.slug),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error';
    console.error('[content-pruning] Error:', message);

    await logCronRun(supabase, 'content-pruning', {
      errors: [message],
      parameters: { stage: 'execution' },
    });

    return NextResponse.json({ error: message }, { status: 500 });
  }
}
