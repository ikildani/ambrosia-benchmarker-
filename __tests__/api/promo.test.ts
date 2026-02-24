/**
 * API Integration Tests for /api/promo/validate
 *
 * These tests verify:
 * - Zod validation for code field
 * - Missing Stripe key handling
 * - Invalid / valid / inactive promo codes
 * - Rate limiting
 * - Stripe API error handling
 */

import { NextRequest } from 'next/server';

// Mock Stripe
const mockStripe = {
  promotionCodes: { list: jest.fn() },
  coupons: { retrieve: jest.fn() },
};

jest.mock('stripe', () => jest.fn(() => mockStripe));

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn().mockResolvedValue({ success: true, remaining: 10 }),
  getIdentifier: jest.fn().mockReturnValue('test-ip'),
  getRateLimitHeaders: jest.fn().mockReturnValue({ 'X-RateLimit-Remaining': '10' }),
}));

// Import after mocking
import { POST } from '@/app/api/promo/validate/route';

describe('/api/promo/validate', () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv };
    process.env.STRIPE_SECRET_KEY = 'sk_test_123';
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return 400 when code is missing', async () => {
    const request = new NextRequest('http://localhost/api/promo/validate', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
  });

  it('should return 400 when code is empty string', async () => {
    const request = new NextRequest('http://localhost/api/promo/validate', {
      method: 'POST',
      body: JSON.stringify({ code: '' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('should return 500 when STRIPE_SECRET_KEY is missing', async () => {
    delete process.env.STRIPE_SECRET_KEY;

    const request = new NextRequest('http://localhost/api/promo/validate', {
      method: 'POST',
      body: JSON.stringify({ code: 'SAVE20' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Payment system not configured');
  });

  it('should return 200 with valid: false for invalid promo code', async () => {
    mockStripe.promotionCodes.list.mockResolvedValueOnce({ data: [] });

    const request = new NextRequest('http://localhost/api/promo/validate', {
      method: 'POST',
      body: JSON.stringify({ code: 'BADCODE' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.valid).toBe(false);
    expect(data.message).toContain('Invalid or expired');
  });

  it('should return 200 with valid: true and discount info for valid promo code', async () => {
    mockStripe.promotionCodes.list.mockResolvedValueOnce({
      data: [{
        id: 'promo_123',
        active: true,
        promotion: {
          coupon: {
            percent_off: 20,
            amount_off: null,
            duration: 'once',
            name: '20% Off',
          },
        },
      }],
    });

    const request = new NextRequest('http://localhost/api/promo/validate', {
      method: 'POST',
      body: JSON.stringify({ code: 'SAVE20' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.valid).toBe(true);
    expect(data.promoId).toBe('promo_123');
    expect(data.discount).toEqual({
      percentOff: 20,
      amountOff: null,
      duration: 'once',
      name: '20% Off',
    });
  });

  it('should return 200 with valid: false for inactive promo code', async () => {
    mockStripe.promotionCodes.list.mockResolvedValueOnce({
      data: [{
        id: 'promo_456',
        active: false,
        promotion: {
          coupon: { percent_off: 10, amount_off: null, duration: 'once', name: '10% Off' },
        },
      }],
    });

    const request = new NextRequest('http://localhost/api/promo/validate', {
      method: 'POST',
      body: JSON.stringify({ code: 'EXPIRED10' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.valid).toBe(false);
    expect(data.message).toContain('no longer active');
  });

  it('should return 429 when rate limited', async () => {
    const { checkRateLimit } = require('@/lib/rate-limit');
    checkRateLimit.mockResolvedValueOnce({ success: false, remaining: 0 });

    const request = new NextRequest('http://localhost/api/promo/validate', {
      method: 'POST',
      body: JSON.stringify({ code: 'SAVE20' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.success).toBe(false);
  });

  it('should return 500 on Stripe API error', async () => {
    mockStripe.promotionCodes.list.mockRejectedValueOnce(new Error('Stripe connection error'));

    const request = new NextRequest('http://localhost/api/promo/validate', {
      method: 'POST',
      body: JSON.stringify({ code: 'SAVE20' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Failed to validate promo code');
  });
});
