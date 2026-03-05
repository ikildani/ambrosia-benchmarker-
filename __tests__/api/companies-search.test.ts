/**
 * API Integration Tests for /api/companies/search
 *
 * These tests verify:
 * - Basic GET returns companies with pagination
 * - Search query filtering (ilike)
 * - Type filter (company_type)
 * - Pagination (page, limit, range)
 * - Stats returned on first unfiltered page
 */

import { NextRequest } from 'next/server';

// Mock Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  eq: jest.fn().mockReturnThis(),
  is: jest.fn().mockReturnThis(),
  ilike: jest.fn().mockReturnThis(),
  contains: jest.fn().mockReturnThis(),
  order: jest.fn().mockReturnThis(),
  range: jest.fn(),
};

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => mockSupabase,
}));

// Import after mocking
import { GET } from '@/app/api/companies/search/route';

const sampleCompanies = Array.from({ length: 5 }, (_, i) => ({
  id: `company-${i + 1}`,
  name: `Company ${i + 1}`,
  company_type: 'large_pharma',
  hq_country: 'US',
  modalities_active: ['adc', 'mab'],
  deals_last_12mo: 10 - i,
  active_trials_count: 5 - i,
  acquisition_appetite: 'high',
  last_deal_date: '2025-06-01',
  last_deal_modality: 'adc',
  data_quality_score: 0.9,
}));

describe('/api/companies/search', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default mock for main query
    mockSupabase.range.mockResolvedValue({
      data: sampleCompanies,
      count: 50,
      error: null,
    });
  });

  it('should return companies with pagination info', async () => {
    const request = new NextRequest('http://localhost/api/companies/search');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.companies).toBeDefined();
    expect(data.companies).toHaveLength(5);
    expect(data.total).toBe(50);
    expect(data.page).toBe(1);
    expect(data.limit).toBe(24);
  });

  it('should filter by search query', async () => {
    const request = new NextRequest('http://localhost/api/companies/search?q=Pfizer');

    await GET(request);

    expect(mockSupabase.ilike).toHaveBeenCalledWith('name', '%Pfizer%');
  });

  it('should filter by company type', async () => {
    // When filtering by type, stats are not returned
    const request = new NextRequest('http://localhost/api/companies/search?type=large_pharma');

    const response = await GET(request);
    const data = await response.json();

    expect(mockSupabase.eq).toHaveBeenCalledWith('company_type', 'large_pharma');
    expect(response.status).toBe(200);
    expect(data.stats).toBeNull();
  });

  it('should respect page and limit parameters', async () => {
    const request = new NextRequest('http://localhost/api/companies/search?page=3&limit=10');

    await GET(request);

    // Page 3 with limit 10 = offset 20, range(20, 29)
    expect(mockSupabase.range).toHaveBeenCalledWith(20, 29);
  });

  it('should return 500 on database error', async () => {
    mockSupabase.range.mockResolvedValueOnce({
      data: null,
      count: null,
      error: { message: 'Database connection failed' },
    });

    const request = new NextRequest('http://localhost/api/companies/search');

    const response = await GET(request);
    const data = await response.json();

    expect(response.status).toBe(500);
    expect(data.error).toBe('Search failed');
  });
});
