'use client';

import { useState, useEffect } from 'react';
import { CONSENT_EVENT, readConsent, type ConsentValue } from '@/components/ConsentScripts';

/**
 * Consent bar. One line on phones, sits under modals and the mobile menu (z-40),
 * and is the real gate for the ad pixel (see ConsentScripts). It used to be a
 * four-line card covering 17% of a phone screen at the same z-index as the
 * calculator's onboarding sheet.
 */
export default function CookieConsent() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (readConsent()) return;
    const timer = setTimeout(() => setVisible(true), 1200);
    return () => clearTimeout(timer);
  }, []);

  // One owner of the bottom edge: while the bar is up, any sticky bottom dock
  // (the calculator's live estimate) moves above it instead of underneath it.
  useEffect(() => {
    document.documentElement.classList.toggle('has-consent-bar', visible);
    return () => document.documentElement.classList.remove('has-consent-bar');
  }, [visible]);

  function decide(value: ConsentValue) {
    try {
      localStorage.setItem('cookie-consent', value);
    } catch {
      // storage unavailable: session-only decision
    }
    setVisible(false);
    if (value === 'declined') {
      (window as unknown as Record<string, unknown>)['va'] = () => {};
    }
    window.dispatchEvent(new Event(CONSENT_EVENT));
  }

  if (!visible) return null;

  return (
    <div
      role="region"
      aria-label="Cookie preferences"
      className="fixed bottom-0 inset-x-0 z-40 px-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] sm:px-6 sm:pb-5 animate-fade-in pointer-events-none"
    >
      <div className="pointer-events-auto mx-auto max-w-3xl rounded-xl border border-slate-200 dark:border-slate-700 bg-white/95 dark:bg-slate-900/95 backdrop-blur shadow-lg px-3 py-1.5 sm:px-4 sm:py-2 flex items-center gap-2 sm:gap-4">
        <p className="flex-1 min-w-0 text-[13px] sm:text-sm leading-snug text-slate-600 dark:text-slate-300">
          Cookies for sign-in and analytics.{' '}
          <a href="/privacy" className="underline underline-offset-2 hover:text-slate-900 dark:hover:text-white">Details</a>
        </p>
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={() => decide('declined')}
            className="min-h-11 px-3 text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white rounded-lg transition-colors"
          >
            Decline
          </button>
          <button
            type="button"
            onClick={() => decide('accepted')}
            className="min-h-11 px-4 text-sm font-semibold text-white bg-slate-900 dark:bg-white dark:text-slate-900 rounded-lg hover:bg-slate-800 dark:hover:bg-slate-100 transition-colors"
          >
            Accept
          </button>
        </div>
      </div>
    </div>
  );
}
