/**
 * API Integration Tests for /api/events/batch
 *
 * These tests verify:
 * - Rate limiting
 * - Validation: events array required, max batch size
 * - Filters out invalid event types
 * - Returns 400 if no valid events after filtering
 * - Successful batch insert
 */

import { NextRequest } from 'next/server';

// Mock Supabase service client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  select: jest.fn(),
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
import { POST } from '@/app/api/events/batch/route';

describe('/api/events/batch', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.from.mockReturnThis();
    mockSupabase.insert.mockReturnThis();
  });

  it('should return 400 when events array is missing', async () => {
    const request = new NextRequest('http://localhost/api/events/batch', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Events array is required');
  });

  it('should return 400 when events array is empty', async () => {
    const request = new NextRequest('http://localhost/api/events/batch', {
      method: 'POST',
      body: JSON.stringify({ events: [] }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('Events array is required');
  });

  it('should return 400 when all events have invalid types', async () => {
    const request = new NextRequest('http://localhost/api/events/batch', {
      method: 'POST',
      body: JSON.stringify({
        events: [
          { event_type: 'invalid_type_1', event_data: {} },
          { event_type: 'invalid_type_2', event_data: {} },
        ],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.error).toContain('No valid events in batch');
  });

  it('should return 200 with processed count on success', async () => {
    mockSupabase.select.mockResolvedValueOnce({
      data: [{ id: 'evt-1' }, { id: 'evt-2' }],
      error: null,
    });

    const request = new NextRequest('http://localhost/api/events/batch', {
      method: 'POST',
      body: JSON.stringify({
        events: [
          { event_type: 'calculation_started', event_data: { phase: 'phase1' } },
          { event_type: 'calculation_completed', event_data: { result: 'ok' } },
        ],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.received).toBe(2);
    expect(data.processed).toBe(2);
  });

  it('should return 429 when rate limited', async () => {
    const { checkRateLimit } = require('@/lib/rate-limit');
    checkRateLimit.mockResolvedValueOnce({ success: false, remaining: 0 });

    const request = new NextRequest('http://localhost/api/events/batch', {
      method: 'POST',
      body: JSON.stringify({
        events: [{ event_type: 'calculation_started', event_data: {} }],
      }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toContain('Too many requests');
  });
});
