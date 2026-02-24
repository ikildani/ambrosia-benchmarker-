import * as Sentry from '@sentry/nextjs';
import { createLogger, withRequestLogging } from '@/lib/logger';

jest.mock('@sentry/nextjs', () => ({
  captureMessage: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Parse the first argument of a console spy call as JSON. */
function parseLogEntry(spy: jest.SpyInstance, callIndex = 0): Record<string, unknown> {
  const raw = spy.mock.calls[callIndex]?.[0];
  expect(typeof raw).toBe('string');
  return JSON.parse(raw as string);
}

/** Small async delay. */
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

let logSpy: jest.SpyInstance;
let warnSpy: jest.SpyInstance;
let errorSpy: jest.SpyInstance;
let debugSpy: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  logSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
  warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  errorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  debugSpy = jest.spyOn(console, 'debug').mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
  warnSpy.mockRestore();
  errorSpy.mockRestore();
  debugSpy.mockRestore();
});

// ===========================================================================
// createLogger
// ===========================================================================

describe('createLogger', () => {
  // 1. info() outputs valid JSON to console.log
  it('info() outputs valid JSON to console.log', () => {
    const log = createLogger('test-ctx');
    log.info('hello world');

    expect(logSpy).toHaveBeenCalledTimes(1);

    // Should not throw — the output is valid JSON
    const entry = parseLogEntry(logSpy);
    expect(entry).toBeDefined();
  });

  // 2. info() includes context, level, message, timestamp
  it('info() includes context, level, message, and timestamp', () => {
    const log = createLogger('deal-memo');
    log.info('Generating memo');

    const entry = parseLogEntry(logSpy);
    expect(entry.level).toBe('info');
    expect(entry.context).toBe('deal-memo');
    expect(entry.message).toBe('Generating memo');
    expect(typeof entry.timestamp).toBe('string');
    // Timestamp should be ISO-8601
    expect(new Date(entry.timestamp as string).toISOString()).toBe(entry.timestamp);
  });

  // 3. info() includes requestId when provided
  it('info() includes requestId when provided', () => {
    const log = createLogger('api-route', 'req-123');
    log.info('Processing');

    const entry = parseLogEntry(logSpy);
    expect(entry.requestId).toBe('req-123');
  });

  // 4. info() includes extra data fields
  it('info() includes extra data fields spread into the entry', () => {
    const log = createLogger('bench');
    log.info('Result', { model: 'sonnet', attempt: 2, score: 0.95 });

    const entry = parseLogEntry(logSpy);
    expect(entry.model).toBe('sonnet');
    expect(entry.attempt).toBe(2);
    expect(entry.score).toBe(0.95);
  });

  // 5. warn() outputs to console.warn AND calls Sentry.captureMessage
  it('warn() outputs to console.warn and calls Sentry.captureMessage', () => {
    const log = createLogger('ingestion', 'req-456');
    log.warn('Slow AI call', { durationMs: 12000 });

    // console.warn called with JSON
    expect(warnSpy).toHaveBeenCalledTimes(1);
    const entry = parseLogEntry(warnSpy);
    expect(entry.level).toBe('warn');
    expect(entry.message).toBe('Slow AI call');
    expect(entry.durationMs).toBe(12000);

    // Sentry called
    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      '[ingestion] Slow AI call',
      expect.objectContaining({
        level: 'warning',
        tags: { context: 'ingestion' },
        extra: expect.objectContaining({ durationMs: 12000, requestId: 'req-456' }),
      })
    );
  });

  // 6. error() outputs to console.error but does NOT call Sentry
  it('error() outputs to console.error and does NOT call Sentry', () => {
    const log = createLogger('deal-memo');
    log.error('Generation failed', { error: 'timeout' });

    expect(errorSpy).toHaveBeenCalledTimes(1);
    const entry = parseLogEntry(errorSpy);
    expect(entry.level).toBe('error');
    expect(entry.message).toBe('Generation failed');
    expect(entry.error).toBe('timeout');

    // Sentry should NOT be called for errors (avoid double-reporting)
    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  // 7. debug() does NOT log in production
  it('debug() does NOT log when NODE_ENV is not development', () => {
    // The default test environment has NODE_ENV = 'test'
    const log = createLogger('debug-ctx');
    log.debug('verbose detail', { key: 'value' });

    expect(debugSpy).not.toHaveBeenCalled();
    expect(logSpy).not.toHaveBeenCalled();
  });

  // 8. startTimer() returns elapsed time function
  it('startTimer() returns a function that reports elapsed ms > 0', async () => {
    const log = createLogger('timer-ctx');
    const elapsed = log.startTimer();

    await delay(50);

    const ms = elapsed();
    expect(typeof ms).toBe('number');
    expect(ms).toBeGreaterThanOrEqual(1);
  });
});

// ===========================================================================
// withRequestLogging
// ===========================================================================

describe('withRequestLogging', () => {
  const fakeRequest = new Request('https://example.com/api/test', { method: 'GET' });

  // 9. Wraps handler and returns its response
  it('wraps handler and returns the response', async () => {
    const handler = jest.fn(async () => new Response('ok', { status: 200 }));

    const wrapped = withRequestLogging('test-route', handler);
    const response = await wrapped(fakeRequest);

    expect(handler).toHaveBeenCalledTimes(1);
    expect(response).toBeInstanceOf(Response);
    expect(response.status).toBe(200);
    expect(await response.text()).toBe('ok');
  });

  // 10. Logs completion with durationMs
  it('logs completion with durationMs', async () => {
    const handler = jest.fn(async () => new Response('done', { status: 200 }));

    const wrapped = withRequestLogging('api-bench', handler);
    await wrapped(fakeRequest);

    // Should have at least one console.log call with durationMs
    const logCalls = logSpy.mock.calls.map(
      (args: unknown[]) => JSON.parse(args[0] as string) as Record<string, unknown>
    );
    const completionLog = logCalls.find((e) => e.message === 'Request completed');
    expect(completionLog).toBeDefined();
    expect(typeof completionLog!.durationMs).toBe('number');
    expect(completionLog!.durationMs).toBeGreaterThanOrEqual(0);
    expect(completionLog!.status).toBe(200);
  });

  // 11. Slow requests (>5000ms) are logged as warnings
  it('logs a warning for slow requests exceeding 5000ms', async () => {
    // Mock Date.now to simulate a slow request without actually waiting
    const originalDateNow = Date.now;
    let callCount = 0;
    jest.spyOn(Date, 'now').mockImplementation(() => {
      callCount++;
      // First call is when startTimer() is invoked, subsequent calls return
      // a time 6000ms later to simulate a slow request
      return callCount === 1 ? 1000 : 7000;
    });

    const handler = jest.fn(async () => new Response('slow', { status: 200 }));

    const wrapped = withRequestLogging('slow-route', handler);
    await wrapped(fakeRequest);

    // The slow path logs via console.warn, not console.log
    expect(warnSpy).toHaveBeenCalled();
    const warnCalls = warnSpy.mock.calls.map(
      (args: unknown[]) => JSON.parse(args[0] as string) as Record<string, unknown>
    );
    const slowLog = warnCalls.find((e) => e.message === 'Slow request');
    expect(slowLog).toBeDefined();
    expect(slowLog!.durationMs).toBe(6000);

    (Date.now as unknown as jest.SpyInstance).mockRestore();
  });

  // 12. Re-throws errors from handler and logs them
  it('re-throws errors from the handler and logs the error', async () => {
    const handler = jest.fn(async () => {
      throw new Error('Something broke');
    });

    const wrapped = withRequestLogging('error-route', handler);

    await expect(wrapped(fakeRequest)).rejects.toThrow('Something broke');

    // Should have logged the error via console.error
    expect(errorSpy).toHaveBeenCalled();
    const errorCalls = errorSpy.mock.calls.map(
      (args: unknown[]) => JSON.parse(args[0] as string) as Record<string, unknown>
    );
    const errorLog = errorCalls.find((e) => e.message === 'Request failed');
    expect(errorLog).toBeDefined();
    expect(errorLog!.level).toBe('error');
    expect(errorLog!.error).toBe('Something broke');
    expect(typeof errorLog!.durationMs).toBe('number');
  });
});
