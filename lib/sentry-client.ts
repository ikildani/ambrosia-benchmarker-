import * as Sentry from '@sentry/nextjs';

/**
 * Capture a client-side error to both console and Sentry.
 * Use in catch blocks instead of bare console.error().
 *
 * Safe for client-side imports — gracefully handles cases where
 * Sentry is not initialized (SSR, test environments).
 */
export function captureClientError(error: unknown, context: string, extra?: Record<string, unknown>): void {
  console.error(`[${context}]`, error);

  try {
    Sentry.captureException(error, {
      tags: { component: context },
      ...(extra ? { extra } : {}),
    });
  } catch {
    // Sentry not initialized (SSR, tests) — console.error above is sufficient
  }
}
