/**
 * PATCH /api/radar/mandates/:id/matches — contract: Pro-only, body shape,
 * and every UPDATE scoped to the session user's rows of that mandate.
 */

import { NextRequest } from 'next/server';

const calls: Array<[string, unknown[]]> = [];
const chain: Record<string, jest.Mock> = {};
for (const m of ['from', 'update', 'eq', 'in', 'select']) {
  chain[m] = jest.fn((...args: unknown[]) => { calls.push([m, args]); return chain; });
}
let selectResult: { data: unknown; error: unknown } = { data: [{ id: 'x' }], error: null };
chain.select = jest.fn((...args: unknown[]) => { calls.push(['select', args]); return Promise.resolve(selectResult); });

jest.mock('@/lib/supabase/server', () => ({ createServiceClient: () => chain }));

const tier = { hasProAccess: true, userId: 'user-1', isAuthenticated: true };
jest.mock('@/lib/auth/tier-check', () => ({ resolveUserTier: jest.fn(async () => tier) }));

import { PATCH } from '@/app/api/radar/mandates/[id]/matches/route';

const MANDATE = '0b8f6a3e-1111-4222-8333-444455556666';
const MATCH = '1b8f6a3e-1111-4222-8333-444455556666';
const call = (body: unknown, id = MANDATE) =>
  PATCH(new NextRequest(`http://localhost/api/radar/mandates/${id}/matches`, { method: 'PATCH', body: JSON.stringify(body) }), { params: Promise.resolve({ id }) });

describe('PATCH /api/radar/mandates/:id/matches', () => {
  beforeEach(() => { calls.length = 0; tier.hasProAccess = true; selectResult = { data: [{ id: MATCH }], error: null }; });

  it('rejects free-tier callers', async () => {
    tier.hasProAccess = false;
    const res = await call({ ids: [MATCH], is_read: true });
    expect(res.status).toBe(403);
    expect(calls).toHaveLength(0);
  });

  it('404s a non-UUID mandate id and 400s a body with nothing to update', async () => {
    expect((await call({ ids: [MATCH], is_read: true }, 'nope')).status).toBe(404);
    expect((await call({ ids: [MATCH] })).status).toBe(400);
    expect((await call({ is_read: true })).status).toBe(400);
    expect((await call({ ids: [MATCH], all: true, is_read: true })).status).toBe(400);
    expect(calls).toHaveLength(0);
  });

  it('marks the listed rows and scopes the update to the caller and mandate', async () => {
    const res = await call({ ids: [MATCH], is_read: true, is_saved: true });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ updated: 1, patch: { is_read: true, is_saved: true } });
    expect(calls[0]).toEqual(['from', ['radar_mandate_matches']]);
    expect(calls[1]).toEqual(['update', [{ is_read: true, is_saved: true }]]);
    expect(calls).toContainEqual(['eq', ['mandate_id', MANDATE]]);
    expect(calls).toContainEqual(['eq', ['user_id', 'user-1']]);
    expect(calls).toContainEqual(['in', ['id', [MATCH]]]);
  });

  it('all: true marks every open match of the mandate', async () => {
    selectResult = { data: [{ id: 'a' }, { id: 'b' }], error: null };
    const res = await call({ all: true, is_read: true });
    expect(await res.json()).toEqual({ updated: 2, patch: { is_read: true } });
    expect(calls).toContainEqual(['eq', ['is_dismissed', false]]);
    expect(calls.find(c => c[0] === 'in')).toBeUndefined();
  });

  it('returns 500 when the update fails', async () => {
    selectResult = { data: null, error: { message: 'boom' } };
    const spy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    expect((await call({ ids: [MATCH], is_dismissed: true })).status).toBe(500);
    spy.mockRestore();
  });
});
