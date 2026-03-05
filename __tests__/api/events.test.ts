/**
 * API Integration Tests for /api/events
 *
 * These tests verify:
 * - Zod validation of event body
 * - Invalid event_type rejection
 * - Rate limiting
 * - Successful event insertion (anonymous, no auth header)
 * - Graceful error handling (tracking never breaks UX)
 */

import { NextRequest } from 'next/server';

// Mock Supabase service client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
  rpc: jest.fn().mockResolvedValue({ error: null }),
};

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => mockSupabase,
}));

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

// Import after mocking
import { POST } from '@/app/api/events/route';

describe('/api/events', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.from.mockReturnThis();
    mockSupabase.insert.mockResolvedValue({ error: null });
  });

  it('should return 400 when event_type is missing', async () => {
    const request = new NextRequest('http://localhost/api/events', {
      method: 'POST',
      body: JSON.stringify({ event_data: {} }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('should return 400 for invalid event_type not in allowed list', async () => {
    const request = new NextRequest('http://localhost/api/events', {
      method: 'POST',
      body: JSON.stringify({
        event_type: 'totally_fake_event',
        event_data: {},
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Invalid event type');
  });

  it('should return 200 on successful anonymous event', async () => {
    mockSupabase.insert.mockResolvedValueOnce({ error: null });

    const request = new NextRequest('http://localhost/api/events', {
      method: 'POST',
      body: JSON.stringify({
        event_type: 'calculation_started',
        event_data: { modality: 'mab' },
        anonymous_id: 'anon-123',
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should return 429 when rate limited', async () => {
    const { checkRateLimit } = require('@/lib/rate-limit');
    checkRateLimit.mockResolvedValueOnce({ success: false, remaining: 0 });

    const request = new NextRequest('http://localhost/api/events', {
      method: 'POST',
      body: JSON.stringify({
        event_type: 'calculation_started',
        event_data: {},
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Too many requests');
  });

  it('should still succeed even if DB insert errors (tracking never breaks UX)', async () => {
    mockSupabase.insert.mockResolvedValueOnce({ error: { message: 'insert failed' } });

    const request = new NextRequest('http://localhost/api/events', {
      method: 'POST',
      body: JSON.stringify({
        event_type: 'calculation_completed',
        event_data: { result: 'ok' },
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    // Event route intentionally doesn't fail on DB error
    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });
});
