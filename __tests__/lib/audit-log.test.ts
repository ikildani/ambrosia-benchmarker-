/**
 * Unit tests for lib/audit-log.ts recordAuditEvent()
 *
 * Contract under test:
 *  - never throws / never rejects, whatever the client does
 *  - validates event_type / resource_type, requires a user
 *  - resolves team_id from team_members when not supplied
 *  - hashes the IP (never stores the raw address), truncates the UA
 *  - inserts the documented row shape into audit_events
 */

import { NextRequest } from 'next/server';

// ─── Chain-aware Supabase mock ─────────────────────────────────────────────

type Result = { data: unknown; error: { message: string } | null };

function createChain(result: Result = { data: null, error: null }) {
  const chain: Record<string, jest.Mock> = {};
  for (const m of ['select', 'insert', 'eq', 'limit', 'order', 'in']) {
    chain[m] = jest.fn(() => chain);
  }
  chain.maybeSingle = jest.fn(() => Promise.resolve(result));
  chain.single = jest.fn(() => Promise.resolve(result));
  return chain;
}

let fromChains: ReturnType<typeof createChain>[];
let fromIndex: number;
const mockSupabase = {
  from: jest.fn(() => {
    const c = fromChains[fromIndex] || createChain();
    fromIndex++;
    return c;
  }),
};

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => mockSupabase,
}));

import {
  recordAuditEvent,
  hashIp,
  getAuditRequestContext,
  AUDIT_EVENT_TYPES,
  CLIENT_REPORTABLE_EVENT_TYPES,
} from '@/lib/audit-log';

const USER = '11111111-1111-1111-1111-111111111111';
const TEAM = '22222222-2222-2222-2222-222222222222';

function makeReq(headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/calculations', { headers });
}

describe('recordAuditEvent', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fromChains = [];
    fromIndex = 0;
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('returns ok:false (not throw) when there is no user', async () => {
    await expect(
      recordAuditEvent({ event_type: 'calculation_created', resource_type: 'calculation', user_id: null })
    ).resolves.toEqual({ ok: false, reason: 'no_user' });
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('rejects unknown event and resource types without throwing', async () => {
    await expect(
      recordAuditEvent({
        event_type: 'made_up' as never,
        resource_type: 'calculation',
        user_id: USER,
      })
    ).resolves.toEqual({ ok: false, reason: 'invalid_event_type' });
    await expect(
      recordAuditEvent({
        event_type: 'calculation_created',
        resource_type: 'nope' as never,
        user_id: USER,
      })
    ).resolves.toEqual({ ok: false, reason: 'invalid_resource_type' });
  });

  it('resolves team_id from team_members and inserts the documented row shape', async () => {
    const membership = createChain({ data: { team_id: TEAM }, error: null });
    const insert = createChain({ data: { id: 'evt-1' }, error: null });
    fromChains = [membership, insert];

    const req = makeReq({
      'x-forwarded-for': '203.0.113.7, 10.0.0.1',
      'user-agent': 'x'.repeat(600),
    });

    const res = await recordAuditEvent({
      event_type: 'calculation_created',
      resource_type: 'calculation',
      user_id: USER,
      resource_id: 'calc-1',
      calculation_fingerprint: 'v5.1.0-abc',
      metadata: { modality: 'adc', nan: Number.NaN },
      request: req,
    });

    expect(res).toEqual({ ok: true, id: 'evt-1', team_id: TEAM });
    expect(mockSupabase.from).toHaveBeenNthCalledWith(1, 'team_members');
    expect(membership.eq).toHaveBeenCalledWith('user_id', USER);
    expect(membership.eq).toHaveBeenCalledWith('status', 'active');
    expect(mockSupabase.from).toHaveBeenNthCalledWith(2, 'audit_events');

    const row = insert.insert.mock.calls[0][0];
    expect(row).toEqual({
      team_id: TEAM,
      user_id: USER,
      event_type: 'calculation_created',
      resource_type: 'calculation',
      resource_id: 'calc-1',
      calculation_fingerprint: 'v5.1.0-abc',
      metadata: { modality: 'adc', nan: null },
      ip_hash: expect.stringMatching(/^[0-9a-f]{64}$/),
      user_agent: 'x'.repeat(256),
    });
    expect(row.ip_hash).not.toContain('203.0.113.7');
  });

  it('skips the membership lookup when team_id is supplied explicitly', async () => {
    const insert = createChain({ data: { id: 'evt-2' }, error: null });
    fromChains = [insert];

    const res = await recordAuditEvent({
      event_type: 'team_history_viewed',
      resource_type: 'history',
      user_id: USER,
      team_id: TEAM,
    });

    expect(res).toEqual({ ok: true, id: 'evt-2', team_id: TEAM });
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    expect(mockSupabase.from).toHaveBeenCalledWith('audit_events');
    expect(insert.insert.mock.calls[0][0]).toMatchObject({ team_id: TEAM, ip_hash: null, user_agent: null, metadata: {} });
  });

  it('records team_id:null for users without a team', async () => {
    fromChains = [createChain({ data: null, error: null }), createChain({ data: { id: 'evt-3' }, error: null })];
    const res = await recordAuditEvent({ event_type: 'results_shared', resource_type: 'share', user_id: USER });
    expect(res).toEqual({ ok: true, id: 'evt-3', team_id: null });
  });

  it('returns ok:false when the insert errors', async () => {
    fromChains = [
      createChain({ data: { team_id: TEAM }, error: null }),
      createChain({ data: null, error: { message: 'relation "audit_events" does not exist' } }),
    ];
    await expect(
      recordAuditEvent({ event_type: 'results_exported', resource_type: 'report', user_id: USER })
    ).resolves.toEqual({ ok: false, reason: 'insert_failed' });
  });

  it('never throws when the client itself throws', async () => {
    const boom = { from: jest.fn(() => { throw new Error('network down'); }) };
    await expect(
      recordAuditEvent({
        event_type: 'results_exported',
        resource_type: 'report',
        user_id: USER,
        supabase: boom as never,
      })
    ).resolves.toEqual({ ok: false, reason: 'exception' });
  });

  it('truncates oversized metadata instead of failing', async () => {
    const insert = createChain({ data: { id: 'evt-4' }, error: null });
    fromChains = [insert];
    const res = await recordAuditEvent({
      event_type: 'results_exported',
      resource_type: 'report',
      user_id: USER,
      team_id: null,
      metadata: { blob: 'z'.repeat(10_000) },
    });
    expect(res.ok).toBe(true);
    expect(insert.insert.mock.calls[0][0].metadata).toEqual({ _truncated: true });
  });
});

describe('hashIp / getAuditRequestContext', () => {
  it('is deterministic, salted and never the raw IP', () => {
    const a = hashIp('198.51.100.4');
    expect(a).toMatch(/^[0-9a-f]{64}$/);
    expect(a).toBe(hashIp('198.51.100.4'));
    expect(a).not.toBe(hashIp('198.51.100.5'));
    expect(hashIp(null)).toBeNull();
    expect(hashIp('')).toBeNull();
  });

  it('extracts hashed ip + truncated UA from a request and tolerates missing headers', () => {
    const ctx = getAuditRequestContext(makeReq({ 'x-real-ip': '198.51.100.4', 'user-agent': 'jest' }));
    expect(ctx).toEqual({ ip_hash: hashIp('198.51.100.4'), user_agent: 'jest' });
    expect(getAuditRequestContext(makeReq())).toEqual({ ip_hash: null, user_agent: null });
    expect(getAuditRequestContext(null)).toEqual({ ip_hash: null, user_agent: null });
  });
});

describe('event type catalogues', () => {
  it('client-reportable types are a strict subset of all types', () => {
    for (const t of CLIENT_REPORTABLE_EVENT_TYPES) expect(AUDIT_EVENT_TYPES).toContain(t);
    expect(CLIENT_REPORTABLE_EVENT_TYPES).not.toContain('calculation_created');
    expect(CLIENT_REPORTABLE_EVENT_TYPES).not.toContain('report_purchased');
  });
});
