'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useFocusTrap } from '@/lib/hooks/useFocusTrap';
import { useAuth } from '@/contexts/AuthContext';

interface VariantCopy {
  id: string;
  headline: string;
  subtext: string;
  buttonText: string;
  footnote: string;
}

const DEFAULT_COPY: VariantCopy = {
  id: 'A',
  headline: 'Wait — before you go',
  subtext: 'Get a free deal benchmark report for your next calculation.',
  buttonText: 'Send My Free Report',
  footnote: 'No spam, unsubscribe anytime. 3,000+ deals benchmarked.',
};

const TA_DISPLAY: Record<string, string> = {
  oncology: 'oncology', neurology: 'neurology', immunology: 'immunology',
  metabolic: 'metabolic', cardiovascular: 'cardiovascular', rareDisease: 'rare disease',
  hematology: 'hematology', infectiousDisease: 'infectious disease',
  ophthalmology: 'ophthalmology', dermatology: 'dermatology',
  gastroenterology: 'gastroenterology', womensHealth: "women's health",
};

/** Return the user's most frequent TA from localStorage prefs, or null. */
function getTopUserTA(): string | null {
  try {
    const prefs = JSON.parse(localStorage.getItem('user_prefs') || '{}');
    const tas: string[] = prefs.tas || [];
    if (tas.length === 0) return null;
    // Count frequencies
    const counts = new Map<string, number>();
    for (const ta of tas) {
      counts.set(ta, (counts.get(ta) || 0) + 1);
    }
    // Return the most frequent
    let topTA = '';
    let topCount = 0;
    for (const [ta, count] of counts) {
      if (count > topCount) { topTA = ta; topCount = count; }
    }
    return topTA || null;
  } catch {
    return null;
  }
}

export default function ExitIntentCapture() {
  const { tier } = useAuth();
  const [show, setShow] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const handleClose = useCallback(() => setShow(false), []);
  useFocusTrap(modalRef, show, handleClose);
  const [email, setEmail] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copy, setCopy] = useState<VariantCopy>(DEFAULT_COPY);

  // Fetch active variant copy from API, then personalize with user prefs
  useEffect(() => {
    fetch('/api/exit-intent')
      .then((res) => res.json())
      .then((data: VariantCopy) => {
        if (data?.id && data?.headline) setCopy(data);
      })
      .catch(() => {}) // fallback to default
      .finally(() => {
        // Personalize subtext based on user's calculation history
        const topTA = getTopUserTA();
        if (topTA) {
          const taName = TA_DISPLAY[topTA] || topTA;
          setCopy((prev) => ({
            ...prev,
            subtext: `See how your ${taName} deal compares to 300+ recent transactions.`,
          }));
        }
      });
  }, []);

  useEffect(() => {
    // Don't show for paid-tier users
    if (tier === 'pro' || tier === 'report' || tier === 'portfolio') return;

    // Desktop only -- exit intent doesn't work on mobile
    if (window.innerWidth < 768 || !window.matchMedia('(pointer: fine)').matches) return;

    if (localStorage.getItem('exit_intent_shown') || localStorage.getItem('email_captured')) return;

    let triggered = false;

    // Desktop: mouse leaves viewport
    const handleMouseLeave = (e: MouseEvent) => {
      if (e.clientY <= 0 && !triggered) {
        triggered = true;
        localStorage.setItem('exit_intent_shown', 'true');
        setShow(true);
      }
    };

    document.addEventListener('mouseleave', handleMouseLeave);
    return () => {
      document.removeEventListener('mouseleave', handleMouseLeave);
    };
  }, [tier]);

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
      localStorage.setItem('email_captured', 'true');
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
      <div ref={modalRef} role="dialog" aria-modal="true" aria-label="Weekly deal insights signup" tabIndex={-1} className="relative bg-white dark:bg-slate-800 rounded-2xl shadow-2xl dark:shadow-slate-950/50 max-w-md w-full p-6 sm:p-8">
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
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z" />
                </svg>
              </div>
              <h3 className="text-xl font-bold text-slate-900 dark:text-white mb-1">{copy.headline.replace('—', '—')}</h3>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {copy.subtext}
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
                aria-label="Email address"
                className="w-full px-4 py-3 text-sm rounded-xl border border-slate-200 dark:border-slate-600 bg-white dark:bg-slate-700 text-slate-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
              <button
                type="submit"
                disabled={submitting}
                className="w-full py-3 text-sm font-semibold bg-gradient-to-r from-teal-600 to-cyan-500 text-white rounded-xl hover:from-teal-700 hover:to-cyan-600 transition-all shadow-lg shadow-teal-500/20 dark:shadow-teal-400/10 disabled:opacity-50"
              >
                {submitting ? 'Sending...' : copy.buttonText}
              </button>
              <p className="text-xs text-slate-500 dark:text-slate-400 text-center">{copy.footnote}</p>
            </form>
          </>
        )}
      </div>
    </div>
  );
}
