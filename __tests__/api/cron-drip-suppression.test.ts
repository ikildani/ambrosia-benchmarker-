/**
 * Lifecycle crons must exclude accounts on a founder-led personal sequence
 * (user_profiles.drip_suppressed_until, migration 108).
 *
 * Each cron's user_profiles query must carry the PostgREST `or` filter from
 * dripSuppressionFilter(). We assert the filter reaches the query builder and
 * that, when the filtered query returns nothing, no email is sent.
 */

import { NextRequest } from 'next/server';

const mockSendEmail = jest.fn();

// A chainable query builder that records every call and resolves to the
// configured result when awaited.
function makeSupabase(result: { data: unknown[]; error: null } = { data: [], error: null }) {
  const calls: Array<{ method: string; args: unknown[] }> = [];
  const builder: Record<string, unknown> = {};
  const chain = (method: string) =>
    jest.fn((...args: unknown[]) => {
      calls.push({ method, args });
      return builder;
    });
  for (const m of ['from', 'select', 'insert', 'update', 'eq', 'neq', 'in', 'not', 'gte', 'lte', 'lt', 'gt', 'or', 'order', 'limit']) {
    builder[m] = chain(m);
  }
  // awaiting the builder resolves to the result
  builder.then = (resolve: (v: unknown) => void) => resolve(result);
  return { builder, calls };
}

let supa = makeSupabase();

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => supa.builder,
}));
jest.mock('@/lib/email/client', () => ({
  sendEmail: (...args: unknown[]) => mockSendEmail(...args),
}));
jest.mock('@/lib/sentry-api', () => ({ captureApiError: jest.fn() }));
jest.mock('@/lib/cron-intelligence', () => ({ runCronIntelligence: jest.fn() }));

const SECRET = 'test-cron-secret';

function cronRequest(path: string) {
  return new NextRequest(`http://localhost${path}`, {
    headers: { authorization: `Bearer ${SECRET}` },
  });
}

const CRONS: Array<{ name: string; path: string; load: () => Promise<{ GET: (r: NextRequest) => Promise<Response> }> }> = [
  { name: 'post-trial-drip', path: '/api/cron/post-trial-drip', load: () => import('@/app/api/cron/post-trial-drip/route') },
  { name: 'smart-trial-extend', path: '/api/cron/smart-trial-extend', load: () => import('@/app/api/cron/smart-trial-extend/route') },
  { name: 'onboarding-drip', path: '/api/cron/onboarding-drip', load: () => import('@/app/api/cron/onboarding-drip/route') },
];

describe.each(CRONS)('$name honours drip_suppressed_until', ({ path, load }) => {
  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
    supa = makeSupabase({ data: [], error: null });
    mockSendEmail.mockReset();
  });

  it('applies the suppression filter to the user_profiles query and sends nothing', async () => {
    const { GET } = await load();
    const res = await GET(cronRequest(path));
    expect(res.status).toBe(200);

    const orCalls = supa.calls.filter(c => c.method === 'or');
    expect(orCalls.length).toBeGreaterThanOrEqual(1);
    const filter = String(orCalls[0].args[0]);
    expect(filter).toMatch(/^drip_suppressed_until\.is\.null,drip_suppressed_until\.lt\.\d{4}-\d{2}-\d{2}T/);

    // The filtered query returned no rows, so no lifecycle email may go out.
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});

describe('calculation-convert honours drip_suppressed_until', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
    mockSendEmail.mockReset();
  });

  it('applies the suppression filter when resolving high-intent users to free tier', async () => {
    // First query (events) must return 3+ calculation events for one user so
    // the cron reaches the user_profiles lookup; that lookup then returns [].
    const events = Array.from({ length: 3 }, () => ({ user_id: 'u-1', event_type: 'calculation_completed' }));
    let call = 0;
    supa = makeSupabase();
    supa.builder.then = (resolve: (v: unknown) => void) => {
      call += 1;
      resolve(call === 1 ? { data: events, error: null } : { data: [], error: null });
    };

    const { GET } = await import('@/app/api/cron/calculation-convert/route');
    const res = await GET(cronRequest('/api/cron/calculation-convert'));
    expect(res.status).toBe(200);

    const orCalls = supa.calls.filter(c => c.method === 'or');
    expect(orCalls.length).toBeGreaterThanOrEqual(1);
    expect(String(orCalls[0].args[0])).toMatch(/^drip_suppressed_until\.is\.null,drip_suppressed_until\.lt\./);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });
});
