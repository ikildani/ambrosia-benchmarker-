/**
 * API Integration Tests for /api/watchlist
 *
 * These tests verify:
 * - Zod validation for GET, POST, DELETE
 * - Pro tier authorization enforcement
 * - Max watchlist item limit
 * - Duplicate item detection (23505)
 * - Rate limiting on POST
 * - Success paths for all three methods
 */

import { NextRequest } from 'next/server';

// Build chain-aware mock: each .from() call gets an isolated chain
let fromCallIndex: number;
let fromChains: Record<string, unknown>[];

function createChain(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  };
  // Make chainable methods return this chain
  (chain.select as jest.Mock).mockReturnValue(chain);
  (chain.insert as jest.Mock).mockReturnValue(chain);
  (chain.delete as jest.Mock).mockReturnValue(chain);
  (chain.eq as jest.Mock).mockReturnValue(chain);
  (chain.order as jest.Mock).mockReturnValue(chain);
  return chain;
}

const mockSupabase = {
  from: jest.fn(() => {
    const chain = fromChains[fromCallIndex] || createChain();
    fromCallIndex++;
    return chain;
  }),
};

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => mockSupabase,
}));

// Mock requireAuth — default: authenticated user with id 'u1'
const mockRequireAuth = jest.fn();
jest.mock('@/lib/auth-helpers', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn().mockResolvedValue({ success: true, remaining: 10 }),
  getIdentifier: jest.fn().mockReturnValue('test-ip'),
  getRateLimitHeaders: jest.fn().mockReturnValue({ 'X-RateLimit-Remaining': '10' }),
  RATE_LIMIT_CONFIGS: { calculations: { limit: 100, windowSeconds: 60 }, default: { limit: 60, windowSeconds: 60 } },
}));

// Import after mocking
import { GET, POST, DELETE } from '@/app/api/watchlist/route';

describe('/api/watchlist', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fromCallIndex = 0;
    fromChains = [];
    // Default: authenticated as user 'u1'
    mockRequireAuth.mockResolvedValue([{ id: 'u1', email: 'u1@test.com' }, null]);
  });

  // ─── GET ──────────────────────────────────────────────────────────

  describe('GET', () => {
    it('should return 401 when not authenticated', async () => {
      mockRequireAuth.mockResolvedValueOnce([null, new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 })]);
      const request = new NextRequest('http://localhost/api/watchlist');

      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('should return 403 for non-pro tier user', async () => {
      // Chain 0: user_profiles tier check
      const tierChain = createChain();
      (tierChain.single as jest.Mock).mockResolvedValueOnce({ data: { tier: 'free' }, error: null });
      fromChains = [tierChain];

      const request = new NextRequest('http://localhost/api/watchlist');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Pro subscription required');
    });

    it('should return 200 with items for pro tier user', async () => {
      // Chain 0: user_profiles tier check
      const tierChain = createChain();
      (tierChain.single as jest.Mock).mockResolvedValueOnce({ data: { tier: 'pro' }, error: null });

      // Chain 1: watchlist_items fetch
      const itemsChain = createChain();
      (itemsChain.order as jest.Mock).mockResolvedValueOnce({
        data: [
          { id: '1', item_type: 'modality', item_value: 'mab', user_id: 'u1' },
          { id: '2', item_type: 'indication', item_value: 'lung_nsclc', user_id: 'u1' },
        ],
        error: null,
      });

      fromChains = [tierChain, itemsChain];

      const request = new NextRequest('http://localhost/api/watchlist');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.items).toHaveLength(2);
      expect(data.items[0].item_type).toBe('modality');
    });

    it('should return 500 on database error', async () => {
      // Chain 0: user_profiles tier check
      const tierChain = createChain();
      (tierChain.single as jest.Mock).mockResolvedValueOnce({ data: { tier: 'pro' }, error: null });

      // Chain 1: watchlist_items fetch with error
      const itemsChain = createChain();
      (itemsChain.order as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'Database connection failed' },
      });

      fromChains = [tierChain, itemsChain];

      const request = new NextRequest('http://localhost/api/watchlist');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Failed to fetch watchlist');
    });
  });

  // ─── POST ─────────────────────────────────────────────────────────

  describe('POST', () => {
    it('should return 401 when not authenticated', async () => {
      mockRequireAuth.mockResolvedValueOnce([null, new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 })]);
      const request = new NextRequest('http://localhost/api/watchlist', {
        method: 'POST',
        body: JSON.stringify({ user_id: 'u1', item_type: 'modality', item_value: 'mab' }),
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('should return 400 when item_type is missing', async () => {
      const request = new NextRequest('http://localhost/api/watchlist', {
        method: 'POST',
        body: JSON.stringify({ user_id: 'u1', item_value: 'mab' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should return 400 when item_type is not in enum', async () => {
      const request = new NextRequest('http://localhost/api/watchlist', {
        method: 'POST',
        body: JSON.stringify({ user_id: 'u1', item_type: 'invalid_type', item_value: 'mab' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should return 403 for non-pro user', async () => {
      // Chain 0: user_profiles tier check
      const tierChain = createChain();
      (tierChain.single as jest.Mock).mockResolvedValueOnce({ data: { tier: 'free' }, error: null });
      fromChains = [tierChain];

      const request = new NextRequest('http://localhost/api/watchlist', {
        method: 'POST',
        body: JSON.stringify({ user_id: 'u1', item_type: 'modality', item_value: 'mab' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Pro subscription required');
    });

    it('should return 400 when max items reached', async () => {
      // Chain 0: user_profiles tier check (pro)
      const tierChain = createChain();
      (tierChain.single as jest.Mock).mockResolvedValueOnce({ data: { tier: 'pro' }, error: null });

      // Chain 1: count query — .from().select('id', opts).eq('user_id', ...) resolves with { count: 25 }
      const countChain = createChain();
      (countChain.eq as jest.Mock).mockResolvedValueOnce({ count: 25 });

      fromChains = [tierChain, countChain];

      const request = new NextRequest('http://localhost/api/watchlist', {
        method: 'POST',
        body: JSON.stringify({ user_id: 'u1', item_type: 'modality', item_value: 'mab' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('Maximum 25 watchlist items allowed');
    });

    it('should return 409 for duplicate item (23505)', async () => {
      // Chain 0: user_profiles tier check (pro)
      const tierChain = createChain();
      (tierChain.single as jest.Mock).mockResolvedValueOnce({ data: { tier: 'pro' }, error: null });

      // Chain 1: count query (under limit)
      const countChain = createChain();
      (countChain.eq as jest.Mock).mockResolvedValueOnce({ count: 5 });

      // Chain 2: insert — .from().insert().select().single() returns duplicate error
      const insertChain = createChain();
      (insertChain.single as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { code: '23505', message: 'duplicate key value violates unique constraint' },
      });

      fromChains = [tierChain, countChain, insertChain];

      const request = new NextRequest('http://localhost/api/watchlist', {
        method: 'POST',
        body: JSON.stringify({ user_id: 'u1', item_type: 'modality', item_value: 'mab' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(409);
      expect(data.error).toContain('Item already in watchlist');
    });

    it('should return 200 with item data on success', async () => {
      const newItem = {
        id: 'item-1',
        user_id: 'u1',
        item_type: 'modality',
        item_value: 'mab',
        company_id: null,
        created_at: '2026-02-23T00:00:00Z',
      };

      // Chain 0: user_profiles tier check (pro)
      const tierChain = createChain();
      (tierChain.single as jest.Mock).mockResolvedValueOnce({ data: { tier: 'pro' }, error: null });

      // Chain 1: count query (under limit)
      const countChain = createChain();
      (countChain.eq as jest.Mock).mockResolvedValueOnce({ count: 5 });

      // Chain 2: insert success
      const insertChain = createChain();
      (insertChain.single as jest.Mock).mockResolvedValueOnce({ data: newItem, error: null });

      fromChains = [tierChain, countChain, insertChain];

      const request = new NextRequest('http://localhost/api/watchlist', {
        method: 'POST',
        body: JSON.stringify({ user_id: 'u1', item_type: 'modality', item_value: 'mab' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.item).toEqual(newItem);
      expect(data.item.item_type).toBe('modality');
    });

    it('should return 429 when rate limited', async () => {
      const { checkRateLimit } = require('@/lib/rate-limit');
      checkRateLimit.mockResolvedValueOnce({ success: false, remaining: 0 });

      const request = new NextRequest('http://localhost/api/watchlist', {
        method: 'POST',
        body: JSON.stringify({ user_id: 'u1', item_type: 'modality', item_value: 'mab' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Too many requests');
    });
  });

  // ─── DELETE ───────────────────────────────────────────────────────

  describe('DELETE', () => {
    it('should return 401 when not authenticated', async () => {
      mockRequireAuth.mockResolvedValueOnce([null, new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 })]);
      const request = new NextRequest('http://localhost/api/watchlist?id=item1&user_id=u1', {
        method: 'DELETE',
      });

      const response = await DELETE(request);

      expect(response.status).toBe(401);
    });

    it('should return 400 when id is missing', async () => {
      const request = new NextRequest('http://localhost/api/watchlist?user_id=u1', {
        method: 'DELETE',
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should return 200 on successful delete', async () => {
      // Chain 0: delete — .from().delete().eq('id', ...).eq('user_id', ...) resolves
      const deleteChain = createChain();
      (deleteChain.eq as jest.Mock).mockReturnValue(deleteChain);
      // The second .eq() call is the terminal one; make it resolve
      (deleteChain.eq as jest.Mock)
        .mockReturnValueOnce(deleteChain)  // first .eq('id', ...) returns chain
        .mockResolvedValueOnce({ error: null }); // second .eq('user_id', ...) resolves

      fromChains = [deleteChain];

      const request = new NextRequest('http://localhost/api/watchlist?id=item1&user_id=u1', {
        method: 'DELETE',
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});
