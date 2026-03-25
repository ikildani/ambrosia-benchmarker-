/**
 * API Integration Tests for /api/deals
 *
 * These tests verify:
 * - Tier verification (database-only, no client fallback)
 * - Data blurring for free tier beyond 5 deals
 * - Filter functionality
 * - Pagination
 */

import { NextRequest } from 'next/server';

// Mock Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  in: jest.fn().mockReturnThis(),
  gte: jest.fn().mockReturnThis(),
  lte: jest.fn().mockReturnThis(),
  or: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  range: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  not: jest.fn().mockReturnThis(),
  single: jest.fn(),
};

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => mockSupabase,
}));

// Import after mocking
import { GET } from '@/app/api/deals/route';

// Sample deal data
const sampleDeals = Array.from({ length: 10 }, (_, i) => ({
  id: `deal-${i + 1}`,
  licensor_name: `Licensor ${i + 1}`,
  licensee_name: `Licensee ${i + 1}`,
  asset_name: `Asset ${i + 1}`,
  modality: 'adc',
  indication_category: 'lung_nsclc',
  phase_at_signing: 'phase2',
  territory: 'global',
  deal_type: 'license',
  upfront_usd: (i + 1) * 100000000,
  milestones_total_usd: (i + 1) * 500000000,
  total_deal_value_usd: (i + 1) * 600000000,
  royalty_low_pct: 10,
  royalty_high_pct: 15,
  announced_date: '2024-01-01',
  terms_disclosed: true,
}));

describe('/api/deals', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock for deals query
    mockSupabase.range.mockResolvedValue({
      data: sampleDeals,
      count: 10,
      error: null,
    });

    // Default mock for filter options
    mockSupabase.limit.mockResolvedValue({
      data: [{ modality: 'adc' }, { modality: 'bispecific' }],
      error: null,
    });
  });

  describe('Basic Functionality', () => {
    it('should return deals with pagination info', async () => {
      const request = new NextRequest('http://localhost/api/deals');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.deals).toBeDefined();
      expect(data.total).toBeDefined();
      expect(data.page).toBeDefined();
      expect(data.limit).toBeDefined();
      expect(data.totalPages).toBeDefined();
    });

    it('should return filter options', async () => {
      const request = new NextRequest('http://localhost/api/deals');

      const response = await GET(request);
      const data = await response.json();

      expect(data.filters).toBeDefined();
      expect(data.filters.modalities).toBeDefined();
    });
  });

  describe('Tier-Based Data Access', () => {
    it('should show full data for first 5 deals to free users', async () => {
      const request = new NextRequest('http://localhost/api/deals');

      const response = await GET(request);
      const data = await response.json();

      // First 5 deals should have full data
      expect(data.deals[0].upfront_usd).toBeDefined();
      expect(data.deals[0].upfront_usd).not.toBeNull();
      expect(data.deals[4].upfront_usd).toBeDefined();
    });

    it('should blur financial data beyond 5 deals for free users', async () => {
      const request = new NextRequest('http://localhost/api/deals');

      const response = await GET(request);
      const data = await response.json();

      // Deals beyond index 4 should have blurred financial data
      if (data.deals.length > 5) {
        expect(data.deals[5].upfront_usd).toBeNull();
        expect(data.deals[5].milestones_total_usd).toBeNull();
        expect(data.deals[5].total_deal_value_usd).toBeNull();
        expect(data.deals[5].blurred).toBe(true);
      }
    });

    it('should show all data for pro users', async () => {
      // Mock pro user lookup via x-user-id UUID header fallback
      mockSupabase.single.mockResolvedValueOnce({
        data: { tier: 'pro' },
        error: null,
      });

      // Use x-user-id header with valid UUID (route's Method 2 fallback)
      const request = new NextRequest('http://localhost/api/deals', {
        headers: { 'X-User-Id': '00000000-0000-0000-0000-000000000001' },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(data.userTier).toBe('pro');
      // All deals should have full data
      data.deals.forEach((deal: { upfront_usd: number | null; blurred?: boolean }) => {
        expect(deal.blurred).toBeUndefined();
      });
    });

    it('SECURITY: should NOT accept client tier as fallback', async () => {
      // Mock free user lookup in database
      mockSupabase.single.mockResolvedValueOnce({
        data: { tier: 'free' },
        error: null,
      });

      // Try to pass tier=pro in query (attack attempt) - email now in header
      const request = new NextRequest('http://localhost/api/deals?tier=pro', {
        headers: { 'X-User-Email': 'test@example.com' },
      });

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      // Should use database tier (free), not client tier (pro)
      expect(data.userTier).toBe('free');
      // Deals beyond 5 should still be blurred
      if (data.deals.length > 5) {
        expect(data.deals[5].blurred).toBe(true);
      }
    });
  });

  describe('Filtering', () => {
    it('should filter by modality', async () => {
      const request = new NextRequest('http://localhost/api/deals?modality=adc');

      await GET(request);

      expect(mockSupabase.in).toHaveBeenCalledWith('modality', ['adc']);
    });

    it('should filter by phase', async () => {
      const request = new NextRequest('http://localhost/api/deals?phase=phase2,phase3');

      await GET(request);

      expect(mockSupabase.in).toHaveBeenCalledWith('phase_at_signing', ['phase2', 'phase3']);
    });

    it('should filter by upfront range', async () => {
      const request = new NextRequest('http://localhost/api/deals?min_upfront=100&max_upfront=500');

      await GET(request);

      expect(mockSupabase.gte).toHaveBeenCalledWith('upfront_usd', 100000000);
      expect(mockSupabase.lte).toHaveBeenCalledWith('upfront_usd', 500000000);
    });

    it('should filter by terms_disclosed', async () => {
      const request = new NextRequest('http://localhost/api/deals?terms_disclosed=true');

      await GET(request);

      expect(mockSupabase.eq).toHaveBeenCalledWith('terms_disclosed', true);
    });

    it('should handle search query', async () => {
      const request = new NextRequest('http://localhost/api/deals?search=Pfizer');

      await GET(request);

      expect(mockSupabase.or).toHaveBeenCalled();
    });
  });

  describe('Pagination', () => {
    it('should respect page parameter', async () => {
      const request = new NextRequest('http://localhost/api/deals?page=2&limit=10');

      await GET(request);

      // Page 2 with limit 10 = range(10, 19)
      expect(mockSupabase.range).toHaveBeenCalledWith(10, 19);
    });

    it('should enforce max limit of 50', async () => {
      const request = new NextRequest('http://localhost/api/deals?limit=100');

      await GET(request);

      // Should cap at 50
      expect(mockSupabase.range).toHaveBeenCalledWith(0, 49);
    });

    it('should return pagination metadata', async () => {
      const request = new NextRequest('http://localhost/api/deals?page=1&limit=5');

      const response = await GET(request);
      const data = await response.json();

      expect(data.page).toBe(1);
      expect(data.limit).toBe(5);
      expect(data.totalPages).toBeDefined();
    });
  });

  describe('Sorting', () => {
    it('should sort by announced_date desc by default', async () => {
      const request = new NextRequest('http://localhost/api/deals');

      await GET(request);

      expect(mockSupabase.order).toHaveBeenCalledWith('announced_date', { ascending: false });
    });

    it('should respect custom sort parameters', async () => {
      const request = new NextRequest('http://localhost/api/deals?sort_by=upfront_usd&sort_order=asc');

      await GET(request);

      expect(mockSupabase.order).toHaveBeenCalledWith('upfront_usd', { ascending: true });
    });
  });
});
