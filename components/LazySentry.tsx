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

    let done = false;
    const go = () => { if (!done) { done = true; void loadSentry(); } };
    const afterLoad = () => {
      const w = window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number };
      if (w.requestIdleCallback) w.requestIdleCallback(go, { timeout: 4000 });
      else setTimeout(go, 2500);
    };
    if (document.readyState === 'complete') afterLoad();
    else window.addEventListener('load', afterLoad, { once: true });
    const cap = setTimeout(go, 6000);

    return () => {
      clearTimeout(cap);
      window.removeEventListener('load', afterLoad);
      window.removeEventListener('error', onError);
      window.removeEventListener('unhandledrejection', onRejection);
    };
  }, []);
  return null;
}
