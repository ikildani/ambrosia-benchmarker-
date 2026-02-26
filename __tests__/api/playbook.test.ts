/**
 * API Integration Tests for /api/playbook
 *
 * These tests verify:
 * - Zod input validation (inputs.modality, results, labels)
 * - Authorization: Bearer token, report purchase, userId/email pro tier
 * - AI playbook generation success path
 * - Error handling: AI config, parse failure
 */

import { NextRequest } from 'next/server';

// --- Mock setup (before route import) ---

const mockGeneratePlaybook = jest.fn();

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

jest.mock('@/lib/ai/playbook-generator', () => ({
  getPlaybookGenerator: () => ({ generatePlaybook: mockGeneratePlaybook }),
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

// Mock @supabase/supabase-js for Bearer token auth path
const mockGetUser = jest.fn();
jest.mock('@supabase/supabase-js', () => ({
  createClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}));

// Import route handler AFTER mocks are registered
import { POST } from '@/app/api/playbook/route';

// --- Shared fixtures ---

const validBody = {
  inputs: {
    modality: 'mab',
    phase: 'phase2',
    indication: 'lung_nsclc',
    territory: 'global',
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
    modality: 'MAB',
    indication: 'NSCLC',
  },
};

const fakePlaybook = {
  strategy: 'Test negotiation strategy',
  tactics: [],
};

function makeRequest(
  body: Record<string, unknown>,
  headers?: Record<string, string>
): NextRequest {
  return new NextRequest('http://localhost/api/playbook', {
    method: 'POST',
    body: JSON.stringify(body),
    headers: headers ?? {},
  });
}

describe('/api/playbook', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // Ensure env vars are set for createClient guard
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon-key';

    // Re-establish mock chain after clearAllMocks
    mockSupabase.from.mockReturnThis();
    mockSupabase.select.mockReturnThis();
    mockSupabase.insert.mockReturnThis();
    mockSupabase.update.mockReturnThis();
    mockSupabase.eq.mockReturnThis();

    // Default: single() resolves to no data (unauthorized by default)
    mockSupabase.single.mockResolvedValue({ data: null, error: null });

    // Default: getUser returns no user (Bearer auth fails by default)
    mockGetUser.mockResolvedValue({ data: { user: null } });

    // Default: generator returns a valid playbook
    mockGeneratePlaybook.mockResolvedValue(fakePlaybook);
  });

  // -------------------------------------------------------
  // Zod validation
  // -------------------------------------------------------
  describe('Zod validation', () => {
    it('should return 400 when inputs.modality is missing', async () => {
      const body = {
        ...validBody,
        inputs: { phase: 'phase2', indication: 'lung_nsclc', territory: 'global' },
      };
      const response = await POST(makeRequest(body));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it('should return 400 when results field is missing', async () => {
      const { results: _, ...bodyWithoutResults } = validBody;
      const response = await POST(makeRequest(bodyWithoutResults));
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.success).toBe(false);
      expect(data.error).toBeDefined();
    });

    it('should return 400 when labels field is missing', async () => {
      const { labels: _, ...bodyWithoutLabels } = validBody;
      const response = await POST(makeRequest(bodyWithoutLabels));
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
    it('should authorize via Bearer token when user has pro tier', async () => {
      // Bearer auth: getUser returns a valid user
      mockGetUser.mockResolvedValueOnce({
        data: { user: { id: 'bearer-user-id' } },
      });
      // Service client profile lookup for the bearer user
      mockSupabase.single.mockResolvedValueOnce({
        data: { tier: 'pro', email: 'bearer@example.com' },
        error: null,
      });

      const response = await POST(
        makeRequest(validBody, { Authorization: 'Bearer test-token-123' })
      );
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.playbook).toBeDefined();
    });

    it('should authorize via report purchase when reportId is valid', async () => {
      // First single() call: report_purchases lookup
      mockSupabase.single.mockResolvedValueOnce({
        data: { id: 'r1', status: 'completed' },
        error: null,
      });

      const body = { ...validBody, reportId: 'r1' };
      const response = await POST(makeRequest(body));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.playbook).toBeDefined();
    });

    it('should authorize pro tier user by userId', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { tier: 'pro', email: 'pro@example.com' },
        error: null,
      });

      const body = { ...validBody, userId: 'user-123' };
      const response = await POST(makeRequest(body));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
    });

    it('should return 403 when no auth credentials are provided', async () => {
      const response = await POST(makeRequest(validBody));
      const data = await response.json();

      expect(response.status).toBe(403);
      expect(data.success).toBe(false);
      expect(data.error).toContain('subscription');
    });
  });

  // -------------------------------------------------------
  // Success path
  // -------------------------------------------------------
  describe('Success', () => {
    it('should generate playbook and return it for authorized user', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { tier: 'pro', email: 'pro@test.com' },
        error: null,
      });

      const body = { ...validBody, userId: 'pro-user' };
      const response = await POST(makeRequest(body));
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      expect(data.playbook).toEqual(fakePlaybook);
      expect(mockGeneratePlaybook).toHaveBeenCalledWith({
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
    it('should return AI config error when ANTHROPIC_API_KEY is missing', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { tier: 'pro', email: 'pro@test.com' },
        error: null,
      });
      mockGeneratePlaybook.mockRejectedValueOnce(
        new Error('ANTHROPIC_API_KEY is not set')
      );

      const body = { ...validBody, userId: 'pro-user' };
      const response = await POST(makeRequest(body));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('AI service configuration error');
    });

    it('should return AI format error when No JSON found in response', async () => {
      mockSupabase.single.mockResolvedValueOnce({
        data: { tier: 'pro', email: 'pro@test.com' },
        error: null,
      });
      mockGeneratePlaybook.mockRejectedValueOnce(
        new Error('No JSON found in AI response')
      );

      const body = { ...validBody, userId: 'pro-user' };
      const response = await POST(makeRequest(body));
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.success).toBe(false);
      expect(data.error).toBe('AI response format error. Retrying may help.');
    });
  });
});
