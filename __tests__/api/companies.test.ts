/**
 * API Integration Tests for /api/companies/[companyId]
 *
 * These tests verify:
 * - Invalid UUID format returns 400
 * - Company not found returns 404
 * - Success path returns company profile with deals, trials, and computed data
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
    neq: jest.fn().mockReturnThis(),
    or: jest.fn().mockReturnThis(),
    in: jest.fn().mockReturnThis(),
    gte: jest.fn().mockReturnThis(),
    gt: jest.fn().mockReturnThis(),
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
  (chain.neq as jest.Mock).mockReturnValue(chain);
  (chain.or as jest.Mock).mockReturnValue(chain);
  (chain.in as jest.Mock).mockReturnValue(chain);
  (chain.gte as jest.Mock).mockReturnValue(chain);
  (chain.gt as jest.Mock).mockReturnValue(chain);
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

// Import after mocking
import { GET } from '@/app/api/companies/[companyId]/route';

const VALID_UUID = '550e8400-e29b-41d4-a716-446655440000';

describe('/api/companies/[companyId]', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    fromCallIndex = 0;
    fromChains = [];
  });

  describe('GET', () => {
    it('should return 400 for invalid UUID format', async () => {
      const request = new NextRequest('http://localhost/api/companies/not-a-uuid');

      const response = await GET(request, { params: { companyId: 'not-a-uuid' } });
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('Invalid company ID');
    });

    it('should return 404 when company is not found', async () => {
      // Chain 0: companies query returns error
      const companyChain = createChain();
      (companyChain.single as jest.Mock).mockResolvedValueOnce({
        data: null,
        error: { message: 'No rows returned', code: 'PGRST116' },
      });

      fromChains = [companyChain];

      const request = new NextRequest(`http://localhost/api/companies/${VALID_UUID}`);

      const response = await GET(request, { params: { companyId: VALID_UUID } });
      const data = await response.json();

      expect(response.status).toBe(404);
      expect(data.error).toBe('Company not found');
    });

    it('should return 200 with company profile for a valid company (free user)', async () => {
      const companyData = {
        id: VALID_UUID,
        name: 'TestPharma Inc',
        company_type: 'large_pharma',
        hq_country: 'United States',
        acquisition_appetite: 'aggressive',
        modalities_active: ['adc', 'mab'],
        indications_active: ['solid_tumor'],
        deals_last_12mo: 5,
        active_trials_count: 3,
        patent_cliffs: [{ year: 2027, drug: 'DrugX' }],
        strategic_priorities: ['oncology expansion'],
      };

      const dealsData = [
        {
          id: 'd1',
          licensor_name: 'TestPharma Inc',
          licensee_name: 'PartnerA',
          asset_name: 'AssetX',
          modality: 'adc',
          phase_at_signing: 'phase2',
          upfront_usd: 50000000,
          total_deal_value_usd: 200000000,
          announced_date: '2026-02-01',
          indication_category: 'solid_tumor',
          therapeutic_area: 'oncology',
        },
      ];

      const trialsData = [
        {
          nct_id: 'NCT0001',
          trial_title: 'Phase 2 ADC Trial',
          phase: 'phase2',
          status: 'recruiting',
          modality: 'adc',
          indication_category: 'solid_tumor',
          start_date: '2025-06-01',
          primary_completion_date: '2027-01-01',
          enrollment_count: 200,
        },
      ];

      // Chain 0: company profile
      const companyChain = createChain();
      (companyChain.single as jest.Mock).mockResolvedValueOnce({ data: companyData, error: null });

      // Chain 1: recent deals (allDealsResult) — resolves at .limit()
      const dealsChain = createChain();
      (dealsChain.limit as jest.Mock).mockResolvedValueOnce({ data: dealsData, error: null });

      // Chain 2: trials — resolves at .order()
      const trialsChain = createChain();
      (trialsChain.order as jest.Mock).mockResolvedValueOnce({ data: trialsData, error: null });

      // Chain 3: trend deals (allDealsForTrend) — resolves at .order()
      const trendChain = createChain();
      (trendChain.order as jest.Mock).mockResolvedValueOnce({ data: dealsData, error: null });

      // Chain 4: peer companies (competitive peers) — resolves at .limit()
      const peersChain = createChain();
      (peersChain.limit as jest.Mock).mockResolvedValueOnce({
        data: [
          {
            id: 'peer-1',
            name: 'PeerCo',
            company_type: 'mid_pharma',
            modalities_active: ['adc'],
            indications_active: ['solid_tumor'],
          },
        ],
        error: null,
      });

      // Chain 5: peer deals enrichment — resolves at .gte()
      const peerDealsChain = createChain();
      (peerDealsChain.gte as jest.Mock).mockResolvedValueOnce({ data: [], error: null });

      // Chain 6: market position (allCompanyDealCounts) — resolves at .order()
      const marketChain = createChain();
      (marketChain.order as jest.Mock).mockResolvedValueOnce({
        data: [
          { id: VALID_UUID, deals_last_12mo: 5 },
          { id: 'other', deals_last_12mo: 3 },
        ],
        error: null,
      });

      fromChains = [companyChain, dealsChain, trialsChain, trendChain, peersChain, peerDealsChain, marketChain];

      const request = new NextRequest(`http://localhost/api/companies/${VALID_UUID}`);

      const response = await GET(request, { params: { companyId: VALID_UUID } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.company.name).toBe('TestPharma Inc');
      expect(data.company.company_type).toBe('large_pharma');
      expect(data.is_pro).toBe(false);
      // Free user: financials gated
      expect(data.company.acquisition_appetite).toBeNull();
      expect(data.company.patent_cliffs).toBeNull();
      expect(data.recent_deals).toBeDefined();
      expect(data.active_trials).toBeDefined();
      expect(data.pipeline_by_phase).toBeDefined();
      expect(data.deal_flow_trend).toBeDefined();
      expect(data.summary).toContain('TestPharma Inc');
    });

    it('should return full data for pro user', async () => {
      const companyData = {
        id: VALID_UUID,
        name: 'ProPharma',
        company_type: 'large_biotech',
        hq_country: 'United Kingdom',
        acquisition_appetite: 'moderate',
        modalities_active: [],
        indications_active: [],
        deals_last_12mo: 2,
        active_trials_count: 1,
        patent_cliffs: [{ year: 2028, drug: 'DrugY' }],
        strategic_priorities: ['rare disease'],
      };

      // Chain 0: user profile (pro tier)
      const profileChain = createChain();
      (profileChain.single as jest.Mock).mockResolvedValueOnce({ data: { tier: 'pro' }, error: null });

      // Chain 1: company
      const companyChain = createChain();
      (companyChain.single as jest.Mock).mockResolvedValueOnce({ data: companyData, error: null });

      // Chain 2: deals
      const dealsChain = createChain();
      (dealsChain.limit as jest.Mock).mockResolvedValueOnce({ data: [], error: null });

      // Chain 3: trials
      const trialsChain = createChain();
      (trialsChain.order as jest.Mock).mockResolvedValueOnce({ data: [], error: null });

      // Chain 4: trend deals
      const trendChain = createChain();
      (trendChain.order as jest.Mock).mockResolvedValueOnce({ data: [], error: null });

      // Chain 5: market position
      const marketChain = createChain();
      (marketChain.order as jest.Mock).mockResolvedValueOnce({
        data: [{ id: VALID_UUID, deals_last_12mo: 2 }],
        error: null,
      });

      fromChains = [profileChain, companyChain, dealsChain, trialsChain, trendChain, marketChain];

      const proUserId = '660e8400-e29b-41d4-a716-446655440001';
      const request = new NextRequest(`http://localhost/api/companies/${VALID_UUID}?user_id=${proUserId}`);

      const response = await GET(request, { params: { companyId: VALID_UUID } });
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.is_pro).toBe(true);
      expect(data.company.acquisition_appetite).toBe('moderate');
      expect(data.company.patent_cliffs).toEqual([{ year: 2028, drug: 'DrugY' }]);
    });
  });
});
