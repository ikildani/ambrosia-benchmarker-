'use client';

import { Suspense } from 'react';
import Header from '@/components/Header';
import { RadarFeed } from '@/components/radar/RadarFeed';
import { RadarUpgradeGate } from '@/components/radar/RadarUpgradeGate';
import { useAuth } from '@/contexts/AuthContext';
import AuthModal from '@/components/AuthModal';

export default function RadarPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center"><div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-slate-600 animate-spin" /></div>}>
      <RadarPageInner />
    </Suspense>
  );
}

function RadarPageInner() {
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
    isPortfolioAdmin,
  } = useAuth();

  const isPro = tier === 'pro' || tier === 'report' || tier === 'portfolio';

  const handleAuthSuccess = (email: string, name: string) => {
    signIn(email, name);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-white to-slate-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
        <div className="w-12 h-12 rounded-full border-4 border-slate-200 border-t-slate-600 animate-spin" />
      </div>
    );
  }

  if (!isPro) {
    return (
      <>
        <Header
          isAuthenticated={isAuthenticated}
          userName={user?.name}
          userEmail={user?.email}
          tier={tier}
          isPortfolioAdmin={isPortfolioAdmin}
          onSignInClick={() => openAuthModal('signin')}
          onSignUpClick={() => openAuthModal('signup')}
          onSignOut={signOut}
        />
        <RadarUpgradeGate isAuthenticated={isAuthenticated} />
        <AuthModal
          isOpen={showAuthModal}
          onClose={closeAuthModal}
          onSuccess={handleAuthSuccess}
          initialMode={authModalMode}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-amber-50/20 dark:from-slate-950 dark:via-slate-900 dark:to-slate-950">
      <Header
        isAuthenticated={isAuthenticated}
        userName={user?.name}
        userEmail={user?.email}
        tier={tier}
        isPortfolioAdmin={isPortfolioAdmin}
        onSignInClick={() => openAuthModal('signin')}
        onSignUpClick={() => openAuthModal('signup')}
        onSignOut={signOut}
      />

      {/* Hero */}
      <div className="bg-gradient-to-br from-navy-900 via-navy-800 to-navy-900 text-white pt-16 sm:pt-20 lg:pt-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
          <div className="flex items-center gap-3 mb-4">
            <span className="px-3 py-1 bg-amber-500/20 text-amber-300 text-xs font-semibold rounded-full">
              Asset Intelligence
            </span>
            <span className="px-3 py-1 bg-amber-500/20 text-amber-300 text-xs font-semibold rounded-full flex items-center gap-1">
              <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20"><path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" /></svg>
              PRO
            </span>
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold mb-3">Asset Radar</h1>
          <p className="text-lg text-slate-300 max-w-2xl">
            Clinical-stage assets indexed from ClinicalTrials.gov, cross-referenced against
            real deal comps. Partnership status, licensing intent signals, and predicted deal terms
            for every program in the universe.
          </p>
        </div>
      </div>

      {/* Main content */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <RadarFeed />
      </div>

      <AuthModal
        isOpen={showAuthModal}
        onClose={closeAuthModal}
        onSuccess={handleAuthSuccess}
        defaultMode={authModalMode}
      />
    </div>
  );
}
