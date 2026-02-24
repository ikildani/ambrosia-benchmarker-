/**
 * API Integration Tests for /api/newsletter
 *
 * These tests verify:
 * - Zod validation for email field
 * - Already-subscribed detection
 * - New subscription success
 * - Database error handling
 */

import { NextRequest } from 'next/server';

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

// Import after mocking
import { POST } from '@/app/api/newsletter/route';

describe('/api/newsletter', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('should return 400 when email is missing', async () => {
    const request = new NextRequest('http://localhost/api/newsletter', {
      method: 'POST',
      body: JSON.stringify({}),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
  });

  it('should return 400 when email is invalid (no @)', async () => {
    const request = new NextRequest('http://localhost/api/newsletter', {
      method: 'POST',
      body: JSON.stringify({ email: 'not-an-email' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
    expect(data.error).toBeDefined();
  });

  it('should return 400 when email is empty string', async () => {
    const request = new NextRequest('http://localhost/api/newsletter', {
      method: 'POST',
      body: JSON.stringify({ email: '' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(400);
    expect(data.success).toBe(false);
  });

  it('should return 200 with message when already subscribed', async () => {
    // Mock existing subscriber found
    mockSupabase.single.mockResolvedValueOnce({
      data: { id: 'existing-sub-id' },
      error: null,
    });

    const request = new NextRequest('http://localhost/api/newsletter', {
      method: 'POST',
      body: JSON.stringify({ email: 'test@example.com' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toBe('Already subscribed');
  });

  it('should return 200 on new subscription', async () => {
    // Mock no existing subscriber (PGRST116 = no rows found)
    mockSupabase.single.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116' },
    });
    // Mock successful insert
    mockSupabase.insert.mockReturnValueOnce({ error: null });

    const request = new NextRequest('http://localhost/api/newsletter', {
      method: 'POST',
      body: JSON.stringify({ email: 'new@example.com' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
  });

  it('should return 500 on database insert error', async () => {
    // Mock no existing subscriber
    mockSupabase.single.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116' },
    });
    // Mock insert failure
    mockSupabase.insert.mockReturnValueOnce({
      error: { message: 'Insert failed', code: '42P01' },
    });

    const request = new NextRequest('http://localhost/api/newsletter', {
      method: 'POST',
      body: JSON.stringify({ email: 'fail@example.com' }),
    });

    const response = await POST(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.success).toBe(false);
    expect(data.error).toContain('Subscription failed');
  });
});
