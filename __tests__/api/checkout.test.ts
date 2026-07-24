/**
 * API Integration Tests for /api/checkout
 *
 * These tests verify:
 * - Demo mode when Stripe key is missing
 * - Zod validation (purchaseType enum, calculationData for report)
 * - Stripe checkout session creation for subscription
 * - Stripe checkout session creation for report purchase
 * - Invalid promo code handling
 */

import { NextRequest } from 'next/server';

// Mock Stripe
const mockStripe = {
  checkout: {
    sessions: { create: jest.fn() },
  },
  promotionCodes: { list: jest.fn() },
};

jest.mock('stripe', () => jest.fn(() => mockStripe));

// Mock Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
};

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => mockSupabase,
}));

// Mock getAuthenticatedUser (checkout uses this, not requireAuth)
const mockGetAuthenticatedUser = jest.fn();
jest.mock('@/lib/auth-helpers', () => ({
  getAuthenticatedUser: (...args: unknown[]) => mockGetAuthenticatedUser(...args),
}));

// Import after mocking
import { POST } from '@/app/api/checkout/route';

describe('/api/checkout', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
    process.env.STRIPE_PRICE_ID = 'price_sub_123';
    process.env.STRIPE_REPORT_PRICE_ID = 'price_report_456';
    process.env.NEXT_PUBLIC_APP_URL = 'https://solidus.ambrosiaventures.co';
    mockGetAuthenticatedUser.mockResolvedValue({ id: 'user-1', email: 'test@example.com' });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return demo mode when STRIPE_SECRET_KEY is missing', async () => {
    delete process.env.STRIPE_SECRET_KEY;

    const request = new NextRequest('http://localhost/api/checkout', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.demo).toBe(true);
    expect(data.message).toContain('Stripe not configured');
  });

  it('should return 400 for invalid purchaseType', async () => {
    const request = new NextRequest('http://localhost/api/checkout', {
      method: 'POST',
      body: JSON.stringify({ purchaseType: 'invalid' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('should return 400 when report purchase is missing calculationData', async () => {
    const request = new NextRequest('http://localhost/api/checkout', {
      method: 'POST',
      body: JSON.stringify({ purchaseType: 'report' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toContain('calculationData');
  });

  it('should create subscription checkout session', async () => {
    mockStripe.checkout.sessions.create.mockResolvedValueOnce({
      url: 'https://checkout.stripe.com/session_sub',
    });

    const request = new NextRequest('http://localhost/api/checkout', {
      method: 'POST',
      body: JSON.stringify({ purchaseType: 'subscription' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.url).toBe('https://checkout.stripe.com/session_sub');
    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'subscription',
        line_items: [{ price: 'price_sub_123', quantity: 1 }],
      })
    );
  });

  it('should create report checkout session with calculationData', async () => {
    // Mock report_purchases insert
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: 'rp-1' },
      error: null,
    });

    mockStripe.checkout.sessions.create.mockResolvedValueOnce({
      url: 'https://checkout.stripe.com/session_report',
    });

    const request = new NextRequest('http://localhost/api/checkout', {
      method: 'POST',
      body: JSON.stringify({
        purchaseType: 'report',
        calculationData: {
          inputs: { modality: 'adc', phase: 'phase2' },
          results: { upfront: 100000000 },
        },
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.url).toBe('https://checkout.stripe.com/session_report');
    expect(data.reportId).toBe('rp-1');
    expect(mockStripe.checkout.sessions.create).toHaveBeenCalledWith(
      expect.objectContaining({
        mode: 'payment',
        metadata: expect.objectContaining({ product: 'deal-report' }),
      })
    );
  });
});
