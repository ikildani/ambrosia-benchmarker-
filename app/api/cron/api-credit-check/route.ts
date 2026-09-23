/**
 * Cron: API credit check (hourly)
 *
 * Scans the last two hours of data_ingestion_log for Perplexity / Anthropic
 * quota errors and posts a Slack alert with a top-up link. Re-alerts at most
 * every six hours per vendor so a long outage does not flood the channel.
 * Also posts an all-clear the first time a vendor recovers.
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createServiceClient } from '@/lib/supabase/server';
import { classifyCreditErrors, shouldAlert, buildCreditAlert, type AlertState, type Vendor } from '@/lib/ingestion/credit-sentinel';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

const STATE_KEY = 'api_credit_alert_state';
const LOOKBACK_MS = 2 * 3600_000;

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = `Bearer ${secret}`;
  const provided = request.headers.get('authorization') || '';
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

async function postToSlack(payload: { text: string; blocks: object[] }): Promise<boolean> {
  const url = process.env.SLACK_WEBHOOK_URL;
  if (!url) return false;
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return res.ok;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const supabase = createServiceClient();
  const now = new Date();
  const since = new Date(now.getTime() - LOOKBACK_MS).toISOString();

  const { data: rows, error } = await supabase
    .from('data_ingestion_log')
    .select('source, started_at, errors')
    .gte('started_at', since)
    .gt('records_failed', 0)
    .limit(500);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const outages = classifyCreditErrors(rows || []);

  const { data: stateRow } = await supabase.from('system_config').select('value').eq('key', STATE_KEY).maybeSingle();
  const state: AlertState = (stateRow?.value as AlertState) || {};
  const active = new Set(outages.map(o => o.vendor));

  const [{ data: lastDeal }, { count: pending }] = await Promise.all([
    supabase.from('deals').select('created_at').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    supabase.from('deals').select('*', { count: 'exact', head: true }).eq('verification_status', 'pending'),
  ]);

  const toAlert = outages.filter(o => shouldAlert(state, o.vendor, now));
  let alerted = false;
  if (toAlert.length > 0) {
    alerted = await postToSlack(buildCreditAlert(toAlert, { lastDealInsert: lastDeal?.created_at ?? null, pendingVerification: pending ?? 0 }));
    for (const o of toAlert) state[o.vendor] = now.toISOString();
  }

  // All-clear: a vendor that was alerted and no longer shows errors.
  const recovered = (Object.keys(state) as Vendor[]).filter(v => state[v] && !active.has(v));
  if (recovered.length > 0) {
    await postToSlack({ text: `Solidus ingestion: ${recovered.join(', ')} credits restored`, blocks: [{ type: 'section', text: { type: 'mrkdwn', text: `✅ *${recovered.map(v => v === 'perplexity' ? 'Perplexity' : 'Anthropic').join(' and ')}* back online — no quota errors in the last two hours.` } }] });
    for (const v of recovered) delete state[v];
  }

  await supabase.from('system_config').upsert({ key: STATE_KEY, value: state, updated_at: now.toISOString() }, { onConflict: 'key' });

  await supabase.from('data_ingestion_log').insert({
    source: 'api_credit_check', run_type: 'cron', started_at: now.toISOString(), completed_at: new Date().toISOString(),
    records_fetched: rows?.length ?? 0, records_processed: outages.length, records_inserted: 0, records_failed: 0,
    status: 'completed', parameters: { outages, alerted, recovered },
    notes: outages.length ? `${outages.map(o => o.vendor).join(', ')} out of credit` : 'ok',
  });

  return NextResponse.json({ ok: true, outages, alerted, recovered, checkedRuns: rows?.length ?? 0 });
}
