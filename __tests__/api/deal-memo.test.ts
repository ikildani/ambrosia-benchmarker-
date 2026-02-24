/**
 * API Integration Tests for /api/deal-memo
 *
 * These tests verify:
 * - Zod input validation (inputs, labels)
 * - Authorization: report purchase, pro tier (userId/email), cached memo
 * - AI memo generation success path
 * - Error handling: AI failure, config errors
 * - Caching: generated memo stored back to report_purchases
 */

import { NextRequest } from 'next/server';

// --- Mock setup (before route import) ---

const mockGenerateMemo = jest.fn();

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

jest.mock('@/lib/ai/deal-memo-generator', () => ({
  getDealMemoGenerator: () => ({ generateMemo: mockGenerateMemo }),
  DealMemo: {},
}));

jest.mock('@/lib/config/authorized-emails', () => ({
  isProEmail: jest.fn(() => false),
}));

jest.mock('@/lib/sentry-api', () => ({
  captureApiError: jest.fn(),
}));

jest.mock('@/lib/logger', () => ({
  createLogger: () => ({
    info: jest.fn(),
    error: jest.fn(),
    warn: jest.fn(),
    startTimer: () => () => 100,
  }),
}));

// Import route handler AFTER mocks are registered
import { POST } from '@/app/api/deal-memo/route';

// --- Shared fixtures ---

const validBody = {
  inputs: {
    modality: 'mab',
    phase: 'phase2',
    indication: 'lung_nsclc',
    territory: 'global',
    therapeuticArea: 'oncology',
  },
  results: {
    terms: {},
    tieredRoyalties: {},
    dealRecommendation: {},
    negotiationInsight: '',
    modifiers: [],
  },
  labels: {
    phase: 'Phase 2',
    modality: 'Monoclonal Antibody',
    indication: 'NSCLC',
  },
};

const fakeMemo = {
  executiveSummary: 'Test executive summary',
  sections: [],
};

function makeRequest(body: Record<string, unknown>): NextRequest {
  return new NextRequest('http://localhost/api/deal-memo', {
    method: 'POST',
    body: JSON.stringify(body),
  });
}

describe('/api/deal-memo', () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // Default: single() resolves to no data (unauthorized by default)
    mockSupabase.single.mockResolvedValue({ data: null, error: null });

    // Default: update chain resolves
    mockSupabase.update.mockReturnValue({
      eq: jest.fn().mockResolvedValue({ data: null, error: null }),
    });

    // Default: generator returns a valid memo
    mockGenerateMemo.mockResolvedValue(fakeMemo);
  });

  // -------------------------------------------------------
  // Zod validation
  // -------------------------------------------------------
  describe('Zod validation', () => {
    it('should return 400 when inputs field is missing', async () => {
      const body = { results: validBody.results, labels: validBody.labels };
      const response = await POST(makeRequest(body));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it('should return 400 when labels field is missing', async () => {
      const body = { inputs: validBody.inputs, results: validBody.results };
      const response = await POST(makeRequest(body));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });
  });

  // -------------------------------------------------------
  // Authorization
  // -------------------------------------------------------
  describe('Authorization', () => {
    it('should authorize via report purchase when reportId is valid', async () => {
      // First single() call: report_purchases lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'r1', status: 'completed', memo_content: null },
        error: null,
      });

      const body = { ...validBody, reportId: 'r1' };
      const response = await POST(makeRequest(body));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.memo).toBeDefined();
    });

    it('should return cached memo without calling generator when memo_content exists', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'r1', status: 'completed', memo_content: fakeMemo },
        error: null,
      });

      const body = { ...validBody, reportId: 'r1' };
      const response = await POST(makeRequest(body));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.memo).toEqual(fakeMemo);
      expect(mockGenerateMemo).not.toHaveBeenCalled();
    });

    it('should authorize pro tier user by userId', async () => {
      // First single() call: report_purchases (no match)
      // We skip reportId so it jumps straight to userId check
      mockSupabase.single.mockResolvedValueOnce({
        data: { tier: 'pro', email: 'user@example.com' },
        error: null,
      });

      const body = { ...validBody, userId: 'user-123' };
      const response = await POST(makeRequest(body));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should authorize pro tier user by email', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { tier: 'pro', email: 'pro@example.com' },
        error: null,
      });

      const body = { ...validBody, email: 'pro@example.com' };
      const response = await POST(makeRequest(body));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return 403 when no reportId, userId, or email provided', async () => {
      const response = await POST(makeRequest(validBody));
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Pro subscription required');
    });

    it('should return 403 for free tier user', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { tier: 'free', email: 'free@example.com' },
        error: null,
      });

      const body = { ...validBody, userId: 'free-user' };
      const response = await POST(makeRequest(body));
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
    });
  });

  // -------------------------------------------------------
  // Success path
  // -------------------------------------------------------
  describe('Success', () => {
    it('should generate memo and return it for authorized user', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { tier: 'pro', email: 'pro@test.com' },
        error: null,
      });

      const body = { ...validBody, userId: 'pro-user' };
      const response = await POST(makeRequest(body));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.memo).toEqual(fakeMemo);
      expect(mockGenerateMemo).toHaveBeenCalledWith({
        inputs: validBody.inputs,
        results: validBody.results,
        labels: validBody.labels,
      });
    });
  });

  // -------------------------------------------------------
  // Error handling
  // -------------------------------------------------------
  describe('Error handling', () => {
    it('should return 500 with truncated message when AI generation fails', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { tier: 'pro', email: 'pro@test.com' },
        error: null,
      });
      mockGenerateMemo.mockRejectedValueOnce(new Error('Model returned empty output after 3 retries'));

      const body = { ...validBody, userId: 'pro-user' };
      const response = await POST(makeRequest(body));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toContain('Generation failed');
    });

    it('should return AI config error when ANTHROPIC_API_KEY is missing', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { tier: 'pro', email: 'pro@test.com' },
        error: null,
      });
      mockGenerateMemo.mockRejectedValueOnce(new Error('ANTHROPIC_API_KEY is not set'));

      const body = { ...validBody, userId: 'pro-user' };
      const response = await POST(makeRequest(body));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('AI service configuration error');
    });
  });

  // -------------------------------------------------------
  // Caching
  // -------------------------------------------------------
  describe('Caching', () => {
    it('should cache generated memo in report_purchases when reportId is provided', async () => {
      const mockUpdateEq = jest.fn().mockResolvedValue({ data: null, error: null });
      mockSupabase.update.mockReturnValue({ eq: mockUpdateEq });

      // Report purchase exists but no cached memo
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'r1', status: 'completed', memo_content: null },
        error: null,
      });

      const body = { ...validBody, reportId: 'r1' };
      const response = await POST(makeRequest(body));

      expect(response.status).toBe(200);

      // Verify supabase update was called to cache the memo
      expect(mockSupabase.from).toHaveBeenCalledWith('report_purchases');
      expect(mockSupabase.update).toHaveBeenCalledWith({ memo_content: fakeMemo });
      expect(mockUpdateEq).toHaveBeenCalledWith('id', 'r1');
    });
  });
});
