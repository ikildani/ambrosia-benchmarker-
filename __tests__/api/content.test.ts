/**
 * Unit Tests for API utilities used by /api/content
 *
 * These tests verify:
 * - clampInt: integer parsing, clamping, and fallback behavior
 * - apiSuccess / apiError: response envelope structure
 */

import { clampInt } from '@/lib/api-validation';
import { apiSuccess, apiError } from '@/lib/api-response';

// ─── clampInt ────────────────────────────────────────────────────────────────

describe('clampInt', () => {
  it('should return parsed integer for valid string within range', () => {
    expect(clampInt('5', 1, 100, 50)).toBe(5);
  });

  it('should return parsed integer at lower boundary', () => {
    expect(clampInt('1', 1, 100, 50)).toBe(1);
  });

  it('should return parsed integer at upper boundary', () => {
    expect(clampInt('100', 1, 100, 50)).toBe(100);
  });

  it('should clamp to max when value exceeds upper bound', () => {
    expect(clampInt('999999', 1, 100, 50)).toBe(100);
  });

  it('should clamp to min when value is below lower bound', () => {
    expect(clampInt('-5', 1, 100, 50)).toBe(1);
  });

  it('should return fallback for NaN input', () => {
    expect(clampInt('abc', 1, 100, 50)).toBe(50);
  });

  it('should return fallback for null input', () => {
    expect(clampInt(null, 1, 100, 50)).toBe(50);
  });

  it('should return fallback for undefined input', () => {
    expect(clampInt(undefined, 1, 100, 50)).toBe(50);
  });

  it('should return fallback for empty string', () => {
    expect(clampInt('', 1, 100, 50)).toBe(50);
  });

  it('should handle zero as a valid value', () => {
    expect(clampInt('0', 0, 100, 50)).toBe(0);
  });

  it('should handle negative ranges correctly', () => {
    expect(clampInt('-3', -10, -1, -5)).toBe(-3);
  });

  it('should parse only the integer portion of float strings', () => {
    expect(clampInt('7.9', 1, 100, 50)).toBe(7);
  });
});

// ─── apiSuccess ──────────────────────────────────────────────────────────────

describe('apiSuccess', () => {
  it('should return JSON with success: true and spread data fields', async () => {
    const response = apiSuccess({ data: 'test' });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.success).toBe(true);
    expect(body.data).toBe('test');
  });

  it('should include meta with timestamp and requestId', async () => {
    const response = apiSuccess({ items: [] });
    const body = await response.json();

    expect(body.meta).toBeDefined();
    expect(body.meta.timestamp).toBeDefined();
    expect(body.meta.requestId).toBeDefined();
    // timestamp should be a valid ISO string
    expect(new Date(body.meta.timestamp).toISOString()).toBe(body.meta.timestamp);
    // requestId should be a UUID-like string (36 chars with hyphens)
    expect(body.meta.requestId).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/
    );
  });

  it('should accept a custom status code', async () => {
    const response = apiSuccess({ post: { id: '1' } }, 201);
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.success).toBe(true);
    expect(body.post).toEqual({ id: '1' });
  });

  it('should spread multiple data keys into the top-level body', async () => {
    const response = apiSuccess({ posts: [], total: 42, limit: 10, offset: 0 });
    const body = await response.json();

    expect(body.posts).toEqual([]);
    expect(body.total).toBe(42);
    expect(body.limit).toBe(10);
    expect(body.offset).toBe(0);
    expect(body.success).toBe(true);
  });
});

// ─── apiError ────────────────────────────────────────────────────────────────

describe('apiError', () => {
  it('should return JSON with success: false and error message', async () => {
    const response = apiError('Not found', 404);
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.success).toBe(false);
    expect(body.error).toBe('Not found');
  });

  it('should include meta with timestamp and requestId', async () => {
    const response = apiError('Server error', 500);
    const body = await response.json();

    expect(body.meta).toBeDefined();
    expect(body.meta.timestamp).toBeDefined();
    expect(body.meta.requestId).toBeDefined();
  });

  it('should default to status 500 when no status provided', async () => {
    const response = apiError('Something went wrong');

    expect(response.status).toBe(500);
  });

  it('should include error_code when provided', async () => {
    const response = apiError('Rate limited', 429, 'RATE_LIMIT_EXCEEDED');
    const body = await response.json();

    expect(body.error_code).toBe('RATE_LIMIT_EXCEEDED');
    expect(body.error).toBe('Rate limited');
    expect(body.success).toBe(false);
  });

  it('should omit error_code when not provided', async () => {
    const response = apiError('Bad request', 400);
    const body = await response.json();

    expect(body.error_code).toBeUndefined();
  });
});
