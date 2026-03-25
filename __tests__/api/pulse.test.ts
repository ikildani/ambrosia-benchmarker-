/**
 * API Integration Tests for /api/pulse
 *
 * These tests verify:
 * - Rate limiting enforcement
 * - Zod validation for query params
 * - Pro tier gating (free users get nullified financials)
 * - Success paths for latest snapshot and history
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
    gte: jest.fn().mockReturnThis(),
    lte: jest.fn().mockReturnThis(),
    not: jest.fn().mockReturnThis(),
    order: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    single: jest.fn().mockResolvedValue({ data: null, error: null }),
    ...overrides,
  };
  (chain.select as jest.Mock).mockReturnValue(chain);
  (chain.insert as jest.Mock).mockReturnValue(chain);
  (chain.delete as jest.Mock).mockReturnValue(chain);
  (chain.eq as jest.Mock).mockReturnValue(chain);
  (chain.gte as jest.Mock).mockReturnValue(chain);
  (chain.lte as jest.Mock).mockReturnValue(chain);
  (chain.not as jest.Mock).mockReturnValue(chain);
  (chain.order as jest.Mock).mockReturnValue(chain);
  (chain.limit as jest.Mock).mockReturnValue(chain);
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

jest.mock('@/lib/rate-limit', () => ({
  checkRateLimit: jest.fn().mockResolvedValue({ success: true, remaining: 10 }),
  getIdentifier: jest.fn().mockReturnValue('test-ip'),
  getRateLimitHeaders: jest.fn().mockReturnValue({ 'X-RateLimit-Remaining': '10' }),
  RATE_LIMIT_CONFIGS: { calculations: { limit: 100, windowSeconds: 60 }, default: { limit: 60, windowSeconds: 60 } },
}));

jest.mock('@/lib/sentry-api', () => ({
  captureApiError: jest.fn(),
}));

// Import after mocking
import { GET } from '@/app/api/pulse/route';

describe('/api/pulse', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fromCallIndex = 0;
    fromChains = [];
  });

  describe('GET', () => {
    it('should return 429 when rate limited', async () => {
      const { checkRateLimit } = require('@/lib/rate-limit');
      checkRateLimit.mockResolvedValueOnce({ success: false, remaining: 0 });

      const request = new NextRequest('http://localhost/api/pulse');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Too many requests');
    });

    it('should return 400 for invalid query params', async () => {
      const request = new NextRequest('http://localhost/api/pulse?week=not-a-date');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
    });

    it('should return latest snapshot for pro user', async () => {
      const snapshotData = {
        id: 'snap-1',
        snapshot_date: '2026-03-01',
        snapshot_type: 'weekly',
        deal_count: 10,
        avg_upfront_usd: 50000000,
        total_upfront_usd: 500000000,
        notable_deals: [{ name: 'Deal A' }],
        modality_breakdown: { adc: { count: 5, avg_upfront: 40, total_value: 200 } },
        therapeutic_area_breakdown: {},
        phase_breakdown: {},
      };

      const dealData = [
        { id: 'd1', licensor_name: 'A', licensee_name: 'B', asset_name: 'X', modality: 'adc', phase_at_signing: 'phase2', upfront_usd: 50000000, total_deal_value_usd: 100000000, announced_date: '2026-03-01', therapeutic_area: 'oncology', indication_category: 'solid_tumor' },
      ];

      // Chain 0: no user_id, so no profile lookup
      // Chain 0: market_snapshots query (snapshot)
      const snapshotChain = createChain();
      (snapshotChain.single as jest.Mock).mockResolvedValueOnce({ data: snapshotData, error: null });

      // Chain 1: deals query
      const dealsChain = createChain();
      (dealsChain.order as jest.Mock).mockResolvedValueOnce({ data: dealData, error: null });

      fromChains = [snapshotChain, dealsChain];

      const request = new NextRequest('http://localhost/api/pulse?user_id=user-1');

      // Without a profile chain, user defaults to 'free' tier
      // Need profile chain first
      fromCallIndex = 0;
      const profileChain = createChain();
      (profileChain.single as jest.Mock).mockResolvedValueOnce({ data: { tier: 'pro' }, error: null });

      const snapshotChain2 = createChain();
      (snapshotChain2.single as jest.Mock).mockResolvedValueOnce({ data: snapshotData, error: null });

      const dealsChain2 = createChain();
      (dealsChain2.limit as jest.Mock).mockResolvedValueOnce({ data: dealData, error: null });

      fromChains = [profileChain, snapshotChain2, dealsChain2];

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.snapshot).toBeDefined();
      expect(data.is_pro).toBe(true);
      expect(data.snapshot.avg_upfront_usd).toBe(50000000);
      expect(data.deals).toHaveLength(1);
    });

    it('should gate financial data for free users', async () => {
      const snapshotData = {
        id: 'snap-1',
        snapshot_date: '2026-03-01',
        snapshot_type: 'weekly',
        deal_count: 10,
        avg_upfront_usd: 50000000,
        total_upfront_usd: 500000000,
        notable_deals: [{ name: 'Deal A' }],
        modality_breakdown: { adc: { count: 5, avg_upfront: 40, total_value: 200 } },
        therapeutic_area_breakdown: {},
        phase_breakdown: {},
      };

      const dealData = [
        { id: 'd1', licensor_name: 'A', licensee_name: 'B', asset_name: 'X', modality: 'adc', phase_at_signing: 'phase2', upfront_usd: 50000000, total_deal_value_usd: 100000000, announced_date: '2026-03-01', therapeutic_area: 'oncology', indication_category: 'solid_tumor' },
        { id: 'd2', licensor_name: 'C', licensee_name: 'D', asset_name: 'Y', modality: 'mab', phase_at_signing: 'phase1', upfront_usd: 30000000, total_deal_value_usd: 80000000, announced_date: '2026-03-01', therapeutic_area: 'oncology', indication_category: 'solid_tumor' },
        { id: 'd3', licensor_name: 'E', licensee_name: 'F', asset_name: 'Z', modality: 'adc', phase_at_signing: 'phase3', upfront_usd: 70000000, total_deal_value_usd: 200000000, announced_date: '2026-03-01', therapeutic_area: 'oncology', indication_category: 'solid_tumor' },
      ];

      // Chain 0: market_snapshots (no user_id means free tier)
      const snapshotChain = createChain();
      (snapshotChain.single as jest.Mock).mockResolvedValueOnce({ data: snapshotData, error: null });

      // Chain 1: deals
      const dealsChain = createChain();
      (dealsChain.limit as jest.Mock).mockResolvedValueOnce({ data: dealData, error: null });

      fromChains = [snapshotChain, dealsChain];

      const request = new NextRequest('http://localhost/api/pulse');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.is_pro).toBe(false);
      // Financial data should be nullified for free users
      expect(data.snapshot.avg_upfront_usd).toBeNull();
      expect(data.snapshot.total_upfront_usd).toBeNull();
      expect(data.snapshot.notable_deals).toEqual([]);
      // Free users only get 2 deals max with nullified financials
      expect(data.deals.length).toBeLessThanOrEqual(2);
      if (data.deals.length > 0) {
        expect(data.deals[0].upfront_usd).toBeNull();
        expect(data.deals[0].total_deal_value_usd).toBeNull();
      }
    });

    it('should return 404 when no snapshot is available', async () => {
      // Chain 0: snapshot query returns error
      const snapshotChain = createChain();
      (snapshotChain.single as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'No rows returned' },
      });

      // Chain 1: deals query (runs in parallel, but snapshot error is checked)
      const dealsChain = createChain();
      (dealsChain.limit as jest.Mock).mockResolvedValueOnce({ data: [], error: null });

      fromChains = [snapshotChain, dealsChain];

      const request = new NextRequest('http://localhost/api/pulse');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.success).toBe(false);
      expect(data.error).toContain('No snapshot available');
    });
  });
});
