/**
 * API Integration Tests for /api/billing/portal
 *
 * These tests verify:
 * - Rate limiting enforcement
 * - Auth required (no user returns 401)
 * - Missing Stripe key returns 500
 * - No Stripe customer found returns 404
 * - Success path creates portal session and returns URL
 */

import { NextRequest } from 'next/server';

// Mock Supabase
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
};

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => mockSupabase,
}));

// Mock getAuthenticatedUser (billing/portal uses getAuthenticatedUser, not requireAuth)
const mockGetAuthenticatedUser = jest.fn();
jest.mock('@/lib/auth-helpers', () => ({
  getAuthenticatedUser: (...args: unknown[]) => mockGetAuthenticatedUser(...args),
}));

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn().mockResolvedValue({ success: true, remaining: 10 }),
  getIdentifier: jest.fn().mockReturnValue('test-ip'),
  getRateLimitHeaders: jest.fn().mockReturnValue({ 'X-RateLimit-Remaining': '10' }),
}));

// Mock Stripe
const mockPortalSessionCreate = jest.fn();
const mockCustomersList = jest.fn();

jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    billingPortal: {
      sessions: {
        create: mockPortalSessionCreate,
      },
    },
    customers: {
      list: mockCustomersList,
    },
  }));
});

// Import after mocking
import { POST } from '@/app/api/billing/portal/route';

describe('/api/billing/portal', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, STRIPE_SECRET_KEY: 'sk_test_fake123', NEXT_PUBLIC_APP_URL: 'https://test.example.com' };
    // Reset Supabase mock chain
    mockSupabase.from.mockReturnThis();
    mockSupabase.select.mockReturnThis();
    mockSupabase.update.mockReturnThis();
    mockSupabase.eq.mockReturnThis();
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  describe('POST', () => {
    it('should return 429 when rate limited', async () => {
      const { checkRateLimit } = require('@/lib/rate-limit');
      checkRateLimit.mockResolvedValueOnce({ success: false, remaining: 0 });

      const request = new NextRequest('http://localhost/api/billing/portal', { method: 'POST' });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.error).toContain('Too many requests');
    });

    it('should return 401 when not authenticated', async () => {
      mockGetAuthenticatedUser.mockResolvedValueOnce(null);

      const request = new NextRequest('http://localhost/api/billing/portal', { method: 'POST' });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(401);
      expect(data.error).toBe('Authentication required');
    });

    it('should return 500 when Stripe is not configured', async () => {
      process.env.STRIPE_SECRET_KEY = '';
      mockGetAuthenticatedUser.mockResolvedValueOnce({ id: 'user-1', email: 'test@example.com' });

      const request = new NextRequest('http://localhost/api/billing/portal', { method: 'POST' });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Stripe not configured');
    });

    it('should return 404 when no Stripe customer is found', async () => {
      mockGetAuthenticatedUser.mockResolvedValueOnce({ id: 'user-1', email: 'test@example.com' });
      mockSupabase.single.mockResolvedValueOnce({
        data: { stripe_customer_id: null, email: 'test@example.com' },
        error: null,
      });
      mockCustomersList.mockResolvedValueOnce({ data: [] });

      const request = new NextRequest('http://localhost/api/billing/portal', { method: 'POST' });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('No subscription found for this account');
    });

    it('should return portal URL when customer has stripe_customer_id in profile', async () => {
      mockGetAuthenticatedUser.mockResolvedValueOnce({ id: 'user-1', email: 'test@example.com' });
      mockSupabase.single.mockResolvedValueOnce({
        data: { stripe_customer_id: 'cus_abc123', email: 'test@example.com' },
        error: null,
      });
      mockPortalSessionCreate.mockResolvedValueOnce({
        url: 'https://billing.stripe.com/session/test123',
      });

      const request = new NextRequest('http://localhost/api/billing/portal', { method: 'POST' });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.url).toBe('https://billing.stripe.com/session/test123');
      expect(mockPortalSessionCreate).toHaveBeenCalledWith({
        customer: 'cus_abc123',
        return_url: 'https://test.example.com',
      });
    });
  });
});
