import * as Sentry from '@sentry/nextjs';
import {
  generateRequestId,
  captureApiError,
  captureApiSuccess,
  maskEmail,
} from '@/lib/sentry-api';

// ---------------------------------------------------------------------------
// Mocks
// ---------------------------------------------------------------------------

jest.mock('@sentry/nextjs', () => ({
  captureException: jest.fn(),
  captureMessage: jest.fn(),
}));

// ---------------------------------------------------------------------------
// Setup / Teardown
// ---------------------------------------------------------------------------

let consoleErrorSpy: jest.SpyInstance;

beforeEach(() => {
  consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
  jest.clearAllMocks();
});

afterEach(() => {
  consoleErrorSpy.mockRestore();
});

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe('generateRequestId', () => {
  // 1. Returns a valid UUID v4 format
  it('should return a string matching the UUID v4 format', () => {
    const id = generateRequestId();
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    expect(id).toMatch(uuidRegex);
  });
});

describe('captureApiError', () => {
  const testError = new Error('something broke');

  // 2. Calls console.error with the context prefix
  it('should call console.error with the context prefix', () => {
    captureApiError(testError, 'deals/populate');

    expect(consoleErrorSpy).toHaveBeenCalledTimes(1);
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      '[deals/populate]',
      testError,
    );
  });

  // 3. Calls Sentry.captureException with tags
  it('should call Sentry.captureException with api_route tag', () => {
    captureApiError(testError, 'deals/populate');

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(testError, {
      tags: { api_route: 'deals/populate' },
    });
  });

  // 4. Includes extra in Sentry call when provided
  it('should include extra data in Sentry.captureException when provided', () => {
    const extra = { requestId: 'abc-123', userId: 42 };
    captureApiError(testError, 'deals/populate', extra);

    expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    expect(Sentry.captureException).toHaveBeenCalledWith(testError, {
      tags: { api_route: 'deals/populate' },
      extra,
    });
  });
});

describe('captureApiSuccess', () => {
  // 5. No Sentry call for fast requests
  it('should NOT call Sentry.captureMessage for fast requests (durationMs: 1000)', () => {
    captureApiSuccess('deals/list', { durationMs: 1000 });

    expect(Sentry.captureMessage).not.toHaveBeenCalled();
  });

  // 6. Calls Sentry.captureMessage for slow requests
  it('should call Sentry.captureMessage for slow requests (durationMs: 6000)', () => {
    captureApiSuccess('deals/list', { durationMs: 6000, requestId: 'req-1' });

    expect(Sentry.captureMessage).toHaveBeenCalledTimes(1);
    expect(Sentry.captureMessage).toHaveBeenCalledWith(
      'Slow API: deals/list took 6000ms',
      {
        level: 'warning',
        tags: { api_route: 'deals/list' },
        extra: { durationMs: 6000, requestId: 'req-1' },
      },
    );
  });
});

describe('maskEmail', () => {
  // 7. Masks correctly for a normal email
  it('should mask "user@example.com" to "us***@example.com"', () => {
    expect(maskEmail('user@example.com')).toBe('us***@example.com');
  });

  // 8. Returns "***" when there is no domain
  it('should return "***" when the email has no @ sign', () => {
    expect(maskEmail('nodomain')).toBe('***');
  });
});
