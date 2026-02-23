import * as Sentry from '@sentry/nextjs';

/** Generate a unique request ID for tracing. */
export function generateRequestId(): string {
  return crypto.randomUUID();
}

/**
 * Capture an API route error to both console and Sentry.
 * Use in catch blocks instead of bare console.error().
 */
export function captureApiError(error: unknown, context: string, extra?: Record<string, unknown>) {
  console.error(`[${context}]`, error);
  Sentry.captureException(error, {
    tags: { api_route: context },
    ...(extra ? { extra } : {}),
  });
}

/**
 * Log slow API operations (>threshold) as Sentry warnings.
 * Call at the end of a successful request with the elapsed time.
 */
export function captureApiSuccess(context: string, meta?: { durationMs: number; requestId?: string }) {
  if (meta && meta.durationMs > 5000) {
    Sentry.captureMessage(`Slow API: ${context} took ${meta.durationMs}ms`, {
      level: 'warning',
      tags: { api_route: context },
      extra: { ...meta },
    });
  }
}

/**
 * Mask an email address for safe logging.
 * "user@example.com" → "us***@example.com"
 */
export function maskEmail(email: string): string {
  const [local, domain] = email.split('@');
  if (!domain) return '***';
  const prefix = local.slice(0, 2);
  return `${prefix}***@${domain}`;
}
