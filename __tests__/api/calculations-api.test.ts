/**
 * API Integration Tests for /api/calculations
 *
 * These tests verify:
 * - POST: Zod validation, rate limiting, successful save, DB error handling
 * - GET: requires user_id or anonymous_id, auth ownership check, success path, DB errors
 * - DELETE: requires auth, requires id param, success path
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
    gte: jest.fn().mockReturnThis(),
    is: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    rpc: jest.fn().mockResolvedValue({ error: null }),
    ...overrides,
  };
  (chain.select as jest.Mock).mockReturnValue(chain);
  (chain.insert as jest.Mock).mockReturnValue(chain);
  (chain.delete as jest.Mock).mockReturnValue(chain);
  (chain.eq as jest.Mock).mockReturnValue(chain);
  (chain.gte as jest.Mock).mockReturnValue(chain);
  (chain.is as jest.Mock).mockReturnValue(chain);
  (chain.in as jest.Mock).mockReturnValue(chain);
  (chain.order as jest.Mock).mockReturnValue(chain);
  (chain.limit as jest.Mock).mockReturnValue(chain);
  return chain;
}

const mockSupabase = {
  from: jest.fn(() => {
    const chain = fromChains[fromCallIndex] || createChain();
    fromCallIndex++;
    return chain;
  }),
  rpc: jest.fn().mockResolvedValue({ error: null }),
};

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => mockSupabase,
  createServerClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}));

// Mock for cookie-based auth (getAuthenticatedUser uses createServerClient)
const mockGetUser = jest.fn().mockResolvedValue({ data: { user: null }, error: null });

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn().mockResolvedValue({ success: true, remaining: 10 }),
  getIdentifier: jest.fn().mockReturnValue('test-ip'),
  getRateLimitHeaders: jest.fn().mockReturnValue({ 'X-RateLimit-Remaining': '10' }),
  RATE_LIMIT_CONFIGS: {
    calculations: { limit: 100, windowSeconds: 60 },
    events: { limit: 200, windowSeconds: 60 },
    default: { limit: 60, windowSeconds: 60 },
  },
}));

jest.mock('@/lib/sentry-api', () => ({
  captureApiError: jest.fn(),
}));

// Import after mocking
import { POST, GET, DELETE } from '@/app/api/calculations/route';

// Valid minimal POST body
const validPostBody = {
  modality: 'mab',
  development_phase: 'phase2',
  therapeutic_area: 'oncology',
  outputs: {
    upfront_low: 50,
    upfront_mid: 100,
    upfront_high: 150,
    milestones_total: 500,
    royalty_low: 5,
    royalty_high: 15,
    total_deal_value_low: 200,
    total_deal_value_high: 800,
  },
};

describe('/api/calculations', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fromCallIndex = 0;
    fromChains = [];
    // Default: no authenticated user (anonymous)
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
  });

  // ─── POST ──────────────────────────────────────────────────────────

  describe('POST - Save calculation', () => {
    it('should return 400 when modality is missing', async () => {
      const request = new NextRequest('http://localhost/api/calculations', {
        method: 'POST',
        body: JSON.stringify({ development_phase: 'phase2' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it('should return 400 when development_phase is missing', async () => {
      const request = new NextRequest('http://localhost/api/calculations', {
        method: 'POST',
        body: JSON.stringify({ modality: 'mab' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it('should return 429 when rate limited', async () => {
      const { checkRateLimit } = require('@/lib/rate-limit');
      checkRateLimit.mockResolvedValueOnce({ success: false, remaining: 0 });

      const request = new NextRequest('http://localhost/api/calculations', {
        method: 'POST',
        body: JSON.stringify(validPostBody),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toContain('Too many requests');
    });

    it('should return 200 with calculation_id on successful anonymous save', async () => {
      // Chain 0: insert into calculations
      const insertChain = createChain();
      (insertChain.single as jest.Mock).mockResolvedValueOnce({
        data: { id: 'calc-123' },
        error: null,
      });

      // Chain 1: insert event (fire-and-forget)
      const eventChain = createChain();
      (eventChain.insert as jest.Mock).mockResolvedValue({ error: null });

      fromChains = [insertChain, eventChain];

      const request = new NextRequest('http://localhost/api/calculations', {
        method: 'POST',
        body: JSON.stringify(validPostBody),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.calculation_id).toBe('calc-123');
    });

    it('should return 500 when DB insert fails', async () => {
      // Chain 0: insert into calculations fails
      const insertChain = createChain();
      (insertChain.single as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'DB connection lost' },
      });

      fromChains = [insertChain];

      const request = new NextRequest('http://localhost/api/calculations', {
        method: 'POST',
        body: JSON.stringify(validPostBody),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to save calculation');
    });
  });

  // ─── GET ──────────────────────────────────────────────────────────

  describe('GET - List calculations', () => {
    it('should return 400 when neither user_id nor anonymous_id is provided', async () => {
      const request = new NextRequest('http://localhost/api/calculations');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('user_id or anonymous_id is required');
    });

    it('should return 403 when user_id does not match auth session', async () => {
      // Authenticated as user-1 but requesting user-2's data
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: 'user-1', email: 'test@example.com' } },
        error: null,
      });

      const request = new NextRequest('http://localhost/api/calculations?user_id=user-2');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Unauthorized');
    });

    it('should return 200 with calculations for authenticated user', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: 'user-1', email: 'test@example.com' } },
        error: null,
      });

      // Chain 0: from('sessions') — find sessions owned by user
      const sessionsChain = createChain();
      (sessionsChain.eq as jest.Mock).mockResolvedValueOnce({
        data: [],
        error: null,
      });

      // Chain 1: from('calculations') — direct user_id match
      const fetchChain = createChain();
      (fetchChain.limit as jest.Mock).mockResolvedValueOnce({
        data: [
          { id: 'calc-1', modality: 'mab', development_phase: 'phase2', created_at: '2026-03-14T00:00:00Z' },
        ],
        error: null,
      });

      fromChains = [sessionsChain, fetchChain];

      const request = new NextRequest('http://localhost/api/calculations?user_id=user-1');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.calculations).toHaveLength(1);
    });

    it('should include pre-login calculations via session ownership', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: 'user-1', email: 'test@example.com' } },
        error: null,
      });

      // Chain 0: from('sessions') — find sessions owned by user
      const sessionsChain = createChain();
      (sessionsChain.eq as jest.Mock).mockResolvedValueOnce({
        data: [{ id: 'session-abc' }],
        error: null,
      });

      // Chain 1: from('calculations') — direct user_id match
      const directChain = createChain();
      (directChain.limit as jest.Mock).mockResolvedValueOnce({
        data: [
          { id: 'calc-1', modality: 'mab', development_phase: 'phase2', created_at: '2026-03-14T01:00:00Z' },
        ],
        error: null,
      });

      // Chain 2: from('calculations') — session-owned (pre-login)
      const sessionCalcChain = createChain();
      (sessionCalcChain.limit as jest.Mock).mockResolvedValueOnce({
        data: [
          { id: 'calc-pre', modality: 'small_molecule', development_phase: 'phase1', created_at: '2026-03-13T23:00:00Z' },
        ],
        error: null,
      });

      fromChains = [sessionsChain, directChain, sessionCalcChain];

      const request = new NextRequest('http://localhost/api/calculations?user_id=user-1');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.calculations).toHaveLength(2);
      // Should be sorted by created_at descending
      expect(data.calculations[0].id).toBe('calc-1');
      expect(data.calculations[1].id).toBe('calc-pre');
    });

    it('should return 400 for anonymous_id without session_id', async () => {
      const request = new NextRequest('http://localhost/api/calculations?anonymous_id=anon-1');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('session_id required');
    });

    it('should return 500 on database fetch error', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: 'user-1', email: 'test@example.com' } },
        error: null,
      });

      // Chain 0: from('sessions') — find sessions owned by user
      const sessionsChain = createChain();
      (sessionsChain.eq as jest.Mock).mockResolvedValueOnce({
        data: [],
        error: null,
      });

      // Chain 1: from('calculations') — direct user_id match fails
      const fetchChain = createChain();
      (fetchChain.limit as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'Database timeout' },
      });

      fromChains = [sessionsChain, fetchChain];

      const request = new NextRequest('http://localhost/api/calculations?user_id=user-1');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to fetch calculations');
    });
  });

  // ─── DELETE ────────────────────────────────────────────────────────

  describe('DELETE - Delete calculation', () => {
    it('should return 400 when id is missing', async () => {
      const request = new NextRequest('http://localhost/api/calculations', {
        method: 'DELETE',
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('id is required');
    });

    it('should return 401 when not authenticated', async () => {
      mockGetUser.mockResolvedValueOnce({ data: { user: null }, error: null });

      const request = new NextRequest('http://localhost/api/calculations?id=calc-1', {
        method: 'DELETE',
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toContain('Authentication required');
    });

    it('should return 200 on successful delete', async () => {
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: 'user-1', email: 'test@example.com' } },
        error: null,
      });

      // Chain 0: delete calculation — .delete().eq().eq().select()
      const deleteChain = createChain();
      (deleteChain.select as jest.Mock)
        .mockResolvedValueOnce({ data: [{ id: 'calc-1' }], error: null });

      fromChains = [deleteChain];

      const request = new NextRequest('http://localhost/api/calculations?id=calc-1', {
        method: 'DELETE',
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});
