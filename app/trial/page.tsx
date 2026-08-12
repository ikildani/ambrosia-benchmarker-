'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useAuth } from '@/contexts/AuthContext';
import AuthModal from '@/components/AuthModal';

function TrialPageContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, tier } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [activating, setActivating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const email = searchParams.get('email') || '';
  const ref = searchParams.get('ref') || 'invite';

  const activateTrial = useCallback(async () => {
    if (activating) return;
    setActivating(true);
    setError(null);

    try {
      const res = await fetch('/api/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          purchaseType: 'subscription',
          billingInterval: 'monthly',
          trial: true,
          email: user?.email,
        }),
      });
      const data = await res.json();
      if (data.url) {
        window.location.href = data.url;
      } else if (data.error) {
        setError(data.error);
        setActivating(false);
      }
    } catch {
      setError('Something went wrong. Please try again.');
      setActivating(false);
    }
  }, [activating, user?.email]);

  useEffect(() => {
    if (user && tier !== 'pro' && tier !== 'report' && tier !== 'portfolio') {
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
          Full access to all 21 engines, reformulation benchmarking, partner matching, and comparable deals. No charge for 7 days.
        </p>

        {activating && (
          <div className="mt-8 flex flex-col items-center gap-3">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-400 border-t-transparent" />
            <p className="text-sm text-slate-400">Setting up your trial...</p>
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
