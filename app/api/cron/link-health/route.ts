import { NextRequest, NextResponse } from 'next/server';
import { createServiceClient } from '@/lib/supabase/server';
import { timingSafeEqual } from 'crypto';
import { fetchWithTimeout } from '@/lib/fetch-with-timeout';
import { runCronIntelligence } from '@/lib/cron-intelligence';

export const maxDuration = 120;
export const dynamic = 'force-dynamic';

const BATCH_SIZE = 50;
const CONCURRENCY = 10;
const RECHECK_DAYS = 7;
const UA = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';

async function checkUrl(url: string): Promise<'alive' | 'dead'> {
  try {
    const res = await fetchWithTimeout(url, {
      timeoutMs: 10_000,
      retries: 0,
      method: 'HEAD',
      headers: { 'User-Agent': UA },
      redirect: 'follow',
    });
    if (res.ok || res.status === 403 || res.status === 405) return 'alive';
  } catch { /* fall through to GET */ }

  try {
    const res = await fetchWithTimeout(url, {
      timeoutMs: 10_000,
      retries: 0,
      method: 'GET',
      headers: { 'User-Agent': UA, 'Range': 'bytes=0-1024' },
    });
    if (res.ok || res.status === 206 || res.status === 403) return 'alive';
  } catch { /* dead */ }

  return 'dead';
}

async function runBatch<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not set' }, { status: 500 });
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

  const supabase = createServiceClient();
  const cutoff = new Date(Date.now() - RECHECK_DAYS * 86400_000).toISOString();

  // Fetch deals with source URLs that haven't been checked recently
  const { data: deals, error: fetchError } = await supabase
    .from('deals')
    .select('id, source_url, url_status')
    .not('source_url', 'is', null)
    .or(`url_checked_at.is.null,url_checked_at.lt.${cutoff}`)
    .order('url_checked_at', { ascending: true, nullsFirst: true })
    .limit(BATCH_SIZE);

  if (fetchError) {
    return NextResponse.json({ error: fetchError.message }, { status: 500 });
  }

  if (!deals || deals.length === 0) {
    return NextResponse.json({ success: true, checked: 0, message: 'All URLs recently verified' });
  }

  let alive = 0;
  let dead = 0;
  let unchanged = 0;
  const newlyDead: { id: string; url: string }[] = [];
  const now = new Date().toISOString();

  const results = await runBatch(deals, CONCURRENCY, async (deal) => {
    const status = await checkUrl(deal.source_url!);
    return { id: deal.id, url: deal.source_url!, status, previousStatus: deal.url_status };
  });

  for (const r of results) {
    if (r.status === 'alive') alive++;
    else dead++;

    if (r.previousStatus !== r.status) {
      await supabase
        .from('deals')
        .update({ url_status: r.status, url_checked_at: now })
        .eq('id', r.id);

      if (r.status === 'dead' && r.previousStatus !== 'dead') {
        newlyDead.push({ id: r.id, url: r.url });
      }
    } else {
      unchanged++;
      await supabase
        .from('deals')
        .update({ url_checked_at: now })
        .eq('id', r.id);
    }
  }

  // Slack notification for newly dead links
  if (newlyDead.length > 0) {
    const webhookUrl = process.env.SLACK_WEBHOOK_URL;
    if (webhookUrl) {
      const deadList = newlyDead.slice(0, 10).map(d =>
        `• <${d.url}|${new URL(d.url).hostname}> (deal ${d.id.slice(0, 8)})`
      ).join('\n');

      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          text: `🔗 Link Health: ${newlyDead.length} dead URL${newlyDead.length > 1 ? 's' : ''} found`,
          attachments: [{
            color: '#ef4444',
            blocks: [
              { type: 'header', text: { type: 'plain_text', text: '🔗 Dead Source URLs Detected' } },
              { type: 'section', text: { type: 'mrkdwn', text: `Checked ${deals.length} URLs: *${alive}* alive, *${dead}* dead\n\nNewly dead:\n${deadList}${newlyDead.length > 10 ? `\n_…and ${newlyDead.length - 10} more_` : ''}` } },
            ],
          }],
        }),
      }).then(() => {}, () => {});
    }
  }

  try {
    await runCronIntelligence(supabase, 'link-health', {
      processed: deals.length,
      inserted: 0,
    });
  } catch {}

  return NextResponse.json({
    success: true,
    checked: deals.length,
    alive,
    dead,
    unchanged,
    newlyDead: newlyDead.length,
  });
}
