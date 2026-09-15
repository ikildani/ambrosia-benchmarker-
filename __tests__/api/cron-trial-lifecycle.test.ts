/**
 * Trial lifecycle cron: sends the right touch from Issa, dedupes on events,
 * respects suppression, and the retired / deferring crons stay out of its way.
 */
import { NextRequest } from 'next/server';

const mockSendEmail = jest.fn();

/**
 * Table-aware supabase mock: `from(table)` selects which canned result the
 * awaited chain resolves to. Every call is recorded for assertions.
 */
function makeSupabase(tables: Record<string, { data: unknown[]; error: null; count?: number }>) {
  const calls: Array<{ table: string; method: string; args: unknown[] }> = [];
  const METHODS = ['select', 'insert', 'update', 'eq', 'neq', 'in', 'not', 'gte', 'lte', 'lt', 'gt', 'or', 'order', 'limit', 'ilike'];
  const makeChain = (table: string) => {
    const chain: Record<string, unknown> = {};
    for (const m of METHODS) {
      chain[m] = jest.fn((...args: unknown[]) => {
        calls.push({ table, method: m, args });
        return chain;
      });
    }
    // Awaiting the chain resolves to this table's canned result; each from()
    // call gets its own chain so concurrent queries do not share state.
    chain.then = (resolve: (v: unknown) => void) => resolve(tables[table] ?? { data: [], error: null });
    return chain;
  };
  const builder = {
    from: jest.fn((table: string) => {
      calls.push({ table, method: 'from', args: [table] });
      return makeChain(table);
    }),
  };
  return { builder, calls };
}

let supa = makeSupabase({});

jest.mock('@/lib/supabase/server', () => ({ createServiceClient: () => supa.builder }));
jest.mock('@/lib/email/client', () => ({ sendEmail: (...args: unknown[]) => mockSendEmail(...args) }));
jest.mock('@/lib/sentry-api', () => ({ captureApiError: jest.fn() }));
jest.mock('@/lib/cron-intelligence', () => ({ runCronIntelligence: jest.fn() }));
jest.mock('@/lib/cron-utils', () => ({ logCronRun: jest.fn() }));

const SECRET = 'test-cron-secret';
const req = (path: string) => new NextRequest(`http://localhost${path}`, { headers: { authorization: `Bearer ${SECRET}` } });

const DAY = 86400000;
const iso = (offsetDays: number) => new Date(Date.now() + offsetDays * DAY).toISOString();

const profileT5 = {
  id: 'u-1', email: 'chensu@example.com', full_name: 'Chensu Wang', tier: 'pro',
  pro_expires_at: iso(5), pro_engagement_type: 'auto-trial', subscription_status: 'trialing',
};
const calcRow = {
  user_id: 'u-1', therapeutic_area: 'oncology', indication_specific: 'lung_nsclc', indication_category: 'lung',
  development_phase: 'phase2', modality: 'smallMolecule', deal_type: 'licensing', created_at: iso(-2),
};
const dealRow = {
  licensor_name: 'HUTCHMED', licensee_name: 'GSK', asset_name: 'HMPL-A830', phase_at_signing: 'phase_1', deal_type: 'license',
  upfront_usd: 110e6, total_deal_value_usd: 1.29e9, announced_date: '2026-09-03', verified: true,
};

describe('trial-lifecycle cron', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
    delete process.env.TRIAL_OFFER_TERRAIN;
    mockSendEmail.mockReset();
    mockSendEmail.mockResolvedValue({ success: true, id: 'msg' });
  });

  it('rejects a bad secret', async () => {
    const { GET } = await import('@/app/api/cron/trial-lifecycle/route');
    const res = await GET(new NextRequest('http://localhost/api/cron/trial-lifecycle', { headers: { authorization: 'Bearer nope' } }));
    expect(res.status).toBe(401);
  });

  it('sends T1 from Issa, plain text, and logs the event', async () => {
    supa = makeSupabase({
      user_profiles: { data: [profileT5], error: null },
      calculations: { data: [calcRow], error: null },
      events: { data: [], error: null },
      deals: { data: [dealRow], error: null, count: 35 },
    });
    const { GET } = await import('@/app/api/cron/trial-lifecycle/route');
    const res = await GET(req('/api/cron/trial-lifecycle'));
    const body = await res.json();
    expect(body.success).toBe(true);
    expect(body.sent).toBe(1);

    // The user email, then the digest to Issa.
    expect(mockSendEmail).toHaveBeenCalledTimes(2);
    const first = mockSendEmail.mock.calls[0][0];
    expect(first.to).toBe('chensu@example.com');
    expect(first.from).toBe('Issa Kildani <ikildani@ambrosiaventures.co>');
    expect(first.replyTo).toBe('ikildani@ambrosiaventures.co');
    expect(first.subject).toBe('NSCLC Phase 2, the comp that matters');
    expect(first.text).toContain("HUTCHMED's HMPL-A830 licence to GSK at $110M upfront");
    expect(first.text).toContain('therapeuticArea=oncology&modality=smallMolecule');
    expect(first.html).toContain('white-space:pre-wrap');
    const digest = mockSendEmail.mock.calls[1][0];
    expect(digest.to).toBe('ikildani@ambrosiaventures.co');
    expect(digest.text).toContain('chensu@example.com');

    const insert = supa.calls.find(c => c.table === 'events' && c.method === 'insert');
    expect(insert).toBeDefined();
    expect((insert!.args[0] as { event_type: string }).event_type).toBe('trial_seq_t1');

    // Suppression filter reaches the profiles query.
    const or = supa.calls.find(c => c.table === 'user_profiles' && c.method === 'or');
    expect(String(or!.args[0])).toMatch(/^drip_suppressed_until\.is\.null/);
  });

  it('does not resend a touch that is already logged', async () => {
    supa = makeSupabase({
      user_profiles: { data: [profileT5], error: null },
      calculations: { data: [calcRow], error: null },
      events: { data: [{ user_id: 'u-1', event_type: 'trial_seq_t1' }], error: null },
      deals: { data: [dealRow], error: null, count: 35 },
    });
    const { GET } = await import('@/app/api/cron/trial-lifecycle/route');
    const body = await (await GET(req('/api/cron/trial-lifecycle'))).json();
    expect(body.sent).toBe(0);
    expect(body.skippedAlreadySent).toBe(1);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('sends nothing when no account is in a window', async () => {
    supa = makeSupabase({ user_profiles: { data: [{ ...profileT5, pro_expires_at: iso(20) }], error: null } });
    const { GET } = await import('@/app/api/cron/trial-lifecycle/route');
    const body = await (await GET(req('/api/cron/trial-lifecycle'))).json();
    expect(body.sent).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('skips paying subscribers even inside a window', async () => {
    supa = makeSupabase({
      user_profiles: { data: [{ ...profileT5, subscription_status: 'active' }], error: null },
      calculations: { data: [calcRow], error: null },
      deals: { data: [dealRow], error: null, count: 35 },
    });
    const { GET } = await import('@/app/api/cron/trial-lifecycle/route');
    const body = await (await GET(req('/api/cron/trial-lifecycle'))).json();
    expect(body.due).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it('uses the zero-calc track for a trial with no benchmarks', async () => {
    supa = makeSupabase({
      user_profiles: { data: [profileT5], error: null },
      calculations: { data: [], error: null },
      events: { data: [], error: null },
    });
    const { GET } = await import('@/app/api/cron/trial-lifecycle/route');
    await GET(req('/api/cron/trial-lifecycle'));
    expect(mockSendEmail.mock.calls[0][0].subject).toBe('let me build your first benchmark');
  });
});

describe('retired and deferring crons', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = SECRET;
    mockSendEmail.mockReset();
    mockSendEmail.mockResolvedValue({ success: true, id: 'msg' });
  });

  it('smart-trial-extend is a no-op', async () => {
    supa = makeSupabase({ user_profiles: { data: [{ id: 'u-1', email: 'a@b.c', full_name: 'A', pro_expires_at: iso(1), tier: 'pro' }], error: null } });
    const { GET } = await import('@/app/api/cron/smart-trial-extend/route');
    const body = await (await GET(req('/api/cron/smart-trial-extend'))).json();
    expect(body.retired).toBe(true);
    expect(body.extended).toBe(0);
    expect(mockSendEmail).not.toHaveBeenCalled();
    expect(supa.calls.some(c => c.method === 'update')).toBe(false);
  });

  it('post-trial-drip skips accounts the sequence has emailed and never offers a discount', async () => {
    supa = makeSupabase({
      user_profiles: { data: [{ id: 'u-1', email: 'a@b.c', full_name: 'A', pro_expires_at: iso(-1), subscription_status: 'expired' }], error: null },
      events: { data: [{ user_id: 'u-1', event_type: 'trial_seq_t2' }], error: null },
      calculations: { data: [], error: null },
      deals: { data: [], error: null },
    });
    const { GET } = await import('@/app/api/cron/post-trial-drip/route');
    const res = await GET(req('/api/cron/post-trial-drip'));
    expect(res.status).toBe(200);
    expect(mockSendEmail).not.toHaveBeenCalled();
    const src = (await import('fs')).readFileSync(require.resolve('@/app/api/cron/post-trial-drip/route'), 'utf8');
    expect(src).not.toContain('COMEBACK20');
    expect(src).not.toMatch(/20% off/i);
  });
});
