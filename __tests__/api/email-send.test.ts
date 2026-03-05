/**
 * API Integration Tests for /api/email/send
 *
 * These tests verify:
 * - Authentication enforcement (requireAuth)
 * - Zod validation (email type enum, required fields)
 * - Email must match authenticated user's email (SECURITY)
 * - Successful email send for welcome type
 * - Rate limiting
 */

import { NextRequest } from 'next/server';

// Mock Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  upsert: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
};

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => mockSupabase,
}));

// Mock requireAuth
const mockRequireAuth = jest.fn();
jest.mock('@/lib/auth-helpers', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn().mockResolvedValue({ success: true, remaining: 10 }),
  getIdentifier: jest.fn().mockReturnValue('test-ip'),
  getRateLimitHeaders: jest.fn().mockReturnValue({ 'X-RateLimit-Remaining': '10' }),
}));

jest.mock('@/lib/sentry-api', () => ({
  captureApiError: jest.fn(),
}));

// Mock email client functions
const mockSendWelcomeEmail = jest.fn();
const mockSendCalculationReceipt = jest.fn();
const mockSendUpgradeConfirmation = jest.fn();

jest.mock('@/lib/email/client', () => ({
  sendWelcomeEmail: (...args: unknown[]) => mockSendWelcomeEmail(...args),
  sendCalculationReceipt: (...args: unknown[]) => mockSendCalculationReceipt(...args),
  sendUpgradeConfirmation: (...args: unknown[]) => mockSendUpgradeConfirmation(...args),
}));

// Import after mocking
import { POST } from '@/app/api/email/send/route';

describe('/api/email/send', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue([{ id: 'user-1', email: 'test@example.com' }, null]);
    // Default: insert for email_logs succeeds
    mockSupabase.insert.mockReturnValue({ error: null });
  });

  it('should return 401 when not authenticated', async () => {
    mockRequireAuth.mockResolvedValueOnce([null, new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 })]);
    const request = new NextRequest('http://localhost/api/email/send', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', type: 'welcome' }),
    });

    const response = await POST(request);

    expect(response.status).toBe(401);
  });

  it('should return 400 when type is not in enum', async () => {
    const request = new NextRequest('http://localhost/api/email/send', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', type: 'invalid_type' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
  });

  it('should return 400 when email is missing', async () => {
    const request = new NextRequest('http://localhost/api/email/send', {
      method: 'POST',
      body: JSON.stringify({ type: 'welcome' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('should return 403 when email does not match authenticated user', async () => {
    const request = new NextRequest('http://localhost/api/email/send', {
      method: 'POST',
      body: JSON.stringify({ email: 'other@example.com', type: 'welcome' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(403);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Email must match authenticated user');
  });

  it('should return 200 on successful welcome email send', async () => {
    // email_preferences check — welcome not yet sent
    mockSupabase.single.mockResolvedValueOnce({ data: { welcome_sent: false }, error: null });
    // sendWelcomeEmail succeeds
    mockSendWelcomeEmail.mockResolvedValueOnce({ success: true, id: 'email-123' });

    const request = new NextRequest('http://localhost/api/email/send', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', type: 'welcome', name: 'Test User' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.id).toBe('email-123');
    expect(mockSendWelcomeEmail).toHaveBeenCalledWith('test@example.com', 'Test User');
  });

  it('should return 429 when rate limited', async () => {
    const { checkRateLimit } = require('@/lib/rate-limit');
    checkRateLimit.mockResolvedValueOnce({ success: false, remaining: 0 });

    const request = new NextRequest('http://localhost/api/email/send', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com', type: 'welcome' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Too many email requests');
  });
});
