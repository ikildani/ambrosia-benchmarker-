// Polyfill crypto.randomUUID for test environments that lack it
if (!globalThis.crypto?.randomUUID) {
  globalThis.crypto = {
    ...globalThis.crypto,
    randomUUID: () => '00000000-0000-0000-0000-000000000000',
  } as any;
}

import { apiSuccess, apiError, apiErrorWithHeaders } from '@/lib/api-response';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

describe('apiSuccess', () => {
  // 1. Returns 200 status by default
  it('returns 200 status by default', async () => {
    const response = apiSuccess({ items: [] as unknown[] });
    expect(response.status).toBe(200);
  });

  // 2. Body has success: true
  it('body has success: true', async () => {
    const response = apiSuccess({ items: [] as unknown[] });
    const body = await response.json();
    expect(body.success).toBe(true);
  });

  // 3. Data fields are spread at the top level (not nested under a "data" key)
  it('spreads data fields at the top level', async () => {
    const response = apiSuccess({ deals: [1, 2, 3], total: 3 });
    const body = await response.json();
    expect(body.deals).toEqual([1, 2, 3]);
    expect(body.total).toBe(3);
    expect(body.data).toBeUndefined();
  });

  // 4. meta.timestamp is a valid ISO string and meta.requestId is a valid UUID
  it('includes meta with valid timestamp and requestId', async () => {
    const response = apiSuccess({ ok: true });
    const body = await response.json();

    expect(body.meta).toBeDefined();
    // timestamp should parse to a valid Date
    const parsed = new Date(body.meta.timestamp);
    expect(parsed.toISOString()).toBe(body.meta.timestamp);
    // requestId should match UUID v4 format
    expect(body.meta.requestId).toMatch(UUID_RE);
  });

  // 5. Accepts a custom status code
  it('accepts a custom status code', async () => {
    const response = apiSuccess({ id: 'abc' }, 201);
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.success).toBe(true);
  });
});

describe('apiError', () => {
  // 6. Returns the specified status
  it('returns the specified status', async () => {
    const response = apiError('Not found', 404);
    expect(response.status).toBe(404);
  });

  // 7. Body has success: false and error is a flat string
  it('body has success: false and error is a flat string', async () => {
    const response = apiError('Something went wrong', 400);
    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('Something went wrong');
    expect(typeof body.error).toBe('string');
  });

  // 8. Defaults to 500 when no status is provided
  it('defaults to 500 status', async () => {
    const response = apiError('Internal error');
    expect(response.status).toBe(500);
  });

  // 9. Includes error_code in body when provided
  it('includes error_code when provided', async () => {
    const response = apiError('Rate limited', 429, 'RATE_LIMIT_EXCEEDED');
    const body = await response.json();
    expect(body.error_code).toBe('RATE_LIMIT_EXCEEDED');
    expect(body.success).toBe(false);
    expect(body.error).toBe('Rate limited');
  });
});

describe('apiErrorWithHeaders', () => {
  // 10. Includes custom headers in the response
  it('includes custom headers in the response', async () => {
    const response = apiErrorWithHeaders(
      'Too many requests',
      429,
      {
        'Retry-After': '60',
        'X-RateLimit-Remaining': '0',
      },
      'RATE_LIMIT'
    );

    expect(response.status).toBe(429);
    expect(response.headers.get('Retry-After')).toBe('60');
    expect(response.headers.get('X-RateLimit-Remaining')).toBe('0');

    const body = await response.json();
    expect(body.success).toBe(false);
    expect(body.error).toBe('Too many requests');
    expect(body.error_code).toBe('RATE_LIMIT');
  });
});
