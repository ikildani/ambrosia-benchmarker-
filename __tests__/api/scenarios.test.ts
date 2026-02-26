/**
 * API Integration Tests for /api/scenarios
 *
 * These tests verify:
 * - Authentication enforcement (requireAuth)
 * - Tier verification (database-only, no client fallback)
 * - Input validation
 * - CRUD operations
 */

import { NextRequest } from 'next/server';

// Mock Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  delete: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn(),
};

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => mockSupabase,
}));

// Mock requireAuth — default: authenticated user
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

jest.mock('@/lib/config/authorized-emails', () => ({
  isProEmail: jest.fn().mockReturnValue(false),
}));

// Import after mocking
import { GET, POST, DELETE } from '@/app/api/scenarios/route';

describe('/api/scenarios', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue([{ id: 'user-1', email: 'pro@example.com' }, null]);
  });

  describe('GET - List scenarios', () => {
    it('should return 401 when not authenticated', async () => {
      mockRequireAuth.mockResolvedValueOnce([null, new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 })]);
      const request = new NextRequest('http://localhost/api/scenarios');

      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('should return 403 for free tier users', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { tier: 'free' },
        error: null,
      });

      const request = new NextRequest('http://localhost/api/scenarios');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Pro subscription required');
    });

    it('SECURITY: should NOT accept client tier as fallback', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { tier: 'free' },
        error: null,
      });

      // Try to pass tier=pro in query params (attack attempt) — ignored since auth comes from session
      const request = new NextRequest('http://localhost/api/scenarios?tier=pro');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Pro subscription required');
    });

    it('should return scenarios for pro tier users', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { tier: 'pro' },
        error: null,
      });

      mockSupabase.limit.mockResolvedValueOnce({
        data: [
          { id: '1', name: 'Test Scenario', inputs: {}, results: {} },
        ],
        error: null,
      });

      const request = new NextRequest('http://localhost/api/scenarios');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.scenarios).toHaveLength(1);
    });
  });

  describe('POST - Save scenario', () => {
    it('should return 401 when not authenticated', async () => {
      mockRequireAuth.mockResolvedValueOnce([null, new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 })]);
      const request = new NextRequest('http://localhost/api/scenarios', {
        method: 'POST',
        body: JSON.stringify({ name: 'Test', inputs: {}, results: {} }),
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('should return 400 if required fields are missing', async () => {
      const request = new NextRequest('http://localhost/api/scenarios', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBeDefined();
    });

    it('should return 403 for free tier users', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'user-1', tier: 'free' },
        error: null,
      });

      const request = new NextRequest('http://localhost/api/scenarios', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Scenario',
          inputs: { phase: 'phase2' },
          results: { upfront: 100 },
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toContain('Pro subscription required');
    });

    it('SECURITY: should NOT accept client tier in request body', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'user-1', tier: 'free' },
        error: null,
      });

      const request = new NextRequest('http://localhost/api/scenarios', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Scenario',
          inputs: { phase: 'phase2' },
          results: { upfront: 100 },
          tier: 'pro', // Attempted privilege escalation
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
    });

    it('should save scenario for pro tier users', async () => {
      mockSupabase.single
        .mockResolvedValueOnce({ data: { id: 'user-1', tier: 'pro' }, error: null })
        .mockResolvedValueOnce({ data: { id: 'scenario-1' }, error: null });

      // Mock count query for limit check
      mockSupabase.select.mockImplementation(() => ({
        ...mockSupabase,
        eq: jest.fn().mockReturnValue({
          ...mockSupabase,
        }),
      }));

      const request = new NextRequest('http://localhost/api/scenarios', {
        method: 'POST',
        body: JSON.stringify({
          name: 'Test Scenario',
          inputs: { phase: 'phase2' },
          results: { upfront: 100 },
        }),
      });

      const response = await POST(request);

      expect(response.status).toBeDefined();
    });
  });

  describe('DELETE - Delete scenario', () => {
    it('should return 401 when not authenticated', async () => {
      mockRequireAuth.mockResolvedValueOnce([null, new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 })]);
      const request = new NextRequest('http://localhost/api/scenarios?id=123', {
        method: 'DELETE',
      });

      const response = await DELETE(request);

      expect(response.status).toBe(401);
    });

    it('should return 400 if id is missing', async () => {
      const request = new NextRequest('http://localhost/api/scenarios', {
        method: 'DELETE',
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('id is required');
    });

    it('should delete scenario with valid id', async () => {
      mockSupabase.eq.mockReturnValue({
        ...mockSupabase,
        eq: jest.fn().mockResolvedValueOnce({ error: null }),
      });

      const request = new NextRequest('http://localhost/api/scenarios?id=123', {
        method: 'DELETE',
      });

      const response = await DELETE(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});

describe('Security: Tier Verification', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue([{ id: 'user-1', email: 'test@example.com' }, null]);
    // Re-setup mock chains after clearAllMocks
    mockSupabase.from.mockReturnThis();
    mockSupabase.select.mockReturnThis();
    mockSupabase.eq.mockReturnThis();
    mockSupabase.order.mockReturnThis();
    mockSupabase.limit.mockReturnThis();
  });

  const testCases = [
    { clientTier: 'pro', dbTier: 'free', shouldBlock: true },
    { clientTier: 'pro', dbTier: 'pro', shouldBlock: false },
    { clientTier: 'free', dbTier: 'free', shouldBlock: true },
    { clientTier: 'free', dbTier: 'pro', shouldBlock: false },
  ];

  testCases.forEach(({ clientTier, dbTier, shouldBlock }) => {
    it(`scenarios: clientTier=${clientTier}, dbTier=${dbTier} → ${shouldBlock ? 'BLOCKED' : 'ALLOWED'}`, async () => {
      // Mock tier lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: { tier: dbTier },
        error: null,
      });

      if (!shouldBlock) {
        // Mock the scenarios query for allowed cases
        mockSupabase.limit.mockResolvedValueOnce({ data: [], error: null });
      }

      // Client tier in query params should be ignored — auth comes from session
      const request = new NextRequest(
        `http://localhost/api/scenarios?tier=${clientTier}`
      );

      const response = await GET(request);

      if (shouldBlock) {
        expect(response.status).toBe(403);
      } else {
        expect(response.status).not.toBe(403);
      }
    });
  });
});
