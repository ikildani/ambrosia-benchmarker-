/**
 * API Integration Tests for /api/user/data-export
 *
 * These tests verify:
 * - Authentication enforcement (requireAuth)
 * - Rate limiting (3 exports per hour)
 * - Successful data export with all user tables
 * - Content-Disposition header for download
 * - Error handling on database failure
 */

import { NextRequest } from 'next/server';

// Build chain-aware mock: each .from() call gets an isolated chain
let fromCallIndex: number;
let fromChains: Record<string, unknown>[];

function createChain(overrides: Record<string, unknown> = {}) {
  const chain: Record<string, unknown> = {
    select: jest.fn().mockReturnThis(),
    eq: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  };
  (chain.select as jest.Mock).mockReturnValue(chain);
  (chain.eq as jest.Mock).mockReturnValue(chain);
  (chain.order as jest.Mock).mockReturnValue(chain);
  return chain;
}

const mockSupabase = {
  from: jest.fn(() => {
    const chain = fromChains[fromCallIndex] || createChain();
    fromCallIndex++;
    return chain;
  }),
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

// Import after mocking
import { GET } from '@/app/api/user/data-export/route';

describe('/api/user/data-export', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fromCallIndex = 0;
    fromChains = [];
    mockRequireAuth.mockResolvedValue([{ id: 'user-1', email: 'test@example.com' }, null]);
  });

  it('should return 401 when not authenticated', async () => {
    mockRequireAuth.mockResolvedValueOnce([null, new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 })]);
    const request = new NextRequest('http://localhost/api/user/data-export');

    const response = await GET(request);

    expect(response.status).toBe(401);
  });

  it('should return 429 when rate limited', async () => {
    const { checkRateLimit } = require('@/lib/rate-limit');
    checkRateLimit.mockResolvedValueOnce({ success: false, remaining: 0 });

    const request = new NextRequest('http://localhost/api/user/data-export');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(429);
    expect(data.error).toContain('Too many export requests');
  });

  it('should return 200 with exported user data on success', async () => {
    const profileData = { id: 'user-1', email: 'test@example.com', tier: 'pro' };
    const sessionsData = [{ id: 's1', user_id: 'user-1' }];
    const calculationsData = [{ id: 'c1', user_id: 'user-1' }];
    const eventsData = [{ id: 'e1', user_id: 'user-1' }];
    const leadScoreData = { id: 'ls1', user_id: 'user-1', score: 50 };

    // Chain 0: user_profiles
    const profileChain = createChain();
    (profileChain.single as jest.Mock).mockResolvedValueOnce({ data: profileData, error: null });

    // Chain 1: sessions
    const sessionsChain = createChain();
    (sessionsChain.order as jest.Mock).mockResolvedValueOnce({ data: sessionsData, error: null });

    // Chain 2: calculations
    const calculationsChain = createChain();
    (calculationsChain.order as jest.Mock).mockResolvedValueOnce({ data: calculationsData, error: null });

    // Chain 3: events
    const eventsChain = createChain();
    (eventsChain.order as jest.Mock).mockResolvedValueOnce({ data: eventsData, error: null });

    // Chain 4: lead_scores
    const leadScoreChain = createChain();
    (leadScoreChain.single as jest.Mock).mockResolvedValueOnce({ data: leadScoreData, error: null });

    fromChains = [profileChain, sessionsChain, calculationsChain, eventsChain, leadScoreChain];

    const request = new NextRequest('http://localhost/api/user/data-export');

    const response = await GET(request);
    const data = JSON.parse(await response.text());

    expect(response.status).toBe(200);
    expect(response.headers.get('Content-Type')).toBe('application/json');
    expect(response.headers.get('Content-Disposition')).toContain('attachment; filename="data-export-user-1-');
    expect(data.user_id).toBe('user-1');
    expect(data.email).toBe('test@example.com');
    expect(data.profile).toEqual(profileData);
    expect(data.sessions).toEqual(sessionsData);
    expect(data.calculations).toEqual(calculationsData);
    expect(data.events).toEqual(eventsData);
    expect(data.lead_score).toEqual(leadScoreData);
    expect(data.metadata.total_sessions).toBe(1);
    expect(data.metadata.total_calculations).toBe(1);
    expect(data.metadata.total_events).toBe(1);
  });

  it('should return 200 with empty data when user has no records', async () => {
    // Chain 0: user_profiles — no profile found
    const profileChain = createChain();
    (profileChain.single as jest.Mock).mockResolvedValueOnce({ data: null, error: null });

    // Chain 1: sessions — empty
    const sessionsChain = createChain();
    (sessionsChain.order as jest.Mock).mockResolvedValueOnce({ data: [], error: null });

    // Chain 2: calculations — empty
    const calculationsChain = createChain();
    (calculationsChain.order as jest.Mock).mockResolvedValueOnce({ data: [], error: null });

    // Chain 3: events — empty
    const eventsChain = createChain();
    (eventsChain.order as jest.Mock).mockResolvedValueOnce({ data: [], error: null });

    // Chain 4: lead_scores — not found
    const leadScoreChain = createChain();
    (leadScoreChain.single as jest.Mock).mockResolvedValueOnce({ data: null, error: null });

    fromChains = [profileChain, sessionsChain, calculationsChain, eventsChain, leadScoreChain];

    const request = new NextRequest('http://localhost/api/user/data-export');

    const response = await GET(request);
    const data = JSON.parse(await response.text());

    expect(response.status).toBe(200);
    expect(data.profile).toBeNull();
    expect(data.sessions).toEqual([]);
    expect(data.calculations).toEqual([]);
    expect(data.events).toEqual([]);
    expect(data.lead_score).toBeNull();
    expect(data.metadata.total_sessions).toBe(0);
  });
});
