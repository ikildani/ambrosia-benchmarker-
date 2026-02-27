'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusTrap } from '@/lib/hooks/useFocusTrap';

export default function ExitIntentCapture() {
  const [show, setShow] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const handleClose = useCallback(() => setShow(false), []);
  useFocusTrap(modalRef, show, handleClose);
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (sessionStorage.getItem('exit_intent_shown') || sessionStorage.getItem('email_captured')) return;

    let triggered = false;

    // Desktop: mouse leaves viewport
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !triggered) {
        triggered = true;
        sessionStorage.setItem('exit_intent_shown', 'true');
        setShow(true);
      }
    };

    // Mobile: 30s timer
    const timer = setTimeout(() => {
      if (!triggered && !sessionStorage.getItem('exit_intent_shown')) {
        triggered = true;
        sessionStorage.setItem('exit_intent_shown', 'true');
        setShow(true);
      }
    }, 30000);

    document.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      document.removeEventListener('mouseleave', handleMouseLeave);
      clearTimeout(timer);
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || submitting) return;
    setSubmitting(true);
    try {
      await fetch('https://formspree.io/f/maqbwgbq', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'exit_intent' }),
      });
      fetch('/api/newsletter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: 'exit_intent' }),
      }).catch(() => {});
      setSubmitted(true);
      sessionStorage.setItem('email_captured', 'true');
    } catch {
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-fade-in">
      <div className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm" onClick={() => setShow(false)} />
      <div ref={modalRef} role="dialog" aria-modal="true" aria-label="Weekly deal insights signup" tabIndex={-1} className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl max-w-md w-full p-6 sm:p-8">
        <button onClick={() => setShow(false)} className="absolute top-3 right-3 text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" /></svg>
        </button>

        {submitted ? (
          <div className="text-center py-4">
            <div className="w-12 h-12 rounded-full bg-teal-100 dark:bg-teal-900/30 flex items-center justify-center mx-auto mb-3">
              <svg className="w-6 h-6 text-teal-600 dark:text-teal-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h3 className="text-lg font-bold text-slate-900 dark:text-white mb-1">You&apos;re in!</h3>
            <p className="text-sm text-slate-600 dark:text-slate-400">Watch your inbox for weekly deal insights.</p>
          </div>
        ) : (
          <>
            <div className="text-center mb-5">
              <div className="w-12 h-12 rounded-full bg-gradient-to-br from-teal-500 to-cyan-500 flex items-center justify-center mx-auto mb-3 shadow-glow">
                <svg className="w-6 h-6 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">Get Weekly Deal Insights</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                Join 200+ BD professionals getting the latest biopharma deal benchmarks and trends.
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                required
                autoFocus
                className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 text-sm font-semibold bg-gradient-to-r from-teal-600 to-cyan-500 text-white rounded-xl hover:from-teal-700 hover:to-cyan-600 transition-all shadow-lg shadow-teal-500/20 disabled:opacity-50"
              >
                {submitting ? 'Subscribing...' : 'Subscribe — Free'}
              </button>
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center">No spam, unsubscribe anytime.</p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
