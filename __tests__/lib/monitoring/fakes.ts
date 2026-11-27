/** Test doubles for lib/monitoring: a chainable Supabase fake, a URL-routed fetch, a Stripe stub. */

import type { MonitorContext } from '@/lib/monitoring/types';
import { calculateDealTerms } from '@/lib/calculations';

type Op = [string, ...unknown[]];
type TableResponse = { data?: unknown; error?: { message: string } | null; count?: number | null };
export type TableHandler = TableResponse | ((ops: Op[]) => TableResponse);

/** Every builder method records itself and returns the builder; awaiting it resolves the table's response. */
export function fakeDb(tables: Record<string, TableHandler>, auth: Record<string, unknown> = {}) {
  const calls: Array<{ table: string; ops: Op[] }> = [];
  const client = {
    auth,
    from(table: string) {
      const ops: Op[] = [];
      calls.push({ table, ops });
      const builder: Record<string | symbol, unknown> = new Proxy({}, {
        get(_t, prop) {
          if (prop === 'then') {
            const h = tables[table];
            const res = (typeof h === 'function' ? h(ops) : h) ?? { data: null, error: null };
            return (resolve: (v: unknown) => unknown, reject: (e: unknown) => unknown) =>
              Promise.resolve({ data: null, error: null, ...res }).then(resolve, reject);
          }
          return (...args: unknown[]) => {
            ops.push([String(prop), ...args]);
            return builder;
          };
        },
      });
      return builder;
    },
  };
  return { client, calls };
}

export type Route = (url: string, init?: RequestInit) => Response | Promise<Response>;

export function fakeFetch(routes: Array<[RegExp | string, Route]>) {
  const seen: Array<{ url: string; init?: RequestInit }> = [];
  const f = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    seen.push({ url, init });
    for (const [match, route] of routes) {
      if (typeof match === 'string' ? url.startsWith(match) : match.test(url)) return route(url, init);
    }
    return new Response('not mocked', { status: 599 });
  }) as typeof fetch;
  return { fetch: f, seen };
}

export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
export const html = (body: string, status = 200, headers: Record<string, string> = {}) =>
  new Response(body, { status, headers: { 'content-type': 'text/html', ...headers } });

export const NOW = new Date('2026-11-23T15:20:00Z');
export const APP = 'https://solidus.ambrosiaventures.co';

export function makeCtx(over: Partial<MonitorContext> = {}): MonitorContext {
  return {
    now: NOW,
    env: {
      NEXT_PUBLIC_SUPABASE_URL: 'https://mnzoulengniofgkwtfbo.supabase.co',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon',
      ADMIN_NOTIFICATION_EMAIL: 'owner@example.com',
    },
    appUrl: APP,
    fetch: fakeFetch([]).fetch,
    service: () => fakeDb({}).client as never,
    anon: () => fakeDb({}).client as never,
    stripe: () => null,
    calculate: calculateDealTerms,
    loadBenchmarks: async () => {},
    ...over,
  };
}

export const hoursAgo = (h: number) => new Date(NOW.getTime() - h * 3_600_000).toISOString();
