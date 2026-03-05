/**
 * API Integration Tests for /api/health
 *
 * These tests verify:
 * - GET returns 200 with status 'ok' when Supabase is healthy
 * - GET returns 503 with status 'degraded' when Supabase errors
 * - Response includes version, timestamp, and checks
 */

// Mock Supabase client
const mockSupabase = {
  from: jest.fn().mockReturnThis(),
  select: jest.fn().mockReturnThis(),
  limit: jest.fn(),
};

jest.mock('@/lib/supabase/server', () => ({
  createServiceClient: () => mockSupabase,
}));

// Import after mocking
import { GET } from '@/app/api/health/route';

describe('/api/health', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.from.mockReturnThis();
    mockSupabase.select.mockReturnThis();
  });

  it('should return 200 with status ok when Supabase is healthy', async () => {
    mockSupabase.limit.mockResolvedValueOnce({ error: null });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(200);
    expect(data.status).toBe('ok');
    expect(data.version).toBe('1.0.0');
    expect(data.timestamp).toBeDefined();
    expect(data.checks.supabase).toBe('ok');
    expect(data.checks.uptime).toBeDefined();
  });

  it('should return 503 with status degraded when Supabase has an error', async () => {
    mockSupabase.limit.mockResolvedValueOnce({ error: { message: 'connection refused' } });

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe('degraded');
    expect(data.checks.supabase).toBe('error');
  });

  it('should return 503 when Supabase throws an exception', async () => {
    mockSupabase.limit.mockRejectedValueOnce(new Error('Network error'));

    const response = await GET();
    const data = await response.json();

    expect(response.status).toBe(503);
    expect(data.status).toBe('degraded');
    expect(data.checks.supabase).toBe('error');
  });
});
