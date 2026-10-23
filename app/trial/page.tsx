'use client';

import { useEffect, useState, useCallback, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AuthModal from '@/components/AuthModal';
import { ENGINE_COUNT } from '@/lib/config/constants';

function TrialPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, tier } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const email = searchParams.get('email') || '';
  const ref = searchParams.get('ref') || 'invite';

  const [usedTrialUrl, setUsedTrialUrl] = useState<string | null>(null);

  const activateTrial = useCallback(async () => {
    if (activating) return;
    setActivating(true);
    setError(null);

    try {
      const res = await fetch('/api/trial/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ billingInterval: 'monthly', source: `trial_page_${ref}`.slice(0, 40) }),
      });
      const data = await res.json();
      if (data.url && data.trial === false) {
        // Already used their trial: say so before sending them to a paid checkout.
        setUsedTrialUrl(data.url);
        setActivating(false);
      } else if (data.url) {
        window.location.href = data.url;
      } else if (data.alreadyActive) {
        router.push('/calculator');
      } else {
        setError(data.error || 'Something went wrong. Please try again.');
        setActivating(false);
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setActivating(false);
    }
  }, [activating, ref, router]);

  // Open checkout once on arrival; retries go through the buttons, so an
  // error or an already-used trial does not re-fire the request in a loop.
  const autoStarted = useRef(false);
  useEffect(() => {
    if (user && tier !== 'pro' && tier !== 'report' && tier !== 'portfolio') {
      if (autoStarted.current) return;
      autoStarted.current = true;
      activateTrial();
    } else if (user && (tier === 'pro' || tier === 'report' || tier === 'portfolio')) {
      router.push('/calculator');
    } else if (!user) {
      setShowAuth(true);
    }
  }, [user, tier, activateTrial, router]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
      <div className="mx-auto max-w-md px-6 py-16 text-center">
        <div className="mb-6">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-xl bg-cyan-500/10 text-cyan-400">
            <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
        </div>

        <h1 className="text-2xl font-semibold tracking-tight text-slate-50">
          Start your 7-day Pro trial
        </h1>
        <p className="mt-3 text-sm text-slate-400">
          Full access to all {ENGINE_COUNT} engines, reformulation benchmarking, partner matching, and comparable deals.
          Add a card to start; nothing is charged for 7 days, and we email you 3 days before the first charge.
        </p>

        {activating && (
          <div className="mt-8 flex flex-col items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
            <p className="text-sm text-slate-400">Opening secure checkout...</p>
          </div>
        )}

        {usedTrialUrl && (
          <div className="mt-6 rounded-lg border border-slate-700 bg-slate-900/60 p-4">
            <p className="text-sm text-slate-300">This account has already used its free trial. You can continue straight to Pro, and cancel anytime.</p>
            <a href={usedTrialUrl} className="mt-3 inline-block rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 hover:bg-cyan-400">
              Continue to Pro
            </a>
          </div>
        )}

        {error && (
          <div className="mt-6 rounded-lg bg-red-900/20 border border-red-800/40 p-4">
            <p className="text-sm text-red-300">{error}</p>
            <button
              onClick={() => { setError(null); activateTrial(); }}
              className="mt-3 text-sm text-cyan-400 hover:text-cyan-300"
            >
              Try again
            </button>
          </div>
        )}

        {showAuth && (
          <AuthModal
            isOpen={true}
            onClose={() => router.push('/')}
            onSuccess={() => setShowAuth(false)}
            initialMode="signup"
            prefillEmail={email}
          />
        )}
      </div>
    </main>
  );
}

export default function TrialPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
      </main>
    }>
      <TrialPageContent />
    </Suspense>
  );
}
