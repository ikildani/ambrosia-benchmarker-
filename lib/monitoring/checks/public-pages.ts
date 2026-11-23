/**
 * Public pages and the anonymous /admin gate.
 *
 * Incident: until Nov 19 2026 /admin server pages shipped service-client data
 * to anonymous visitors (client-only gate). Since PR #127 anonymous /admin/*
 * returns 404; any 2xx is a regression.
 */

import { PRICING } from '@/lib/config/constants';
import { type MonitorCheck, type MonitorContext, type CheckOutcome, ok, warn, fail, worst, errMsg } from '../types';
import { RESET_PAGE_TEXT } from './auth';

export const PAGE_TIMEOUT_MS = 15_000;
export const SLOW_PAGE_MS = 8_000;

export const PUBLIC_PAGES: Array<{ path: string; expect: string }> = [
  { path: '/', expect: 'Deal Intelligence' },
  { path: '/pro', expect: PRICING.PRO_PRICE },
  { path: '/calculator', expect: 'Deal Calculator' },
  { path: '/accuracy', expect: 'Accuracy' },
  { path: '/auth/reset-password', expect: RESET_PAGE_TEXT },
];

export const ADMIN_PATHS = ['/admin', '/admin/briefs', '/admin/ops'];

async function get(ctx: MonitorContext, path: string): Promise<{ res: Response; ms: number }> {
  const t0 = Date.now();
  const res = await ctx.fetch(`${ctx.appUrl}${path}`, {
    redirect: 'manual',
    cache: 'no-store',
    headers: { 'User-Agent': 'SolidusRevenueMonitor/1.0' },
    signal: AbortSignal.timeout(PAGE_TIMEOUT_MS),
  });
  return { res, ms: Date.now() - t0 };
}

export async function checkPublicPage(ctx: MonitorContext, path: string, expect: string): Promise<CheckOutcome> {
  let last: CheckOutcome = fail(`${path} not fetched`);
  // One retry: a single network blip should not page anyone.
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const { res, ms } = await get(ctx, path);
      if (res.status !== 200) {
        last = fail(`${path} returned ${res.status}`);
        continue;
      }
      const body = await res.text();
      if (!body.includes(expect)) return fail(`${path} is missing "${expect}"`);
      return ms > SLOW_PAGE_MS ? warn(`${path} took ${ms} ms`) : ok(`${path} ok`);
    } catch (e) {
      last = fail(`${path}: ${errMsg(e)}`);
    }
  }
  return last;
}

export async function checkAdminGate(ctx: MonitorContext, path: string): Promise<CheckOutcome> {
  try {
    const { res } = await get(ctx, path);
    if ([401, 403, 404].includes(res.status)) return ok(`${path} ${res.status}`);
    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get('location') ?? '';
      const target = new URL(loc, ctx.appUrl);
      if (target.pathname.startsWith('/admin')) return fail(`${path} redirects to ${target.pathname} for anonymous users`);
      return ok(`${path} redirects anonymous users to ${target.pathname}`);
    }
    if (res.status >= 200 && res.status < 300) return fail(`${path} returned ${res.status} to an anonymous visitor (admin leak regression)`);
    return warn(`${path} returned ${res.status}`);
  } catch (e) {
    return warn(`${path}: ${errMsg(e)}`);
  }
}

export const publicPagesCheck: MonitorCheck = {
  id: 'public_pages',
  label: 'Public pages & admin gate',
  cadence: 'hourly',
  async run(ctx) {
    const parts = await Promise.all([
      ...PUBLIC_PAGES.map(p => checkPublicPage(ctx, p.path, p.expect)),
      ...ADMIN_PATHS.map(p => checkAdminGate(ctx, p)),
    ]);
    return worst(parts, `${PUBLIC_PAGES.length} pages up, /admin closed to anonymous users`);
  },
};
