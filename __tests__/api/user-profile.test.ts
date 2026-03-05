/**
 * API Integration Tests for /api/user/profile
 *
 * These tests verify:
 * - PATCH requires authentication (requireAuth)
 * - Zod validation rejects invalid fields
 * - Unknown fields are stripped by .strip()
 * - Empty update body returns 400
 * - Successful profile update returns 200
 * - DB error returns 500
 */

import { NextRequest } from 'next/server';

// Mock Supabase service client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  update: jest.fn().mockReturnThis(),
  eq: jest.fn(),
};

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => mockSupabase,
}));

// Mock requireAuth — default: authenticated user
const mockRequireAuth = jest.fn();
jest.mock('@/lib/auth-helpers', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
}));

jest.mock('@/lib/sentry-api', () => ({
  captureApiError: jest.fn(),
}));

// Import after mocking
import { PATCH } from '@/app/api/user/profile/route';

describe('/api/user/profile', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue([{ id: 'user-1', email: 'test@example.com' }, null]);
    mockSupabase.from.mockReturnThis();
    mockSupabase.update.mockReturnThis();
  });

  describe('PATCH', () => {
    it('should return 401 when not authenticated', async () => {
      mockRequireAuth.mockResolvedValueOnce([null, new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 })]);

      const request = new NextRequest('http://localhost/api/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({ full_name: 'Test User' }),
      });

      const response = await PATCH(request);

      expect(response.status).toBe(401);
    });

    it('should return 400 for invalid field values (Zod validation)', async () => {
      const request = new NextRequest('http://localhost/api/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          linkedin_url: 'https://notlinkedin.com/in/test',
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('LinkedIn URL');
    });

    it('should return 400 when body has no recognized fields (all stripped)', async () => {
      const request = new NextRequest('http://localhost/api/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          unknown_field: 'should be stripped',
          another_fake: 123,
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toContain('No fields to update');
    });

    it('should return 200 on successful profile update', async () => {
      mockSupabase.eq.mockResolvedValueOnce({ error: null });

      const request = new NextRequest('http://localhost/api/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          full_name: 'Jane Doe',
          company_name: 'Ambrosia Ventures',
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return 500 when database update fails', async () => {
      mockSupabase.eq.mockResolvedValueOnce({ error: { message: 'Update failed' } });

      const request = new NextRequest('http://localhost/api/user/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          full_name: 'Jane Doe',
        }),
      });

      const response = await PATCH(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toContain('Failed to save profile');
    });
  });
});
