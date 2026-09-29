'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { ga4ProUpgrade } from '@/lib/ga4';
import { captureClientError } from '@/lib/sentry-client';

// One way to start Pro from anywhere in the app (pricing section, paywall,
// /pro, trial page). Pro trials are card-required Stripe subscriptions, so
// every path ends in Stripe Checkout; the webhook turns Pro on.
//
// Signed-out visitors get the signup modal first and the checkout resumes
// automatically once they are signed in.

export interface StartProOptions {
  /** Ask for the 7-day card trial. The server grants it only once per person. */
  trial?: boolean;
  billingInterval?: 'monthly' | 'annual';
  /** Where the click happened, for attribution (pricing, paywall, pro_page, ...). */
  source: string;
  /** Stripe promotion-code id or customer-facing code, from a campaign link. */
  promoCode?: string;
}

const CHECKOUT_UNAVAILABLE = 'Checkout is temporarily unavailable. Please email support@ambrosiaventures.co and we will set you up.';

export function useProCheckout() {
  const { isAuthenticated, openAuthModal, user } = useAuth();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const pending = useRef<StartProOptions | null>(null);

  const start = useCallback(async (opts: StartProOptions) => {
    setError(null);
    if (!isAuthenticated) {
      pending.current = opts;
      openAuthModal('signup');
      return;
    }

    setIsLoading(true);
    ga4ProUpgrade(opts.source);
    try {
      const res = opts.trial
        ? await fetch('/api/trial/start', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ billingInterval: opts.billingInterval ?? 'monthly', source: opts.source }),
          })
        : await fetch('/api/checkout', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              purchaseType: 'subscription',
              billingInterval: opts.billingInterval ?? 'monthly',
              email: user?.email,
              promoCode: opts.promoCode || undefined,
              source: opts.source,
            }),
          });
      const data = await res.json().catch(() => ({}));
      if (data.url) {
        window.location.href = data.url;
        return; // keep the spinner while the browser leaves
      }
      if (data.alreadyActive) {
        window.location.href = '/calculator';
        return;
      }
      setError(data.demo ? CHECKOUT_UNAVAILABLE : data.error || 'Could not open checkout. Please try again.');
    } catch (err) {
      captureClientError(err, 'useProCheckout', { context: 'checkout request failed', source: opts.source });
      setError('Connection error. Please try again.');
    }
    setIsLoading(false);
  }, [isAuthenticated, openAuthModal, user?.email]);

  // Resume the click that was waiting on signup.
  useEffect(() => {
    if (isAuthenticated && pending.current) {
      const opts = pending.current;
      pending.current = null;
      void start(opts);
    }
  }, [isAuthenticated, start]);

  return { start, isLoading, error };
}

/**
 * Whether this person can still start the free trial, so buttons can say
 * "Start 7-day free trial" or "Start Pro" honestly. Signed-out visitors are
 * treated as eligible.
 */
export function useTrialEligibility(): { eligible: boolean; loading: boolean } {
  const { isAuthenticated, user } = useAuth();
  const [state, setState] = useState<{ eligible: boolean; loading: boolean }>({ eligible: true, loading: false });

  useEffect(() => {
    if (!isAuthenticated) {
      setState({ eligible: true, loading: false });
      return;
    }
    let cancelled = false;
    setState((s) => ({ ...s, loading: true }));
    fetch('/api/trial/start', { method: 'GET' })
      .then((r) => r.json())
      .then((d) => { if (!cancelled) setState({ eligible: d.eligible !== false, loading: false }); })
      .catch(() => { if (!cancelled) setState({ eligible: true, loading: false }); });
    return () => { cancelled = true; };
  }, [isAuthenticated, user?.id]);

  return state;
}
