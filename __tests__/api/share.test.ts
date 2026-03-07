/**
 * API Integration Tests for /api/share and /api/share/[token]
 *
 * These tests verify:
 * - Zod input validation for share creation
 * - Tier verification (database-only, no client fallback)
 * - Share link creation with expiration
 * - Token lookup, expiration, and view count
 * - Error handling for DB failures
 */

import { NextRequest } from 'next/server';

// Mock Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
  rpc: jest.fn().mockResolvedValue({ data: null, error: null }),
};

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => mockSupabase,
}));

jest.mock('nanoid', () => ({
  nanoid: () => 'test-token-12',
}));

jest.mock('@/lib/sentry-api', () => ({
  captureApiError: jest.fn(),
}));

// Mock requireAuth — default: authenticated user
const mockRequireAuth = jest.fn();
jest.mock('@/lib/auth-helpers', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

// Import after mocking
import { POST } from '@/app/api/share/route';
import { GET } from '@/app/api/share/[token]/route';

describe('/api/share', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue([{ id: 'user-1', email: 'pro@test.com' }, null]);
  });

  describe('POST - Create share link', () => {
    const validBody = {
      email: 'pro@test.com',
      inputs: { phase: 'phase2' },
      results: { upfront: 100 },
      labels: { phase: 'Phase 2' },
    };

    it('should return 400 if inputs is missing', async () => {
      const request = new NextRequest('http://localhost/api/share', {
        method: 'POST',
        body: JSON.stringify({ email: 'pro@test.com', results: { upfront: 100 } }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it('should return 400 if results is missing', async () => {
      const request = new NextRequest('http://localhost/api/share', {
        method: 'POST',
        body: JSON.stringify({ email: 'pro@test.com', inputs: { phase: 'phase2' } }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it('should return 400 for invalid expiresIn value', async () => {
      const request = new NextRequest('http://localhost/api/share', {
        method: 'POST',
        body: JSON.stringify({ ...validBody, expiresIn: '1d' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it('should return 401 when not authenticated', async () => {
      mockRequireAuth.mockResolvedValueOnce([null, new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 })]);
      const request = new NextRequest('http://localhost/api/share', {
        method: 'POST',
        body: JSON.stringify(validBody),
      });

      const response = await POST(request);

      expect(response.status).toBe(401);
    });

    it('should return 403 for free tier users', async () => {
      // Mock user profile lookup (tier check) returning free
      mockSupabase.single.mockResolvedValueOnce({
        data: { tier: 'free' },
        error: null,
      });

      const request = new NextRequest('http://localhost/api/share', {
        method: 'POST',
        body: JSON.stringify(validBody),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Pro subscription required to share calculations');
    });

    it('should return 200 for pro tier users with shareToken and shareUrl', async () => {
      // Mock tier check
      mockSupabase.single.mockResolvedValueOnce({
        data: { tier: 'pro' },
        error: null,
      });
      // Mock insert
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'shared-1', share_token: 'test-token-12' },
        error: null,
      });

      const request = new NextRequest('http://localhost/api/share', {
        method: 'POST',
        body: JSON.stringify(validBody),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.shareToken).toBe('test-token-12');
      expect(data.shareUrl).toContain('test-token-12');
    });

    it('should return 200 with expiresAt when expiresIn is 30d', async () => {
      // Mock tier check
      mockSupabase.single.mockResolvedValueOnce({
        data: { tier: 'pro' },
        error: null,
      });
      // Mock insert
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'shared-1', share_token: 'test-token-12' },
        error: null,
      });

      const request = new NextRequest('http://localhost/api/share', {
        method: 'POST',
        body: JSON.stringify({ ...validBody, expiresIn: '30d' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.expiresAt).toBeDefined();
      expect(data.expiresAt).not.toBeNull();
    });

    it('should return 500 when DB insert fails', async () => {
      // Mock tier check
      mockSupabase.single.mockResolvedValueOnce({
        data: { tier: 'pro' },
        error: null,
      });
      // Mock insert failure
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'DB insert failed' },
      });

      const request = new NextRequest('http://localhost/api/share', {
        method: 'POST',
        body: JSON.stringify(validBody),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to create share link');
    });
  });

  describe('GET /api/share/[token] - Retrieve shared calculation', () => {
    const mockSharedData = {
      share_token: 'abc123',
      inputs: { phase: 'phase2' },
      results: { upfront: 100 },
      labels: { phase: 'Phase 2' },
      view_count: 5,
      created_at: '2026-01-01T00:00:00Z',
      expires_at: null,
      is_public: true,
    };

    it('should return 400 if token is missing', async () => {
      const request = new NextRequest('http://localhost/api/share/');

      const response = await GET(request, { params: Promise.resolve({ token: '' }) });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Token required');
    });

    it('should return 404 if token is not found', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { code: 'PGRST116', message: 'not found' },
      });

      const request = new NextRequest('http://localhost/api/share/nonexistent');

      const response = await GET(request, { params: Promise.resolve({ token: 'nonexistent' }) });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Shared calculation not found or expired');
    });

    it('should return 410 if token is expired', async () => {
      const expiredData = {
        ...mockSharedData,
        expires_at: '2020-01-01T00:00:00Z', // expired
      };

      mockSupabase.single.mockResolvedValueOnce({
        data: expiredData,
        error: null,
      });

      const request = new NextRequest('http://localhost/api/share/abc123');

      const response = await GET(request, { params: Promise.resolve({ token: 'abc123' }) });
      const data = await response.json();

      expect(response.status).toBe(410);
      expect(data.error).toBe('This shared link has expired');
    });

    it('should return 200 with inputs, results, labels, viewCount on success', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: mockSharedData,
        error: null,
      });

      const request = new NextRequest('http://localhost/api/share/abc123');

      const response = await GET(request, { params: Promise.resolve({ token: 'abc123' }) });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.inputs).toEqual({ phase: 'phase2' });
      expect(data.results).toEqual({ upfront: 100 });
      expect(data.labels).toEqual({ phase: 'Phase 2' });
      expect(data.viewCount).toBe(6); // view_count (5) + 1
      expect(data.createdAt).toBe('2026-01-01T00:00:00Z');
      expect(data.expiresAt).toBeNull();
    });

    it('should return 500 on unexpected error', async () => {
      mockSupabase.single.mockRejectedValueOnce(new Error('DB connection lost'));

      const request = new NextRequest('http://localhost/api/share/abc123');

      const response = await GET(request, { params: Promise.resolve({ token: 'abc123' }) });
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal server error');
    });

    it('should increment view count via rpc call', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: mockSharedData,
        error: null,
      });

      const request = new NextRequest('http://localhost/api/share/abc123');

      await GET(request, { params: Promise.resolve({ token: 'abc123' }) });

      expect(mockSupabase.rpc).toHaveBeenCalledWith('increment_share_views', { p_token: 'abc123' });
    });
  });
});
