/**
 * API Integration Tests for /api/sessions
 *
 * These tests verify:
 * - Zod input validation for session creation and updates
 * - SECURITY: user_id in POST body is ignored (sessions start anonymous)
 * - Session lookup and ownership checks on PATCH
 * - Error handling for DB failures
 */

import { NextRequest } from 'next/server';

// Mock Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  insert: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  single: jest.fn(),
};

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => mockSupabase,
}));

// Import after mocking
import { POST, PATCH } from '@/app/api/sessions/route';

describe('/api/sessions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST - Create session', () => {
    it('should return 400 if anonymous_id is missing', async () => {
      const request = new NextRequest('http://localhost/api/sessions', {
        method: 'POST',
        body: JSON.stringify({}),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it('should return 200 with session_id for valid minimal body', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'session-123' },
        error: null,
      });

      const request = new NextRequest('http://localhost/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ anonymous_id: 'anon-1' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.session_id).toBe('session-123');
    });

    it('SECURITY: should ignore user_id in request body (session starts with user_id: null)', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'session-123' },
        error: null,
      });

      const request = new NextRequest('http://localhost/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          anonymous_id: 'anon-1',
          user_id: 'attacker-user-id', // should be ignored
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);

      // Verify the insert was called with user_id: null, not the attacker's ID
      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({ user_id: null })
      );
    });

    it('should return 200 with full body including device_type and utm params', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'session-456' },
        error: null,
      });

      const request = new NextRequest('http://localhost/api/sessions', {
        method: 'POST',
        body: JSON.stringify({
          anonymous_id: 'anon-2',
          device_type: 'mobile',
          referrer_url: 'https://google.com',
          utm_source: 'twitter',
          utm_medium: 'social',
          utm_campaign: 'launch',
        }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.session_id).toBe('session-456');

      expect(mockSupabase.insert).toHaveBeenCalledWith(
        expect.objectContaining({
          anonymous_id: 'anon-2',
          device_type: 'mobile',
          utm_source: 'twitter',
          utm_medium: 'social',
          utm_campaign: 'launch',
          referrer_url: 'https://google.com',
          user_id: null,
        })
      );
    });

    it('should return 500 when DB insert fails', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'DB insert error' },
      });

      const request = new NextRequest('http://localhost/api/sessions', {
        method: 'POST',
        body: JSON.stringify({ anonymous_id: 'anon-1' }),
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to create session');
    });
  });

  describe('PATCH - Update session', () => {
    it('should return 400 if session_id is missing', async () => {
      const request = new NextRequest('http://localhost/api/sessions', {
        method: 'PATCH',
        body: JSON.stringify({ duration_seconds: 120 }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it('should return 404 if session is not found', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: null,
        error: null,
      });

      const request = new NextRequest('http://localhost/api/sessions', {
        method: 'PATCH',
        body: JSON.stringify({ session_id: 'nonexistent' }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Session not found');
    });

    it('SECURITY: should return 403 if session is linked to another user', async () => {
      // Session already has a different user_id
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'session-123', anonymous_id: 'anon-1', user_id: 'existing-user' },
        error: null,
      });

      const request = new NextRequest('http://localhost/api/sessions', {
        method: 'PATCH',
        body: JSON.stringify({
          session_id: 'session-123',
          user_id: 'attacker-user', // different user trying to hijack
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.error).toBe('Session already linked to another user');
    });

    it('should return 200 when updating session fields', async () => {
      // Mock session lookup: from().select().eq().single()
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'session-123', anonymous_id: 'anon-1', user_id: null },
        error: null,
      });
      // First eq() call (select chain) must return mockSupabase so .single() is reachable
      // Second eq() call (update chain) is the terminal — resolves with result
      mockSupabase.eq
        .mockReturnValueOnce(mockSupabase)   // select().eq() -> chain continues to .single()
        .mockResolvedValueOnce({ error: null }); // update().eq() -> terminal

      const request = new NextRequest('http://localhost/api/sessions', {
        method: 'PATCH',
        body: JSON.stringify({
          session_id: 'session-123',
          ended_at: '2026-02-23T12:00:00Z',
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return 200 when linking user_id to session', async () => {
      // Mock session lookup (no user_id yet)
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'session-123', anonymous_id: 'anon-1', user_id: null },
        error: null,
      });
      mockSupabase.eq
        .mockReturnValueOnce(mockSupabase)   // select().eq() -> chain continues to .single()
        .mockResolvedValueOnce({ error: null }); // update().eq() -> terminal

      const request = new NextRequest('http://localhost/api/sessions', {
        method: 'PATCH',
        body: JSON.stringify({
          session_id: 'session-123',
          user_id: 'new-user-id',
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return 500 when DB update fails', async () => {
      // Mock session lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'session-123', anonymous_id: 'anon-1', user_id: null },
        error: null,
      });
      mockSupabase.eq
        .mockReturnValueOnce(mockSupabase)   // select().eq() -> chain continues to .single()
        .mockResolvedValueOnce({ error: { message: 'DB update error' } }); // update().eq() -> terminal with error

      const request = new NextRequest('http://localhost/api/sessions', {
        method: 'PATCH',
        body: JSON.stringify({
          session_id: 'session-123',
          ended_at: '2026-02-23T12:00:00Z',
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('Failed to update session');
    });

    it('should return 200 with valid duration_seconds and calculation_count', async () => {
      // Mock session lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'session-123', anonymous_id: 'anon-1', user_id: null },
        error: null,
      });
      mockSupabase.eq
        .mockReturnValueOnce(mockSupabase)   // select().eq() -> chain continues to .single()
        .mockResolvedValueOnce({ error: null }); // update().eq() -> terminal

      const request = new NextRequest('http://localhost/api/sessions', {
        method: 'PATCH',
        body: JSON.stringify({
          session_id: 'session-123',
          duration_seconds: 300,
          calculation_count: 5,
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });
  });
});
