/**
 * Client-side error capture with a lazily loaded Sentry SDK.
 *
 * Sep 2026 performance pass: `import * as Sentry from '@sentry/nextjs'` in the
 * error boundaries and this helper put the whole browser SDK (170 KB compressed
 * on the calculator, 75 KB elsewhere) in every page's critical path, costing up
 * to 2.4 s of main-thread time on a throttled phone. The SDK now loads after the
 * page is idle (see components/LazySentry.tsx). Errors raised before that are
 * queued and flushed once it is up, so nothing is lost.
 */
type SentrySdk = typeof import('@sentry/nextjs');
type Pending = { error: unknown; context: string; extra?: Record<string, unknown> };

const QUEUE_LIMIT = 50;
let sdk: SentrySdk | null = null;
let loading: Promise<SentrySdk | null> | null = null;
const queue: Pending[] = [];

function send(p: Pending) {
  if (!sdk) return;
  try {
    sdk.captureException(p.error, { tags: { component: p.context }, ...(p.extra ? { extra: p.extra } : {}) });
  } catch {
    // SDK refused the event; console.error already happened
  }
}

/** Capture a client-side error to both console and Sentry. Use in catch blocks instead of bare console.error(). */
export function captureClientError(error: unknown, context: string, extra?: Record<string, unknown>): void {
  console.error(`[${context}]`, error);
  if (typeof window === 'undefined') return;
  if (sdk) { send({ error, context, extra }); return; }
  if (queue.length < QUEUE_LIMIT) queue.push({ error, context, extra });
  // An error is a good reason to stop waiting for idle.
  void loadSentry();
}

/** Load and initialise the browser SDK once. Safe to call repeatedly. */
export function loadSentry(): Promise<SentrySdk | null> {
  if (sdk) return Promise.resolve(sdk);
  if (typeof window === 'undefined') return Promise.resolve(null);
  if (!process.env.NEXT_PUBLIC_SENTRY_DSN) return Promise.resolve(null);
  if (!loading) {
    loading = import('@sentry/nextjs')
      .then((S) => {
        S.init({
          dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
          tracesSampleRate: 0,
          enabled: process.env.NODE_ENV === 'production',
        });
        sdk = S;
        while (queue.length) send(queue.shift() as Pending);
        return S;
      })
      .catch((e) => {
        console.error('[sentry] failed to load', e);
        loading = null;
        return null;
      });
  }
  return loading;
}

export function isSentryLoaded(): boolean {
  return sdk !== null;
}
