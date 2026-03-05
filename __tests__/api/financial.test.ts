/**
 * API Integration Tests for /api/financial
 *
 * These tests verify:
 * - Authentication enforcement (requireAuth)
 * - Rate limiting enforcement
 * - Input validation (therapeuticArea, indication required)
 * - Invalid therapeuticArea rejection
 * - Success path returning competitive landscape and deal flow forecast
 */

import { NextRequest } from 'next/server';

const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  limit: jest.fn().mockReturnThis(),
  single: jest.fn(),
};

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => mockSupabase,
}));

const mockRequireAuth = jest.fn();
jest.mock('@/lib/auth-helpers', () => ({
  requireAuth: (...args: unknown[]) => mockRequireAuth(...args),
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

const mockAnalyzeCompetitiveLandscape = jest.fn();
jest.mock('@/lib/services/pipeline-intelligence', () => ({
  analyzeCompetitiveLandscape: (...args: unknown[]) => mockAnalyzeCompetitiveLandscape(...args),
}));

const mockForecastDealFlow = jest.fn();
jest.mock('@/lib/services/deal-flow-forecast', () => ({
  forecastDealFlow: (...args: unknown[]) => mockForecastDealFlow(...args),
}));

// Import after mocking
import { GET } from '@/app/api/financial/route';

describe('/api/financial', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockRequireAuth.mockResolvedValue([{ id: 'user-1', email: 'test@example.com' }, null]);
  });

  describe('GET', () => {
    it('should return 401 when not authenticated', async () => {
      mockRequireAuth.mockResolvedValueOnce([null, new Response(JSON.stringify({ error: 'Authentication required' }), { status: 401 })]);
      const request = new NextRequest('http://localhost/api/financial?therapeuticArea=oncology&indication=solid_tumor');

      const response = await GET(request);

      expect(response.status).toBe(401);
    });

    it('should return 429 when rate limited', async () => {
      const { checkRateLimit } = require('@/lib/rate-limit');
      checkRateLimit.mockResolvedValueOnce({ success: false, remaining: 0 });

      const request = new NextRequest('http://localhost/api/financial?therapeuticArea=oncology&indication=solid_tumor');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(429);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Too many requests');
    });

    it('should return 400 when therapeuticArea is missing', async () => {
      const request = new NextRequest('http://localhost/api/financial?indication=solid_tumor');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('therapeuticArea');
    });

    it('should return 400 when indication is missing', async () => {
      const request = new NextRequest('http://localhost/api/financial?therapeuticArea=oncology');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('indication');
    });

    it('should return 400 for invalid therapeuticArea', async () => {
      const request = new NextRequest('http://localhost/api/financial?therapeuticArea=invalid_area&indication=solid_tumor');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Invalid therapeuticArea');
    });

    it('should return 200 with competitive landscape and deal flow forecast on success', async () => {
      const competitiveData = {
        competitors: [{ company: 'PharmaA', pipeline_count: 3 }],
        market_concentration: 0.45,
      };
      const forecastData = {
        predicted_deals_next_quarter: 12,
        trend: 'increasing',
      };

      mockAnalyzeCompetitiveLandscape.mockResolvedValueOnce(competitiveData);
      mockForecastDealFlow.mockResolvedValueOnce(forecastData);

      const request = new NextRequest('http://localhost/api/financial?therapeuticArea=oncology&indication=solid_tumor&modality=adc');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.competitiveLandscape).toEqual(competitiveData);
      expect(data.dealFlowForecast).toEqual(forecastData);
    });

    it('should return null for failed sub-analyses without erroring', async () => {
      mockAnalyzeCompetitiveLandscape.mockRejectedValueOnce(new Error('DB error'));
      mockForecastDealFlow.mockRejectedValueOnce(new Error('Forecast error'));

      const request = new NextRequest('http://localhost/api/financial?therapeuticArea=oncology&indication=solid_tumor');

      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.competitiveLandscape).toBeNull();
      expect(data.dealFlowForecast).toBeNull();
    });
  });
});
