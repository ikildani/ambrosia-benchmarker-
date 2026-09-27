'use client';

import { useEffect } from 'react';
import { captureClientError, loadSentry } from '@/lib/sentry-client';

/**
 * Loads the Sentry browser SDK after the page has gone idle (6 s cap), and
 * forwards any window error or unhandled rejection that happens before then.
 */
export default function LazySentry() {
  useEffect(() => {
    const onError = (e: ErrorEvent) => captureClientError(e.error ?? e.message, 'window.onerror');
    const onRejection = (e: PromiseRejectionEvent) => captureClientError(e.reason, 'unhandledrejection');
    window.addEventListener('error', onError);
    window.addEventListener('unhandledrejection', onRejection);

    // Load on the first interaction or 12 s after load, whichever first; an
    // error before then loads it immediately (captureClientError). Idle-based
    // loading landed inside the interactivity window on phones.
    let done = false;
    const go = () => { if (!done) { done = true; void loadSentry(); } };
    const events: Array<keyof WindowEventMap> = ['pointerdown', 'keydown', 'touchstart'];
    events.forEach((e) => window.addEventListener(e, go, { once: true, passive: true }));
    const cap = setTimeout(go, 12000);

    return () => {
      clearTimeout(cap);
      events.forEach((e) => window.removeEventListener(e, go));
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  return null;
}
