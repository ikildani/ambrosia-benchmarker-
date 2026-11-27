/**
 * On demand: run the revenue-path checks and return them as JSON.
 *
 *   GET /api/cron/revenue-monitor              all checks, read-only (no Slack, no state)
 *   GET /api/cron/revenue-monitor?scope=hourly hourly checks only
 *   GET /api/cron/revenue-monitor?only=stripe_prices,database
 *   GET /api/cron/revenue-monitor?record=1     also persist state and post state-change alerts
 *
 * Not in vercel.json (100-cron cap): the scheduled run rides on api-credit-check.
 * Daily checks are side-effect-free or self-cleaning (see lib/monitoring/checks).
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { createMonitorContext } from '@/lib/monitoring/context';
import { runRevenueMonitor, type RunScope } from '@/lib/monitoring';

export const maxDuration = 60;
export const dynamic = 'force-dynamic';

function authorized(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const expected = `Bearer ${secret}`;
  const provided = request.headers.get('authorization') || '';
  if (provided.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(provided), Buffer.from(expected));
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  const params = request.nextUrl.searchParams;
  const scopeParam = params.get('scope');
  const scope: RunScope = scopeParam === 'hourly' || scopeParam === 'auto' ? scopeParam : 'all';
  const only = params.get('only')?.split(',').map(s => s.trim()).filter(Boolean);
  const record = params.get('record') === '1';

  const run = await runRevenueMonitor(createMonitorContext(), { scope, record, only, forceDigest: params.get('digest') === '1' });
  const counts = { ok: 0, warn: 0, fail: 0 };
  for (const r of run.results) counts[r.status]++;
  return NextResponse.json({ ok: counts.fail === 0, counts, ...run });
}
