/**
 * GET /api/calculations?scope=team — membership check and response shape.
 *
 * The route uses the service-role client (bypasses RLS), so it must verify
 * team membership explicitly via team_members before returning anything.
 */

import { NextRequest } from 'next/server';

// ─── Chain-aware Supabase mock (thenable so terminal awaits resolve) ───────

type Result = { data: unknown; error: { message: string } | null };

function createChain(result: Result = { data: null, error: null }) {
  const chain: Record<string, unknown> = {};
  for (const m of ['select', 'insert', 'delete', 'eq', 'gte', 'is', 'in', 'order', 'limit']) {
    chain[m] = jest.fn(() => chain);
  }
  chain.single = jest.fn(() => Promise.resolve(result));
  chain.maybeSingle = jest.fn(() => Promise.resolve(result));
  chain.then = (resolve: (v: Result) => unknown, reject?: (e: unknown) => unknown) =>
    Promise.resolve(result).then(resolve, reject);
  return chain as Record<string, jest.Mock> & PromiseLike<Result>;
}

let fromChains: ReturnType<typeof createChain>[];
let fromIndex: number;
const mockSupabase = {
  from: jest.fn(() => {
    const c = fromChains[fromIndex] || createChain();
    fromIndex++;
    return c;
  }),
  rpc: jest.fn().mockResolvedValue({ error: null }),
};

const mockGetUser = jest.fn();

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => mockSupabase,
  createServerClient: () => ({ auth: { getUser: mockGetUser } }),
}));

const mockRecordAuditEvent = jest.fn().mockResolvedValue({ ok: true, id: 'evt', team_id: null });
jest.mock('@/lib/audit-log', () => ({
  recordAuditEvent: (...args: unknown[]) => mockRecordAuditEvent(...args),
}));

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn().mockResolvedValue({ success: true, limit: 20, remaining: 19, resetTime: Date.now() + 60000 }),
  getIdentifier: jest.fn(() => 'ip:test'),
  getRateLimitHeaders: jest.fn(() => ({})),
  RATE_LIMIT_CONFIGS: { calculations: { limit: 20, windowSeconds: 60 } },
}));
jest.mock('@/lib/auth/require-single-session', () => ({ requireSingleSession: jest.fn().mockResolvedValue(null) }));
jest.mock('@/lib/slack/notify', () => ({ notifyCalculation: jest.fn().mockResolvedValue(undefined) }));
jest.mock('@/lib/sentry-api', () => ({ captureApiError: jest.fn() }));
jest.mock('@/lib/lead-scoring', () => ({ checkLeadScoreAndAlert: jest.fn().mockResolvedValue(undefined) }));

import { GET } from '@/app/api/calculations/route';

const ME = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa';
const MATE = 'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb';
const TEAM = 'cccccccc-cccc-cccc-cccc-cccccccccccc';

function req(query: string) {
  return new NextRequest(`http://localhost/api/calculations?${query}`);
}

describe('GET /api/calculations?scope=team', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fromChains = [];
    fromIndex = 0;
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  it('401s unauthenticated callers before touching the database', async () => {
    const res = await GET(req('scope=team'));
    expect(res.status).toBe(401);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('403s when user_id does not match the session', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: ME } }, error: null });
    const res = await GET(req(`scope=team&user_id=${MATE}`));
    expect(res.status).toBe(403);
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it('403s authenticated users with no active team membership', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: ME } }, error: null });
    const membership = createChain({ data: null, error: null });
    fromChains = [membership];

    const res = await GET(req(`scope=team&user_id=${ME}`));
    const json = await res.json();

    expect(res.status).toBe(403);
    expect(json.error_code).toBe('NOT_TEAM_MEMBER');
    expect(mockSupabase.from).toHaveBeenCalledTimes(1);
    expect(mockSupabase.from).toHaveBeenCalledWith('team_members');
    expect(membership.eq).toHaveBeenCalledWith('user_id', ME);
    expect(membership.eq).toHaveBeenCalledWith('status', 'active');
    expect(mockRecordAuditEvent).not.toHaveBeenCalled();
  });

  it('returns teammates\' calculations with owner info for active members', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: ME } }, error: null });

    const membership = createChain({ data: { team_id: TEAM, role: 'analyst' }, error: null });
    const members = createChain({ data: [{ user_id: ME }, { user_id: MATE }], error: null });
    const rows = createChain({
      data: [
        { id: 'c2', user_id: MATE, created_at: '2026-09-02T00:00:00Z', calculation_fingerprint: 'v5.1.0-x', modality: 'adc', development_phase: 'phase2', output_upfront_mid: 80 },
        { id: 'c1', user_id: ME, created_at: '2026-09-01T00:00:00Z', calculation_fingerprint: 'v5.1.0-y', modality: 'bispecific', development_phase: 'phase1', output_upfront_mid: 40 },
      ],
      error: null,
    });
    const profiles = createChain({
      data: [
        { id: ME, email: 'me@corp.com', full_name: 'Me Person' },
        { id: MATE, email: 'mate@corp.com', full_name: null },
      ],
      error: null,
    });
    fromChains = [membership, members, rows, profiles];

    const res = await GET(req(`scope=team&user_id=${ME}&limit=10`));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.scope).toBe('team');
    expect(json.team_id).toBe(TEAM);
    expect(json.role).toBe('analyst');
    expect(json.calculations).toHaveLength(2);

    // Only active teammates are queried, scoped to the resolved team.
    expect(members.eq).toHaveBeenCalledWith('team_id', TEAM);
    expect(members.eq).toHaveBeenCalledWith('status', 'active');
    expect(rows.in).toHaveBeenCalledWith('user_id', expect.arrayContaining([ME, MATE]));
    expect(rows.limit).toHaveBeenCalledWith(10);

    expect(json.calculations[0]).toMatchObject({
      id: 'c2',
      calculation_fingerprint: 'v5.1.0-x',
      owner: { id: MATE, email: 'mate@corp.com', name: null, is_me: false },
    });
    expect(json.calculations[1].owner).toEqual({ id: ME, email: 'me@corp.com', name: 'Me Person', is_me: true });

    // Full input payloads are not leaked in the team listing.
    expect(json.calculations[0]).not.toHaveProperty('inputs');
    expect(json.calculations[0]).not.toHaveProperty('custom_assumptions');

    expect(mockRecordAuditEvent).toHaveBeenCalledWith(expect.objectContaining({
      event_type: 'team_history_viewed',
      resource_type: 'history',
      user_id: ME,
      team_id: TEAM,
    }));
  });

  it('keeps personal scope as the default (no scope param)', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: ME } }, error: null });
    // sessions lookup, direct calculations
    fromChains = [createChain({ data: [], error: null }), createChain({ data: [], error: null })];

    const res = await GET(req(`user_id=${ME}`));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.scope).toBeUndefined();
    expect(mockSupabase.from).toHaveBeenCalledWith('sessions');
    expect(mockSupabase.from).not.toHaveBeenCalledWith('team_members');
  });
});
