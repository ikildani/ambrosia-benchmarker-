import * as Sentry from '@sentry/nextjs';

/**
 * Capture an API route error to both console and Sentry.
 * Use in catch blocks instead of bare console.error().
 */
export function captureApiError(error: unknown, context: string) {
  console.error(`[${context}]`, error);
  Sentry.captureException(error, {
    tags: { api_route: context },
  });
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
