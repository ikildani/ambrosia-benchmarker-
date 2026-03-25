/**
 * API Integration Tests for /api/user/delete-data
 *
 * These tests verify:
 * - Authentication enforcement (requireAuth)
 * - Rate limiting (1 deletion per day)
 * - Successful full data deletion (GDPR compliance)
 * - Partial failure handling (some tables fail, auth succeeds)
 * - Auth deletion failure returns 500
 */

import { NextRequest } from 'next/server';

// Build chain-aware mock: each .from() call gets an isolated chain
let fromCallIndex: number;
let fromChains: Record<string, unknown>[];

function createChain(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {
    select: jest.fn().mockReturnThis(),
    insert: jest.fn().mockReturnThis(),
    delete: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  };
  (chain.select as jest.Mock).mockReturnValue(chain);
  (chain.insert as jest.Mock).mockReturnValue(chain);
  (chain.delete as jest.Mock).mockReturnValue(chain);
  (chain.eq as jest.Mock).mockReturnValue(chain);
  (chain.order as jest.Mock).mockReturnValue(chain);
  return chain;
}

// For delete-data, we need a more flexible mock since there are many sequential calls
const mockDeleteResults: { error: { message: string } | null }[] = [];
let deleteCallIndex: number;

const mockAuthAdmin = {
  deleteUser: jest.fn(),
};

const mockSupabase = {
  from: jest.fn(() => {
    const result = mockDeleteResults[deleteCallIndex] || { error: null };
    deleteCallIndex++;
    return {
      select: jest.fn().mockReturnThis(),
      delete: jest.fn().mockReturnThis(),
      eq: jest.fn().mockImplementation(() => {
        // Return either a thenable (for terminal calls) or chainable
        return {
          eq: jest.fn().mockResolvedValue(result),
          // head: true calls resolve directly
          ...result,
          then: (resolve: (val: unknown) => void) => resolve(result),
        };
      }),
    };
  }),
  auth: {
    admin: mockAuthAdmin,
  },
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

jest.mock('@/lib/audit-log', () => ({
  logAuditEvent: jest.fn().mockResolvedValue(undefined),
  getAuditContext: jest.fn().mockReturnValue({ ip: '127.0.0.1', user_agent: 'test' }),
}));

// Import after mocking
import { DELETE } from '@/app/api/user/delete-data/route';

describe('/api/user/delete-data', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fromCallIndex = 0;
    fromChains = [];
    deleteCallIndex = 0;
    mockDeleteResults.length = 0;
    mockRequireAuth.mockResolvedValue([{ id: 'user-1', email: 'test@example.com' }, null]);
    mockAuthAdmin.deleteUser.mockResolvedValue({ error: null });
  });

  it('should return 401 when not authenticated', async () => {
    mockRequireAuth.mockResolvedValueOnce([null, new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 })]);
    const request = new NextRequest('http://localhost/api/user/delete-data', {
      method: 'DELETE',
    });

    const response = await DELETE(request);

    expect(response.status).toBe(401);
  });

  it('should return 429 when rate limited', async () => {
    const { checkRateLimit } = require('@/lib/rate-limit');
    checkRateLimit.mockResolvedValueOnce({ success: false, remaining: 0 });

    const request = new NextRequest('http://localhost/api/user/delete-data', {
      method: 'DELETE',
    });

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toContain('Account deletion already requested');
  });

  it('should return 200 with deletion summary on full success', async () => {
    // All from() calls succeed — provide enough entries for count queries + delete queries
    // The route does: 3 count queries, then ~15 delete queries, then auth.admin.deleteUser, then profile delete
    for (let i = 0; i < 25; i++) {
      mockDeleteResults.push({ error: null });
    }

    const request = new NextRequest('http://localhost/api/user/delete-data', {
      method: 'DELETE',
    });

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.message).toContain('permanently deleted');
    expect(data.deleted).toBeDefined();
    expect(mockAuthAdmin.deleteUser).toHaveBeenCalledWith('user-1');
  });

  it('should return 500 when auth user deletion fails', async () => {
    // All from() calls succeed
    for (let i = 0; i < 25; i++) {
      mockDeleteResults.push({ error: null });
    }
    // Auth deletion fails
    mockAuthAdmin.deleteUser.mockResolvedValueOnce({
      error: { message: 'Auth service unavailable' },
    });

    const request = new NextRequest('http://localhost/api/user/delete-data', {
      method: 'DELETE',
    });

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toContain('Failed to delete account');
    expect(data.failed_tables).toContain('auth_user');
  });

  it('should return 200 with warnings when non-critical deletions fail', async () => {
    // First few calls (count queries) succeed, then some table deletions fail
    // The route catches table deletion errors but continues
    for (let i = 0; i < 3; i++) {
      mockDeleteResults.push({ error: null }); // count queries
    }
    // First delete call fails (outreach_emails)
    mockDeleteResults.push({ error: { message: 'permission denied' } });
    // Rest succeed
    for (let i = 0; i < 20; i++) {
      mockDeleteResults.push({ error: null });
    }
    // Auth deletion succeeds
    mockAuthAdmin.deleteUser.mockResolvedValueOnce({ error: null });

    const request = new NextRequest('http://localhost/api/user/delete-data', {
      method: 'DELETE',
    });

    const response = await DELETE(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.success).toBe(true);
    expect(data.warnings).toBeDefined();
    expect(data.warnings).toContain('non-critical');
  });
});
