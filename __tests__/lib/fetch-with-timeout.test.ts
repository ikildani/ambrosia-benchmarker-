import { fetchWithTimeout } from '@/lib/fetch-with-timeout';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Create a minimal Response-like object that satisfies the Response interface. */
function mockResponse(status: number, body = ''): Response {
  return new Response(body, { status });
}

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

const originalFetch = global.fetch;

beforeEach(() => {
  global.fetch = jest.fn();
});

afterEach(() => {
  global.fetch = originalFetch;
  jest.restoreAllMocks();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('fetchWithTimeout', () => {
  // 1. Successful fetch passes through response
  it('should return the response on a successful fetch', async () => {
    const expected = mockResponse(200, 'ok');
    (global.fetch as jest.Mock).mockResolvedValueOnce(expected);

    const result = await fetchWithTimeout('https://example.com', {
      retryDelayMs: 1,
    });

    expect(result).toBe(expected);
    expect(result.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  // 2. Passes through fetch options (method, headers, body)
  it('should forward method, headers, and body to fetch', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse(200));

    await fetchWithTimeout('https://example.com/api', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key: 'value' }),
      retryDelayMs: 1,
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, opts] = (global.fetch as jest.Mock).mock.calls[0];
    expect(url).toBe('https://example.com/api');
    expect(opts.method).toBe('POST');
    expect(opts.headers).toEqual({ 'Content-Type': 'application/json' });
    expect(opts.body).toBe(JSON.stringify({ key: 'value' }));
    // signal should always be present (AbortController)
    expect(opts.signal).toBeInstanceOf(AbortSignal);
  });

  // 3. Timeout triggers abort
  it('should abort the request when timeoutMs is exceeded', async () => {
    // fetch never resolves — will be aborted by the controller
    (global.fetch as jest.Mock).mockImplementation(
      (_url: string, opts: RequestInit) =>
        new Promise((_resolve, reject) => {
          opts.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        })
    );

    await expect(
      fetchWithTimeout('https://example.com/slow', {
        timeoutMs: 10,
        retries: 0,
      })
    ).rejects.toThrow();
  }, 5_000);

  // 4. Retries on 429 status then succeeds
  it('should retry on 429 and succeed on next attempt', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockResponse(429))
      .mockResolvedValueOnce(mockResponse(200, 'success'));

    const result = await fetchWithTimeout('https://example.com', {
      retries: 2,
      retryDelayMs: 1,
    });

    expect(result.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  // 5. Retries on 502 status then succeeds
  it('should retry on 502 and succeed on next attempt', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockResponse(502))
      .mockResolvedValueOnce(mockResponse(200, 'ok'));

    const result = await fetchWithTimeout('https://example.com', {
      retries: 2,
      retryDelayMs: 1,
    });

    expect(result.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  // 6. Retries on 503 status then succeeds
  it('should retry on 503 and succeed on next attempt', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockResponse(503))
      .mockResolvedValueOnce(mockResponse(200));

    const result = await fetchWithTimeout('https://example.com', {
      retries: 1,
      retryDelayMs: 1,
    });

    expect(result.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  // 7. Retries on 504 status then succeeds
  it('should retry on 504 and succeed on next attempt', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockResponse(504))
      .mockResolvedValueOnce(mockResponse(200));

    const result = await fetchWithTimeout('https://example.com', {
      retries: 1,
      retryDelayMs: 1,
    });

    expect(result.status).toBe(200);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  });

  // 8. Does NOT retry on 400 status
  it('should NOT retry on 400 and return the response immediately', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse(400, 'bad request'));

    const result = await fetchWithTimeout('https://example.com', {
      retries: 2,
      retryDelayMs: 1,
    });

    expect(result.status).toBe(400);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  // 9. Does NOT retry on 401 status
  it('should NOT retry on 401 and return the response immediately', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse(401, 'unauthorized'));

    const result = await fetchWithTimeout('https://example.com', {
      retries: 2,
      retryDelayMs: 1,
    });

    expect(result.status).toBe(401);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  // 10. Does NOT retry on 500 status
  it('should NOT retry on 500 and return the response immediately', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse(500, 'server error'));

    const result = await fetchWithTimeout('https://example.com', {
      retries: 2,
      retryDelayMs: 1,
    });

    expect(result.status).toBe(500);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  // 11. Exponential backoff delay (verify delays double)
  it('should use exponential backoff: delays double between retries', async () => {
    const callTimestamps: number[] = [];

    (global.fetch as jest.Mock).mockImplementation(() => {
      callTimestamps.push(Date.now());
      return Promise.resolve(mockResponse(503));
    });

    // Use retryDelayMs = 50 so delays are measurable: 50, 100
    const start = Date.now();
    const result = await fetchWithTimeout('https://example.com', {
      retries: 2,
      retryDelayMs: 50,
    });

    // On the last attempt (attempt === retries), transient status is returned directly
    expect(result.status).toBe(503);
    expect(global.fetch).toHaveBeenCalledTimes(3);

    // Verify that later calls happen after increasing delays
    // Between call 0 and call 1: ~50ms delay
    // Between call 1 and call 2: ~100ms delay
    const gap1 = callTimestamps[1] - callTimestamps[0];
    const gap2 = callTimestamps[2] - callTimestamps[1];

    // Allow generous tolerance for CI jitter, but gap2 should be roughly >= gap1
    expect(gap1).toBeGreaterThanOrEqual(30); // ~50ms expected
    expect(gap2).toBeGreaterThanOrEqual(60); // ~100ms expected
    expect(gap2).toBeGreaterThan(gap1 * 0.8); // gap2 >= ~80% of gap1 (it should be ~2x)
  }, 10_000);

  // 12. Retry exhaustion on transient errors throws
  it('should return the transient response when all retries are exhausted', async () => {
    (global.fetch as jest.Mock)
      .mockResolvedValueOnce(mockResponse(503))
      .mockResolvedValueOnce(mockResponse(503))
      .mockResolvedValueOnce(mockResponse(503));

    // With retries: 2 => attempts 0, 1, 2. On the last attempt (2 === retries),
    // the transient response is returned rather than retried.
    const result = await fetchWithTimeout('https://example.com', {
      retries: 2,
      retryDelayMs: 1,
    });

    expect(result.status).toBe(503);
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  // 13. Network error (fetch throws) retries then throws
  it('should retry on network errors and throw after exhausting retries', async () => {
    const networkError = new TypeError('Failed to fetch');
    (global.fetch as jest.Mock).mockRejectedValue(networkError);

    await expect(
      fetchWithTimeout('https://example.com', {
        retries: 2,
        retryDelayMs: 1,
      })
    ).rejects.toThrow('Failed to fetch');

    // 1 initial + 2 retries = 3 total calls
    expect(global.fetch).toHaveBeenCalledTimes(3);
  });

  // 14. Zero retries option (retries: 0) - no retry attempt
  it('should not retry when retries is 0', async () => {
    (global.fetch as jest.Mock).mockResolvedValueOnce(mockResponse(503));

    const result = await fetchWithTimeout('https://example.com', {
      retries: 0,
      retryDelayMs: 1,
    });

    // With retries: 0, attempt 0 === retries, so the transient status is returned directly
    expect(result.status).toBe(503);
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  // 15. Custom timeoutMs and retryDelayMs options work
  it('should respect custom timeoutMs and retryDelayMs values', async () => {
    // Verify custom timeoutMs: fetch hangs, should abort within our custom timeout
    (global.fetch as jest.Mock).mockImplementation(
      (_url: string, opts: RequestInit) =>
        new Promise((_resolve, reject) => {
          opts.signal?.addEventListener('abort', () => {
            reject(new DOMException('The operation was aborted.', 'AbortError'));
          });
        })
    );

    const start = Date.now();

    await expect(
      fetchWithTimeout('https://example.com', {
        timeoutMs: 50,
        retries: 1,
        retryDelayMs: 10,
      })
    ).rejects.toThrow();

    const elapsed = Date.now() - start;

    // Should complete in roughly (50 timeout + 10 delay + 50 timeout) = ~110ms
    // Use generous upper bound for CI; the key point is it did NOT wait 15s (the default)
    expect(elapsed).toBeLessThan(2_000);
    expect(global.fetch).toHaveBeenCalledTimes(2);
  }, 10_000);
});
