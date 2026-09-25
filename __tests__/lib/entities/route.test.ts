/**
 * Route handler tests for POST /api/entities/resolve and
 * GET /api/entities/[kind]/[id] — auth, zod validation, batch cap, ordering,
 * caching — with a stubbed supabase client.
 */

import { NextRequest } from 'next/server';
import { fixtureClient, UUID } from './stub-supabase';

const mockGetAuthenticatedUser = jest.fn();
const mockCreateServiceClient = jest.fn();
const mockCheckRateLimit = jest.fn();

jest.mock('@/lib/auth-helpers', () => ({
  getAuthenticatedUser: (...args: unknown[]) => mockGetAuthenticatedUser(...args),
}));

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => mockCreateServiceClient(),
}));

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  getIdentifier: () => 'ip:test',
  getRateLimitHeaders: () => ({ 'X-RateLimit-Remaining': '59' }),
  RATE_LIMIT_CONFIGS: { default: { limit: 60, windowSeconds: 60 } },
}));

import { POST } from '@/app/api/entities/resolve/route';
import { GET } from '@/app/api/entities/[kind]/[id]/route';

const API_KEY = 'test-entity-key-123';

function post(body: unknown, headers: Record<string, string> = {}) {
  return new NextRequest('http://localhost/api/entities/resolve', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

function get(kind: string, id: string, headers: Record<string, string> = {}) {
  const req = new NextRequest(`http://localhost/api/entities/${kind}/${id}`, { headers });
  return GET(req, { params: Promise.resolve({ kind, id }) });
}

beforeEach(() => {
  jest.clearAllMocks();
  process.env.ENTITY_API_KEY = API_KEY;
  mockGetAuthenticatedUser.mockResolvedValue(null);
  mockCreateServiceClient.mockImplementation(() => fixtureClient());
  mockCheckRateLimit.mockResolvedValue({ success: true, limit: 60, remaining: 59, resetTime: Date.now() + 60_000 });
});

describe('POST /api/entities/resolve — auth', () => {
  it('401 without key or session', async () => {
    const res = await POST(post({ items: [{ kind: 'company', name: 'Pfizer' }] }));
    expect(res.status).toBe(401);
    expect(mockCreateServiceClient).not.toHaveBeenCalled();
  });

  it('401 with the wrong key', async () => {
    const res = await POST(post({ items: [{ kind: 'company', name: 'Pfizer' }] }, { 'x-api-key': 'wrong' }));
    expect(res.status).toBe(401);
  });

  it('401 when ENTITY_API_KEY is unset even if a key is presented', async () => {
    delete process.env.ENTITY_API_KEY;
    const res = await POST(post({ items: [{ kind: 'company', name: 'Pfizer' }] }, { 'x-api-key': '' }));
    expect(res.status).toBe(401);
  });

  it('200 with a valid x-api-key', async () => {
    const res = await POST(post({ items: [{ kind: 'company', name: 'Pfizer' }] }, { 'x-api-key': API_KEY }));
    expect(res.status).toBe(200);
    expect(mockCheckRateLimit).toHaveBeenCalledWith('entity-key', 'entities-resolve', expect.anything());
  });

  it('200 with an authenticated session and no key', async () => {
    mockGetAuthenticatedUser.mockResolvedValue({ id: 'user-1' });
    const res = await POST(post({ items: [{ kind: 'company', name: 'Pfizer' }] }));
    expect(res.status).toBe(200);
    expect(mockCheckRateLimit).toHaveBeenCalledWith('user:user-1', 'entities-resolve', expect.anything());
  });

  it('429 when rate limited', async () => {
    mockCheckRateLimit.mockResolvedValue({ success: false, limit: 60, remaining: 0, resetTime: Date.now() });
    const res = await POST(post({ items: [{ kind: 'company', name: 'Pfizer' }] }, { 'x-api-key': API_KEY }));
    expect(res.status).toBe(429);
  });
});

describe('POST /api/entities/resolve — validation', () => {
  const auth = { 'x-api-key': API_KEY };

  it('400 on invalid JSON', async () => {
    const res = await POST(post('{not json', auth));
    expect(res.status).toBe(400);
  });

  it('400 on empty items, unknown kind, unknown field, missing query', async () => {
    for (const body of [
      { items: [] },
      { items: [{ kind: 'person', name: 'x' }] },
      { items: [{ kind: 'company', name: 'x', foo: 1 }] },
      { items: [{ kind: 'company' }] },
      { items: [{ kind: 'asset' }] },
      { items: [{ kind: 'deal' }] },
      { items: [{ kind: 'deal', licensor: 'x', announced_date: '03/01/2026' }] },
      { nope: true },
    ]) {
      const res = await POST(post(body, auth));
      expect(res.status).toBe(400);
      const json = await res.json();
      expect(json.error).toBe('Invalid request');
    }
  });

  it('400 when more than 50 items', async () => {
    const items = Array.from({ length: 51 }, () => ({ kind: 'company', name: 'Pfizer' }));
    const res = await POST(post({ items }, auth));
    expect(res.status).toBe(400);
    expect(mockCreateServiceClient).not.toHaveBeenCalled();
  });
});

describe('POST /api/entities/resolve — results', () => {
  const auth = { 'x-api-key': API_KEY };

  it('returns results and candidates in input order with null for unresolved', async () => {
    const res = await POST(post({
      items: [
        { kind: 'company', name: 'Eli Lilly and Company' },
        { kind: 'company', name: 'Pfizzer' },
        { kind: 'asset', name: 'Keytruda' },
        { kind: 'deal', licensor: 'Kyowa Kirin', licensee: 'Eli Lilly', announced_date: '2026-03-01' },
        { kind: 'company', name: 'Zzyzx Nonexistent Bio' },
      ],
    }, auth));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.results).toHaveLength(5);
    expect(json.candidates).toHaveLength(5);
    expect(json.results[0]).toMatchObject({ kind: 'company', id: UUID.lilly, matchedOn: 'exact', confidence: 0.98 });
    expect(json.results[0].meta.duplicateIds).toEqual([UUID.lillyDup]);
    expect(json.results[1]).toBeNull();
    expect(json.candidates[1][0]).toMatchObject({ kind: 'company', id: UUID.pfizer });
    expect(json.results[2]).toMatchObject({ kind: 'asset', id: UUID.pembro, matchedOn: 'alias' });
    expect(json.results[3]).toMatchObject({ kind: 'deal', id: UUID.deal1 });
    expect(json.results[4]).toBeNull();
    expect(json.candidates[4]).toEqual([]);
  });

  it('serves identical queries from the cache within the TTL', async () => {
    const body = { items: [{ kind: 'company', ticker: 'LLY' }] };
    const first = await POST(post(body, auth));
    expect(first.status).toBe(200);
    expect(mockCreateServiceClient).toHaveBeenCalledTimes(1);
    const second = await POST(post({ items: [{ kind: 'company', ticker: ' LLY ' }] }, auth));
    expect(second.status).toBe(200);
    // Same canonical key → no new client / no new queries.
    expect(mockCreateServiceClient).toHaveBeenCalledTimes(1);
    expect((await second.json()).results[0].id).toBe(UUID.lilly);
  });

  it('500 when the resolver throws for the whole batch', async () => {
    const quiet = jest.spyOn(console, 'error').mockImplementation(() => {});
    mockCreateServiceClient.mockImplementation(() => { throw new Error('db down'); });
    const res = await POST(post({ items: [{ kind: 'company', name: 'Kyowa Kirin Inc' }] }, auth));
    expect(res.status).toBe(500);
    quiet.mockRestore();
  });
});

describe('GET /api/entities/[kind]/[id]', () => {
  const auth = { 'x-api-key': API_KEY };

  it('401 without auth', async () => {
    expect((await get('company', UUID.lilly)).status).toBe(401);
  });

  it('400 on bad kind or id', async () => {
    expect((await get('person', UUID.lilly, auth)).status).toBe(400);
    expect((await get('company', 'not-a-uuid', auth)).status).toBe(400);
  });

  it('404 when unknown or filtered', async () => {
    expect((await get('company', '00000000-0000-4000-8000-000000000000', auth)).status).toBe(404);
    expect((await get('deal', UUID.dealRejected, auth)).status).toBe(404);
  });

  it('200 company / asset / deal payloads', async () => {
    const c = await get('company', UUID.lilly, auth);
    expect(c.status).toBe(200);
    expect(await c.json()).toMatchObject({ kind: 'company', id: UUID.lilly, name: 'Eli Lilly', ids: { ticker: 'LLY' } });

    const a = await get('asset', UUID.pembro, auth);
    expect(await a.json()).toMatchObject({ kind: 'asset', preferredName: 'pembrolizumab', originatorCompanyId: UUID.merck });

    const d = await get('deal', UUID.deal1, auth);
    const dj = await d.json();
    expect(dj.parties.licensee.id).toBe(UUID.lilly);
    expect(dj.terms.upfrontM).toBe(50);
  });
});
