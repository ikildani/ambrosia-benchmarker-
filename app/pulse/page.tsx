'use client';

import { Suspense, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import AmbrosiaLogo from '@/components/AmbrosiaLogo';
import MarketPulse from '@/components/pulse/MarketPulse';
import AuthModal from '@/components/AuthModal';
import { useAuth } from '@/contexts/AuthContext';

export default function PulsePage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-12 h-12 rounded-full border-4 border-teal-200 border-t-teal-500 animate-spin" /></div>}>
      <PulsePageInner />
    </Suspense>
  );
}

function PulsePageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const weekParam = searchParams.get('week');
  const {
    isAuthenticated,
    user,
    tier,
    signIn,
    signOut,
    openAuthModal,
    closeAuthModal,
    showAuthModal,
    authModalMode,
    isLoading,
  } = useAuth();

  const handleAuthSuccess = (email: string, name: string) => {
    signIn(email, name);
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-teal-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      {/* Compact Header */}
      <header className="sticky top-0 z-50 bg-white/95 dark:bg-slate-900/95 backdrop-blur-xl border-b border-slate-200 dark:border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-14">
            <Link href="/" className="flex items-center">
              <AmbrosiaLogo variant="auto" height={32} />
            </Link>
            <nav className="hidden md:flex items-center gap-6">
              <Link href="/calculator" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 transition-colors">Calculator</Link>
              <Link href="/pulse" className="text-sm font-medium text-teal-600 dark:text-teal-400">Pulse</Link>
              <Link href="/#pricing" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 transition-colors">Pricing</Link>
            </nav>
            <div className="flex items-center gap-3">
              {isAuthenticated ? (
                <div className="flex items-center gap-3">
                  <Link href="/dashboard" className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-teal-600 dark:hover:text-teal-400 transition-colors">
                    Dashboard
                  </Link>
                  <button
                    onClick={signOut}
                    className="text-sm font-medium text-slate-500 dark:text-slate-400 hover:text-red-500 transition-colors"
                  >
                    Sign Out
                  </button>
                </div>
              ) : (
                <>
                  <button
                    onClick={() => openAuthModal('signin')}
                    className="text-sm font-medium text-slate-600 dark:text-slate-300 hover:text-teal-600"
                  >
                    Sign In
                  </button>
                  <button
                    onClick={() => openAuthModal('signup')}
                    className="px-4 py-2 text-sm font-semibold rounded-lg bg-gradient-to-r from-teal-500 to-cyan-500 text-white hover:from-teal-600 hover:to-cyan-600 transition-all"
                  >
                    Get Started
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Hero */}
      <div className="bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-teal-500/20 text-teal-300 text-xs font-semibold rounded-full">
              Weekly Intelligence
            </span>
            <span className="px-3 py-1 bg-amber-500/20 text-amber-300 text-xs font-semibold rounded-full flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
              PRO
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Market Pulse</h1>
          <p className="text-lg text-slate-300 max-w-2xl">
            Weekly deal intelligence, benchmark shifts, and trial updates across biotech licensing.
            Know what moved before your next board meeting.
          </p>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="w-12 h-12 rounded-full border-4 border-teal-200 border-t-teal-500 animate-spin" />
          </div>
        ) : (
          <MarketPulse
            isPro={tier === 'pro'}
            userId={user?.id}
            week={weekParam || undefined}
            onUpgrade={() => router.push('/#pricing')}
          />
        )}
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={closeAuthModal}
        initialMode={authModalMode}
        onSuccess={handleAuthSuccess}
      />
    </div>
  );
}
