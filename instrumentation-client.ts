import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  tracesSampleRate: 0,
  // Session Replay intentionally not configured: it pulled a 168 KB chunk into
  // every page load and was never used. Re-enable deliberately if a debugging
  // need appears, and load it lazily when you do.
  enabled: process.env.NODE_ENV === 'production',
});

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
